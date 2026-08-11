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
  mediaQuery.addEventListener('change', (e) => {
    systemDark.value = e.matches
    applyTheme()
  })
}
