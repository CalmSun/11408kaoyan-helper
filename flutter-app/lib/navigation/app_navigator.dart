import 'package:flutter/material.dart';

/// 全局 Navigator Key，供非 UI 层（如番茄钟控制器）在计时完成时
/// 弹出全局提示，无论用户当前停留在哪个页面。
final GlobalKey<NavigatorState> appNavigatorKey = GlobalKey<NavigatorState>();
