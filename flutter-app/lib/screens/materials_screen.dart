import 'dart:convert';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import 'package:pdfrx/pdfrx.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/bilibili_api.dart';
import '../services/storage_service.dart';
import '../theme/kaoyan_theme.dart';

/// 学习资料文件树节点
class MaterialNode {
  final String name;
  final String path;
  final bool isDir;
  final String ext; // 小写扩展名（含点，如 .pdf）
  final int size;
  final List<MaterialNode> children;

  MaterialNode({
    required this.name,
    required this.path,
    required this.isDir,
    this.ext = '',
    this.size = 0,
    List<MaterialNode>? children,
  }) : children = children ?? [];
}

/// 学习资料（完整迁移 Electron Materials.vue）。
///
/// - 目录递归扫描 + 文件树（展开折叠、按类型过滤）
/// - PDF 内嵌预览（pdfrx，翻页 / 跳页 / 进度保存）
/// - 图片内嵌预览；其他类型（视频/音频/文档）调系统默认应用打开
class MaterialsScreen extends StatefulWidget {
  const MaterialsScreen({super.key});

  @override
  State<MaterialsScreen> createState() => _MaterialsScreenState();
}

class _MaterialsScreenState extends State<MaterialsScreen> {
  static const List<String> _pdfExts = ['.pdf'];
  static const List<String> _imgExts = [
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'
  ];
  static const List<String> _videoExts = [
    '.mp4', '.mkv', '.avi', '.mov', '.flv', '.wmv', '.webm'
  ];
  static const List<String> _audioExts = [
    '.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac'
  ];

  String _dir = '';
  List<MaterialNode> _roots = [];
  String _filter = 'all';
  Set<String> _expanded = {};
  MaterialNode? _current;
  Map<String, int> _progress = {}; // path -> 页码

  PdfViewerController? _pdfController;
  int _pdfPage = 1;
  int _pdfPages = 0;

  // B站大学
  int _mode = 0; // 0=本地资料, 1=B站大学
  String _biliCategory = '数学';
  List<Map<String, dynamic>> _biliResults = [];
  bool _biliLoading = false;
  final _biliSearchCtl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _dir = StorageService.instance.getString('materials_dir') ?? '';
    _loadProgress();
    if (_dir.isNotEmpty) _scanDir();
  }

  @override
  void dispose() {
    _biliSearchCtl.dispose();
    super.dispose();
  }

  // ── 目录扫描 ───────────────────────────────────────────────

  void _scanDir() {
    final nodes = <MaterialNode>[];
    void scan(String path, List<MaterialNode> out) {
      try {
        final entries = Directory(path)
            .listSync()
          ..sort((a, b) {
            final ad = a is Directory;
            final bd = b is Directory;
            if (ad != bd) return ad ? -1 : 1;
            return a.path.toLowerCase().compareTo(b.path.toLowerCase());
          });
        for (final e in entries) {
          if (e is Directory) {
            final node = MaterialNode(
              name: _nameOf(e.path),
              path: e.path,
              isDir: true,
            );
              out.add(node);
              scan(e.path, node.children);
          } else if (e is File) {
            out.add(MaterialNode(
              name: _nameOf(e.path),
              path: e.path,
              isDir: false,
              ext: _extOf(e.path),
              size: e.lengthSync(),
            ));
          }
        }
      } catch (_) {}
    }

    scan(_dir, nodes);
    setState(() {
      _roots = nodes;
      // 默认展开第一层
      _expanded = nodes.where((n) => n.isDir).map((n) => n.path).toSet();
    });
  }

  String _nameOf(String path) => path.split(RegExp(r'[/\\]')).last;

  String _extOf(String path) {
    final i = path.lastIndexOf('.');
    return i > 0 ? path.substring(i).toLowerCase() : '';
  }

  Future<void> _pickDir() async {
    final path = await FilePicker.getDirectoryPath();
    if (path != null) {
      setState(() => _dir = path);
      await StorageService.instance.setString('materials_dir', path);
      _scanDir();
    }
  }

  // ── 过滤 / 图标 ────────────────────────────────────────────

  bool _matchesFilter(MaterialNode n) {
    if (n.isDir) return true;
    switch (_filter) {
      case 'pdf':
        return _pdfExts.contains(n.ext);
      case 'image':
        return _imgExts.contains(n.ext);
      case 'video':
        return _videoExts.contains(n.ext);
      case 'audio':
        return _audioExts.contains(n.ext);
      case 'other':
        return !_pdfExts.contains(n.ext) &&
            !_imgExts.contains(n.ext) &&
            !_videoExts.contains(n.ext) &&
            !_audioExts.contains(n.ext);
      default:
        return true;
    }
  }

  IconData _iconOf(MaterialNode n) {
    if (n.isDir) return CupertinoIcons.folder_fill;
    if (_pdfExts.contains(n.ext)) return CupertinoIcons.doc_text_fill;
    if (_imgExts.contains(n.ext)) return CupertinoIcons.photo_fill;
    if (_videoExts.contains(n.ext)) return CupertinoIcons.videocam_fill;
    if (_audioExts.contains(n.ext)) return CupertinoIcons.music_note;
    return CupertinoIcons.doc;
  }

  Color _iconColorOf(MaterialNode n) {
    if (n.isDir) return KaoyanColors.primary;
    if (_pdfExts.contains(n.ext)) return Colors.redAccent;
    if (_imgExts.contains(n.ext)) return const Color(0xFF22C55E);
    if (_videoExts.contains(n.ext)) return const Color(0xFF8A4AF7);
    if (_audioExts.contains(n.ext)) return const Color(0xFF00B0D6);
    return Theme.of(context).hintColor;
  }

  String _formatSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    if (bytes < 1024 * 1024 * 1024) {
      return '${(bytes / 1024 / 1024).toStringAsFixed(1)} MB';
    }
    return '${(bytes / 1024 / 1024 / 1024).toStringAsFixed(1)} GB';
  }

  // ── 打开文件 ───────────────────────────────────────────────

  Future<void> _openNode(MaterialNode n) async {
    if (n.isDir) {
      setState(() {
        if (_expanded.contains(n.path)) {
          _expanded.remove(n.path);
        } else {
          _expanded.add(n.path);
        }
      });
      return;
    }
    final ext = n.ext;
    if (_pdfExts.contains(ext)) {
      _openPdf(n);
    } else if (_imgExts.contains(ext)) {
      setState(() => _current = n);
    } else {
      // 视频 / 音频 / 其他 → 系统默认应用打开
      try {
        await launchUrl(Uri.file(n.path),
            mode: LaunchMode.externalApplication);
      } catch (_) {}
    }
  }

  void _openPdf(MaterialNode n) {
    _pdfController = PdfViewerController();
    _pdfPage = _progress[n.path] ?? 1;
    _pdfPages = 0;
    setState(() => _current = n);
  }

  // ── 进度持久化 ────────────────────────────────────────────

  void _loadProgress() {
    final raw = StorageService.instance.getString('materials_progress');
    if (raw == null || raw.isEmpty) return;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map) {
        _progress = decoded.map(
            (k, v) => MapEntry(k.toString(), int.tryParse('$v') ?? 1));
      }
    } catch (_) {}
  }

  Future<void> _saveProgress(String path, int page) async {
    _progress[path] = page;
    await StorageService.instance
        .setString('materials_progress', jsonEncode(_progress));
  }

  // ── 构建 ───────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _buildModeSwitch(),
        Expanded(
          child: _mode == 0 ? _buildLocal() : _buildBiliUniversity(),
        ),
      ],
    );
  }

  Widget _buildModeSwitch() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
      child: Row(
        children: [
          _modeChip(0, '本地资料', CupertinoIcons.folder),
          const SizedBox(width: 8),
          _modeChip(1, 'B站大学', CupertinoIcons.play_rectangle),
        ],
      ),
    );
  }

  Widget _modeChip(int mode, String label, IconData icon) {
    final selected = _mode == mode;
    return ChoiceChip(
      avatar: Icon(icon,
          size: 16,
          color: selected ? Colors.white : Theme.of(context).hintColor),
      label: Text(label),
      selected: selected,
      onSelected: (_) => setState(() => _mode = mode),
      labelStyle: TextStyle(
          color: selected ? Colors.white : Theme.of(context).hintColor),
      selectedColor: KaoyanColors.primary,
    );
  }

  Widget _buildLocal() {
    if (_dir.isEmpty) {
      return _buildEmpty();
    }
    // 桌面：左右分栏；移动：上下
    final wide = MediaQuery.of(context).size.width > 700;
    if (wide) {
      return Row(
        children: [
          SizedBox(width: 300, child: _buildFileTree()),
          const VerticalDivider(width: 1),
          Expanded(child: _buildPreview()),
        ],
      );
    }
    return Column(
      children: [
        Expanded(flex: 2, child: _buildFileTree()),
        const Divider(height: 1),
        Expanded(flex: 3, child: _buildPreview()),
      ],
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(CupertinoIcons.folder, size: 56, color: Colors.grey),
          const SizedBox(height: 12),
          const Text('选择学习资料文件夹开始浏览'),
          const SizedBox(height: 16),
          GlassButton(
            icon: const Icon(CupertinoIcons.folder_fill),
            onTap: _pickDir,
          ),
        ],
      ),
    );
  }

  Widget _buildFileTree() {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  _dir,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                      fontSize: 12, color: Theme.of(context).hintColor),
                ),
              ),
              IconButton(
                icon: const Icon(CupertinoIcons.folder_fill, size: 18),
                onPressed: _pickDir,
              ),
              IconButton(
                icon: const Icon(CupertinoIcons.arrow_clockwise, size: 18),
                onPressed: _scanDir,
              ),
            ],
          ),
        ),
        _buildFilterChips(),
        Expanded(
          child: ListView(
            children: _buildTreeRows(_roots, 0),
          ),
        ),
      ],
    );
  }

  Widget _buildFilterChips() {
    const filters = [
      ('all', '全部'),
      ('pdf', 'PDF'),
      ('image', '图片'),
      ('video', '视频'),
      ('audio', '音频'),
      ('other', '其他'),
    ];
    return SizedBox(
      height: 36,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        children: [
          for (final f in filters)
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: ChoiceChip(
                label: Text(f.$2),
                selected: _filter == f.$1,
                onSelected: (_) => setState(() => _filter = f.$1),
                labelStyle: TextStyle(
                    fontSize: 12,
                    color: _filter == f.$1
                        ? Colors.white
                        : Theme.of(context).hintColor),
                selectedColor: KaoyanColors.primary,
              ),
            ),
        ],
      ),
    );
  }

  List<Widget> _buildTreeRows(List<MaterialNode> nodes, int depth) {
    final rows = <Widget>[];
    for (final n in nodes) {
      if (!_matchesFilter(n)) continue;
      if (n.isDir) {
        final expanded = _expanded.contains(n.path);
        rows.add(ListTile(
          dense: true,
          contentPadding: EdgeInsets.only(left: 8.0 + depth * 16),
          leading: Icon(
            expanded
                ? CupertinoIcons.chevron_down
                : CupertinoIcons.chevron_right,
            size: 16,
            color: Theme.of(context).hintColor,
          ),
          title: Row(
            children: [
              const Icon(CupertinoIcons.folder_fill,
                  size: 16, color: KaoyanColors.primary),
              const SizedBox(width: 6),
              Expanded(
                child: Text(n.name,
                    maxLines: 1, overflow: TextOverflow.ellipsis),
              ),
            ],
          ),
          onTap: () => _openNode(n),
        ));
        if (expanded) rows.addAll(_buildTreeRows(n.children, depth + 1));
      } else {
        rows.add(ListTile(
          dense: true,
          contentPadding: EdgeInsets.only(left: 8.0 + depth * 16),
          leading: Icon(_iconOf(n), size: 16, color: _iconColorOf(n)),
          title: Text(n.name, maxLines: 1, overflow: TextOverflow.ellipsis),
          subtitle: n.size > 0
              ? Text(_formatSize(n.size), style: const TextStyle(fontSize: 10))
              : null,
          selected: _current?.path == n.path,
          onTap: () => _openNode(n),
        ));
      }
    }
    return rows;
  }

  Widget _buildPreview() {
    final node = _current;
    if (node == null) {
      return Center(
        child: Text('点击左侧文件预览',
            style: TextStyle(color: Theme.of(context).hintColor)),
      );
    }
    if (_pdfExts.contains(node.ext)) return _buildPdfPreview(node);
    if (_imgExts.contains(node.ext)) return _buildImagePreview(node);
    return Center(child: Text('该类型已用系统应用打开：${node.name}'));
  }

  Widget _buildPdfPreview(MaterialNode node) {
    return Column(
      children: [
        _buildPdfToolbar(node),
        Expanded(
          child: PdfViewer.file(
            node.path,
            controller: _pdfController,
            initialPageNumber: _pdfPage,
            params: PdfViewerParams(
              onViewerReady: (document, controller) {
                setState(() => _pdfPages = document.pages.length);
              },
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPdfToolbar(MaterialNode node) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Row(
        children: [
          Text(node.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 13)),
          const Spacer(),
          IconButton(
            icon: const Icon(CupertinoIcons.backward_end, size: 18),
            onPressed: _pdfPage > 1
                ? () {
                    _pdfPage--;
                    _pdfController?.goToPage(pageNumber: _pdfPage);
                    _saveProgress(node.path, _pdfPage);
                  }
                : null,
          ),
          Text('$_pdfPage / ${_pdfPages > 0 ? _pdfPages : '?'}',
              style: const TextStyle(fontSize: 12)),
          IconButton(
            icon: const Icon(CupertinoIcons.forward_end, size: 18),
            onPressed: _pdfPages == 0 || _pdfPage < _pdfPages
                ? () {
                    _pdfPage++;
                    _pdfController?.goToPage(pageNumber: _pdfPage);
                    _saveProgress(node.path, _pdfPage);
                  }
                : null,
          ),
        ],
      ),
    );
  }

  Widget _buildImagePreview(MaterialNode node) {
    return Stack(
      children: [
        Center(
          child: InteractiveViewer(
            child: Image.file(File(node.path), fit: BoxFit.contain),
          ),
        ),
        Positioned(
          top: 8,
          right: 8,
          child: GlassButton(
            icon: const Icon(CupertinoIcons.arrow_up_right_square, size: 16),
            onTap: () =>
                launchUrl(Uri.file(node.path), mode: LaunchMode.externalApplication),
          ),
        ),
      ],
    );
  }

  // ── B站大学 ────────────────────────────────────────────────

  Widget _buildBiliUniversity() {
    return Column(
      children: [
        // 学科分类
        SizedBox(
          height: 40,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            children: [
              for (final cat in BilibiliApi.courseCategories.keys)
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: ChoiceChip(
                    label: Text(cat),
                    selected: _biliCategory == cat,
                    onSelected: (_) => setState(() => _biliCategory = cat),
                    labelStyle: TextStyle(
                        fontSize: 12,
                        color: _biliCategory == cat
                            ? Colors.white
                            : Theme.of(context).hintColor),
                    selectedColor: KaoyanColors.primary,
                  ),
                ),
            ],
          ),
        ),
        // 搜索框
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 4, 12, 4),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _biliSearchCtl,
                  decoration: const InputDecoration(
                    hintText: '搜索 B站考研课程…',
                    prefixIcon: Icon(CupertinoIcons.search, size: 18),
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                  onSubmitted: (_) => _biliSearch(_biliSearchCtl.text),
                ),
              ),
              const SizedBox(width: 8),
              GlassButton(
                icon: const Icon(CupertinoIcons.search),
                onTap: () => _biliSearch(_biliSearchCtl.text),
              ),
            ],
          ),
        ),
        // 推荐关键词
        _buildBiliKeywords(),
        // 搜索结果
        Expanded(
          child: _biliLoading
              ? const Center(child: CircularProgressIndicator())
              : _biliResults.isEmpty
                  ? Center(
                      child: Text('点击关键词或搜索，查看 B站考研公开课',
                          style:
                              TextStyle(color: Theme.of(context).hintColor)),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.fromLTRB(12, 4, 12, 16),
                      itemCount: _biliResults.length,
                      itemBuilder: (context, i) =>
                          _buildBiliVideo(_biliResults[i]),
                    ),
        ),
      ],
    );
  }

  Widget _buildBiliKeywords() {
    final keywords = BilibiliApi.courseCategories[_biliCategory] ?? [];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: Wrap(
        spacing: 6,
        runSpacing: 4,
        children: [
          for (final k in keywords)
            ActionChip(
              label: Text(k, style: const TextStyle(fontSize: 12)),
              onPressed: () => _biliSearch(k),
            ),
        ],
      ),
    );
  }

  Future<void> _biliSearch(String keyword) async {
    final kw = keyword.trim();
    if (kw.isEmpty) return;
    setState(() => _biliLoading = true);
    final results = await BilibiliApi.searchVideos(kw);
    if (!mounted) return;
    setState(() {
      _biliResults = results;
      _biliLoading = false;
    });
    // 接口风控失败 → 降级跳转 B站搜索页
    if (results.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('未获取到结果，正在打开 B站搜索页…')),
      );
      launchUrl(Uri.parse(BilibiliApi.searchUrl(kw)),
          mode: LaunchMode.externalApplication);
    }
  }

  Widget _buildBiliVideo(Map<String, dynamic> v) {
    final pic = v['pic']?.toString() ?? '';
    return GlassListTile(
      leading: pic.isNotEmpty
          ? ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: Image.network(pic,
                  width: 72,
                  height: 44,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(
                      width: 72,
                      height: 44,
                      color: Theme.of(context).colorScheme.surfaceContainerHighest)),
            )
          : const Icon(CupertinoIcons.play_rectangle, size: 40),
      title: Text(v['title']?.toString() ?? '',
          maxLines: 2, overflow: TextOverflow.ellipsis),
      subtitle: Text(
          '${v['author']?.toString() ?? ''} · ${_formatPlay(v['play'])} · ${v['duration']?.toString() ?? ''}',
          maxLines: 1,
          overflow: TextOverflow.ellipsis),
      onTap: () => launchUrl(Uri.parse(BilibiliApi.videoUrl(v['bvid'])),
          mode: LaunchMode.externalApplication),
    );
  }

  String _formatPlay(dynamic play) {
    final n = int.tryParse('$play') ?? 0;
    if (n >= 10000) return '${(n / 10000).toStringAsFixed(1)}万播放';
    return '$n播放';
  }
}
