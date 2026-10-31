import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';

import '../services/music_store.dart';
import '../services/netease_api.dart';
import '../theme/kaoyan_theme.dart';

/// 音乐播放（完整迁移 Electron Music.vue，并参考 bujuan / MusicStorm 丰富功能）。
///
/// Tab：推荐（每日推荐/新歌速递/歌手/专辑）· 搜索（热搜）· 榜单 · 歌单 · 我的（登录/云盘/喜欢）。
class MusicScreen extends StatefulWidget {
  const MusicScreen({super.key});

  @override
  State<MusicScreen> createState() => _MusicScreenState();
}

class _MusicScreenState extends State<MusicScreen> {
  MusicStore get store => MusicStore.instance;

  // 发现页缓存
  List<Map<String, dynamic>> _dailySongs = [];
  List<Map<String, dynamic>> _newSongs = [];
  List<Map<String, dynamic>> _artists = [];
  List<Map<String, dynamic>> _albums = [];
  List<Map<String, dynamic>> _qualityPlaylists = [];
  bool _discoverLoading = false;

  // 榜单详情
  Map<String, dynamic>? _toplistInfo;
  List<Map<String, dynamic>> _toplistTracks = [];

  // 歌单详情
  Map<String, dynamic>? _playlistInfo;
  List<Map<String, dynamic>> _playlistTracks = [];

  // 喜欢歌曲
  List<Map<String, dynamic>> _likedSongs = [];

  final _searchCtl = TextEditingController();

  // 评论点赞状态（本地记录，评论接口不总是返回 liked）
  final Set<int> _likedComments = {};

  @override
  void initState() {
    super.initState();
    _loadDiscover();
    store.fetchToplist();
    store.fetchHotSearch();
  }

  @override
  void dispose() {
    _searchCtl.dispose();
    super.dispose();
  }

  Future<void> _loadDiscover() async {
    setState(() => _discoverLoading = true);
    final api = NeteaseApi.instance;
    final results = await Future.wait([
      api.recommendSongs(),
      api.newSongs(),
      api.topArtist(limit: 30),
      api.newAlbum(limit: 20),
      api.highQualityPlaylist(limit: 20),
    ]);
    if (!mounted) return;
    setState(() {
      _dailySongs = _list(results[0]['songs']);
      _newSongs = _list(results[1]['songs']);
      _artists = _list(results[2]['artists']);
      _albums = _list(results[3]['albums']);
      _qualityPlaylists = _list(results[4]['playlists']);
      _discoverLoading = false;
    });
  }

  List<Map<String, dynamic>> _list(dynamic v) =>
      (v as List? ?? []).cast<Map<String, dynamic>>();

  // ── 构建 ───────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: store,
      builder: (context, _) {
        return Column(
          children: [
            _buildTopBar(),
            const SizedBox(height: 4),
            Expanded(
              child: DefaultTabController(
                length: 5,
                child: Column(
                  children: [
                    _buildTabBar(),
                    Expanded(
                      child: TabBarView(
                        children: [
                          _buildDiscoverTab(),
                          _buildSearchTab(),
                          _buildToplistTab(),
                          _buildPlaylistTab(),
                          _buildMineTab(),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (store.showLyrics && store.lyricLines.isNotEmpty)
              _buildLyricPanel(),
            _buildPlayerBar(),
          ],
        );
      },
    );
  }

  Widget _buildTopBar() {
    final user = store.neteaseUser;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: Row(
        children: [
          const Icon(CupertinoIcons.music_note_2, color: KaoyanColors.primary),
          const SizedBox(width: 8),
          const Text('音乐',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const Spacer(),
          // 本地导入
          IconButton(
            tooltip: '导入本地文件夹',
            icon: const Icon(CupertinoIcons.folder_fill),
            onPressed: () => store.pickFolder(),
          ),
          IconButton(
            tooltip: '导入本地文件',
            icon: const Icon(CupertinoIcons.doc_text),
            onPressed: () => store.pickFiles(),
          ),
          // 登录状态
          if (user != null)
            GestureDetector(
              onTap: _showUserMenu,
              child: Row(
                children: [
                  _avatar(user['avatar']?.toString(), radius: 16),
                  const SizedBox(width: 6),
                  Text(user['nickname']?.toString() ?? '',
                      style: const TextStyle(fontSize: 13)),
                ],
              ),
            )
          else
            TextButton(
              onPressed: _showLoginDialog,
              child: const Text('登录网易云'),
            ),
        ],
      ),
    );
  }

  Widget _buildTabBar() {
    return TabBar(
      isScrollable: true,
      tabs: const [
        Tab(text: '推荐'),
        Tab(text: '搜索'),
        Tab(text: '榜单'),
        Tab(text: '歌单'),
        Tab(text: '我的'),
      ],
      labelColor: KaoyanColors.primary,
      unselectedLabelColor: Theme.of(context).hintColor,
      indicatorColor: KaoyanColors.primary,
    );
  }

  // ── 推荐 Tab ───────────────────────────────────────────────

  Widget _buildDiscoverTab() {
    if (_discoverLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        _sectionTitle('每日推荐', action: '登录后更精准',
            onAction: store.neteaseLoggedIn ? null : _showLoginDialog),
        _songList(_dailySongs.isEmpty ? _newSongs : _dailySongs, compact: true),
        const SizedBox(height: 20),
        _sectionTitle('新歌速递'),
        _songList(_newSongs, compact: true),
        const SizedBox(height: 20),
        _sectionTitle('热门歌手'),
        _artistGrid(_artists),
        const SizedBox(height: 20),
        _sectionTitle('最新专辑'),
        _albumGrid(_albums),
        const SizedBox(height: 20),
        _sectionTitle('精品歌单'),
        _playlistGrid(_qualityPlaylists),
      ],
    );
  }

  Widget _sectionTitle(String title, {String? action, VoidCallback? onAction}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Text(title,
              style:
                  const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          const Spacer(),
          if (action != null)
            TextButton(onPressed: onAction, child: Text(action)),
        ],
      ),
    );
  }

  Widget _songList(List<Map<String, dynamic>> songs, {bool compact = false}) {
    if (songs.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(12),
        child: Text('暂无内容', style: TextStyle(color: Colors.grey)),
      );
    }
    return Column(
      children: songs
          .take(compact ? 10 : songs.length)
          .map((s) => GlassListTile(
                leading: _cover(s['cover']?.toString(), size: 40),
                title: Text(s['name']?.toString() ?? '',
                    maxLines: 1, overflow: TextOverflow.ellipsis),
                subtitle: Text(s['artist']?.toString() ?? '',
                    maxLines: 1, overflow: TextOverflow.ellipsis),
                trailing: _songActions(s),
                onTap: () => store.playOnlineSong(s),
              ))
          .toList(),
    );
  }

  Widget _cloudList(List<Map<String, dynamic>> songs) {
    return Column(
      children: songs
          .map((s) => GlassListTile(
                leading: _cover(s['cover']?.toString(), size: 40),
                title: Text(s['name']?.toString() ?? '',
                    maxLines: 1, overflow: TextOverflow.ellipsis),
                subtitle: Text(s['artist']?.toString() ?? '',
                    maxLines: 1, overflow: TextOverflow.ellipsis),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    GlassButton(
                      icon: const Icon(CupertinoIcons.play_fill, size: 16),
                      onTap: () => store.playCloudSong(s),
                    ),
                    const SizedBox(width: 4),
                    GlassButton(
                      icon: const Icon(CupertinoIcons.delete, size: 16),
                      onTap: () async {
                        await store.deleteCloudSong(s['id']);
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('已从云盘删除')));
                        }
                      },
                    ),
                  ],
                ),
                onTap: () => store.playCloudSong(s),
              ))
          .toList(),
    );
  }

  Widget _songActions(Map<String, dynamic> s) {
    final id = s['id'];
    if (id == null) return const SizedBox.shrink();
    final liked = store.isSongLiked(id as int);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        GlassButton(
          icon: Icon(
            liked ? CupertinoIcons.heart_fill : CupertinoIcons.heart,
            color: liked ? Colors.redAccent : null,
            size: 16,
          ),
          onTap: () => store.toggleSongLike(id),
        ),
        const SizedBox(width: 4),
        GlassButton(
          icon: const Icon(CupertinoIcons.bubble_left, size: 16),
          onTap: () => _showCommentsSheet(MusicTrack(
            name: s['name']?.toString() ?? '',
            url: '',
            source: 'online',
            id: id,
            artist: s['artist']?.toString() ?? '',
          )),
        ),
        const SizedBox(width: 4),
        GlassButton(
          icon: const Icon(CupertinoIcons.arrow_down_circle, size: 16),
          onTap: () => _downloadSong(MusicTrack(
            name: s['name']?.toString() ?? '',
            url: '',
            source: 'online',
            id: id,
            artist: s['artist']?.toString() ?? '',
          )),
        ),
        const SizedBox(width: 4),
        GlassButton(
          icon: const Icon(CupertinoIcons.plus, size: 16),
          onTap: () => store.addOnlineSong(s),
        ),
      ],
    );
  }

  Widget _artistGrid(List<Map<String, dynamic>> artists) {
    if (artists.isEmpty) return const SizedBox.shrink();
    return SizedBox(
      height: 150,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        itemCount: artists.length,
        itemBuilder: (context, i) {
          final a = artists[i];
          return GestureDetector(
            onTap: () => _showArtistSongs(a),
            child: SizedBox(
              width: 110,
              child: Column(
                children: [
                  _cover(a['cover']?.toString(), size: 100, circle: true),
                  const SizedBox(height: 6),
                  Text(a['name']?.toString() ?? '',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12)),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _albumGrid(List<Map<String, dynamic>> albums) {
    if (albums.isEmpty) return const SizedBox.shrink();
    return SizedBox(
      height: 150,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        itemCount: albums.length,
        itemBuilder: (context, i) {
          final a = albums[i];
          return GestureDetector(
            onTap: () => _showAlbumSongs(a),
            child: SizedBox(
              width: 110,
              child: Column(
                children: [
                  _cover(a['cover']?.toString(), size: 100),
                  const SizedBox(height: 6),
                  Text(a['name']?.toString() ?? '',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12)),
                  Text(a['artist']?.toString() ?? '',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontSize: 11, color: Theme.of(context).hintColor)),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _playlistGrid(List<Map<String, dynamic>> playlists) {
    if (playlists.isEmpty) return const SizedBox.shrink();
    return SizedBox(
      height: 150,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        itemCount: playlists.length,
        itemBuilder: (context, i) {
          final p = playlists[i];
          return GestureDetector(
            onTap: () => _openPlaylist(p['id'] as int?),
            child: SizedBox(
              width: 110,
              child: Column(
                children: [
                  _cover(p['cover']?.toString(), size: 100),
                  const SizedBox(height: 6),
                  Text(p['name']?.toString() ?? '',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12)),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // ── 搜索 Tab ───────────────────────────────────────────────

  Widget _buildSearchTab() {
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
                    hintText: '搜索歌曲 / 歌手 / 专辑…',
                    prefixIcon: Icon(CupertinoIcons.search, size: 18),
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                  onSubmitted: (_) => store.searchOnline(_searchCtl.text),
                ),
              ),
              const SizedBox(width: 8),
              GlassButton(
                icon: const Icon(CupertinoIcons.search),
                onTap: () => store.searchOnline(_searchCtl.text),
              ),
            ],
          ),
        ),
        if (store.searchLoading)
          const Padding(
            padding: EdgeInsets.all(20),
            child: CircularProgressIndicator(),
          ),
        if (store.searchResults.isEmpty && !store.searchLoading)
          _buildHotSearch(),
        if (store.searchResults.isNotEmpty)
          Expanded(child: _songList(store.searchResults)),
      ],
    );
  }

  Widget _buildHotSearch() {
    return Expanded(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          const Text('热搜榜',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          ...store.hotSearchList
              .take(20)
              .map((h) => GlassListTile(
                    leading: Text(
                      '${h['rank']}',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: (h['rank'] as int) <= 3
                            ? Colors.redAccent
                            : Theme.of(context).hintColor,
                      ),
                    ),
                    title: Text(h['keyword']?.toString() ?? ''),
                    onTap: () {
                      _searchCtl.text = h['keyword']?.toString() ?? '';
                      store.searchOnline(_searchCtl.text);
                    },
                  )),
        ],
      ),
    );
  }

  // ── 榜单 Tab ───────────────────────────────────────────────

  Widget _buildToplistTab() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        ...store.toplistList.map((l) => GlassListTile(
              leading: _cover(l['cover']?.toString(), size: 48),
              title: Text(l['name']?.toString() ?? ''),
              subtitle: Text(
                (l['topTracks'] as List? ?? [])
                    .take(3)
                    .map((t) => '${(t as Map)['name']}')
                    .join(' · '),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              onTap: () => _openToplist(l['id'] as int?),
            )),
      ],
    );
  }

  Future<void> _openToplist(int? id) async {
    if (id == null) return;
    final res = await NeteaseApi.instance.toplistDetail(id);
    setState(() {
      _toplistInfo = (res['playlist'] as Map?)?.cast<String, dynamic>();
      _toplistTracks = _list(res['tracks']);
    });
    if (mounted) {
      _showTrackListSheet(
          _toplistInfo?['name']?.toString() ?? '榜单', _toplistTracks);
    }
  }

  // ── 歌单 Tab ───────────────────────────────────────────────

  Widget _buildPlaylistTab() {
    final playlists = store.neteaseLoggedIn
        ? store.userPlaylists
        : <Map<String, dynamic>>[];
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        if (!store.neteaseLoggedIn)
          Center(
            child: Column(
              children: [
                const SizedBox(height: 40),
                const Text('登录后查看你的歌单',
                    style: TextStyle(color: Colors.grey)),
                const SizedBox(height: 12),
                GlassButton(
                  icon: const Icon(CupertinoIcons.person),
                  onTap: _showLoginDialog,
                ),
              ],
            ),
          )
        else
          ...playlists.map((p) => GlassListTile(
                leading: _cover(p['cover']?.toString(), size: 48),
                title: Text(p['name']?.toString() ?? ''),
                subtitle: Text(
                    '${p['trackCount']} 首 · ${p['creator'] ?? ''}'),
                onTap: () => _openPlaylist(p['id'] as int?),
              )),
      ],
    );
  }

  Future<void> _openPlaylist(int? id) async {
    if (id == null) return;
    final res = await NeteaseApi.instance.playlistDetail(id);
    setState(() {
      _playlistInfo = (res['playlist'] as Map?)?.cast<String, dynamic>();
      _playlistTracks = _list(res['tracks']);
    });
    if (mounted) {
      _showTrackListSheet(_playlistInfo?['name']?.toString() ?? '歌单',
          _playlistTracks);
    }
  }

  // ── 我的 Tab ───────────────────────────────────────────────

  Widget _buildMineTab() {
    if (!store.neteaseLoggedIn) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(CupertinoIcons.person, size: 56, color: Colors.grey),
            const SizedBox(height: 12),
            const Text('登录网易云音乐'),
            const SizedBox(height: 16),
            GlassButton(
              icon: const Icon(CupertinoIcons.qrcode),
              onTap: _showLoginDialog,
            ),
          ],
        ),
      );
    }
    final user = store.neteaseUser ?? {};
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        GlassContainer.card(
          child: Row(
            children: [
              _avatar(user['avatar']?.toString(), radius: 28),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(user['nickname']?.toString() ?? '',
                        style: const TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w700)),
                    Text('Lv.${user['level'] ?? 0}',
                        style: TextStyle(
                            fontSize: 12,
                            color: Theme.of(context).hintColor)),
                  ],
                ),
              ),
              TextButton(
                onPressed: () => store.logoutNetease(),
                child: const Text('退出'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _sectionTitle('我的云盘', action: '刷新', onAction: () => store.fetchCloudDrive()),
        if (store.cloudDriveLoading)
          const Center(child: CircularProgressIndicator())
        else if (store.cloudDriveList.isEmpty)
          const Padding(
            padding: EdgeInsets.all(12),
            child: Text('云盘为空', style: TextStyle(color: Colors.grey)),
          )
        else
          _cloudList(store.cloudDriveList),
        const SizedBox(height: 16),
        _sectionTitle('我喜欢的音乐', action: '加载',
            onAction: () => _loadLikedSongs()),
        if (_likedSongs.isNotEmpty) _songList(_likedSongs),
      ],
    );
  }

  Future<void> _loadLikedSongs() async {
    await store.fetchLikelist(force: true);
    if (store.likedSongIds.isEmpty) return;
    final ids = store.likedSongIds.toList();
    final all = <Map<String, dynamic>>[];
    for (int i = 0; i < ids.length; i += 500) {
      final batch = ids.sublist(i, (i + 500).clamp(0, ids.length));
      final res = await NeteaseApi.instance.songDetail(batch);
      all.addAll(_list(res['songs']));
    }
    setState(() => _likedSongs = all);
  }

  // ── 播放条 / 歌词 / 列表 ───────────────────────────────────

  Widget _buildPlayerBar() {
    final track = store.currentTrack;
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 4, 12, 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            KaoyanColors.primary.withValues(alpha: 0.85),
            const Color(0xFF60A5FA).withValues(alpha: 0.85),
          ],
        ),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              if (track != null) _cover(track.cover, size: 42, circle: true),
              const SizedBox(width: 10),
              Expanded(
                child: track == null
                    ? const Text('未在播放',
                        style: TextStyle(color: Colors.white70))
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(track.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w600)),
                          Text(track.artist,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.8),
                                  fontSize: 12)),
                        ],
                      ),
              ),
              _playerIconBtn(
                CupertinoIcons.backward_end_fill,
                store.prev,
              ),
              _playerIconBtn(
                store.isPlaying
                    ? CupertinoIcons.pause_fill
                    : CupertinoIcons.play_fill,
                store.toggle,
                big: true,
              ),
              _playerIconBtn(
                CupertinoIcons.forward_end_fill,
                store.next,
              ),
              if (track != null && track.source == 'online' && track.id != null) ...[
                _playerIconBtn(
                  CupertinoIcons.bubble_left_bubble_right,
                  () => _showCommentsSheet(track),
                ),
                _playerIconBtn(
                  CupertinoIcons.arrow_down_circle,
                  () => _downloadSong(track),
                ),
              ],
              _playerIconBtn(
                CupertinoIcons.text_quote,
                store.toggleShowLyrics,
                highlight: store.showLyrics,
              ),
              _playerIconBtn(
                CupertinoIcons.list_bullet,
                _showPlaylistSheet,
              ),
            ],
          ),
          if (track != null) _buildProgress(),
        ],
      ),
    );
  }

  Widget _buildProgress() {
    final totalMs = store.duration.inMilliseconds;
    final curMs = store.currentTime.inMilliseconds;
    return Row(
      children: [
        Text(_fmt(curMs),
            style: const TextStyle(color: Colors.white70, fontSize: 11)),
        Expanded(
          child: Slider(
            value: totalMs > 0 ? (curMs / totalMs).clamp(0.0, 1.0) : 0.0,
            onChanged: (v) {
              if (totalMs > 0) {
                store.seek(Duration(milliseconds: (v * totalMs).round()));
              }
            },
            activeColor: Colors.white,
            inactiveColor: Colors.white.withValues(alpha: 0.3),
          ),
        ),
        Text(_fmt(totalMs),
            style: const TextStyle(color: Colors.white70, fontSize: 11)),
      ],
    );
  }

  String _fmt(int ms) {
    final d = Duration(milliseconds: ms);
    final m = d.inMinutes.toString().padLeft(2, '0');
    final s = (d.inSeconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  Widget _playerIconBtn(IconData icon, VoidCallback onTap,
      {bool big = false, bool highlight = false}) {
    return IconButton(
      icon: Icon(
        icon,
        size: big ? 28 : 18,
        color: highlight ? Colors.white : Colors.white.withValues(alpha: 0.9),
      ),
      onPressed: onTap,
    );
  }

  Widget _buildLyricPanel() {
    if (store.lyricLines.isEmpty) return const SizedBox.shrink();
    final idx = store.currentLyricIndex;
    final lines = store.lyricLines;
    return Container(
      height: 120,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: ListView.builder(
        controller: _lyricScroll,
        itemCount: lines.length,
        itemBuilder: (context, i) {
          final isCur = i == idx;
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Text(
              lines[i].text,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: isCur ? 16 : 13,
                fontWeight: isCur ? FontWeight.w700 : FontWeight.w400,
                color: isCur ? KaoyanColors.primary : Theme.of(context).hintColor,
              ),
            ),
          );
        },
      ),
    );
  }

  final ScrollController _lyricScroll = ScrollController();

  void _showPlaylistSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => ListenableBuilder(
        listenable: store,
        builder: (context, _) {
          if (store.playlist.isEmpty) {
            return const SizedBox(
                height: 200,
                child: Center(child: Text('播放列表为空')));
          }
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 8, 4),
                child: Row(
                  children: [
                    Text('播放列表（${store.playlist.length}）',
                        style: const TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w700)),
                    const Spacer(),
                    IconButton(
                      tooltip: '随机播放',
                      icon: Icon(
                        store.shuffle
                            ? CupertinoIcons.shuffle
                            : CupertinoIcons.arrow_2_circlepath,
                        color: store.shuffle ? KaoyanColors.primary : null,
                      ),
                      onPressed: store.toggleShuffle,
                    ),
                    IconButton(
                      tooltip: '清空列表',
                      icon: const Icon(CupertinoIcons.trash, size: 20),
                      onPressed: () {
                        store.clearPlaylist();
                        Navigator.pop(ctx);
                      },
                    ),
                  ],
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: ListView.builder(
                  itemCount: store.playlist.length,
                  itemBuilder: (context, i) {
                    final t = store.playlist[i];
                    final isCur = i == store.currentIndex;
                    return ListTile(
                      leading: Icon(
                        isCur
                            ? CupertinoIcons.music_note_2
                            : CupertinoIcons.music_note,
                        color: isCur ? KaoyanColors.primary : null,
                      ),
                      title: Text(t.name,
                          maxLines: 1, overflow: TextOverflow.ellipsis),
                      subtitle: Text(t.artist,
                          maxLines: 1, overflow: TextOverflow.ellipsis),
                      trailing: IconButton(
                        icon: const Icon(CupertinoIcons.delete, size: 18),
                        onPressed: () => store.removeTrack(i),
                      ),
                      onTap: () {
                        store.playIndex(i);
                        Navigator.pop(ctx);
                      },
                    );
                  },
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  void _showTrackListSheet(
      String title, List<Map<String, dynamic>> tracks) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.7,
        maxChildSize: 0.9,
        builder: (context, scrollCtl) => Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Expanded(
                    child: Text(title,
                        style: const TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w700)),
                  ),
                  GlassButton(
                    icon: const Icon(CupertinoIcons.play_fill),
                    onTap: () {
                      store.playSongList(tracks);
                      Navigator.pop(ctx);
                    },
                  ),
                  const SizedBox(width: 8),
                  GlassButton(
                    icon: const Icon(CupertinoIcons.plus),
                    onTap: () {
                      store.addSongListToQueue(tracks);
                      Navigator.pop(ctx);
                    },
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView.builder(
                controller: scrollCtl,
                itemCount: tracks.length,
                itemBuilder: (context, i) {
                  final s = tracks[i];
                  return GlassListTile(
                    leading: Text('${i + 1}',
                        style: TextStyle(color: Theme.of(context).hintColor)),
                    title: Text(s['name']?.toString() ?? '',
                        maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Text(s['artist']?.toString() ?? '',
                        maxLines: 1, overflow: TextOverflow.ellipsis),
                    onTap: () {
                      store.playOnlineSong(s);
                      Navigator.pop(ctx);
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── 评论 / 下载 ───────────────────────────────────────────

  Future<void> _downloadSong(MusicTrack track) async {
    final name = track.name;
    ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('正在下载《$name》…')));
    final path = await store.downloadSong({
      'id': track.id,
      'name': track.name,
      'artist': track.artist,
    });
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(path != null ? '下载完成：$path' : '下载失败（可能需登录 / 版权限制）'),
    ));
  }

  void _showCommentsSheet(MusicTrack track) {
    final songId = track.id;
    if (songId == null) return;
    store.fetchComments(songId);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.7,
        maxChildSize: 0.95,
        builder: (context, scrollCtl) => ListenableBuilder(
          listenable: store,
          builder: (context, _) {
            final hasMore =
                store.comments.length < store.commentTotal;
            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 8, 4),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('评论 · ${track.name}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w700)),
                            Text('共 ${store.commentTotal} 条',
                                style: TextStyle(
                                    fontSize: 12,
                                    color: Theme.of(context).hintColor)),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(CupertinoIcons.arrow_clockwise,
                            size: 18),
                        onPressed: () => store.fetchComments(songId),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1),
                Expanded(
                  child: store.commentsLoading && store.comments.isEmpty
                      ? const Center(child: CircularProgressIndicator())
                      : ListView(
                          controller: scrollCtl,
                          padding: const EdgeInsets.only(bottom: 24),
                          children: [
                            if (store.hotComments.isNotEmpty) ...[
                              _commentSectionHeader('精彩评论'),
                              ...store.hotComments
                                  .map((c) => _commentTile(c, songId)),
                            ],
                            if (store.hotComments.isNotEmpty)
                              _commentSectionHeader('最新评论'),
                            ...store.comments
                                .map((c) => _commentTile(c, songId)),
                            Center(
                              child: TextButton(
                                onPressed: hasMore
                                    ? store.loadMoreComments
                                    : null,
                                child: Text(hasMore ? '加载更多' : '已加载全部'),
                              ),
                            ),
                          ],
                        ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _commentSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
      child: Text(title,
          style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: KaoyanColors.primary)),
    );
  }

  Widget _commentTile(Map<String, dynamic> c, int songId) {
    final cid = (c['commentId'] as num?)?.toInt() ?? 0;
    final liked = c['liked'] == true || _likedComments.contains(cid);
    final replied = c['repliedContent']?.toString() ?? '';
    final time = (c['time'] as num?)?.toInt() ?? 0;
    return ListTile(
      leading: ClipOval(
        child: Image.network(
          c['avatar']?.toString() ?? '',
          width: 36,
          height: 36,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Container(
            width: 36,
            height: 36,
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            child: const Icon(Icons.person, size: 20, color: Colors.grey),
          ),
        ),
      ),
      title: Text(c['nickname']?.toString() ?? '匿名用户',
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(c['content']?.toString() ?? '',
              style: const TextStyle(fontSize: 13, height: 1.4)),
          if (replied.isNotEmpty)
            Text(
              '回复 @${c['repliedNickname'] ?? ''}：$replied',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                  fontSize: 12,
                  color: Theme.of(context).hintColor,
                  backgroundColor:
                      Theme.of(context).colorScheme.surfaceContainerHighest),
            ),
          Text(_fmtTime(time),
              style: TextStyle(
                  fontSize: 11, color: Theme.of(context).hintColor)),
        ],
      ),
      isThreeLine: true,
      trailing: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            icon: Icon(
              liked ? CupertinoIcons.heart_fill : CupertinoIcons.heart,
              size: 16,
              color: liked ? Colors.redAccent : null,
            ),
            onPressed: () async {
              final target = !liked;
              final ok =
                  await store.toggleCommentLike(songId, cid, liked);
              if (!ok || !mounted) return;
              setState(() {
                if (target) {
                  _likedComments.add(cid);
                } else {
                  _likedComments.remove(cid);
                }
              });
            },
          ),
          Text('${c['likedCount'] ?? 0}',
              style: TextStyle(
                  fontSize: 10, color: Theme.of(context).hintColor)),
        ],
      ),
    );
  }

  String _fmtTime(int ms) {
    if (ms <= 0) return '';
    final t = DateTime.fromMillisecondsSinceEpoch(ms);
    final now = DateTime.now();
    final diff = now.difference(t);
    if (diff.inMinutes < 1) return '刚刚';
    if (diff.inHours < 1) return '${diff.inMinutes} 分钟前';
    if (diff.inDays < 1) return '${diff.inHours} 小时前';
    if (diff.inDays < 30) return '${diff.inDays} 天前';
    return '${t.year}-${t.month.toString().padLeft(2, '0')}-${t.day.toString().padLeft(2, '0')}';
  }

  // ── 登录对话框 ─────────────────────────────────────────────

  void _showLoginDialog() {
    showDialog(
      context: context,
      builder: (ctx) => _LoginDialog(store: store),
    );
  }

  void _showUserMenu() {
    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(CupertinoIcons.person),
              title: Text(store.neteaseUser?['nickname']?.toString() ?? ''),
              subtitle: Text('Lv.${store.neteaseUser?['level'] ?? 0}'),
            ),
            ListTile(
              leading: const Icon(CupertinoIcons.square_arrow_right),
              title: const Text('退出登录'),
              onTap: () {
                store.logoutNetease();
                Navigator.pop(ctx);
              },
            ),
          ],
        ),
      ),
    );
  }

  // ── 歌手 / 专辑展开 ────────────────────────────────────────

  Future<void> _showArtistSongs(Map<String, dynamic> artist) async {
    // 歌手热门歌曲：复用搜索（歌手名）
    await store.searchOnline(artist['name']?.toString() ?? '');
  }

  Future<void> _showAlbumSongs(Map<String, dynamic> album) async {
    final id = album['id'];
    if (id == null) return;
    final res = await NeteaseApi.instance.albumInfo(id as int);
    final songs = _list(res['songs']);
    if (mounted) {
      _showTrackListSheet(album['name']?.toString() ?? '专辑', songs);
    }
  }

  // ── 图片工具 ───────────────────────────────────────────────

  Widget _cover(String? url, {double size = 40, bool circle = false}) {
    final fallback = Container(
      width: size,
      height: size,
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      child: Icon(Icons.music_note, size: size * 0.5, color: Colors.grey),
    );
    final img = url == null || url.isEmpty
        ? fallback
        : Image.network(
            url,
            width: size,
            height: size,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => fallback,
          );
    return circle
        ? ClipOval(child: img)
        : ClipRRect(borderRadius: BorderRadius.circular(6), child: img);
  }

  Widget _avatar(String? url, {double radius = 16}) {
    return ClipOval(
      child: Image.network(
        url ?? '',
        width: radius * 2,
        height: radius * 2,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => Container(
          width: radius * 2,
          height: radius * 2,
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          child: Icon(Icons.person, size: radius, color: Colors.grey),
        ),
      ),
    );
  }
}

/// 网易云登录对话框（二维码 / 手机号 / Cookie）
class _LoginDialog extends StatefulWidget {
  const _LoginDialog({required this.store});
  final MusicStore store;

  @override
  State<_LoginDialog> createState() => _LoginDialogState();
}

class _LoginDialogState extends State<_LoginDialog> {
  final _phoneCtl = TextEditingController();
  final _pwdCtl = TextEditingController();
  final _cookieCtl = TextEditingController();
  int _tab = 0; // 0 二维码, 1 手机号, 2 Cookie
  Timer? _pollTimer;
  String _qrImg = '';

  @override
  void initState() {
    super.initState();
    _loadQr();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _phoneCtl.dispose();
    _pwdCtl.dispose();
    _cookieCtl.dispose();
    super.dispose();
  }

  Future<void> _loadQr() async {
    final res = await widget.store.getQrKey();
    if (res['success'] == true && mounted) {
      setState(() => _qrImg = res['qrimg'] ?? '');
      _pollTimer = Timer.periodic(const Duration(seconds: 2), (_) async {
        final code = await widget.store.checkQrLogin();
        if (code == 803 && mounted) {
          _pollTimer?.cancel();
          Navigator.pop(context);
        } else if (code == 800 && mounted) {
          _pollTimer?.cancel();
          setState(() => _qrImg = '');
          _loadQr();
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('登录网易云音乐'),
      content: SizedBox(
        width: 320,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SegmentedButton<int>(
              segments: const [
                ButtonSegment(value: 0, label: Text('扫码')),
                ButtonSegment(value: 1, label: Text('手机号')),
                ButtonSegment(value: 2, label: Text('Cookie')),
              ],
              selected: {_tab},
              onSelectionChanged: (s) => setState(() => _tab = s.first),
            ),
            const SizedBox(height: 16),
            if (_tab == 0)
              _qrImg.isEmpty
                  ? const Padding(
                      padding: EdgeInsets.all(20),
                      child: CircularProgressIndicator())
                  : Image.network(_qrImg, width: 200, height: 200,
                      errorBuilder: (_, __, ___) => const Text('二维码加载失败，请用手机号登录'))
            else if (_tab == 1)
              Column(
                children: [
                  TextField(
                    controller: _phoneCtl,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                        labelText: '手机号', isDense: true),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _pwdCtl,
                    obscureText: true,
                    decoration: const InputDecoration(
                        labelText: '密码', isDense: true),
                  ),
                ],
              )
            else
              TextField(
                controller: _cookieCtl,
                maxLines: 3,
                decoration: const InputDecoration(
                    labelText: '粘贴浏览器 Cookie（MUSIC_U=...）',
                    isDense: true),
              ),
          ],
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context), child: const Text('取消')),
        if (_tab == 1)
          FilledButton(
            onPressed: () async {
              final r = await widget.store
                  .loginPhone(_phoneCtl.text, _pwdCtl.text, '86');
              if (!context.mounted) return;
              if (r['loggedIn'] == true) {
                Navigator.pop(context);
              } else {
                ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(r['message']?.toString() ?? '登录失败')));
              }
            },
            child: const Text('登录'),
          ),
        if (_tab == 2)
          FilledButton(
            onPressed: () async {
              final r = await widget.store.setNeteaseCookie(_cookieCtl.text);
              if (!context.mounted) return;
              if (r['loggedIn'] == true) {
                Navigator.pop(context);
              } else {
                ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(r['message']?.toString() ?? '登录失败')));
              }
            },
            child: const Text('登录'),
          ),
      ],
    );
  }
}
