import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';

import '../data/knowledge_data.dart';
import '../services/storage_service.dart';
import '../theme/kaoyan_theme.dart';

/// 算法模板库（对应 Electron Algorithms.vue）。
class AlgorithmsScreen extends StatefulWidget {
  const AlgorithmsScreen({super.key});

  @override
  State<AlgorithmsScreen> createState() => _AlgorithmsScreenState();
}

class _AlgorithmsScreenState extends State<AlgorithmsScreen> {
  String _category = 'all';
  String _keyword = '';
  List<Map<String, dynamic>> _userAlgorithms = [];

  @override
  void initState() {
    super.initState();
    _userAlgorithms = StorageService.instance
        .getList<Map<String, dynamic>>('algorithms', (j) => j);
  }

  List<Map<String, dynamic>> get _all =>
      [...KnowledgeData.instance.builtinAlgorithms, ..._userAlgorithms];

  List<String> get _categories {
    final set = <String>{};
    for (final a in _all) {
      set.add(a['category'] as String? ?? '其他');
    }
    return set.toList();
  }

  List<Map<String, dynamic>> get _filtered {
    var result = _all;
    if (_category != 'all') {
      result = result
          .where((a) => (a['category'] as String? ?? '其他') == _category)
          .toList();
    }
    if (_keyword.isNotEmpty) {
      final kw = _keyword.toLowerCase();
      result = result
          .where((a) =>
              (a['name'] as String? ?? '').toLowerCase().contains(kw) ||
              (a['description'] as String? ?? '').toLowerCase().contains(kw))
          .toList();
    }
    return result;
  }

  @override
  Widget build(BuildContext context) {
    final list = _filtered;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        Row(
          children: [
            Expanded(
              child: TextField(
                decoration: const InputDecoration(
                  hintText: '搜索算法…',
                  prefixIcon: Icon(CupertinoIcons.search, size: 18),
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
                onChanged: (v) => setState(() => _keyword = v),
              ),
            ),
            const SizedBox(width: 10),
            GlassButton(
              icon: const Icon(CupertinoIcons.plus),
              onTap: _showAddDialog,
            ),
          ],
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            ChoiceChip(
              label: const Text('全部'),
              selected: _category == 'all',
              onSelected: (_) => setState(() => _category = 'all'),
            ),
            for (final c in _categories)
              ChoiceChip(
                label: Text(c),
                selected: _category == c,
                onSelected: (_) => setState(() => _category = c),
              ),
          ],
        ),
        const SizedBox(height: 16),
        if (list.isEmpty)
          const GlassContainer.card(
            child: Padding(
              padding: EdgeInsets.all(48),
              child: Center(child: Text('没有找到相关算法')),
            ),
          )
        else
          Wrap(
            spacing: 14,
            runSpacing: 14,
            children: [
              for (final a in list)
                SizedBox(width: _cardWidth(context), child: _algoCard(a)),
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

  Widget _algoCard(Map<String, dynamic> a) {
    final tags = (a['tags'] as List? ?? const []).cast<String>();
    return GlassContainer.card(
      child: InkWell(
        onTap: () => _showDetail(a),
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      a['name'] as String? ?? '',
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w600),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: KaoyanColors.primary.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      a['category'] as String? ?? '其他',
                      style: const TextStyle(
                          fontSize: 11, color: KaoyanColors.primary),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                a['description'] as String? ?? '',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    fontSize: 12, color: Theme.of(context).hintColor),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  _meta('时间', a['timeComplexity'] as String? ?? '-'),
                  const SizedBox(width: 16),
                  _meta('空间', a['spaceComplexity'] as String? ?? '-'),
                ],
              ),
              if (tags.isNotEmpty) ...[
                const SizedBox(height: 10),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final t in tags)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Theme.of(context)
                              .colorScheme
                              .surfaceContainerHighest,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(t, style: const TextStyle(fontSize: 10)),
                      ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _meta(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: TextStyle(fontSize: 10, color: Theme.of(context).hintColor)),
        Text(value,
            style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: KaoyanColors.primary,
                fontFamily: 'monospace')),
      ],
    );
  }

  void _showDetail(Map<String, dynamic> a) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(a['name'] as String? ?? ''),
        content: SizedBox(
          width: 560,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _tag('分类：${a['category'] ?? '其他'}'),
                    _tag('时间：${a['timeComplexity'] ?? '-'}'),
                    _tag('空间：${a['spaceComplexity'] ?? '-'}'),
                  ],
                ),
                const SizedBox(height: 12),
                Text(a['description'] as String? ?? '',
                    style: TextStyle(
                        fontSize: 13, color: Theme.of(ctx).hintColor)),
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF2B2F36),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: SelectableText(
                    a['code'] as String? ?? '',
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 12,
                      color: Color(0xFFDCDDE0),
                      height: 1.5,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () {
              Clipboard.setData(
                  ClipboardData(text: a['code'] as String? ?? ''));
              Navigator.of(ctx).pop();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('代码已复制到剪贴板')),
              );
            },
            child: const Text('复制代码'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('关闭'),
          ),
        ],
      ),
    );
  }

  Widget _tag(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(text, style: const TextStyle(fontSize: 11)),
    );
  }

  void _showAddDialog() {
    final nameCtl = TextEditingController();
    final descCtl = TextEditingController();
    final timeCtl = TextEditingController();
    final spaceCtl = TextEditingController();
    final codeCtl = TextEditingController();
    String category = _categories.isNotEmpty ? _categories.first : '其他';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlg) => AlertDialog(
          title: const Text('添加算法模板'),
          content: SizedBox(
            width: 480,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: nameCtl,
                    decoration: const InputDecoration(labelText: '算法名称'),
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    initialValue: category,
                    decoration: const InputDecoration(labelText: '分类'),
                    items: [
                      for (final c in _categories)
                        DropdownMenuItem(value: c, child: Text(c)),
                    ],
                    onChanged: (v) => setDlg(() => category = v ?? category),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: descCtl,
                    decoration: const InputDecoration(labelText: '描述'),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: timeCtl,
                          decoration:
                              const InputDecoration(labelText: '时间复杂度'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: spaceCtl,
                          decoration:
                              const InputDecoration(labelText: '空间复杂度'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: codeCtl,
                    maxLines: 8,
                    decoration: const InputDecoration(
                      labelText: '代码',
                      alignLabelWithHint: true,
                      border: OutlineInputBorder(),
                    ),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('取消'),
            ),
            FilledButton(
              onPressed: () {
                final name = nameCtl.text.trim();
                final code = codeCtl.text.trim();
                if (name.isEmpty || code.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('请填写算法名称和代码')),
                  );
                  return;
                }
                final algo = {
                  'id': DateTime.now().millisecondsSinceEpoch.toString(),
                  'name': name,
                  'category': category,
                  'description': descCtl.text.trim(),
                  'timeComplexity': timeCtl.text.trim().isEmpty
                      ? '-'
                      : timeCtl.text.trim(),
                  'spaceComplexity': spaceCtl.text.trim().isEmpty
                      ? '-'
                      : spaceCtl.text.trim(),
                  'code': code,
                  'tags': <String>[],
                };
                setState(() => _userAlgorithms.insert(0, algo));
                StorageService.instance.setList('algorithms', _userAlgorithms);
                Navigator.of(ctx).pop();
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('添加成功')),
                );
              },
              child: const Text('添加'),
            ),
          ],
        ),
      ),
    );
  }
}
