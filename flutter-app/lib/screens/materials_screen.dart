import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/storage_service.dart';
import '../theme/kaoyan_theme.dart';

/// 学习资料（对应 Electron Materials.vue 的精简版：本地目录浏览 + 打开文件）。
///
/// PDF 预览依赖 Electron 的 PDFium，Flutter 端改用系统默认应用打开。
class MaterialsScreen extends StatefulWidget {
  const MaterialsScreen({super.key});

  @override
  State<MaterialsScreen> createState() => _MaterialsScreenState();
}

class _MaterialsScreenState extends State<MaterialsScreen> {
  String _dir = '';
  List<FileSystemEntity> _entries = [];

  @override
  void initState() {
    super.initState();
    _dir = StorageService.instance.getString('materials_dir') ?? '';
    if (_dir.isNotEmpty) _listDir();
  }

  void _listDir() {
    try {
      final entries = Directory(_dir)
          .listSync()
        ..sort((a, b) {
          final ad = a is Directory;
          final bd = b is Directory;
          if (ad != bd) return ad ? -1 : 1;
          return a.path.compareTo(b.path);
        });
      setState(() => _entries = entries);
    } catch (_) {
      setState(() => _entries = []);
    }
  }

  Future<void> _pickDir() async {
    final path = await FilePicker.getDirectoryPath();
    if (path != null) {
      setState(() => _dir = path);
      await StorageService.instance.setString('materials_dir', path);
      _listDir();
    }
  }

  void _open(FileSystemEntity e) {
    if (e is Directory) {
      setState(() => _dir = e.path);
      _listDir();
    } else {
      launchUrl(Uri.file(e.path), mode: LaunchMode.externalApplication);
    }
  }

  void _goUp() {
    final parent = File(_dir).parent.path;
    setState(() => _dir = parent);
    _listDir();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  _dir.isEmpty ? '未选择资料目录' : _dir,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                      fontSize: 13, color: Theme.of(context).hintColor),
                ),
              ),
              const SizedBox(width: 8),
              GlassButton(
                icon: const Icon(CupertinoIcons.folder_fill),
                onTap: _pickDir,
              ),
            ],
          ),
        ),
        if (_dir.isNotEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                if (_dir.length > 3)
                  TextButton.icon(
                    onPressed: _goUp,
                    icon: const Icon(CupertinoIcons.arrow_up, size: 16),
                    label: const Text('上级目录'),
                  ),
                const Spacer(),
                Text('${_entries.length} 项',
                    style: TextStyle(
                        fontSize: 12, color: Theme.of(context).hintColor)),
              ],
            ),
          ),
        Expanded(
          child: _dir.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(CupertinoIcons.folder,
                          size: 56, color: Colors.grey),
                      const SizedBox(height: 12),
                      const Text('选择学习资料文件夹开始浏览'),
                      const SizedBox(height: 12),
                      GlassButton(
                        icon: const Icon(CupertinoIcons.folder_fill),
                        onTap: _pickDir,
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  itemCount: _entries.length,
                  itemBuilder: (context, i) {
                    final e = _entries[i];
                    final isDir = e is Directory;
                    final name = e.path.split(RegExp(r'[/\\]')).last;
                    return GlassListTile(
                      leading: Icon(
                        isDir
                            ? CupertinoIcons.folder_fill
                            : CupertinoIcons.doc_text,
                        color: isDir
                            ? KaoyanColors.primary
                            : Theme.of(context).hintColor,
                      ),
                      title: Text(name),
                      onTap: () => _open(e),
                    );
                  },
                ),
        ),
      ],
    );
  }
}
