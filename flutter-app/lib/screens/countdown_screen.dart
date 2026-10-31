import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';

import '../models/models.dart';
import '../services/app_store.dart';
import '../theme/kaoyan_theme.dart';

/// 考研倒计时页面（对应 Electron Countdown.vue）。
///
/// 完整对齐：倒计时到考试日 23:59:59、时/分/秒取模、4 张信息卡、
/// 各科目复习建议（按剩余天数分 early/mid/late/final 四档）、
/// 考试名称 + 日期设置表单。
class CountdownScreen extends StatefulWidget {
  const CountdownScreen({super.key});

  @override
  State<CountdownScreen> createState() => _CountdownScreenState();
}

class _CountdownScreenState extends State<CountdownScreen> {
  DateTime _now = DateTime.now();
  Timer? _timer;
  late final TextEditingController _nameCtl;

  @override
  void initState() {
    super.initState();
    _nameCtl = TextEditingController(text: AppStore.instance.examName);
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _now = DateTime.now());
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _nameCtl.dispose();
    super.dispose();
  }

  DateTime get _exam {
    try {
      return DateTime.parse(AppStore.instance.examDate);
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

  /// 剩余时分秒（倒计时到考试日 23:59:59，时取 %24）
  ({int hours, int minutes, int seconds}) get _timeParts {
    final examEnd = DateTime(_exam.year, _exam.month, _exam.day, 23, 59, 59);
    final remaining = examEnd.difference(_now);
    if (remaining.isNegative) return (hours: 0, minutes: 0, seconds: 0);
    return (
      hours: remaining.inHours % 24,
      minutes: remaining.inMinutes % 60,
      seconds: remaining.inSeconds % 60,
    );
  }

  String get _weekDay {
    const names = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return names[_exam.weekday % 7];
  }

  int get _progressPercent {
    const totalDays = 365;
    final passed = totalDays - _daysUntilExam;
    return (passed / totalDays * 100).clamp(0, 100).round();
  }

  int get _daysStudied => AppStore.instance.dailyRecords.length;

  String _subjectTip(SubjectType subject) {
    final days = _daysUntilExam;
    final tips = <SubjectType, List<String>>{
      SubjectType.politics: [
        '现在可以先了解马原、毛中特的基本框架，不用死记硬背，重在理解。',
        '开始系统学习知识点，配合1000题练习，重点关注选择题。',
        '集中背诵肖四肖八，时政也要跟上，大题模板要熟练。',
        '最后冲刺！肖四大题必须背熟，保持手感，调整心态。',
      ],
      SubjectType.english: [
        '重点背单词！每天坚持背，词汇量是基础。可以开始做阅读真题了。',
        '真题精读，每篇都要吃透。开始准备作文模板和翻译练习。',
        '真题二刷三刷，作文要动手写，完型新题型也不能丢。',
        '保持做题手感，作文模板背熟，单词再过一遍。',
      ],
      SubjectType.math: [
        '打基础！教材+基础班视频，例题一定要自己做一遍。',
        '强化阶段，660/880刷起来，注意总结题型和方法。',
        '真题+模拟卷，严格限时做，错题一定要搞懂。',
        '回顾错题和公式，保持计算手感，不要钻偏题怪题。',
      ],
      SubjectType.cs408: [
        '数据结构重在动手写代码；组成原理理解存储系统、CPU流水线；操作系统掌握进程管理、内存管理；计算机网络吃透五层模型和TCP/IP协议。',
        '算法题反复刷，排序查找图算法要熟练；组成原理重点攻Cache和虚存；操作系统攻克PV操作和页面置换；计网深入数据链路层和网络层。',
        '408真题反复做，总结常考题型；大题要动手写，注意答题规范；算法代码要能默写核心实现。',
        '回顾核心概念和易错点；公式再过一遍；保持代码手感和做题状态，调整心态。',
      ],
    };
    final list = tips[subject]!;
    if (days > 180) return list[0];
    if (days > 90) return list[1];
    if (days > 30) return list[2];
    return list[3];
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
    await AppStore.instance.setExamDate(dateStr, name: _nameCtl.text);
    if (mounted) {
      setState(() {});
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('设置已保存')));
    }
  }

  Future<void> _saveName() async {
    final name = _nameCtl.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('请输入考试名称')));
      return;
    }
    await AppStore.instance.setExamDate(AppStore.instance.examDate, name: name);
    if (mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('设置已保存')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final store = AppStore.instance;
    final tp = _timeParts;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        Text(store.examName,
            style: TextStyle(
                fontSize: 14, color: Theme.of(context).hintColor)),
        const SizedBox(height: 16),
        _buildCountdownCard(tp),
        const SizedBox(height: 16),
        _buildInfoCards(),
        const SizedBox(height: 16),
        _buildSubjectTips(),
        const SizedBox(height: 16),
        _buildSettingsCard(),
      ],
    );
  }

  Widget _buildCountdownCard(({int hours, int minutes, int seconds}) tp) {
    return GlassContainer.card(
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
                      value: (_progressPercent / 100).clamp(0.0, 1.0),
                      strokeWidth: 10,
                      backgroundColor:
                          Theme.of(context).colorScheme.surfaceContainerHighest,
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
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _timeUnit(tp.hours.toString().padLeft(2, '0'), '时'),
                _timeColon(),
                _timeUnit(tp.minutes.toString().padLeft(2, '0'), '分'),
                _timeColon(),
                _timeUnit(tp.seconds.toString().padLeft(2, '0'), '秒'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoCards() {
    final store = AppStore.instance;
    return LayoutBuilder(builder: (context, constraints) {
      final wide = constraints.maxWidth > 640;
      final cards = [
        _infoCard(CupertinoIcons.calendar, '考试日期', store.examDate),
        _infoCard(CupertinoIcons.flame_fill, '已坚持', '$_daysStudied 天'),
        _infoCard(CupertinoIcons.chart_bar_fill, '进度', '$_progressPercent%'),
        _infoCard(CupertinoIcons.sun_max, '星期', _weekDay),
      ];
      if (wide) {
        return Row(children: [
          for (var i = 0; i < cards.length; i++) ...[
            if (i > 0) const SizedBox(width: 10),
            Expanded(child: cards[i]),
          ]
        ]);
      }
      return Column(children: [
        for (var i = 0; i < cards.length; i++) ...[
          if (i > 0) const SizedBox(height: 10),
          cards[i],
        ]
      ]);
    });
  }

  Widget _buildSubjectTips() {
    return GlassContainer.card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(children: [
              Icon(CupertinoIcons.lightbulb_fill,
                  size: 18, color: KaoyanColors.primary),
              SizedBox(width: 8),
              Text('各科目复习建议',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            ]),
            const SizedBox(height: 16),
            LayoutBuilder(builder: (context, constraints) {
              final wide = constraints.maxWidth > 640;
              final tips = SubjectType.values
                  .map((s) => _tipItem(s))
                  .toList();
              if (wide) {
                return Column(children: [
                  for (var i = 0; i < tips.length; i += 2) ...[
                    if (i > 0) const SizedBox(height: 10),
                    Row(children: [
                      Expanded(child: tips[i]),
                      const SizedBox(width: 10),
                      Expanded(child: tips[i + 1]),
                    ]),
                  ]
                ]);
              }
              return Column(children: [
                for (var i = 0; i < tips.length; i++) ...[
                  if (i > 0) const SizedBox(height: 10),
                  tips[i],
                ]
              ]);
            }),
          ],
        ),
      ),
    );
  }

  Widget _tipItem(SubjectType s) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(
                color: s.color,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 8),
            Flexible(
              child: Text(s.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 15, fontWeight: FontWeight.w600)),
            ),
          ]),
          const SizedBox(height: 8),
          Text(
            _subjectTip(s),
            style: TextStyle(
              fontSize: 13,
              height: 1.7,
              color: Theme.of(context).hintColor,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSettingsCard() {
    return GlassContainer.card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(children: [
              Icon(CupertinoIcons.gear_alt,
                  size: 18, color: KaoyanColors.primary),
              SizedBox(width: 8),
              Text('考试设置',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            ]),
            const SizedBox(height: 16),
            TextField(
              controller: _nameCtl,
              decoration: const InputDecoration(
                labelText: '考试名称',
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _pickDate,
                  icon: const Icon(CupertinoIcons.calendar, size: 16),
                  label: Text(AppStore.instance.examDate),
                ),
              ),
              const SizedBox(width: 12),
              FilledButton.icon(
                onPressed: _saveName,
                icon: const Icon(CupertinoIcons.checkmark, size: 16),
                label: const Text('保存设置'),
              ),
            ]),
          ],
        ),
      ),
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
    return GlassContainer.card(
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
    );
  }
}
