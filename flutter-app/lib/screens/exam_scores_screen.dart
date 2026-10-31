import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';

import '../models/models.dart';
import '../services/app_store.dart';

/// 真题成绩（对应 Electron ExamScores.vue，echarts → fl_chart）。
class ExamScoresScreen extends StatefulWidget {
  const ExamScoresScreen({super.key});

  @override
  State<ExamScoresScreen> createState() => _ExamScoresScreenState();
}

class _ExamScoresScreenState extends State<ExamScoresScreen> {
  SubjectType? _filterSubject;

  @override
  Widget build(BuildContext context) {
    final store = AppStore.instance;
    return ListenableBuilder(
      listenable: store,
      builder: (context, _) {
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text('真题成绩',
                      style: TextStyle(
                          fontSize: 20, fontWeight: FontWeight.bold)),
                ),
                GlassButton(
                  icon: const Icon(CupertinoIcons.plus),
                  onTap: () => _showEditDialog(),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _buildSummaryGrid(store, context),
            const SizedBox(height: 16),
            _chartCard('各科历年真题分数趋势', _buildTrendChart(store, context)),
            const SizedBox(height: 16),
            _buildRecords(store, context),
          ],
        );
      },
    );
  }

  // ── 汇总卡 ──
  Widget _buildSummaryGrid(AppStore store, BuildContext context) {
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: [
        for (final s in SubjectType.values)
          SizedBox(width: _cardWidth(context), child: _summaryCard(store, s)),
      ],
    );
  }

  double _cardWidth(BuildContext context) {
    final w = MediaQuery.of(context).size.width;
    if (w < 400) return (w - 32 - 12) / 2;
    if (w < 900) return (w - 32 - 12) / 2;
    return (w - 32 - 12 * 3) / 4;
  }

  ({String avg, int max, int count})? _stats(AppStore store, SubjectType s) {
    final records = store.examScores.where((r) => r.subject == s).toList();
    if (records.isEmpty) return null;
    final scores = records.map((r) => r.score).toList();
    final avg = (scores.fold(0, (a, b) => a + b) / scores.length)
        .toStringAsFixed(1);
    final max = scores.reduce((a, b) => a > b ? a : b);
    return (avg: avg, max: max, count: records.length);
  }

  Widget _summaryCard(AppStore store, SubjectType s) {
    final stats = _stats(store, s);
    return GlassContainer.card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(s.name,
                      style: TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w600, color: s.color)),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: s.color,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text('满分 ${subjectFullScore[s]}',
                      style: const TextStyle(fontSize: 10, color: Colors.white)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (stats == null)
              Text('暂无记录',
                  style:
                      TextStyle(fontSize: 12, color: Theme.of(context).hintColor))
            else
              Row(
                children: [
                  _statCell(stats.avg, '平均分', s.color),
                  _statCell('${stats.max}', '最高分', null),
                  _statCell('${stats.count}', '已练年份', null),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _statCell(String value, String label, Color? color) {
    return Expanded(
      child: Column(
        children: [
          Text(value,
              style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: color,
                  fontFeatures: const [FontFeature.tabularFigures()])),
          Text(label,
              style:
                  TextStyle(fontSize: 10, color: Theme.of(context).hintColor)),
        ],
      ),
    );
  }

  // ── 趋势图 ──
  Widget _buildTrendChart(AppStore store, BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final axisLabel = dark ? Colors.white54 : const Color(0xFF9AA0A8);
    final grid = dark ? Colors.white12 : const Color(0xFFE2E6E9);
    const minYear = 2009, maxYear = 2026;

    final bars = <LineChartBarData>[];
    for (final s in SubjectType.values) {
      final records = store.examScores
          .where((r) => r.subject == s)
          .toList()
        ..sort((a, b) => a.year.compareTo(b.year));
      if (records.isEmpty) continue;
      bars.add(LineChartBarData(
        spots: [
          for (final r in records)
            FlSpot(r.year.toDouble(), r.score.toDouble()),
        ],
        isCurved: true,
        color: s.color,
        barWidth: 2,
        dotData: const FlDotData(show: true),
      ));
    }

    return SizedBox(
      height: 260,
      child: bars.isEmpty
          ? const Center(child: Text('暂无记录，点击右上角录入分数'))
          : LineChart(
              LineChartData(
                minX: minYear.toDouble(),
                maxX: maxYear.toDouble(),
                minY: 0,
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  getDrawingHorizontalLine: (_) =>
                      FlLine(color: grid, strokeWidth: 1),
                ),
                borderData: FlBorderData(show: false),
                titlesData: FlTitlesData(
                  topTitles:
                      const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles:
                      const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 34,
                      getTitlesWidget: (v, meta) => Text(v.toInt().toString(),
                          style: TextStyle(fontSize: 10, color: axisLabel)),
                    ),
                  ),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      interval: 3,
                      getTitlesWidget: (v, meta) => Text(
                        v.toInt().toString(),
                        style: TextStyle(fontSize: 10, color: axisLabel),
                      ),
                    ),
                  ),
                ),
                lineTouchData: LineTouchData(
                  touchTooltipData: LineTouchTooltipData(
                    getTooltipItems: (spots) => spots
                        .map((sp) => LineTooltipItem(
                              '${sp.x.toInt()}年: ${sp.y.toInt()}分',
                              const TextStyle(
                                  color: Colors.white, fontSize: 12),
                            ))
                        .toList(),
                  ),
                ),
                lineBarsData: bars,
              ),
            ),
    );
  }

  // ── 记录列表 ──
  Widget _buildRecords(AppStore store, BuildContext context) {
    final records = store.examScores.toList()
      ..sort((a, b) => a.year.compareTo(b.year));
    final filtered = _filterSubject == null
        ? records
        : records.where((r) => r.subject == _filterSubject).toList();

    return GlassContainer.card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text('分数记录',
                    style:
                        TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                const Spacer(),
                DropdownButton<SubjectType?>(
                  value: _filterSubject,
                  hint: const Text('按科目筛选', style: TextStyle(fontSize: 13)),
                  underline: const SizedBox.shrink(),
                  items: [
                    const DropdownMenuItem<SubjectType?>(
                        value: null, child: Text('全部科目')),
                    for (final s in SubjectType.values)
                      DropdownMenuItem<SubjectType?>(
                          value: s, child: Text(s.name)),
                  ],
                  onChanged: (v) => setState(() => _filterSubject = v),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (filtered.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Center(
                  child: Text('暂无记录，点击右上角「录入分数」添加',
                      style: TextStyle(color: Theme.of(context).hintColor)),
                ),
              )
            else
              for (final r in filtered) _recordRow(r, context),
          ],
        ),
      ),
    );
  }

  Widget _recordRow(ExamScoreRecord r, BuildContext context) {
    final rate = (r.score / r.fullScore * 100).round();
    final rateColor = rate >= 80
        ? const Color(0xFF22C55E)
        : rate >= 60
            ? const Color(0xFFF59E0B)
            : const Color(0xFFEF4444);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          SizedBox(
              width: 52,
              child: Text('${r.year}',
                  style: const TextStyle(
                      fontWeight: FontWeight.w600, fontSize: 14))),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: r.subject.color,
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(r.subject.shortName,
                style: const TextStyle(fontSize: 11, color: Colors.white)),
          ),
          const SizedBox(width: 10),
          Text('${r.score}',
              style: const TextStyle(
                  fontSize: 15, fontWeight: FontWeight.bold)),
          Text(' / ${r.fullScore}',
              style:
                  TextStyle(fontSize: 12, color: Theme.of(context).hintColor)),
          const SizedBox(width: 12),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: rate / 100,
                minHeight: 8,
                backgroundColor:
                    Theme.of(context).colorScheme.surfaceContainerHighest,
                valueColor: AlwaysStoppedAnimation(rateColor),
              ),
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 34,
            child: Text('$rate%',
                style: TextStyle(fontSize: 11, color: rateColor)),
          ),
          IconButton(
            icon: const Icon(CupertinoIcons.pencil, size: 16),
            onPressed: () => _showEditDialog(record: r),
          ),
          IconButton(
            icon: const Icon(CupertinoIcons.trash,
                size: 16, color: Color(0xFFEF4444)),
            onPressed: () => _delete(r),
          ),
        ],
      ),
    );
  }

  Future<void> _delete(ExamScoreRecord r) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('删除确认'),
        content: Text('确定删除 ${r.year} 年 ${r.subject.name} 的分数记录吗？'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('取消')),
          FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('删除')),
        ],
      ),
    );
    if (ok == true) {
      await AppStore.instance.deleteExamScore(r.id);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('已删除')));
      }
    }
  }

  void _showEditDialog({ExamScoreRecord? record}) {
    final isEditing = record != null;
    var subject = record?.subject ?? SubjectType.politics;
    var year = record?.year ?? 2026;
    var score = (record?.score ?? 0).toDouble();
    final remarkCtl = TextEditingController(text: record?.remark ?? '');

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlg) => AlertDialog(
          title: Text(isEditing ? '编辑分数' : '录入分数'),
          content: SizedBox(
            width: 420,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<SubjectType>(
                  initialValue: subject,
                  decoration: const InputDecoration(labelText: '科目'),
                  items: [
                    for (final s in SubjectType.values)
                      DropdownMenuItem(
                          value: s,
                          child: Text('${s.name}（满分 ${subjectFullScore[s]}）')),
                  ],
                  onChanged: (v) => setDlg(() {
                    subject = v ?? subject;
                    if (score > (subjectFullScore[subject] ?? 150)) {
                      score = (subjectFullScore[subject] ?? 150).toDouble();
                    }
                  }),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<int>(
                  initialValue: year,
                  decoration: const InputDecoration(labelText: '年份'),
                  items: [
                    for (var y = 2026; y >= 2009; y--)
                      DropdownMenuItem(value: y, child: Text('$y 年')),
                  ],
                  onChanged: (v) => setDlg(() => year = v ?? year),
                ),
                const SizedBox(height: 12),
                TextField(
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText:
                        '得分（0-${subjectFullScore[subject]}）',
                  ),
                  controller: TextEditingController(text: score.toInt().toString())
                    ..selection = TextSelection.collapsed(
                        offset: score.toInt().toString().length),
                  onChanged: (v) =>
                      score = (double.tryParse(v) ?? 0),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: remarkCtl,
                  decoration:
                      const InputDecoration(labelText: '备注（选填）'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('取消')),
            FilledButton(
              onPressed: () async {
                final max = subjectFullScore[subject] ?? 150;
                final s = score.round();
                if (s < 0 || s > max) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('得分需在 0-$max 之间')),
                  );
                  return;
                }
                final store = AppStore.instance;
                final duplicate = store.examScores.any((r) =>
                    r.subject == subject &&
                    r.year == year &&
                    r.id != record?.id);
                if (duplicate) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                        content: Text('$year 年 ${subject.name} 已有记录，请直接编辑')),
                  );
                  return;
                }
                if (record != null) {
                  await store.updateExamScore(record.id,
                      subject: subject,
                      year: year,
                      score: s,
                      remark: remarkCtl.text);
                } else {
                  await store.addExamScore(
                      subject, year, s, remarkCtl.text);
                }
                if (!ctx.mounted) return;
                Navigator.of(ctx).pop();
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                    content: Text(record != null ? '分数已更新' : '分数录入成功')));
              },
              child: const Text('确认'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _chartCard(String title, Widget chart) {
    return GlassContainer.card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style:
                    const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 16),
            chart,
          ],
        ),
      ),
    );
  }
}
