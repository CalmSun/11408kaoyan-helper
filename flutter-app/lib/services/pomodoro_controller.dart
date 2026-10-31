import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../models/models.dart';
import '../navigation/app_navigator.dart';
import '../utils/date_helper.dart';
import 'app_store.dart';

/// 番茄钟模式
enum PomodoroMode { work, shortBreak, longBreak }

/// 番茄钟全局计时控制器（单例）。
///
/// 状态提升到全局，切换页面不中断计时、不丢失进度（对齐 Electron 版
/// 把计时状态提升到 pinia store 的设计）。计时用绝对时间差计算，避免 Timer 漂移。
class PomodoroController extends ChangeNotifier {
  PomodoroController._();
  static final PomodoroController instance = PomodoroController._();

  // 时长（分钟），默认 25/5/15，长休息间隔 4
  static const int workMinutes = 25;
  static const int shortBreakMinutes = 5;
  static const int longBreakMinutes = 15;
  static const int longBreakInterval = 4;

  PomodoroMode _mode = PomodoroMode.work;
  bool _isRunning = false;
  bool _hasStarted = false;
  SubjectType _subject = SubjectType.cs408;
  int _completedPomodoros = 0;
  int _remainingSeconds = AppStore.instance.pomodoroSettings.workDuration * 60;
  int _totalSeconds = AppStore.instance.pomodoroSettings.workDuration * 60;

  Timer? _timer;
  int _startAt = 0;
  int _remainingAtStart = 0;

  // ── 完成提醒（对齐 Electron pomodoro.ts 的 completeTimer/sendNotification） ──
  int completionEvent = 0; // 每次完成 +1，供 UI 层监听弹窗
  String completionMessage = '';
  bool completionIsWork = false;

  final AudioPlayer _notifyPlayer = AudioPlayer();
  final AudioPlayer _tickPlayer = AudioPlayer();
  int _lastTickSecond = -1;

  PomodoroMode get mode => _mode;
  bool get isRunning => _isRunning;
  bool get hasStarted => _hasStarted;
  SubjectType get subject => _subject;
  int get completedPomodoros => _completedPomodoros;
  int get remainingSeconds => _remainingSeconds;
  int get totalSeconds => _totalSeconds;

  String get modeLabel => switch (_mode) {
        PomodoroMode.work => '专注学习中',
        PomodoroMode.shortBreak => '短暂休息',
        PomodoroMode.longBreak => '长休息',
      };

  double get progress =>
      _totalSeconds == 0 ? 0 : (_totalSeconds - _remainingSeconds) / _totalSeconds;

  int _durationOf(PomodoroMode m) {
    final s = AppStore.instance.pomodoroSettings;
    return switch (m) {
      PomodoroMode.work => s.workDuration * 60,
      PomodoroMode.shortBreak => s.breakDuration * 60,
      PomodoroMode.longBreak => s.longBreakDuration * 60,
    };
  }

  void switchMode(PomodoroMode m) {
    if (_isRunning) pause();
    _mode = m;
    _hasStarted = false;
    _remainingSeconds = _durationOf(m);
    _totalSeconds = _durationOf(m);
    notifyListeners();
  }

  void setSubject(SubjectType s) {
    _subject = s;
    notifyListeners();
  }

  void start() {
    if (_isRunning) return;
    _isRunning = true;
    _hasStarted = true;
    _startAt = DateTime.now().millisecondsSinceEpoch;
    _remainingAtStart = _remainingSeconds;
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
    notifyListeners();
  }

  void pause() {
    _isRunning = false;
    _timer?.cancel();
    _timer = null;
    notifyListeners();
  }

  void reset() {
    pause();
    _hasStarted = false;
    _remainingSeconds = _durationOf(_mode);
    _totalSeconds = _durationOf(_mode);
    notifyListeners();
  }

  void skip() => _complete();

  void _tick() {
    final elapsed =
        (DateTime.now().millisecondsSinceEpoch - _startAt) ~/ 1000;
    final next = (_remainingAtStart - elapsed).clamp(0, 1 << 30);
    if (next != _remainingSeconds) {
      _remainingSeconds = next;
      if (_remainingSeconds == 0) {
        _complete();
        return;
      }
      // 最后 5 秒预警滴声（每秒一次）
      if (_remainingSeconds <= 5 && _remainingSeconds != _lastTickSecond) {
        _lastTickSecond = _remainingSeconds;
        _playTick();
      }
      notifyListeners();
    }
  }

  void _complete() {
    pause();
    final wasWork = _mode == PomodoroMode.work;
    if (wasWork) {
      _addRecord(totalSeconds ~/ 60);
      _completedPomodoros++;
    }
    completionIsWork = wasWork;
    completionMessage = wasWork
        ? _completionMessageFor(_completedPomodoros)
        : '休息结束，开始下一个番茄吧！';
    completionEvent++;
    _playNotificationSound();
    _showCompletionDialog();
    if (wasWork) {
      if (_completedPomodoros %
              AppStore.instance.pomodoroSettings.longBreakInterval ==
          0) {
        switchMode(PomodoroMode.longBreak);
      } else {
        switchMode(PomodoroMode.shortBreak);
      }
    } else {
      switchMode(PomodoroMode.work);
    }
  }

  /// 个性化完成文案（对齐 Electron getCompletionMessage）
  String _completionMessageFor(int n) {
    if (n == 1) return '第一个番茄完成！好的开始是成功的一半 🎉';
    if (n % 12 == 0) return '12 个番茄达成！今天状态爆棚，休息一下 🏆';
    if (n % 8 == 0) return '8 个番茄达成！非常棒，注意劳逸结合 💪';
    if (n % 4 == 0) return '4 个番茄达成！进入长休息，补充能量 ☕';
    return '番茄完成！起来活动一下，休息一下吧 🌟';
  }

  Future<void> _playNotificationSound() async {
    if (!AppStore.instance.pomodoroSettings.enableSound) return;
    try {
      await _notifyPlayer.stop();
      await _notifyPlayer.play(AssetSource('sounds/notification.wav'));
    } catch (_) {}
  }

  Future<void> _playTick() async {
    if (!AppStore.instance.pomodoroSettings.enableSound) return;
    try {
      await _tickPlayer.stop();
      await _tickPlayer.play(AssetSource('sounds/tick.wav'));
    } catch (_) {}
  }

  /// 全局完成弹窗（无论用户停留在哪个页面都能弹出）。
  void _showCompletionDialog() {
    final ctx = appNavigatorKey.currentContext;
    if (ctx == null) return;
    final isWork = completionIsWork;
    final msg = completionMessage;
    showDialog<void>(
      context: ctx,
      builder: (context) => AlertDialog(
        icon: Icon(
          isWork
              ? CupertinoIcons.checkmark_seal_fill
              : CupertinoIcons.arrow_right_circle_fill,
          size: 44,
          color: isWork ? const Color(0xFF34D399) : const Color(0xFF3B82F6),
        ),
        title: Text(isWork ? '番茄完成' : '休息结束'),
        content: Text(msg, textAlign: TextAlign.center),
        actions: [
          FilledButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(isWork ? '开始休息' : '开始专注'),
          ),
        ],
      ),
    );
  }

  Future<void> _addRecord(int durationMinutes) async {
    // 统一走 AppStore，保证 Dashboard / 统计实时响应且持久化口径一致
    await AppStore.instance.addPomodoroRecord(durationMinutes, _subject);
  }

  /// 今日番茄数与学习时长（供页面显示）
  List<PomodoroRecord> get todayRecords {
    final today = todayLocal();
    return AppStore.instance.pomodoroRecords
        .where((r) => r.date == today)
        .toList();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}
