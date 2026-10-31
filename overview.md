# v3.6.5 更新（全平台重构）：新增 Flutter 版骨架 + 三端 CI 自动构建

## 本轮做了什么

决定采用 **Flutter** 重构为全平台应用（Windows / Linux / Android）。此前评估过 Tauri 2 与 Compose Multiplatform，均因本机无工具链 + Linux 端折射受限而放弃。

### 为什么是 Flutter

- **折射全平台一致**：`liquid_glass_widgets`（iOS 26 液态玻璃的 Flutter 官方实现）用 Impeller 自绘渲染 + fragment shader，不依赖系统 WebView——彻底绕开 Tauri 2 在 Linux WebKitGTK 上折射失效的死穴（这正是之前反复换方案的核心原因）。
- **现成组件库**：`liquid_glass_widgets ^1.16.1`（MIT），折射 / 色散 / 高光 / 动态光照开箱即用。
- **桌面端成熟**：Flutter Desktop（Windows/Linux）稳定多年。

### 交付内容（骨架阶段）

- `flutter-app/`：可运行的液态玻璃骨架（`GlassScaffold` 导航 + `GlassTabBar` + 玻璃卡片 + 光斑壁纸）
- API 严格对齐官方 SKILL（premium 不进滚动列表、玻璃控件不嵌套玻璃容器、`GlassButton` 用 `onTap` 等）
- CI 三端构建：Android APK + Windows x64 + Linux x64（`flutter create` 生成原生脚手架，与 CI Flutter 版本严格匹配）
- Electron 桌面版完整保留，零改动

### 环境约束（已核实）

本机无 Flutter / Dart / Android SDK / JDK，无法本地构建，唯一构建路径是 GitHub Actions CI（tag 触发三端出包）。

### 迁移进度

骨架 + 首页仪表盘完成；学习计划 / 资料 / 统计 / 单词 / 公式 / 真题 / 音乐 / 番茄钟等模块待逐页迁移。

---

# v3.6.5 更新：液态玻璃重构为真实折射（参照 liquid-glass-vue）+ 全站统一 + 无用代码清理

## 本轮做了什么

### 1. 玻璃从「磨砂」改回「折射」

之前几版的问题不是透明度不够，而是**用 blur 冒充玻璃**：模糊把背景糊成一片，再透也读不出玻璃。

参照 [WXperia/liquid-glass-vue](https://github.com/WXperia/liquid-glass-vue)（rdev/liquid-glass-react 的 Vue 3 移植）的核心手法重写：

给每个玻璃面插一个铺满的 warp 层，让它同时带

```
backdrop-filter: blur() saturate() contrast() brightness()   ← 采样并霜化真实背景
filter: url(#lg-glass-N)                                     ← 用 SVG 位移图折射这一层
```

两条属性叠在同一元素上时，Chromium 会把 `backdrop-filter` 的结果当作 `filter` 的 `SourceGraphic`，于是背景**先被真实采到、再被边缘折射**。

**关键区别：不是 `backdrop-filter: url(...)`。** 那样拿不到位移图，只能得到模糊——这正是"看起来像磨砂而不像玻璃"的根因。

位移图运行时用 canvas 按圆角矩形 SDF 现算：R 通道编码 x 位移、B 通道编码 y 位移、A 恒为不透明。`feDisplacementMap` 按这张图位移像素，**中心零形变、越靠边缘位移越大**，这就是边缘透镜。三通道用略微不同的位移量叠加，边缘自然出现色差。

### 2. 与参考项目的两处适配

库不能直接套用——它要求玻璃元素必须是组件自己的根节点，而本项目卡片嵌在多层之下。两处改动：

| 差异 | 参考项目 | 本项目 |
|---|---|---|
| 滤镜 | 每个组件实例一个 uuid 滤镜 | 按「宽高比 + 圆角占短边比例」分桶共享，几十张卡片通常落到 2~6 个桶 |
| 位移图 | 内置 40KB+ 硬编码 JPEG/PNG | 启动时 canvas 现算，不占包体，斜面宽度随卡片尺寸自适应 |
| 滤镜链 | 无中心/边缘两段合成 | 同样简化——位移图中心梯度=0 自然归零，不额外做"只有边缘折射"的合成 |

### 3. 掉帧根治（10.6 → 100 FPS）

第一版上线后实测**静止状态 10.6 FPS、最差单帧 110ms**。用 8 张卡片逐步定位，根因只有一个：

**`feImage` 每帧都要解码位移图那张 PNG。** 尺寸与帧率的关系：

| 位移图尺寸 | 帧率 |
|---|---|
| 512²（103KB） | 4.2 FPS |
| 128² | 57.8 FPS |
| 64² | 113.8 FPS |

位移场本身是平滑梯度，小图拉伸后视觉等价。最终把位移图长边压到 **72px**，并配合：

- 视口外的卡片由 `IntersectionObserver` 关掉 warp（不再滚动时逐个 `getBoundingClientRect`，那是 O(N) 强制重排）
- 路由切换/列表刷新用 `MutationObserver` 补挂载

实测 12 张卡片（最终参数）**61.4 FPS、最差单帧 22.3ms**。

### 4. 修掉「卡片中间黑色阴影」

第一版位移图用 A 通道编码"离轮廓多近"（中心 alpha=0），SVG 滤镜按**预乘 alpha** 处理，透明像素的 RGB 被当成 0，位移量变成常量偏移，卡片中间出现一块形似位移图的灰块。

修法：A 恒为 255（不透明），中心位移靠 SDF 梯度在中央天然为 0 来实现，彻底绕开预乘歧义。

### 5. 全站统一 + 分层（浮层折射 / 内容卡实心）

- `Materials.vue` / `Music.vue` 各自复制了一整套卡片视觉（含 4 段 `body.liquid-glass` 覆盖），用的是裸 `.glass-card`，全局样式覆盖不到。现在 `.glass-card` 提升为全局一等类，两页只保留布局属性，共删除 **124 行**重复样式。
- **最终分层（依据苹果 HIG 液态玻璃原则）**：折射只落在「浮在内容之上」的浮层 —— `.side-nav / .titlebar / .pomodoro-mini`；内容卡片（`.card / .glass-card / .stat-card / .algo-card / .word-card / .formula-card`）**退出折射层**，保持实心玻璃拟态（`--glass-bg` 0.72 + `backdrop-filter` blur）。

### 6. 为什么内容卡不能全透（本轮「显示异常」的根因）

第一版把**所有内容卡片**也接入折射、白纱降到 0.16——正文（统计数字、说明文字）直接压在花哨壁纸上，几乎不可读。这正是 Apple 在液态玻璃 HIG 里警告的翻车方式：

> **玻璃是给浮在内容之上的那层用的，不是给内容本身用的。工具栏、标签栏、浮层、控件可以坐在玻璃上，正文不行。**

苹果自己都因可读性问题在 26.1 补了「不透明着色」开关。修复：

- 内容卡片退出折射层 → 恢复 `--glass-bg`（0.72 实心）+ 轻模糊，正文可读
- 浮层保留折射，用 `--glass-bg-lg-chrome`（0.56）保证导航文字可读
- 超通透档（`body.liquid-glass`）不再把 `--glass-bg` 降透（0.18→0.78），只增强 blur/圆角/阴影

### 7. 无用代码清理

| 项 | 说明 |
|---|---|
| `.glass` | 全项目零引用，从三个选择器组里移除（改由 `.glass-card` 承接） |
| `.gradient-text` / `.number-emphasis` | 仅定义、无引用 |
| `.theme-*` / `.user-*` | SideNav 里 7 段死样式（主题与用户栏早已移到顶栏） |
| `.glass-lite` / `.glass-card--lite` | 模板里零引用的死类（真实承载类是 `.algo-card` 等） |
| Materials / Music 重复玻璃样式 | 124 行 |

### 8. 性能与降级

- 采样真实 backdrop，滚动 / 自定义背景 / 嵌套内容全部自动正确，无需逐帧 JS
- 滚出视口的卡片自动撤掉 warp 退回 CSS 玻璃，GPU 只为可见区域付费
- 卡片自身的 `backdrop-filter` 会撤掉，杜绝嵌套滤镜的双重模糊与双重开销
- 不支持 `filter: url()` 时整体不挂载，视图层零改动自动退回原 CSS 玻璃

---

# v3.5.2 更新：项目精简（清理构建备份/临时产物，零功能影响）+ PDF 黑屏根治 + 回环 HTTP 资源服务 + 进度栏移至顶栏左侧

## 本轮：项目精简（最终交付）

### 清理清单（全部为未跟踪/被忽略的可再生产物与开发期一次性工具，功能零影响）
| 项 | 说明 |
|---|------|
| `dist.prev-*` ×6（各 22M） | 构建备份目录（.gitignore `dist.*/` 已忽略），可随时重建 |
| `release-v352/`（897M）、`release/`（133M） | electron-builder 构建输出，可再生（CI 自动重建） |
| `check-proc.mjs` / `check-worker.mjs` / `kill-proc.mjs` / `clean-release.mjs` / `rename-release.mjs` | 开发期一次性辅助脚本（进程检查/终止、release 目录改名绕锁定），未被 package.json/vite.config/scripts 引用 |
| `.tmp-upload-v352.mjs` | 临时 GitHub asset 上传脚本 |
| `git` / `main`（0 字节空文件，**已跟踪**） | 历史误提交的空文件，本次删除并提交记录 |
| `tsconfig.node.tsbuildinfo` | tsc 增量缓存（*.tsbuildinfo 已忽略），下次构建自动重建 |

### 保留（功能/资料性文件，一律不动）
`src/`、`scripts/copy-pdfjs-assets.mjs`、`dist/`（当前完整构建：main/preload/renderer + 169 cmaps + 16 字体）、`assets/`、`resources/`、`background.jpg`、`CLAUDE.md`、`README.md`、`ref-api/`（刻意 gitignore 的参考资料）、`.workbuddy/`（工作记忆）、`启动开发版.bat`

### 验证
- 删除前逐项确认：全部目标均 untracked 或被 .gitignore 忽略（除 git/main 为误提交空文件，无功能语义）
- `dist/` 完整性核查通过：dist/main/main.js（含回环服务 127.0.0.1×5）+ dist/preload/preload.js + dist/renderer + pdfjs 169+16
- 未改动任何功能源码（src/ 时间戳无变化），构建/类型/运行时行为不受影响

---

## 历史记录（本轮之前同版本累积）

### PDF 黑屏根治（getTextContent 防御性包装，修正 namespace 兼容）
- **根因 A**：库 pdfPlugin.renderPage 把 canvas 渲染（核心）与文本层 getTextContent（可选增强）放同一 try/catch（dist/index.js:6128/6136/6138/6176-6182），getTextContent 抛异常（worker 侧 circular reference / Type3 bbox / CID 字体 CMap→Unicode 构建无 try/catch 等）→ catch-all 用错误页替换已成功渲染的 canvas =「一瞬间有效画面后黑屏」。render 路径对字体失败有 ErrorFont 兜底 → CMap 资产不是黑屏直接触发点（历史 4 轮资产修复未根治与此一致）。
- **根因 B（回归）**：`import('pdfjs-dist/legacy/build/pdf.mjs')` 返回 ES module namespace（不可扩展、属性只读），旧补丁 `pdfjs.__ofvGetTextContentPatched = true` 抛 `Cannot add property ... not extensible`；`getDocument` 替换同样抛 read only。
- **修复**：`patchPdfGetTextContent(pdfjs)` 基于 namespace **浅拷贝生成可写代理**（`{ ...pdfjs }`，GlobalWorkerOptions 仍同引用、workerSrc 赋值语义不变），代理上替换 getDocument；文档就绪后经 `doc.getPage(1)` 定位 `PDFPageProxy.prototype` 包装 `getTextContent`——正常透传；异常/畸形降级空文本层 `{ items: [], styles: {}, lang: null }`（canvas 保留、黑屏消除）；`WeakSet` 防重复包装；不改 node_modules。
- **资产链路**：主进程回环 HTTP 服务（`http://127.0.0.1:<随机端口>/pdfjs/`，白名单 `^pdfjs/(cmaps|standard_fonts)/[\w.%-]+$`、CORS `ACAO:*` + OPTIONS 预检、`fs.readFileSync` 直读 asar）→ pdf.js 走 fetch 分支（dev/prod 一致）；`kaoyan-assets://` 保留备用。已核实 asar 打包、无 CSP、路径解析正确。
- **进度栏**：`.doc-status-bar` `margin:0 auto 0 0`——顶栏左侧紧随标题，`margin-right:auto` 推「默认应用打开」按钮最右；视频预览按钮位置不变。

### 改动文件（本轮之前）
- `src/renderer/src/views/Materials.vue`（patch 代理化 + 回环基址 cMapUrl + 进度栏位置）
- `src/main/main.ts`（回环 HTTP 服务 + `assets:get-base-url` IPC + before-quit 关闭）
- `src/preload/preload.ts`、`src/renderer/src/vite-env.d.ts`（getAssetsBaseUrl）
- `overview.md`、`.workbuddy/memory/2026-08-17.md`

### 验证（本轮之前）
- `npm run build` 退出码 0；`vue-tsc --noEmit` 仅 2 个预存无关错误（main.ts ElMessage / stores/index.ts pomodoro）
- 行为模拟 12 项断言全 PASS（含复现 namespace 错误、代理可扩展、GWO 同引用、透传/降级/兜底/二次 no-op、库 renderPage 等价流程 canvas 保留）
- 构建坑：mv dist 备份后增量 tsc 不重建 dist/main → 须 `rm tsconfig.node.tsbuildinfo` 强制重编译
- 已知限制：无法本地实测打包版 Electron；若抓到 console.warn 原始 worker 异常可进一步根治

## 发布
- 版本保持 3.5.2（覆盖更新），推送 main 后**删除远程 tag `v3.5.2` 再重建**触发 CI
