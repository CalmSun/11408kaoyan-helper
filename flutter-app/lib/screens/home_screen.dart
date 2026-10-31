import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';

import '../theme/kaoyan_theme.dart';

/// 首页仪表盘（纯内容，不含外壳；外壳由 AppShell 提供）。
///
/// 液态玻璃分层（官方 SKILL）：滚动内容卡片一律 standard，
/// premium 只给导航栏/英雄表面；玻璃按钮不放进玻璃卡内。
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        _buildHeroCard(context),
        const SizedBox(height: 16),
        _buildStatRow(context),
        const SizedBox(height: 16),
        _buildPlanSection(context),
        const SizedBox(height: 16),
        _buildQuickActions(context),
      ],
    );
  }

  // ── 倒计时 hero 卡（滚动内容 → standard） ──
  Widget _buildHeroCard(BuildContext context) {
    return GlassContainer.card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('距离 2027 考研初试', style: TextStyle(fontSize: 14)),
            const SizedBox(height: 6),
            const Text(
              '58 天',
              style: TextStyle(
                fontSize: 44,
                fontWeight: FontWeight.bold,
                fontFeatures: [FontFeature.tabularFigures()],
              ),
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
  Widget _buildStatRow(BuildContext context) {
    return Row(
      children: [
        _buildStatCard(context, '学习时长', '6h 20m', CupertinoIcons.clock_fill),
        const SizedBox(width: 10),
        _buildStatCard(context, '今日单词', '120', CupertinoIcons.textformat_abc),
        const SizedBox(width: 10),
        _buildStatCard(context, '专注次数', '8', CupertinoIcons.flame_fill),
      ],
    );
  }

  Widget _buildStatCard(
    BuildContext context,
    String label,
    String value,
    IconData icon,
  ) {
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

  // ── 今日计划（分组列表） ──
  Widget _buildPlanSection(BuildContext context) {
    return GlassGroupedSection(
      header: const Text('今日计划'),
      children: [
        GlassListTile(
          leading: const Icon(CupertinoIcons.checkmark_circle_fill),
          title: const Text('高等数学 · 极限与连续'),
          subtitle: const Text('已完成'),
          onTap: () => _showComingSoon(context, '计划详情'),
        ),
        GlassListTile(
          leading: const Icon(CupertinoIcons.circle),
          title: const Text('英语 · 核心词汇 50 个'),
          subtitle: const Text('进行中'),
          onTap: () => _showComingSoon(context, '计划详情'),
        ),
        GlassListTile(
          leading: const Icon(CupertinoIcons.circle),
          title: const Text('专业课 · 数据结构第 3 章'),
          subtitle: const Text('未开始'),
          onTap: () => _showComingSoon(context, '计划详情'),
        ),
      ],
    );
  }

  // ── 快捷入口（圆形玻璃按钮放在页面 platter 上，不放进玻璃卡内） ──
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
            _actionItem(context, CupertinoIcons.timer, '番茄钟'),
            _actionItem(context, CupertinoIcons.textformat_abc, '背单词'),
            _actionItem(context, CupertinoIcons.music_note, '音乐'),
            _actionItem(context, CupertinoIcons.doc_text, '真题'),
          ],
        ),
      ],
    );
  }

  Widget _actionItem(BuildContext context, IconData icon, String label) {
    return Column(
      children: [
        GlassButton(
          icon: Icon(icon),
          onTap: () => _showComingSoon(context, label),
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

  void _showComingSoon(BuildContext context, String name) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('「$name」将在迁移阶段接入')),
    );
  }
}
