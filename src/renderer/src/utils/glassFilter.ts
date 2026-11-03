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
 * 两档配置。
 * 外壳面（refract）允许更明显的波纹与更通透的底色；
 * 内容面（light）把位移压到很低、底色更白 —— 因为正文压在它上面，
 * 波纹太大时文字边缘会跟着抖动，底色太淡时正文对比不足。
 */
const TIERS: Record<GlassTier, TierConfig> = {
  refract: {
    frostBlur: 3,
    noiseStrength: 26,
    noiseFrequency: 0.0075,
    innerShadowColor: 'rgba(255, 255, 255, 0.85)',
    innerShadowBlur: 22,
    innerShadowSpread: -5,
    tint: 'rgba(255, 255, 255, 0.20)'
  },
  light: {
    // 内容面面积大（设置页整块 > 1000px 宽），模糊与白度都要克制：
    // frostBlur 5 + tint 0.42 实测把环形图、折线图整片糊成白雾（见 r-statistics.png），
    // 那不是玻璃而是遮罩。压到 2px / 0.22 后背景结构可见、正文仍然清晰。
    frostBlur: 2,
    noiseStrength: 8,
    noiseFrequency: 0.0065,
    innerShadowColor: 'rgba(255, 255, 255, 0.62)',
    innerShadowBlur: 16,
    innerShadowSpread: -4,
    tint: 'rgba(255, 255, 255, 0.22)'
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * 生成全站共享的滤镜定义。
 * 噪声本身与元素无关，所以同一个 `<filter>` 可以给所有玻璃层复用；
 * 逐档的差异通过 CSS 变量 `--lg-noise-scale` 无法表达（feDisplacementMap 的
 * scale 是属性不是样式），因此这里为两档各建一个 filter，按档引用。
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
    const filter = document.createElementNS(SVG_NS, 'filter')
    filter.setAttribute('id', filterIdFor(tier))
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

    // 边缘遮罩：把噪声的 RGB 按「离边缘的距离」压暗，中心压到 128（无位移）。
    // feDisplacementMap 的位移量 = (通道值 - 0.5) * scale，所以把位移图中心
    // 拉到中灰、边缘拉开，就得到「中心不动、边缘弯折」的折射梯度 ——
    // 这正是参考站竹竿只在边框附近弯折的成像方式，也是噪声均匀位移做不到的。
    const maskId = `${filterIdFor(tier)}-edge`
    const grad = document.createElementNS(SVG_NS, 'radialGradient')
    grad.setAttribute('id', maskId)
    grad.setAttribute('cx', '50%')
    grad.setAttribute('cy', '50%')
    grad.setAttribute('r', '52%')
    for (const [offset, opacity] of [
      ['0%', '0'],
      ['52%', '0'],
      ['78%', '0.5'],
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
    disp.setAttribute('scale', String(cfg.noiseStrength))
    disp.setAttribute('xChannelSelector', 'R')
    disp.setAttribute('yChannelSelector', 'G')

    filter.append(turbulence, blur, maskImg, edgeNoise, disp)
    defs.appendChild(filter)
  }

  return svg
}

export function filterIdFor(tier: GlassTier): string {
  return `${FILTER_ID}-${tier}`
}

/**
 * 给一个玻璃层应用逐档样式。
 * 全部用内联样式而非 class：引擎要给任意未知元素注入，写进 style.css 会
 * 与各视图 scoped 样式争优先级，内联最稳且不随级联顺序变化。
 */
export function applyGlassStyle(layer: HTMLElement, tier: GlassTier, _options: LiquidGlassOptions): void {
  const cfg = TIERS[tier]
  layer.style.cssText = [
    'position:absolute',
    'inset:0',
    'z-index:-1',
    'border-radius:inherit',
    'pointer-events:none',
    // backdrop 采样 + 噪声位移必须在同一个元素上，这是能生效的关键
    `-webkit-backdrop-filter:blur(${cfg.frostBlur}px) saturate(1.05)`,
    `backdrop-filter:blur(${cfg.frostBlur}px) saturate(1.05)`,
    `-webkit-filter:url(#${filterIdFor(tier)})`,
    `filter:url(#${filterIdFor(tier)})`,
    `background:${cfg.tint}`,
    // 内阴影做宽柔光弧，配合下面 CSS 里的顶部亮线构成参考站的边缘特征
    `box-shadow:inset 0 0 ${cfg.innerShadowBlur}px ${cfg.innerShadowSpread}px ${cfg.innerShadowColor}`
  ].join(';')
}
