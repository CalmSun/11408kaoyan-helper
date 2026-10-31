import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';

import '../models/models.dart';
import '../services/storage_service.dart';
import '../theme/kaoyan_theme.dart';
import '../utils/date_helper.dart';

/// 每日计划页面。
///
/// 逻辑与 Electron 版 DailyPlan.vue 对齐：
/// - 今日计划 = 循环计划 + 今天（本地日期）创建的普通计划
/// - 循环计划完成状态存于 completedDates（增删今天的日期）
/// - 普通计划完成状态直接切换 completed + completedAt
class DailyPlanScreen extends StatefulWidget {
  const DailyPlanScreen({super.key});

  @override
  State<DailyPlanScreen> createState() => _DailyPlanScreenState();
}

class _DailyPlanScreenState extends State<DailyPlanScreen> {
  List<PlanItem> _plans = [];
  final _titleController = TextEditingController();
  SubjectType? _newSubject;
  bool _newRecurring = false;

  @override
  void initState() {
    super.initState();
    _loadPlans();
  }

  @override
  void dispose() {
    _titleController.dispose();
    super.dispose();
  }

  Future<void> _loadPlans() async {
    final plans = StorageService.instance.getList('plans', PlanItem.fromJson);
    if (mounted) setState(() => _plans = plans);
  }

  Future<void> _savePlans() async {
    await StorageService.instance.setList('plans', _plans);
  }

  List<PlanItem> get _todayPlans {
    final today = todayLocal();
    return _plans.where((p) {
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
  double get _progress =>
      _totalCount == 0 ? 0 : _completedCount / _totalCount;

  Future<void> _addPlan() async {
    final title = _titleController.text.trim();
    if (title.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请输入计划内容')),
      );
      return;
    }
    final plan = PlanItem(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      title: title,
      subject: _newSubject,
      createdAt: DateTime.now().toIso8601String(),
      recurring: _newRecurring,
    );
    setState(() {
      _plans.insert(0, plan);
      _titleController.clear();
      _newRecurring = false;
    });
    await _savePlans();
  }

  void _togglePlan(PlanItem plan) {
    final today = todayLocal();
    PlanItem updated;
    if (plan.recurring) {
      final dates = List<String>.from(plan.completedDates);
      dates.contains(today) ? dates.remove(today) : dates.add(today);
      updated = PlanItem(
        id: plan.id,
        title: plan.title,
        subject: plan.subject,
        completed: dates.contains(today),
        createdAt: plan.createdAt,
        completedAt: plan.completedAt,
        recurring: true,
        completedDates: dates,
      );
    } else {
      updated = PlanItem(
        id: plan.id,
        title: plan.title,
        subject: plan.subject,
        completed: !plan.completed,
        createdAt: plan.createdAt,
        completedAt:
            !plan.completed ? DateTime.now().toIso8601String() : null,
        recurring: false,
        completedDates: plan.completedDates,
      );
    }
    final idx = _plans.indexWhere((p) => p.id == plan.id);
    if (idx == -1) return;
    setState(() => _plans[idx] = updated);
    _savePlans();
  }

  void _deletePlan(PlanItem plan) {
    setState(() => _plans.removeWhere((p) => p.id == plan.id));
    _savePlans();
  }

  Future<void> _completeAll() async {
    final today = todayLocal();
    setState(() {
      _plans = _plans.map((p) {
        if (!_isCompletedToday(p)) {
          if (p.recurring) {
            final dates = List<String>.from(p.completedDates)..add(today);
            return PlanItem(
              id: p.id,
              title: p.title,
              subject: p.subject,
              completed: true,
              createdAt: p.createdAt,
              completedAt: p.completedAt,
              recurring: true,
              completedDates: dates,
            );
          }
          return PlanItem(
            id: p.id,
            title: p.title,
            subject: p.subject,
            completed: true,
            createdAt: p.createdAt,
            completedAt: DateTime.now().toIso8601String(),
            recurring: false,
            completedDates: p.completedDates,
          );
        }
        return p;
      }).toList();
    });
    await _savePlans();
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        _buildAddForm(),
        const SizedBox(height: 16),
        _buildProgressCard(),
        const SizedBox(height: 16),
        _buildPlanList(),
      ],
    );
  }

  // ── 添加表单（页面 platter，非玻璃卡内，可用玻璃按钮） ──
  Widget _buildAddForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _titleController,
                decoration: const InputDecoration(
                  hintText: '添加今日计划…',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
                onSubmitted: (_) => _addPlan(),
              ),
            ),
            const SizedBox(width: 8),
            GlassButton(
              icon: const Icon(CupertinoIcons.plus),
              onTap: _addPlan,
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            // 科目选择
            for (final s in SubjectType.values)
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  label: Text(s.shortName),
                  selected: _newSubject == s,
                  selectedColor: s.color.withValues(alpha: 0.25),
                  onSelected: (v) => setState(
                    () => _newSubject = v ? s : null,
                  ),
                ),
              ),
            const Spacer(),
            // 循环开关
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('循环', style: TextStyle(fontSize: 12)),
                Switch(
                  value: _newRecurring,
                  onChanged: (v) => setState(() => _newRecurring = v),
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }

  // ── 进度卡 ──
  Widget _buildProgressCard() {
    return GlassContainer.card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('今日进度', style: TextStyle(fontSize: 14)),
                Text(
                  '$_completedCount / $_totalCount',
                  style: TextStyle(
                    fontSize: 13,
                    color: Theme.of(context).hintColor,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: _progress,
                minHeight: 8,
                backgroundColor:
                    Theme.of(context).colorScheme.surfaceContainerHighest,
                valueColor:
                    const AlwaysStoppedAnimation(KaoyanColors.primary),
              ),
            ),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: _totalCount == 0 ? null : _completeAll,
                  child: const Text('全部完成'),
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
    if (_todayPlans.isEmpty) {
      return const GlassContainer.card(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Column(
            children: [
              Icon(CupertinoIcons.checkmark_seal, size: 40),
              SizedBox(height: 12),
              Text('今天还没有计划，添加一个开始吧'),
            ],
          ),
        ),
      );
    }
    return GlassGroupedSection(
      header: const Text('今日计划'),
      children: [
        for (final plan in _todayPlans)
          GlassListTile(
            leading: Icon(
              _isCompletedToday(plan)
                  ? CupertinoIcons.checkmark_circle_fill
                  : CupertinoIcons.circle,
              color: _isCompletedToday(plan)
                  ? KaoyanColors.primary
                  : Theme.of(context).hintColor,
            ),
            title: Text(
              plan.title,
              style: TextStyle(
                decoration: _isCompletedToday(plan)
                    ? TextDecoration.lineThrough
                    : null,
              ),
            ),
            subtitle: plan.subject != null || plan.recurring
                ? Text(
                    [
                      if (plan.subject != null) plan.subject!.shortName,
                      if (plan.recurring) '循环',
                    ].join(' · '),
                  )
                : null,
            onTap: () => _togglePlan(plan),
            trailing: GestureDetector(
              onTap: () => _deletePlan(plan),
              child: Icon(
                CupertinoIcons.trash,
                size: 18,
                color: Theme.of(context).hintColor,
              ),
            ),
          ),
      ],
    );
  }
}
