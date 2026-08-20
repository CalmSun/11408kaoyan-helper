---
kind: configuration_system
name: Electron 桌面应用配置系统：LocalStorage + 主进程 JSON 文件双轨持久化
category: configuration_system
scope:
    - '**'
source_files:
    - src/renderer/src/utils/storage.ts
    - src/renderer/src/stores/index.ts
    - src/renderer/src/utils/theme.ts
    - src/renderer/src/views/Settings.vue
    - src/main/main.ts
    - vite.config.ts
    - package.json
---

## 1. 整体方案

本仓库是一个基于 Vue 3 + Electron 28 的桌面应用，配置与用户数据采用**两条独立但互补的持久化轨道**：

- **渲染进程（用户设置/业务数据）**：通过 `src/renderer/src/utils/storage.ts` 封装的本地存储层，以 `localStorage` 为最终落盘介质，配合内存 `Map` 缓存实现同步读写；启动时扫描所有 `kaoyan_*` 前缀键并载入缓存，退出前通过 `beforeunload` / `pagehide` 双保险 flush。
- **主进程（应用级配置/外部资源路径）**：在 `src/main/main.ts` 中以小 JSON 文件形式持久化到 `app.getPath('userData')`，包括数据目录、音乐文件夹、资料文件夹、网易云 Cookie 等。

两套机制互不干扰：渲染进程负责“用户偏好 + 业务数据”，主进程负责“系统级路径 + 安全边界”。

## 2. 关键文件与职责

| 文件 | 职责 |
|---|---|
| `src/renderer/src/utils/storage.ts` | 统一存储抽象：`getStorage/setStorage/removeStorage`（带用户前缀）、`getGlobalStorage/setGlobalStorage`（全局键）、账号管理、数据版本迁移、容量不足自动清理、导出/导入 JSON |
| `src/renderer/src/stores/index.ts` | Pinia store，定义各模块默认值（考试日期、番茄钟设置、计划、分数记录等），并通过 `watch(..., { deep: true })` 监听变化后调用 `setStorage` 持久化 |
| `src/renderer/src/utils/theme.ts` | 主题模式、护眼模式、液态玻璃、自定义背景图开关，全部经 `getGlobalStorage/setGlobalStorage` 持久化 |
| `src/renderer/src/views/Settings.vue` | 设置页 UI，聚合所有可配置项（考试设置、番茄钟、外观、开机自启、数据管理） |
| `src/main/main.ts` | 主进程配置：数据目录 (`data-dir.json`)、音乐/资料文件夹 (`music-folder.json`, `materials-folder.json`)、网易云 Cookie (`netease-cookies.json`)、自定义背景路径、自动备份路径 |
| `vite.config.ts` | 构建期常量注入 `__APP_VERSION__`，作为运行时配置来源之一 |
| `package.json` | electron-builder 打包配置、`electron-updater` 发布源（GitHub Release） |

## 3. 架构与设计约定

### 3.1 渲染进程存储层（`storage.ts`）

- **键命名空间**：游客数据使用 `kaoyan_helper_` 前缀，登录用户数据使用 `kaoyan_user_<username>_` 前缀，全局键无用户前缀；`isAppKey()` 用 `kaoyan_` 前缀识别本应用键。
- **多用户隔离**：`getCurrentUsername()` / `setCurrentUsername()` 决定当前前缀；提供 `migrateGuestData()` 将游客数据迁移至指定账号。
- **数据版本化**：`DATA_VERSION = 1`，启动时读取 `__data_version__`，若低于当前版本则遍历缓存执行 `dataMigrations` 注册表中的迁移函数，最后写回新版本号。
- **容量降级**：`lsSet` 捕获 `QuotaExceededError` 后调用 `cleanupOldData()`，优先删除含 `planSnapshots` / `pomodoroRecords` 的历史快照键，再重试写入。
- **退出保护**：`flushAll()` 在 `beforeunload` / `pagehide` 触发，强制把内存缓存写回 localStorage。

### 3.2 Store 层（`stores/index.ts`）

- 每个业务字段（`plans`、`flashcards`、`pomodoroRecords`、`examScores`、`dailyRecords`、`planSnapshots`、`subjectProgress`、`errorLogs`、`pomodoroSettings` 等）都通过 `getStorage(key, default)` 初始化，并用 `watch(..., { deep: true })` 自动 `setStorage` 持久化。
- 旧数据结构迁移逻辑内聚于模块顶层（如 408 子科目合并为 `cs408`），保证升级后数据兼容。

### 3.3 主题与外观（`theme.ts`）

- 主题模式、护眼模式、液态玻璃、自定义背景分别对应 `kaoyan_theme`、`kaoyan_eyecare`、`kaoyan_liquid_glass`、`kaoyan_bg_custom` 全局键。
- 自定义背景由主进程通过 `kaoyan-bg://` 协议提供，渲染进程仅持有 URL 引用。

### 3.4 主进程配置（`main.ts`）

- **数据目录**：默认 `app.getPath('documents')/11408kaoyan-helper`，实际路径缓存在 `data-dir.json`；启动时执行 `migrateLegacyDataFiles()` 将旧版 `custom-bg.jpg` / `auto-backup.json` 从 `userData` 迁移到新目录。
- **文件夹选择**：音乐/资料文件夹路径分别持久化到 `music-folder.json` / `materials-folder.json`，并提供 `restore-folder` IPC 恢复上次选择。
- **安全白名单**：通过 `token -> 绝对路径` 的内存 Map 限制 `kaoyan-music://` 和 `kaoyan-material://` 协议只能访问已选根目录内的文件，防止路径穿越。
- **私有协议**：注册 `kaoyan-bg`、`kaoyan-music`、`kaoyan-data`、`kaoyan-material`、`kaoyan-assets` 五个协议，分别承载自定义背景、流式音频、备份 JSON、资料文件、pdf.js 静态资源。
- **自动更新**：`electron-updater` 配置发布源为 GitHub Release（见 `package.json` 的 `publish` 段），禁用自动下载，由用户在设置页手动触发。

## 4. 约定与约束

- **所有用户偏好必须经 `storage.ts` 存取**，禁止直接操作 `localStorage`，以保证缓存一致性和迁移能力。
- **新增持久化字段需同时维护默认值**：在 store 初始化处提供默认值，并在 `refreshAllFromStorage()` 中补齐旧版本缺失字段。
- **数据目录不可写回 userData**：主进程侧配置固定落在 `app.getPath('userData')` 下的特定 JSON 文件，业务数据目录默认在文档目录下，便于用户迁移。
- **外部资源访问必须走白名单协议**：渲染进程不得直接拼接 `file://` 访问用户磁盘，一律通过 `kaoyan-music://` / `kaoyan-material://` 等协议由主进程校验后返回。
- **构建期常量**：版本号通过 Vite `define` 注入 `__APP_VERSION__`，运行时无需读取 `package.json`。
- **环境变量**：仅 `process.env.NODE_ENV` 用于区分开发/生产环境加载 dev server 或打包产物，未见 `.env` 文件。
