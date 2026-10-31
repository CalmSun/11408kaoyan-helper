import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';

import '../data/knowledge_data.dart';
import '../models/models.dart';
import '../theme/kaoyan_theme.dart';

/// 公式速查（对应 Electron Formulas.vue）。
class FormulasScreen extends StatefulWidget {
  const FormulasScreen({super.key});

  @override
  State<FormulasScreen> createState() => _FormulasScreenState();
}

class _FormulasScreenState extends State<FormulasScreen> {
  String _subject = 'all';
  String _keyword = '';

  List<Map<String, dynamic>> get _all {
    final kd = KnowledgeData.instance;
    return [
      ...kd.builtinFormulas,
      ...kd.mathFormulas,
      ...kd.englishFormulas,
      ...kd.politicsFormulas,
    ];
  }

  List<Map<String, dynamic>> get _filtered {
    var result = _all;
    if (_subject != 'all') {
      result = result.where((f) => f['subject'] == _subject).toList();
    }
    if (_keyword.isNotEmpty) {
      final kw = _keyword.toLowerCase();
      result = result.where((f) =>
          (f['name'] as String? ?? '').toLowerCase().contains(kw) ||
          (f['description'] as String? ?? '').toLowerCase().contains(kw) ||
          (f['category'] as String? ?? '').toLowerCase().contains(kw)).toList();
    }
    return result;
  }

  static const _subjectTabs = [
    ('all', '全部'),
    ('cs408', '408'),
    ('math', '数学'),
    ('english', '英语'),
    ('politics', '政治'),
  ];

  @override
  Widget build(BuildContext context) {
    final list = _filtered;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        TextField(
          decoration: const InputDecoration(
            hintText: '搜索公式 / 概念…',
            prefixIcon: Icon(CupertinoIcons.search, size: 18),
            border: OutlineInputBorder(),
            isDense: true,
          ),
          onChanged: (v) => setState(() => _keyword = v),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final (id, label) in _subjectTabs)
              ChoiceChip(
                label: Text(label),
                selected: _subject == id,
                onSelected: (_) => setState(() => _subject = id),
              ),
          ],
        ),
        const SizedBox(height: 16),
        if (list.isEmpty)
          const GlassContainer.card(
            child: Padding(
              padding: EdgeInsets.all(48),
              child: Center(child: Text('没有找到相关公式')),
            ),
          )
        else
          Wrap(
            spacing: 14,
            runSpacing: 14,
            children: [
              for (final f in list)
                SizedBox(width: _cardWidth(context), child: _formulaCard(f)),
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

  Widget _formulaCard(Map<String, dynamic> f) {
    final content = f['content'] as String? ?? '';
    final subject = SubjectType.fromId(f['subject'] as String?);
    final category = f['category'] as String? ?? '';
    return GlassContainer.card(
      child: InkWell(
        onTap: () => _showDetail(f),
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
                      f['name'] as String? ?? '',
                      style: const TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w600),
                    ),
                  ),
                  if (subject != null)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: subject.color,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        subject.shortName,
                        style: const TextStyle(
                            fontSize: 11, color: Colors.white),
                      ),
                    ),
                ],
              ),
              if (category.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  category,
                  style: TextStyle(
                      fontSize: 11, color: Theme.of(context).hintColor),
                ),
              ],
              const SizedBox(height: 10),
              Text(
                content,
                maxLines: 4,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    fontSize: 12, height: 1.5, fontFamily: 'monospace'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showDetail(Map<String, dynamic> f) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(f['name'] as String? ?? ''),
        content: SizedBox(
          width: 560,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '${f['category'] ?? ''}',
                  style: const TextStyle(
                      fontSize: 12, color: KaoyanColors.primary),
                ),
                const SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Theme.of(ctx)
                        .colorScheme
                        .surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: SelectableText(
                    f['content'] as String? ?? '',
                    style: const TextStyle(
                        fontSize: 13, height: 1.6, fontFamily: 'monospace'),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  f['description'] as String? ?? '',
                  style: TextStyle(
                      fontSize: 13, color: Theme.of(ctx).hintColor, height: 1.5),
                ),
                if (f['example'] != null) ...[
                  const SizedBox(height: 12),
                  const Text('示例',
                      style: TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  SelectableText(
                    f['example'] as String,
                    style: const TextStyle(
                        fontSize: 12, height: 1.5, fontFamily: 'monospace'),
                  ),
                ],
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('关闭'),
          ),
        ],
      ),
    );
  }
}
