import 'dart:async';

import 'package:flutter/foundation.dart';

import '../models/models.dart';
import '../utils/date_helper.dart';
import 'storage_service.dart';

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
  int _remainingSeconds = workMinutes * 60;
  int _totalSeconds = workMinutes * 60;

  Timer? _timer;
  int _startAt = 0;
  int _remainingAtStart = 0;

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

  int _durationOf(PomodoroMode m) => switch (m) {
        PomodoroMode.work => workMinutes * 60,
        PomodoroMode.shortBreak => shortBreakMinutes * 60,
        PomodoroMode.longBreak => longBreakMinutes * 60,
      };

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
      notifyListeners();
    }
  }

  void _complete() {
    pause();
    if (_mode == PomodoroMode.work) {
      _addRecord(totalSeconds ~/ 60);
      _completedPomodoros++;
      if (_completedPomodoros % longBreakInterval == 0) {
        switchMode(PomodoroMode.longBreak);
      } else {
        switchMode(PomodoroMode.shortBreak);
      }
    } else {
      switchMode(PomodoroMode.work);
    }
  }

  Future<void> _addRecord(int durationMinutes) async {
    final records = StorageService.instance
        .getList<PomodoroRecord>('pomodoroRecords', PomodoroRecord.fromJson);
    final record = PomodoroRecord(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      date: todayLocal(),
      duration: durationMinutes,
      subject: _subject,
      completedAt: DateTime.now().toIso8601String(),
    );
    records.add(record);
    await StorageService.instance.setList('pomodoroRecords', records);
  }

  /// 今日番茄数与学习时长（供页面显示）
  List<PomodoroRecord> get todayRecords {
    final today = todayLocal();
    return StorageService.instance
        .getList<PomodoroRecord>('pomodoroRecords', PomodoroRecord.fromJson)
        .where((r) => r.date == today)
        .toList();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}
