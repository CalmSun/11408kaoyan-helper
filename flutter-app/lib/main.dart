import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';

import 'app.dart';
import 'services/storage_service.dart';

/// 应用入口。
///
/// 两条硬性规则（来自 liquid_glass_widgets 官方 SKILL）：
/// 1. 必须在 runApp 之前 `await LiquidGlassWidgets.initialize()` 预热片段着色器，
///    否则首帧会白闪 / 着色器卡顿。
/// 2. 必须用 `LiquidGlassWidgets.wrap()` 包裹应用，否则主题与无障碍缩放不生效。
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await LiquidGlassWidgets.initialize();
  // 本地存储（shared_preferences）初始化，供各模块读写学习数据
  await StorageService.instance.init();

  runApp(
    LiquidGlassWidgets.wrap(
      // 自动基准测试设备光栅预算，慢设备自动降级质量
      adaptiveQuality: true,
      // 系统「减弱动态 / 降低透明度」开启时自动降级
      respectSystemAccessibility: true,
      // MaterialApp 用户必须提供，桥接 Material 的亮暗主题
      brightnessResolver: Theme.maybeBrightnessOf,
      // 全局玻璃默认值（浅色 / 深色共用同一套，叠加库内置的分模式默认）
      theme: GlassThemeData.simple(
        blur: 12,
        thickness: 25,
        quality: GlassQuality.standard,
      ),
      child: const KaoyanApp(),
    ),
  );
}
