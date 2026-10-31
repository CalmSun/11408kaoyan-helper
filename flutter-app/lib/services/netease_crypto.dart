import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:crypto/crypto.dart' as crypto;
import 'package:encrypt/encrypt.dart' as enc;
import 'package:pointycastle/export.dart' as pc;

/// 网易云音乐 weapi / eapi 加密工具。
///
/// 逐行对齐 Electron 版 `src/main/main.ts` 的加密实现：
/// - weapi：AES-128-CBC（key=0CoJUm6Qyw8W8jud）+ 随机 secretKey 二次 AES + RSA 公钥加密
/// - eapi：MD5 摘要 + AES-128-ECB（key=e82ckenh8dichen8）
/// - RSA 使用 raw / NO_PADDING（原实现 `crypto.publicEncrypt(..., RSA_NO_PADDING)`）
class NeteaseCrypto {
  NeteaseCrypto._();

  static const String _presetKey = '0CoJUm6Qyw8W8jud';
  static const String _iv = '0102030405060708';
  static const String _eapiKey = 'e82ckenh8dichen8';
  static const String _eapiSalt = '36cd479b6b5';
  static const String _base62 =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  static const String publicKeyPem = '''-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ37BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvaklV8k4cBFK9snQXE9/DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44oncaTWz7OBGLbCiK45wIDAQAB
-----END PUBLIC KEY-----''';

  static final pc.RSAPublicKey _rsaPublicKey =
      enc.RSAKeyParser().parse(publicKeyPem) as pc.RSAPublicKey;

  static final Random _rand = Random();

  /// 生成随机十六进制字符串（对应 randomHex）
  static String randomHex(int bytes) {
    final sb = StringBuffer();
    for (int i = 0; i < bytes; i++) {
      sb.write(_rand.nextInt(256).toRadixString(16).padLeft(2, '0'));
    }
    return sb.toString();
  }

  /// 生成设备 ID（对应 generateDeviceId，WNMCID 格式）
  static String generateDeviceId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    final sb = StringBuffer();
    for (int i = 0; i < 6; i++) {
      sb.write(chars[_rand.nextInt(chars.length)]);
    }
    return '${sb.toString()}.${DateTime.now().millisecondsSinceEpoch}.01.0';
  }

  /// 生成 16 位 base62 随机密钥（对应 generateSecretKey）
  static String generateSecretKey() {
    final sb = StringBuffer();
    for (int i = 0; i < 16; i++) {
      sb.write(_base62[_rand.nextInt(_base62.length)]);
    }
    return sb.toString();
  }

  /// MD5 hex（对应 crypto.createHash('md5')）
  static String md5(String text) =>
      crypto.md5.convert(utf8.encode(text)).toString();

  /// AES-128-CBC（PKCS7 填充），输出 base64（对应 neteaseAesEncrypt）
  static String aesCbc(String text, String keyStr) {
    final e = enc.Encrypter(enc.AES(
      enc.Key.fromUtf8(keyStr),
      mode: enc.AESMode.cbc,
      padding: 'PKCS7',
    ));
    return e.encrypt(text, iv: enc.IV.fromUtf8(_iv)).base64;
  }

  /// AES-128-ECB（PKCS7 填充），输出 hex（对应 eapiAesEncrypt）
  static String aesEcb(String text) {
    final e = enc.Encrypter(enc.AES(
      enc.Key.fromUtf8(_eapiKey),
      mode: enc.AESMode.ecb,
      padding: 'PKCS7',
    ));
    return e
        .encrypt(text)
        .bytes
        .map((b) => b.toRadixString(16).padLeft(2, '0'))
        .join();
  }

  /// RSA 公钥加密（raw / NO_PADDING），输出 hex（对应 neteaseRsaEncrypt）
  static String rsaEncrypt(String text) {
    final reversed = text.split('').reversed.join();
    final buf = Uint8List(128); // 全 0
    final textBytes = utf8.encode(reversed);
    final offset = 128 - textBytes.length;
    if (offset < 0) throw StateError('RSA input too long');
    buf.setRange(offset, 128, textBytes);

    final engine = pc.RSAEngine()
      ..init(true, pc.PublicKeyParameter<pc.RSAPublicKey>(_rsaPublicKey));
    final out = engine.process(buf);
    return out.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }

  /// weapi 加密：返回 params 与 encSecKey（对应 neteaseWeapi）
  static ({String params, String encSecKey}) weapi(Map<String, dynamic> data) {
    final text = jsonEncode(data);
    final secretKey = generateSecretKey();
    final params = aesCbc(aesCbc(text, _presetKey), secretKey);
    final encSecKey = rsaEncrypt(secretKey);
    return (params: params, encSecKey: encSecKey);
  }

  /// eapi 加密：返回 params（对应 neteaseEapi）
  static ({String params}) eapi(String url, Map<String, dynamic> data) {
    final text = jsonEncode(data);
    final message = 'nobody${url}use${text}md5forencrypt';
    final digest = md5(message);
    final raw = '$url-$_eapiSalt-$text-$_eapiSalt-$digest';
    return (params: aesEcb(raw));
  }
}
