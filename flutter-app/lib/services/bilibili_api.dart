import 'dart:convert';

import 'package:http/http.dart' as http;

/// B站大学：考研公开课数据与搜索（参考 PiliPlus 的 B站 API 封装）。
class BilibiliApi {
  BilibiliApi._();

  static const Map<String, String> _headers = {
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://www.bilibili.com/',
    'Accept': 'application/json, text/plain, */*',
  };

  /// 预置考研公开课分类（学科 → 推荐搜索关键词）。
  /// 关键词即 B站搜索词，点击直接跳转 B站搜索结果，避免具体 BV 号失效。
  static const Map<String, List<String>> courseCategories = {
    '数学': [
      '武忠祥 高等数学',
      '张宇 考研数学',
      '李永乐 线性代数',
      '汤家凤 数学基础',
      '考研数学 真题讲解',
    ],
    '英语': [
      '唐迟 阅读理解',
      '田静 长难句',
      '刘晓艳 考研英语',
      '朱伟 恋练有词',
      '考研英语 作文模板',
    ],
    '政治': [
      '徐涛 考研政治',
      '腿姐陆寓丰 政治',
      '肖秀荣 政治',
      '考研政治 1000题',
      '考研政治 时政',
    ],
    '计算机 408': [
      '王道计算机 数据结构',
      '王道计算机 操作系统',
      '王道计算机 计算机网络',
      '王道计算机 组成原理',
      '考研408 真题',
    ],
  };

  /// 搜索 B站视频（公开 web 接口，带风控请求头）。
  ///
  /// 返回视频列表 [{bvid, title, author, play, duration, pic}]；
  /// 接口风控失败时返回空列表（UI 降级为跳转 B站搜索页）。
  static Future<List<Map<String, dynamic>>> searchVideos(
      String keyword) async {
    try {
      final uri = Uri.parse(
              'https://api.bilibili.com/x/web-interface/search/type')
          .replace(queryParameters: {
        'search_type': 'video',
        'keyword': keyword,
        'page': '1',
        'page_size': '30',
      });
      final resp = await http.get(uri, headers: _headers).timeout(
          const Duration(seconds: 8));
      if (resp.statusCode != 200) return [];
      final data = jsonDecode(utf8.decode(resp.bodyBytes));
      if (data is! Map || data['code'] != 0) return [];
      final result = (data['data'] as Map?)?['result'] as List? ?? [];
      return result
          .whereType<Map>()
          .map((r) => {
                'bvid': r['bvid']?.toString() ?? '',
                'title': r['title']?.toString() ?? '',
                'author': r['author']?.toString() ?? '',
                'play': r['play'] ?? 0,
                'duration': r['duration']?.toString() ?? '',
                'pic': r['pic']?.toString() ?? '',
              })
          .where((r) => r['bvid'].isNotEmpty)
          .toList();
    } catch (_) {
      return [];
    }
  }

  /// 视频链接
  static String videoUrl(String bvid) => 'https://www.bilibili.com/video/$bvid';

  /// B站搜索页链接
  static String searchUrl(String keyword) =>
      'https://search.bilibili.com/video?keyword=${Uri.encodeComponent(keyword)}';
}
