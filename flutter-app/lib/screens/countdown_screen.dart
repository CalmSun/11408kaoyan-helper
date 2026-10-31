import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';

import '../services/storage_service.dart';
import '../theme/kaoyan_theme.dart';

/// 考研倒计时页面。
///
/// 数据与 Electron 版一致：`examDate`（默认 2026-12-21）、
/// `examName`（默认 2027 年全国硕士研究生招生考试），存于 shared_preferences，
/// key 与 localStorage 相同（kaoyan_helper_examDate / kaoyan_helper_examName）。
class CountdownScreen extends StatefulWidget {
  const CountdownScreen({super.key});

  @override
  State<CountdownScreen> createState() => _CountdownScreenState();
}

class _CountdownScreenState extends State<CountdownScreen> {
  String _examDate = '2026-12-21';
  String _examName = '2027年全国硕士研究生招生考试（11408）';
  DateTime _now = DateTime.now();
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _loadData();
    // 每秒刷新时分秒
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _now = DateTime.now());
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _loadData() async {
    final date = StorageService.instance.getString('examDate');
    final name = StorageService.instance.getString('examName');
    if (mounted) {
      setState(() {
        if (date != null) _examDate = date;
        if (name != null) _examName = name;
      });
    }
  }

  DateTime get _exam {
    try {
      return DateTime.parse(_examDate);
    } catch (_) {
      return DateTime(2026, 12, 21);
    }
  }

  /// 剩余天数（日历天，与 dayjs diff(now, 'day') 一致）
  int get _daysUntilExam {
    final e = DateTime(_exam.year, _exam.month, _exam.day);
    final n = DateTime(_now.year, _now.month, _now.day);
    final diff = e.difference(n).inDays;
    return diff > 0 ? diff : 0;
  }

  /// 剩余时分秒（倒计时到考试日 00:00）
  ({int hours, int minutes, int seconds}) get _timeParts {
    final remaining = _exam.difference(_now);
    if (remaining.isNegative) return (hours: 0, minutes: 0, seconds: 0);
    return (
      hours: remaining.inHours,
      minutes: remaining.inMinutes % 60,
      seconds: remaining.inSeconds % 60,
    );
  }

  String get _weekDay {
    const names = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];
    return names[_exam.weekday - 1];
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _exam,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365 * 3)),
    );
    if (picked == null) return;
    final dateStr =
        '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
    await StorageService.instance.setString('examDate', dateStr);
    if (mounted) setState(() => _examDate = dateStr);
  }

  @override
  Widget build(BuildContext context) {
    final tp = _timeParts;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        // 倒计时环 + 天数
        GlassContainer.card(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 28),
            child: Column(
              children: [
                SizedBox(
                  width: 200,
                  height: 200,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      SizedBox(
                        width: 200,
                        height: 200,
                        child: CircularProgressIndicator(
                          value: ((365 - _daysUntilExam) / 365).clamp(0.0, 1.0),
                          strokeWidth: 10,
                          backgroundColor: Theme.of(context)
                              .colorScheme
                              .surfaceContainerHighest,
                          valueColor: const AlwaysStoppedAnimation(
                            KaoyanColors.primary,
                          ),
                        ),
                      ),
                      Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            '$_daysUntilExam',
                            style: const TextStyle(
                              fontSize: 52,
                              fontWeight: FontWeight.bold,
                              fontFeatures: [FontFeature.tabularFigures()],
                            ),
                          ),
                          const Text('天', style: TextStyle(fontSize: 16)),
                          const SizedBox(height: 4),
                          Text(
                            '距离考研',
                            style: TextStyle(
                              fontSize: 12,
                              color: Theme.of(context).hintColor,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  _examName,
                  style: const TextStyle(fontSize: 14),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 20),
                // 时分秒
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _timeUnit('${tp.hours}', '时'),
                    _timeColon(),
                    _timeUnit('${tp.minutes}', '分'),
                    _timeColon(),
                    _timeUnit('${tp.seconds}', '秒'),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        // 信息卡片
        Row(
          children: [
            _infoCard(CupertinoIcons.calendar, '考试日期', _examDate),
            const SizedBox(width: 10),
            _infoCard(CupertinoIcons.sun_max, '考试星期', _weekDay),
          ],
        ),
        const SizedBox(height: 16),
        // 修改日期
        GlassButton.custom(
          onTap: _pickDate,
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(CupertinoIcons.pencil, size: 16),
              SizedBox(width: 8),
              Text('修改考试日期'),
            ],
          ),
        ),
      ],
    );
  }

  Widget _timeUnit(String value, String label) {
    return Column(
      children: [
        Text(
          value,
          style: const TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.bold,
            fontFeatures: [FontFeature.tabularFigures()],
          ),
        ),
        Text(
          label,
          style: TextStyle(fontSize: 12, color: Theme.of(context).hintColor),
        ),
      ],
    );
  }

  Widget _timeColon() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Text(
        ':',
        style: TextStyle(
          fontSize: 28,
          fontWeight: FontWeight.bold,
          color: Theme.of(context).hintColor,
        ),
      ),
    );
  }

  Widget _infoCard(IconData icon, String label, String value) {
    return Expanded(
      child: GlassContainer.card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Icon(icon, size: 22, color: KaoyanColors.primary),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: TextStyle(
                        fontSize: 11,
                        color: Theme.of(context).hintColor,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      value,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
