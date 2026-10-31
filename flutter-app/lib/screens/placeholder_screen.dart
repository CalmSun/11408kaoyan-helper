import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';

/// 占位页：未迁移的 tab 先挂这里，保证应用可运行。
class PlaceholderScreen extends StatelessWidget {
  const PlaceholderScreen({super.key, required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        GlassContainer.card(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              children: [
                const Icon(CupertinoIcons.hammer, size: 40),
                const SizedBox(height: 16),
                Text(title, style: const TextStyle(fontSize: 20)),
                const SizedBox(height: 8),
                Text(
                  '该模块将在 Flutter 迁移阶段逐页接入',
                  style: TextStyle(
                    fontSize: 13,
                    color: Theme.of(context).hintColor,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
