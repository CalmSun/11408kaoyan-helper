# v3.6.5 补丁：两处类型错误根治（番茄钟设置 / 错误提示）+ 死依赖与重复资源清理

> 本文档上方为最新一轮。液态玻璃重构本身已完成并上线，本轮**不改动任何视觉实现**（重做风格属高风险低收益），只做「检查项目 + 清除无用代码」并根治前述两处预存错误。

## 1. 番茄钟设置键不一致（真实功能缺陷，非"无关错误"）

`overview.md` 此前后续记录曾把 `stores/index.ts` 的 pomodoro 类型错误判为"预存无关错误"，核查后确认它是**真实缺陷**：

| 位置 | 使用的键 |
|---|---|
| 声明默认值（`stores/index.ts:284`）、`pomodoro.ts`、`Settings.vue` | `enableNotification` / `enableSound` / `enableTitleFlash` |
| `refreshAllFromStorage()` 的默认值（旧 `:641`） | `autoStartBreak` / `autoStartWork` / `soundEnabled` ← **错键** |

**影响链**：`onStorageReady(refreshAllFromStorage)` 在存储就绪后用错键对象**整体覆盖** `pomodoroSettings`，而 `pomodoro.ts` 读的是 `enableSound` / `enableNotification` / `enableTitleFlash` → 三者均为 `undefined`（假值）→ **全新安装（无已存设置）时番茄钟完成的声音 / 通知 / 标题闪烁提醒全部静默失效**，且 `watch(deep)` 会把错键对象写回存储。已存设置的老用户走 `getStorage` 返回自身对象，**不受影响**。

**修复**：默认值改用规范键，与声明处完全对齐。

## 2. 全局错误提示从未生效（`main.ts`）

```ts
ElementPlus?.ElMessage?.error?.(...)   // ElementPlus 是插件对象，无 ElMessage 属性 → 恒 undefined
```
可选链吞掉了调用，`app.config.errorHandler` 里"写入日志**并弹提示**"的提示路径是死代码。改为具名导入 `ElMessage`（与 `router/index.ts` 一致；导入组件不涉及插件重复初始化，原注释的顾虑不成立）。

## 3. 死依赖与重复资源清理（均已证明）

| 项 | 证据 | 处置 |
|---|---|---|
| `vue-echarts` + `vue-demi` | `src/`、`vite.config.ts`、`index.html` 全库零引用；图表直接用 `echarts/core` + 手写 `echarts.init()` | `npm uninstall`；同步移除 `allowScripts` 中随之失效的 3 条（剩余 `electron`/`esbuild` 条目已核对与实装版本一致） |
| 根目录 `background.jpg`（3 MB） | 与 `src/renderer/src/assets/background.jpg` **MD5 完全相同**（`f5258426…`）；`style.css` 引用的是 `src/` 下那份；全库无功能性引用 | `git rm` 删除重复件，规范资源保留 |
| `.agents/skills/liquid-glass-widgets` | 空目录、未被 git 跟踪 | 删除 |

## 4. 验证（可复现）

- `npx vue-tsc --noEmit -p tsconfig.json`：修复前 **2 error** → 修复后 **0 error**
- `npm run build`（`vite build && tsc -p tsconfig.node.json`）：退出码 0
- **依赖清理零影响证明**：清理前后对 `dist/` 全量 374 个文件做逐个 SHA256 比对 → **完全一致**
- 源码修复后产物文件数仍为 374（75 个 chunk 为哈希级联重命名，源自在被所有视图引用的 `stores/index.ts` 改动），无文件增删
- 作用域：已存设置用户行为不变；全新安装由"提醒失效"变为"提醒生效"

## 5. 本轮刻意不改（有证据但风险大于收益）

| 项 | 不改的理由 |
|---|---|
| `style.css` 中 `.glass-strong` / `.glass-card--strong` | 无调用点传入 `variant`（恒为默认 `card`），规则实际不可达；但它属于 `GlassCard` 已声明的公开 API，删除会使该 API 静默失效。收益为几百字节，风险非零 → 仅记录 |
| `.glass-card--lite` | 审计命中的其实是注释文字，样式规则上一轮已删 |
| style.css 其余 15 个"孤儿"类（`.el-*` / `.is-*`） | 均为 Element Plus 运行时类名，源码中不出现属正常，属**误报**，不可删 |
| `.qoder/`（1.7 MB 生成型 wiki）、`.trae/`、`.workbuddy/` | 第三方工具产物，非产品代码；删除会破坏用户工具状态 → 仅报告，待用户决定 |

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
