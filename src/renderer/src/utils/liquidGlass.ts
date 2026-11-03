/**
 * 液态玻璃引擎（v3.7.0 · ybouane WebGL 观感对齐）
 * ════════════════════════════════════════════════════════════════════
 * 参考实现：@ybouane/liquidglass 的 `FS_GLASS` 片元着色器（src/shaders.ts）。
 * 本引擎把它的**物理模型逐项移植到静态贴图**，从而在不引入 WebGL 的前提下
 * 拿到同一观感 —— 且没有该库的代价（要求玻璃元素是 root 直接子节点、用
 * html-to-image 逐帧栅格化 DOM、每实例一个 WebGL 上下文）。
 *
 * 从着色器移植过来的量（命名保持一致，便于对照）：
 *   rrSDF        圆角矩形有符号距离
 *   bevelHeight  d<=0→0，d>=zR→zR，否则 sqrt(d*(2zR-d))：半圆 bevel 高度场
 *   hGrad        bevel 高度的数值梯度；N = normalize(vec3(-hGrad, 1))
 *   refract      exitRefr=entryRefr=hGrad*(1-1/1.5)，throughRefr=entry*thickNorm*0.5，
 *                refrPx=(exit+entry+through)*refract*30
 *                ＋ 向心放大 centerDir*refract*4*depth（这一步是「透镜放大」的来源）
 *   chroma       caS = chroma*18*(edge*0.7+0.3)*2，沿 N.xy 分离三通道
 *   fresnel      pow(1-|N.z|, 4)
 *   specular     四光源 Blinn-Phong（指数 90/50/6/120，权重 1.0/0.3/0.1/0.6）
 *   innerStroke  1.5px 内描边，topBias = 0.5+0.5*(-localPx.y/half.y)
 *   rim           edge*edgeHL*0.22；innerGlow = smoothstep(5,0,-sdf)*edgeHL*0.15
 *   envRefl       (N.y*0.5+0.5)*fres*0.08
 *
 * 两张贴图的分工与分辨率（关键工程判断）：
 *   · 位移图（72px 上限）：它在 SVG filter 内，`feImage` **每帧都要解码**。
 *     实测 512²→4.2 FPS、128²→57.8 FPS、64²→113.8 FPS，所以必须压到长边 72px。
 *     位移场本身是平滑梯度，拉伸后与高分辨率无差别。
 *   · 光照图（256px）：作为 CSS `background-image`，**只在 GPU 上传一次**，
 *     不参与逐帧解码，因此可以用高分辨率把 1.5px 内描边与镜面光斑画锐利。
 *
 * 分工分层（依据苹果 HIG：玻璃是给浮层用的，正文不行）：
 *   · 折射层（refract）：浮在内容之上的外壳 —— 侧边栏 / 顶栏 / 番茄钟浮窗 / 弹层
 *   · 光照层（light）：全部玻璃面，含内容卡片。内容卡片只吃菲涅尔/镜面/内描边，
 *     不吃折射 —— 这样全站都有玻璃光照语言，而正文依旧可读。
 *
 * 性能：采样真实 backdrop，折射由 GPU 合成器完成，JS 只在挂载/尺寸变化时切 class，
 * 无逐帧绘制；视口外的元素用 IntersectionObserver 撤掉折射（不为看不见的部分付费）；
 * 贴图按「宽高比 + 圆角比 + 短边档」分桶共享，几十个玻璃面通常只落到几个桶。
 *
 * 降级：不支持 filter: url() 时整体不挂载，视图层零改动，自动退回纯 CSS 玻璃。
 */

type Tier = 'refract' | 'light'

type GlassEntry = {
  el: HTMLElement
  tier: Tier
  /** 折射层才有；光照层为 null */
  warp: HTMLElement | null
  light: HTMLElement
  w: number
  h: number
  /** 视口外：关掉折射，元素退回普通 CSS 玻璃，避免为看不见的卡片付 GPU 成本 */
  asleep: boolean
}

/** 一个分桶对应的两张贴图（位移图滤镜 + 光照图，光照图分浮层/内容两档镜面强度） */
type Bucket = {
  warpFilter: string
  warpFilterExtra: string
  lightUrl: string
  lightUrlContent: string
}

/* ── 着色器常量（对齐 @ybouane/liquidglass 默认参数） ── */

/** 玻璃折射率 IOR=1.5 → refrPow = 1 - 1/ior */
const IOR_REFR_POW = 1 - 1 / 1.5
/** refraction 默认 0.69；着色器里乘以 30 得到像素量 */
const REFRACT = 0.69
const REFRACT_K = 30
/** 向心放大项的系数（着色器 *4.0） */
const CENTER_K = 4
/** bevel 深度：占「短边一半」的比例。着色器默认 zRadius=40 / halfShort≈100 → 0.4 */
const Z_RATIO = 0.4
/** chromAberration 默认 0.05 */
const CHROMA = 0.05
/** edgeHighlight 默认 0.05 */
const EDGE_HL = 0.05
/** fresnel 默认 1 */
const FRESNEL = 1
/** 镜面强度（着色器 u_spec —— 参考实现默认 0，其演示页提供滑杆实时调节）。
 *  这里取一个「能看到边缘光斑、但不产生白雾」的量：
 *  实测 spec=0.62 时宽面柔光 L3 会在面上叠加约 8% 均匀提亮，
 *  对刚调好的通透感是净损失，故浮层取 0.45；内容面进一步压到 0.18（≈2% 提亮，可忽略）。 */
const SPEC_CHROME = 0.45
const SPEC_CONTENT = 0.18
/** 位移上限：占短边比例。着色器在 d→0 处 hGrad 发散，必须夹住否则小尺寸浮层会撕裂 */
const MAX_DISP_RATIO = 0.11
/**
 * 参考尺度（px）。着色器里的折射量是**绝对像素**（refrPx = hGrad·…·30），
 * 即同一个数值在 44px 顶栏与 400px 面板上都是十几 px —— 因为它的 demo 面板都很大。
 * 本应用的外壳面从 44px 顶栏到整块侧边栏不等，绝对像素会让小浮层比例失真。
 * 因此这里按短边做**几何相似**缩放：在 200px 处与参考实现逐值一致，
 * 其它尺寸按比例线性缩放 —— 这是相对参考实现的唯一刻意适配。
 */
const REF_SIZE = 200
/** 滤镜区域溢出比例；位移图 1px 对应元素空间 REGION 倍，必须与 filterMarkup 同步 */
const FILTER_MARGIN_PCT = 10
const REGION = 1 + (FILTER_MARGIN_PCT / 100) * 2
/** 位移图长边上限（feImage 逐帧解码，性能红线） */
const MAP_MAX = 72
const MAP_MIN = 28
/** 光照图长边（CSS background-image，只上传一次，可以画细） */
const LIGHT_MAX = 256
/** 内描边宽度（元素 px，对齐着色器 borderWidth=1.5） */
const STROKE_PX = 1.5
/** 分桶量化步长 */
const AR_STEP = 0.2
const R_STEP = 0.02
/** 短边按 1.25 倍分档 —— 让折射强度随元素尺寸正确缩放（着色器按 px 计算） */
const SIZE_RATIO_STEP = 1.25
/** 分桶数量上限，防御异常尺寸导致贴图爆炸 */
const MAX_BUCKETS = 48

/**
 * 参与**真实折射**的浮层。
 *
 * 依据苹果 HIG 的液态玻璃原则：玻璃是给浮在内容之上的那层用的，不是给内容本身用的；
 * 正文压在花哨背景上必然不可读。因此：
 *   · 这里只放外壳面（侧边栏/顶栏/番茄钟浮窗）与**小型**弹层（下拉/选择/日期/轻提示）；
 *     .el-popper / .el-message 在 CSS 里走 ybouane 的 "Frosted Panel" 档
 *     （更低白度 + 单独放缓的模糊），保住密集文本的可读性。
 *   · 大型文本面板（dialog / drawer / message-box）不进折射层，只吃光照层。
 *   · 内容卡片一律退出折射层，由 DEFAULT_LIGHT_SELECTOR 承担光照。
 */
const DEFAULT_REFRACT_SELECTOR = [
  '.side-nav',
  '.titlebar',
  '.pomodoro-mini',
  '.el-popper',
  '.el-message'
].join(',')

/**
 * 只吃**光照层**的玻璃面：菲涅尔 + 四光源镜面 + 内描边 + rim。
 * 覆盖全站内容卡片与大型文本面板，让「玻璃语言」全局成立，
 * 但不引入折射 —— 正文可读性不被牺牲，且每张卡只是多一张静态背景图。
 */
const DEFAULT_LIGHT_SELECTOR = [
  '.card',
  '.glass-card',
  '.stat-card',
  '.algo-card',
  '.word-card',
  '.formula-card',
  '.el-dialog',
  '.el-drawer',
  '.el-message-box'
].join(',')

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v)
}

/** GLSL smoothstep：允许 edge0 > edge1（着色器里有这种反向调用） */
function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0 || 1e-9))
  return t * t * (3 - 2 * t)
}

/** 圆角矩形 SDF（着色器 rrSDF） */
function rrSDF(px: number, py: number, bx: number, by: number, r: number): number {
  const qx = Math.abs(px) - bx + r
  const qy = Math.abs(py) - by + r
  const mx = qx > 0 ? qx : 0
  const my = qy > 0 ? qy : 0
  return Math.min(Math.max(qx, qy), 0) + Math.sqrt(mx * mx + my * my) - r
}

/** 半圆 bevel 高度场（着色器 bevelHeight） */
function bevelHeight(d: number, zR: number): number {
  if (d <= 0) return 0
  if (d >= zR) return zR
  return Math.sqrt(d * (2 * zR - d))
}

/** 归一化点积用的向量工具 */
function norm3(x: number, y: number, z: number): [number, number, number] {
  const l = Math.sqrt(x * x + y * y + z * z) || 1e-9
  return [x / l, y / l, z / l]
}

function dot3(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

/* ── 四光源（着色器 L1..L4，方向/指数/权重逐项对齐） ──
   注意：sp1/sp2/sp4 用半程向量 H = normalize(L+V)，但宽面柔光 spB 在着色器里
   用的是**光源向量 L3 本身**（`pow(max(dot(N, L3), 0.0), 6.0)`），不是 H3。
   二者数值差异明显（中心处 dot(N,H3)=0.988 vs dot(N,L3)=0.954），统一用 H 会造成偏差。 */
const LIGHTS: { dir: [number, number, number]; exp: number; w: number }[] = (() => {
  const V: [number, number, number] = [0, 0, 1]
  const defs: { L: [number, number, number]; exp: number; w: number; useH: boolean }[] = [
    { L: [0.4, 0.7, 1.0], exp: 90, w: 1.0, useH: true },   // 主光（右上）
    { L: [-0.3, -0.5, 1.0], exp: 50, w: 0.3, useH: true }, // 补光
    { L: [0.1, 0.3, 1.0], exp: 6, w: 0.1, useH: false },   // 宽面柔光 —— 用 L
    { L: [0.0, 0.9, 0.4], exp: 120, w: 0.6, useH: true }   // 锐光
  ]
  return defs.map((d) => {
    const L = norm3(d.L[0], d.L[1], d.L[2])
    const H = norm3(L[0] + V[0], L[1] + V[1], L[2] + V[2])
    return { dir: d.useH ? H : L, exp: d.exp, w: d.w }
  })
})()

/**
 * 位移图：把着色器的边缘折射与向心放大编码进 R（x 位移）/ B（y 位移），A 恒 255。
 *
 * feDisplacementMap 的偏移 = scale * (C - 0.5)，scale 取 2*短边，
 * 因此 C = 0.5 + 位移px / (2*短边) —— 即 R/B 承载的是「以短边为单位的位移比例」。
 */
export function buildDisplacementMap(
  mapW: number,
  mapH: number,
  ew: number,
  eh: number,
  radius: number
): string {
  const canvas = document.createElement('canvas')
  canvas.width = mapW
  canvas.height = mapH
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  const img = ctx.createImageData(mapW, mapH)
  const halfX = ew / 2
  const halfY = eh / 2
  const shortSide = Math.min(ew, eh)
  const shortHalf = min2(halfX, halfY)
  const r = Math.min(radius, shortHalf - 1)
  const zR = Z_RATIO * shortHalf
  const maxDisp = MAX_DISP_RATIO * shortSide
  const scaleDen = 2 * shortSide

  // 元素 px / 位移图 px（等比，因为宽高比一致）
  const k = (ew * REGION) / mapW
  // 差分步长必须与贴图像素同步（e=k）：写成 max(k,1) 会在小尺寸元素上
  // 让梯度估计偏离同一形状的相似解，破坏「同一形状各处观感一致」
  const e = k
  /** 几何相似缩放：200px 处与参考实现逐值一致 */
  const scaleGeo = shortSide / REF_SIZE
  const cx = mapW / 2
  const cy = mapH / 2

  for (let y = 0; y < mapH; y++) {
    for (let x = 0; x < mapW; x++) {
      const px = (x + 0.5 - cx) * k
      const py = (y + 0.5 - cy) * k
      const i = (y * mapW + x) * 4

      const sdf = rrSDF(px, py, halfX, halfY, r)
      if (sdf > 0) {
        // 面板外：无位移（阴影由 CSS 负责）
        img.data[i] = 128
        img.data[i + 1] = 128
        img.data[i + 2] = 128
        img.data[i + 3] = 255
        continue
      }

      const inside = -sdf
      const hC = bevelHeight(inside, zR)
      const hR = bevelHeight(-rrSDF(px + e, py, halfX, halfY, r), zR)
      const hL = bevelHeight(-rrSDF(px - e, py, halfX, halfY, r), zR)
      const hU = bevelHeight(-rrSDF(px, py + e, halfX, halfY, r), zR)
      const hD = bevelHeight(-rrSDF(px, py - e, halfX, halfY, r), zR)

      // 高度梯度（无量纲斜率）：边缘最大、向内递减
      const gx = (hR - hL) / (2 * e)
      const gy = (hU - hD) / (2 * e)

      const thickness = hC * 2
      const thickNorm = thickness / Math.max(zR * 2, 1)
      // 双凸：入/出射面同号，再加一次穿过玻璃的偏移（着色器 exit+entry+through）
      const bendK = IOR_REFR_POW * (1 + 1 + thickNorm * 0.5)
      let dx = gx * bendK * REFRACT * REFRACT_K * scaleGeo
      let dy = gy * bendK * REFRACT * REFRACT_K * scaleGeo

      // 向心放大（着色器 centerDir·refract·4·depth）：离中心越远拉得越多 → 透镜放大
      const depth = smoothstep(0, zR, inside)
      dx += (-px / Math.max(halfX, 1)) * REFRACT * CENTER_K * depth * scaleGeo
      dy += (-py / Math.max(halfY, 1)) * REFRACT * CENTER_K * depth * scaleGeo

      // 夹住位移上限：hGrad 在 d→0 处发散，小尺寸浮层不夹会撕裂
      const dl = Math.sqrt(dx * dx + dy * dy)
      if (dl > maxDisp) {
        const s = maxDisp / dl
        dx *= s
        dy *= s
      }

      img.data[i] = clamp255(128 + (dx / scaleDen) * 255)
      img.data[i + 1] = 128
      img.data[i + 2] = clamp255(128 + (dy / scaleDen) * 255)
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL('image/png')
}

function min2(a: number, b: number): number {
  return a < b ? a : b
}

/**
 * 光照图：把着色器的菲涅尔 / 四光源镜面 / 内描边 / rim / innerGlow / envRefl
 * 全部烘焙成一张白色 RGBA 贴图（alpha = 高光强度），供 .lg-light 叠加。
 */
export function buildLightingMap(
  mapW: number,
  mapH: number,
  ew: number,
  eh: number,
  radius: number,
  spec: number
): string {
  const canvas = document.createElement('canvas')
  canvas.width = mapW
  canvas.height = mapH
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  const img = ctx.createImageData(mapW, mapH)
  const halfX = ew / 2
  const halfY = eh / 2
  const shortHalf = min2(halfX, halfY)
  const r = Math.min(radius, shortHalf - 1)
  const zR = Z_RATIO * shortHalf

  const k = (ew * REGION) / mapW
  // 与位移图同一条相似性约定：差分步长跟贴图像素走，法线场才与元素尺寸无关
  const e = k
  const cx = mapW / 2
  const cy = mapH / 2
  const maxD = shortHalf
  /** 内描边宽度：本函数内 px/sdf 均为「元素 px」，故直接取着色器的 borderWidth=1.5 */
  const bw = STROKE_PX

  for (let y = 0; y < mapH; y++) {
    for (let x = 0; x < mapW; x++) {
      const px = (x + 0.5 - cx) * k
      const py = (y + 0.5 - cy) * k
      const i = (y * mapW + x) * 4
      img.data[i] = 255
      img.data[i + 1] = 255
      img.data[i + 2] = 255
      img.data[i + 3] = 0

      const sdf = rrSDF(px, py, halfX, halfY, r)
      if (sdf > 0) continue

      const inside = -sdf
      const hR = bevelHeight(-rrSDF(px + e, py, halfX, halfY, r), zR)
      const hL = bevelHeight(-rrSDF(px - e, py, halfX, halfY, r), zR)
      const hU = bevelHeight(-rrSDF(px, py + e, halfX, halfY, r), zR)
      const hD = bevelHeight(-rrSDF(px, py - e, halfX, halfY, r), zR)
      // 贴图 y 轴向下，法线按着色器约定（hU - hD）后取负号转成 GL 朝向
      const N = norm3(-(hR - hL) / (2 * e), -((hU - hD) / (2 * e)), 1)

      const edge = smoothstep(maxD * 0.35, 0, inside)

      // Fresnel：边缘掠射角变亮
      const fres = Math.pow(1 - Math.abs(N[2]), 4) * FRESNEL

      // 四光源镜面
      let specSum = 0
      for (const li of LIGHTS) {
        const d = dot3(N, li.dir)
        if (d > 0) specSum += Math.pow(d, li.exp) * li.w
      }
      specSum *= spec

      // 1.5px 内描边（topBias：顶部更亮）
      let innerStroke = smoothstep(-bw - 1, -bw, sdf) * (1 - smoothstep(-1, 0, sdf))
      const topBias = 0.5 + 0.5 * (-py / Math.max(halfY, 1))
      innerStroke *= 0.4 + 0.6 * topBias

      // rim + 内侧辉光
      const rim = edge * EDGE_HL * 0.22
      const innerGlow = smoothstep(5, 0, -sdf) * EDGE_HL * 0.15
      // 环境反射
      const envRefl = (N[1] * 0.5 + 0.5) * fres * 0.08
      // 菲涅尔白化（着色器 mix(fin, vec3(1), fres*0.2)）
      const whiten = fres * 0.2

      const a = specSum + rim + innerGlow + innerStroke * EDGE_HL * 0.55 + envRefl + whiten
      img.data[i + 3] = clamp255(clamp01(a) * 255)
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL('image/png')
}

function filterMarkup(id: string, mapUrl: string, scale: number, aberration: number): string {
  const s1 = scale
  const s2 = scale * (1 + aberration)
  const s3 = scale * (1 + aberration * 2)
  return (
    `<filter id="${id}" x="-${FILTER_MARGIN_PCT}%" y="-${FILTER_MARGIN_PCT}%" ` +
    `width="${100 + FILTER_MARGIN_PCT * 2}%" height="${100 + FILTER_MARGIN_PCT * 2}%" ` +
    `color-interpolation-filters="sRGB">` +
    `<feImage x="0" y="0" width="100%" height="100%" result="MAP" preserveAspectRatio="none" href="${mapUrl}"/>` +
    `<feDisplacementMap in="SourceGraphic" in2="MAP" scale="${s1}" xChannelSelector="R" yChannelSelector="B" result="D_R"/>` +
    `<feDisplacementMap in="SourceGraphic" in2="MAP" scale="${s2}" xChannelSelector="R" yChannelSelector="B" result="D_G"/>` +
    `<feDisplacementMap in="SourceGraphic" in2="MAP" scale="${s3}" xChannelSelector="R" yChannelSelector="B" result="D_B"/>` +
    `<feColorMatrix in="D_R" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="C_R"/>` +
    `<feColorMatrix in="D_G" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="C_G"/>` +
    `<feColorMatrix in="D_B" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="C_B"/>` +
    `<feBlend in="C_G" in2="C_B" mode="screen" result="C_GB"/>` +
    `<feBlend in="C_R" in2="C_GB" mode="screen" result="C_RGB"/>` +
    `<feGaussianBlur in="C_RGB" stdDeviation="0.5"/>` +
    `</filter>`
  )
}

export type LiquidGlassOptions = {
  refractSelector?: string
  lightSelector?: string
}

class LiquidGlassEngine {
  private entries: GlassEntry[] = []
  private defs: SVGElement | null = null
  private refractSelector = DEFAULT_REFRACT_SELECTOR
  private lightSelector = DEFAULT_LIGHT_SELECTOR
  private buckets = new Map<string, Bucket>()
  private seq = 0
  private observer: MutationObserver | null = null
  private io: IntersectionObserver | null = null
  private resizeRaf = 0
  private started = false

  available = true

  init(options: LiquidGlassOptions = {}): boolean {
    if (this.defs) return this.available
    if (options.refractSelector) this.refractSelector = options.refractSelector
    if (options.lightSelector) this.lightSelector = options.lightSelector

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
   * 取（或生成）分桶贴图。
   * 分桶维度：宽高比（决定贴图纵横）+ 圆角占短边比（决定 SDF 圆角）
   *          + 短边档（决定折射/位移的绝对像素量，着色器是按 px 计算的）。
   */
  private bucketFor(ew: number, eh: number, radius: number): Bucket {
    const ar = ew / eh
    const rf = radius / min2(ew, eh)
    const shortSide = min2(ew, eh)

    const arKey = Math.max(AR_STEP, Math.round(ar / AR_STEP) * AR_STEP).toFixed(2)
    const rfKey = Math.max(R_STEP, Math.round(rf / R_STEP) * R_STEP).toFixed(2)
    const sizeKey = Math.pow(SIZE_RATIO_STEP, Math.round(Math.log(shortSide) / Math.log(SIZE_RATIO_STEP))).toFixed(1)
    let key = `${arKey}|${rfKey}|${sizeKey}`

    const hit = this.buckets.get(key)
    if (hit) return hit

    // 防御：分桶超限时退化到最接近尺寸的已有桶，避免贴图爆炸
    if (this.buckets.size >= MAX_BUCKETS) {
      let bestKey = ''
      let bestDiff = Infinity
      for (const k of this.buckets.keys()) {
        const s = parseFloat(k.split('|')[2]) || shortSide
        const diff = Math.abs(s - shortSide)
        if (diff < bestDiff) {
          bestDiff = diff
          bestKey = k
        }
      }
      const fallback = this.buckets.get(bestKey)
      if (fallback) return fallback
      key = bestKey || key
    }

    const arNum = parseFloat(arKey)
    const rfNum = parseFloat(rfKey)
    const sizeNum = parseFloat(sizeKey) || shortSide
    // 桶内代表尺寸：宽高比与短边档复原出真实尺寸
    const repShort = sizeNum
    const repW = arNum >= 1 ? repShort * arNum : repShort
    const repH = arNum >= 1 ? repShort : repShort / arNum

    const mapW = arNum >= 1 ? MAP_MAX : Math.max(MAP_MIN, Math.round(MAP_MAX * arNum))
    const mapH = arNum >= 1 ? Math.max(MAP_MIN, Math.round(MAP_MAX / arNum)) : MAP_MAX
    const lightW = arNum >= 1 ? LIGHT_MAX : Math.max(64, Math.round(LIGHT_MAX * arNum))
    const lightH = arNum >= 1 ? Math.max(64, Math.round(LIGHT_MAX / arNum)) : LIGHT_MAX
    const radiusPx = rfNum * repShort

    const mapUrl = buildDisplacementMap(mapW, mapH, repW, repH, radiusPx)
    if (!mapUrl) {
      return { warpFilter: '', warpFilterExtra: '', lightUrl: '', lightUrlContent: '' }
    }

    const n = this.seq++
    const idStd = `lg-glass-${n}`
    const idExtra = `lg-glassx-${n}`
    const defs = this.defs
    if (!defs) {
      return { warpFilter: '', warpFilterExtra: '', lightUrl: '', lightUrlContent: '' }
    }

    // scale = 2*短边：位移图里的 R/B 承载「以短边为单位的位移比例」
    const scale = 2 * repShort
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    g.innerHTML =
      filterMarkup(idStd, mapUrl, scale, CHROMA) +
      filterMarkup(idExtra, mapUrl, scale * 1.35, CHROMA * 1.5)
    while (g.firstChild) defs.appendChild(g.firstChild)

    const bucket: Bucket = {
      warpFilter: idStd,
      warpFilterExtra: idExtra,
      lightUrl: buildLightingMap(lightW, lightH, repW, repH, radiusPx, SPEC_CHROME),
      lightUrlContent: buildLightingMap(lightW, lightH, repW, repH, radiusPx, SPEC_CONTENT)
    }
    this.buckets.set(key, bucket)
    return bucket
  }

  /** 扫描并挂载。可重复调用，已挂载的会就地更新 */
  mount(): void {
    if (!this.available || !this.defs) return

    /** 本次新挂载的条目；只对它们做初始可见性计算 */
    const fresh: GlassEntry[] = []

    const refractNodes = Array.from(document.querySelectorAll<HTMLElement>(this.refractSelector))
    const lightNodes = Array.from(document.querySelectorAll<HTMLElement>(this.lightSelector))
    const refractSet = new Set(refractNodes)
    const wanted = new Map<HTMLElement, Tier>()
    for (const el of lightNodes) wanted.set(el, 'light')
    for (const el of refractNodes) wanted.set(el, 'refract')

    // 回收已消失/降级的元素
    for (const entry of [...this.entries]) {
      const tier = wanted.get(entry.el)
      if (entry.el.isConnected && tier === entry.tier) continue
      this.teardown(entry)
      this.entries = this.entries.filter((e) => e !== entry)
    }

    for (const [el, tier] of wanted) {
      const w = el.clientWidth
      const h = el.clientHeight
      if (w < 48 || h < 32) continue

      let entry = this.entries.find((e) => e.el === el)
      if (!entry) {
        entry = this.setup(el, tier)
        this.entries.push(entry)
        this.io?.observe(el)
        fresh.push(entry)
      }

      if (entry.w === w && entry.h === h) continue

      const radiusRaw = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 18
      const radius = Math.min(radiusRaw, min2(w, h) / 2)
      const bucket = this.bucketFor(w, h, radius)
      if (!bucket.lightUrl) continue

      if (entry.warp && bucket.warpFilter) {
        entry.warp.style.setProperty('--lg-f', `url(#${bucket.warpFilter})`)
        entry.warp.style.setProperty('--lg-fx', `url(#${bucket.warpFilterExtra})`)
      }
      const lightUrl = entry.tier === 'refract' ? bucket.lightUrl : bucket.lightUrlContent
      entry.light.style.setProperty('--lg-light', `url("${lightUrl}")`)
      entry.w = w
      entry.h = h
    }

    // 只对新挂载的条目算一次可见性，避免每次 mount 都对全部条目做
    // getBoundingClientRect（那是 O(N) 强制重排；光照层接入内容卡片后 N 会明显变大）。
    // 后续可见性变化一律由 IntersectionObserver 驱动。
    if (fresh.length) this.syncVisible(fresh)
  }

  private setup(el: HTMLElement, tier: Tier): GlassEntry {
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
    el.classList.add('lg-on')
    if (tier === 'refract') el.classList.add('lg-refract')

    const frag = document.createDocumentFragment()
    let warp: HTMLElement | null = null
    if (tier === 'refract') {
      warp = document.createElement('i')
      warp.className = 'lg-warp'
      warp.setAttribute('aria-hidden', 'true')
      frag.appendChild(warp)
    }
    const light = document.createElement('i')
    light.className = 'lg-light'
    light.setAttribute('aria-hidden', 'true')
    frag.appendChild(light)
    el.insertBefore(frag, el.firstChild)

    return { el, tier, warp, light, w: 0, h: 0, asleep: false }
  }

  private teardown(entry: GlassEntry): void {
    entry.warp?.remove()
    entry.el.querySelectorAll('.lg-light').forEach((n) => n.remove())
    entry.el.classList.remove('lg-on', 'lg-refract', 'lg-sleep')
  }

  /**
   * 视口外的元素关掉折射，退回 CSS 玻璃：GPU 只为看得见的部分付费。
   * 用 IntersectionObserver 而不是滚动时逐个 getBoundingClientRect ——
   * 后者是 O(N) 强制重排，长列表一滚就把主线程吃满。
   */
  private setSleep(entry: GlassEntry, asleep: boolean): void {
    if (entry.asleep === asleep) return
    entry.asleep = asleep
    entry.el.classList.toggle('lg-sleep', asleep)
  }

  /** 同步算一次初始可见性，避免 IO 首个回调到达前整页闪烁。
   *  传入 list 时只算这一批（mount 的增量场景），不传则算全部（start 的首次场景）。 */
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
    let settle = 0
    let selfMutating = false
    const runMount = () => {
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
        // 弹层（popper / dialog）常先以 0 尺寸插入、随后才展开，会被 mount 的尺寸门槛跳过；
        // 这里补一次扫描把它抓进来（destroy 后 mount 会被 !defs 守卫直接返回）
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
    if (this.resizeRaf) cancelAnimationFrame(this.resizeRaf)
    for (const e of this.entries) this.teardown(e)
    this.entries = []
    this.defs?.parentElement?.remove()
    this.defs = null
    this.buckets.clear()
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
