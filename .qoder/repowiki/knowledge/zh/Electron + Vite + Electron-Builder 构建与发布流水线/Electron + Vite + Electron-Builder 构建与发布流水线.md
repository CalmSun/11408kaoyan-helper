---
kind: build_system
name: Electron + Vite + Electron-Builder 构建与发布流水线
category: build_system
scope:
    - '**'
source_files:
    - package.json
    - vite.config.ts
    - .github/workflows/release.yml
    - scripts/copy-pdfjs-assets.mjs
    - tsconfig.node.json
---

## 1. 构建系统总览
本项目采用 **Vite 5** 作为渲染进程（Vue 3）的构建工具，使用 **TypeScript** 编译主进程代码，通过 **electron-builder 24** 打包为 Windows (NSIS)、macOS (dmg)、Linux (AppImage) 三平台安装包。版本管理集中在 `package.json` 的 `version` 字段（当前 `3.5.3`），所有构建产物输出到 `dist/`（渲染进程）和 `release-v353/`（安装包）。CI 基于 GitHub Actions，在打 `v*` tag 时触发 Windows 平台的自动构建与发布。

## 2. 关键文件与职责
- `package.json`：集中定义脚本、依赖、electron-builder 配置（appId、productName、targets、extraResources、nsis 选项）、GitHub 发布源（`publish.provider=github`）。
- `vite.config.ts`：设置 Vite 根目录为 `src/renderer`、别名 `@ → src/renderer/src`、将 `__APP_VERSION__` 注入到运行时、按 `vendor-vue / vendor-element-plus / vendor-echarts` 拆分 chunk。
- `.github/workflows/release.yml`：监听 `push.tags: v*`，在 `windows-latest` 上安装 Node 20、执行 `npm run electron:build:win -- --publish always`，借助 `GH_TOKEN` 把产物上传到 GitHub Releases。
- `scripts/copy-pdfjs-assets.mjs`：在 `predev` / `prebuild` 钩子中把 `pdfjs-dist` 的 CMap 与标准字体复制到 `src/renderer/public/pdfjs/`，保证 PDF 离线渲染不依赖 CDN。
- `tsconfig.node.json`：仅编译主进程 TypeScript（`src/main`、`src/preload`）。
- `启动开发版.bat`：Windows 快捷启动开发环境。

## 3. 架构与约定
- **双阶段构建**：`npm run build` 先调用 Vite 编译 Vue 前端到 `dist/renderer`，再调用 `tsc -p tsconfig.node.json` 编译主进程 JS；`electron:build` 在此基础上追加 `electron-builder`。
- **资源复制前置**：通过 `predev` / `prebuild` npm 钩子确保 pdfjs 静态资源在构建前就位，避免 dev 与 prod 行为不一致。
- **多目标打包**：`electron:build:win|mac|linux` 三个命令分别指定 `--win/--mac/--linux`，默认输出目录 `release-v353`，由版本号硬编码。
- **增量分包策略**：Vite Rollup 配置将 Vue 生态、Element Plus、ECharts 拆成独立 vendor chunk，提升缓存命中率。
- **版本注入**：`__APP_VERSION__` 在构建期从 `package.json` 注入，供渲染进程读取显示。
- **自动更新**：依赖 `electron-updater`，配合 `publish` 段指向 GitHub Release，实现应用内检查更新。

## 4. 约定与约束
- 版本号只维护在 `package.json` 一处，构建产物目录名 `release-v353` 随版本号变化（需手动同步或脚本化）。
- CI 仅在打 `v*` tag 时触发，且只构建 Windows NSIS 包；macOS/Linux 需本地执行对应命令。
- 发布需要仓库 secrets 中的 `GH_TOKEN`（workflow 中使用 `${{ secrets.GITHUB_TOKEN }}`）。
- 主进程入口固定为 `dist/main/main.js`（`package.json.main`），因此 `electron:build` 必须先完成 `tsc` 编译。
- 渲染进程资源必须放在 `src/renderer/public/` 下才会被 Vite 原样拷贝进产物，pdfjs 的 CMap/字体即遵循此约定。
- 开发模式通过 `concurrently` 同时启动 Vite 服务与 Electron，并用 `wait-on` 等待 `http://localhost:5173` 就绪后再 launch，避免竞态。