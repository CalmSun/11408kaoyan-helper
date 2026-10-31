import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';

import '../models/models.dart';
import '../services/pomodoro_controller.dart';
import '../theme/kaoyan_theme.dart';

/// 番茄钟页面。
///
/// 计时状态由全局 PomodoroController 持有（切换页面不中断），
/// 页面仅负责展示与交互。
class PomodoroScreen extends StatelessWidget {
  const PomodoroScreen({super.key});

  String _formatTime(int seconds) {
    final m = (seconds ~/ 60).toString().padLeft(2, '0');
    final s = (seconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final ctrl = PomodoroController.instance;
    return ListenableBuilder(
      listenable: ctrl,
      builder: (context, _) {
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            _buildModeSwitch(ctrl),
            const SizedBox(height: 20),
            _buildTimerCard(context, ctrl),
            const SizedBox(height: 16),
            _buildSubjectChips(ctrl),
            const SizedBox(height: 16),
            _buildTodayStats(context, ctrl),
            const SizedBox(height: 16),
            _buildTodayRecords(context, ctrl),
          ],
        );
      },
    );
  }

  // ── 模式切换 ──
  Widget _buildModeSwitch(PomodoroController ctrl) {
    final modes = [
      (PomodoroMode.work, '专注'),
      (PomodoroMode.shortBreak, '短休'),
      (PomodoroMode.longBreak, '长休'),
    ];
    return Row(
      children: [
        for (final (mode, label) in modes)
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: ChoiceChip(
                label: Text(label),
                selected: ctrl.mode == mode,
                onSelected: (_) => ctrl.switchMode(mode),
              ),
            ),
          ),
      ],
    );
  }

  // ── 计时圆环 ──
  Widget _buildTimerCard(BuildContext context, PomodoroController ctrl) {
    return GlassContainer.card(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 28),
        child: Column(
          children: [
            SizedBox(
              width: 220,
              height: 220,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  SizedBox(
                    width: 220,
                    height: 220,
                    child: CircularProgressIndicator(
                      value: ctrl.progress,
                      strokeWidth: 10,
                      backgroundColor: Theme.of(context)
                          .colorScheme
                          .surfaceContainerHighest,
                      valueColor: AlwaysStoppedAnimation(
                        ctrl.mode == PomodoroMode.work
                            ? KaoyanColors.primary
                            : KaoyanColors.cyan,
                      ),
                    ),
                  ),
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        _formatTime(ctrl.remainingSeconds),
                        style: const TextStyle(
                          fontSize: 48,
                          fontWeight: FontWeight.bold,
                          fontFeatures: [FontFeature.tabularFigures()],
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        ctrl.modeLabel,
                        style: TextStyle(
                          fontSize: 14,
                          color: Theme.of(context).hintColor,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            // 控制按钮
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                GlassIconButton(
                  icon: Icon(
                    ctrl.isRunning
                        ? CupertinoIcons.pause_fill
                        : CupertinoIcons.play_fill,
                  ),
                  onPressed: () =>
                      ctrl.isRunning ? ctrl.pause() : ctrl.start(),
                ),
                const SizedBox(width: 16),
                GlassIconButton(
                  icon: const Icon(CupertinoIcons.arrow_counterclockwise),
                  onPressed: ctrl.reset,
                ),
                const SizedBox(width: 16),
                GlassIconButton(
                  icon: const Icon(CupertinoIcons.forward_end_fill),
                  onPressed: ctrl.skip,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ── 科目选择 ──
  Widget _buildSubjectChips(PomodoroController ctrl) {
    return Wrap(
      spacing: 8,
      children: [
        for (final s in SubjectType.values)
          ChoiceChip(
            label: Text(s.shortName),
            selected: ctrl.subject == s,
            selectedColor: s.color.withValues(alpha: 0.25),
            onSelected: (_) => ctrl.setSubject(s),
          ),
      ],
    );
  }

  // ── 今日统计 ──
  Widget _buildTodayStats(BuildContext context, PomodoroController ctrl) {
    final records = ctrl.todayRecords;
    final minutes = records.fold<int>(0, (sum, r) => sum + r.duration);
    return GlassContainer.card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Expanded(
              child: _stat(context, CupertinoIcons.flame_fill, '今日番茄', '${records.length}'),
            ),
            Expanded(
              child: _stat(
                context,
                CupertinoIcons.clock_fill,
                '学习时长',
                '${(minutes / 60).toStringAsFixed(1)}h',
              ),
            ),
            Expanded(
              child: _stat(
                context,
                CupertinoIcons.checkmark_seal_fill,
                '累计番茄',
                '${ctrl.completedPomodoros}',
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _stat(
    BuildContext context,
    IconData icon,
    String label,
    String value,
  ) {
    return Column(
      children: [
        Icon(icon, size: 20, color: KaoyanColors.primary),
        const SizedBox(height: 6),
        Text(
          value,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            fontFeatures: [FontFeature.tabularFigures()],
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: TextStyle(fontSize: 11, color: Theme.of(context).hintColor),
        ),
      ],
    );
  }

  // ── 今日记录列表（对应 Electron todayRecords，倒序） ──
  Widget _buildTodayRecords(BuildContext context, PomodoroController ctrl) {
    final records = ctrl.todayRecords.reversed.toList();
    return GlassContainer.card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(CupertinoIcons.list_bullet,
                    size: 18, color: KaoyanColors.primary),
                SizedBox(width: 8),
                Text('今日记录',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              ],
            ),
            const SizedBox(height: 12),
            if (records.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Center(
                  child: Text('今天还没有番茄记录，开始专注吧~',
                      style: TextStyle(color: Theme.of(context).hintColor)),
                ),
              )
            else
              for (final r in records)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    children: [
                      Text(
                        _formatClock(r.completedAt),
                        style: TextStyle(
                            fontSize: 13,
                            color: Theme.of(context).hintColor,
                            fontFeatures: const [FontFeature.tabularFigures()]),
                      ),
                      const SizedBox(width: 12),
                      if (r.subject != null)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: r.subject!.color,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(r.subject!.shortName,
                              style: const TextStyle(
                                  fontSize: 11, color: Colors.white)),
                        ),
                      const Spacer(),
                      Text('${r.duration} 分钟',
                          style: const TextStyle(
                              fontSize: 13, fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
          ],
        ),
      ),
    );
  }

  String _formatClock(String iso) {
    try {
      final d = DateTime.parse(iso).toLocal();
      return '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return '';
    }
  }
}
