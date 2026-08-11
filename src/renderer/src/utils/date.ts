import dayjs from 'dayjs'

/**
 * 获取当前本地日期（YYYY-MM-DD）
 * 注意：计划的 createdAt 使用 UTC 的 toISOString() 存储，
 * 若直接用 UTC 字符串前缀与本地日期比较，在东八区 0-8 点会错位一天，
 * 导致今日计划消失、历史记录日期错乱。统一使用本工具做本地日期比较。
 */
export function todayLocal(): string {
  return dayjs().format('YYYY-MM-DD')
}

/** 将 ISO 时间戳（UTC）转换为本地日期 YYYY-MM-DD */
export function toLocalDate(iso: string): string {
  return dayjs(iso).format('YYYY-MM-DD')
}
