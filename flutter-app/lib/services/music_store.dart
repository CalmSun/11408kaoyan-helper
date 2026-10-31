import 'dart:io';

import 'package:audioplayers/audioplayers.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';

import 'netease_api.dart';
import 'storage_service.dart';

/// 一行歌词
class LyricLine {
  final double time; // 秒
  final String text;
  LyricLine(this.time, this.text);
}

/// 音乐曲目
class MusicTrack {
  final String name;
  String url;
  final String source; // 'local' | 'online'
  final int? id;
  final String artist;
  final String album;
  final String cover;
  MusicTrack({
    required this.name,
    required this.url,
    required this.source,
    this.id,
    this.artist = '',
    this.album = '',
    this.cover = '',
  });
}

/// 全局音乐播放器 + 网易云状态（对应 Electron music.ts）。
class MusicStore extends ChangeNotifier {
  MusicStore._() {
    _init();
  }
  static final MusicStore instance = MusicStore._();

  final AudioPlayer _player = AudioPlayer();
  final NeteaseApi _api = NeteaseApi.instance;

  static const List<String> _audioExts = [
    'mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac', 'wma', 'opus'
  ];

  // ── 播放器状态 ─────────────────────────────────────────────

  List<MusicTrack> playlist = [];
  int currentIndex = 0;
  bool isPlaying = false;
  double volume = 1.0;
  bool shuffle = false;
  String qualityLevel = 'exhigh';

  List<LyricLine> lyricLines = [];
  int currentLyricIndex = -1;
  bool showLyrics = true;
  Duration currentTime = Duration.zero;
  Duration duration = Duration.zero;

  // 网易云搜索
  List<Map<String, dynamic>> searchResults = [];
  bool searchLoading = false;

  // 网易云登录
  bool neteaseLoggedIn = false;
  Map<String, dynamic>? neteaseUser;
  List<Map<String, dynamic>> userPlaylists = [];
  String qrKey = '';
  int qrStatus = 0; // 0 未开始, 801 等待扫码, 802 待确认, 803 成功, 800 过期
  String qrImage = '';

  // 云盘 / 喜欢
  List<Map<String, dynamic>> cloudDriveList = [];
  bool cloudDriveLoading = false;
  Set<int> likedSongIds = {};
  bool currentLiked = false;
  bool _likelistLoaded = false;

  // 榜单 / 热搜
  List<Map<String, dynamic>> toplistList = [];
  List<Map<String, dynamic>> hotSearchList = [];

  MusicTrack? get currentTrack =>
      (currentIndex >= 0 && currentIndex < playlist.length)
          ? playlist[currentIndex]
          : null;

  int _urlRefreshRetry = 0;
  bool _refreshingUrl = false;
  int? _likingSongId;

  void _init() {
    _player.setVolume(volume);
    _player.onPlayerStateChanged.listen((s) {
      isPlaying = s == PlayerState.playing;
      notifyListeners();
    });
    _player.onPositionChanged.listen((p) {
      currentTime = p;
      _updateLyricIndex();
    });
    _player.onDurationChanged.listen((d) {
      duration = d;
      notifyListeners();
    });
    _player.onPlayerComplete.listen((_) => _onComplete());

    shuffle = StorageService.instance.getBool('musicShuffle');
    showLyrics =
        StorageService.instance.getBool('musicShowLyrics', defaultValue: true);
    qualityLevel = StorageService.instance.getString('musicQualityLevel') ?? 'exhigh';
    // 启动时恢复登录态
    checkLoginStatus();
  }

  // ── 歌词解析 ───────────────────────────────────────────────

  static List<LyricLine> parseLyric(String content) {
    final lines = <LyricLine>[];
    final regex = RegExp(r'\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)');
    for (final line in content.split('\n')) {
      final m = regex.firstMatch(line);
      if (m != null) {
        final min = int.parse(m.group(1)!);
        final sec = int.parse(m.group(2)!);
        final ms = m.group(3) != null
            ? int.parse(m.group(3)!.padRight(3, '0'))
            : 0;
        final time = min * 60 + sec + ms / 1000.0;
        final text = m.group(4)!.trim();
        if (text.isNotEmpty) lines.add(LyricLine(time, text));
      }
    }
    lines.sort((a, b) => a.time.compareTo(b.time));
    return lines;
  }

  Future<void> loadLyric() async {
    final track = currentTrack;
    if (track == null) {
      lyricLines = [];
      currentLyricIndex = -1;
      notifyListeners();
      return;
    }
    if (track.source == 'online' && track.id != null) {
      final res = await _api.lyric(track.id!);
      lyricLines =
          res['success'] == true ? parseLyric(res['lyric'] ?? '') : [];
    } else {
      // 本地曲目：读同目录 .lrc
      lyricLines = [];
      try {
        final base = track.url;
        final lrcPath =
            '${base.substring(0, base.lastIndexOf('.'))}.lrc';
        final f = File(lrcPath);
        if (f.existsSync()) {
          lyricLines = parseLyric(f.readAsStringSync());
        }
      } catch (_) {}
    }
    currentLyricIndex = -1;
    notifyListeners();
  }

  void _updateLyricIndex() {
    if (lyricLines.isEmpty) {
      if (currentLyricIndex != -1) {
        currentLyricIndex = -1;
        notifyListeners();
      }
      return;
    }
    final t = currentTime.inMilliseconds / 1000.0;
    int idx = -1;
    for (int i = lyricLines.length - 1; i >= 0; i--) {
      if (t >= lyricLines[i].time) {
        idx = i;
        break;
      }
    }
    if (idx != currentLyricIndex) {
      currentLyricIndex = idx;
      notifyListeners();
    }
  }

  // ── 播放控制 ───────────────────────────────────────────────

  void setQualityLevel(String level) {
    qualityLevel = level;
    StorageService.instance.setString('musicQualityLevel', level);
    notifyListeners();
  }

  void setVolume(double v) {
    volume = v.clamp(0.0, 1.0);
    _player.setVolume(volume);
    notifyListeners();
  }

  Future<void> seek(Duration d) async {
    await _player.seek(d);
    currentTime = d;
    notifyListeners();
  }

  Future<void> _playTrack(MusicTrack t) async {
    try {
      await _player.stop();
      await _player.setReleaseMode(ReleaseMode.stop);
      if (t.source == 'local') {
        await _player.play(DeviceFileSource(t.url));
      } else {
        await _player.play(UrlSource(t.url));
      }
      isPlaying = true;
    } catch (_) {
      // 在线 URL 过期时刷新重试
      if (t.source == 'online' && t.id != null && !_refreshingUrl && _urlRefreshRetry < 2) {
        _refreshingUrl = true;
        _urlRefreshRetry++;
        final res = await _api.songUrl([t.id!], level: qualityLevel);
        final urlInfo = (res['urls'] as List? ?? [])
            .cast<Map>()
            .where((u) => u['id'] == t.id)
            .firstOrNull;
        if (urlInfo != null && urlInfo['url'] != null) {
          t.url = urlInfo['url'];
          playlist[currentIndex] = t;
          await _playTrack(t);
          _urlRefreshRetry = 0;
        }
        _refreshingUrl = false;
      }
      isPlaying = false;
      notifyListeners();
    }
  }

  Future<void> playIndex(int index) async {
    if (index < 0 || index >= playlist.length) return;
    currentIndex = index;
    await loadLyric();
    await _playTrack(playlist[index]);
    notifyListeners();
  }

  Future<void> toggle() async {
    if (isPlaying) {
      await _player.pause();
    } else {
      if (currentTrack != null) {
        await _player.resume();
      } else if (playlist.isNotEmpty) {
        await playIndex(0);
      }
    }
  }

  Future<void> next() async {
    if (playlist.isEmpty) return;
    if (shuffle && playlist.length > 1) {
      var idx = currentIndex;
      while (idx == currentIndex) {
        idx = DateTime.now().millisecondsSinceEpoch % playlist.length;
      }
      currentIndex = idx;
    } else {
      currentIndex = (currentIndex + 1) % playlist.length;
    }
    await playIndex(currentIndex);
  }

  Future<void> prev() async {
    if (playlist.isEmpty) return;
    if (shuffle && playlist.length > 1) {
      var idx = currentIndex;
      while (idx == currentIndex) {
        idx = DateTime.now().millisecondsSinceEpoch % playlist.length;
      }
      currentIndex = idx;
    } else {
      currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    }
    await playIndex(currentIndex);
  }

  void _onComplete() async {
    if (playlist.length > 1) {
      await next();
    } else {
      isPlaying = false;
      notifyListeners();
    }
  }

  void toggleShuffle() {
    shuffle = !shuffle;
    StorageService.instance.setBool('musicShuffle', shuffle);
    notifyListeners();
  }

  void toggleShowLyrics() {
    showLyrics = !showLyrics;
    StorageService.instance.setBool('musicShowLyrics', showLyrics);
    notifyListeners();
  }

  void setPlaylist(List<MusicTrack> tracks, {int startIndex = 0}) {
    playlist = tracks;
    currentIndex = startIndex;
    notifyListeners();
    if (tracks.isNotEmpty) playIndex(startIndex);
  }

  void removeTrack(int index) {
    if (index < 0 || index >= playlist.length) return;
    playlist.removeAt(index);
    if (playlist.isEmpty) {
      currentIndex = 0;
      _player.stop();
      isPlaying = false;
    } else if (index < currentIndex) {
      currentIndex--;
    } else if (index == currentIndex) {
      if (currentIndex >= playlist.length) currentIndex = 0;
      playIndex(currentIndex);
    }
    notifyListeners();
  }

  void clearPlaylist() {
    _player.stop();
    playlist = [];
    currentIndex = 0;
    isPlaying = false;
    lyricLines = [];
    notifyListeners();
  }

  // ── 本地音乐 ───────────────────────────────────────────────

  static bool isAudioName(String name) {
    final ext = name.split('.').last.toLowerCase();
    return _audioExts.contains(ext);
  }

  Future<int> pickFolder() async {
    final dir = await FilePicker.getDirectoryPath();
    if (dir == null) return 0;
    final files = <MusicTrack>[];
    void scan(Directory d) {
      try {
        for (final e in d.listSync()) {
          if (e is Directory) {
            scan(e);
          } else if (e is File && isAudioName(e.path)) {
            files.add(MusicTrack(
              name: e.path.split(RegExp(r'[/\\]')).last,
              url: e.path,
              source: 'local',
            ));
          }
        }
      } catch (_) {}
    }

    scan(Directory(dir));
    if (files.isEmpty) return 0;
    setPlaylist(files);
    return files.length;
  }

  Future<int> pickFiles() async {
    final files = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: _audioExts,
    );
    if (files.isEmpty) return 0;
    final tracks = files
        .where((f) => f.path != null)
        .map((f) => MusicTrack(
              name: f.name,
              url: f.path!,
              source: 'local',
            ))
        .toList();
    if (tracks.isEmpty) return 0;
    setPlaylist(tracks);
    return tracks.length;
  }

  // ── 网易云在线 ─────────────────────────────────────────────

  Future<int> searchOnline(String keyword, {int limit = 30}) async {
    searchLoading = true;
    notifyListeners();
    final res = await _api.search(keyword, limit: limit);
    searchResults = res['success'] == true
        ? (res['songs'] as List).cast<Map<String, dynamic>>()
        : [];
    searchLoading = false;
    notifyListeners();
    return searchResults.length;
  }

  Future<bool> playOnlineSong(Map<String, dynamic> song) async {
    final id = song['id'];
    if (id == null) return false;
    final res = await _api.songUrl([id], level: qualityLevel);
    final urlInfo = (res['urls'] as List? ?? [])
        .cast<Map>()
        .where((u) => u['id'] == id)
        .firstOrNull;
    if (urlInfo == null || urlInfo['url'] == null) return false;
    final track = MusicTrack(
      name: song['name']?.toString() ?? '',
      url: urlInfo['url'],
      source: 'online',
      id: id as int,
      artist: song['artist']?.toString() ?? '',
      album: song['album']?.toString() ?? '',
      cover: song['cover']?.toString() ?? '',
    );
    playlist.add(track);
    currentIndex = playlist.length - 1;
    notifyListeners();
    await playIndex(currentIndex);
    return true;
  }

  Future<bool> addOnlineSong(Map<String, dynamic> song) async {
    final id = song['id'];
    if (id == null) return false;
    final res = await _api.songUrl([id], level: qualityLevel);
    final urlInfo = (res['urls'] as List? ?? [])
        .cast<Map>()
        .where((u) => u['id'] == id)
        .firstOrNull;
    if (urlInfo == null || urlInfo['url'] == null) return false;
    playlist.add(MusicTrack(
      name: song['name']?.toString() ?? '',
      url: urlInfo['url'],
      source: 'online',
      id: id as int,
      artist: song['artist']?.toString() ?? '',
      album: song['album']?.toString() ?? '',
      cover: song['cover']?.toString() ?? '',
    ));
    notifyListeners();
    return true;
  }

  /// 批量解析歌曲 URL 并播放（用于歌单/榜单「播放全部」）
  Future<void> playSongList(List<Map<String, dynamic>> songs) async {
    if (songs.isEmpty) return;
    final tracks = <MusicTrack>[];
    for (int i = 0; i < songs.length; i += 20) {
      final batch = songs.skip(i).take(20).toList();
      final res = await _api.songUrl(batch.map((s) => s['id']).toList(),
          level: qualityLevel);
      final urlMap = <int, dynamic>{};
      for (final u in (res['urls'] as List? ?? [])) {
        urlMap[u['id']] = u['url'];
      }
      for (final s in batch) {
        final url = urlMap[s['id']];
        if (url != null) {
          tracks.add(MusicTrack(
            name: s['name']?.toString() ?? '',
            url: url,
            source: 'online',
            id: s['id'] as int?,
            artist: s['artist']?.toString() ?? '',
            album: s['album']?.toString() ?? '',
            cover: s['cover']?.toString() ?? '',
          ));
        }
      }
    }
    if (tracks.isNotEmpty) setPlaylist(tracks);
  }

  Future<void> addSongListToQueue(List<Map<String, dynamic>> songs) async {
    for (int i = 0; i < songs.length; i += 20) {
      final batch = songs.skip(i).take(20).toList();
      final res = await _api.songUrl(batch.map((s) => s['id']).toList(),
          level: qualityLevel);
      final urlMap = <int, dynamic>{};
      for (final u in (res['urls'] as List? ?? [])) {
        urlMap[u['id']] = u['url'];
      }
      for (final s in batch) {
        final url = urlMap[s['id']];
        if (url != null) {
          playlist.add(MusicTrack(
            name: s['name']?.toString() ?? '',
            url: url,
            source: 'online',
            id: s['id'] as int?,
            artist: s['artist']?.toString() ?? '',
            album: s['album']?.toString() ?? '',
            cover: s['cover']?.toString() ?? '',
          ));
        }
      }
    }
    notifyListeners();
  }

  // ── 登录 ───────────────────────────────────────────────────

  Future<bool> checkLoginStatus() async {
    final res = await _api.loginStatus();
    if (res['success'] == true && res['loggedIn'] == true) {
      neteaseLoggedIn = true;
      neteaseUser = (res['user'] as Map?)?.cast<String, dynamic>();
      notifyListeners();
      fetchLikelist(force: true);
      return true;
    }
    neteaseLoggedIn = false;
    neteaseUser = null;
    return false;
  }

  Future<Map<String, dynamic>> setNeteaseCookie(String cookie) async {
    final res = await _api.setCookie(cookie);
    if (res['loggedIn'] == true) {
      neteaseLoggedIn = true;
      neteaseUser = (res['user'] as Map?)?.cast<String, dynamic>();
      notifyListeners();
      await fetchUserPlaylists();
      await fetchLikelist(force: true);
    }
    return res;
  }

  Future<Map<String, dynamic>> loginPhone(
      String phone, String password, String countrycode) async {
    final res = await _api.loginPhone(phone, password, countrycode);
    if (res['loggedIn'] == true) {
      neteaseLoggedIn = true;
      neteaseUser = (res['user'] as Map?)?.cast<String, dynamic>();
      notifyListeners();
      await fetchUserPlaylists();
      await fetchLikelist(force: true);
    }
    return res;
  }

  Future<Map<String, dynamic>> getQrKey() async {
    final res = await _api.qrKey();
    if (res['success'] == true) {
      qrKey = res['key'] ?? '';
      qrStatus = 801;
      qrImage = res['qrimg'] ?? '';
      notifyListeners();
    }
    return res;
  }

  Future<int> checkQrLogin() async {
    if (qrKey.isEmpty) return 0;
    final res = await _api.qrCheck(qrKey);
    if (res['success'] == true) {
      qrStatus = res['code'] ?? 0;
      if (qrStatus == 803) {
        await checkLoginStatus();
        await fetchUserPlaylists();
      }
      notifyListeners();
      return qrStatus;
    }
    return 0;
  }

  Future<void> logoutNetease() async {
    await _api.logout();
    neteaseLoggedIn = false;
    neteaseUser = null;
    userPlaylists = [];
    cloudDriveList = [];
    likedSongIds = {};
    currentLiked = false;
    _likelistLoaded = false;
    qrKey = '';
    qrStatus = 0;
    notifyListeners();
  }

  // ── 歌单 / 榜单 / 热搜 ─────────────────────────────────────

  Future<void> fetchUserPlaylists() async {
    final uid = neteaseUser?['id'];
    if (uid == null) return;
    final res = await _api.userPlaylist(uid as int);
    userPlaylists = res['success'] == true
        ? (res['playlists'] as List).cast<Map<String, dynamic>>()
        : [];
    notifyListeners();
  }

  Future<void> fetchToplist() async {
    final res = await _api.toplist();
    toplistList = res['success'] == true
        ? (res['lists'] as List).cast<Map<String, dynamic>>()
        : [];
    notifyListeners();
  }

  Future<void> fetchHotSearch() async {
    final res = await _api.hotSearch();
    hotSearchList = res['success'] == true
        ? (res['hots'] as List).cast<Map<String, dynamic>>()
        : [];
    notifyListeners();
  }

  Future<void> fetchCloudDrive() async {
    cloudDriveLoading = true;
    notifyListeners();
    final res = await _api.cloudDrive(pageSize: 100, pageNo: 0);
    cloudDriveList = res['success'] == true
        ? (res['songs'] as List).cast<Map<String, dynamic>>()
        : [];
    cloudDriveLoading = false;
    notifyListeners();
  }

  // ── 喜欢 ───────────────────────────────────────────────────

  Future<void> fetchLikelist({bool force = false}) async {
    if (_likelistLoaded && !force) return;
    final uid = neteaseUser?['id'] ?? 0;
    final res = await _api.likelist(uid as int);
    if (res['success'] == true) {
      likedSongIds = (res['ids'] as List).cast<int>().toSet();
      _likelistLoaded = true;
      notifyListeners();
    }
  }

  bool isSongLiked(int songId) => likedSongIds.contains(songId);

  Future<bool> toggleLikeSong(int songId, {bool? currentState}) async {
    if (_likingSongId == songId) return false;
    _likingSongId = songId;
    final target = currentState != null ? !currentState : !currentLiked;
    currentLiked = target;
    if (target) {
      likedSongIds.add(songId);
    } else {
      likedSongIds.remove(songId);
    }
    likedSongIds = Set.of(likedSongIds);
    notifyListeners();

    final res = await _api.like(songId, target);
    final ok = res['success'] == true;
    if (!ok) {
      currentLiked = !target;
      if (target) {
        likedSongIds.remove(songId);
      } else {
        likedSongIds.add(songId);
      }
      likedSongIds = Set.of(likedSongIds);
      notifyListeners();
    }
    _likingSongId = null;
    return ok;
  }

  Future<bool> toggleSongLike(int songId) async {
    final wasLiked = likedSongIds.contains(songId);
    return toggleLikeSong(songId, currentState: wasLiked);
  }
}
