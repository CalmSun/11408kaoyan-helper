import 'package:flutter/material.dart';

import 'screens/app_shell.dart';
import 'services/theme_controller.dart';

/// 应用根组件。
///
/// 采用 MaterialApp 而非 CupertinoApp：原 Electron 版是 Element Plus（Vue）
/// 的 Material 风格，业务组件（表格、表单、对话框）大量依赖 Material 语义。
/// 液态玻璃视觉由 liquid_glass_widgets 的 Glass* 组件单独承载，
/// 二者不冲突（wrap 已通过 brightnessResolver 桥接主题）。
class KaoyanApp extends StatelessWidget {
  const KaoyanApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: ThemeController.instance,
      builder: (context, _) {
        return MaterialApp(
          title: '11408 考研助手',
          debugShowCheckedModeBanner: false,
          theme: ThemeData(
            useMaterial3: true,
            brightness: Brightness.light,
            colorSchemeSeed: const Color(0xFF4A6CF7),
          ),
          darkTheme: ThemeData(
            useMaterial3: true,
            brightness: Brightness.dark,
            colorSchemeSeed: const Color(0xFF4A6CF7),
          ),
          themeMode: ThemeController.instance.mode,
          home: const AppShell(),
        );
      },
    );
  }
}
