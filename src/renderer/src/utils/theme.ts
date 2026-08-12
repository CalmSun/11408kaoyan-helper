import { ref, computed } from 'vue'

/** 主题模式：浅色 / 深色 / 跟随系统 */
export type ThemeMode = 'light' | 'dark' | 'system'

const THEME_KEY = 'kaoyan_theme'

const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

function loadMode(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    // 忽略读取失败
  }
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

/** 设置主题模式并持久化 */
export function setThemeMode(mode: ThemeMode): void {
  themeMode.value = mode
  try {
    localStorage.setItem(THEME_KEY, mode)
  } catch {
    // 忽略写入失败
  }
  applyTheme()
}

/** 快捷切换：深色 <-> 浅色 */
export function toggleTheme(): void {
  setThemeMode(isDark.value ? 'light' : 'dark')
}

/** 初始化：应用已保存的主题，并监听系统主题变化 */
export function initTheme(): void {
  applyTheme()
  applyEyeCare()
  mediaQuery.addEventListener('change', (e) => {
    systemDark.value = e.matches
    applyTheme()
  })
}

const EYECARE_KEY = 'kaoyan_eyecare'

export const eyeCare = ref<boolean>(loadEyeCare())

function loadEyeCare(): boolean {
  try {
    return localStorage.getItem(EYECARE_KEY) === '1'
  } catch {
    return false
  }
}

/** 应用护眼模式：向根元素注入 .eyecare 类（暖色滤光，降低蓝光） */
export function applyEyeCare(): void {
  document.documentElement.classList.toggle('eyecare', eyeCare.value)
}

/** 切换护眼模式并持久化 */
export function setEyeCare(on: boolean): void {
  eyeCare.value = on
  try {
    localStorage.setItem(EYECARE_KEY, on ? '1' : '0')
  } catch {
    // 忽略写入失败
  }
  applyEyeCare()
}

export function toggleEyeCare(): void {
  setEyeCare(!eyeCare.value)
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
  try {
    if (url) localStorage.setItem(BG_CUSTOM_KEY, url)
    else localStorage.removeItem(BG_CUSTOM_KEY)
  } catch {
    // 忽略写入失败
  }
}

/** 初始化自定义背景：优先读取本地记忆，并向主进程核实文件是否仍存在 */
export async function initCustomBg(): Promise<void> {
  let url: string | null = null
  try {
    url = localStorage.getItem(BG_CUSTOM_KEY)
  } catch {
    // 忽略读取失败
  }
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
