import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;

/// 静态知识库加载器（单例）。
///
/// 数据来自 assets/data/kaoyan_data.json，由 tools/extract_data.mjs
/// 从 Electron 版源码（data/*.ts + 各 .vue 内置数据）自动提取，保证内容一致。
class KnowledgeData {
  KnowledgeData._();
  static final KnowledgeData instance = KnowledgeData._();

  // 大纲
  List<Map<String, dynamic>> mathOutline = [];
  List<Map<String, dynamic>> politicsOutline = [];
  List<Map<String, dynamic>> cs408Outline = [];

  // 公式（数学 / 英语 / 政治 / 408）
  List<Map<String, dynamic>> mathFormulas = [];
  List<Map<String, dynamic>> englishFormulas = [];
  List<Map<String, dynamic>> politicsFormulas = [];
  List<Map<String, dynamic>> builtinFormulas = [];

  // 算法模板
  List<Map<String, dynamic>> builtinAlgorithms = [];

  // 单词词库
  List<Map<String, dynamic>> wordDatabase = [];

  bool _loaded = false;
  bool get isLoaded => _loaded;

  /// 应用启动时调用一次（main 里 await），之后同步访问。
  Future<void> load() async {
    if (_loaded) return;
    final raw = await rootBundle.loadString('assets/data/kaoyan_data.json');
    final map = jsonDecode(raw) as Map<String, dynamic>;
    mathOutline = _list(map['mathOutline']);
    politicsOutline = _list(map['politicsOutline']);
    cs408Outline = _list(map['cs408Outline']);
    mathFormulas = _list(map['mathFormulas']);
    englishFormulas = _list(map['englishFormulas']);
    politicsFormulas = _list(map['politicsFormulas']);
    builtinFormulas = _list(map['builtinFormulas']);
    builtinAlgorithms = _list(map['builtinAlgorithms']);
    wordDatabase = _list(map['wordDatabase']);
    _loaded = true;
  }

  List<Map<String, dynamic>> _list(dynamic v) =>
      (v as List).map((e) => e as Map<String, dynamic>).toList();

  /// 指定科目的大纲（cs408 / politics / math）
  List<Map<String, dynamic>> outlineFor(String subjectId) => switch (subjectId) {
        'cs408' => cs408Outline,
        'politics' => politicsOutline,
        'math' => mathOutline,
        _ => const [],
      };
}
