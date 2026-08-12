import { ref } from 'vue'

export interface WeatherInfo {
  tempC: string
  condition: string
  icon: string // emoji
  humidity: string
  wind: string
  city: string
  feelsLikeC?: string // 体感温度（v2.7.1；国内源无此字段时为空）
  obsTime?: string    // 观测时间
  tempMax?: string    // 今日最高温（v2.8.0）
  tempMin?: string    // 今日最低温（v2.8.0）
}

/** 已选城市（id + 名称；默认北京） */
export interface WeatherCity {
  id: string
  name: string
}

export const weather = ref<WeatherInfo | null>(null)
export const weatherLoading = ref(false)
/** 当前查询城市（v2.8.0：国内城市编码） */
export const weatherCity = ref<WeatherCity>({ id: '101010100', name: '北京' })

const CACHE_KEY = 'kaoyan_weather_cache_v2'
const CITY_KEY = 'kaoyan_weather_city_v2'
const CACHE_TTL = 30 * 60 * 1000 // 30 分钟缓存

// 常用城市快捷选择（v2.8.0：中国天气网城市编码）
export const CITY_PRESETS: WeatherCity[] = [
  { id: '101010100', name: '北京' },
  { id: '101020100', name: '上海' },
  { id: '101280101', name: '广州' },
  { id: '101280601', name: '深圳' },
  { id: '101210101', name: '杭州' },
  { id: '101270101', name: '成都' },
  { id: '101200101', name: '武汉' },
  { id: '101110101', name: '西安' },
  { id: '101190101', name: '南京' },
  { id: '101040100', name: '重庆' },
  { id: '101030100', name: '天津' },
  { id: '101190401', name: '苏州' },
  { id: '101250101', name: '长沙' },
  { id: '101180101', name: '郑州' },
  { id: '101120201', name: '青岛' },
  { id: '101220101', name: '合肥' },
  { id: '101050101', name: '哈尔滨' }
]

// 中国天气网天气编码 -> emoji（d 白天 / n 夜间前缀 + 编号）
function codeToIcon(code: string): string {
  const num = parseInt(String(code || '').replace(/^[dn]/, ''), 10)
  if (Number.isNaN(num)) return '🌤️'
  if (num === 0) return '☀️'
  if (num === 1) return '🌤️'
  if (num === 2) return '⛅'
  if (num >= 3 && num <= 5) return '🌥️'
  if (num >= 6 && num <= 9) return '🌧️'
  if (num >= 10 && num <= 12) return '🌧️'
  if (num >= 13 && num <= 17) return '🌨️'
  if (num >= 18 && num <= 20) return '🌫️'
  if (num >= 21 && num <= 25) return '🌧️'
  if (num >= 26 && num <= 28) return '🌨️'
  if (num >= 29 && num <= 31) return '🌫️'
  return '🌤️'
}

function readCache(): WeatherInfo | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { ts: number; cityId: string; data: WeatherInfo }
    if (parsed.cityId !== weatherCity.value.id) return null
    if (Date.now() - parsed.ts < CACHE_TTL) return parsed.data
  } catch {
    // 忽略
  }
  return null
}

function writeCache(data: WeatherInfo): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), cityId: weatherCity.value.id, data }))
  } catch {
    // 忽略
  }
}

/** 解析中国天气网实况数据为统一结构 */
function parseCN(d: Record<string, string>): WeatherInfo {
  return {
    tempC: d.temp ?? '--',
    condition: d.weather || '未知',
    icon: codeToIcon(d.weathercode || ''),
    humidity: (d.SD || d.sd || '').replace('%', '') || '--',
    wind: d.wse ? d.wse.replace('km/h', '') : '--',
    city: weatherCity.value.name,
    obsTime: d.time,
    tempMax: d.tempMax,
    tempMin: d.tempMin
  }
}

/** 拉取当前天气（v2.8.0：国内源，经主进程 IPC；浏览器环境回退 wttr.in） */
export async function fetchWeather(opts?: { force?: boolean }): Promise<void> {
  if (!opts?.force) {
    const cached = readCache()
    if (cached) {
      weather.value = cached
      return
    }
  }
  weatherLoading.value = true
  try {
    const api = window.electronAPI
    if (api?.weatherCurrent) {
      const res = await api.weatherCurrent(weatherCity.value.id)
      if (res.success && res.data) {
        const info = parseCN(res.data)
        weather.value = info
        writeCache(info)
      }
      // 失败：保留旧展示，不清空
    } else {
      await fetchWeatherFallback()
    }
  } catch {
    // 网络失败静默
  } finally {
    weatherLoading.value = false
  }
}

/** 浏览器环境回退：wttr.in（无国内源 IPC 时） */
async function fetchWeatherFallback(): Promise<void> {
  const loc = encodeURIComponent(weatherCity.value.name)
  const res = await fetch(`https://wttr.in/${loc}?format=j1&lang=zh`, {
    headers: { 'Accept-Language': 'zh-CN' }
  })
  if (!res.ok) return
  const json = await res.json() as {
    current_condition?: {
      temp_C?: string; FeelsLikeC?: string; humidity?: string; windspeedKmph?: string
      weatherDesc?: { value?: string }[]; lang_zh?: { value?: string }[]; localObsDateTime?: string
    }[]
    nearest_area?: { areaName?: { value?: string }[] }[]
  }
  const cur = json.current_condition?.[0]
  if (!cur) return
  const descZh = cur.lang_zh?.[0]?.value || cur.weatherDesc?.[0]?.value || '未知'
  const info: WeatherInfo = {
    tempC: cur.temp_C ?? '--',
    condition: descZh,
    icon: /雪/.test(descZh) ? '🌨️' : /雨/.test(descZh) ? '🌧️' : /晴/.test(descZh) ? '☀️' : /云|阴/.test(descZh) ? '☁️' : /雾|霾/.test(descZh) ? '🌫️' : '🌤️',
    humidity: cur.humidity ?? '--',
    wind: cur.windspeedKmph ?? '--',
    city: json.nearest_area?.[0]?.areaName?.[0]?.value || weatherCity.value.name,
    feelsLikeC: cur.FeelsLikeC,
    obsTime: cur.localObsDateTime
  }
  weather.value = info
  writeCache(info)
}

/** 设置查询城市并强制刷新（v2.8.0） */
export async function setCity(city: WeatherCity): Promise<void> {
  weatherCity.value = city
  try {
    localStorage.setItem(CITY_KEY, JSON.stringify(city))
  } catch {
    // 忽略
  }
  await fetchWeather({ force: true })
}

/** 按名称搜索国内城市（v2.8.0） */
export async function searchCities(name: string): Promise<{ id: string; name: string; province: string }[]> {
  const api = window.electronAPI
  if (!api?.weatherSearch) return []
  try {
    const res = await api.weatherSearch(name)
    return res.success && res.results ? res.results : []
  } catch {
    return []
  }
}

/** 初始化：恢复已选城市，读缓存并后台刷新 */
export function initWeather(): void {
  try {
    const raw = localStorage.getItem(CITY_KEY)
    if (raw) {
      const c = JSON.parse(raw) as WeatherCity
      if (c && c.id && c.name) weatherCity.value = c
    }
  } catch {
    // 忽略
  }
  const cached = readCache()
  if (cached) weather.value = cached
  fetchWeather()
}
