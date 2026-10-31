import 'dart:convert';

import 'storage_service.dart';

/// 账号服务（对应 Electron 版 utils/storage.ts 的账号管理 + stores/user.ts）。
///
/// 账号列表与当前用户存于全局 key（kaoyan_accounts / kaoyan_current_user），
/// 用户数据按 `kaoyan_user_` + 用户名 + `_` 前缀隔离。密码哈希对齐 Electron 的 simpleHash。
class UserService {
  UserService._();
  static final UserService instance = UserService._();

  StorageService get _s => StorageService.instance;

  String get currentUsername => _s.currentUser;
  bool get isLoggedIn => currentUsername.isNotEmpty;
  String get displayName => currentUsername.isEmpty ? '游客' : currentUsername;

  List<Map<String, dynamic>> get _accounts =>
      _s.getGlobalList('kaoyan_accounts', (j) => Map<String, dynamic>.from(j));

  Future<void> _saveAccounts(List<Map<String, dynamic>> accounts) =>
      _s.setGlobalList('kaoyan_accounts', accounts);

  List<String> get userList =>
      _accounts.map((a) => a['username'] as String? ?? '').toList();

  bool _isRegistered(String username) =>
      _accounts.any((a) => a['username'] == username);

  /// 对齐 Electron simpleHash（32 位有符号溢出）
  static int _simpleHashInt(String str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      final char = str.codeUnitAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & 0xFFFFFFFF;
      if (hash >= 0x80000000) hash -= 0x100000000;
    }
    return hash;
  }

  static String _simpleHash(String str) => _simpleHashInt(str).abs().toRadixString(36);

  ({bool success, String message}) register(String username, String password) {
    if (username.isEmpty || password.isEmpty) {
      return (success: false, message: '用户名和密码不能为空');
    }
    if (username.length < 2 || username.length > 20) {
      return (success: false, message: '用户名长度需在 2-20 个字符之间');
    }
    if (password.length < 4) {
      return (success: false, message: '密码长度至少 4 个字符');
    }
    if (_isRegistered(username)) {
      return (success: false, message: '该用户名已被注册');
    }
    final accounts = _accounts;
    accounts.add({
      'username': username,
      'passwordHash': _simpleHash(password),
      'createdAt': DateTime.now().toIso8601String(),
    });
    _saveAccounts(accounts);
    return (success: true, message: '注册成功');
  }

  ({bool success, String message}) authenticate(String username, String password) {
    if (username.isEmpty || password.isEmpty) {
      return (success: false, message: '请输入用户名和密码');
    }
    final matches = _accounts.where((a) => a['username'] == username);
    final account = matches.isEmpty ? null : matches.first;
    if (account == null) {
      return (success: false, message: '用户名不存在');
    }
    if (account['passwordHash'] != _simpleHash(password)) {
      return (success: false, message: '密码错误');
    }
    return (success: true, message: '登录成功');
  }

  /// 登录（可选迁移游客数据）。成功后切换前缀，需调用方 reload 数据。
  ({bool success, String message}) login(
      String username, String password, bool migrateData) {
    final result = authenticate(username, password);
    if (!result.success) return result;
    if (migrateData) _migrateGuestData(username);
    _s.setCurrentUser(username);
    return result;
  }

  Future<void> logout() async {
    await _s.setCurrentUser('');
  }

  Future<void> deleteAccount(String username) async {
    final accounts = _accounts.where((a) => a['username'] != username).toList();
    await _saveAccounts(accounts);
    // 删除该用户前缀下的数据
    final prefix = 'kaoyan_user_${username}_';
    final keys = _s.rawKeys();
    for (final k in keys) {
      if (k.startsWith(prefix)) await _s.removeGlobal(k);
    }
    if (_s.currentUser == username) {
      await _s.setCurrentUser('');
    }
  }

  /// 将游客数据迁移到指定用户名下（数组合并，其余覆盖）
  Future<void> _migrateGuestData(String username) async {
    final guestPrefix = 'kaoyan_helper_';
    final userPrefix = 'kaoyan_user_${username}_';
    final keys = _s.rawKeys();
    for (final k in keys) {
      if (!k.startsWith(guestPrefix)) continue;
      final shortKey = k.substring(guestPrefix.length);
      final value = _s.getGlobalString(k);
      if (value == null) continue;
      final targetKey = '$userPrefix$shortKey';
      final existing = _s.getGlobalString(targetKey);
      if (existing != null) {
        // 尝试数组合并
        final merged = _mergeArrays(existing, value);
        await _s.setGlobalString(targetKey, merged ?? existing);
      } else {
        await _s.setGlobalString(targetKey, value);
      }
      await _s.removeGlobal(k);
    }
  }

  String? _mergeArrays(String a, String b) {
    try {
      final la = jsonDecode(a);
      final lb = jsonDecode(b);
      if (la is List && lb is List) {
        return jsonEncode([...la, ...lb]);
      }
    } catch (_) {}
    return null;
  }
}
