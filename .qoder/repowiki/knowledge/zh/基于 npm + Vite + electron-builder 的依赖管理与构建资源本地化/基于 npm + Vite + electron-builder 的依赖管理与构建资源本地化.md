---
kind: dependency_management
name: 基于 npm + Vite + electron-builder 的依赖管理与构建资源本地化
category: dependency_management
scope:
    - '**'
source_files:
    - package.json
    - package-lock.json
    - vite.config.ts
    - scripts/copy-pdfjs-assets.mjs
    - .github/workflows/release.yml
---

## 1. 使用的系统与工具

本项目采用 **npm** 作为包管理器，通过 `package.json` 声明运行时依赖与开发依赖，配合 `package-lock.json` 锁定版本。前端构建使用 **Vite 5**（插件 `@vitejs/plugin-vue`），桌面端打包使用 **electron-builder 24**，Electron 版本为 **28.3.3**。TypeScript 由 `tsc`（`tsconfig.node.json`）在构建阶段编译 main/preload 代码。

## 2. 关键文件

- `package.json`：集中声明所有依赖、脚本命令、electron-builder 配置、GitHub Release 发布源以及 `allowScripts` 白名单。
- `package-lock.json`：npm 锁文件，确保依赖树可复现。
- `vite.config.ts`：定义别名 `@` → `src/renderer/src`、手动分包策略（`vendor-vue`、`vendor-element-plus`、`vendor-echarts`）、输出目录与开发服务器端口。
- `scripts/copy-pdfjs-assets.mjs`：构建前将 `pdfjs-dist` 的 CMap 与标准字体复制到 `src/renderer/public/pdfjs/`，实现 PDF 资源离线可用。
- `.github/workflows/release.yml`：CI 中执行 `npm run electron:build` 进行多平台打包。

## 3. 架构与约定

### 依赖分类
- **运行时依赖**（`dependencies`）：Vue 3、Pinia、Vue Router、Element Plus、ECharts、pdfjs-dist、dayjs、electron-updater、open-file-viewer/core 等。
- **开发依赖**（`devDependencies`）：Vite、TypeScript、electron、electron-builder、concurrently、cross-env、wait-on、vue-tsc 等。

### 构建时资源处理
由于 `open-file-viewer` 的 pdfPlugin 默认从 jsDelivr CDN 加载 CMap/标准字体，项目通过 `predev` / `prebuild` 钩子运行 `copy-pdfjs-assets.mjs`，把 `node_modules/pdfjs-dist/cmaps` 和 `standard_fonts` 拷贝到 `src/renderer/public/pdfjs/`，再由 Vite 原样复制到 `dist/renderer`，从而保证中文 PDF 在离线或国内网络环境下可正常渲染。

### 分包策略
`vite.config.ts` 中通过 Rollup `manualChunks` 将大型第三方库拆分为独立 chunk：
- `vendor-vue`：`vue`、`vue-router`、`pinia`
- `vendor-element-plus`：`element-plus`、`@element-plus/icons-vue`
- `vendor-echarts`：`echarts/core`、`echarts/charts`、`echarts/components`、`echarts/renderers`

### 发布与更新
- 应用 ID 为 `com.kaoyan.helper`，产物输出到 `release-v353`。
- `publish.provider` 指向 GitHub Releases（owner: CalmSun, repo: 11408kaoyan-helper），配合 `electron-updater` 实现自动更新。
- `allowScripts` 显式允许 Electron、esbuild、vue-demi、vue-echarts 在安装时执行原生脚本，这是 npm v7+ 的安全机制。

### 脚本约定
- `dev`：启动 Vite 开发服务器。
- `electron:dev`：用 `concurrently` 同时启动 Vite 与 Electron，并等待 5173 端口就绪后注入环境变量 `NODE_ENV=development`。
- `build`：先复制 PDF 资源，再执行 `vite build && tsc -p tsconfig.node.json`。
- `electron:build` / `electron:build:win|mac|linux`：分别打包各平台安装包（NSIS/Dmg/AppImage）。

## 4. 约定与约束

- **版本锁定**：所有依赖通过 `package-lock.json` 锁定，禁止直接修改 `node_modules`；升级需通过 `npm install <pkg>@<version>` 更新 lockfile。
- **PDF 资源必须本地化**：任何涉及 PDF 渲染的变更都需确认 `copy-pdfjs-assets.mjs` 能正确拷贝最新版本的 CMap 与标准字体，否则中文 PDF 可能无法渲染。
- **第三方脚本白名单**：新增带安装脚本的依赖需在 `package.json` 的 `allowScripts` 中添加条目，否则安装会被拒绝。
- **构建产物范围**：electron-builder 仅打包 `dist/**/*` 与根 `package.json`，其他源码不会进入安装包。
- **CDN 不可达时的降级**：项目已内联 pdfjs-dist 的资源，不再依赖外部 CDN；若引入新的需要远程资源的库，应遵循同样的“构建期拷贝到 public”模式。
- **多平台打包目标**：Windows 使用 NSIS、macOS 使用 DMG、Linux 使用 AppImage，图标路径分别位于 `src/renderer/src/assets/` 下对应格式的文件。