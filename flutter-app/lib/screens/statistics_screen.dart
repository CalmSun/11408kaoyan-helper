import 'package:file_picker/file_picker.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';

import '../models/models.dart';
import '../services/app_store.dart';
import '../services/report_service.dart';
import '../theme/kaoyan_theme.dart';

/// 数据统计页面（对应 Electron Statistics.vue，echarts → fl_chart）。
class StatisticsScreen extends StatelessWidget {
  const StatisticsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final store = AppStore.instance;
    return ListenableBuilder(
      listenable: store,
      builder: (context, _) {
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            _buildExportBar(context, store),
            _buildOverview(store, context),
            const SizedBox(height: 16),
            _chartCard('近 7 天学习时长（分钟）', _buildStudyChart(store, context)),
            const SizedBox(height: 16),
            _chartCard('各科目学习占比', _buildSubjectPie(store)),
            const SizedBox(height: 16),
            _chartCard('每日番茄数', _buildPomodoroChart(store, context)),
            const SizedBox(height: 16),
            _chartCard('各科目学习时长（小时）', _buildSubjectHoursChart(store, context)),
            const SizedBox(height: 16),
            _buildCalendar(store, context),
          ],
        );
      },
    );
  }

  // ── 导出学习报告 ──
  Widget _buildExportBar(BuildContext context, AppStore store) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        TextButton.icon(
          onPressed: () => _exportReport(context, store),
          icon: const Icon(CupertinoIcons.arrow_down_circle, size: 16),
          label: const Text('导出学习报告'),
        ),
      ],
    );
  }

  Future<void> _exportReport(BuildContext context, AppStore store) async {
    try {
      final bytes = await ReportService.generateLearningReport(store);
      final date = DateTime.now().toIso8601String().substring(0, 10);
      final uri = await FilePicker.saveFile(
        dialogTitle: '导出学习报告',
        fileName: '考研助手学习报告_$date.pdf',
        bytes: bytes,
      );
      if (uri != null && context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('学习报告已导出')));
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('导出失败：$e')));
      }
    }
  }

  // ── 总览三卡 ──
  Widget _buildOverview(AppStore store, BuildContext context) {
    return Row(
      children: [
        _overviewCard(context, store.totalStudyHours, '总学习时长（小时）',
            CupertinoIcons.clock_fill, KaoyanColors.primary),
        const SizedBox(width: 10),
        _overviewCard(context, '${store.pomodoroRecords.length}', '总番茄数',
            CupertinoIcons.flame_fill, const Color(0xFF00B0D6)),
        const SizedBox(width: 10),
        _overviewCard(context, '${store.flashcards.length}', '背诵卡片',
            CupertinoIcons.rectangle_stack_fill, const Color(0xFF8A4AF7)),
      ],
    );
  }

  Widget _overviewCard(
    BuildContext context,
    String value,
    String label,
    IconData icon,
    Color color,
  ) {
    return Expanded(
      child: GlassContainer.card(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 12),
          child: Column(
            children: [
              Icon(icon, size: 24, color: color),
              const SizedBox(height: 8),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  fontFeatures: [FontFeature.tabularFigures()],
                ),
              ),
              const SizedBox(height: 2),
              Text(
                label,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 11,
                  color: Theme.of(context).hintColor,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── 近 7 天学习时长（折线） ──
  List<String> get _last7Days {
    final now = DateTime.now();
    return List.generate(7, (i) {
      final d = now.subtract(Duration(days: 6 - i));
      return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
    });
  }

  Widget _buildStudyChart(AppStore store, BuildContext context) {
    final days = _last7Days;
    final spots = <FlSpot>[];
    for (var i = 0; i < days.length; i++) {
      final minutes = store.pomodoroRecords
          .where((r) => r.date == days[i])
          .fold(0, (sum, r) => sum + r.duration);
      spots.add(FlSpot(i.toDouble(), minutes.toDouble()));
    }
    final dark = Theme.of(context).brightness == Brightness.dark;
    final axisLabel = dark ? Colors.white54 : const Color(0xFF9AA0A8);
    final grid = dark ? Colors.white12 : const Color(0xFFE2E6E9);

    return SizedBox(
      height: 220,
      child: LineChart(
        LineChartData(
          minY: 0,
          gridData: FlGridData(
            show: true,
            drawVerticalLine: false,
            getDrawingHorizontalLine: (_) =>
                FlLine(color: grid, strokeWidth: 1),
          ),
          borderData: FlBorderData(show: false),
          titlesData: FlTitlesData(
            topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            leftTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 34,
                getTitlesWidget: (v, meta) => Text(
                  v.toInt().toString(),
                  style: TextStyle(fontSize: 10, color: axisLabel),
                ),
              ),
            ),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                interval: 1,
                getTitlesWidget: (v, meta) {
                  final i = v.toInt();
                  if (i < 0 || i >= days.length) return const SizedBox.shrink();
                  final d = days[i];
                  return Text(
                    d.substring(5),
                    style: TextStyle(fontSize: 10, color: axisLabel),
                  );
                },
              ),
            ),
          ),
          lineTouchData: LineTouchData(
            touchTooltipData: LineTouchTooltipData(
              getTooltipItems: (spots) => spots
                  .map((s) => LineTooltipItem(
                        '${s.y.toInt()} 分钟',
                        const TextStyle(color: Colors.white, fontSize: 12),
                      ))
                  .toList(),
            ),
          ),
          lineBarsData: [
            LineChartBarData(
              spots: spots,
              isCurved: true,
              color: KaoyanColors.primary,
              barWidth: 3,
              dotData: const FlDotData(show: true),
              belowBarData: BarAreaData(
                show: true,
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    KaoyanColors.primary.withValues(alpha: 0.25),
                    KaoyanColors.primary.withValues(alpha: 0.02),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── 各科学习占比（饼图） ──
  Widget _buildSubjectPie(AppStore store) {
    final minutes = store.subjectStudyMinutes;
    final total = minutes.values.fold(0, (a, b) => a + b);
    final sections = <PieChartSectionData>[];
    if (total == 0) {
      return const SizedBox(
        height: 220,
        child: Center(child: Text('暂无学习记录')),
      );
    }
    for (final t in SubjectType.values) {
      final m = minutes[t]!;
      if (m == 0) continue;
      sections.add(PieChartSectionData(
        value: m.toDouble(),
        title: t.shortName,
        color: t.color,
        radius: 56,
        titleStyle: const TextStyle(
            fontSize: 12, color: Colors.white, fontWeight: FontWeight.bold),
      ));
    }
    return SizedBox(
      height: 220,
      child: PieChart(
        PieChartData(
          sections: sections,
          sectionsSpace: 2,
          centerSpaceRadius: 40,
          pieTouchData: PieTouchData(
            touchCallback: (event, response) {},
          ),
        ),
      ),
    );
  }

  // ── 每日番茄数（柱状） ──
  Widget _buildPomodoroChart(AppStore store, BuildContext context) {
    final days = _last7Days;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final axisLabel = dark ? Colors.white54 : const Color(0xFF9AA0A8);
    final grid = dark ? Colors.white12 : const Color(0xFFE2E6E9);

    return SizedBox(
      height: 220,
      child: BarChart(
        BarChartData(
          maxY: _maxPomodoro(store, days).toDouble(),
          gridData: FlGridData(
            show: true,
            drawVerticalLine: false,
            getDrawingHorizontalLine: (_) =>
                FlLine(color: grid, strokeWidth: 1),
          ),
          borderData: FlBorderData(show: false),
          titlesData: FlTitlesData(
            topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            leftTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 34,
                getTitlesWidget: (v, meta) => Text(
                  v.toInt().toString(),
                  style: TextStyle(fontSize: 10, color: axisLabel),
                ),
              ),
            ),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                interval: 1,
                getTitlesWidget: (v, meta) {
                  final i = v.toInt();
                  if (i < 0 || i >= days.length) return const SizedBox.shrink();
                  return Text(days[i].substring(5),
                      style: TextStyle(fontSize: 10, color: axisLabel));
                },
              ),
            ),
          ),
          barGroups: [
            for (var i = 0; i < days.length; i++)
              BarChartGroupData(
                x: i,
                barRods: [
                  BarChartRodData(
                    toY: store.pomodoroRecords
                        .where((r) => r.date == days[i])
                        .length
                        .toDouble(),
                    width: 18,
                    borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(4)),
                    gradient: const LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Color(0xFF84FAB0), Color(0xFF8FD3F4)],
                    ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  int _maxPomodoro(AppStore store, List<String> days) {
    var max = 4;
    for (final d in days) {
      final n = store.pomodoroRecords.where((r) => r.date == d).length;
      if (n > max) max = n;
    }
    return max;
  }

  // ── 各科学习时长（柱状） ──
  Widget _buildSubjectHoursChart(AppStore store, BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final axisLabel = dark ? Colors.white54 : const Color(0xFF9AA0A8);
    final grid = dark ? Colors.white12 : const Color(0xFFE2E6E9);
    final subjects = SubjectType.values;
    final values = [
      for (final t in subjects)
        (store.subjectStudyMinutes[t]! / 60 * 10).round() / 10,
    ];
    final maxY = values.fold<double>(1, (a, b) => b > a ? b : a);

    return SizedBox(
      height: 220,
      child: BarChart(
        BarChartData(
          maxY: maxY,
          gridData: FlGridData(
            show: true,
            drawVerticalLine: false,
            getDrawingHorizontalLine: (_) =>
                FlLine(color: grid, strokeWidth: 1),
          ),
          borderData: FlBorderData(show: false),
          titlesData: FlTitlesData(
            topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            leftTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 34,
                getTitlesWidget: (v, meta) => Text(
                  v.toInt().toString(),
                  style: TextStyle(fontSize: 10, color: axisLabel),
                ),
              ),
            ),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                interval: 1,
                getTitlesWidget: (v, meta) {
                  final i = v.toInt();
                  if (i < 0 || i >= subjects.length) {
                    return const SizedBox.shrink();
                  }
                  return Text(subjects[i].shortName,
                      style: TextStyle(fontSize: 10, color: axisLabel));
                },
              ),
            ),
          ),
          barGroups: [
            for (var i = 0; i < subjects.length; i++)
              BarChartGroupData(
                x: i,
                barRods: [
                  BarChartRodData(
                    toY: values[i],
                    width: 24,
                    borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(4)),
                    color: subjects[i].color,
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  // ── 学习日历（近 90 天热力图） ──
  Widget _buildCalendar(AppStore store, BuildContext context) {
    final now = DateTime.now();
    final days = <({String date, int minutes})>[];
    for (var i = 89; i >= 0; i--) {
      final d = now.subtract(Duration(days: i));
      final date =
          '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
      final minutes = store.pomodoroRecords
          .where((r) => r.date == date)
          .fold(0, (sum, r) => sum + r.duration);
      days.add((date: date, minutes: minutes));
    }

    Color levelColor(int minutes) {
      if (minutes == 0) return KaoyanColors.primary.withValues(alpha: 0.06);
      if (minutes < 60) return KaoyanColors.primary.withValues(alpha: 0.25);
      if (minutes < 120) return KaoyanColors.primary.withValues(alpha: 0.45);
      if (minutes < 240) return KaoyanColors.primary.withValues(alpha: 0.65);
      return KaoyanColors.primary.withValues(alpha: 0.85);
    }

    return GlassContainer.card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('学习日历（近 90 天）',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 16),
            Wrap(
              spacing: 5,
              runSpacing: 5,
              children: [
                for (final d in days)
                  Tooltip(
                    message: '${d.date}: 学习 ${d.minutes} 分钟',
                    child: Container(
                      width: 14,
                      height: 14,
                      decoration: BoxDecoration(
                        color: levelColor(d.minutes),
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Text('少',
                    style: TextStyle(
                        fontSize: 11, color: Theme.of(context).hintColor)),
                for (final m in [0, 60, 120, 240, 400]) ...[
                  const SizedBox(width: 4),
                  Container(
                    width: 14,
                    height: 14,
                    decoration: BoxDecoration(
                      color: levelColor(m),
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                ],
                const SizedBox(width: 4),
                Text('多',
                    style: TextStyle(
                        fontSize: 11, color: Theme.of(context).hintColor)),
              ],
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
