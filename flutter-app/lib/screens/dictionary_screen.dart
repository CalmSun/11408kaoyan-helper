import 'dart:convert';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';

import '../data/knowledge_data.dart';
import '../services/app_store.dart';
import '../services/storage_service.dart';
import '../theme/kaoyan_theme.dart';

/// 单词词典（对应 Electron Dictionary.vue，含内置词库 + 在线查询）。
class DictionaryScreen extends StatefulWidget {
  const DictionaryScreen({super.key});

  @override
  State<DictionaryScreen> createState() => _DictionaryScreenState();
}

class _DictionaryScreenState extends State<DictionaryScreen> {
  final _searchCtl = TextEditingController();
  String _keyword = '';
  String _category = 'high';
  bool _searchingOnline = false;
  bool _onlineFailed = false;
  List<Map<String, dynamic>> _onlineResults = [];
  List<Map<String, dynamic>> _customWords = [];

  static const _customKey = 'dictionary_custom_words';

  @override
  void initState() {
    super.initState();
    _customWords = StorageService.instance
        .getList<Map<String, dynamic>>(_customKey, (j) => j);
  }

  List<Map<String, dynamic>> get _builtin => KnowledgeData.instance.wordDatabase;

  List<Map<String, dynamic>> get _all {
    final merged = List<Map<String, dynamic>>.from(_builtin);
    for (final w in _customWords) {
      final exists = merged.any((m) =>
          (m['word'] as String? ?? '').toLowerCase() ==
          (w['word'] as String? ?? '').toLowerCase());
      if (!exists) merged.add(w);
    }
    return merged;
  }

  int _levelCount(String level) =>
      _builtin.where((w) => w['level'] == level).length;

  @override
  void dispose() {
    _searchCtl.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> get _filteredByCategory {
    switch (_category) {
      case 'all':
        return _all;
      case 'custom':
        return _customWords;
      case 'high':
        return _all.where((w) => w['level'] == '高频').toList();
      case 'mid':
        return _all.where((w) => w['level'] == '中频').toList();
      case 'low':
        return _all.where((w) => w['level'] == '低频').toList();
      default:
        return _all;
    }
  }

  List<Map<String, dynamic>> get _displayWords {
    if (_keyword.trim().isEmpty) {
      return _filteredByCategory.take(50).toList();
    }
    final kw = _keyword.trim().toLowerCase();
    final local = _all
        .where((w) =>
            (w['word'] as String? ?? '').toLowerCase().contains(kw) ||
            (w['meaning'] as String? ?? '').contains(kw))
        .toList();
    final merged = List<Map<String, dynamic>>.from(local);
    for (final w in _onlineResults) {
      final exists = merged.any((m) =>
          (m['word'] as String? ?? '').toLowerCase() ==
          (w['word'] as String? ?? '').toLowerCase());
      if (!exists) merged.add(w);
    }
    return merged;
  }

  int get _localMatchCount {
    final kw = _keyword.trim().toLowerCase();
    if (kw.isEmpty) return 0;
    return _all
        .where((w) =>
            (w['word'] as String? ?? '').toLowerCase().contains(kw) ||
            (w['meaning'] as String? ?? '').contains(kw))
        .length;
  }

  @override
  Widget build(BuildContext context) {
    final words = _displayWords;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        TextField(
          controller: _searchCtl,
          decoration: const InputDecoration(
            hintText: '输入单词或中文释义搜索…',
            prefixIcon: Icon(CupertinoIcons.search, size: 18),
            border: OutlineInputBorder(),
            isDense: true,
          ),
          onChanged: (v) => setState(() => _keyword = v),
          onSubmitted: (_) => _search(),
        ),
        const SizedBox(height: 12),
        _buildCategoryTabs(context),
        const SizedBox(height: 16),
        if (_searchingOnline)
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: KaoyanColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
                const SizedBox(width: 10),
                Text('正在在线查询 "${_keyword.trim()}" …',
                    style: const TextStyle(
                        fontSize: 13, color: KaoyanColors.primary)),
              ],
            ),
          )
        else if (words.isEmpty)
          _buildEmpty(context)
        else
          Wrap(
            spacing: 14,
            runSpacing: 14,
            children: [
              for (final w in words)
                SizedBox(width: _cardWidth(context), child: _wordCard(w)),
            ],
          ),
      ],
    );
  }

  double _cardWidth(BuildContext context) {
    final w = MediaQuery.of(context).size.width;
    if (w < 500) return w - 32;
    if (w < 900) return (w - 32 - 14) / 2;
    return (w - 32 - 14 * 2) / 3;
  }

  Widget _buildCategoryTabs(BuildContext context) {
    final tabs = [
      ('high', '高频词', _levelCount('高频')),
      ('mid', '中频词', _levelCount('中频')),
      ('low', '低频词', _levelCount('低频')),
      ('custom', '我的词库', _customWords.length),
      ('all', '全部', _all.length),
    ];
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final (key, name, count) in tabs)
          ChoiceChip(
            selected: _category == key,
            label: Text('$name $count'),
            onSelected: (_) => setState(() {
              _category = key;
              _onlineResults = [];
              _onlineFailed = false;
            }),
          ),
      ],
    );
  }

  Widget _buildEmpty(BuildContext context) {
    String title;
    if (_onlineFailed && _keyword.trim().isNotEmpty) {
      title = '未找到 "${_keyword.trim()}" 的释义（在线查询也未获取到结果）';
    } else if (_keyword.trim().isNotEmpty &&
        _isEnglishWord(_keyword.trim()) &&
        _localMatchCount == 0) {
      title = '本地词库未收录 "${_keyword.trim()}"，点击搜索按钮在线查询';
    } else {
      title = _keyword.isEmpty ? '开始搜索单词吧' : '没有找到相关单词';
    }
    return GlassContainer.card(
      child: Padding(
        padding: const EdgeInsets.all(48),
        child: Center(
          child: Text(title,
              style: TextStyle(color: Theme.of(context).hintColor)),
        ),
      ),
    );
  }

  Widget _wordCard(Map<String, dynamic> w) {
    final phonetic = w['phonetic'] as String? ?? '';
    final level = w['level'] as String? ?? '';
    return GlassContainer.card(
      child: InkWell(
        onTap: () => _showDetail(w),
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    w['word'] as String? ?? '',
                    style: const TextStyle(
                        fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  if (phonetic.isNotEmpty) ...[
                    const SizedBox(width: 8),
                    Text('/$phonetic/',
                        style: TextStyle(
                            fontSize: 12,
                            fontStyle: FontStyle.italic,
                            color: Theme.of(context).hintColor)),
                  ],
                  const Spacer(),
                  _levelTag(level),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                w['meaning'] as String? ?? '',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    fontSize: 13,
                    height: 1.5,
                    color: Theme.of(context).hintColor),
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton.icon(
                    onPressed: () => _addToFlashcards(w),
                    icon: const Icon(CupertinoIcons.plus, size: 14),
                    label: const Text('加入背诵', style: TextStyle(fontSize: 12)),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _levelTag(String level) {
    final color = switch (level) {
      '高频' => const Color(0xFFEF4444),
      '中频' => const Color(0xFFF59E0B),
      '在线查询' => const Color(0xFF22C55E),
      _ => const Color(0xFF8B95A5),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(level.isEmpty ? '单词' : level,
          style: TextStyle(fontSize: 11, color: color)),
    );
  }

  void _showDetail(Map<String, dynamic> w) {
    final example = w['example'] as Map<String, dynamic>?;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(w['word'] as String? ?? ''),
        content: SizedBox(
          width: 420,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    if ((w['phonetic'] as String? ?? '').isNotEmpty)
                      Text('/${w['phonetic']}/',
                          style: TextStyle(
                              fontStyle: FontStyle.italic,
                              color: Theme.of(ctx).hintColor)),
                    const SizedBox(width: 8),
                    _levelTag(w['level'] as String? ?? ''),
                  ],
                ),
                const SizedBox(height: 16),
                const Text('释义',
                    style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: KaoyanColors.primary)),
                const SizedBox(height: 6),
                Text(w['meaning'] as String? ?? '',
                    style: const TextStyle(fontSize: 14, height: 1.6)),
                if (example != null) ...[
                  const SizedBox(height: 16),
                  const Text('例句',
                      style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: KaoyanColors.primary)),
                  const SizedBox(height: 6),
                  Text(example['en'] as String? ?? '',
                      style: const TextStyle(
                          fontSize: 13, fontStyle: FontStyle.italic)),
                  const SizedBox(height: 4),
                  Text(example['cn'] as String? ?? '',
                      style: TextStyle(
                          fontSize: 13, color: Theme.of(ctx).hintColor)),
                ],
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('关闭')),
          FilledButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              _addToFlashcards(w);
            },
            child: const Text('加入背诵卡片'),
          ),
        ],
      ),
    );
  }

  void _addToFlashcards(Map<String, dynamic> w) {
    final word = (w['word'] as String? ?? '').trim();
    final key = word.toLowerCase();
    final store = AppStore.instance;
    final exists = store.flashcards
        .any((c) => c.front.trim().toLowerCase() == key);
    if (exists) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('「$word」已在背诵卡片中')),
      );
      return;
    }
    final phonetic = w['phonetic'] as String? ?? '';
    final meaning = w['meaning'] as String? ?? '';
    final example = w['example'] as Map<String, dynamic>?;
    final back = [
      if (phonetic.isNotEmpty) '/$phonetic/',
      meaning,
      if (example != null) '例句：${example['en']}\n${example['cn']}',
    ].join('\n');
    store.addFlashcard(word, back, '英语单词');
    ScaffoldMessenger.of(context)
        .showSnackBar(const SnackBar(content: Text('已加入背诵卡片')));
  }

  bool _isEnglishWord(String text) =>
      RegExp(r"^[a-zA-Z][a-zA-Z\-']*$").hasMatch(text.trim());

  Future<void> _search() async {
    final keyword = _keyword.trim();
    if (keyword.isEmpty) return;
    setState(() {
      _onlineResults = [];
      _onlineFailed = false;
    });
    final kw = keyword.toLowerCase();
    final localMatch = _all.any((w) =>
        (w['word'] as String? ?? '').toLowerCase().contains(kw) ||
        (w['meaning'] as String? ?? '').contains(kw));
    if (localMatch) return;
    if (!_isEnglishWord(keyword)) {
      setState(() => _onlineFailed = true);
      return;
    }

    setState(() => _searchingOnline = true);
    try {
      final result = await _searchOnline(keyword);
      if (result != null) {
        setState(() {
          _onlineResults = [result];
          _saveCustomWord(result);
        });
      } else {
        setState(() => _onlineFailed = true);
      }
    } catch (_) {
      setState(() => _onlineFailed = true);
    } finally {
      setState(() => _searchingOnline = false);
    }
  }

  Future<Map<String, dynamic>?> _searchOnline(String word) async {
    final lower = word.trim().toLowerCase();
    var phonetic = '';
    final enDefs = <String>[];
    var exampleEn = '';

    try {
      final resp = await http.get(Uri.parse(
          'https://api.dictionaryapi.dev/api/v2/entries/en/$lower'));
      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body) as List;
        if (data.isNotEmpty) {
          final entry = data[0] as Map<String, dynamic>;
          phonetic = _stripSlashes(entry['phonetic'] as String? ?? '');
          if (phonetic.isEmpty) {
            final phonetics = entry['phonetics'] as List? ?? [];
            for (final p in phonetics) {
              final t = (p as Map)['text'] as String? ?? '';
              if (t.isNotEmpty) {
                phonetic = _stripSlashes(t);
                break;
              }
            }
          }
          final meanings = entry['meanings'] as List? ?? [];
          for (final m in meanings) {
            final pos = (m as Map)['partOfSpeech'] as String? ?? '';
            final defs = (m['definitions'] as List? ?? []).take(2);
            for (final d in defs) {
              final def = (d as Map)['definition'] as String? ?? '';
              enDefs.add(pos.isEmpty ? def : '$pos. $def');
              if (exampleEn.isEmpty) {
                exampleEn = (d['example'] as String?) ?? '';
              }
            }
            if (enDefs.length >= 3) break;
          }
        }
      }
    } catch (_) {}

    var cnMeaning = '';
    try {
      final resp = await http.get(Uri.parse(
          'https://api.mymemory.translated.net/get?q=$lower&langpair=en|zh-CN'));
      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body) as Map<String, dynamic>;
        final responseData = data['responseData'] as Map<String, dynamic>?;
        final translated = responseData?['translatedText'] as String? ?? '';
        if (translated.isNotEmpty &&
            translated.toLowerCase() != lower &&
            translated.length <= 60) {
          cnMeaning = translated;
        }
      }
    } catch (_) {}

    if (phonetic.isEmpty && enDefs.isEmpty && cnMeaning.isEmpty) return null;

    final meaning = [
      if (cnMeaning.isNotEmpty) '中文：$cnMeaning',
      if (enDefs.isNotEmpty) '英文：${enDefs.take(3).join('；')}',
    ].join('\n');

    return {
      'word': lower,
      'phonetic': phonetic,
      'meaning': meaning,
      'level': '在线查询',
      if (exampleEn.isNotEmpty)
        'example': {'en': exampleEn, 'cn': cnMeaning},
    };
  }

  String _stripSlashes(String s) =>
      s.startsWith('/') && s.endsWith('/') ? s.substring(1, s.length - 1) : s;

  void _saveCustomWord(Map<String, dynamic> word) {
    final exists = _customWords.any((w) =>
        (w['word'] as String? ?? '').toLowerCase() ==
        (word['word'] as String? ?? '').toLowerCase());
    if (!exists) {
      _customWords.add(Map<String, dynamic>.from(word)
        ..['level'] = '自定义');
      StorageService.instance.setList(_customKey, _customWords);
    }
  }
}
