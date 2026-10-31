import 'dart:io';
import 'dart:typed_data';

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../models/models.dart';
import 'app_store.dart';

/// 学习报告导出（PDF）。对应 Electron 版 Statistics.vue 的「导出学习报告」。
///
/// 中文字体：尝试加载系统常见中文字体（Windows simhei / msyh，Linux Noto / wqy，
/// macOS PingFang）；找不到则降级为英文标签，避免 PDF 中文乱码。
class ReportService {
  ReportService._();

  static const List<String> _fontCandidates = [
    r'C:\Windows\Fonts\simhei.ttf',
    r'C:\Windows\Fonts\msyh.ttc',
    r'C:\Windows\Fonts\simsun.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
    '/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf',
    '/System/Library/Fonts/PingFang.ttc',
    '/System/Library/Fonts/STHeiti Light.ttc',
  ];

  static Future<pw.Font?> _loadFont() async {
    for (final path in _fontCandidates) {
      try {
        final f = File(path);
        if (!f.existsSync()) continue;
        final data = f.readAsBytesSync();
        return pw.Font.ttf(data.buffer.asByteData());
      } catch (_) {}
    }
    return null;
  }

  static String _now() {
    final n = DateTime.now();
    return '${n.year}-${n.month.toString().padLeft(2, '0')}-${n.day.toString().padLeft(2, '0')} '
        '${n.hour.toString().padLeft(2, '0')}:${n.minute.toString().padLeft(2, '0')}';
  }

  static List<String> _last7Days() {
    final now = DateTime.now();
    return List.generate(7, (i) {
      final d = now.subtract(Duration(days: 6 - i));
      return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
    });
  }

  static Future<Uint8List> generateLearningReport(AppStore store) async {
    final font = await _loadFont();
    String t(String zh, String en) => font == null ? en : zh;

    final doc = pw.Document();
    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(32),
        build: (context) {
          final widgets = <pw.Widget>[
            // 标题
            pw.Text(
              t('考研助手 · 学习报告', 'Kaoyan Helper · Study Report'),
              style: pw.TextStyle(
                  font: font, fontSize: 22, fontWeight: pw.FontWeight.bold),
            ),
            pw.SizedBox(height: 4),
            pw.Text(
              t('生成时间：${_now()}', 'Generated: ${_now()}'),
              style:
                  pw.TextStyle(font: font, fontSize: 10, color: PdfColors.grey600),
            ),
            pw.SizedBox(height: 16),

            // 一、考试信息
            _section(t('一、考试信息', '1. Exam Info'), font),
            _kvRow(t('考试名称', 'Exam'), store.examName, font),
            _kvRow(t('考试日期', 'Date'), store.examDate, font),
            _kvRow(t('倒计时', 'Countdown'),
                '${store.daysUntilExam} ${t('天', 'days')}', font),
            _kvRow(t('总体进度', 'Overall Progress'),
                '${store.overallProgress}%', font),
            pw.SizedBox(height: 12),

            // 二、学习总览
            _section(t('二、学习总览', '2. Overview'), font),
            _kvRow(t('累计学习时长', 'Total Study'), '${store.totalStudyHours} ${t('小时', 'h')}',
                font),
            _kvRow(t('累计番茄数', 'Total Pomodoros'),
                '${store.pomodoroRecords.length} ${t('个', '')}', font),
            _kvRow(t('背诵卡片数', 'Flashcards'),
                '${store.flashcards.length} ${t('张', '')}', font),
            _kvRow(t('真题记录数', 'Exam Records'),
                '${store.examScores.length} ${t('条', '')}', font),
            _kvRow(t('应用使用时长', 'App Usage'),
                '${store.appUsageHours} ${t('小时', 'h')}', font),
            pw.SizedBox(height: 12),

            // 三、各科目进度
            _section(t('三、各科目学习进度', '3. Subject Progress'), font),
            _subjectProgressTable(store, t, font, context),
            pw.SizedBox(height: 12),

            // 四、近 7 天学习时长
            _section(t('四、近 7 天学习时长', '4. Last 7 Days Study'), font),
            _last7Table(store, t, font, context),
            pw.SizedBox(height: 12),
          ];

          // 五、真题成绩（有记录才显示）
          if (store.examScores.isNotEmpty) {
            widgets.addAll([
              _section(t('五、真题成绩', '5. Exam Scores'), font),
              _examScoresTable(store, t, font, context),
            ]);
          }

          return widgets;
        },
      ),
    );
    return doc.save();
  }

  static pw.Widget _section(String title, pw.Font? font) {
    return pw.Container(
      margin: const pw.EdgeInsets.only(top: 4, bottom: 8),
      child: pw.Text(title,
          style: pw.TextStyle(
              font: font, fontSize: 14, fontWeight: pw.FontWeight.bold)),
    );
  }

  static pw.Widget _kvRow(String label, String value, pw.Font? font) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 3),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.SizedBox(
            width: 120,
            child: pw.Text('$label：',
                style:
                    pw.TextStyle(font: font, fontSize: 11, color: PdfColors.grey600)),
          ),
          pw.Expanded(
            child: pw.Text(value, style: pw.TextStyle(font: font, fontSize: 11)),
          ),
        ],
      ),
    );
  }

  static pw.Widget _subjectProgressTable(
      AppStore store, String Function(String, String) t, pw.Font? font,
      pw.Context context) {
    final subjects = store.allSubjects;
    final data = <List<String>>[
      for (final s in subjects)
        [
          font == null ? s.id : s.name,
          '${_progressOf(store, s.id)}%',
        ],
    ];
    return pw.TableHelper.fromTextArray(
      context: context,
      headers: [t('科目', 'Subject'), t('进度', 'Progress')],
      data: data,
      headerStyle: pw.TextStyle(
          font: font, fontSize: 11, fontWeight: pw.FontWeight.bold),
      cellStyle: pw.TextStyle(font: font, fontSize: 11),
      headerDecoration: const pw.BoxDecoration(color: PdfColors.grey200),
      cellAlignments: {
        1: pw.Alignment.centerRight,
      },
    );
  }

  static pw.Widget _last7Table(
      AppStore store, String Function(String, String) t, pw.Font? font,
      pw.Context context) {
    final days = _last7Days();
    final data = <List<String>>[
      for (final d in days)
        [
          d,
          '${store.pomodoroRecords.where((r) => r.date == d).fold(0, (a, r) => a + r.duration)} ${t('分钟', 'min')}',
          '${store.pomodoroRecords.where((r) => r.date == d).length}',
        ],
    ];
    return pw.TableHelper.fromTextArray(
      context: context,
      headers: [t('日期', 'Date'), t('学习时长', 'Study'), t('番茄数', 'Pomodoro')],
      data: data,
      headerStyle: pw.TextStyle(
          font: font, fontSize: 11, fontWeight: pw.FontWeight.bold),
      cellStyle: pw.TextStyle(font: font, fontSize: 11),
      headerDecoration: const pw.BoxDecoration(color: PdfColors.grey200),
      cellAlignments: {1: pw.Alignment.centerRight, 2: pw.Alignment.centerRight},
    );
  }

  static pw.Widget _examScoresTable(
      AppStore store, String Function(String, String) t, pw.Font? font,
      pw.Context context) {
    final data = <List<String>>[
      for (final r in store.examScores)
        [
          '${r.year}',
          _subjectName(store, r.subject, font),
          '${r.score} / ${r.fullScore}',
          r.remark ?? '',
        ],
    ];
    return pw.TableHelper.fromTextArray(
      context: context,
      headers: [
        t('年份', 'Year'),
        t('科目', 'Subject'),
        t('分数', 'Score'),
        t('备注', 'Note'),
      ],
      data: data,
      headerStyle: pw.TextStyle(
          font: font, fontSize: 11, fontWeight: pw.FontWeight.bold),
      cellStyle: pw.TextStyle(font: font, fontSize: 11),
      headerDecoration: const pw.BoxDecoration(color: PdfColors.grey200),
      cellAlignments: {2: pw.Alignment.centerRight},
    );
  }

  static String _subjectName(AppStore store, String subjectId, pw.Font? font) {
    for (final s in store.allSubjects) {
      if (s.id == subjectId) return font == null ? s.id : s.name;
    }
    return subjectId;
  }

  static int _progressOf(AppStore store, String id) {
    for (final t in SubjectType.values) {
      if (t.id == id) return store.subjectProgress[t] ?? 0;
    }
    return 0;
  }
}
