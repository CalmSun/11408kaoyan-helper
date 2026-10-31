# 11408 考研助手 · Flutter 全平台版

考研助手的 Flutter 重写版，采用 iOS 26「液态玻璃」（Liquid Glass）设计语言，一套代码构建 **Windows / Linux / Android** 三个平台。

## 技术栈

- **Flutter** ≥ 3.41.0（Dart ≥ 3.5.0）
- **[liquid_glass_widgets](https://pub.dev/packages/liquid_glass_widgets)** `^1.16.1` — iOS 26 液态玻璃组件库（折射 / 色散 / 高光 / 动态光照，Impeller fragment shader）
- 折射效果全平台一致（Impeller 自绘渲染，不依赖系统 WebView）

## 目录结构

```
flutter-app/
├── lib/
│   ├── main.dart                 # 入口：着色器预热 + wrap + 主题
│   ├── app.dart                  # MaterialApp 根组件
│   ├── theme/kaoyan_theme.dart   # 品牌色 + 光斑壁纸背景
│   └── screens/
│       ├── home_screen.dart      # 首页仪表盘（玻璃骨架）
│       └── placeholder_screen.dart # 未迁移模块占位
├── pubspec.yaml
└── analysis_options.yaml
```

> 平台脚手架（`android/` `windows/` `linux/`）不在仓库里——由 CI 的
> `flutter create --platforms=...` 生成，保证与 CI 的 Flutter 版本严格匹配。
> 本地如需构建，先运行：
> `flutter create --platforms=android,windows,linux --org com.kaoyan --project-name kaoyan_helper .`

## 本地运行

```bash
cd flutter-app
flutter create --platforms=android,windows,linux --org com.kaoyan --project-name kaoyan_helper .
flutter pub get
flutter run -d windows        # Windows 桌面
flutter run -d linux          # Linux 桌面
flutter run -d <android-device> # Android
```

## 构建

```bash
flutter build apk --release     # Android APK
flutter build windows --release # Windows
flutter build linux --release   # Linux
```

## 液态玻璃分层原则（来自官方 SKILL）

- **导航栏 / 底栏**：`GlassScaffold` 自动提升为 `premium`（持久表面）
- **滚动内容卡片**：一律 `standard`（`premium` 在滚动列表内会渲染错乱）
- **玻璃控件不嵌套玻璃容器**：`GlassButton` / `GlassIconButton` 不放进 `GlassContainer.card` 内
- **质量降级**：`adaptiveQuality: true` 自动基准测试设备，慢设备降级 `minimal`

## 迁移进度

| 模块 | 状态 |
|---|---|
| 应用骨架 + 液态玻璃导航/卡片 | ✅ 完成 |
| 首页仪表盘（倒计时/统计/计划/快捷入口） | ✅ 骨架 |
| 学习计划 / 资料 / 统计 / 单词 / 公式 / 真题 | ⏳ 待迁移 |
| 网易云音乐 / 文件系统 / 番茄钟 / 设置 | ⏳ 待迁移 |
