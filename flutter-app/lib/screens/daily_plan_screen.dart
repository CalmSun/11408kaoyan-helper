import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';

import '../models/models.dart';
import '../services/app_store.dart';
import '../theme/kaoyan_theme.dart';
import '../utils/date_helper.dart';

/// 每日计划页面（对应 Electron DailyPlan.vue）。
///
/// 数据统一走全局 AppStore（与 Dashboard / 统计实时同步）：
/// - 今日计划 = 循环计划 + 今天（本地日期）创建的普通计划
/// - 循环计划完成状态存于 completedDates（增删今天的日期）
/// - 历史记录 = planSnapshots 最近 7 天（今天之前）
class DailyPlanScreen extends StatefulWidget {
  const DailyPlanScreen({super.key});

  @override
  State<DailyPlanScreen> createState() => _DailyPlanScreenState();
}

class _DailyPlanScreenState extends State<DailyPlanScreen> {
  final _titleController = TextEditingController();
  SubjectType? _newSubject;
  bool _newRecurring = false;
  bool _showHistory = false;

  @override
  void dispose() {
    _titleController.dispose();
    super.dispose();
  }

  List<PlanItem> get _todayPlans {
    final today = todayLocal();
    return AppStore.instance.plans.where((p) {
      if (p.recurring) return true;
      return toLocalDate(p.createdAt) == today;
    }).toList();
  }

  bool _isCompletedToday(PlanItem p) {
    if (p.recurring) return p.completedDates.contains(todayLocal());
    return p.completed;
  }

  int get _completedCount => _todayPlans.where(_isCompletedToday).length;
  int get _totalCount => _todayPlans.length;
  int get _progressPercent =>
      _totalCount == 0 ? 0 : (_completedCount / _totalCount * 100).round();

  String get _todayStr {
    final now = DateTime.now();
    return '${now.year}年${now.month}月${now.day}日';
  }

  Future<void> _addPlan() async {
    final title = _titleController.text.trim();
    if (title.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请输入计划内容')),
      );
      return;
    }
    final recurring = _newRecurring;
    await AppStore.instance.addPlan(title, _newSubject, recurring);
    if (!mounted) return;
    setState(() {
      _titleController.clear();
      _newRecurring = false;
    });
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(recurring ? '已添加每日循环计划' : '添加成功')));
  }

  Future<void> _clearCompleted() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('清除已完成'),
        content: const Text('确定要清除今天已完成的计划吗？'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('取消')),
          FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('清除')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    await AppStore.instance.clearCompleted();
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(const SnackBar(content: Text('已清除')));
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AppStore.instance,
      builder: (context, _) {
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            _buildHeader(),
            const SizedBox(height: 16),
            _buildProgressCard(),
            const SizedBox(height: 16),
            _buildAddForm(),
            const SizedBox(height: 16),
            _buildPlanList(),
            const SizedBox(height: 16),
            _buildHistory(),
          ],
        );
      },
    );
  }

  Widget _buildHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('每日计划',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        Text('$_todayStr · 已完成 $_completedCount/$_totalCount 项',
            style: TextStyle(fontSize: 13, color: Theme.of(context).hintColor)),
      ],
    );
  }

  // ── 进度卡 ──
  Widget _buildProgressCard() {
    return GlassContainer.card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('今日完成进度',
                    style: TextStyle(
                        fontSize: 14, color: Theme.of(context).hintColor)),
                Text(
                  '$_progressPercent%',
                  style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: KaoyanColors.primary,
                      fontFeatures: [FontFeature.tabularFigures()]),
                ),
              ],
            ),
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: LinearProgressIndicator(
                value: _totalCount == 0 ? 0 : _completedCount / _totalCount,
                minHeight: 12,
                backgroundColor:
                    Theme.of(context).colorScheme.surfaceContainerHighest,
                valueColor:
                    const AlwaysStoppedAnimation(KaoyanColors.primary),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── 添加表单 ──
  Widget _buildAddForm() {
    return GlassContainer.card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _titleController,
              decoration: const InputDecoration(
                hintText: '添加新的学习计划...',
                prefixIcon: Icon(CupertinoIcons.plus, size: 18),
                border: OutlineInputBorder(),
                isDense: true,
              ),
              onSubmitted: (_) => _addPlan(),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                // 科目：其他 + 4 科
                ChoiceChip(
                  label: const Text('其他'),
                  selected: _newSubject == null,
                  onSelected: (_) => setState(() => _newSubject = null),
                ),
                for (final s in SubjectType.values)
                  Padding(
                    padding: const EdgeInsets.only(left: 8),
                    child: ChoiceChip(
                      label: Text(s.shortName),
                      selected: _newSubject == s,
                      selectedColor: s.color.withValues(alpha: 0.25),
                      onSelected: (v) =>
                          setState(() => _newSubject = v ? s : null),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: Row(children: [
                    const Text('每日循环', style: TextStyle(fontSize: 13)),
                    const SizedBox(width: 4),
                    Switch(
                      value: _newRecurring,
                      onChanged: (v) => setState(() => _newRecurring = v),
                    ),
                  ]),
                ),
                FilledButton.icon(
                  onPressed: _addPlan,
                  icon: const Icon(CupertinoIcons.plus, size: 16),
                  label: const Text('添加计划'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ── 计划列表 ──
  Widget _buildPlanList() {
    return GlassContainer.card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(CupertinoIcons.list_bullet,
                    size: 18, color: KaoyanColors.primary),
                const SizedBox(width: 8),
                const Text('今日计划',
                    style:
                        TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                const Spacer(),
                if (_completedCount < _totalCount)
                  TextButton(
                    onPressed: () => AppStore.instance.completeAllToday(),
                    child: const Text('全部完成', style: TextStyle(fontSize: 12)),
                  ),
                if (_completedCount > 0)
                  TextButton(
                    onPressed: _clearCompleted,
                    child: Text('清除已完成',
                        style: TextStyle(
                            fontSize: 12, color: Theme.of(context).colorScheme.error)),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            if (_todayPlans.isEmpty)
              _buildEmpty()
            else
              for (final plan in _todayPlans) _planItem(plan),
          ],
        ),
      ),
    );
  }

  Widget _buildEmpty() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Center(
        child: Column(children: [
          Icon(CupertinoIcons.doc_text,
              size: 40, color: Theme.of(context).hintColor),
          const SizedBox(height: 12),
          Text('今天还没有计划，添加一个开始学习吧~',
              style: TextStyle(color: Theme.of(context).hintColor)),
        ]),
      ),
    );
  }

  Widget _planItem(PlanItem plan) {
    final done = _isCompletedToday(plan);
    final showTime =
        !plan.recurring && plan.completed && plan.completedAt != null;
    return InkWell(
      onTap: () => AppStore.instance.togglePlan(plan.id),
      borderRadius: BorderRadius.circular(10),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        child: Row(
          children: [
            Icon(
              done
                  ? CupertinoIcons.checkmark_circle_fill
                  : CupertinoIcons.circle,
              size: 20,
              color: done
                  ? KaoyanColors.primary
                  : Theme.of(context).hintColor,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Row(children: [
                Flexible(
                  child: Text(
                    plan.title,
                    style: TextStyle(
                      fontSize: 14,
                      decoration: done ? TextDecoration.lineThrough : null,
                      color: done ? Theme.of(context).hintColor : null,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (plan.recurring) ...[
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 6, vertical: 1),
                    decoration: BoxDecoration(
                      border: Border.all(
                          color: Theme.of(context).dividerColor),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text('循环',
                        style: TextStyle(fontSize: 10)),
                  ),
                ],
              ]),
            ),
            if (plan.subject != null) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: plan.subject!.color,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(plan.subject!.shortName,
                    style: const TextStyle(fontSize: 11, color: Colors.white)),
              ),
            ],
            if (showTime) ...[
              const SizedBox(width: 10),
              Text(_formatTime(plan.completedAt!),
                  style: const TextStyle(
                      fontSize: 12, color: Color(0xFF34D399))),
            ],
            const SizedBox(width: 4),
            IconButton(
              onPressed: () => AppStore.instance.deletePlan(plan.id),
              icon: Icon(CupertinoIcons.trash,
                  size: 16, color: Theme.of(context).hintColor),
              visualDensity: VisualDensity.compact,
            ),
          ],
        ),
      ),
    );
  }

  String _formatTime(String iso) {
    try {
      final d = DateTime.parse(iso).toLocal();
      return '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return '';
    }
  }

  // ── 历史记录 ──
  Widget _buildHistory() {
    final today = todayLocal();
    final store = AppStore.instance;
    final days = store.planSnapshots
        .where((s) => s.date.compareTo(today) < 0 && s.items.isNotEmpty)
        .toList()
      ..sort((a, b) => b.date.compareTo(a.date));
    final shown = days.take(7).toList();

    return GlassContainer.card(
      child: Column(
        children: [
          InkWell(
            onTap: () => setState(() => _showHistory = !_showHistory),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(children: [
                const Icon(CupertinoIcons.clock_fill,
                    size: 18, color: KaoyanColors.primary),
                const SizedBox(width: 8),
                const Text('历史记录',
                    style:
                        TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                const Spacer(),
                AnimatedRotation(
                  turns: _showHistory ? 0.5 : 0,
                  duration: const Duration(milliseconds: 250),
                  child: Icon(CupertinoIcons.chevron_down,
                      size: 16, color: Theme.of(context).hintColor),
                ),
              ]),
            ),
          ),
          if (_showHistory)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: shown.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.symmetric(vertical: 20),
                      child: Text('暂无历史记录',
                          style: TextStyle(
                              color: Theme.of(context).hintColor)),
                    )
                  : Column(
                      children: [
                        for (final day in shown)
                          _historyDay(day),
                      ],
                    ),
            ),
        ],
      ),
    );
  }

  Widget _historyDay(DailyPlanSnapshot day) {
    final done = day.items.where((i) => i.completed).length;
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(_formatDayLabel(day.date),
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w500)),
              Text('完成 $done/${day.items.length}',
                  style:
                      TextStyle(fontSize: 12, color: Theme.of(context).hintColor)),
            ],
          ),
          const SizedBox(height: 8),
          for (final item in day.items)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(children: [
                Icon(
                  item.completed
                      ? CupertinoIcons.checkmark_circle_fill
                      : CupertinoIcons.xmark_circle,
                  size: 14,
                  color: item.completed
                      ? const Color(0xFF34D399)
                      : Theme.of(context).hintColor,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    item.title,
                    style: TextStyle(
                      fontSize: 13,
                      decoration:
                          item.completed ? TextDecoration.lineThrough : null,
                      color: item.completed
                          ? const Color(0xFF34D399)
                          : Theme.of(context).hintColor,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (item.completed && item.completedAt != null)
                  Text(_formatTime(item.completedAt!),
                      style: TextStyle(
                          fontSize: 12,
                          color: Theme.of(context).hintColor)),
              ]),
            ),
        ],
      ),
    );
  }

  String _formatDayLabel(String date) {
    try {
      final d = DateTime.parse(date);
      const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      return '$date ${week[d.weekday % 7]}';
    } catch (_) {
      return date;
    }
  }
}
