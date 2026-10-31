import 'package:flutter/material.dart';

/// 数据模型层：与 Electron 版（src/renderer/src/stores/index.ts）的 TS 接口一一对应。
/// 日期字段沿用字符串（ISO 时间戳或 YYYY-MM-DD），与旧数据格式兼容，
/// 需要运算时再 parse，避免时区错位。

/// 考研科目（11408）
enum SubjectType {
  politics('politics', '政治', '政治', Color(0xFFF87171)),
  english('english', '英语一', '英语', Color(0xFF34D399)),
  math('math', '数学一', '数学', Color(0xFFFBBF24)),
  cs408('cs408', '408 计算机专业基础', '408', Color(0xFF3B82F6));

  const SubjectType(this.id, this.name, this.shortName, this.color);

  final String id;
  final String name;
  final String shortName;
  final Color color;

  static SubjectType? fromId(String? id) {
    if (id == null) return null;
    for (final s in SubjectType.values) {
      if (s.id == id) return s;
    }
    return null;
  }
}

/// 各科满分（408 满分 150）
const Map<SubjectType, int> subjectFullScore = {
  SubjectType.politics: 100,
  SubjectType.english: 100,
  SubjectType.math: 150,
  SubjectType.cs408: 150,
};

/// 学习计划项
class PlanItem {
  const PlanItem({
    required this.id,
    required this.title,
    this.subject,
    this.completed = false,
    required this.createdAt,
    this.completedAt,
    this.recurring = false,
    this.completedDates = const [],
  });

  final String id;
  final String title;
  final SubjectType? subject;
  final bool completed;
  final String createdAt;
  final String? completedAt;
  final bool recurring;
  final List<String> completedDates;

  PlanItem copyWith({
    String? title,
    SubjectType? subject,
    bool? completed,
    String? completedAt,
    bool? recurring,
    List<String>? completedDates,
  }) {
    return PlanItem(
      id: id,
      title: title ?? this.title,
      subject: subject ?? this.subject,
      completed: completed ?? this.completed,
      createdAt: createdAt,
      completedAt: completedAt ?? this.completedAt,
      recurring: recurring ?? this.recurring,
      completedDates: completedDates ?? this.completedDates,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'subject': subject?.id,
        'completed': completed,
        'createdAt': createdAt,
        'completedAt': completedAt,
        'recurring': recurring,
        'completedDates': completedDates,
      };

  factory PlanItem.fromJson(Map<String, dynamic> j) => PlanItem(
        id: j['id'] as String,
        title: j['title'] as String,
        subject: SubjectType.fromId(j['subject'] as String?),
        completed: j['completed'] as bool? ?? false,
        createdAt: j['createdAt'] as String? ?? '',
        completedAt: j['completedAt'] as String?,
        recurring: j['recurring'] as bool? ?? false,
        completedDates: (j['completedDates'] as List?)?.cast<String>() ?? const [],
      );
}

/// 每日计划快照项
class DailyPlanSnapshotItem {
  const DailyPlanSnapshotItem({
    required this.title,
    this.subject,
    this.completed = false,
    this.completedAt,
  });

  final String title;
  final SubjectType? subject;
  final bool completed;
  final String? completedAt;

  Map<String, dynamic> toJson() => {
        'title': title,
        'subject': subject?.id,
        'completed': completed,
        'completedAt': completedAt,
      };

  factory DailyPlanSnapshotItem.fromJson(Map<String, dynamic> j) =>
      DailyPlanSnapshotItem(
        title: j['title'] as String,
        subject: SubjectType.fromId(j['subject'] as String?),
        completed: j['completed'] as bool? ?? false,
        completedAt: j['completedAt'] as String?,
      );
}

/// 每日计划快照（某一天全部计划的完成状态）
class DailyPlanSnapshot {
  const DailyPlanSnapshot({required this.date, required this.items});

  final String date; // YYYY-MM-DD
  final List<DailyPlanSnapshotItem> items;

  Map<String, dynamic> toJson() => {
        'date': date,
        'items': items.map((e) => e.toJson()).toList(),
      };

  factory DailyPlanSnapshot.fromJson(Map<String, dynamic> j) => DailyPlanSnapshot(
        date: j['date'] as String,
        items: (j['items'] as List? ?? const [])
            .map((e) => DailyPlanSnapshotItem.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

/// 闪卡
class Flashcard {
  const Flashcard({
    required this.id,
    required this.front,
    required this.back,
    required this.category,
    required this.createdAt,
    this.reviewCount = 0,
    this.correctCount = 0,
  });

  final String id;
  final String front;
  final String back;
  final String category;
  final String createdAt;
  final int reviewCount;
  final int correctCount;

  Map<String, dynamic> toJson() => {
        'id': id,
        'front': front,
        'back': back,
        'category': category,
        'createdAt': createdAt,
        'reviewCount': reviewCount,
        'correctCount': correctCount,
      };

  factory Flashcard.fromJson(Map<String, dynamic> j) => Flashcard(
        id: j['id'] as String,
        front: j['front'] as String,
        back: j['back'] as String,
        category: j['category'] as String? ?? '',
        createdAt: j['createdAt'] as String? ?? '',
        reviewCount: j['reviewCount'] as int? ?? 0,
        correctCount: j['correctCount'] as int? ?? 0,
      );
}

/// 番茄钟记录
class PomodoroRecord {
  const PomodoroRecord({
    required this.id,
    required this.date,
    required this.duration,
    this.subject,
    required this.completedAt,
  });

  final String id;
  final String date;
  final int duration; // 分钟
  final SubjectType? subject;
  final String completedAt;

  Map<String, dynamic> toJson() => {
        'id': id,
        'date': date,
        'duration': duration,
        'subject': subject?.id,
        'completedAt': completedAt,
      };

  factory PomodoroRecord.fromJson(Map<String, dynamic> j) => PomodoroRecord(
        id: j['id'] as String,
        date: j['date'] as String? ?? '',
        duration: j['duration'] as int? ?? 0,
        subject: SubjectType.fromId(j['subject'] as String?),
        completedAt: j['completedAt'] as String? ?? '',
      );
}

/// 每日学习记录
class DailyStudyRecord {
  const DailyStudyRecord({
    required this.date,
    this.studyMinutes = 0,
    this.pomodoroCount = 0,
    this.mistakeReviewed = 0,
    this.planCompleted = 0,
    this.planTotal = 0,
  });

  final String date;
  final int studyMinutes;
  final int pomodoroCount;
  final int mistakeReviewed;
  final int planCompleted;
  final int planTotal;

  Map<String, dynamic> toJson() => {
        'date': date,
        'studyMinutes': studyMinutes,
        'pomodoroCount': pomodoroCount,
        'mistakeReviewed': mistakeReviewed,
        'planCompleted': planCompleted,
        'planTotal': planTotal,
      };

  factory DailyStudyRecord.fromJson(Map<String, dynamic> j) => DailyStudyRecord(
        date: j['date'] as String,
        studyMinutes: j['studyMinutes'] as int? ?? 0,
        pomodoroCount: j['pomodoroCount'] as int? ?? 0,
        mistakeReviewed: j['mistakeReviewed'] as int? ?? 0,
        planCompleted: j['planCompleted'] as int? ?? 0,
        planTotal: j['planTotal'] as int? ?? 0,
      );
}

/// 11408 知识大纲节点（树形）
class OutlineNode {
  const OutlineNode({
    required this.id,
    required this.subject,
    required this.title,
    this.children = const [],
    this.progress = 0,
    this.notes,
  });

  final String id;
  final SubjectType subject;
  final String title;
  final List<OutlineNode> children;
  final int progress; // 0-100
  final String? notes;

  Map<String, dynamic> toJson() => {
        'id': id,
        'subject': subject.id,
        'title': title,
        'children': children.map((e) => e.toJson()).toList(),
        'progress': progress,
        'notes': notes,
      };

  factory OutlineNode.fromJson(Map<String, dynamic> j) => OutlineNode(
        id: j['id'] as String,
        subject: SubjectType.fromId(j['subject'] as String?) ?? SubjectType.math,
        title: j['title'] as String,
        children: (j['children'] as List? ?? const [])
            .map((e) => OutlineNode.fromJson(e as Map<String, dynamic>))
            .toList(),
        progress: j['progress'] as int? ?? 0,
        notes: j['notes'] as String?,
      );
}

/// 算法模板
class AlgorithmTemplate {
  const AlgorithmTemplate({
    required this.id,
    required this.name,
    required this.category,
    required this.subject,
    required this.description,
    required this.code,
    required this.timeComplexity,
    required this.spaceComplexity,
    this.tags = const [],
  });

  final String id;
  final String name;
  final String category;
  final SubjectType subject;
  final String description;
  final String code;
  final String timeComplexity;
  final String spaceComplexity;
  final List<String> tags;

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'category': category,
        'subject': subject.id,
        'description': description,
        'code': code,
        'timeComplexity': timeComplexity,
        'spaceComplexity': spaceComplexity,
        'tags': tags,
      };

  factory AlgorithmTemplate.fromJson(Map<String, dynamic> j) => AlgorithmTemplate(
        id: j['id'] as String,
        name: j['name'] as String,
        category: j['category'] as String? ?? '',
        subject: SubjectType.fromId(j['subject'] as String?) ?? SubjectType.cs408,
        description: j['description'] as String? ?? '',
        code: j['code'] as String? ?? '',
        timeComplexity: j['timeComplexity'] as String? ?? '',
        spaceComplexity: j['spaceComplexity'] as String? ?? '',
        tags: (j['tags'] as List?)?.cast<String>() ?? const [],
      );
}

/// 公式 / 核心概念
class FormulaItem {
  const FormulaItem({
    required this.id,
    required this.name,
    required this.subject,
    required this.category,
    required this.content,
    required this.description,
    this.example,
  });

  final String id;
  final String name;
  final SubjectType subject;
  final String category;
  final String content;
  final String description;
  final String? example;

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'subject': subject.id,
        'category': category,
        'content': content,
        'description': description,
        'example': example,
      };

  factory FormulaItem.fromJson(Map<String, dynamic> j) => FormulaItem(
        id: j['id'] as String,
        name: j['name'] as String,
        subject: SubjectType.fromId(j['subject'] as String?) ?? SubjectType.math,
        category: j['category'] as String? ?? '',
        content: j['content'] as String? ?? '',
        description: j['description'] as String? ?? '',
        example: j['example'] as String?,
      );
}

/// 历年真题分数记录
class ExamScoreRecord {
  const ExamScoreRecord({
    required this.id,
    required this.subject,
    required this.year,
    required this.score,
    required this.fullScore,
    this.remark,
    required this.createdAt,
  });

  final String id;
  final SubjectType subject;
  final int year;
  final int score;
  final int fullScore;
  final String? remark;
  final String createdAt;

  Map<String, dynamic> toJson() => {
        'id': id,
        'subject': subject.id,
        'year': year,
        'score': score,
        'fullScore': fullScore,
        'remark': remark,
        'createdAt': createdAt,
      };

  factory ExamScoreRecord.fromJson(Map<String, dynamic> j) => ExamScoreRecord(
        id: j['id'] as String,
        subject: SubjectType.fromId(j['subject'] as String?) ?? SubjectType.math,
        year: j['year'] as int? ?? 0,
        score: j['score'] as int? ?? 0,
        fullScore: j['fullScore'] as int? ?? 150,
        remark: j['remark'] as String?,
        createdAt: j['createdAt'] as String? ?? '',
      );
}

/// 番茄钟设置（对应 Electron pomodoroSettings）
class PomodoroSettings {
  const PomodoroSettings({
    this.workDuration = 25,
    this.breakDuration = 5,
    this.longBreakDuration = 15,
    this.longBreakInterval = 4,
    this.enableNotification = true,
    this.enableSound = true,
    this.enableTitleFlash = true,
    this.forceFullscreen = false,
    this.soundVolume = 85,
  });

  final int workDuration;
  final int breakDuration;
  final int longBreakDuration;
  final int longBreakInterval;
  final bool enableNotification;
  final bool enableSound;
  final bool enableTitleFlash;
  final bool forceFullscreen;
  final int soundVolume;

  PomodoroSettings copyWith({
    int? workDuration,
    int? breakDuration,
    int? longBreakDuration,
    int? longBreakInterval,
    bool? enableNotification,
    bool? enableSound,
    bool? enableTitleFlash,
    bool? forceFullscreen,
    int? soundVolume,
  }) {
    return PomodoroSettings(
      workDuration: workDuration ?? this.workDuration,
      breakDuration: breakDuration ?? this.breakDuration,
      longBreakDuration: longBreakDuration ?? this.longBreakDuration,
      longBreakInterval: longBreakInterval ?? this.longBreakInterval,
      enableNotification: enableNotification ?? this.enableNotification,
      enableSound: enableSound ?? this.enableSound,
      enableTitleFlash: enableTitleFlash ?? this.enableTitleFlash,
      forceFullscreen: forceFullscreen ?? this.forceFullscreen,
      soundVolume: soundVolume ?? this.soundVolume,
    );
  }

  Map<String, dynamic> toJson() => {
        'workDuration': workDuration,
        'breakDuration': breakDuration,
        'longBreakDuration': longBreakDuration,
        'longBreakInterval': longBreakInterval,
        'enableNotification': enableNotification,
        'enableSound': enableSound,
        'enableTitleFlash': enableTitleFlash,
        'forceFullscreen': forceFullscreen,
        'soundVolume': soundVolume,
      };

  factory PomodoroSettings.fromJson(Map<String, dynamic> j) => PomodoroSettings(
        workDuration: j['workDuration'] as int? ?? 25,
        breakDuration: j['breakDuration'] as int? ?? 5,
        longBreakDuration: j['longBreakDuration'] as int? ?? 15,
        longBreakInterval: j['longBreakInterval'] as int? ?? 4,
        enableNotification: j['enableNotification'] as bool? ?? true,
        enableSound: j['enableSound'] as bool? ?? true,
        enableTitleFlash: j['enableTitleFlash'] as bool? ?? true,
        forceFullscreen: j['forceFullscreen'] as bool? ?? false,
        soundVolume: j['soundVolume'] as int? ?? 85,
      );
}
