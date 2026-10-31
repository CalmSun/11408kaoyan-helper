import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';

import '../data/knowledge_data.dart';
import '../models/models.dart';
import '../services/app_store.dart';
import '../theme/kaoyan_theme.dart';

/// 知识大纲页面（对应 Electron Outline.vue）。
class OutlineScreen extends StatefulWidget {
  const OutlineScreen({super.key});

  @override
  State<OutlineScreen> createState() => _OutlineScreenState();
}

class _OutlineScreenState extends State<OutlineScreen> {
  SubjectType _current = SubjectType.cs408;
  final Set<int> _expanded = {0};

  @override
  Widget build(BuildContext context) {
    final store = AppStore.instance;
    return ListenableBuilder(
      listenable: store,
      builder: (context, _) {
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            _buildOverall(store),
            const SizedBox(height: 16),
            _buildSubjectGrid(store, context),
            const SizedBox(height: 16),
            _buildOutlineCard(store, context),
          ],
        );
      },
    );
  }

  // ── 总体进度 ──
  Widget _buildOverall(AppStore store) {
    return GlassContainer.card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('总体复习进度',
                    style:
                        TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                Text(
                  '${store.overallProgress}%',
                  style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: KaoyanColors.primary,
                      fontFeatures: [FontFeature.tabularFigures()]),
                ),
              ],
            ),
            const SizedBox(height: 14),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(
                value: store.overallProgress / 100,
                minHeight: 14,
                backgroundColor:
                    Theme.of(context).colorScheme.surfaceContainerHighest,
                valueColor: const AlwaysStoppedAnimation(KaoyanColors.primary),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── 各科进度卡 ──
  Widget _buildSubjectGrid(AppStore store, BuildContext context) {
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: [
        for (final s in SubjectType.values)
          SizedBox(
            width: _cardWidth(context),
            child: _subjectCard(store, s),
          ),
      ],
    );
  }

  double _cardWidth(BuildContext context) {
    final w = MediaQuery.of(context).size.width;
    if (w < 400) return (w - 32 - 12) / 2;
    if (w < 900) return (w - 32 - 12) / 2;
    return (w - 32 - 12 * 3) / 4;
  }

  Widget _subjectCard(AppStore store, SubjectType s) {
    final progress = store.subjectProgress[s] ?? 0;
    final hours =
        ((store.subjectStudyMinutes[s] ?? 0) / 60 * 10).round() / 10;
    return GestureDetector(
      onTap: () => setState(() {
        _current = s;
        _expanded.clear();
        _expanded.add(0);
      }),
      child: GlassContainer.card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(s.name,
                      style: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w600)),
                  Text('$progress%',
                      style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: s.color,
                          fontFeatures: const [FontFeature.tabularFigures()])),
                ],
              ),
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: progress / 100,
                  minHeight: 7,
                  backgroundColor: Theme.of(context)
                      .colorScheme
                      .surfaceContainerHighest,
                  valueColor: AlwaysStoppedAnimation(s.color),
                ),
              ),
              const SizedBox(height: 8),
              Text('学习时长: $hours h',
                  style: TextStyle(
                      fontSize: 11, color: Theme.of(context).hintColor)),
            ],
          ),
        ),
      ),
    );
  }

  // ── 大纲卡片 ──
  Widget _buildOutlineCard(AppStore store, BuildContext context) {
    final outline = KnowledgeData.instance.outlineFor(_current.id);
    return GlassContainer.card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 科目 tab
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final s in SubjectType.values)
                  ChoiceChip(
                    label: Text(s.shortName),
                    selected: _current == s,
                    selectedColor: s.color.withValues(alpha: 0.25),
                    labelStyle: TextStyle(
                      color: _current == s ? s.color : null,
                      fontWeight: _current == s ? FontWeight.w600 : null,
                    ),
                    onSelected: (_) => setState(() {
                      _current = s;
                      _expanded.clear();
                      _expanded.add(0);
                    }),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            // 进度调节
            Row(
              children: [
                Text('当前科目进度：',
                    style: TextStyle(
                        fontSize: 13, color: Theme.of(context).hintColor)),
                Expanded(
                  child: Slider(
                    value: (store.subjectProgress[_current] ?? 0).toDouble(),
                    min: 0,
                    max: 100,
                    divisions: 20,
                    label: '${store.subjectProgress[_current] ?? 0}%',
                    onChanged: (v) {
                      store.setSubjectProgress(_current, v.round());
                    },
                  ),
                ),
                Text('${store.subjectProgress[_current] ?? 0}%',
                    style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.bold)),
              ],
            ),
            const Divider(),
            // 大纲树
            if (outline.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 32),
                child: Center(
                  child: Text('该科目暂无大纲数据',
                      style: TextStyle(color: Theme.of(context).hintColor)),
                ),
              )
            else
              for (var i = 0; i < outline.length; i++)
                _chapterItem(outline[i], i),
          ],
        ),
      ),
    );
  }

  Widget _chapterItem(Map<String, dynamic> chapter, int index) {
    final sections =
        (chapter['sections'] as List).cast<Map<String, dynamic>>();
    final expanded = _expanded.contains(index);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InkWell(
          onTap: () => setState(() {
            expanded ? _expanded.remove(index) : _expanded.add(index);
          }),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Row(
              children: [
                Icon(
                  expanded
                      ? CupertinoIcons.chevron_down
                      : CupertinoIcons.chevron_right,
                  size: 16,
                  color: Theme.of(context).hintColor,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    chapter['title'] as String,
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w600),
                  ),
                ),
                if (chapter['weight'] != null)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: Theme.of(context)
                          .colorScheme
                          .surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '分值约 ${chapter['weight']} 分',
                      style: TextStyle(
                          fontSize: 11, color: Theme.of(context).hintColor),
                    ),
                  ),
              ],
            ),
          ),
        ),
        if (expanded)
          Padding(
            padding: const EdgeInsets.only(left: 24, bottom: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final s in sections) _sectionItem(s),
              ],
            ),
          ),
      ],
    );
  }

  Widget _sectionItem(Map<String, dynamic> section) {
    final points = (section['points'] as List).cast<String>();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(CupertinoIcons.doc_text,
                  size: 14, color: Theme.of(context).hintColor),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  section['title'] as String,
                  style: const TextStyle(fontSize: 13),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final p in points)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: Theme.of(context)
                        .colorScheme
                        .surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(5),
                  ),
                  child: Text(p,
                      style: TextStyle(
                          fontSize: 11, color: Theme.of(context).hintColor)),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
