/**
 * 液态玻璃的 SVG 位移滤镜与逐档样式（v3.7.0）
 * ════════════════════════════════════════════════════════════════════
 * 结构参照 `@tinymomentum/liquid-glass-vue@1.0.9` 的 LiquidGlassBase.vue：
 * 它把 `backdrop-filter` 与 `filter: url(#glass-distortion)` 放在**同一个元素**上，
 * 滤镜源是 `feTurbulence` 生成的程序噪声（不是屏幕像素），
 * 由 `feDisplacementMap` 用噪声扭曲 `SourceGraphic`。
 *
 * 与参考实现的两处刻意差异（均有实测依据）：
 *   1. 参考实现把滤镜直接挂在带内容的容器上 —— 实测（.lgshot/probe-turb.js）
 *      连按钮和文字都被撕成波浪形。本实现改为挂在一个**空层**上，
 *      内容保持同级，实测文字完全清晰（.lgshot/probe-split.js）。
 *   2. 参考实现每个组件各生成一份 `<filter>`；本实现全站共享一份 ——
 *      噪声与元素无关，重复生成只是浪费 DOM。
 *
 * 参数含义（沿用参考实现的默认值与命名）：
 *   noiseFrequency 0.008 —— 噪声基频，越小波纹越舒缓
 *   noiseStrength  77    —— feDisplacementMap 的 scale，即最大位移像素数
 *   innerShadowBlur 20 / spread -5 —— 内阴影做「宽柔光弧」，参考站的签名特征之一
 *   frostBlurRadius —— 毛玻璃模糊半径
 */

export type GlassTier = 'light' | 'refract'

export type LiquidGlassOptions = {
  refractSelector?: string
  lightSelector?: string
}

/** 全站共享的滤镜 id */
export const FILTER_ID = 'lg-distortion'

type TierConfig = {
  /** 毛玻璃模糊半径（px） */
  frostBlur: number
  /** 噪声位移强度（px） */
  noiseStrength: number
  /** 噪声基频 */
  noiseFrequency: number
  /** 内阴影颜色 */
  innerShadowColor: string
  /** 内阴影模糊半径（px） */
  innerShadowBlur: number
  /** 内阴影扩散（px，负数向内收） */
  innerShadowSpread: number
  /** 底色 */
  tint: string
}

/**
 * 两档配置 —— 现已**参数完全对齐**，只保留档位用于选择器分层与语义。
 *
 * 历史：v3.7.0 早先给内容面单独压低过参数（frostBlur 2 / noiseStrength 8 /
 * 内阴影 16 / 底色 0.22），理由是「卡片面积大、正文压在它上面」。
 * 但实测下来，卡片与顶栏/侧边栏的质感明显割裂：外壳面有边缘弯折与宽柔光弧，
 * 卡片几乎只剩一层均匀半透明白 —— 用户 m02265 明确指出这个不统一。
 *
 * 现在两档共用同一组数值：色彩、模糊、位移强度、内阴影完全一致，
 * 差异只剩选择器命中范围（哪些元素算外壳面、哪些算内容面），
 * 因此全站任何玻璃面的质感都相同。
 */
const SHARED_GLASS: TierConfig = {
  // 全站唯一一档，参数**原样照搬番茄钟浮窗**（.pomodoro-mini 的历史写法）：
  //   background: var(--glass-bg-strong)          → tint 用同一组渐变白
  //   backdrop-filter: var(--glass-filter-pop)    → blur(var(--glass-blur-pop)=14px) saturate(1.05)
  // 用户 m02667 明确「以番茄钟为基准，让卡片按钮全部套用它那套玻璃处理」。
  // 因此这里不再自创参数，frostBlur 对齐 --glass-blur-pop，saturate 对齐 --glass-saturate。
  frostBlur: 1,
  noiseStrength: 77,
  noiseFrequency: 0.0075,
  innerShadowColor: 'var(--lg-inner-shadow)',
  innerShadowBlur: 12,
  innerShadowSpread: 0,
  tint: 'var(--lg-tint)'
}

const TIERS: Record<GlassTier, TierConfig> = {
  refract: SHARED_GLASS,
  light: SHARED_GLASS
}

/** 位移遮罩的中心基底：0 = 面板内部完全静止（只剩边框能动），1 = 均匀扰动 */
const MASK_CENTER = 0.35

const SVG_NS = 'http://www.w3.org/2000/svg'


export function filterIdFor(tier: GlassTier, bucket = 0): string {
  return `${FILTER_ID}-${tier}-${bucket}`
}

/**
 * 位移强度按元素短边等比缩放的参照尺寸。
 *
 * 为什么必须缩放：`feDisplacementMap` 的 `scale` 是**绝对像素**。实测同一组参数下
 *   统计卡片 209×108（短边 108）→ 位移占 24%
 *   内容卡片 553×393（短边 393）→ 占 6.6%
 *   侧边栏   224×825（短边 224）→ 占 11.6%
 * 小卡片的位移比例是侧边栏的两倍多，边缘被撕开发虚，大面板却几乎没有弯折 ——
 * 同一套参数在不同尺寸上根本不可能呈现同一种质感。
 * 按短边归一化后，各尺寸的「位移 / 尺寸」之比恒定，观感才真正统一。
 */
export const REF_SHORT_SIDE = 224

/** 位移强度的分桶，避免为大卡片生成过多 `<filter>` */
const BUCKETS = [0.5, 0.7, 0.85, 1, 1.25, 1.5, 1.9, 2.4]

/** 按元素短边选出最接近的缩放桶 */
export function scaleBucket(shortSide: number): number {
  const raw = Math.min(Math.max(shortSide / REF_SHORT_SIDE, BUCKETS[0]), BUCKETS[BUCKETS.length - 1])
  let best = 0
  for (let i = 1; i < BUCKETS.length; i++) {
    if (Math.abs(BUCKETS[i] - raw) < Math.abs(BUCKETS[best] - raw)) best = i
  }
  return best
}

/**
 * 生成全站共享的滤镜定义。
 * 噪声与元素无关，同一份 `<filter>` 可给所有同档同尺寸桶的玻璃层复用；
 * `feDisplacementMap` 的 `scale` 是属性、无法用 CSS 变量驱动，所以这里为
 * 「档位 × 尺寸桶」预先建好几个，按需引用。
 */
export function createFilterDefs(_id: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('width', '0')
  svg.setAttribute('height', '0')
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'

  const defs = document.createElementNS(SVG_NS, 'defs')
  svg.appendChild(defs)

  for (const tier of Object.keys(TIERS) as GlassTier[]) {
    const cfg = TIERS[tier]
    for (let b = 0; b < BUCKETS.length; b++) {
      const filter = createOneFilter(cfg, tier, b, defs)
      defs.appendChild(filter)
    }
  }

  return svg
}

function createOneFilter(
  cfg: TierConfig,
  tier: GlassTier,
  bucket: number,
  defs: SVGElement
): SVGFilterElement {
  const id = filterIdFor(tier, bucket)
  const filter = document.createElementNS(SVG_NS, 'filter')
  filter.setAttribute('id', id)
  // 位移会把像素推出元素边界，区域留出余量，否则边缘被裁掉
  filter.setAttribute('x', '-12%')
  filter.setAttribute('y', '-12%')
  filter.setAttribute('width', '124%')
  filter.setAttribute('height', '124%')

  const turbulence = document.createElementNS(SVG_NS, 'feTurbulence')
  turbulence.setAttribute('type', 'fractalNoise')
  turbulence.setAttribute('baseFrequency', String(cfg.noiseFrequency))
  turbulence.setAttribute('numOctaves', '2')
  turbulence.setAttribute('seed', '92')
  turbulence.setAttribute('result', 'noise')

  const blur = document.createElementNS(SVG_NS, 'feGaussianBlur')
  blur.setAttribute('in', 'noise')
  blur.setAttribute('stdDeviation', '2')
  blur.setAttribute('result', 'blurred')

  // 边缘遮罩：把噪声的 RGB 按「离边缘的距离」做成梯度。
  // feDisplacementMap 的位移量 = (通道值 - 0.5) * scale，遮罩把中心压向中灰、
  // 边缘拉开，就得到「中心弱、边缘强」的折射梯度 —— 这是参考站竹竿只在
  // 边框附近大幅弯折的成像方式。
  //
  // 但中心不能完全压成 0：早先版本中心 stop-opacity 取 0，结果是面板内部
  // 变成一块完全不动的半透明灰纱，只剩边框一圈能动，读起来不像玻璃。
  // 保留 0.35 的基底位移后，内部也有细微折射，整块面才"活"起来。
  const maskId = `${id}-edge`
  const grad = document.createElementNS(SVG_NS, 'radialGradient')
  grad.setAttribute('id', maskId)
  grad.setAttribute('cx', '50%')
  grad.setAttribute('cy', '50%')
  grad.setAttribute('r', '52%')
  for (const [offset, opacity] of [
    ['0%', String(MASK_CENTER)],
    ['52%', String(MASK_CENTER)],
    ['78%', '0.68'],
    ['100%', '1']
  ]) {
    const stop = document.createElementNS(SVG_NS, 'stop')
    stop.setAttribute('offset', offset)
    stop.setAttribute('stop-color', '#ffffff')
    stop.setAttribute('stop-opacity', opacity)
    grad.appendChild(stop)
  }
  defs.appendChild(grad)

  const maskImg = document.createElementNS(SVG_NS, 'feImage')
  maskImg.setAttribute('href', `#${maskId}`)
  maskImg.setAttribute('result', 'edgeAlpha')

  // 用遮罩的 alpha 去缩放噪声的偏离量：edge * noise + (1-edge) * midgray
  const edgeNoise = document.createElementNS(SVG_NS, 'feComposite')
  edgeNoise.setAttribute('in', 'blurred')
  edgeNoise.setAttribute('in2', 'edgeAlpha')
  edgeNoise.setAttribute('operator', 'arithmetic')
  edgeNoise.setAttribute('k1', '1')
  edgeNoise.setAttribute('k2', '0')
  edgeNoise.setAttribute('k3', '0.5')
  edgeNoise.setAttribute('k4', '0')
  edgeNoise.setAttribute('result', 'edgeNoise')

  const disp = document.createElementNS(SVG_NS, 'feDisplacementMap')
  disp.setAttribute('in', 'SourceGraphic')
  disp.setAttribute('in2', 'edgeNoise')
  disp.setAttribute('scale', String(Math.round(cfg.noiseStrength * BUCKETS[bucket])))
  disp.setAttribute('xChannelSelector', 'R')
  disp.setAttribute('yChannelSelector', 'G')

  filter.append(turbulence, blur, maskImg, edgeNoise, disp)
  return filter
}

/**
 * 给一个玻璃层应用逐档样式。
 * 全部用内联样式而非 class：引擎要给任意未知元素注入，写进 style.css 会
 * 与各视图 scoped 样式争优先级，内联最稳且不随级联顺序变化。
 */
export function applyGlassStyle(
  layer: HTMLElement,
  tier: GlassTier,
  _options: LiquidGlassOptions,
  bucket = scaleBucket(REF_SHORT_SIDE)
): void {
  const cfg = TIERS[tier]
  layer.style.cssText = [
    'position:absolute',
    'inset:0',
    'z-index:-1',
    'border-radius:inherit',
    'pointer-events:none',
    // backdrop 采样 + 噪声位移必须在同一个元素上，这是能生效的关键。
    // 用 blur(0) 而不是不写 blur：留一个 filter 函数会让 Chromium 走
    // backdrop-filter 的完整合成路径，位移结果才稳定可见。
    // saturate 与番茄钟的 --glass-filter-pop 对齐（1.05），不再自创数值。
    `-webkit-backdrop-filter:blur(${cfg.frostBlur}px) saturate(1.05)`,
    `backdrop-filter:blur(${cfg.frostBlur}px) saturate(1.05)`,
    `-webkit-filter:url(#${filterIdFor(tier, bucket)})`,
    `filter:url(#${filterIdFor(tier, bucket)})`,
    `background:${cfg.tint}`,
    // 内阴影做宽柔光弧，配合 CSS 里的顶部亮线构成边缘特征。
    // 早先它是 24px / -6 / 0.92 白的粗内阴影，等于把整块面洗成白纱 ——
    // 现在只保留贴着内边缘的一道细光，中心完全不加白。
    `box-shadow:inset 0 0 ${cfg.innerShadowBlur}px ${cfg.innerShadowSpread}px ${cfg.innerShadowColor}`
  ].join(';')
}
