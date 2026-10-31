import 'dart:math';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';

import '../models/models.dart';
import '../services/app_store.dart';
import '../theme/kaoyan_theme.dart';

/// 背诵卡片（对应 Electron Flashcards.vue）。
class FlashcardsScreen extends StatefulWidget {
  const FlashcardsScreen({super.key});

  @override
  State<FlashcardsScreen> createState() => _FlashcardsScreenState();
}

class _FlashcardsScreenState extends State<FlashcardsScreen> {
  String _category = 'all';
  String _keyword = '';
  final Set<String> _flipped = {};

  List<Flashcard> get _cards => AppStore.instance.flashcards;

  List<String> get _categories {
    final set = <String>{};
    for (final c in _cards) {
      if (c.category.isNotEmpty) set.add(c.category);
    }
    return set.toList();
  }

  List<Flashcard> get _filtered {
    var result = _cards;
    if (_category != 'all') {
      result = result.where((c) => c.category == _category).toList();
    }
    if (_keyword.isNotEmpty) {
      final kw = _keyword.toLowerCase();
      result = result
          .where((c) =>
              c.front.toLowerCase().contains(kw) ||
              c.back.toLowerCase().contains(kw))
          .toList();
    }
    return result;
  }

  @override
  Widget build(BuildContext context) {
    final store = AppStore.instance;
    return ListenableBuilder(
      listenable: store,
      builder: (context, _) {
        final list = _filtered;
        final totalReview = _cards.fold(0, (sum, c) => sum + c.reviewCount);
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('背诵卡片',
                          style: TextStyle(
                              fontSize: 20, fontWeight: FontWeight.bold)),
                      Text('共 ${_cards.length} 张卡片，已复习 $totalReview 次',
                          style: TextStyle(
                              fontSize: 12,
                              color: Theme.of(context).hintColor)),
                    ],
                  ),
                ),
                GlassButton(
                  icon: const Icon(CupertinoIcons.plus),
                  onTap: _showAddDialog,
                ),
                const SizedBox(width: 8),
                GlassButton(
                  icon: const Icon(CupertinoIcons.play_fill),
                  enabled: _cards.isNotEmpty,
                  onTap: () => _startReview(list),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              decoration: const InputDecoration(
                hintText: '搜索卡片…',
                prefixIcon: Icon(CupertinoIcons.search, size: 18),
                border: OutlineInputBorder(),
                isDense: true,
              ),
              onChanged: (v) => setState(() => _keyword = v),
            ),
            const SizedBox(height: 10),
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
              GlassContainer.card(
                child: Padding(
                  padding: const EdgeInsets.all(48),
                  child: Column(
                    children: [
                      const Icon(CupertinoIcons.rectangle_stack,
                          size: 48, color: Colors.grey),
                      const SizedBox(height: 12),
                      const Text('还没有背诵卡片，添加一些吧~'),
                      const SizedBox(height: 12),
                      GlassButton(
                        icon: const Icon(CupertinoIcons.plus),
                        onTap: _showAddDialog,
                      ),
                    ],
                  ),
                ),
              )
            else
              Wrap(
                spacing: 14,
                runSpacing: 14,
                children: [
                  for (final c in list)
                    SizedBox(width: _cardWidth(context), child: _card(c)),
                ],
              ),
          ],
        );
      },
    );
  }

  double _cardWidth(BuildContext context) {
    final w = MediaQuery.of(context).size.width;
    if (w < 500) return w - 32;
    if (w < 900) return (w - 32 - 14) / 2;
    return (w - 32 - 14 * 2) / 3;
  }

  Widget _card(Flashcard c) {
    final flipped = _flipped.contains(c.id);
    return Column(
      children: [
        GestureDetector(
          onTap: () => setState(() {
            flipped ? _flipped.remove(c.id) : _flipped.add(c.id);
          }),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 250),
            height: 180,
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: flipped
                    ? [
                        KaoyanColors.purple.withValues(alpha: 0.9),
                        KaoyanColors.primary.withValues(alpha: 0.9),
                      ]
                    : [
                        KaoyanColors.primary.withValues(alpha: 0.95),
                        const Color(0xFF60A5FA).withValues(alpha: 0.95),
                      ],
              ),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.25),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(c.category.isEmpty ? '未分类' : c.category,
                      style: const TextStyle(fontSize: 11, color: Colors.white)),
                ),
                const SizedBox(height: 8),
                Expanded(
                  child: Center(
                    child: SingleChildScrollView(
                      child: Text(
                        flipped ? c.back : c.front,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                            fontSize: 15,
                            color: Colors.white,
                            height: 1.5),
                      ),
                    ),
                  ),
                ),
                Center(
                  child: Text(flipped ? '点击返回' : '点击翻面',
                      style: TextStyle(
                          fontSize: 11, color: Colors.white.withValues(alpha: 0.8))),
                ),
              ],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            children: [
              Icon(CupertinoIcons.eye,
                  size: 14, color: Theme.of(context).hintColor),
              const SizedBox(width: 4),
              Text('复习 ${c.reviewCount} 次',
                  style:
                      TextStyle(fontSize: 11, color: Theme.of(context).hintColor)),
              const Spacer(),
              GestureDetector(
                onTap: () => _delete(c),
                child: Icon(CupertinoIcons.trash,
                    size: 16, color: Theme.of(context).hintColor),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _delete(Flashcard c) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('提示'),
        content: const Text('确定要删除这张卡片吗？'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('取消')),
          FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('删除')),
        ],
      ),
    );
    if (ok == true) {
      await AppStore.instance.deleteFlashcard(c.id);
      _flipped.remove(c.id);
    }
  }

  void _showAddDialog() {
    final catCtl = TextEditingController();
    final frontCtl = TextEditingController();
    final backCtl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('添加背诵卡片'),
        content: SizedBox(
          width: 420,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: catCtl,
                decoration: const InputDecoration(labelText: '分类'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: frontCtl,
                maxLines: 3,
                decoration: const InputDecoration(
                    labelText: '正面（问题/单词）',
                    alignLabelWithHint: true,
                    border: OutlineInputBorder()),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: backCtl,
                maxLines: 3,
                decoration: const InputDecoration(
                    labelText: '背面（答案/释义）',
                    alignLabelWithHint: true,
                    border: OutlineInputBorder()),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('取消')),
          FilledButton(
            onPressed: () {
              final cat = catCtl.text.trim();
              final front = frontCtl.text.trim();
              final back = backCtl.text.trim();
              if (cat.isEmpty || front.isEmpty || back.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('请填写分类、正面和背面')),
                );
                return;
              }
              AppStore.instance.addFlashcard(front, back, cat);
              Navigator.of(ctx).pop();
              ScaffoldMessenger.of(context)
                  .showSnackBar(const SnackBar(content: Text('添加成功')));
            },
            child: const Text('确认添加'),
          ),
        ],
      ),
    );
  }

  void _startReview(List<Flashcard> cards) {
    // Fisher-Yates 洗牌
    final shuffled = List<Flashcard>.from(cards);
    final rnd = Random();
    for (var i = shuffled.length - 1; i > 0; i--) {
      final j = rnd.nextInt(i + 1);
      final tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => _ReviewView(cards: shuffled),
    ));
  }
}

/// 背诵模式全屏页。
class _ReviewView extends StatefulWidget {
  const _ReviewView({required this.cards});
  final List<Flashcard> cards;

  @override
  State<_ReviewView> createState() => _ReviewViewState();
}

class _ReviewViewState extends State<_ReviewView> {
  int _index = 0;
  bool _flipped = false;

  Flashcard get _current => widget.cards[_index];
  double get _progress =>
      widget.cards.isEmpty ? 0 : (_index + 1) / widget.cards.length;

  @override
  Widget build(BuildContext context) {
    final c = _current;
    return Scaffold(
      appBar: AppBar(
        title: Text('${_index + 1} / ${widget.cards.length}'),
        leading: IconButton(
          icon: const Icon(CupertinoIcons.xmark),
          onPressed: () => Navigator.of(context).pop(),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(6),
          child: LinearProgressIndicator(
            value: _progress,
            minHeight: 6,
            backgroundColor:
                Theme.of(context).colorScheme.surfaceContainerHighest,
            valueColor: const AlwaysStoppedAnimation(KaoyanColors.primary),
          ),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Expanded(
              child: GestureDetector(
                onTap: () => setState(() => _flipped = !_flipped),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 250),
                  width: double.infinity,
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: _flipped
                          ? [
                              KaoyanColors.purple.withValues(alpha: 0.9),
                              KaoyanColors.primary.withValues(alpha: 0.9),
                            ]
                          : [
                              KaoyanColors.primary.withValues(alpha: 0.95),
                              const Color(0xFF60A5FA).withValues(alpha: 0.95),
                            ],
                    ),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.25),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                            c.category.isEmpty ? '未分类' : c.category,
                            style: const TextStyle(
                                fontSize: 12, color: Colors.white)),
                      ),
                      Expanded(
                        child: Center(
                          child: SingleChildScrollView(
                            child: Text(
                              _flipped ? c.back : c.front,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                  fontSize: 22,
                                  color: Colors.white,
                                  height: 1.7),
                            ),
                          ),
                        ),
                      ),
                      Text(
                        _flipped ? '点击返回' : '点击查看答案',
                        style: TextStyle(
                            fontSize: 12,
                            color: Colors.white.withValues(alpha: 0.85)),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _btn(CupertinoIcons.arrow_left, '上一张', _index == 0 ? null : _prev),
                _btn(CupertinoIcons.xmark, '没记住', !_flipped ? null : _markWrong,
                    color: const Color(0xFFEF4444)),
                _btn(CupertinoIcons.checkmark, '记住了',
                    !_flipped ? null : _markCorrect,
                    color: const Color(0xFF22C55E)),
                _btn(CupertinoIcons.arrow_right, '下一张',
                    _index >= widget.cards.length - 1 ? null : _next),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _btn(IconData icon, String label, VoidCallback? onTap,
      {Color? color}) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        GlassButton(
          icon: Icon(icon, color: color),
          enabled: onTap != null,
          onTap: onTap ?? () {},
        ),
        const SizedBox(height: 6),
        Text(label, style: const TextStyle(fontSize: 12)),
      ],
    );
  }

  void _next() {
    if (_index < widget.cards.length - 1) {
      setState(() {
        _index++;
        _flipped = false;
      });
    }
  }

  void _prev() {
    if (_index > 0) {
      setState(() {
        _index--;
        _flipped = false;
      });
    }
  }

  void _markWrong() {
    AppStore.instance
        .updateFlashcard(_current.id, reviewCount: _current.reviewCount + 1);
    _next();
  }

  void _markCorrect() {
    AppStore.instance.updateFlashcard(_current.id,
        reviewCount: _current.reviewCount + 1,
        correctCount: _current.correctCount + 1);
    _next();
  }
}
