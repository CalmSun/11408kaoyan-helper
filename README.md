# 考研助手 (Kaoyan Helper)

> 一款专为考研学子打造的跨平台桌面备考助手，集成「倒计时 · 学习计划 · 番茄专注 · 成绩追踪 · 背诵卡片 · 资料视频 · 网易云音乐 · 公式大纲 · 单词词典 · 数据统计」等核心能力。
> 基于 Vue 3 + TypeScript + Electron + Vite + Element Plus + Pinia + ECharts 构建，原生暗色 / 浅色双主题，液态玻璃卡片观感，数据本地安全存储，可离线使用。

---

## 🧭 功能一览（2026 年版）

### 🎯 备考主线
| 模块 | 说明 |
|---|---|
| ⏳ **考研倒计时** | 精确到秒；环形进度条；按剩余天数智能推送各科复习建议；支持自定义考试日期 / 考试名称。 |
| ✅ **每日计划** | 添加 / 分类 / 排序学习任务；循环待办自动每日重复；一键全部完成 / 清除已完成；每日快照历史记录。 |
| 🍅 **番茄专注** | 专注 / 短休息 / 长休息三模式；自定义时长；全局「强制全屏」开关；结束区分上行 / 下行铃音；最后 5 秒倒计时预警 + 视觉闪烁 + 振动反馈。 |
| 📊 **真题成绩** | 2009-2026 年各科分数录入；平均分 / 最高分 / 已练年份统计；折线图趋势可视化；支持编辑 / 删除 / 按科目筛选。 |
| 📈 **学习统计** | 近 7 天时长趋势；各科占比饼图；每日番茄柱状图；GitHub 风格学习日历；一键导出 PDF 学习报告。 |

### 📚 知识辅助
| 模块 | 说明 |
|---|---|
| 🎴 **背诵卡片** | 翻转卡片式记忆；自定义分类；记住 / 没记住模式；复习次数统计；一键随机打乱。 |
| 📖 **单词词典** | 内置考研高频 / 中频 / 低频词库；支持搜索、音标、释义、例句；一键加入背诵卡片；未收录单词自动在线查词。 |
| 📝 **数学 / 政治 公式大纲** | 分章节汇总考研数学（高数 / 线代 / 概率）与政治核心考点，支持目录跳转与快速检索。 |
| 🧮 **算法 / 数据结构** | 常考算法可视化讲解 + 模板速查（排序 / 搜索 / DP / 图论）。 |
| 📁 **学习资料** | 树状文件夹浏览；PDF 内嵌直接阅读；**MP4 / MKV / AVI / MOV / FLV / WMV 视频播放器（v3.2.3 全新升级）**：自定义进度 + 缓冲进度显示 + 倍速 + 全屏 + 音量滑杆（无极调节，step=0.1）+ Web Audio 数字增益（解决基础音量过低）+ **-10s/+10s 快退快进按钮 + 键盘快捷键（←/→ 快进退 5s、↑/↓ 音量、空格 播放/暂停）** + 增强无声视频诊断 + 大播放按钮 + 加载 Spinner + 深色磨砂控制栏。 |

### 🎵 音乐中心（网易云音乐深度集成）
| 模块 | 说明 |
|---|---|
| 🎧 **全局播放器** | 本地文件 / 文件夹递归扫描；私有协议流式读取；顶栏任意页面可用；播放 / 暂停 / 上一 / 下一 / 音量 / 随机模式；歌词滚动。 |
| 🔍 **网易云搜索 + 热搜榜** | v3.2.2 起：**热搜榜嵌入搜索卡片下方，同卡展示**，点击热词即搜；v3.2.3：点击搜索后自动隐藏热搜、点击搜索框叉号清除结果并恢复热搜；在线试听、添加到播放队列、喜欢。 |
| 💽 **网易云云盘** | v3.2.2 新增：**原热搜 Tab 已升级为云盘 Tab**，登录后一键拉取个人云盘歌曲（`/v1/cloud/get`）；v3.2.3：自动分页全量加载所有云盘歌曲（不再仅 50 首），逐页累加展示；支持播放全部 / 添加到队列 / 单歌播放·喜欢·加队列三件套。 |
| 📋 **我的歌单** | 同步网易云自建 / 收藏歌单，网格封面展示；歌单详情「播放全部 / 添加到队列」。 |
| 🏆 **官方排行榜** | 榜单分类 + 新歌飙升等官方榜；一键展开曲目列表。 |
| 💓 **心动模式（智能播放）** | 顶栏心动按钮对接官方 `/playmode/intelligence/list`，在当前歌曲基础上生成推荐序列。 |
| ❤️ **喜欢音乐** | 批量拉取 `/song/like/get` 作为喜欢缓存；列表项 / 播放卡片喜欢状态实时同步；v3.2.4 修复播放卡片喜欢按钮失效问题（eapi 无 code 响应现降级 weapi，对齐 ncm-api-rs 实现）。 |
| 💬 **歌曲评论** | 热门评论卡片 + 评论弹窗（最热 / 最新切换 + 分页加载）+ 评论点赞（`/v1/comment/like`）。 |
| 🔐 **三种登录方式** | 二维码扫码登录（v3.2.1 修复二维码不显示问题）、手机号密码登录、Cookie 粘贴登录。登录态自动持久化。 |

### 🎨 外观与体验
- **🌗 双主题 + 护眼模式**：深色 / 浅色 / 跟随系统；独立暖色护眼滤光。
- **🪟 液态玻璃 UI**：折射渐变底 + 背景色彩滤镜 + 左上镜面光斑；长列表轻量玻璃面避免掉帧；Element Plus 浮层统一玻璃化；v3.2.3：音乐页左右两列卡片底部对齐、整页限定首屏无滚动；v3.2.4：修复播放列表过长挤占上方卡片、长列表分批渲染 + 封面懒加载降卡顿。
- **🌤️ 顶栏天气组件**：中国天气网数据源；17 城市快选 + 任意城市搜索；每小时自动刷新；30 分钟本地缓存。
- **🪟 自定义顶栏**：窗口控制按钮 + 歌词同步 + 天气 + 迷你音乐播放条。
- **🚀 自动更新**：基于 `electron-updater`；设置页一键检测 / 下载 / 安装。

---

## 🛠️ 技术栈

| 层 | 技术 |
|---|---|
| 前端框架 | Vue 3 (Composition API) + TypeScript |
| 构建工具 | Vite 5 |
| 桌面端 | Electron 28 |
| UI 组件 | Element Plus 2.5 |
| 图标 | @element-plus/icons-vue |
| 状态管理 | Pinia 2 |
| 路由 | Vue Router 4 |
| 图表 | ECharts 5 + vue-echarts 6（按需） |
| 日期处理 | Day.js |
| 玻璃拟态 | 纯 CSS 统一封装（`backdrop-filter` 变量化 + 滤镜降级） |
| 应用更新 | electron-updater 6 |
| 数据存储 | IndexedDB（渲染进程）+ 文件系统快照双写（数据目录自定义） |

---

## 📦 安装与运行

### 环境要求
- **Node.js** ≥ 18
- **npm** ≥ 9（推荐）

### 1) 安装依赖
```bash
npm install
```

### 2) 开发模式（Electron 热更新）
```bash
npm run electron:dev
```
启动后 Vite 开发服务器运行在 http://localhost:5173，主进程编译完成后自动拉起 Electron 窗口。

### 3) 仅前端开发（浏览器模式 / 调试 UI）
```bash
npm run dev
```

### 4) 构建生产版本
```bash
# 当前平台
npm run electron:build

# 只打 Windows 安装包
npm run electron:build:win

# 只打 macOS 安装包
npm run electron:build:mac

# 只打 Linux 安装包
npm run electron:build:linux
```
构建产物位于 `release/`。

---

## 📁 目录结构

```
kaoyan-helper/
├── resources/                 # 托盘图标等资源
├── src/
│   ├── main/                  # Electron 主进程
│   │   └── main.ts            # 窗口 / IPC / 网易云 & 天气 API 代理 / 数据目录 / 更新
│   ├── preload/               # Preload 脚本（contextBridge 暴露 electronAPI）
│   │   └── preload.ts
│   └── renderer/              # Vue 渲染进程
│       ├── index.html
│       └── src/
│           ├── App.vue
│           ├── main.ts
│           ├── style.css       # 全局玻璃 / 主题变量
│           ├── router/
│           ├── stores/         # Pinia：music / pomodoro / user / index
│           ├── components/     # GlassCard / SideNav / TitleBar
│           ├── views/          # 15 个功能页
│           ├── data/           # 公式 / 大纲 / 词库 静态数据
│           ├── utils/          # 主题 / 日期 / 存储 / 天气 / 数据同步
│           └── assets/
├── README.md
├── package.json
├── tsconfig.json / tsconfig.node.json
└── vite.config.ts
```

---

## 💾 数据与隐私

- 业务数据默认存放在 `\$HOME/Documents/11408kaoyan-helper/`，**不在 C 盘应用数据区**，设置页可一键更改 / 打开 / 立即同步 / 开启自动备份。
- IndexedDB + JSON 快照双写：
  - `IndexedDB`：真题、计划、背诵、番茄、统计、设置、应用时长
  - `auto-backup.json`：每 30 分钟一次的完整快照（可选自动备份）
  - `custom-bg.jpg`：浅色模式自定义背景图
- 旧版本 LocalStorage 存量数据在升级后自动迁移并清理。
- **强烈建议**：开启自动备份 + 将数据目录设在非 C 盘，更安全 💪。

---

## 🔌 已实现的网易云 API（节选）

> 所有请求均由 Electron 主进程代理（避免 CORS / Referer / Cookie 跨域限制），已登录态 Cookie 自动持久化与携带。

| 能力 | 接口 |
|---|---|
| 搜索 | `/cloudsearch/get/web` |
| 歌曲可播 URL | `/song/url/v1` → `/song/enhance/player/url` 降级 |
| 歌词 | `/lyric` |
| 二维码登录 | `/login/qrcode/unikey` → `/login/qrcode/client/login`（轮询） |
| 二维码图片 | 本地构造 `qrurl` → `api.qrserver.com` 出图（v3.2.1 修复） |
| 手机号 / Cookie 登录 | `/login/cellphone` + 登录态校验 |
| 登录状态 / 账号信息 / 用户详情 | `/w/nuser/account/get`、`/v1/user/detail` |
| 我的歌单 + 歌单详情 | `/user/playlist`、`/v6/playlist/detail` |
| 喜欢列表 | `/song/like/get`（v3.2.1 起批量拉取缓存，秒级命中） |
| 单歌喜欢 / 取消 | `/radio/like` |
| 评论列表 | `/v1/resource/comments/R_SO_4_{id}` |
| 评论点赞 / 取消赞 | `/v1/comment/like`、`/v1/comment/unlike` |
| 热搜榜 | `/search/hot` (type=1111) |
| 排行榜 | `/toplist/detail` + `/v6/playlist/detail` |
| 心动模式 / 智能播放 | `/playmode/intelligence/list`（v3.2.1 参数对齐修复） |
| 云盘歌曲 | `/v1/cloud/get`（v3.2.2 新增；v3.2.3 分页全量加载） |

---

## 📄 License

MIT © Kaoyan Helper Team

> 祝你一战成硕 🎓
