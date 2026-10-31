import 'package:flutter/material.dart';

import 'storage_service.dart';

/// 主题模式控制器（浅色 / 深色 / 跟随系统），持久化到 themeMode。
class ThemeController extends ChangeNotifier {
  ThemeController._();
  static final ThemeController instance = ThemeController._();

  ThemeMode _mode = ThemeMode.system;
  ThemeMode get mode => _mode;

  bool get isDark =>
      _mode == ThemeMode.dark ||
      (_mode == ThemeMode.system &&
          WidgetsBinding.instance.platformDispatcher.platformBrightness ==
              Brightness.dark);

  void load() {
    final v = StorageService.instance.getString('themeMode');
    _mode = switch (v) {
      'dark' => ThemeMode.dark,
      'light' => ThemeMode.light,
      _ => ThemeMode.system,
    };
  }

  Future<void> setMode(ThemeMode m) async {
    _mode = m;
    notifyListeners();
    await StorageService.instance.setString(
      'themeMode',
      switch (m) {
        ThemeMode.dark => 'dark',
        ThemeMode.light => 'light',
        ThemeMode.system => 'system',
      },
    );
  }
}
