import 'dart:convert';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/models.dart';
import '../services/app_store.dart';
import '../services/storage_service.dart';
import '../services/theme_controller.dart';
import '../services/user_service.dart';
import '../theme/kaoyan_theme.dart';

/// 设置页面（对应 Electron Settings.vue）。
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late final TextEditingController _examNameCtl =
      TextEditingController(text: AppStore.instance.examName);

  static const List<Color> _subjectColors = [
    Color(0xFF4A6CF7),
    Color(0xFF8A4AF7),
    Color(0xFF00B0D6),
    Color(0xFFF87171),
    Color(0xFF34D399),
    Color(0xFFFBBF24),
    Color(0xFFF472B6),
    Color(0xFFFB923C),
  ];

  @override
  void dispose() {
    _examNameCtl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final store = AppStore.instance;
    return ListenableBuilder(
      listenable: Listenable.merge(
          [store, ThemeController.instance]),
      builder: (context, _) {
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            _section('外观'),
            _buildThemeCard(context),
            const SizedBox(height: 14),
            _section('考试设置'),
            _buildExamCard(context),
            const SizedBox(height: 14),
            _section('考试科目'),
            _buildSubjectsCard(context),
            const SizedBox(height: 14),
            _section('番茄钟设置'),
            _buildPomodoroCard(context),
            const SizedBox(height: 14),
            _section('账号'),
            _buildAccountCard(context),
            const SizedBox(height: 14),
            _section('数据管理'),
            _buildDataCard(context),
            const SizedBox(height: 14),
            _section('关于'),
            _buildAboutCard(context),
          ],
        );
      },
    );
  }

  Widget _section(String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(title,
          style: TextStyle(fontSize: 12, color: Theme.of(context).hintColor)),
    );
  }

  Widget _wrapCard(List<Widget> children) {
    return GlassContainer.card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        child: Column(children: children),
      ),
    );
  }

  // ── 主题 ──
  Widget _buildThemeCard(BuildContext context) {
    final tc = ThemeController.instance;
    return _wrapCard([
      ListTile(
        contentPadding: EdgeInsets.zero,
        leading: const Icon(CupertinoIcons.paintbrush, color: KaoyanColors.primary),
        title: const Text('主题模式'),
        trailing: SegmentedButton<ThemeMode>(
          segments: const [
            ButtonSegment(value: ThemeMode.system, label: Text('跟随系统')),
            ButtonSegment(value: ThemeMode.light, label: Text('浅色')),
            ButtonSegment(value: ThemeMode.dark, label: Text('深色')),
          ],
          selected: {tc.mode},
          onSelectionChanged: (s) => tc.setMode(s.first),
        ),
      ),
    ]);
  }

  // ── 考试设置 ──
  Widget _buildExamCard(BuildContext context) {
    final store = AppStore.instance;
    return _wrapCard([
      TextField(
        controller: _examNameCtl,
        decoration: const InputDecoration(
          labelText: '考试名称',
          border: OutlineInputBorder(),
          isDense: true,
        ),
      ),
      const SizedBox(height: 12),
      ListTile(
        contentPadding: EdgeInsets.zero,
        leading: const Icon(CupertinoIcons.calendar, color: KaoyanColors.primary),
        title: const Text('考试日期'),
        subtitle: Text(store.examDate),
        trailing: const Icon(CupertinoIcons.chevron_right, size: 16),
        onTap: () async {
          final current = DateTime.tryParse(store.examDate) ?? DateTime.now();
          final picked = await showDatePicker(
            context: context,
            initialDate: current,
            firstDate: DateTime.now(),
            lastDate: DateTime.now().add(const Duration(days: 365 * 3)),
          );
          if (picked != null) {
            final dateStr =
                '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
            await store.setExamDate(dateStr, name: _examNameCtl.text);
          }
        },
      ),
      Align(
        alignment: Alignment.centerRight,
        child: FilledButton(
          onPressed: () async {
            await store.setExamDate(store.examDate, name: _examNameCtl.text);
            if (!context.mounted) return;
            ScaffoldMessenger.of(context)
                .showSnackBar(const SnackBar(content: Text('考试设置已保存')));
          },
          child: const Text('保存考试设置'),
        ),
      ),
    ]);
  }

  // ── 考试科目管理 ──
  Widget _buildSubjectsCard(BuildContext context) {
    final store = AppStore.instance;
    return _wrapCard([
      for (final s in store.allSubjects)
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: Container(
            width: 18,
            height: 18,
            decoration: BoxDecoration(color: s.color, shape: BoxShape.circle),
          ),
          title: Text(s.name),
          subtitle: Text('满分 ${s.fullScore}'),
          trailing: store.isCustomSubject(s.id)
              ? Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      icon: const Icon(CupertinoIcons.pencil, size: 16),
                      onPressed: () => _showSubjectDialog(subject: s),
                    ),
                    IconButton(
                      icon: const Icon(CupertinoIcons.trash,
                          size: 16, color: Color(0xFFEF4444)),
                      onPressed: () => store.removeCustomSubject(s.id),
                    ),
                  ],
                )
              : Text('内置',
                  style:
                      TextStyle(fontSize: 11, color: Theme.of(context).hintColor)),
        ),
      Align(
        alignment: Alignment.centerRight,
        child: TextButton.icon(
          onPressed: () => _showSubjectDialog(),
          icon: const Icon(CupertinoIcons.plus, size: 16),
          label: const Text('添加自定义科目'),
        ),
      ),
    ]);
  }

  void _showSubjectDialog({Subject? subject}) {
    final isEditing = subject != null;
    final nameCtl = TextEditingController(text: subject?.name ?? '');
    final scoreCtl =
        TextEditingController(text: '${subject?.fullScore ?? 100}');
    var colorValue =
        subject?.colorValue ?? KaoyanColors.primary.toARGB32();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlg) => AlertDialog(
          title: Text(isEditing ? '编辑科目' : '添加自定义科目'),
          content: SizedBox(
            width: 360,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameCtl,
                  decoration: const InputDecoration(
                      labelText: '科目名称（如「专业课一」）', isDense: true),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: scoreCtl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                      labelText: '满分（如 150）', isDense: true),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    const Text('颜色'),
                    const SizedBox(width: 12),
                    for (final c in _subjectColors)
                      GestureDetector(
                        onTap: () => setDlg(() => colorValue = c.toARGB32()),
                        child: Container(
                          margin: const EdgeInsets.symmetric(horizontal: 4),
                          width: 26,
                          height: 26,
                          decoration: BoxDecoration(
                            color: c,
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: colorValue == c.toARGB32()
                                  ? Colors.white
                                  : Colors.transparent,
                              width: 2,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('取消')),
            FilledButton(
              onPressed: () async {
                final name = nameCtl.text.trim();
                final score = int.tryParse(scoreCtl.text) ?? 100;
                if (name.isEmpty) {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                      const SnackBar(content: Text('请输入科目名称')));
                  return;
                }
                final store = AppStore.instance;
                if (isEditing) {
                  await store.updateCustomSubject(Subject(
                    id: subject.id,
                    name: name,
                    shortName: name,
                    colorValue: colorValue,
                    fullScore: score,
                  ));
                } else {
                  await store.addCustomSubject(Subject(
                    id: 'custom_${DateTime.now().millisecondsSinceEpoch}',
                    name: name,
                    shortName: name,
                    colorValue: colorValue,
                    fullScore: score,
                  ));
                }
                if (!ctx.mounted) return;
                Navigator.of(ctx).pop();
              },
              child: const Text('保存'),
            ),
          ],
        ),
      ),
    );
  }

  // ── 番茄钟设置 ──
  Widget _buildPomodoroCard(BuildContext context) {
    final store = AppStore.instance;
    final s = store.pomodoroSettings;
    return _wrapCard([
      _sliderTile('工作时长', s.workDuration, 1, 60, ' 分钟',
          (v) => store.updatePomodoroSettings(s.copyWith(workDuration: v))),
      _sliderTile('短休息', s.breakDuration, 1, 30, ' 分钟',
          (v) => store.updatePomodoroSettings(s.copyWith(breakDuration: v))),
      _sliderTile('长休息', s.longBreakDuration, 5, 60, ' 分钟',
          (v) => store.updatePomodoroSettings(s.copyWith(longBreakDuration: v))),
      _sliderTile('长休息间隔', s.longBreakInterval, 2, 8, ' 个番茄',
          (v) => store.updatePomodoroSettings(s.copyWith(longBreakInterval: v))),
      _sliderTile('提醒音量', s.soundVolume, 0, 100, '%',
          (v) => store.updatePomodoroSettings(s.copyWith(soundVolume: v))),
    ]);
  }

  Widget _sliderTile(String label, int value, int min, int max, String unit,
      ValueChanged<int> onChange) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: const TextStyle(fontSize: 14)),
            Text('$value$unit',
                style: TextStyle(
                    fontSize: 13, color: Theme.of(context).hintColor)),
          ],
        ),
        Slider(
          value: value.toDouble(),
          min: min.toDouble(),
          max: max.toDouble(),
          divisions: (max - min) ~/ 1,
          onChanged: (v) => onChange(v.round()),
        ),
      ],
    );
  }

  // ── 账号 ──
  Widget _buildAccountCard(BuildContext context) {
    final user = UserService.instance;
    return _wrapCard([
      ListTile(
        contentPadding: EdgeInsets.zero,
        leading: const Icon(CupertinoIcons.person, color: KaoyanColors.primary),
        title: Text('当前账号：${user.displayName}'),
        trailing: user.isLoggedIn
            ? TextButton(
                onPressed: () async {
                  await user.logout();
                  await AppStore.instance.reload();
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context)
                      .showSnackBar(const SnackBar(content: Text('已退出登录')));
                },
                child: const Text('退出登录'),
              )
            : FilledButton(
                onPressed: () => _showLoginDialog(),
                child: const Text('登录 / 注册'),
              ),
      ),
      if (user.isLoggedIn)
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            style: TextButton.styleFrom(foregroundColor: const Color(0xFFEF4444)),
            onPressed: () => _deleteAccount(),
            child: const Text('删除账号'),
          ),
        ),
    ]);
  }

  void _showLoginDialog({bool register = false}) {
    final userCtl = TextEditingController();
    final passCtl = TextEditingController();
    var isRegister = register;
    final migrate = ValueNotifier(true);

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlg) => AlertDialog(
          title: Text(isRegister ? '注册新账号' : '登录账号'),
          content: SizedBox(
            width: 360,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: userCtl,
                  decoration: const InputDecoration(labelText: '用户名'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: passCtl,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: '密码'),
                ),
                if (!isRegister) ...[
                  const SizedBox(height: 10),
                  ValueListenableBuilder(
                    valueListenable: migrate,
                    builder: (_, v, __) => CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('登录时导入游客模式下的数据',
                          style: TextStyle(fontSize: 13)),
                      value: v,
                      onChanged: (val) => migrate.value = val ?? false,
                    ),
                  ),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () =>
                  setDlg(() => isRegister = !isRegister),
              child: Text(isRegister ? '已有账号？返回登录' : '没有账号？立即注册'),
            ),
            TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('取消')),
            FilledButton(
              onPressed: () {
                final u = userCtl.text.trim();
                final p = passCtl.text;
                final user = UserService.instance;
                final result = isRegister
                    ? user.register(u, p)
                    : user.login(u, p, migrate.value);
                if (!result.success) {
                  ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(result.message)));
                  return;
                }
                Navigator.of(ctx).pop();
                AppStore.instance.reload();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(result.message)));
                }
              },
              child: Text(isRegister ? '注册' : '登录'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _deleteAccount() async {
    final user = UserService.instance;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('删除账号'),
        content: Text('确定要删除账号「${user.displayName}」吗？该操作将删除账号下的所有数据，且不可恢复！'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('取消')),
          FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('确定删除')),
        ],
      ),
    );
    if (ok == true) {
      await user.deleteAccount(user.currentUsername);
      await AppStore.instance.reload();
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('账号已删除')));
      }
    }
  }

  // ── 数据管理 ──
  Widget _buildDataCard(BuildContext context) {
    return _wrapCard([
      ListTile(
        contentPadding: EdgeInsets.zero,
        leading: const Icon(CupertinoIcons.arrow_up_doc, color: KaoyanColors.primary),
        title: const Text('导出数据'),
        subtitle: const Text('备份当前账号全部数据为 JSON'),
        onTap: _exportData,
      ),
      ListTile(
        contentPadding: EdgeInsets.zero,
        leading: const Icon(CupertinoIcons.arrow_down_doc, color: KaoyanColors.primary),
        title: const Text('导入数据'),
        subtitle: const Text('从 JSON 文件恢复（覆盖同名数据）'),
        onTap: _importData,
      ),
      ListTile(
        contentPadding: EdgeInsets.zero,
        leading: const Icon(CupertinoIcons.trash, color: Color(0xFFEF4444)),
        title: const Text('清除全部数据', style: TextStyle(color: Color(0xFFEF4444))),
        onTap: _clearData,
      ),
    ]);
  }

  String _buildExportData() {
    final s = StorageService.instance;
    final prefix = s.currentUser.isEmpty
        ? 'kaoyan_helper_'
        : 'kaoyan_user_${s.currentUser}_';
    final data = <String, dynamic>{};
    for (final k in s.rawKeys()) {
      if (k.startsWith(prefix)) {
        final raw = s.getGlobalString(k);
        if (raw == null) continue;
        try {
          data[k.substring(prefix.length)] = jsonDecode(raw);
        } catch (_) {
          data[k.substring(prefix.length)] = raw;
        }
      }
    }
    return jsonEncode(data);
  }

  Future<void> _exportData() async {
    final data = _buildExportData();
    final date = DateTime.now().toIso8601String().substring(0, 10);
    try {
      final uri = await FilePicker.saveFile(
        dialogTitle: '导出数据',
        fileName: '考研助手备份_$date.json',
        bytes: utf8.encode(data),
      );
      if (uri != null && mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('数据导出成功')));
      }
    } catch (_) {
      // 降级：复制到剪贴板
      await Clipboard.setData(ClipboardData(text: data));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('已复制 JSON 到剪贴板，请粘贴保存')));
      }
    }
  }

  Future<void> _importData() async {
    try {
      final files = await FilePicker.pickFiles(
          type: FileType.custom, allowedExtensions: ['json']);
      if (files.isEmpty) return;
      final path = files.single.path;
      if (path == null) return;
      final content = File(path).readAsStringSync();
      if (!mounted) return;
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('确认导入'),
          content: const Text('导入数据会覆盖现有的所有同名数据，确定要继续吗？'),
          actions: [
            TextButton(
                onPressed: () => Navigator.of(ctx).pop(false),
                child: const Text('取消')),
            FilledButton(
                onPressed: () => Navigator.of(ctx).pop(true),
                child: const Text('确定导入')),
          ],
        ),
      );
      if (ok != true) return;
      final map = jsonDecode(content) as Map<String, dynamic>;
      final s = StorageService.instance;
      final prefix = s.currentUser.isEmpty
          ? 'kaoyan_helper_'
          : 'kaoyan_user_${s.currentUser}_';
      map.forEach((key, value) {
        s.setGlobalString('$prefix$key', jsonEncode(value));
      });
      await AppStore.instance.reload();
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('数据导入成功')));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('导入失败，请检查文件格式')));
      }
    }
  }

  Future<void> _clearData() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('警告'),
        content: const Text('确定要清除所有数据吗？此操作不可恢复！'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('取消')),
          FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('确定清除')),
        ],
      ),
    );
    if (ok == true) {
      await StorageService.instance.clearCurrentPrefix();
      await AppStore.instance.reload();
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('数据已清除')));
      }
    }
  }

  // ── 关于 ──
  Widget _buildAboutCard(BuildContext context) {
    return _wrapCard([
      const ListTile(
        contentPadding: EdgeInsets.zero,
        leading: Icon(CupertinoIcons.info_circle, color: KaoyanColors.primary),
        title: Text('版本'),
        trailing: Text('v3.6.5'),
      ),
      ListTile(
        contentPadding: EdgeInsets.zero,
        leading: const Icon(CupertinoIcons.link, color: KaoyanColors.primary),
        title: const Text('项目主页'),
        subtitle: const Text('github.com/CalmSun/11408kaoyan-helper'),
        onTap: () => launchUrl(
          Uri.parse('https://github.com/CalmSun/11408kaoyan-helper'),
          mode: LaunchMode.externalApplication,
        ),
      ),
      const ListTile(
        contentPadding: EdgeInsets.zero,
        leading: Icon(CupertinoIcons.book, color: KaoyanColors.primary),
        title: Text('考研助手 · 液态玻璃全平台版'),
        subtitle: Text('Windows / Linux / Android'),
      ),
    ]);
  }
}
