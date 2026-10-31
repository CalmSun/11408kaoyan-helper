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

  SharedPreferences? _prefs;

  bool get isReady => _prefs != null;

  Future<void> init() async {
    _prefs ??= await SharedPreferences.getInstance();
  }

  String _key(String key, {bool forUser = false}) =>
      '${forUser ? userPrefix : guestPrefix}$key';

  // ── 基础类型 ──────────────────────────────────────────────

  String? getString(String key, {bool forUser = false}) =>
      _prefs?.getString(_key(key, forUser: forUser));

  Future<void> setString(String key, String value, {bool forUser = false}) =>
      _prefs!.setString(_key(key, forUser: forUser), value);

  bool getBool(String key, {bool forUser = false}) =>
      _prefs?.getBool(_key(key, forUser: forUser)) ?? false;

  Future<void> setBool(String key, bool value, {bool forUser = false}) =>
      _prefs!.setBool(_key(key, forUser: forUser), value);

  int getInt(String key, {bool forUser = false}) =>
      _prefs?.getInt(_key(key, forUser: forUser)) ?? 0;

  Future<void> setInt(String key, int value, {bool forUser = false}) =>
      _prefs!.setInt(_key(key, forUser: forUser), value);

  Future<void> remove(String key, {bool forUser = false}) =>
      _prefs!.remove(_key(key, forUser: forUser));

  // ── JSON 对象 ─────────────────────────────────────────────

  /// 读取单个 JSON 对象（不存在或解析失败返回 null）
  T? getObject<T>(
    String key,
    T Function(Map<String, dynamic>) fromJson, {
    bool forUser = false,
  }) {
    final raw = _prefs?.getString(_key(key, forUser: forUser));
    if (raw == null || raw.isEmpty) return null;
    try {
      return fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  /// 写入单个 JSON 对象（对象的 toJson 返回 Map）
  Future<void> setObject(String key, Object value, {bool forUser = false}) {
    return _prefs!.setString(_key(key, forUser: forUser), jsonEncode(value));
  }

  // ── JSON 列表 ─────────────────────────────────────────────

  /// 读取 JSON 列表（不存在或解析失败返回空列表）
  List<T> getList<T>(
    String key,
    T Function(Map<String, dynamic>) fromJson, {
    bool forUser = false,
  }) {
    final raw = _prefs?.getString(_key(key, forUser: forUser));
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

  /// 写入 JSON 列表（元素需实现 toJson()，jsonEncode 会递归调用）
  Future<void> setList(String key, List<Object> items, {bool forUser = false}) {
    return _prefs!.setString(_key(key, forUser: forUser), jsonEncode(items));
  }
}
