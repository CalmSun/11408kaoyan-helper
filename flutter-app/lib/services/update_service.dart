import 'dart:convert';

import 'package:http/http.dart' as http;

/// 更新信息。
class UpdateInfo {
  const UpdateInfo({
    required this.version,
    required this.tagName,
    this.notes = '',
    this.releaseUrl = '',
    this.downloadUrl = '',
  });

  final String version; // 语义版本，如 3.6.6
  final String tagName; // 如 v3.6.6
  final String notes;
  final String releaseUrl;
  final String downloadUrl;
}

/// 更新检测服务（对应 Electron Settings.vue 的「项目与更新」）。
///
/// 通过 GitHub Releases API 获取最新版本，与当前版本做语义比较。
/// 「无感升级」的第一阶段：检测 + 一键跳转下载；全自动下载安装
/// 需要平台专属 updater（后续接入）。
class UpdateService {
  UpdateService._();
  static final UpdateService instance = UpdateService._();

  /// 当前版本（与 pubspec.yaml 保持一致）
  static const String currentVersion = '3.6.5';

  static const String _repo = 'CalmSun/11408kaoyan-helper';

  /// 比较语义版本，返回 1/-1/0。
  static int compareVersion(String a, String b) {
    List<int> parse(String s) {
      final core = s.split('+').first;
      final parts = core.split('.');
      return [
        for (final p in parts) int.tryParse(p) ?? 0,
        ...List.filled(3, 0),
      ].take(3).toList();
    }

    final va = parse(a);
    final vb = parse(b);
    for (var i = 0; i < 3; i++) {
      if (va[i] != vb[i]) return va[i].compareTo(vb[i]);
    }
    return 0;
  }

  /// 查询最新版本；无网络/失败返回 null。
  Future<UpdateInfo?> checkUpdate() async {
    try {
      final resp = await http.get(
        Uri.parse('https://api.github.com/repos/$_repo/releases/latest'),
        headers: const {'Accept': 'application/vnd.github+json'},
      ).timeout(const Duration(seconds: 10));
      if (resp.statusCode != 200) return null;
      final data = jsonDecode(resp.body) as Map<String, dynamic>;
      final tag = (data['tag_name'] as String? ?? '').trim();
      final version = tag.startsWith('v') ? tag.substring(1) : tag;
      if (version.isEmpty) return null;
      final assets = (data['assets'] as List? ?? []);
      String download = '';
      if (assets.isNotEmpty) {
        final first = (assets.first as Map)['browser_download_url'] as String?;
        download = first ?? '';
      }
      return UpdateInfo(
        version: version,
        tagName: tag,
        notes: (data['body'] as String? ?? ''),
        releaseUrl: (data['html_url'] as String? ?? ''),
        downloadUrl: download,
      );
    } catch (_) {
      return null;
    }
  }
}
