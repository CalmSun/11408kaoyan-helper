import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';

import '../services/app_store.dart';
import '../theme/kaoyan_theme.dart';
import '../utils/date_helper.dart';

/// 首页仪表盘（真实数据，对应 Electron Dashboard.vue）。
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
            _buildHeroCard(context, store),
            const SizedBox(height: 16),
            _buildStatRow(context, store),
            const SizedBox(height: 16),
            _buildPlanSection(context, store),
            const SizedBox(height: 16),
            _buildQuickActions(context),
          ],
        );
      },
    );
  }

  // ── 倒计时 hero 卡 ──
  Widget _buildHeroCard(BuildContext context, AppStore store) {
    return GlassContainer.card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('距离 2027 考研初试',
                style: TextStyle(
                    fontSize: 14, color: Theme.of(context).hintColor)),
            const SizedBox(height: 6),
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(
                  '${store.daysUntilExam}',
                  style: const TextStyle(
                    fontSize: 44,
                    fontWeight: FontWeight.bold,
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
                const SizedBox(width: 4),
                const Text('天', style: TextStyle(fontSize: 16)),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              '今天也要加油',
              style: TextStyle(fontSize: 13, color: Theme.of(context).hintColor),
            ),
          ],
        ),
      ),
    );
  }

  // ── 今日统计三卡 ──
  Widget _buildStatRow(BuildContext context, AppStore store) {
    return Row(
      children: [
        _buildStatCard(context, '学习时长', '${store.todayStudyHours}h',
            CupertinoIcons.clock_fill),
        const SizedBox(width: 10),
        _buildStatCard(context, '专注次数', '${store.todayPomodoroCount}',
            CupertinoIcons.flame_fill),
        const SizedBox(width: 10),
        _buildStatCard(
            context,
            '计划完成',
            '${store.todayPlanCompleted}/${store.todayPlanTotal}',
            CupertinoIcons.checkmark_seal_fill),
      ],
    );
  }

  Widget _buildStatCard(
      BuildContext context, String label, String value, IconData icon) {
    return Expanded(
      child: GlassContainer.card(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
          child: Column(
            children: [
              Icon(icon, size: 20, color: KaoyanColors.primary),
              const SizedBox(height: 8),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  fontFeatures: [FontFeature.tabularFigures()],
                ),
              ),
              const SizedBox(height: 2),
              Text(
                label,
                style: TextStyle(
                  fontSize: 11,
                  color: Theme.of(context).hintColor,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── 今日计划（真实数据，最多 4 条） ──
  Widget _buildPlanSection(BuildContext context, AppStore store) {
    final today = todayLocal();
    final todayPlans = store.plans
        .where((p) => p.recurring || toLocalDate(p.createdAt) == today)
        .take(4)
        .toList();
    final done = store.todayPlanCompleted;

    if (todayPlans.isEmpty) {
      return GlassGroupedSection(
        header: const Text('今日计划'),
        children: [
          GlassListTile(
            leading: const Icon(CupertinoIcons.checkmark_seal),
            title: const Text('今天还没有计划'),
            subtitle: const Text('去「每日计划」添加一个吧'),
            onTap: () => onNavigate?.call(2),
          ),
        ],
      );
    }

    return GlassGroupedSection(
      header: Text('今日计划（$done/${store.todayPlanTotal}）'),
      children: [
        for (final p in todayPlans)
          GlassListTile(
            leading: Icon(
              (p.recurring
                      ? p.completedDates.contains(today)
                      : p.completed)
                  ? CupertinoIcons.checkmark_circle_fill
                  : CupertinoIcons.circle,
              color: (p.recurring
                      ? p.completedDates.contains(today)
                      : p.completed)
                  ? KaoyanColors.primary
                  : Theme.of(context).hintColor,
            ),
            title: Text(
              p.title,
              style: TextStyle(
                decoration: (p.recurring
                        ? p.completedDates.contains(today)
                        : p.completed)
                    ? TextDecoration.lineThrough
                    : null,
              ),
            ),
            subtitle: p.subject != null
                ? Text(p.subject!.shortName)
                : null,
            onTap: () => onNavigate?.call(2),
          ),
      ],
    );
  }

  // ── 快捷入口 ──
  Widget _buildQuickActions(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 12),
          child: Text(
            '快捷入口',
            style: TextStyle(
              fontSize: 13,
              color: Theme.of(context).hintColor,
            ),
          ),
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _actionItem(context, CupertinoIcons.timer, '番茄钟', 3),
            _actionItem(context, CupertinoIcons.book_fill, '背单词', 10),
            _actionItem(context, CupertinoIcons.music_note, '音乐', 11),
            _actionItem(context, CupertinoIcons.doc_text, '真题', 8),
          ],
        ),
      ],
    );
  }

  Widget _actionItem(
      BuildContext context, IconData icon, String label, int index) {
    return Column(
      children: [
        GlassButton(
          icon: Icon(icon),
          onTap: () => onNavigate?.call(index),
        ),
        const SizedBox(height: 8),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: Theme.of(context).hintColor,
          ),
        ),
      ],
    );
  }
}
