import { ref, computed } from 'vue'
import { getGlobalStorage, setGlobalStorage, removeGlobalStorage } from '@/utils/storage'

/** 主题模式：浅色 / 深色 / 跟随系统 */
export type ThemeMode = 'light' | 'dark' | 'system'

const THEME_KEY = 'kaoyan_theme'

const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

function loadMode(): ThemeMode {
  const v = getGlobalStorage<string>(THEME_KEY, 'light')
  if (v === 'light' || v === 'dark' || v === 'system') return v
  return 'light'
}

export const themeMode = ref<ThemeMode>(loadMode())
export const systemDark = ref(mediaQuery.matches)

/** 当前是否实际渲染为深色 */
export const isDark = computed(
  () => themeMode.value === 'dark' || (themeMode.value === 'system' && systemDark.value)
)

/** 将主题应用到 <html>（Element Plus 深色约定使用 .dark 类） */
export function applyTheme(): void {
  const dark = isDark.value
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
}

/** 设置主题模式并持久化（v2.8.1：经统一存储层持久化） */
export function setThemeMode(mode: ThemeMode): void {
  themeMode.value = mode
  setGlobalStorage(THEME_KEY, mode)
  applyTheme()
}

/** 快捷切换：深色 <-> 浅色 */
export function toggleTheme(): void {
  setThemeMode(isDark.value ? 'light' : 'dark')
}

/** 初始化：应用已保存的主题，并监听系统主题变化 */
export function initTheme(): void {
  // 存储层在应用挂载前已就绪，重新读取持久化值
  // （模块加载期的初始读取可能早于存储初始化，此处校准主题与护眼状态）
  themeMode.value = loadMode()
  eyeCare.value = loadEyeCare()
  liquidGlass.value = loadLiquidGlass()
  bgBlur.value = loadBgBlur()
  applyTheme()
  applyEyeCare()
  applyLiquidGlass()
  applyBgBlur()
  mediaQuery.addEventListener('change', (e) => {
    systemDark.value = e.matches
    applyTheme()
  })
}

const EYECARE_KEY = 'kaoyan_eyecare'

export const eyeCare = ref<boolean>(loadEyeCare())

function loadEyeCare(): boolean {
  return getGlobalStorage<string>(EYECARE_KEY, '0') === '1'
}

/** 应用护眼模式：向根元素注入 .eyecare 类（暖色滤光，降低蓝光） */
export function applyEyeCare(): void {
  document.documentElement.classList.toggle('eyecare', eyeCare.value)
}

/** 切换护眼模式并持久化（v2.8.1：经统一存储层持久化） */
export function setEyeCare(on: boolean): void {
  eyeCare.value = on
  setGlobalStorage(EYECARE_KEY, on ? '1' : '0')
  applyEyeCare()
}

export function toggleEyeCare(): void {
  setEyeCare(!eyeCare.value)
}

// ── v3.0.0：增强液态玻璃模式（Liquid Glass Pro） ──
const LIQUID_GLASS_KEY = 'kaoyan_liquid_glass'

function loadLiquidGlass(): boolean {
  return getGlobalStorage<string>(LIQUID_GLASS_KEY, '0') === '1'
}

export const liquidGlass = ref<boolean>(loadLiquidGlass())

/** 应用液态玻璃模式：向 body 注入 .liquid-glass 类 */
export function applyLiquidGlass(): void {
  document.body.classList.toggle('liquid-glass', liquidGlass.value)
}

/** 设置液态玻璃模式并持久化 */
export function setLiquidGlass(on: boolean): void {
  liquidGlass.value = on
  setGlobalStorage(LIQUID_GLASS_KEY, on ? '1' : '0')
  applyLiquidGlass()
}

export function toggleLiquidGlass(): void {
  setLiquidGlass(!liquidGlass.value)
}

const BG_CUSTOM_KEY = 'kaoyan_bg_custom'

/** 应用自定义背景：向根元素注入 --mo-bg-custom 变量（CSS 中作为 --mo-bg-image 的首选值） */
export function applyCustomBg(url: string | null): void {
  const root = document.documentElement
  if (url) {
    root.style.setProperty('--mo-bg-custom', `url("${url}")`)
  } else {
    root.style.removeProperty('--mo-bg-custom')
  }
  if (url) setGlobalStorage(BG_CUSTOM_KEY, url)
  else removeGlobalStorage(BG_CUSTOM_KEY)
}

/** 初始化自定义背景：优先读取本地记忆，并向主进程核实文件是否仍存在 */
export async function initCustomBg(): Promise<void> {
  const url = getGlobalStorage<string | null>(BG_CUSTOM_KEY, null)
  const api = (window as unknown as { electronAPI?: { getCustomBg?: () => Promise<{ enabled: boolean }> } }).electronAPI
  if (api?.getCustomBg) {
    try {
      const res = await api.getCustomBg()
      if (!res.enabled) {
        // 主进程侧文件不存在：清除记忆并回退默认背景
        applyCustomBg(null)
        return
      }
    } catch {
      // 查询失败时沿用本地记忆
    }
  }
  if (url) applyCustomBg(url)
}

/** 自定义背景协议地址（主进程以 kaoyan-bg:// 协议提供文件） */
export const CUSTOM_BG_URL = 'kaoyan-bg://background/custom-bg.jpg'

// ── v3.6.6：背景模糊度自由调节 ──
const BG_BLUR_KEY = 'kaoyan_bg_blur'

/** 可调范围（px）。0 = 壁纸保持原始清晰度 */
export const BG_BLUR_MIN = 0
export const BG_BLUR_MAX = 30
export const BG_BLUR_DEFAULT = 0

function loadBgBlur(): number {
  const raw = getGlobalStorage<string>(BG_BLUR_KEY, String(BG_BLUR_DEFAULT))
  const n = Number(raw)
  if (!Number.isFinite(n)) return BG_BLUR_DEFAULT
  return Math.min(Math.max(n, BG_BLUR_MIN), BG_BLUR_MAX)
}

/** 背景模糊度（px），0 表示不模糊壁纸本身 */
export const bgBlur = ref<number>(loadBgBlur())

/**
 * 把模糊度写到根元素的自定义属性上，由 style.css 的 #app::before 消费。
 * 只作用于壁纸层：#app::before 是壁纸唯一的绘制位置，
 * 玻璃面自身的 backdrop-filter 与它互不影响。
 */
export function applyBgBlur(): void {
  const v = Math.min(Math.max(bgBlur.value, BG_BLUR_MIN), BG_BLUR_MAX)
  document.documentElement.style.setProperty('--mo-bg-blur', `${v}px`)
}

/** 设置背景模糊度并持久化 */
export function setBgBlur(px: number): void {
  const n = Math.min(Math.max(Number(px) || 0, BG_BLUR_MIN), BG_BLUR_MAX)
  bgBlur.value = n
  setGlobalStorage(BG_BLUR_KEY, String(n))
  applyBgBlur()
}

/** 初始化：存储层就绪后重新读取并应用（与 initTheme 同一时机） */
export function initBgBlur(): void {
  bgBlur.value = loadBgBlur()
  applyBgBlur()
}
