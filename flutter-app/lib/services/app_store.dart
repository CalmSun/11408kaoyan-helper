import 'dart:async';

import 'package:flutter/foundation.dart';

import '../models/models.dart';
import '../utils/date_helper.dart';
import 'storage_service.dart';

/// 全局应用状态（单例 ChangeNotifier），对应 Electron 版的 useMainStore。
///
/// 所有跨页面共享的数据（计划 / 闪卡 / 番茄钟 / 真题 / 进度 / 设置）统一由
/// 这里读写，任何修改都 notifyListeners，供 Dashboard / 统计 / 大纲等页面
/// 实时响应。持久化 key 与 localStorage 完全一致（kaoyan_helper_*），
/// 兼容老版本数据。
class AppStore extends ChangeNotifier {
  AppStore._();
  static final AppStore instance = AppStore._();

  // ── 状态 ──────────────────────────────────────────────
  String examDate = '2026-12-21';
  String examName = '2027年全国硕士研究生招生考试';
  List<PlanItem> plans = [];
  List<Flashcard> flashcards = [];
  List<PomodoroRecord> pomodoroRecords = [];
  List<ExamScoreRecord> examScores = [];
  List<DailyStudyRecord> dailyRecords = [];
  List<DailyPlanSnapshot> planSnapshots = [];
  Map<SubjectType, int> subjectProgress = {
    SubjectType.politics: 0,
    SubjectType.english: 0,
    SubjectType.math: 0,
    SubjectType.cs408: 0,
  };
  PomodoroSettings pomodoroSettings = const PomodoroSettings();
  int appUsageMinutes = 0;
  int _sessionStartAt = DateTime.now().millisecondsSinceEpoch;
  List<Subject> _customSubjects = [];

  bool _initialized = false;
  bool get isInitialized => _initialized;

  Future<void> init() async {
    if (_initialized) return;
    await StorageService.instance.init();
    _loadAll();
    _backfillSnapshots();
    _recordSnapshot();
    _initialized = true;
  }

  /// 账号切换后重新加载当前前缀下的数据（登录 / 登出 / 删除账号）
  Future<void> reload() async {
    _loadAll();
    _backfillSnapshots();
    _recordSnapshot();
    notifyListeners();
  }

  void _loadAll() {
    final s = StorageService.instance;
    examDate = s.getString('examDate') ?? '2026-12-21';
    examName =
        s.getString('examName') ?? '2027年全国硕士研究生招生考试';
    plans = s.getList('plans', PlanItem.fromJson);
    flashcards = s.getList('flashcards', Flashcard.fromJson);
    pomodoroRecords = s.getList('pomodoroRecords', PomodoroRecord.fromJson);
    examScores = s.getList('examScores', ExamScoreRecord.fromJson);
    dailyRecords = s.getList('dailyRecords', DailyStudyRecord.fromJson);
    planSnapshots = s.getList('planSnapshots', DailyPlanSnapshot.fromJson);
    pomodoroSettings = s.getObject('pomodoroSettings', PomodoroSettings.fromJson) ??
        const PomodoroSettings();
    appUsageMinutes = s.getInt('appUsageMinutes');
    _customSubjects = s.getList('customSubjects', Subject.fromJson);
    final sp = s.getObject<Map<String, dynamic>>(
            'subjectProgress', (j) => Map<String, dynamic>.from(j)) ??
        {};
    subjectProgress = {
      for (final t in SubjectType.values) t: (sp[t.id] as num?)?.toInt() ?? 0,
    };
  }

  // ── 派生计算 ──────────────────────────────────────────

  int get daysUntilExam {
    try {
      final e = DateTime.parse(examDate);
      final exam = DateTime(e.year, e.month, e.day);
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final diff = exam.difference(today).inDays;
      return diff > 0 ? diff : 0;
    } catch (_) {
      return 0;
    }
  }

  int get todayStudyMinutes => pomodoroRecords
      .where((r) => r.date == todayLocal())
      .fold(0, (sum, r) => sum + r.duration);

  String get todayStudyHours => (todayStudyMinutes / 60).toStringAsFixed(1);

  int get todayPomodoroCount =>
      pomodoroRecords.where((r) => r.date == todayLocal()).length;

  int get todayPlanCompleted {
    final today = todayLocal();
    return plans.where((p) {
      if (p.recurring) return p.completedDates.contains(today);
      return p.completed && toLocalDate(p.createdAt) == today;
    }).length;
  }

  int get todayPlanTotal {
    final today = todayLocal();
    return plans.where((p) {
      if (p.recurring) return true;
      return toLocalDate(p.createdAt) == today;
    }).length;
  }

  Map<SubjectType, int> get subjectStudyMinutes {
    final stats = {for (final t in SubjectType.values) t: 0};
    for (final r in pomodoroRecords) {
      final t = r.subject;
      if (t != null) stats[t] = stats[t]! + r.duration;
    }
    return stats;
  }

  String get totalStudyHours {
    final minutes = pomodoroRecords.fold(0, (sum, r) => sum + r.duration);
    return (minutes / 60).toStringAsFixed(1);
  }

  String get appUsageHours => (appUsageMinutes / 60).toStringAsFixed(1);

  int get overallProgress {
    if (subjectProgress.isEmpty) return 0;
    final sum = subjectProgress.values.fold(0, (a, b) => a + b);
    return (sum / subjectProgress.length).round();
  }

  // ── 计划 ──────────────────────────────────────────────

  Future<void> addPlan(String title, SubjectType? subject, bool recurring) async {
    plans.insert(
      0,
      PlanItem(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        title: title,
        subject: subject,
        createdAt: DateTime.now().toIso8601String(),
        recurring: recurring,
      ),
    );
    notifyListeners();
    await _savePlans();
    _recordSnapshot();
  }

  Future<void> togglePlan(String id) async {
    final idx = plans.indexWhere((p) => p.id == id);
    if (idx == -1) return;
    final plan = plans[idx];
    final today = todayLocal();
    PlanItem updated;
    if (plan.recurring) {
      final dates = List<String>.from(plan.completedDates);
      dates.contains(today) ? dates.remove(today) : dates.add(today);
      updated = plan.copyWith(
        completed: dates.contains(today),
        completedDates: dates,
      );
    } else {
      updated = plan.copyWith(
        completed: !plan.completed,
        completedAt:
            !plan.completed ? DateTime.now().toIso8601String() : null,
      );
    }
    plans[idx] = updated;
    notifyListeners();
    await _savePlans();
    _recordSnapshot();
  }

  Future<void> deletePlan(String id) async {
    plans.removeWhere((p) => p.id == id);
    notifyListeners();
    await _savePlans();
    _recordSnapshot();
  }

  /// 清除今天已完成的普通计划（非循环），对应 Electron clearCompleted。
  Future<void> clearCompleted() async {
    final today = todayLocal();
    plans = plans.where((p) {
      if (p.recurring) return true;
      return !(p.completed && toLocalDate(p.createdAt) == today);
    }).toList();
    notifyListeners();
    await _savePlans();
    _recordSnapshot();
  }

  Future<void> completeAllToday() async {
    final today = todayLocal();
    plans = plans.map((p) {
      if (p.recurring) {
        if (p.completedDates.contains(today)) return p;
        return p.copyWith(
          completed: true,
          completedDates: [...p.completedDates, today],
        );
      }
      if (p.completed || toLocalDate(p.createdAt) != today) return p;
      return p.copyWith(
        completed: true,
        completedAt: DateTime.now().toIso8601String(),
      );
    }).toList();
    notifyListeners();
    await _savePlans();
    _recordSnapshot();
  }

  // ── 闪卡 ──────────────────────────────────────────────

  Future<void> addFlashcard(String front, String back, String category) async {
    flashcards.insert(
      0,
      Flashcard(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        front: front,
        back: back,
        category: category,
        createdAt: DateTime.now().toIso8601String(),
      ),
    );
    notifyListeners();
    await _saveFlashcards();
  }

  Future<void> updateFlashcard(
    String id, {
    int? reviewCount,
    int? correctCount,
  }) async {
    final idx = flashcards.indexWhere((c) => c.id == id);
    if (idx == -1) return;
    final c = flashcards[idx];
    flashcards[idx] = Flashcard(
      id: c.id,
      front: c.front,
      back: c.back,
      category: c.category,
      createdAt: c.createdAt,
      reviewCount: reviewCount ?? c.reviewCount,
      correctCount: correctCount ?? c.correctCount,
    );
    notifyListeners();
    await _saveFlashcards();
  }

  Future<void> deleteFlashcard(String id) async {
    flashcards.removeWhere((c) => c.id == id);
    notifyListeners();
    await _saveFlashcards();
  }

  // ── 真题成绩 ──────────────────────────────────────────

  Future<void> addExamScore(
      String subject, int year, int score, String remark) async {
    examScores.insert(
      0,
      ExamScoreRecord(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        subject: subject,
        year: year,
        score: score,
        fullScore: subjectById(subject).fullScore,
        remark: remark.isEmpty ? null : remark,
        createdAt: DateTime.now().toIso8601String(),
      ),
    );
    notifyListeners();
    await _saveExamScores();
  }

  Future<void> updateExamScore(
    String id, {
    required String subject,
    required int year,
    required int score,
    required String remark,
  }) async {
    final idx = examScores.indexWhere((r) => r.id == id);
    if (idx == -1) return;
    final r = examScores[idx];
    examScores[idx] = ExamScoreRecord(
      id: r.id,
      subject: subject,
      year: year,
      score: score,
      fullScore: subjectById(subject).fullScore,
      remark: remark.isEmpty ? null : remark,
      createdAt: r.createdAt,
    );
    notifyListeners();
    await _saveExamScores();
  }

  Future<void> deleteExamScore(String id) async {
    examScores.removeWhere((r) => r.id == id);
    notifyListeners();
    await _saveExamScores();
  }

  // ── 番茄钟 ────────────────────────────────────────────

  Future<void> addPomodoroRecord(int duration, SubjectType? subject) async {
    pomodoroRecords.add(PomodoroRecord(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      date: todayLocal(),
      duration: duration,
      subject: subject,
      completedAt: DateTime.now().toIso8601String(),
    ));
    _updateDailyRecord();
    notifyListeners();
    await _savePomodoroRecords();
    await _saveDailyRecords();
  }

  void _updateDailyRecord() {
    final today = todayLocal();
    final todayPomodoros = pomodoroRecords.where((r) => r.date == today).toList();
    final minutes = todayPomodoros.fold(0, (sum, r) => sum + r.duration);
    final idx = dailyRecords.indexWhere((r) => r.date == today);
    if (idx == -1) {
      dailyRecords.add(DailyStudyRecord(
        date: today,
        studyMinutes: minutes,
        pomodoroCount: todayPomodoros.length,
      ));
    } else {
      dailyRecords[idx] = DailyStudyRecord(
        date: today,
        studyMinutes: minutes,
        pomodoroCount: todayPomodoros.length,
        mistakeReviewed: dailyRecords[idx].mistakeReviewed,
        planCompleted: dailyRecords[idx].planCompleted,
        planTotal: dailyRecords[idx].planTotal,
      );
    }
  }

  // ── 科目进度 / 考试日期 / 番茄钟设置 ──────────────────

  Future<void> setSubjectProgress(SubjectType subject, int progress) async {
    subjectProgress[subject] = progress.clamp(0, 100);
    notifyListeners();
    await StorageService.instance.setObject(
        'subjectProgress', {for (final e in subjectProgress.entries) e.key.id: e.value});
  }

  // ── 自定义考试科目 ────────────────────────────────────

  List<Subject> get customSubjects => _customSubjects;

  /// 全部科目（内置 4 科 + 自定义）
  List<Subject> get allSubjects =>
      [...SubjectType.values.map((t) => t.toSubject()), ..._customSubjects];

  Subject subjectById(String id) => allSubjects.firstWhere(
      (s) => s.id == id,
      orElse: () => SubjectType.math.toSubject());

  bool isCustomSubject(String id) => _customSubjects.any((s) => s.id == id);

  Future<void> addCustomSubject(Subject subject) async {
    _customSubjects.add(subject);
    notifyListeners();
    await _saveCustomSubjects();
  }

  Future<void> updateCustomSubject(Subject subject) async {
    final idx = _customSubjects.indexWhere((s) => s.id == subject.id);
    if (idx == -1) return;
    _customSubjects[idx] = subject;
    notifyListeners();
    await _saveCustomSubjects();
  }

  Future<void> removeCustomSubject(String id) async {
    _customSubjects.removeWhere((s) => s.id == id);
    notifyListeners();
    await _saveCustomSubjects();
  }

  Future<void> _saveCustomSubjects() =>
      StorageService.instance.setList('customSubjects', _customSubjects);

  Future<void> setExamDate(String date, {String? name}) async {
    examDate = date;
    if (name != null) examName = name;
    notifyListeners();
    await StorageService.instance.setString('examDate', date);
    await StorageService.instance.setString('examName', examName);
  }

  Future<void> updatePomodoroSettings(PomodoroSettings settings) async {
    pomodoroSettings = settings;
    notifyListeners();
    await StorageService.instance.setObject('pomodoroSettings', settings);
  }

  // ── 应用使用时长 ──────────────────────────────────────

  void recordAppUsage() {
    final elapsed =
        (DateTime.now().millisecondsSinceEpoch - _sessionStartAt) ~/ 60000;
    if (elapsed > 0) {
      appUsageMinutes += elapsed;
      _sessionStartAt = DateTime.now().millisecondsSinceEpoch;
      unawaited(StorageService.instance.setInt('appUsageMinutes', appUsageMinutes));
    }
  }

  // ── 快照 ──────────────────────────────────────────────

  void _recordSnapshot() {
    final today = todayLocal();
    final currentItems = plans
        .where((p) => p.recurring || toLocalDate(p.createdAt) == today)
        .map((p) => DailyPlanSnapshotItem(
              title: p.title,
              subject: p.subject,
              completed:
                  p.recurring ? p.completedDates.contains(today) : p.completed,
              completedAt: p.recurring ? null : p.completedAt,
            ))
        .toList();

    final existingIdx = planSnapshots.indexWhere((s) => s.date == today);
    var items = currentItems;
    if (existingIdx != -1) {
      final currentKeys =
          currentItems.map((i) => '${i.title}__${i.subject?.id ?? ''}').toSet();
      final preserved = planSnapshots[existingIdx].items
          .where((i) =>
              i.completed &&
              !currentKeys.contains('${i.title}__${i.subject?.id ?? ''}'))
          .toList();
      if (preserved.isNotEmpty) items = [...currentItems, ...preserved];
    }

    if (items.isEmpty) return;

    final snapshot = DailyPlanSnapshot(date: today, items: items);
    if (existingIdx != -1) {
      planSnapshots[existingIdx] = snapshot;
    } else {
      planSnapshots.add(snapshot);
    }
    if (planSnapshots.length > 60) {
      planSnapshots
        ..sort((a, b) => b.date.compareTo(a.date))
        ..removeRange(60, planSnapshots.length);
    }
    unawaited(_saveSnapshots());
  }

  void _backfillSnapshots() {
    final now = DateTime.now();
    for (var daysAgo = 1; daysAgo <= 7; daysAgo++) {
      final d = now.subtract(Duration(days: daysAgo));
      final date =
          '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
      if (planSnapshots.any((s) => s.date == date)) continue;
      final dayPlans = plans
          .where((p) => !p.recurring && toLocalDate(p.createdAt) == date)
          .toList();
      if (dayPlans.isEmpty) continue;
      planSnapshots.add(DailyPlanSnapshot(
        date: date,
        items: dayPlans
            .map((p) => DailyPlanSnapshotItem(
                  title: p.title,
                  subject: p.subject,
                  completed: p.completed,
                  completedAt: p.completedAt,
                ))
            .toList(),
      ));
    }
    if (planSnapshots.isNotEmpty) unawaited(_saveSnapshots());
  }

  // ── 持久化 ────────────────────────────────────────────

  Future<void> _savePlans() => StorageService.instance.setList('plans', plans);
  Future<void> _saveFlashcards() =>
      StorageService.instance.setList('flashcards', flashcards);
  Future<void> _savePomodoroRecords() =>
      StorageService.instance.setList('pomodoroRecords', pomodoroRecords);
  Future<void> _saveExamScores() =>
      StorageService.instance.setList('examScores', examScores);
  Future<void> _saveDailyRecords() =>
      StorageService.instance.setList('dailyRecords', dailyRecords);
  Future<void> _saveSnapshots() =>
      StorageService.instance.setList('planSnapshots', planSnapshots);
}
