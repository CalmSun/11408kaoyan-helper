import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// 本地存储服务：与 Electron 版的 localStorage 封装（utils/storage.ts）对应。
///
/// - 数据 JSON 序列化后存入 shared_preferences（跨 Windows/Linux/Android）
/// - key 前缀沿用 `kaoyan_helper_`（游客），用户多账号前缀 `kaoyan_user_` 在用户模块接入
/// - 写入即持久化，无内存缓存层（shared_preferences 本身已做内存缓存 + 异步落盘）
class StorageService {
  StorageService._();
  static final StorageService instance = StorageService._();

  static const String guestPrefix = 'kaoyan_helper_';
  static const String userPrefix = 'kaoyan_user_';
  static const String accountsKey = 'kaoyan_accounts';
  static const String currentUserKey = 'kaoyan_current_user';

  SharedPreferences? _prefs;
  String _currentUser = '';

  bool get isReady => _prefs != null;
  String get currentUser => _currentUser;

  Future<void> init() async {
    _prefs ??= await SharedPreferences.getInstance();
    _currentUser = _prefs?.getString(currentUserKey) ?? '';
  }

  /// 设置当前用户（'' 表示游客模式）。写入 global key，并立即切换前缀。
  Future<void> setCurrentUser(String username) async {
    _currentUser = username;
    if (username.isEmpty) {
      await _prefs?.remove(currentUserKey);
    } else {
      await _prefs?.setString(currentUserKey, username);
    }
  }

  String _key(String key) => _currentUser.isEmpty
      ? '$guestPrefix$key'
      : '$userPrefix${_currentUser}_$key';

  // ── 基础类型 ──────────────────────────────────────────────

  String? getString(String key) => _prefs?.getString(_key(key));

  Future<void> setString(String key, String value) =>
      _prefs!.setString(_key(key), value);

  bool getBool(String key) => _prefs?.getBool(_key(key)) ?? false;

  Future<void> setBool(String key, bool value) =>
      _prefs!.setBool(_key(key), value);

  int getInt(String key) => _prefs?.getInt(_key(key)) ?? 0;

  Future<void> setInt(String key, int value) =>
      _prefs!.setInt(_key(key), value);

  Future<void> remove(String key) => _prefs!.remove(_key(key));

  // ── JSON 对象 ─────────────────────────────────────────────

  T? getObject<T>(String key, T Function(Map<String, dynamic>) fromJson) {
    final raw = _prefs?.getString(_key(key));
    if (raw == null || raw.isEmpty) return null;
    try {
      return fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> setObject(String key, Object value) =>
      _prefs!.setString(_key(key), jsonEncode(value));

  // ── JSON 列表 ─────────────────────────────────────────────

  List<T> getList<T>(String key, T Function(Map<String, dynamic>) fromJson) {
    final raw = _prefs?.getString(_key(key));
    if (raw == null || raw.isEmpty) return [];
    try {
      final list = jsonDecode(raw) as List;
      return list
          .map((e) => fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> setList(String key, List<Object> items) =>
      _prefs!.setString(_key(key), jsonEncode(items));

  // ── 全局 key（不带用户前缀，用于账号列表 / 当前用户） ─────

  String? getGlobalString(String key) => _prefs?.getString(key);

  Future<void> setGlobalString(String key, String value) =>
      _prefs!.setString(key, value);

  Future<void> removeGlobal(String key) => _prefs!.remove(key);

  List<T> getGlobalList<T>(String key, T Function(Map<String, dynamic>) fromJson) {
    final raw = _prefs?.getString(key);
    if (raw == null || raw.isEmpty) return [];
    try {
      final list = jsonDecode(raw) as List;
      return list
          .map((e) => fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> setGlobalList(String key, List<Object> items) =>
      _prefs!.setString(key, jsonEncode(items));

  /// 所有已存储的原始 key（跨用户前缀遍历用）
  Set<String> rawKeys() => _prefs!.getKeys();

  /// 删除当前用户前缀下的所有数据（清除全部数据 / 删除账号）
  Future<void> clearCurrentPrefix() async {
    final keys = _prefs!.getKeys().toList();
    final prefix = _currentUser.isEmpty ? guestPrefix : '$userPrefix${_currentUser}_';
    for (final k in keys) {
      if (k.startsWith(prefix)) await _prefs!.remove(k);
    }
  }
}
