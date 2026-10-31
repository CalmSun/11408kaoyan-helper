import 'dart:convert';
import 'dart:math';

import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'netease_crypto.dart';

/// 网易云音乐 API 客户端。
///
/// 完整对齐 Electron 版 `src/main/main.ts` 的 netease* 系列函数，
/// 并参考 bujuan 的 bujuan_music_api 补充「每日推荐 / 歌手 / 专辑 / 新歌速递 /
/// 歌单分类 / 精品歌单」等发现类接口。
///
/// 请求层：eapi（客户端，风控松）优先，失败降级 weapi（网页版）；
/// 二维码登录等走 plain / get 明文接口。
class NeteaseApi {
  NeteaseApi._();
  static final NeteaseApi instance = NeteaseApi._();

  static const String _cookieKey = 'netease_cookies';

  final Map<String, String> _cookies = {};
  final Dio _dio = Dio();
  final String _deviceId = NeteaseCrypto.generateDeviceId();
  final Random _rand = Random();
  bool _cookiesLoaded = false;

  /// 常见中国 IP 段（X-Real-IP / X-Forwarded-For 伪装，避免 -460 风控）
  static const List<String> _cnIps = [
    '116.25.146.177',
    '183.232.231.172',
    '112.65.208.134',
    '120.196.165.24',
    '180.101.49.11',
  ];

  String get _randomCnIp => _cnIps[_rand.nextInt(_cnIps.length)];

  String get _requestId =>
      '${DateTime.now().millisecondsSinceEpoch}_${(_rand.nextInt(10000)).toString().padLeft(4, '0')}';

  // ── Cookie 持久化 ─────────────────────────────────────────

  Future<void> _ensureCookiesLoaded() async {
    if (_cookiesLoaded) return;
    _cookiesLoaded = true;
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_cookieKey);
      if (raw != null && raw.isNotEmpty) {
        final obj = jsonDecode(raw) as Map<String, dynamic>;
        obj.forEach((k, v) => _cookies[k] = v.toString());
      }
    } catch (_) {}
  }

  Future<void> _saveCookies() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_cookieKey, jsonEncode(_cookies));
    } catch (_) {}
  }

  void _parseSetCookies(Response resp) {
    final list = resp.headers['set-cookie'];
    if (list == null) return;
    final cookies = list;
    var changed = false;
    for (final c in cookies) {
      final kv = c.split(';').first.trim();
      final eq = kv.indexOf('=');
      if (eq > 0) {
        final key = kv.substring(0, eq).trim();
        final val = kv.substring(eq + 1).trim();
        if (key.isNotEmpty && val.isNotEmpty) {
          _cookies[key] = val;
          changed = true;
        }
      }
    }
    if (changed) _saveCookies();
  }

  /// 构建完整 Cookie 头（对应 buildCookieHeader，补匿名 cookie 防 -460）
  String _buildCookieHeader(String uri) {
    _cookies.putIfAbsent('_ntes_nuid', () => NeteaseCrypto.randomHex(16));
    if (!_cookies.containsKey('_ntes_nnid')) {
      final nuid = _cookies['_ntes_nuid'] ?? NeteaseCrypto.randomHex(16);
      _cookies['_ntes_nnid'] =
          '$nuid,${DateTime.now().millisecondsSinceEpoch}';
    }
    _cookies.putIfAbsent('WNMCID', () => _deviceId);
    _cookies.putIfAbsent('WEVNSM', () => '1.0.0');
    _cookies.putIfAbsent('__remember_me', () => 'true');
    _cookies.putIfAbsent('ntes_kaola_ad', () => '1');
    _cookies.putIfAbsent('os', () => 'pc');
    _cookies.putIfAbsent('appver', () => '3.1.17.204416');
    _cookies.putIfAbsent('osver',
        () => 'Microsoft-Windows-10-Professional-build-19045-64bit');
    _cookies.putIfAbsent('channel', () => 'netease');
    _cookies.putIfAbsent('deviceId', () => _deviceId);
    if (!uri.contains('login')) {
      _cookies['NMTID'] = NeteaseCrypto.randomHex(8);
    }
    return _cookies.entries
        .map((e) =>
            '${Uri.encodeComponent(e.key)}=${Uri.encodeComponent(e.value)}')
        .join('; ');
  }

  // ── 请求层 ────────────────────────────────────────────────

  Map<String, String> _baseHeaders(String ua) => {
        'Referer': 'https://music.163.com/',
        'Origin': 'https://music.163.com',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'User-Agent': ua,
        'X-Real-IP': _randomCnIp,
        'X-Forwarded-For': _randomCnIp,
      };

  static const String _webUa =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0';
  static const String _mobileUa =
      'NeteaseMusic/9.1.65.240927161425(9001065);Dalvik/2.1.0 (Linux; U; Android 14; 23013RK75C Build/UKQ1.230804.001)';

  /// eapi 请求（模拟移动端客户端）
  Future<Map<String, dynamic>> _eapiRequest(
      String path, Map<String, dynamic> data) async {
    await _ensureCookiesLoaded();
    final csrf = _cookies['__csrf'] ?? '';
    final clientHeader = <String, String>{
      'osver': _cookies['osver'] ??
          'Microsoft-Windows-10-Professional-build-19045-64bit',
      'deviceId': _cookies['deviceId'] ?? _deviceId,
      'os': _cookies['os'] ?? 'pc',
      'appver': _cookies['appver'] ?? '3.1.17.204416',
      'versioncode': '140',
      'mobilename': '',
      'buildver':
          DateTime.now().millisecondsSinceEpoch.toString().substring(0, 10),
      'resolution': '1920x1080',
      '__csrf': csrf,
      'channel': _cookies['channel'] ?? 'netease',
      'requestId': _requestId,
    };
    final musicU = _cookies['MUSIC_U'];
    final musicA = _cookies['MUSIC_A'];
    if (musicU != null) clientHeader['MUSIC_U'] = musicU;
    if (musicA != null) clientHeader['MUSIC_A'] = musicA;
    final cookieStr = clientHeader.entries
        .map((e) =>
            '${Uri.encodeComponent(e.key)}=${Uri.encodeComponent(e.value)}')
        .join('; ');

    final eapiData = {...data, 'header': clientHeader};
    final params = NeteaseCrypto.eapi('/api$path', eapiData).params;

    final resp = await _dio.post<dynamic>(
      'https://music.163.com/eapi$path',
      data: 'params=${Uri.encodeComponent(params)}',
      options: Options(
        headers: {..._baseHeaders(_mobileUa), 'Cookie': cookieStr},
        contentType: Headers.formUrlEncodedContentType,
        responseType: ResponseType.json,
      ),
    );
    _parseSetCookies(resp);
    final json = _asMap(resp.data);
    if (json['code'] != 200) {
      throw Exception(
          'NetEase eapi $path code=${json['code']}${json['message'] != null ? ': ${json['message']}' : ''}');
    }
    return json;
  }

  /// weapi 请求（网页版）
  Future<Map<String, dynamic>> _weapiRequest(
      String path, Map<String, dynamic> data) async {
    await _ensureCookiesLoaded();
    final csrf = _cookies['__csrf'] ?? '';
    final enc = NeteaseCrypto.weapi({...data, 'csrf_token': csrf});
    final url = csrf.isNotEmpty
        ? 'https://music.163.com/weapi$path?csrf_token=$csrf'
        : 'https://music.163.com/weapi$path';
    final resp = await _dio.post<dynamic>(
      url,
      data:
          'params=${Uri.encodeComponent(enc.params)}&encSecKey=${Uri.encodeComponent(enc.encSecKey)}',
      options: Options(
        headers: {..._baseHeaders(_webUa), 'Cookie': _buildCookieHeader(path)},
        contentType: Headers.formUrlEncodedContentType,
        responseType: ResponseType.json,
      ),
    );
    _parseSetCookies(resp);
    final json = _asMap(resp.data);
    if (json['code'] != 200) {
      throw Exception(
          'NetEase weapi $path code=${json['code']}${json['message'] != null ? ': ${json['message']}' : ''}');
    }
    return json;
  }

  /// 智能请求：eapi 优先，失败降级 weapi
  Future<Map<String, dynamic>> _smart(String path, Map<String, dynamic> data) async {
    try {
      return await _eapiRequest(path, data);
    } catch (e) {
      try {
        return await _weapiRequest(path, data);
      } catch (_) {
        rethrow;
      }
    }
  }

  /// 明文 POST（二维码登录等接口）
  Future<Map<String, dynamic>> _plain(
      String path, Map<String, dynamic> data) async {
    await _ensureCookiesLoaded();
    final resp = await _dio.post<dynamic>(
      'https://music.163.com/api$path',
      data: data,
      options: Options(
        headers: {..._baseHeaders(_webUa), 'Cookie': _buildCookieHeader(path)},
        contentType: Headers.formUrlEncodedContentType,
        responseType: ResponseType.json,
      ),
    );
    _parseSetCookies(resp);
    return _asMap(resp.data);
  }

  /// 明文 GET 请求
  Future<Map<String, dynamic>> _get(
      String path, Map<String, String> query) async {
    await _ensureCookiesLoaded();
    final params = {...query, 'timestamp': DateTime.now().millisecondsSinceEpoch.toString()};
    final resp = await _dio.get<dynamic>(
      'https://music.163.com/api$path',
      queryParameters: params,
      options: Options(
        headers: {..._baseHeaders(_webUa), 'Cookie': _buildCookieHeader(path)},
        responseType: ResponseType.json,
      ),
    );
    _parseSetCookies(resp);
    return _asMap(resp.data);
  }

  Map<String, dynamic> _asMap(dynamic d) {
    if (d is Map<String, dynamic>) return d;
    if (d is Map) return d.map((k, v) => MapEntry(k.toString(), v));
    return {};
  }

  // ── 搜索 / 播放 / 歌词 ─────────────────────────────────────

  Future<Map<String, dynamic>> search(String keyword,
      {int limit = 30, int offset = 0}) async {
    try {
      final data = await _smart('/cloudsearch/get/web', {
        's': keyword,
        'type': 1,
        'limit': limit,
        'offset': offset,
        'total': true,
      });
      final result = data['result'] as Map? ?? {};
      final songs = (result['songs'] as List? ?? [])
          .map((s) => _mapSong(s))
          .where((s) => s['id'] != null)
          .toList();
      return {
        'success': true,
        'songs': songs,
        'total': result['songCount'] ?? 0,
      };
    } catch (e) {
      return {'success': false, 'songs': [], 'total': 0, 'message': '$e'};
    }
  }

  Map<String, dynamic> _mapSong(dynamic s) {
    if (s is! Map) return {};
    final ar = (s['ar'] as List? ?? [])
        .map((a) => (a as Map?)?['name']?.toString() ?? '')
        .where((n) => n.isNotEmpty)
        .join(' / ');
    return {
      'id': s['id'],
      'name': s['name']?.toString() ?? '',
      'artist': ar,
      'album': (s['al'] as Map?)?['name']?.toString() ?? '',
      'cover': (s['al'] as Map?)?['picUrl']?.toString() ?? '',
      'duration': s['dt'] ?? 0,
    };
  }

  Future<Map<String, dynamic>> songUrl(List<dynamic> ids,
      {String level = 'exhigh'}) async {
    try {
      Map<String, dynamic> data;
      try {
        data = await _smart('/song/url/v1', {
          'id': ids.join(','),
          'level': level,
        });
        final list = data['data'] as List? ?? [];
        if (list.isEmpty || list.every((d) => (d as Map?)?['url'] == null)) {
          throw Exception('v1 returned empty urls');
        }
      } catch (_) {
        const brMap = {
          'standard': 128000,
          'higher': 192000,
          'exhigh': 320000,
          'lossless': 999000,
          'hires': 999000,
        };
        data = await _smart('/song/enhance/player/url', {
          'ids': ids,
          'br': brMap[level] ?? 320000,
        });
      }
      final urls = (data['data'] as List? ?? [])
          .map((d) {
            final m = _jsonMap(d);
            return {'id': m['id'], 'url': m['url'], 'br': m['br'] ?? 0};
          })
          .toList();
      return {'success': true, 'urls': urls};
    } catch (e) {
      return {'success': false, 'urls': [], 'message': '$e'};
    }
  }

  Future<Map<String, dynamic>> lyric(int id) async {
    try {
      final data = await _smart('/song/lyric', {'id': id, 'lv': -1, 'kv': -1, 'tv': -1});
      return {
        'success': true,
        'lyric': (data['lrc'] as Map?)?['lyric']?.toString() ?? '',
        'tlyric': (data['tlyric'] as Map?)?['lyric']?.toString() ?? '',
      };
    } catch (e) {
      return {'success': false, 'lyric': '', 'tlyric': '', 'message': '$e'};
    }
  }

  Future<Map<String, dynamic>> songDetail(List<dynamic> ids) async {
    try {
      final data = await _smart('/v3/song/detail', {'c': ids.map((e) => e.toString()).join(',')});
      final songs = (data['songs'] as List? ?? []).map(_mapSong).toList();
      return {'success': true, 'songs': songs};
    } catch (e) {
      return {'success': false, 'songs': [], 'message': '$e'};
    }
  }

  // ── 登录 ───────────────────────────────────────────────────

  Future<Map<String, dynamic>> qrKey() async {
    try {
      String key = '';
      try {
        final d1 = await _get('/login/qrcode/unikey', {});
        key = (d1['unikey'] ?? d1['data']?['unikey'])?.toString() ?? '';
      } catch (_) {}
      if (key.isEmpty) {
        try {
          final d1b = await _plain('/login/qrcode/unikey', {'type': 3});
          key = (d1b['unikey'] ?? d1b['data']?['unikey'])?.toString() ?? '';
        } catch (_) {}
      }
      if (key.isEmpty) {
        return {'success': false, 'key': '', 'qrimg': '', 'message': '获取二维码 key 失败'};
      }
      final qrurl = 'https://music.163.com/login?codekey=$key';
      final qrimg =
          'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${Uri.encodeComponent(qrurl)}';
      return {'success': true, 'key': key, 'qrimg': qrimg, 'qrurl': qrurl};
    } catch (e) {
      return {'success': false, 'key': '', 'qrimg': '', 'message': '$e'};
    }
  }

  Future<Map<String, dynamic>> qrCheck(String key) async {
    Map<String, dynamic> tryParse(Map<String, dynamic> d) {
      final code = d['code'] ?? 0;
      if (code == 803) {
        final ck = d['cookie']?.toString() ?? '';
        ck.split(';').forEach((pair) {
          final eq = pair.indexOf('=');
          if (eq > 0) {
            final k = pair.substring(0, eq).trim();
            final v = pair.substring(eq + 1).trim();
            if (k.isNotEmpty && v.isNotEmpty) _cookies[k] = v;
          }
        });
        _saveCookies();
      }
      return {
        'success': true,
        'code': code,
        'message': d['message']?.toString() ?? '',
        'cookie': d['cookie']?.toString() ?? '',
      };
    }

    try {
      return tryParse(await _get('/login/qrcode/client/login', {'key': key, 'type': '3'}));
    } catch (_) {
      try {
        return tryParse(await _plain('/login/qrcode/client/login', {'key': key, 'type': 3}));
      } catch (e) {
        return {'success': false, 'code': 0, 'message': '$e', 'cookie': ''};
      }
    }
  }

  Future<Map<String, dynamic>> loginStatus() async {
    try {
      final data = await _smart('/w/nuser/account/get', {});
      final profile = data['profile'] as Map?;
      if (data['code'] == 200 && profile != null) {
        return {
          'success': true,
          'loggedIn': true,
          'user': {
            'id': profile['userId'] ?? 0,
            'nickname': profile['nickname']?.toString() ?? '',
            'avatar': profile['avatarUrl']?.toString() ?? '',
            'signature': profile['signature']?.toString() ?? '',
            'level': profile['level'] ?? 0,
          },
        };
      }
      return {'success': true, 'loggedIn': false, 'user': null};
    } catch (e) {
      return {'success': false, 'loggedIn': false, 'user': null, 'message': '$e'};
    }
  }

  Future<Map<String, dynamic>> logout() async {
    try {
      await _smart('/logout', {});
    } catch (_) {}
    _cookies.clear();
    await _saveCookies();
    return {'success': true};
  }

  Future<Map<String, dynamic>> setCookie(String cookieStr) async {
    try {
      if (cookieStr.trim().isEmpty) {
        return {'success': false, 'message': 'Cookie 不能为空'};
      }
      cookieStr.split(';').forEach((pair) {
        final idx = pair.indexOf('=');
        if (idx > 0) {
          final k = pair.substring(0, idx).trim();
          final v = pair.substring(idx + 1).trim();
          if (k.isNotEmpty && v.isNotEmpty) _cookies[k] = v;
        }
      });
      await _saveCookies();
      final status = await loginStatus();
      if (status['loggedIn'] == true) {
        final u = status['user'] as Map? ?? {};
        return {
          'success': true,
          'loggedIn': true,
          'user': {'id': u['id'], 'nickname': u['nickname'], 'avatar': u['avatar']},
        };
      }
      return {
        'success': true,
        'loggedIn': false,
        'user': null,
        'message': 'Cookie 已保存但登录验证失败',
      };
    } catch (e) {
      return {'success': false, 'message': '$e'};
    }
  }

  Future<Map<String, dynamic>> loginPhone(
      String phone, String password, String countrycode) async {
    try {
      if (phone.isEmpty || password.isEmpty) {
        return {'success': false, 'message': '手机号和密码不能为空'};
      }
      final md5Password = NeteaseCrypto.md5(password);
      final data = await _plain('/w/login/cellphone', {
        'type': '1',
        'https': 'true',
        'phone': phone,
        'countrycode': countrycode,
        'remember': 'true',
        'password': md5Password,
      });
      if (data['code'] == 200) {
        final status = await loginStatus();
        if (status['loggedIn'] == true) {
          final u = status['user'] as Map? ?? {};
          return {
            'success': true,
            'loggedIn': true,
            'user': {'id': u['id'], 'nickname': u['nickname'], 'avatar': u['avatar']},
          };
        }
      }
      return {
        'success': false,
        'message': data['msg']?.toString() ?? data['message']?.toString() ?? '登录失败',
      };
    } catch (e) {
      return {'success': false, 'message': '$e'};
    }
  }

  // ── 歌单 ───────────────────────────────────────────────────

  Future<Map<String, dynamic>> userPlaylist(int uid,
      {int limit = 100, int offset = 0}) async {
    try {
      final data = await _smart('/user/playlist',
          {'uid': uid, 'limit': limit, 'offset': offset, 'includeVideo': true});
      final playlists = (data['playlist'] as List? ?? [])
          .map((p) {
            final m = _jsonMap(p);
            return {
              'id': m['id'],
              'name': m['name']?.toString() ?? '',
              'cover': m['coverImgUrl']?.toString() ?? '',
              'playCount': m['playCount'] ?? 0,
              'trackCount': m['trackCount'] ?? 0,
              'creator': _jsonMap(m['creator'])['nickname']?.toString() ?? '',
            };
          })
          .toList();
      return {'success': true, 'playlists': playlists};
    } catch (e) {
      return {'success': false, 'playlists': [], 'message': '$e'};
    }
  }

  Future<Map<String, dynamic>> playlistDetail(int id) async {
    try {
      final data =
          await _smart('/v6/playlist/detail', {'id': id, 'n': 100000, 's': 8});
      final pl = data['playlist'] as Map?;
      if (pl == null) {
        return {'success': false, 'playlist': null, 'tracks': [], 'message': '歌单不存在'};
      }
      var tracks = (pl['tracks'] as List? ?? []).map(_mapSong).toList();
      // 兜底：分页拉取全部歌曲
      try {
        final all = <dynamic>[];
        for (int offset = 0; offset < 100000; offset += 500) {
          final page = await _smart('/v1/playlist/track/all',
              {'id': id, 'limit': 500, 'offset': offset});
          final songs = page['songs'] as List? ?? [];
          if (songs.isEmpty) break;
          all.addAll(songs);
          if (songs.length < 500) break;
        }
        if (all.isNotEmpty) tracks = all.map(_mapSong).toList();
      } catch (_) {}
      return {
        'success': true,
        'playlist': {
          'id': pl['id'],
          'name': pl['name']?.toString() ?? '',
          'cover': pl['coverImgUrl']?.toString() ?? '',
          'playCount': pl['playCount'] ?? 0,
          'trackCount': pl['trackCount'] ?? 0,
          'description': pl['description']?.toString() ?? '',
        },
        'tracks': tracks,
      };
    } catch (e) {
      return {'success': false, 'playlist': null, 'tracks': [], 'message': '$e'};
    }
  }

  // ── 发现页（参考 bujuan） ─────────────────────────────────

  /// 每日推荐歌曲（需登录）
  Future<Map<String, dynamic>> recommendSongs() async {
    try {
      final data = await _smart('/v3/discovery/recommend/songs', {});
      final daily = data['data'] as Map? ?? {};
      final songs = (daily['dailySongs'] as List? ?? []).map(_mapSong).toList();
      return {'success': true, 'songs': songs};
    } catch (e) {
      return {'success': false, 'songs': [], 'message': '$e'};
    }
  }

  /// 热门歌手
  Future<Map<String, dynamic>> topArtist({int limit = 50, int offset = 0}) async {
    try {
      final data = await _smart('/artist/top', {'limit': limit, 'offset': offset, 'total': false});
      final artists = (data['artists'] as List? ?? [])
          .map((a) {
            final m = _jsonMap(a);
            return {
              'id': m['id'],
              'name': m['name']?.toString() ?? '',
              'cover': m['picUrl']?.toString() ?? '',
              'albumCount': m['albumSize'] ?? 0,
              'musicCount': m['musicSize'] ?? 0,
            };
          })
          .toList();
      return {'success': true, 'artists': artists};
    } catch (e) {
      return {'success': false, 'artists': [], 'message': '$e'};
    }
  }

  /// 最新专辑
  Future<Map<String, dynamic>> newAlbum(
      {int limit = 30, int offset = 0, String area = 'ALL'}) async {
    try {
      final data = await _smart('/album/new',
          {'limit': limit, 'offset': offset, 'area': area, 'total': true});
      final albums = (data['albums'] as List? ?? [])
          .map((a) {
            final m = _jsonMap(a);
            return {
              'id': m['id'],
              'name': m['name']?.toString() ?? '',
              'artist': _jsonMap(m['artist'])['name']?.toString() ?? '',
              'cover': m['picUrl']?.toString() ?? '',
            };
          })
          .toList();
      return {'success': true, 'albums': albums};
    } catch (e) {
      return {'success': false, 'albums': [], 'message': '$e'};
    }
  }

  /// 专辑内容（含歌曲）
  Future<Map<String, dynamic>> albumInfo(int id) async {
    try {
      final data = await _smart('/v1/album/$id', {});
      final album = data['album'] as Map? ?? {};
      final songs = (data['songs'] as List? ?? []).map(_mapSong).toList();
      return {
        'success': true,
        'album': {
          'id': album['id'],
          'name': album['name']?.toString() ?? '',
          'artist': (album['artist'] as Map?)?['name']?.toString() ?? '',
          'cover': album['picUrl']?.toString() ?? '',
        },
        'songs': songs,
      };
    } catch (e) {
      return {'success': false, 'album': null, 'songs': [], 'message': '$e'};
    }
  }

  /// 新歌速递
  Future<Map<String, dynamic>> newSongs({int type = 0}) async {
    try {
      final data = await _smart('/v1/discovery/new/songs', {'type': type});
      final songs = (data['data'] as List? ?? []).map(_mapSong).toList();
      return {'success': true, 'songs': songs};
    } catch (e) {
      return {'success': false, 'songs': [], 'message': '$e'};
    }
  }

  /// 歌单分类
  Future<Map<String, dynamic>> playlistCatalogue() async {
    try {
      final data = await _smart('/playlist/catalogue', {});
      return {
        'success': true,
        'categories': data['categories'] ?? {},
        'sub': data['sub'] ?? [],
      };
    } catch (e) {
      return {'success': false, 'categories': {}, 'sub': [], 'message': '$e'};
    }
  }

  /// 精品歌单
  Future<Map<String, dynamic>> highQualityPlaylist(
      {String cat = '全部', int limit = 30, int offset = 0}) async {
    try {
      final data = await _smart('/top/playlist/highquality',
          {'cat': cat, 'limit': limit, 'offset': offset, 'before': 0});
      final playlists = (data['playlists'] as List? ?? [])
          .map((p) {
            final m = _jsonMap(p);
            return {
              'id': m['id'],
              'name': m['name']?.toString() ?? '',
              'cover': m['coverImgUrl']?.toString() ?? '',
              'playCount': m['playCount'] ?? 0,
              'trackCount': m['trackCount'] ?? 0,
              'creator': _jsonMap(m['creator'])['nickname']?.toString() ?? '',
            };
          })
          .toList();
      return {'success': true, 'playlists': playlists};
    } catch (e) {
      return {'success': false, 'playlists': [], 'message': '$e'};
    }
  }

  // ── 排行榜 / 热搜 ──────────────────────────────────────────

  Future<Map<String, dynamic>> toplist() async {
    try {
      final data = await _smart('/toplist/detail', {});
      final lists = (data['list'] as List? ?? [])
          .map((l) {
            final m = _jsonMap(l);
            return {
              'id': m['id'],
              'name': m['name']?.toString() ?? '',
              'cover': m['coverImgUrl']?.toString() ?? '',
              'updateFrequency': m['updateFrequency']?.toString() ?? '',
              'description': m['description']?.toString() ?? '',
              'playCount': m['playCount'] ?? 0,
              'topTracks': (m['tracks'] as List? ?? [])
                  .take(3)
                  .map((t) {
                    final tm = _jsonMap(t);
                    return {
                      'name': tm['first']?.toString() ?? '',
                      'artist': tm['second']?.toString() ?? '',
                    };
                  })
                  .toList(),
            };
          })
          .toList();
      return {'success': true, 'lists': lists};
    } catch (e) {
      return {'success': false, 'lists': [], 'message': '$e'};
    }
  }

  Future<Map<String, dynamic>> toplistDetail(int id) async {
    try {
      final data = await _smart('/v6/playlist/detail', {'id': id, 'n': 100000, 's': 8});
      final pl = data['playlist'] as Map?;
      if (pl == null) {
        return {'success': false, 'playlist': null, 'tracks': [], 'message': '榜单不存在'};
      }
      final tracks = (pl['tracks'] as List? ?? []).map(_mapSong).toList();
      return {
        'success': true,
        'playlist': {
          'id': pl['id'],
          'name': pl['name']?.toString() ?? '',
          'cover': pl['coverImgUrl']?.toString() ?? '',
          'playCount': pl['playCount'] ?? 0,
          'trackCount': pl['trackCount'] ?? 0,
        },
        'tracks': tracks,
      };
    } catch (e) {
      return {'success': false, 'playlist': null, 'tracks': [], 'message': '$e'};
    }
  }

  Future<Map<String, dynamic>> hotSearch() async {
    try {
      final data = await _smart('/search/hot', {'type': 1111});
      final result = data['result'] as Map? ?? {};
      final hots = (result['hots'] as List? ?? [])
          .asMap()
          .entries
          .map((e) => {
                'rank': e.key + 1,
                'keyword': (e.value as Map?)?['first']?.toString() ?? '',
                'score': (e.value as Map?)?['second'] ?? 0,
                'iconUrl': (e.value as Map?)?['iconUrl']?.toString() ?? '',
              })
          .toList();
      return {'success': true, 'hots': hots};
    } catch (e) {
      return {'success': false, 'hots': [], 'message': '$e'};
    }
  }

  // ── 喜欢 ───────────────────────────────────────────────────

  Future<Map<String, dynamic>> like(dynamic songId, bool like) async {
    try {
      await _smart('/song/like', {'trackId': songId, 'like': like});
      return {'success': true, 'liked': like};
    } catch (e) {
      return {'success': false, 'liked': false, 'message': '$e'};
    }
  }

  Future<Map<String, dynamic>> likelist(int uid) async {
    try {
      final data = await _smart('/song/like/get', {'uid': uid});
      List<dynamic> ids = [];
      if (data['ids'] is List) {
        ids = data['ids'] as List;
      } else if (data['data'] is List) {
        ids = data['data'] as List;
      } else if (data['data'] is Map && data['data']['ids'] is List) {
        ids = data['data']['ids'] as List;
      }
      return {
        'success': true,
        'ids': ids.map((e) => int.tryParse('$e') ?? 0).where((e) => e > 0).toList(),
      };
    } catch (e) {
      return {'success': false, 'ids': [], 'message': '$e'};
    }
  }

  // ── 评论 ───────────────────────────────────────────────────

  Future<Map<String, dynamic>> comments(int id,
      {int pageNo = 1, int pageSize = 20}) async {
    try {
      final offset = (pageNo - 1) * pageSize;
      final data = await _smart('/v1/resource/comments/R_SO_4_$id', {
        'rid': id,
        'limit': pageSize,
        'offset': offset,
        'beforeTime': pageNo > 1 ? DateTime.now().millisecondsSinceEpoch.toString() : '0',
      });
      Map<String, dynamic> mapComment(dynamic c) {
        final m = _jsonMap(c);
        final reply = ((m['beReplied'] as List?)?.isNotEmpty ?? false)
            ? _jsonMap((m['beReplied'] as List).first)
            : <String, dynamic>{};
        final replyUser = _jsonMap(reply['user']);
        return {
          'commentId': m['commentId'],
          'content': m['content']?.toString() ?? '',
          'time': m['time'] ?? 0,
          'likedCount': m['likedCount'] ?? 0,
          'liked': m['liked'] ?? false,
          'nickname': _jsonMap(m['user'])['nickname']?.toString() ?? '匿名用户',
          'avatar': _jsonMap(m['user'])['avatarUrl']?.toString() ?? '',
          'userId': _jsonMap(m['user'])['userId'] ?? 0,
          'repliedContent': reply['content']?.toString() ?? '',
          'repliedNickname': replyUser['nickname']?.toString() ?? '',
        };
      }

      final hot = (data['hotComments'] as List? ?? []).map(mapComment).toList();
      final regular = (data['comments'] as List? ?? []).map(mapComment).toList();
      return {
        'success': true,
        'comments': regular,
        'hotComments': hot,
        'total': data['total'] ?? 0,
      };
    } catch (e) {
      return {
        'success': false,
        'comments': [],
        'hotComments': [],
        'total': 0,
        'message': '$e',
      };
    }
  }

  Future<Map<String, dynamic>> commentLike(
      int songId, int commentId, bool like) async {
    try {
      final path = like ? '/v1/comment/like' : '/v1/comment/unlike';
      await _smart(path, {
        'threadId': 'R_SO_4_$songId',
        'commentId': commentId.toString(),
      });
      return {'success': true, 'liked': like};
    } catch (e) {
      return {'success': false, 'liked': !like, 'message': '$e'};
    }
  }

  // ── 云盘 ───────────────────────────────────────────────────

  Future<Map<String, dynamic>> cloudDrive({int pageSize = 100, int pageNo = 0}) async {    try {
      final data = await _smart('/v1/cloud/get',
          {'limit': pageSize, 'offset': pageNo * pageSize});
      final count = int.tryParse('${data['count'] ?? 0}') ?? 0;
      final songs = (data['data'] as List? ?? []).map((item) {
        final m = item as Map? ?? {};
        final ss = m['simpleSong'] as Map? ?? {};
        final ar = (ss['ar'] as List? ?? [])
            .map((a) => (a as Map?)?['name']?.toString() ?? '')
            .where((n) => n.isNotEmpty)
            .join(' / ');
        final id = int.tryParse('${m['songId'] ?? ss['id'] ?? 0}') ?? 0;
        return {
          'id': id,
          'name': ss['name']?.toString() ?? m['fileName']?.toString() ?? '$id',
          'artist': ar.isNotEmpty ? ar : (m['artist']?.toString() ?? ''),
          'album': (ss['al'] as Map?)?['name']?.toString() ?? m['album']?.toString() ?? '',
          'cover': (ss['al'] as Map?)?['picUrl']?.toString() ?? '',
          'duration': ss['dt'] ?? m['playTime'] ?? 0,
          'fileName': m['fileName']?.toString() ?? '',
          'fileSize': int.tryParse('${m['fileSize'] ?? 0}') ?? 0,
          'addTime': int.tryParse('${m['addTime'] ?? 0}') ?? 0,
          'level': m['level']?.toString() ?? '',
        };
      }).toList();
      return {'success': true, 'songs': songs, 'count': count};
    } catch (e) {
      return {'success': false, 'songs': [], 'count': 0, 'message': '$e'};
    }
  }

  /// 删除云盘歌曲
  Future<Map<String, dynamic>> cloudDelete(List<dynamic> songIds) async {
    try {
      await _smart('/cloud/del', {'songIds': songIds});
      return {'success': true};
    } catch (e) {
      return {'success': false, 'message': '$e'};
    }
  }

  /// 云盘歌曲播放地址
  Future<Map<String, dynamic>> cloudSongUrl(int songId) async {
    try {
      final data = await _smart('/cloud/song/url', {'id': songId});
      final raw = data['data'] is List
          ? ((data['data'] as List).isNotEmpty ? data['data'][0] : null)
          : data['data'];
      final url = _jsonMap(raw)['url']?.toString() ?? '';
      return {'success': url.isNotEmpty, 'url': url};
    } catch (e) {
      return {'success': false, 'url': '', 'message': '$e'};
    }
  }

  // ── 下载 ───────────────────────────────────────────────────

  Future<Map<String, dynamic>> downloadUrl(int songId,
      {String level = 'exhigh'}) async {
    try {
      Map<String, dynamic> data;
      try {
        data = await _smart('/song/enhance/download/url/v1',
            {'id': songId, 'level': level, 'encodeType': 'mp3'});
      } catch (_) {
        data = await _smart('/song/enhance/player/url/v1',
            {'ids': jsonEncode([songId]), 'level': level, 'encodeType': 'mp3'});
      }
      final raw = data['data'] is List
          ? ((data['data'] as List).isNotEmpty ? data['data'][0] : null)
          : data['data'];
      final songData = _jsonMap(raw);
      final url = songData['url']?.toString() ?? '';
      if (url.isEmpty) return {'success': false, 'message': '无法获取下载链接'};
      return {
        'success': true,
        'url': url,
        'level': songData['level'],
        'size': songData['size'],
        'type': songData['type'],
        'br': songData['br'],
        'md5': songData['md5'],
      };
    } catch (e) {
      return {'success': false, 'message': '$e'};
    }
  }

  /// 当前是否已登录（供 UI 快速判断）
  bool get hasCookie => _cookies.containsKey('MUSIC_U');

  // ── 下载（字节流） ─────────────────────────────────────────

  /// 获取歌曲可下载 URL 并拉取字节（需登录，受版权/音质限制）。
  Future<Map<String, dynamic>> downloadSong(int songId,
      {String level = 'exhigh'}) async {
    try {
      final info = await downloadUrl(songId, level: level);
      if (info['success'] != true) return info;
      final url = info['url']?.toString() ?? '';
      if (url.isEmpty) return {'success': false, 'message': '下载链接为空'};
      final resp = await _dio.get<List<int>>(
        url,
        options: Options(
          responseType: ResponseType.bytes,
          followRedirects: true,
          headers: {
            ..._baseHeaders(_webUa),
            'Cookie': _buildCookieHeader(''),
            'Accept': '*/*',
          },
        ),
      );
      final bytes = resp.data ?? <int>[];
      if (bytes.isEmpty) return {'success': false, 'message': '下载内容为空'};
      return {
        'success': true,
        'bytes': bytes,
        'type': info['type']?.toString() ?? 'mp3',
        'br': info['br'] ?? 0,
        'url': url,
      };
    } catch (e) {
      return {'success': false, 'message': '$e'};
    }
  }
}

/// dynamic 安全转 Map，避免 dynamic 上 [] 的空安全检查报错
Map<String, dynamic> _jsonMap(dynamic v) => v is Map
    ? v.map<String, dynamic>((k, e) => MapEntry(k.toString(), e))
    : <String, dynamic>{};
