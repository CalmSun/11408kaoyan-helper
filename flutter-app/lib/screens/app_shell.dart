import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';

import '../navigation/nav_items.dart';
import '../theme/kaoyan_theme.dart';
import 'home_screen.dart';
import 'countdown_screen.dart';
import 'daily_plan_screen.dart';
import 'pomodoro_screen.dart';
import 'statistics_screen.dart';
import 'outline_screen.dart';
import 'algorithms_screen.dart';
import 'formulas_screen.dart';
import 'exam_scores_screen.dart';
import 'flashcards_screen.dart';
import 'dictionary_screen.dart';
import 'music_screen.dart';
import 'materials_screen.dart';
import 'settings_screen.dart';
import 'placeholder_screen.dart';

/// 应用外壳：响应式导航（桌面侧边栏 / 移动抽屉）+ 内容区。
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isDesktop = constraints.maxWidth >= 768;
        return isDesktop ? _buildDesktop() : _buildMobile();
      },
    );
  }

  // ── 桌面：固定侧边栏 + 内容区 ──
  Widget _buildDesktop() {
    final dark = Theme.of(context).brightness == Brightness.dark;
    // GlassScaffold 不提供 Material 祖先，桌面端无外层 Scaffold，
    // 必须包一层透明 Material，否则 TextField / Chip / Switch 等会报
    // "No Material widget found"。
    return Material(
      type: MaterialType.transparency,
      child: Row(
        children: [
          _SideNav(
            currentIndex: _currentIndex,
            onSelect: (i) => setState(() => _currentIndex = i),
          ),
          Expanded(child: _buildContentScaffold(dark)),
        ],
      ),
    );
  }

  // ── 移动：抽屉导航 + 内容区 ──
  Widget _buildMobile() {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      drawer: Drawer(
        child: _NavList(
          currentIndex: _currentIndex,
          onSelect: (i) {
            setState(() => _currentIndex = i);
            Navigator.of(context).pop();
          },
        ),
      ),
      body: GlassScaffold(
        background: KaoyanWallpaper(dark: dark),
        contentAwareBrightness: true,
        appBar: GlassAppBar(
          title: Text(navItems[_currentIndex].title),
          leading: Builder(
            builder: (context) => GlassIconButton(
              icon: const Icon(CupertinoIcons.bars),
              onPressed: () => Scaffold.of(context).openDrawer(),
            ),
          ),
        ),
        body: _buildPage(),
      ),
    );
  }

  Widget _buildContentScaffold(bool dark) {
    return GlassScaffold(
      background: KaoyanWallpaper(dark: dark),
      contentAwareBrightness: true,
      appBar: GlassAppBar(title: Text(navItems[_currentIndex].title)),
      body: _buildPage(),
    );
  }

  Widget _buildPage() {
    switch (_currentIndex) {
      case 0:
        return HomeScreen(onNavigate: (i) => setState(() => _currentIndex = i));
      case 1:
        return const CountdownScreen();
      case 2:
        return const DailyPlanScreen();
      case 3:
        return const PomodoroScreen();
      case 4:
        return const StatisticsScreen();
      case 5:
        return const OutlineScreen();
      case 6:
        return const AlgorithmsScreen();
      case 7:
        return const FormulasScreen();
      case 8:
        return const ExamScoresScreen();
      case 9:
        return const FlashcardsScreen();
      case 10:
        return const DictionaryScreen();
      case 11:
        return const MusicScreen();
      case 12:
        return const MaterialsScreen();
      case 13:
        return const SettingsScreen();
      default:
        return PlaceholderScreen(title: navItems[_currentIndex].title);
    }
  }
}

/// 桌面端侧边栏：半透明玻璃底色 + 导航项列表。
/// 导航文字必须可读（侧边栏是功能入口，不追求极限通透）。
class _SideNav extends StatelessWidget {
  const _SideNav({required this.currentIndex, required this.onSelect});

  final int currentIndex;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      width: 220,
      decoration: BoxDecoration(
        color: dark
            ? const Color(0xFF0D1424).withValues(alpha: 0.85)
            : const Color(0xFFF4F7FE).withValues(alpha: 0.85),
        border: Border(
          right: BorderSide(
            color: dark
                ? Colors.white.withValues(alpha: 0.08)
                : Colors.black.withValues(alpha: 0.06),
          ),
        ),
      ),
      child: Column(
        children: [
          // 顶部标题
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
            child: Row(
              children: [
                const Icon(
                  CupertinoIcons.book_circle_fill,
                  color: KaoyanColors.primary,
                  size: 26,
                ),
                const SizedBox(width: 10),
                Text(
                  '考研助手',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Theme.of(context).textTheme.titleMedium?.color,
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          // 导航项
          Expanded(
            child: _NavList(
              currentIndex: currentIndex,
              onSelect: onSelect,
              inSideNav: true,
            ),
          ),
        ],
      ),
    );
  }
}

/// 导航项列表（侧边栏与抽屉共用）。
class _NavList extends StatelessWidget {
  const _NavList({
    required this.currentIndex,
    required this.onSelect,
    this.inSideNav = false,
  });

  final int currentIndex;
  final ValueChanged<int> onSelect;
  final bool inSideNav;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: navItems.length,
      itemBuilder: (context, i) {
        final item = navItems[i];
        final selected = i == currentIndex;
        final baseColor =
            Theme.of(context).textTheme.bodyMedium?.color ?? Colors.black;

        return Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () => onSelect(i),
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: selected
                    ? KaoyanColors.primary.withValues(alpha: dark ? 0.22 : 0.12)
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  Icon(
                    item.icon,
                    size: 18,
                    color: selected ? KaoyanColors.primary : baseColor.withValues(alpha: 0.6),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      item.title,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                        color: selected ? KaoyanColors.primary : baseColor,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
