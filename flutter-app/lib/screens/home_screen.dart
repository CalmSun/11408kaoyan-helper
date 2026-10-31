import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';

import '../theme/kaoyan_theme.dart';
import 'placeholder_screen.dart';

/// 首页仪表盘。
///
/// 液态玻璃分层原则（官方 SKILL）：
/// - 导航栏 / 底栏：GlassScaffold 自动提升为 premium（持久表面，可吃满 shader）
/// - 滚动内容卡片：一律 standard（premium 在滚动列表内会渲染错乱）
/// - 玻璃控件（GlassButton / GlassIconButton）不放进玻璃卡片内（禁止折射嵌套）
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedTab = 0;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;

    return GlassScaffold(
      // 壁纸背景：光斑是折射的载体
      background: KaoyanWallpaper(dark: dark),
      contentAwareBrightness: true,

      appBar: GlassAppBar(
        title: const Text('11408 考研助手'),
        actions: [
          // 注意：GlassIconButton 用 onPressed，不是 onTap
          GlassIconButton(
            icon: const Icon(CupertinoIcons.bell_fill),
            onPressed: () => _showComingSoon('通知'),
          ),
        ],
      ),

      bottomBar: GlassTabBar.bottom(
        selectedIndex: _selectedTab,
        onTabSelected: (index) => setState(() => _selectedTab = index),
        tabs: const [
          GlassTab(icon: Icon(CupertinoIcons.house_fill), label: '首页'),
          GlassTab(icon: Icon(CupertinoIcons.chart_bar_fill), label: '统计'),
          GlassTab(icon: Icon(CupertinoIcons.book_fill), label: '资料'),
          GlassTab(icon: Icon(CupertinoIcons.gear_alt_fill), label: '设置'),
        ],
      ),

      body: switch (_selectedTab) {
        0 => _buildHome(dark),
        1 => const PlaceholderScreen(title: '数据统计'),
        2 => const PlaceholderScreen(title: '学习资料'),
        _ => const PlaceholderScreen(title: '设置'),
      },
    );
  }

  Widget _buildHome(bool dark) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        _buildHeroCard(),
        const SizedBox(height: 16),
        _buildStatRow(),
        const SizedBox(height: 16),
        _buildPlanSection(),
        const SizedBox(height: 16),
        _buildQuickActions(),
      ],
    );
  }

  // ── 倒计时 hero 卡（滚动内容 → standard） ──
  Widget _buildHeroCard() {
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
  Widget _buildStatRow() {
    return Row(
      children: [
        _buildStatCard('学习时长', '6h 20m', CupertinoIcons.clock_fill),
        const SizedBox(width: 10),
        _buildStatCard('今日单词', '120', CupertinoIcons.textformat_abc),
        const SizedBox(width: 10),
        _buildStatCard('专注次数', '8', CupertinoIcons.flame_fill),
      ],
    );
  }

  Widget _buildStatCard(String label, String value, IconData icon) {
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
  Widget _buildPlanSection() {
    return GlassGroupedSection(
      header: const Text('今日计划'),
      children: [
        GlassListTile(
          leading: const Icon(CupertinoIcons.checkmark_circle_fill),
          title: const Text('高等数学 · 极限与连续'),
          subtitle: const Text('已完成'),
          onTap: () {},
        ),
        GlassListTile(
          leading: const Icon(CupertinoIcons.circle),
          title: const Text('英语 · 核心词汇 50 个'),
          subtitle: const Text('进行中'),
          onTap: () {},
        ),
        GlassListTile(
          leading: const Icon(CupertinoIcons.circle),
          title: const Text('专业课 · 数据结构第 3 章'),
          subtitle: const Text('未开始'),
          onTap: () {},
        ),
      ],
    );
  }

  // ── 快捷入口（圆形玻璃按钮放在页面 platter 上，不放进玻璃卡内，
  //    避免折射玻璃嵌套折射玻璃；label 仅作无障碍语义，可见文字用下方 Text） ──
  Widget _buildQuickActions() {
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
            _actionItem(
              CupertinoIcons.timer,
              '番茄钟',
              () => _showComingSoon('番茄钟'),
            ),
            _actionItem(
              CupertinoIcons.textformat_abc,
              '背单词',
              () => _showComingSoon('单词'),
            ),
            _actionItem(
              CupertinoIcons.music_note,
              '音乐',
              () => _showComingSoon('音乐'),
            ),
            _actionItem(
              CupertinoIcons.doc_text,
              '真题',
              () => _showComingSoon('真题'),
            ),
          ],
        ),
      ],
    );
  }

  Widget _actionItem(IconData icon, String label, VoidCallback onTap) {
    return Column(
      children: [
        GlassButton(
          icon: Icon(icon),
          onTap: onTap,
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

  void _showComingSoon(String name) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('「$name」将在迁移阶段接入')),
    );
  }
}
