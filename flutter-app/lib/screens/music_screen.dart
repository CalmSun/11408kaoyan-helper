import 'dart:convert';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';

import '../theme/kaoyan_theme.dart';

/// 音乐播放（对应 Electron Music.vue 的精简版：搜索 + 试听 + 歌词）。
///
/// 网易云公开接口（无需登录）：搜索 / 热歌榜 / 外链试听 / 歌词。
class MusicScreen extends StatefulWidget {
  const MusicScreen({super.key});

  @override
  State<MusicScreen> createState() => _MusicScreenState();
}

class _MusicScreenState extends State<MusicScreen> {
  final _searchCtl = TextEditingController();
  final _player = AudioPlayer();

  List<Map<String, dynamic>> _songs = [];
  bool _loading = false;
  Map<String, dynamic>? _current;
  bool _playing = false;
  String _lyric = '';

  static const _headers = {
    'Referer': 'https://music.163.com/',
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };

  @override
  void initState() {
    super.initState();
    _loadHotSongs();
    _player.onPlayerStateChanged.listen((state) {
      if (mounted) {
        setState(() => _playing = state == PlayerState.playing);
      }
    });
  }

  @override
  void dispose() {
    _searchCtl.dispose();
    _player.dispose();
    super.dispose();
  }

  Future<void> _loadHotSongs() async {
    setState(() => _loading = true);
    try {
      final resp = await http.get(
        Uri.parse('https://music.163.com/api/playlist/detail?id=3778678'),
        headers: _headers,
      );
      if (resp.statusCode == 200) {
        final data = jsonDecode(utf8.decode(resp.bodyBytes)) as Map<String, dynamic>;
        final tracks = (data['result']?['tracks'] as List?) ?? [];
        setState(() {
          _songs = tracks
              .map((t) => _toSong(t as Map<String, dynamic>))
              .where((s) => s['id'] != null)
              .toList();
        });
      }
    } catch (_) {
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _search() async {
    final keyword = _searchCtl.text.trim();
    if (keyword.isEmpty) return;
    setState(() => _loading = true);
    try {
      final resp = await http.get(
        Uri.parse(
            'https://music.163.com/api/search/get/web?s=${Uri.encodeComponent(keyword)}&type=1&limit=30&offset=0'),
        headers: _headers,
      );
      if (resp.statusCode == 200) {
        final data = jsonDecode(utf8.decode(resp.bodyBytes)) as Map<String, dynamic>;
        final songs = (data['result']?['songs'] as List?) ?? [];
        setState(() {
          _songs = songs
              .map((t) => _toSong(t as Map<String, dynamic>))
              .where((s) => s['id'] != null)
              .toList();
        });
      }
    } catch (_) {
    } finally {
      setState(() => _loading = false);
    }
  }

  Map<String, dynamic> _toSong(Map<String, dynamic> t) {
    final artists = (t['artists'] as List? ?? [])
        .map((a) => (a as Map)['name'] as String? ?? '')
        .join(' / ');
    return {
      'id': t['id'],
      'name': t['name'] ?? '',
      'artist': artists,
      'album': (t['album'] as Map?)?['name'] ?? '',
    };
  }

  Future<void> _play(Map<String, dynamic> song) async {
    final id = song['id'];
    if (id == null) return;
    setState(() {
      _current = song;
      _lyric = '';
    });
    try {
      await _player.play(UrlSource(
          'https://music.163.com/song/media/outer/url?id=$id.mp3'));
      _loadLyric(id);
    } catch (_) {}
  }

  Future<void> _loadLyric(dynamic id) async {
    try {
      final resp = await http.get(
        Uri.parse('https://music.163.com/api/song/lyric?id=$id&lv=1&kv=1&tv=-1'),
        headers: _headers,
      );
      if (resp.statusCode == 200) {
        final data = jsonDecode(utf8.decode(resp.bodyBytes)) as Map<String, dynamic>;
        final lyric = data['lrc']?['lyric'] as String? ?? '';
        if (lyric.isNotEmpty && mounted) setState(() => _lyric = lyric);
      }
    } catch (_) {}
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
                child: TextField(
                  controller: _searchCtl,
                  decoration: const InputDecoration(
                    hintText: '搜索歌曲…',
                    prefixIcon: Icon(CupertinoIcons.search, size: 18),
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                  onSubmitted: (_) => _search(),
                ),
              ),
              const SizedBox(width: 8),
              GlassButton(
                icon: const Icon(CupertinoIcons.search),
                onTap: _search,
              ),
            ],
          ),
        ),
        // 播放栏
        if (_current != null) _buildPlayerBar(context),
        // 歌词
        if (_lyric.isNotEmpty)
          Expanded(
            child: Container(
              width: double.infinity,
              margin: const EdgeInsets.symmetric(horizontal: 16),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(12),
              ),
              child: SingleChildScrollView(
                child: SelectableText(
                  _lyric,
                  style: const TextStyle(fontSize: 13, height: 1.7),
                ),
              ),
            ),
          ),
        // 歌曲列表
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  itemCount: _songs.length,
                  itemBuilder: (context, i) {
                    final s = _songs[i];
                    final isCurrent = _current?['id'] == s['id'];
                    return GlassListTile(
                      leading: Icon(
                        isCurrent
                            ? CupertinoIcons.music_note_2
                            : CupertinoIcons.music_note,
                        color: isCurrent
                            ? KaoyanColors.primary
                            : Theme.of(context).hintColor,
                      ),
                      title: Text(
                        s['name'] as String? ?? '',
                        style: TextStyle(
                          fontWeight:
                              isCurrent ? FontWeight.w600 : FontWeight.w400,
                          color: isCurrent ? KaoyanColors.primary : null,
                        ),
                      ),
                      subtitle: Text(s['artist'] as String? ?? ''),
                      onTap: () => _play(s),
                    );
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildPlayerBar(BuildContext context) {
    final song = _current!;
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 4, 16, 12),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            KaoyanColors.primary.withValues(alpha: 0.9),
            const Color(0xFF60A5FA).withValues(alpha: 0.9),
          ],
        ),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  song['name'] as String? ?? '',
                  style: const TextStyle(
                      color: Colors.white, fontWeight: FontWeight.w600),
                ),
                Text(
                  song['artist'] as String? ?? '',
                  style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.85),
                      fontSize: 12),
                ),
              ],
            ),
          ),
          GlassButton(
            icon: Icon(_playing
                ? CupertinoIcons.pause_fill
                : CupertinoIcons.play_fill),
            onTap: () => _playing ? _player.pause() : _player.resume(),
          ),
        ],
      ),
    );
  }
}
