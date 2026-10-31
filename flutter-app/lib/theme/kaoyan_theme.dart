import 'package:flutter/material.dart';

/// 品牌色阶：沿用原 Electron 版的三层彩色光溢出（蓝 / 紫 / 青）。
///
/// 液态玻璃的折射需要「有结构、有明暗」的背景才有内容可折射——
/// 一片纯色 / 单调渐变看不出透镜效果。这些光斑既是品牌色，也是折射的载体。
class KaoyanColors {
  KaoyanColors._();

  static const Color primary = Color(0xFF4A6CF7);
  static const Color purple = Color(0xFF8A4AF7);
  static const Color cyan = Color(0xFF00B0D6);

  /// 深色主题基底（近黑，供光斑叠色）
  static const Color darkBase = Color(0xFF070A13);

  /// 浅色主题基底
  static const Color lightBase = Color(0xFFEAF0FB);
}

/// 液态玻璃的「壁纸」背景：渐变底 + 三个彩色光斑。
///
/// 折射（premium / standard 的 shader）会采样它背后的像素并做位移，
/// 光斑边界越清晰，透镜效果越明显。
class KaoyanWallpaper extends StatelessWidget {
  const KaoyanWallpaper({super.key, required this.dark});

  final bool dark;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: dark
              ? const [
                  KaoyanColors.darkBase,
                  Color(0xFF0B1020),
                  Color(0xFF04060C),
                ]
              : const [
                  KaoyanColors.lightBase,
                  Color(0xFFF4F7FE),
                  Color(0xFFE4ECFB),
                ],
        ),
      ),
      child: Stack(
        children: [
          // 左上蓝光斑
          Positioned(
            left: -80,
            top: -120,
            child: _glow(KaoyanColors.primary, dark ? 0.30 : 0.35, 360),
          ),
          // 右上紫光斑
          Positioned(
            right: -100,
            top: -60,
            child: _glow(KaoyanColors.purple, dark ? 0.24 : 0.28, 300),
          ),
          // 底部青光斑
          Positioned(
            left: 160,
            bottom: -160,
            child: _glow(KaoyanColors.cyan, dark ? 0.16 : 0.22, 380),
          ),
        ],
      ),
    );
  }

  Widget _glow(Color color, double opacity, double size) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: [
              color.withValues(alpha: opacity),
              color.withValues(alpha: 0),
            ],
          ),
        ),
      ),
    );
  }
}
