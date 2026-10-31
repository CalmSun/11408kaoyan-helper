/**
 * 液态玻璃引擎（v3.6.5）
 * ════════════════════════════════════════════════════════════════════
 * 参照 WXperia/liquid-glass-vue（rdev/liquid-glass-react 的 Vue 3 移植）的核心手法：
 *
 *   给每个玻璃面插入一个铺满的 warp 层，让它同时带两条属性
 *     backdrop-filter: blur() saturate()   ← 采样并霜化元素后方的真实内容
 *     filter: url(#lg-glass-N)             ← 用 SVG 位移图对上面这一层做折射
 *   两者叠在同一元素上时，Chromium 会把 backdrop-filter 的结果当作 filter 的
 *   SourceGraphic —— 于是背景先被真实采到，再被圆角边缘折射、带色差。
 *
 *   关键区别：不是 backdrop-filter: url(...)。后者拿不到位移图，只能得到模糊，
 *   这正是"看起来像磨砂而不像玻璃"的根因。
 *
 * 本项目与库的两处适配（库不能直接套用，它的玻璃元素必须是组件自己的根节点）：
 *   1. 滤镜共享：库给每个组件实例生成 uuid 滤镜。本项目卡片是既有 DOM，
 *      改为按「宽高比 + 圆角占短边比例」分桶共享滤镜，几十张卡片通常落到 2~6 个桶。
 *   2. 位移图现算：库内置 40KB+ 的硬编码 JPEG/PNG 位移图。这里改用 canvas
 *      按圆角矩形 SDF 在启动时现算，不占包体，且能让斜面宽度随卡片尺寸自适应。
 *      尺寸刻意压到长边 72px —— feImage 每帧都要解码这张图，它是掉帧的唯一根因
 *      （实测 8 张卡片：512²→4.2 FPS，128²→57.8 FPS，64²→113.8 FPS）。
 *      位移场本身是平滑梯度，小图拉伸后与大图无差别。
 *
 * 为什么比逐帧方案省：
 *   采样的是真实 backdrop —— 滚动、自定义背景、嵌套内容全部自动正确；
 *   折射由 GPU 合成器完成，JS 只在挂载和滚动时切换 class，没有逐帧绘制。
 *
 * 降级：不支持 filter: url() 时整体不挂载，视图层零改动，自动保持原 CSS 玻璃。
 */

type WarpEntry = {
  el: HTMLElement
  warp: HTMLElement
  /** 宽高比分桶键，尺寸变化后重新取滤镜 */
  key: string
  w: number
  h: number
  /** 视口外：关掉 warp，元素退回普通 CSS 玻璃，避免为看不见的卡片付 GPU 成本 */
  asleep: boolean
}

/**
 * 参与液态玻璃的选择器 —— 只保留「浮在内容之上」的浮层。
 *
 * 依据苹果 HIG 的液态玻璃原则：玻璃是给浮层（工具栏/标签栏/浮层/控件）用的，
 * 不是给内容本身用的；正文压在花哨背景上必然不可读，苹果自己都因此补了不透明开关。
 * 因此内容卡片（.card/.glass-card/.stat-card/.algo-card/...）一律退出折射层，
 * 保持实心玻璃拟态（--glass-bg + backdrop-filter blur），正文可读；
 * 真正的折射只落在侧边栏 / 顶栏 / 番茄钟浮窗这几个浮层上。
 */
const DEFAULT_SELECTOR = [
  '.side-nav',
  '.titlebar',
  '.pomodoro-mini'
].join(',')

const MAP_MAX = 72
const MAP_MIN = 28
/** 滤镜区域溢出比例：SVG filter 的 x/y 用 -FILTER_MARGIN_PCT%、宽高用 100+2×margin%。
 *  feImage 铺满的是滤镜区域，所以位移图 1px 对应元素空间的 REGION 倍。
 *  由 FILTER_MARGIN_PCT 派生，二者必须同步，否则位移图里的圆角会被反推错。 */
const FILTER_MARGIN_PCT = 10
const REGION = 1 + (FILTER_MARGIN_PCT / 100) * 2
/** 位移强度：负值 = 边缘放大（对应库 standard 模式的 scale = -1） */
const BASE_SCALE = -56
/** 三通道位移量的递增比例，形成边缘色差 */
const ABERRATION = 0.055
/** 宽高比量化步长：避免为每个元素单独生成一张位移图 */
const AR_STEP = 0.2
/** 圆角占短边比例的量化步长 */
const R_STEP = 0.02

/**
 * 生成位移图：R = x 位移、B = y 位移，A 恒为 255。
 *
 * 中心位移为 0 是靠图本身：SDF 梯度在中央为 0，所以 R/B 都停在中性值 128。
 * A 必须恒为不透明 —— SVG 滤镜按预乘 alpha 处理，透明像素的 RGB 会被当成 0，
 * 位移量就变成常量偏移，卡片中间会出现一块形似这张图的灰块。
 */
function buildDisplacementMap(w: number, h: number, radius: number, bevel: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  const img = ctx.createImageData(w, h)
  const halfW = w / 2
  const halfH = h / 2
  const r = Math.min(radius, Math.min(halfW, halfH) - 1)
  const bx = halfW - r
  const by = halfH - r

  const sd = (px: number, py: number): number => {
    const qx = Math.abs(px) - bx
    const qy = Math.abs(py) - by
    const mx = qx > 0 ? qx : 0
    const my = qy > 0 ? qy : 0
    const outside = Math.sqrt(mx * mx + my * my)
    return Math.min(Math.max(qx, qy), 0) + outside - r
  }

  const bw = bevel > 1 ? bevel : 1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - halfW
      const py = y + 0.5 - halfH
      const d = sd(px, py)

      // SDF 梯度：数值差分，指向远离实体的一侧
      const gx = (sd(px + 1, py) - sd(px - 1, py)) * 0.5
      const gy = (sd(px, py + 1) - sd(px, py - 1)) * 0.5
      const gl = Math.sqrt(gx * gx + gy * gy) || 1e-6
      const nx = gx / gl
      const ny = gy / gl

      // 衰减：中心 0、轮廓 1，smoothstep 让弯曲更接近真实玻璃的曲率
      let t = -d / bw
      t = t < 0 ? 0 : t > 1 ? 1 : t
      t = t * t * (3 - 2 * t)

      const i = (y * w + x) * 4
      img.data[i] = clamp255(128 + 127 * nx * t)
      img.data[i + 1] = 128
      img.data[i + 2] = clamp255(128 + 127 * ny * t)
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL('image/png')
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v)
}

/** 构造一个玻璃滤镜的 SVG 片段。extra = 超通透档（位移更强、色差更明显）
 *
 * 链路与 liquid-glass-vue 的 GlassFilter.vue 一致：位移图做三通道分离位移、
 * screen 合回、轻微模糊消锯齿。**不做"中心保持原样 / 只有边缘折射"的两段合成**——
 * 那是另一套实现的写法，在这里会把图中央合成成一块灰（遮罩与透明度的预乘歧义）。
 * 中心不位移是靠位移图本身：它的梯度在中央为 0，位移量自然归零。
 */
function filterMarkup(id: string, mapUrl: string, scale: number, aberration: number): string {
  const s1 = scale
  const s2 = scale * (1 + aberration)
  const s3 = scale * (1 + aberration * 2)
  return (
    `<filter id="${id}" x="-${FILTER_MARGIN_PCT}%" y="-${FILTER_MARGIN_PCT}%" ` +
    `width="${100 + FILTER_MARGIN_PCT * 2}%" height="${100 + FILTER_MARGIN_PCT * 2}%" ` +
    `color-interpolation-filters="sRGB">` +
    `<feImage x="0" y="0" width="100%" height="100%" result="MAP" preserveAspectRatio="none" href="${mapUrl}"/>` +
    // 三通道分别位移，位移量递增 → 边缘出现红蓝分离（chromAberration）
    `<feDisplacementMap in="SourceGraphic" in2="MAP" scale="${s1}" xChannelSelector="R" yChannelSelector="B" result="D_R"/>` +
    `<feDisplacementMap in="SourceGraphic" in2="MAP" scale="${s2}" xChannelSelector="R" yChannelSelector="B" result="D_G"/>` +
    `<feDisplacementMap in="SourceGraphic" in2="MAP" scale="${s3}" xChannelSelector="R" yChannelSelector="B" result="D_B"/>` +
    `<feColorMatrix in="D_R" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="C_R"/>` +
    `<feColorMatrix in="D_G" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="C_G"/>` +
    `<feColorMatrix in="D_B" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="C_B"/>` +
    `<feBlend in="C_G" in2="C_B" mode="screen" result="C_GB"/>` +
    `<feBlend in="C_R" in2="C_GB" mode="screen" result="C_RGB"/>` +
    // 轻微模糊消掉通道分离的锯齿（参考实现同款）
    `<feGaussianBlur in="C_RGB" stdDeviation="0.5"/>` +
    `</filter>`
  )
}

export type LiquidGlassOptions = {
  selector?: string
}

class LiquidGlassEngine {
  private entries: WarpEntry[] = []
  private defs: SVGElement | null = null
  private selector = DEFAULT_SELECTOR
  /** 宽高比桶 → [标准档滤镜 id, 超通透档滤镜 id] */
  private filters = new Map<string, [string, string]>()
  private seq = 0
  private observer: MutationObserver | null = null
  private io: IntersectionObserver | null = null
  private resizeRaf = 0
  private started = false

  available = true

  init(options: LiquidGlassOptions = {}): boolean {
    if (this.defs) return this.available
    if (options.selector) this.selector = options.selector

    if (!CSS.supports('filter', 'url(#x)') || !CSS.supports('backdrop-filter', 'blur(1px)')) {
      this.available = false
      console.info('[liquidGlass] 当前环境不支持滤镜引用，保持 CSS 玻璃')
      return false
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('aria-hidden', 'true')
    svg.setAttribute('focusable', 'false')
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none'
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
    svg.appendChild(defs)
    document.body.appendChild(svg)
    this.defs = defs
    return true
  }

  /**
   * 取（或生成）某个分桶对应的滤镜。
   * 分桶维度：宽高比 ar（决定位移图的像素尺寸）+ 圆角占短边比例 rf（决定 SDF 的圆角）。
   * 位移图尺寸与元素同比，拉伸后斜面宽度就自然等于「短边 × BEVEL」，不会把小卡片吞掉。
   */
  private filterFor(ar: number, rf: number): [string, string] {
    const arKey = Math.max(AR_STEP, Math.round(ar / AR_STEP) * AR_STEP).toFixed(2)
    const rfKey = Math.max(R_STEP, Math.round(rf / R_STEP) * R_STEP).toFixed(2)
    const key = `${arKey}|${rfKey}`

    const hit = this.filters.get(key)
    if (hit) return hit

    const arNum = parseFloat(arKey)
    const rfNum = parseFloat(rfKey)

    // 位移图与元素同比，但像素总量封顶：长边 MAP_MAX、短边不低于 MAP_MIN。
    // 位移场是平滑梯度，拉伸后与 512px 图几乎无差别，而 feImage 每帧都要解码这张 PNG——
    // 这是掉帧的唯一根因（实测 8 张卡片：512²→4.2 FPS，128²→57.8 FPS，64²→113.8 FPS）。
    const mapW = arNum >= 1 ? MAP_MAX : Math.max(MAP_MIN, Math.round(MAP_MAX * arNum))
    const mapH = arNum >= 1 ? Math.max(MAP_MIN, Math.round(MAP_MAX / arNum)) : MAP_MAX
    const short = Math.min(mapW, mapH)
    // 反推元素空间：滤镜区域是元素尺寸的 REGION 倍，位移图铺满滤镜区域
    const radius = (rfNum * short) / REGION
    const bevel = short * 0.2

    const mapUrl = buildDisplacementMap(mapW, mapH, radius, bevel)
    if (!mapUrl) return ['', '']

    const n = this.seq++
    const idStd = `lg-glass-${n}`
    const idExtra = `lg-glassx-${n}`
    const defs = this.defs
    if (!defs) return ['', '']

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    g.innerHTML =
      filterMarkup(idStd, mapUrl, BASE_SCALE, ABERRATION) +
      filterMarkup(idExtra, mapUrl, BASE_SCALE * 1.35, ABERRATION * 1.5)
    while (g.firstChild) defs.appendChild(g.firstChild)

    const pair: [string, string] = [idStd, idExtra]
    this.filters.set(key, pair)
    return pair
  }

  /** 扫描并挂载。可重复调用，已挂载的会就地更新 */
  mount(): void {
    if (!this.available || !this.defs) return

    const nodes = Array.from(document.querySelectorAll<HTMLElement>(this.selector))
    const alive = new Set(nodes)

    for (const entry of [...this.entries]) {
      if (alive.has(entry.el) && entry.el.isConnected) continue
      entry.warp.remove()
      entry.el.querySelectorAll('.lg-rim').forEach((n) => n.remove())
      entry.el.classList.remove('lg-on', 'lg-sleep')
      this.entries = this.entries.filter((e) => e !== entry)
    }

    for (const el of nodes) {
      let entry = this.entries.find((e) => e.el === el)
      const rect = el.getBoundingClientRect()
      const w = el.clientWidth
      const h = el.clientHeight
      if (w < 48 || h < 32) continue

      if (!entry) {
        // warp 是绝对定位，父级必须是定位元素；绝大多数玻璃面本来就是 relative，这里只兜底
        if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
        // 卡片自身必须是层叠上下文，warp 的 z-index:-1 才会停在卡片内部
        el.classList.add('lg-on')

        const frag = document.createDocumentFragment()
        const warp = document.createElement('i')
        warp.className = 'lg-warp'
        warp.setAttribute('aria-hidden', 'true')
        frag.appendChild(warp)
        // 两层轮廓高光：这是玻璃"读起来像玻璃"的主要线索，
        // 且它不依赖背景内容——背景是纯色天空时折射看不出来，但轮廓高光一直在
        for (const cls of ['lg-rim', 'lg-rim lg-rim-2']) {
          const rim = document.createElement('i')
          rim.className = cls
          rim.setAttribute('aria-hidden', 'true')
          frag.appendChild(rim)
        }
        el.insertBefore(frag, el.firstChild)

        entry = { el, warp, key: '', w: 0, h: 0, asleep: false }
        this.entries.push(entry)
        // 新元素立刻交给 IntersectionObserver，滚动时的开关不再走主线程
        this.io?.observe(el)
      }

      if (entry.w === w && entry.h === h) continue

      const ar = w / h
      const radiusRaw = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 18
      const radius = Math.min(radiusRaw, Math.min(w, h) / 2)
      const rf = radius / Math.min(w, h)
      const [idStd, idExtra] = this.filterFor(ar, rf)

      entry.warp.style.setProperty('--lg-f', `url(#${idStd})`)
      entry.warp.style.setProperty('--lg-fx', `url(#${idExtra})`)
      entry.key = `${ar.toFixed(2)}|${rf.toFixed(2)}`
      entry.w = w
      entry.h = h
    }

    this.syncVisible()
  }

  /**
   * 视口外的卡片关掉 warp，退回 CSS 玻璃：GPU 只为看得见的部分付费。
   * 用 IntersectionObserver 而不是滚动时逐个 getBoundingClientRect ——
   * 后者是 O(N) 强制重排，长列表一滚就把主线程吃满，正是掉帧的另一来源。
   */
  private setSleep(entry: WarpEntry, asleep: boolean): void {
    if (entry.asleep === asleep) return
    entry.asleep = asleep
    entry.el.classList.toggle('lg-sleep', asleep)
  }

  /** 同步算一次初始可见性，避免 IO 首个回调到达前整页闪烁 */
  private syncVisible(): void {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const pad = 200
    for (const entry of this.entries) {
      const r = entry.el.getBoundingClientRect()
      const visible = r.bottom > -pad && r.top < vh + pad && r.right > -pad && r.left < vw + pad
      this.setSleep(entry, !visible)
    }
  }

  start(): void {
    if (this.started || !this.available) return
    this.started = true

    // 滚动 / 列表增删都由 IntersectionObserver 驱动，主线程不参与逐帧计算
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

    window.addEventListener(
      'resize',
      () => {
        if (this.resizeRaf) return
        this.resizeRaf = requestAnimationFrame(() => {
          this.resizeRaf = 0
          this.mount()
        })
      },
      { passive: true }
    )

    // 路由切换 / 条件渲染 / 列表刷新后补挂载。
    // 用 MutationObserver 而不是轮询元素数量：数量不变但节点被替换时轮询会漏。
    let debounce = 0
    let selfMutating = false
    this.observer = new MutationObserver(() => {
      if (selfMutating) return
      window.clearTimeout(debounce)
      debounce = window.setTimeout(() => {
        selfMutating = true
        this.mount()
        selfMutating = false
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
    if (this.resizeRaf) cancelAnimationFrame(this.resizeRaf)
    for (const e of this.entries) {
      e.warp.remove()
      e.el.querySelectorAll('.lg-rim').forEach((n) => n.remove())
      e.el.classList.remove('lg-on', 'lg-sleep')
    }
    this.entries = []
    this.defs?.parentElement?.remove()
    this.defs = null
    this.filters.clear()
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
