import { ref } from 'vue'

export interface WeatherInfo {
  tempC: string
  condition: string
  icon: string // emoji
  humidity: string
  wind: string
  city: string
}

export const weather = ref<WeatherInfo | null>(null)
export const weatherLoading = ref(false)

const CACHE_KEY = 'kaoyan_weather_cache'
const CACHE_TTL = 30 * 60 * 1000 // 30 分钟缓存

// 天气描述 -> emoji 映射
function conditionIcon(text: string): string {
  const t = text.toLowerCase()
  if (/thunder|storm/.test(t)) return '⛈️'
  if (/snow|sleet|blizzard/.test(t)) return '🌨️'
  if (/rain|drizzle|shower/.test(t)) return '🌧️'
  if (/fog|mist|haze/.test(t)) return '🌫️'
  if (/cloud|overcast/.test(t)) return '☁️'
  if (/clear|sunny/.test(t)) return '☀️'
  if (/partly/.test(t)) return ''
  return '🌤️'
}

interface WttrCurrent {
  temp_C?: string
  humidity?: string
  windspeedKmph?: string
  weatherDesc?: { value?: string }[]
  lang_zh?: { value?: string }[]
}

interface WttrArea {
  areaName?: { value?: string }[]
}

interface WttrJson {
  current_condition?: WttrCurrent[]
  nearest_area?: WttrArea[]
}

function readCache(): WeatherInfo | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { ts: number; data: WeatherInfo }
    if (Date.now() - parsed.ts < CACHE_TTL) return parsed.data
  } catch {
    // 忽略
  }
  return null
}

function writeCache(data: WeatherInfo): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }))
  } catch {
    // 忽略
  }
}

/** 拉取当前天气（wttr.in JSON 接口）。失败时保留旧缓存或置空，不抛错 */
export async function fetchWeather(): Promise<void> {
  const cached = readCache()
  if (cached) {
    weather.value = cached
    return
  }
  weatherLoading.value = true
  try {
    const res = await fetch('https://wttr.in/?format=j1&lang=zh', {
      headers: { 'Accept-Language': 'zh-CN' }
    })
    if (!res.ok) throw new Error(`http ${res.status}`)
    const json = (await res.json()) as WttrJson
    const cur = json.current_condition?.[0]
    if (!cur) throw new Error('no current_condition')
    const descZh = cur.lang_zh?.[0]?.value || cur.weatherDesc?.[0]?.value || '未知'
    const info: WeatherInfo = {
      tempC: cur.temp_C ?? '--',
      condition: descZh,
      icon: conditionIcon(descZh + ' ' + (cur.weatherDesc?.[0]?.value || '')),
      humidity: cur.humidity ?? '--',
      wind: cur.windspeedKmph ?? '--',
      city: json.nearest_area?.[0]?.areaName?.[0]?.value || ''
    }
    weather.value = info
    writeCache(info)
  } catch {
    // 网络失败：不清空已有展示，仅不更新
  } finally {
    weatherLoading.value = false
  }
}

/** 初始化：读缓存并后台刷新 */
export function initWeather(): void {
  const cached = readCache()
  if (cached) weather.value = cached
  fetchWeather()
}
