/**
 * 液态玻璃渲染引擎（v3.6.5 · 边缘透镜 WebGL）
 * ────────────────────────────────────────────────────────────
 * 为什么不用 @ybouane/liquidglass：
 *   它要求玻璃元素是 root 的直接子节点、root 自身背景不被采样、还会强制给玻璃元素
 *   设 overflow:visible。本项目卡片嵌在四层之下、主内容区靠 overflow-y:auto 滚动，
 *   三条约束全部冲突，且它用 html-to-image 逐次栅格化 DOM，深层容器每次几十~几百 ms。
 *
 * 本实现换了前提：应用背景是「一张固定图 / 一段渐变」，不是任意 DOM。
 * 于是不需要抓取 DOM —— 着色器按元素的屏幕位置直接采样背景，做：
 *   · 圆角矩形 SDF 的边缘斜面位移（真正的边缘透镜，不是模糊）
 *   · 位移随靠近边缘衰减，中心零形变
 *   · R/G/B 用不同折射率（色差）
 *   · 菲涅尔边缘增亮 + 左上镜面光斑 + 顶端细亮线
 *   · 玻璃本体染色（浅色主题需要一点白度保证深色文字对比度）
 * 滚动时只按新位置重绘（一次 GL 绘制 + 一次 blit），不重新栅格化任何 DOM。
 *
 * 性能设计：
 *   · 全应用共用一个 WebGL 上下文，不是每个元素一个
 *   · 每个玻璃元素只挂一个 2D canvas 承接结果，blit 成本极低
 *   · 滚动 / 尺寸变化用 rAF 合帧，同一帧内只渲染一次
 *   · GL 绘图缓冲只增不减，避免每帧重分配
 */

import bgImageUrl from '@/assets/background.jpg'

type GlassEntry = {
  el: HTMLElement
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D | null
  radius: number
  lastW: number
  lastH: number
}

/** 参与液态玻璃渲染的选择器。逐页推广时在此增删 */
const GLASS_SELECTOR = ['.card', '.glass-card', '.stat-card', '.login-card'].join(',')

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const FRAG = `
precision highp float;

uniform vec2  uRes;        // 元素尺寸（CSS px）
uniform vec2  uOrigin;     // 元素左上角在视口中的位置（CSS px）
uniform vec2  uViewport;   // 视口尺寸（CSS px）
uniform float uDpr;
uniform float uRadius;     // 圆角（CSS px）
uniform float uBevel;      // 斜面宽度（CSS px，对应参考站 zRadius）
uniform float uStrength;   // 折射位移强度（CSS px）
uniform float uChroma;     // 色差（对应 chromAberration）
uniform float uBlurPx;     // 模糊半径（对应 blurAmount 0.25）
uniform float uRim;        // 菲涅尔边缘亮度（对应 edgeHighlight / fresnel）
uniform float uSpec;       // 镜面光斑强度
uniform float uContrast;   // 背景对比度压缩（vibrancy：只收极值，不染色）
uniform float uLift;       // 暗部抬升
uniform float uUseTex;     // 1 = 背景图，0 = 程序化深色渐变
uniform sampler2D uTex;
uniform vec2  uCover;      // cover 采样比例（x / y 分别计算）
uniform vec3  uDarkA;

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

vec2 sdfGrad(vec2 p, vec2 b, float r) {
  float e = 1.0;
  float dx = sdRoundBox(p + vec2(e, 0.0), b, r) - sdRoundBox(p - vec2(e, 0.0), b, r);
  float dy = sdRoundBox(p + vec2(0.0, e), b, r) - sdRoundBox(p - vec2(0.0, e), b, r);
  return normalize(vec2(dx, dy) + vec2(1e-6));
}

vec3 sampleBg(vec2 screenPx) {
  if (uUseTex > 0.5) {
    // 复刻 background-size: cover + background-position: center。
    // 贴图用 UNPACK_FLIP_Y_WEBGL=0 上传，纹素 v=0 即图片顶行，不要再翻转 Y
    vec2 uv = (screenPx / uViewport - 0.5) * uCover + 0.5;
    return texture2D(uTex, clamp(uv, 0.001, 0.999)).rgb;
  }
  // 深色主题：程序化光溢出，对应 style.css 里三层 radial-gradient
  vec2 p = screenPx / uViewport;
  vec3 col = uDarkA;
  col += vec3(0.23, 0.42, 1.00) * smoothstep(0.98, 0.0, length((p - vec2(0.14, -0.05)) * vec2(1.15, 1.70))) * 0.40;
  col += vec3(0.49, 0.33, 1.00) * smoothstep(0.92, 0.0, length((p - vec2(1.02, -0.02)) * vec2(1.25, 1.80))) * 0.32;
  col += vec3(0.00, 0.69, 0.84) * smoothstep(0.92, 0.0, length((p - vec2(0.50, 1.12)) * vec2(1.20, 1.60))) * 0.22;
  return col;
}

// 十字五点模糊：Regular Glass 的 blurAmount 0.25 就落在这个量级
vec3 blurBg(vec2 screenPx, float r) {
  vec3 sum = sampleBg(screenPx) * 0.36;
  sum += sampleBg(screenPx + vec2( r,  0.0)) * 0.16;
  sum += sampleBg(screenPx + vec2(-r,  0.0)) * 0.16;
  sum += sampleBg(screenPx + vec2(0.0,  r)) * 0.16;
  sum += sampleBg(screenPx + vec2(0.0, -r)) * 0.16;
  return sum;
}

void main() {
  // 统一换算到元素局部 CSS 像素坐标（左上原点）
  vec2 local = vec2(gl_FragCoord.x, uRes.y * uDpr - gl_FragCoord.y) / uDpr;
  vec2 half_ = uRes * 0.5;
  vec2 p = local - half_;

  float d = sdRoundBox(p, half_, uRadius);
  float inside = 1.0 - smoothstep(-1.0, 1.0, d);
  if (inside <= 0.002) { gl_FragColor = vec4(0.0); return; }

  vec2 screenPx = uOrigin + local;

  // 斜面：edge 从中心 0 到最外缘 1；平方衰减更接近真实斜面曲率。
  // 这就是 Regular Glass 的 refraction + zRadius：只有靠近边缘才发生透镜位移
  float edge = clamp(1.0 + d / max(uBevel, 1.0), 0.0, 1.0);
  float bend = edge * edge;
  vec2 n = sdfGrad(p, half_, uRadius);
  vec2 base = screenPx + n * bend * uStrength;

  // 主色：模糊后采样（opacity 1 / saturation 0 / brightness 0 —— 不染色、不改亮度）
  vec3 col = blurBg(base, uBlurPx);

  // 色差：只在斜面带内出现，中心完全无色边
  if (bend > 0.02) {
    float ca = uChroma * bend;
    vec3 f;
    f.r = blurBg(base + n * ca, uBlurPx).r;
    f.b = blurBg(base - n * ca, uBlurPx).b;
    col.r = mix(col.r, f.r, 0.9);
    col.b = mix(col.b, f.b, 0.9);
  }

  // vibrancy：把背景压进窄区间。玻璃仍不染色（Regular Glass 的 opacity 1 / saturation 0），
  // 只是削掉极暗极亮，否则深色文字压在树影上会整片消失
  col = (col - 0.5) * uContrast + 0.5 + uLift;

  // 菲涅尔：越靠边越亮（edgeHighlight + fresnel）
  col += vec3(1.0) * smoothstep(0.70, 1.0, edge) * uRim;

  // 镜面光斑：左上柔光
  vec2 sp = (local - vec2(uRes.x * 0.20, -uRes.y * 0.04)) / max(uRes.x, 1.0);
  col += vec3(1.0) * smoothstep(0.55, 0.0, length(sp * vec2(1.0, 1.7))) * uSpec;

  // 顶端细亮线
  col += vec3(1.0) * smoothstep(2.0, 0.0, local.y) * 0.30;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), inside);
}
`

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type)
  if (!sh) return null
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn('[liquidGlass] 着色器编译失败:', gl.getShaderInfoLog(sh))
    gl.deleteShader(sh)
    return null
  }
  return sh
}

export type LiquidGlassOptions = {
  selector?: string
}

class LiquidGlassEngine {
  private gl: WebGLRenderingContext | null = null
  private glCanvas: HTMLCanvasElement | null = null
  private program: WebGLProgram | null = null
  private u: Record<string, WebGLUniformLocation | null> = {}
  private entries: GlassEntry[] = []
  private tex: WebGLTexture | null = null
  private texReady = false
  private cover = { x: 1, y: 1 }
  private rafId = 0
  private active = false
  private selector = GLASS_SELECTOR
  private glW = 0
  private glH = 0
  private bound = false

  /** WebGL 不可用 / 背景纹理跨域时置 false，元素保持 CSS 玻璃观感 */
  available = true

  init(options: LiquidGlassOptions = {}): boolean {
    if (this.gl) return true
    if (options.selector) this.selector = options.selector

    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      depth: false,
      stencil: false
    }) || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null

    if (!gl) {
      this.available = false
      console.warn('[liquidGlass] 无 WebGL 上下文，保持 CSS 玻璃')
      return false
    }

    const vs = compile(gl, gl.VERTEX_SHADER, VERT)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
    if (!vs || !fs) {
      this.available = false
      return false
    }

    const prog = gl.createProgram()
    if (!prog) {
      this.available = false
      return false
    }
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.bindAttribLocation(prog, 0, 'aPos')
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('[liquidGlass] 程序链接失败:', gl.getProgramInfoLog(prog))
      this.available = false
      return false
    }

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    gl.useProgram(prog)
    for (const name of [
      'uRes', 'uOrigin', 'uViewport', 'uDpr', 'uRadius', 'uBevel', 'uStrength',
      'uChroma', 'uBlurPx', 'uRim', 'uSpec', 'uContrast', 'uLift', 'uUseTex', 'uTex', 'uCover', 'uDarkA'
    ]) {
      this.u[name] = gl.getUniformLocation(prog, name)
    }
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    this.gl = gl
    this.glCanvas = canvas
    this.program = prog
    this.loadTexture()
    return true
  }

  /** 载入背景图；失败则整体退回 CSS 玻璃 */
  private loadTexture(): void {
    const gl = this.gl
    if (!gl) return

    // 用户自定义背景走 kaoyan-bg:// 协议，无法保证可作为 WebGL 纹理 → 直接退回 CSS
    const custom = getComputedStyle(document.documentElement).getPropertyValue('--mo-bg-custom').trim()
    if (custom) {
      console.info('[liquidGlass] 检测到自定义背景，改用 CSS 玻璃以保证画面一致')
      this.available = false
      this.unmountAll()
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const tex = gl.createTexture()
        if (!tex) throw new Error('无法创建纹理')
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        this.tex = tex
        this.texReady = true
        this.computeCover(img.width, img.height)
        this.schedule()
      } catch (e) {
        console.warn('[liquidGlass] 背景纹理不可用，保持 CSS 玻璃:', e)
        this.available = false
        this.unmountAll()
      }
    }
    img.onerror = () => {
      console.warn('[liquidGlass] 背景图加载失败，保持 CSS 玻璃')
      this.available = false
      this.unmountAll()
    }
    img.src = bgImageUrl
  }

  /** cover 采样比例：图片按 max 缩放铺满视口后，视口占图片的比例 */
  private computeCover(w: number, h: number): void {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const s = Math.max(vw / w, vh / h)
    this.cover = s > 0 ? { x: vw / (w * s), y: vh / (h * s) } : { x: 1, y: 1 }
  }

  /** 扫描并挂载玻璃元素 */
  mount(): void {
    if (!this.available || !this.gl) return
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(this.selector))
    const alive = new Set(nodes)

    for (const entry of [...this.entries]) {
      if (!alive.has(entry.el) || !entry.el.isConnected) {
        entry.canvas.remove()
        entry.el.classList.remove('lg-on')
        this.entries = this.entries.filter((e) => e !== entry)
      }
    }

    for (const el of nodes) {
      if (this.entries.some((e) => e.el === el)) continue
      const rect = el.getBoundingClientRect()
      if (rect.width < 40 || rect.height < 30) continue

      if (getComputedStyle(el).position === 'static') el.style.position = 'relative'

      const canvas = document.createElement('canvas')
      canvas.className = 'lg-canvas'
      canvas.setAttribute('aria-hidden', 'true')
      // 先按元素尺寸把 canvas 撑好，避免首帧之前它以 300×150 默认尺寸露出底色
      const cw = el.clientWidth
      const ch = el.clientHeight
      canvas.width = cw
      canvas.height = ch
      canvas.style.width = cw + 'px'
      canvas.style.height = ch + 'px'
      el.insertBefore(canvas, el.firstChild)

      const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 18
      this.entries.push({
        el,
        canvas,
        ctx: canvas.getContext('2d'),
        radius,
        lastW: cw,
        lastH: ch
      })
      // 注意：这里不给元素加 .lg-on。要等着色器真正画上去以后再切换，
      // 否则渲染失败或尚未渲染的元素会露出原始背景，出现深浅不一的块
    }

    this.schedule()
  }

  /** 主题 / 超通透档变化后重绘（参数在 render 里按当前主题现取） */
  refreshTheme(): void {
    this.cover = this.cover.x && this.cover.y ? this.cover : { x: 1, y: 1 }
    this.schedule()
  }

  private unmountAll(): void {
    for (const e of this.entries) {
      e.canvas.remove()
      e.el.classList.remove('lg-on')
    }
    this.entries = []
  }

  schedule(): void {
    if (!this.active || this.rafId) return
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0
      this.render()
    })
  }

  start(): void {
    if (!this.gl) return
    this.active = true
    if (!this.bound) {
      this.bound = true
      window.addEventListener('resize', () => {
        this.mount()
        this.schedule()
      })
    }
    this.schedule()
  }

  stop(): void {
    this.active = false
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.rafId = 0
  }

  private render(): void {
    const gl = this.gl
    if (!gl || !this.program || !this.active) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const vw = window.innerWidth
    const vh = window.innerHeight
    const dark = document.documentElement.classList.contains('dark')

    gl.useProgram(this.program)
    gl.uniform2f(this.u.uViewport, vw, vh)
    gl.uniform1f(this.u.uDpr, dpr)
    gl.uniform1f(this.u.uUseTex, this.texReady && !dark ? 1 : 0)
    gl.uniform3f(this.u.uDarkA, 0.027, 0.043, 0.075)
    gl.uniform2f(this.u.uCover, this.cover.x, this.cover.y)
    if (this.tex) {
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.tex)
      gl.uniform1i(this.u.uTex, 0)
    }

    for (const entry of this.entries) {
      const rect = entry.el.getBoundingClientRect()
      if (rect.width < 10 || rect.height < 10) continue
      if (rect.bottom < 0 || rect.top > vh || rect.right < 0 || rect.left > vw) continue

      const w = entry.el.clientWidth
      const h = entry.el.clientHeight
      // canvas 定位在 padding box 内，所以原点要加上边框宽度，否则整体偏移 1px
      const originX = rect.left + entry.el.clientLeft
      const originY = rect.top + entry.el.clientTop
      const pw = Math.round(w * dpr)
      const ph = Math.round(h * dpr)

      if (entry.lastW !== pw || entry.lastH !== ph) {
        entry.canvas.width = pw
        entry.canvas.height = ph
        entry.canvas.style.width = w + 'px'
        entry.canvas.style.height = h + 'px'
        entry.lastW = pw
        entry.lastH = ph
      }
      if (!entry.ctx) entry.ctx = entry.canvas.getContext('2d')
      if (!entry.ctx) continue

      // GL 绘图缓冲只增不减：重分配很贵，不能每帧做
      if (this.glW < pw || this.glH < ph) {
        this.glW = Math.max(this.glW, pw)
        this.glH = Math.max(this.glH, ph)
        this.glCanvas!.width = this.glW
        this.glCanvas!.height = this.glH
      }
      gl.viewport(0, 0, pw, ph)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)

      gl.uniform2f(this.u.uRes, w, h)
      gl.uniform2f(this.u.uOrigin, originX, originY)
      // ── Regular Glass 参数（参考站默认档）──
      // refraction 0.69 / zRadius 40 / blurAmount 0.25 / chromAberration 0.05
      // opacity 1 + saturation 0 + brightness 0 → 不染色、不增亮，纯透射
      const short = Math.min(w, h)
      // 斜面宽度：大卡片给满 40px，小卡片按短边收敛，避免整块面都变成斜面
      const bevel = Math.min(40, Math.max(9, short * 0.30))
      const strength = bevel * 0.69
      gl.uniform1f(this.u.uRadius, Math.min(entry.radius, short * 0.5))
      gl.uniform1f(this.u.uBevel, bevel)
      gl.uniform1f(this.u.uStrength, strength)
      gl.uniform1f(this.u.uChroma, bevel * 0.05)
      gl.uniform1f(this.u.uBlurPx, Math.min(6, Math.max(2, short * 0.02)))
      gl.uniform1f(this.u.uRim, dark ? 0.10 : 0.13)
      gl.uniform1f(this.u.uSpec, dark ? 0.025 : 0.04)
      // 不染色（Regular Glass），只做 vibrancy 收极值：暗部抬到 ~0.54、亮部压到 ~0.90
      gl.uniform1f(this.u.uContrast, dark ? 0.95 : 0.45)
      gl.uniform1f(this.u.uLift, dark ? 0.02 : 0.24)

      gl.drawArrays(gl.TRIANGLES, 0, 3)

      entry.ctx.clearRect(0, 0, pw, ph)
      entry.ctx.drawImage(this.glCanvas!, 0, 0, pw, ph, 0, 0, pw, ph)

      // 画成功之后才把元素切到透明，让着色器接管背景
      if (!entry.el.classList.contains('lg-on')) entry.el.classList.add('lg-on')
    }
  }

  destroy(): void {
    this.stop()
    this.unmountAll()
    if (this.gl) {
      if (this.tex) this.gl.deleteTexture(this.tex)
      if (this.program) this.gl.deleteProgram(this.program)
    }
    this.gl = null
    this.texReady = false
    this.tex = null
  }
}

export const liquidGlass = new LiquidGlassEngine()

/** 初始化：挂载 + 启动，并接管滚动 / 尺寸 / 新元素的刷新 */
export function initLiquidGlass(options: LiquidGlassOptions = {}): void {
  if (!liquidGlass.init(options)) return

  liquidGlass.mount()
  liquidGlass.start()

  const onScroll = () => liquidGlass.schedule()
  const boundTargets = new WeakSet<EventTarget>()
  const bindScroll = () => {
    // 主内容区等内部滚动容器也要触发重绘
    document.querySelectorAll<HTMLElement>('.main-content').forEach((el) => {
      if (boundTargets.has(el)) return
      boundTargets.add(el)
      el.addEventListener('scroll', onScroll, { passive: true })
    })
  }
  bindScroll()
  window.addEventListener('scroll', onScroll, { passive: true })

  // DOM 变动（路由切换 / 条件渲染 / 列表刷新）后补挂载。
  // 用 MutationObserver 而不是轮询元素数量：数量不变但节点被替换时轮询会漏掉
  let debounce = 0
  let selfMutating = false
  const observer = new MutationObserver(() => {
    if (selfMutating) return
    window.clearTimeout(debounce)
    debounce = window.setTimeout(() => {
      selfMutating = true
      bindScroll()
      liquidGlass.mount()
      selfMutating = false
    }, 120)
  })
  observer.observe(document.body, { childList: true, subtree: true })
}
