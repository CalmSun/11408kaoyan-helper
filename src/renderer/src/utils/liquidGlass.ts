/**
 * 液态玻璃引擎（v3.7.0 · 对齐 @tinymomentum/liquid-glass-vue 的 SVG 位移方案）
 * ════════════════════════════════════════════════════════════════════
 * 本文件只负责**生命周期**：扫描哪些元素该有玻璃、给它们挂一个空的玻璃层、
 * 视口外休眠、尺寸变化重排。渲染全部交给 CSS + 一个共享的 SVG 滤镜。
 *
 * 【为什么放弃 v3.7.0 早先的 WebGL 方案】
 * 实测滚动时单帧长任务 1565ms。根因是每帧、每块玻璃都 `texImage2D` 重传整张壁纸
 * （1440×900 ≈ 5MB × 11 块 × 60fps ≈ 3.3GB/s）。修掉之后滚动 0 长任务，
 * 但 WebGL 仍需持有 N 个上下文、每帧跑片元着色器，对 11 块玻璃来说是不必要的开销。
 * 用户明确要求取消 WebGL，改用 SVG 位移路线（m01992 / m01995 选定方案 B）。
 *
 * 【关键实验：为什么这次 SVG 滤镜能生效】
 * v3.6.6 曾把 `filter: url()` 挂在 `.lg-warp` 上而毫无效果，原因是那个层是**空的且
 * z-index:-1** —— 它背后没有 backdrop 可采样，自身也没有内容可位移。
 * 判决实验（.lgshot/probe-turb.js）证明：把 `backdrop-filter` 与 `filter: url(#…)
 * 放在**同一个元素**上时，滤镜确实会扭曲该元素的渲染输出（含其 backdrop 采样）。
 *
 * 【但滤镜会连内容一起扭曲】
 * 同一实验里，测试元素的所有子节点（按钮、文字、数字）都被撕成波浪形。
 * 所以本引擎给每个玻璃面插入一个**空的** `.lg-glass` 层来承接两个滤镜，
 * 元素的原有内容保持同级、不进入该层 —— 内容不受任何影响
 * （.lgshot/probe-split.js 已实测：文字清晰锐利，背景仍被扰动）。
 *
 * 分层（依据苹果 HIG：玻璃给浮层用，正文不行）：
 *   · refract：浮在内容之上的外壳 —— 侧边栏 / 顶栏 / 番茄钟浮窗 / 弹层
 *   · light：内容卡片也只吃边缘光照，不吃大范围折射，保证正文可读
 *
 * 性能：
 *   · 零逐帧 JS：没有 canvas、没有 rAF 循环、没有滚动重绘，滚动时浏览器只做合成
 *   · 全部元素共享**一个** `<filter>`：feTurbulence 是程序噪声，与元素无关
 *   · 视口外元素由 IntersectionObserver 打上 .lg-sleep，玻璃层 display:none
 */

import {
  FILTER_ID,
  applyGlassStyle,
  createFilterDefs,
  type GlassTier,
  type LiquidGlassOptions
} from './glassFilter'

type GlassEntry = {
  el: HTMLElement
  tier: GlassTier
  /** 本引擎插入的空玻璃层 */
  layer: HTMLElement
  /** 元素原本的 position，卸载时还原 */
  prevPosition: string
}

export type { GlassTier, LiquidGlassOptions }

/** 浮在内容之上的外壳：允许更强的折射与通透 */
const DEFAULT_REFRACT_SELECTOR = '.side-nav,.titlebar,.pomodoro-mini,.el-popper,.el-message'
/** 全部玻璃面（含内容卡片）：折射收窄，保证正文可读 */
const DEFAULT_LIGHT_SELECTOR =
  '.card,.glass-card,.stat-card,.algo-card,.word-card,.formula-card,.el-dialog,.el-drawer,.el-message-box'

class LiquidGlassEngine {
  private entries: GlassEntry[] = []
  private refractSelector = DEFAULT_REFRACT_SELECTOR
  private lightSelector = DEFAULT_LIGHT_SELECTOR
  private observer: MutationObserver | null = null
  private io: IntersectionObserver | null = null
  private filterDefs: SVGSVGElement | null = null
  private started = false
  private options: LiquidGlassOptions = {}

  available = true

  init(options: LiquidGlassOptions = {}): boolean {
    if (this.filterDefs) return this.available
    if (options.refractSelector) this.refractSelector = options.refractSelector
    if (options.lightSelector) this.lightSelector = options.lightSelector

    // 能力探测：环境必须支持 backdrop-filter，否则整站退回普通卡片观感
    const probe = document.createElement('div')
    probe.style.backdropFilter = 'blur(1px)'
    if (!probe.style.backdropFilter) {
      this.available = false
      console.info('[liquidGlass] 当前环境不支持 backdrop-filter，保持 CSS 玻璃')
      return false
    }

    this.options = options
    this.filterDefs = createFilterDefs(FILTER_ID)
    document.body.appendChild(this.filterDefs)
    return true
  }

  /** 扫描并挂载。可重复调用，已挂载且层级未变的直接跳过 */
  mount(): void {
    if (!this.available || !this.filterDefs) return

    const wanted = new Map<HTMLElement, GlassTier>()
    for (const el of document.querySelectorAll<HTMLElement>(this.lightSelector)) {
      wanted.set(el, 'light')
    }
    for (const el of document.querySelectorAll<HTMLElement>(this.refractSelector)) {
      wanted.set(el, 'refract')
    }

    // 回收已消失或降级的条目
    for (const entry of [...this.entries]) {
      const tier = wanted.get(entry.el)
      if (entry.el.isConnected && tier === entry.tier) continue
      this.teardown(entry)
      this.entries = this.entries.filter((e) => e !== entry)
    }

    const fresh: GlassEntry[] = []
    for (const [el, tier] of wanted) {
      if (this.entries.some((e) => e.el === el)) continue
      // 尺寸门槛：弹层常先以 0 尺寸插入、随后才展开，MutationObserver 会再补一趟
      if (el.clientWidth < 48 || el.clientHeight < 32) continue
      const entry = this.setup(el, tier)
      if (!entry) continue
      this.entries.push(entry)
      this.io?.observe(el)
      fresh.push(entry)
    }

    if (fresh.length) this.syncVisible(fresh)
  }

  private setup(el: HTMLElement, tier: GlassTier): GlassEntry | null {
    const prevPosition = el.style.position
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative'

    const layer = document.createElement('div')
    layer.className = 'lg-glass'
    layer.setAttribute('aria-hidden', 'true')
    applyGlassStyle(layer, tier, this.options)

    // 玻璃层必须是第一个子节点：它带 z-index:-1，配合元素的 isolation
    // 会落在元素背景之上、内容之下。若追加到末尾，它自己也会参与内容的层叠顺序。
    el.insertBefore(layer, el.firstChild)

    el.classList.add('lg-on')
    if (tier === 'refract') el.classList.add('lg-refract')

    return { el, tier, layer, prevPosition }
  }

  private teardown(entry: GlassEntry): void {
    entry.layer.remove()
    entry.el.classList.remove('lg-on', 'lg-refract', 'lg-sleep')
    entry.el.style.position = entry.prevPosition
  }

  /**
   * 视口外的元素隐藏玻璃层：合成器不再为它做 backdrop 采样。
   * 用 IntersectionObserver 而不是滚动时逐个 getBoundingClientRect ——
   * 后者是 O(N) 强制重排，长列表一滚就把主线程吃满。
   */
  private setSleep(entry: GlassEntry, asleep: boolean): void {
    entry.el.classList.toggle('lg-sleep', asleep)
  }

  private syncVisible(list?: GlassEntry[]): void {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const pad = 200
    for (const entry of list ?? this.entries) {
      const r = entry.el.getBoundingClientRect()
      const visible = r.bottom > -pad && r.top < vh + pad && r.right > -pad && r.left < vw + pad
      this.setSleep(entry, !visible)
    }
  }

  start(): void {
    if (this.started || !this.available) return
    this.started = true

    this.io = new IntersectionObserver(
      (records) => {
        for (const rec of records) {
          const entry = this.entries.find((e) => e.el === rec.target)
          if (entry) this.setSleep(entry, !rec.isIntersecting)
        }
      },
      { rootMargin: '200px 0px 200px 0px', threshold: 0 }
    )
    for (const entry of this.entries) this.io.observe(entry.el)

    // 路由切换 / 条件渲染 / 列表刷新后补挂载
    let debounce = 0
    let settle = 0
    let selfMutating = false
    const runMount = (): void => {
      selfMutating = true
      this.mount()
      selfMutating = false
    }
    this.observer = new MutationObserver(() => {
      if (selfMutating) return
      window.clearTimeout(debounce)
      window.clearTimeout(settle)
      debounce = window.setTimeout(() => {
        runMount()
        // 弹层（popper / dialog）常先以 0 尺寸插入、随后才展开，会被尺寸门槛跳过
        settle = window.setTimeout(runMount, 260)
      }, 140)
    })
    this.observer.observe(document.body, { childList: true, subtree: true })

    this.mount()
    this.syncVisible()
  }

  destroy(): void {
    this.observer?.disconnect()
    this.observer = null
    this.io?.disconnect()
    this.io = null
    for (const e of this.entries) this.teardown(e)
    this.entries = []
    this.filterDefs?.remove()
    this.filterDefs = null
    this.started = false
  }
}

export const liquidGlass = new LiquidGlassEngine()

/** 应用入口调用：初始化 + 挂载 + 启动监听 */
export function initLiquidGlass(options: LiquidGlassOptions = {}): void {
  if (!liquidGlass.init(options)) return
  liquidGlass.mount()
  liquidGlass.start()
}
