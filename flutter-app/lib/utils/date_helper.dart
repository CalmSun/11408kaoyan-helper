/// 日期工具：与 Electron 版 utils/date.ts 对应。
///
/// 关键：计划 createdAt 用 UTC 的 toISOString() 存储，若直接用 UTC 字符串前缀
/// 与本地日期比较，在东八区 0-8 点会错位一天。统一用本地日期比较。
library;

/// 当前本地日期 YYYY-MM-DD
String todayLocal() {
  final now = DateTime.now();
  return _fmt(now);
}

/// ISO 时间戳（UTC）→ 本地日期 YYYY-MM-DD
String toLocalDate(String iso) {
  try {
    return _fmt(DateTime.parse(iso).toLocal());
  } catch (_) {
    return '';
  }
}

String _fmt(DateTime d) {
  final m = d.month.toString().padLeft(2, '0');
  final day = d.day.toString().padLeft(2, '0');
  return '${d.year}-$m-$day';
}
