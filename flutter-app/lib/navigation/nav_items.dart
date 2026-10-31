import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

/// 导航项配置：与 Electron 版 SideNav.vue 的菜单一一对应。
class NavItem {
  const NavItem(this.path, this.title, this.icon);

  final String path;
  final String title;
  final IconData icon;
}

const List<NavItem> navItems = [
  NavItem('/dashboard', '首页仪表盘', CupertinoIcons.house_fill),
  NavItem('/countdown', '考研倒计时', CupertinoIcons.alarm_fill),
  NavItem('/plan', '每日计划', CupertinoIcons.list_bullet),
  NavItem('/pomodoro', '番茄钟', CupertinoIcons.timer),
  NavItem('/statistics', '数据统计', CupertinoIcons.chart_bar_fill),
  NavItem('/outline', '知识大纲', CupertinoIcons.map_fill),
  NavItem('/algorithms', '算法模板库', Icons.memory),
  NavItem('/formulas', '公式速查', Icons.functions),
  NavItem('/examscores', '真题成绩', CupertinoIcons.chart_pie_fill),
  NavItem('/flashcards', '背诵卡片', CupertinoIcons.rectangle_stack_fill),
  NavItem('/dictionary', '单词词典', CupertinoIcons.book_fill),
  NavItem('/music', '音乐播放', CupertinoIcons.music_note),
  NavItem('/materials', '学习资料', CupertinoIcons.folder_fill),
  NavItem('/settings', '设置', CupertinoIcons.gear_alt_fill),
];
