import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';

import '../models/models.dart';
import '../services/app_store.dart';
import '../theme/kaoyan_theme.dart';
import '../utils/date_helper.dart';

/// 首页仪表盘（对应 Electron Dashboard.vue）。
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key, this.onNavigate});

  /// 快捷入口点击 → 切换到目标导航项（由 AppShell 提供）
  final ValueChanged<int>? onNavigate;

  @override
  Widget build(BuildContext context) {
    final store = AppStore.instance;
    return ListenableBuilder(
      listenable: store,
      builder: (context, _) {
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            _buildWelcome(context, store),
            const SizedBox(height: 16),
            _buildStatGrid(context, store),
            const SizedBox(height: 16),
            _buildContentGrid(context, store),
            const SizedBox(height: 16),
            _buildQuickAccess(context),
          ],
        );
      },
    );
  }

  // ── 欢迎区 ──
  Widget _buildWelcome(BuildContext context, AppStore store) {
    final hour = DateTime.now().hour;
    final greeting = hour < 6
        ? '夜深了'
        : hour < 9
            ? '早上好'
            : hour < 12
                ? '上午好'
                : hour < 14
                    ? '中午好'
                    : hour < 18
                        ? '下午好'
                        : hour < 22
                            ? '晚上好'
                            : '夜深了';
    final now = DateTime.now();
    const week = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    final todayStr = '${now.year}年${now.month}月${now.day}日';
    final weekDay = week[now.weekday % 7];

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '$greeting，考研人',
                style: const TextStyle(
                    fontSize: 24, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 4),
              Text(
                '$todayStr · $weekDay',
                style:
                    TextStyle(fontSize: 13, color: Theme.of(context).hintColor),
              ),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF3B82F6), Color(0xFF60A5FA)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text('距离考研还有 ',
                  style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.9))),
              Text(
                '${store.daysUntilExam}',
                style: const TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                  height: 1,
                  fontFeatures: [FontFeature.tabularFigures()],
                ),
              ),
              Text(' 天',
                  style: TextStyle(fontSize: 14, color: Colors.white.withValues(alpha: 0.9))),
            ],
          ),
        ),
      ],
    );
  }

  // ── 5 张概览卡 ──
  Widget _buildStatGrid(BuildContext context, AppStore store) {
    final cards = [
      _statCard(context, CupertinoIcons.timer, store.todayStudyHours, '今日学习（小时）',
          const Color(0xFF3B82F6)),
      _statCard(context, CupertinoIcons.paperplane_fill,
          '${store.todayPomodoroCount}', '今日番茄数', const Color(0xFF0EA5E9)),
      _statCard(
          context,
          CupertinoIcons.list_bullet,
          '${store.todayPlanCompleted}/${store.todayPlanTotal}',
          '今日计划完成',
          const Color(0xFF6366F1)),
      _statCard(context, CupertinoIcons.clock_fill, store.totalStudyHours, '累计学习（小时）',
          const Color(0xFF8B5CF6)),
      _statCard(context, CupertinoIcons.desktopcomputer, store.appUsageHours, '应用使用（小时）',
          const Color(0xFF14B8A6)),
    ];
    return LayoutBuilder(builder: (context, constraints) {
      final perRow = constraints.maxWidth > 980
          ? 5
          : constraints.maxWidth > 700
              ? 3
              : 2;
      return _grid(cards, perRow);
    });
  }

  Widget _statCard(BuildContext context, IconData icon, String value, String label,
      Color color) {
    return GlassContainer.card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [color, color.withValues(alpha: 0.6)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, size: 22, color: Colors.white),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    value,
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    label,
                    style: TextStyle(
                        fontSize: 11, color: Theme.of(context).hintColor),
                    maxLines: 1,
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

  // ── 今日计划 + 各科学习时长 ──
  Widget _buildContentGrid(BuildContext context, AppStore store) {
    return LayoutBuilder(builder: (context, constraints) {
      final wide = constraints.maxWidth > 700;
      final plan = _buildPlanCard(context, store);
      final study = _buildStudyCard(context, store);
      if (wide) {
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: plan),
            const SizedBox(width: 16),
            Expanded(child: study),
          ],
        );
      }
      return Column(children: [
        plan,
        const SizedBox(height: 16),
        study,
      ]);
    });
  }

  Widget _buildPlanCard(BuildContext context, AppStore store) {
    final today = todayLocal();
    final todayPlans = store.plans
        .where((p) => p.recurring || toLocalDate(p.createdAt) == today)
        .toList();
    final done = store.todayPlanCompleted;
    final total = store.todayPlanTotal;
    final percent = total == 0 ? 0 : (done / total * 100).round();

    bool completed(PlanItem p) =>
        p.recurring ? p.completedDates.contains(today) : p.completed;

    return GlassContainer.card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(CupertinoIcons.list_bullet,
                    size: 18, color: KaoyanColors.primary),
                const SizedBox(width: 8),
                const Text('今日计划',
                    style:
                        TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                const Spacer(),
                GestureDetector(
                  onTap: () => onNavigate?.call(2),
                  child: const Row(children: [
                    Text('查看全部',
                        style: TextStyle(
                            fontSize: 12, color: KaoyanColors.primary)),
                    Icon(CupertinoIcons.chevron_right,
                        size: 14, color: KaoyanColors.primary),
                  ]),
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (todayPlans.isEmpty)
              _buildPlanEmpty(context)
            else ...[
              // 进度条
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surface,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Column(children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('今日完成进度',
                          style: TextStyle(
                              fontSize: 12,
                              color: Theme.of(context).hintColor)),
                      Text('$done/$total',
                          style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: KaoyanColors.primary)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: percent / 100,
                      minHeight: 8,
                      backgroundColor: Theme.of(context)
                          .colorScheme
                          .surfaceContainerHighest,
                      color: KaoyanColors.primary,
                    ),
                  ),
                ]),
              ),
              const SizedBox(height: 12),
              for (final p in todayPlans.take(5))
                _planItem(context, p, completed(p)),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildPlanEmpty(BuildContext context) {
    return Column(
      children: [
        Icon(CupertinoIcons.doc_text,
            size: 44, color: Theme.of(context).hintColor),
        const SizedBox(height: 8),
        Text('今天还没有计划，去添加一个吧~',
            style: TextStyle(fontSize: 13, color: Theme.of(context).hintColor)),
        const SizedBox(height: 12),
        FilledButton(onPressed: () => onNavigate?.call(2), child: const Text('添加计划')),
      ],
    );
  }

  Widget _planItem(BuildContext context, PlanItem p, bool isDone) {
    return InkWell(
      onTap: () async {
        await AppStore.instance.togglePlan(p.id);
      },
      borderRadius: BorderRadius.circular(10),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        child: Row(
          children: [
            Icon(
              isDone
                  ? CupertinoIcons.checkmark_circle_fill
                  : CupertinoIcons.circle,
              size: 20,
              color: isDone
                  ? KaoyanColors.primary
                  : Theme.of(context).hintColor,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                p.title,
                style: TextStyle(
                  fontSize: 14,
                  decoration: isDone ? TextDecoration.lineThrough : null,
                  color: isDone ? Theme.of(context).hintColor : null,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (p.subject != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: p.subject!.color,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  p.subject!.shortName,
                  style: const TextStyle(fontSize: 11, color: Colors.white),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildStudyCard(BuildContext context, AppStore store) {
    final minutes = store.subjectStudyMinutes;
    final totalMinutes = minutes.values.fold(0, (a, b) => a + b);

    return GlassContainer.card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(CupertinoIcons.clock_fill,
                    size: 18, color: KaoyanColors.primary),
                const SizedBox(width: 8),
                const Text('各科学习时长',
                    style:
                        TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                const Spacer(),
                GestureDetector(
                  onTap: () => onNavigate?.call(4),
                  child: const Row(children: [
                    Text('统计详情',
                        style: TextStyle(
                            fontSize: 12, color: KaoyanColors.primary)),
                    Icon(CupertinoIcons.chevron_right,
                        size: 14, color: KaoyanColors.primary),
                  ]),
                ),
              ],
            ),
            const SizedBox(height: 16),
            for (final s in SubjectType.values) ...[
              if (s != SubjectType.values.first) const SizedBox(height: 16),
              _subjectBar(context, s, minutes[s] ?? 0, totalMinutes),
            ],
            const SizedBox(height: 16),
            Divider(height: 1, color: Theme.of(context).dividerColor),
            const SizedBox(height: 14),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text.rich(TextSpan(
                  text: '累计学习 ',
                  style: TextStyle(fontSize: 12, color: Theme.of(context).hintColor),
                  children: [
                    TextSpan(
                      text: store.totalStudyHours,
                      style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: KaoyanColors.primary),
                    ),
                    TextSpan(
                        text: ' 小时',
                        style: TextStyle(
                            fontSize: 12, color: Theme.of(context).hintColor)),
                  ],
                )),
                Text.rich(TextSpan(
                  text: '今日学习 ',
                  style: TextStyle(fontSize: 12, color: Theme.of(context).hintColor),
                  children: [
                    TextSpan(
                      text: store.todayStudyHours,
                      style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: KaoyanColors.primary),
                    ),
                    TextSpan(
                        text: ' 小时',
                        style: TextStyle(
                            fontSize: 12, color: Theme.of(context).hintColor)),
                  ],
                )),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _subjectBar(BuildContext context, SubjectType s, int minutes, int total) {
    final percent = total == 0 ? 0 : (minutes / total * 100).round();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(color: s.color, shape: BoxShape.circle),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(s.name,
                  style: const TextStyle(fontSize: 13)),
            ),
            Text('${(minutes / 60).toStringAsFixed(1)} h',
                style: TextStyle(
                    fontSize: 12, color: Theme.of(context).hintColor)),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: percent / 100,
            minHeight: 8,
            backgroundColor:
                Theme.of(context).colorScheme.surfaceContainerHighest,
            color: s.color,
          ),
        ),
      ],
    );
  }

  // ── 快捷入口（10 个） ──
  Widget _buildQuickAccess(BuildContext context) {
    final entries = [
      (CupertinoIcons.map_fill, '知识大纲', 5, const Color(0xFF3B82F6)),
      (Icons.memory, '算法模板', 6, const Color(0xFF6366F1)),
      (Icons.functions, '公式速查', 7, const Color(0xFF14B8A6)),
      (CupertinoIcons.timer, '番茄钟', 3, const Color(0xFF8B5CF6)),
      (CupertinoIcons.chart_pie_fill, '真题成绩', 8, const Color(0xFF8B5CF6)),
      (CupertinoIcons.rectangle_stack_fill, '背诵卡片', 9, const Color(0xFF0EA5E9)),
      (CupertinoIcons.book_fill, '单词词典', 10, const Color(0xFF8B5CF6)),
      (CupertinoIcons.chart_bar_fill, '学习统计', 4, const Color(0xFF14B8A6)),
      (CupertinoIcons.music_note, '音乐播放', 11, const Color(0xFFEC4899)),
      (CupertinoIcons.folder_fill, '学习资料', 12, const Color(0xFFF59E0B)),
    ];
    return GlassContainer.card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(children: [
              Icon(CupertinoIcons.bolt_fill,
                  size: 18, color: KaoyanColors.primary),
              SizedBox(width: 8),
              Text('快捷入口',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            ]),
            const SizedBox(height: 16),
            LayoutBuilder(builder: (context, constraints) {
              final perRow = constraints.maxWidth > 900
                  ? 10
                  : constraints.maxWidth > 600
                      ? 5
                      : 4;
              return _grid([
                for (final e in entries)
                  _quickItem(context, e.$1, e.$2, e.$3, e.$4),
              ], perRow);
            }),
          ],
        ),
      ),
    );
  }

  Widget _quickItem(
      BuildContext context, IconData icon, String label, int index, Color color) {
    return InkWell(
      onTap: () => onNavigate?.call(index),
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Column(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [color, color.withValues(alpha: 0.6)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, size: 24, color: Colors.white),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: TextStyle(fontSize: 11, color: Theme.of(context).hintColor),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  // ── 自适应网格 ──
  Widget _grid(List<Widget> items, int perRow) {
    final rows = <Widget>[];
    for (var i = 0; i < items.length; i += perRow) {
      final rowItems = <Widget>[];
      for (var j = i; j < i + perRow && j < items.length; j++) {
        if (rowItems.isNotEmpty) rowItems.add(const SizedBox(width: 12));
        rowItems.add(Expanded(child: items[j]));
      }
      // 补齐末行空位
      final remaining = i + perRow - items.length;
      if (remaining > 0) {
        for (var k = 0; k < remaining; k++) {
          if (rowItems.isNotEmpty) rowItems.add(const SizedBox(width: 12));
          rowItems.add(const Expanded(child: SizedBox()));
        }
      }
      if (rows.isNotEmpty) rows.add(const SizedBox(height: 12));
      rows.add(Row(children: rowItems));
    }
    return Column(children: rows);
  }
}
