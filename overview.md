# v3.5.2 更新：PDF 黑屏彻底修复（getTextContent 防御性包装）+ 回环 HTTP 资源服务 + 进度栏移至顶栏左侧

## 问题（用户反馈）
1. PDF 浏览仍报「无法渲染该页面。该页可能包含浏览器 PDF 引擎暂不支持的图形、字体或压缩特性」，需彻底解决
2. 关键新症状：**PDF 刷新时一瞬间有效画面，很快变黑屏并报错**——canvas 已渲染成功、随后才被错误页替换
3. 文档进度栏需移至顶栏左侧、紧随文档标题之后

## 根因（本轮定论，两处叠加）

### 根因 A（黑屏的直接触发点——本轮首次定位到）
- `@open-file-viewer/core` 的 pdfPlugin.renderPage 把「canvas 渲染（核心内容）」与「文本层 getTextContent（可选增强）」放在**同一个 try/catch**：
  - `dist/index.js:6128` `state.wrapper.replaceChildren(canvas)` ← 画面闪现（用户看到的有效帧）
  - `:6136` `await renderTask.promise` ← 渲染成功
  - `:6138` `await page.getTextContent()` ← 脆弱点，任何 reject 都进 catch
  - `:6176-6182` catch → `replaceChildren(ofv-pdf-error)` ← **黑屏 + 报错文案**
- `getTextContent` 是独立 worker 任务（`sendWithStream("GetTextContent")`），有 render 路径没有的抛异常点：circular reference（pdf.worker.mjs:41584）、Type3 字体 bbox TypeError（:41671）、**CID/Type0 字体 buildToUnicode 必须拉取外部 CMap 且无 try/catch**（:42604-42630）、非嵌入中文字体需 GBK-EUC-H CMap（:42461）。
- **重要澄清**：render 路径对字体加载失败有 ErrorFont 兜底（:40810-40816），CMap 资产问题不是黑屏直接触发点——这解释了历史 4 轮资产修复（CDN→相对路径→自定义协议 XHR→回环 HTTP）均未根治黑屏。

### 根因 B（资产链路，仍须保证）
- pdf.js 6.2.108 `isValidFetchUrl` 只认 http(s)，非 http(s) 一律走 XHR 分支；打包后 XHR 访问自定义协议不可靠。
- 修复：主进程回环 HTTP 资源服务（`http://127.0.0.1:<随机端口>/pdfjs/`，白名单 `^pdfjs/(cmaps|standard_fonts)/[\w.%-]+$`、CORS `ACAO:*` + OPTIONS 预检、`fs.readFileSync` 直读 asar），pdf.js 走最成熟稳定的 **fetch 分支**；`kaoyan-assets://` 保留为备用通道。已核实：electron-builder `files:["dist/**/*"]` 将 pdfjs 资源打进 asar、无 CSP 拦截、打包路径解析正确（`__dirname/../renderer` = app.asar/dist/renderer）。

## 修复
1. **`src/renderer/src/views/Materials.vue`（黑屏根治）**：新增 `patchPdfGetTextContent(pdfjs)`——包装 pdfjs 实例的 `getDocument`，文档就绪后经 `doc.getPage(1)` 定位 `PDFPageProxy.prototype`，再包装 `getTextContent`：正常路径原样透传；**异常/畸形结果降级为空文本层 `{ items: [], styles: {}, lang: null }`**，使库内 renderPage 不会因文本层失败整页替换（canvas 保留、黑屏消除）；双标记防重复包装、内部 catch 吞掉全部 reject、仅影响本应用传入的 pdfjs 实例（不改 node_modules）。调用点：openDocumentViewer 的 .pdf 分支 import pdfjs 后、pdfPlugin 创建前。
2. **`src/main/main.ts`（资产链路，上一轮已落）**：回环 HTTP 资源服务 + `assets:get-base-url` IPC。
3. **`src/renderer/src/views/Materials.vue`（进度栏）**：`.doc-status-bar` 改 `margin:0 auto 0 0`——移至顶栏左侧紧随标题，`margin-right:auto` 把「默认应用打开」按钮推到最右；视频预览（无进度栏）按钮位置不变，零回归。

## 改动文件
- `src/renderer/src/views/Materials.vue`（patchPdfGetTextContent 防御包装 + 回环基址 cMapUrl + 进度栏位置）
- `src/main/main.ts`（回环 HTTP 服务 + IPC + before-quit 关闭；kaoyan-assets 协议保留）
- `src/preload/preload.ts`、`src/renderer/src/vite-env.d.ts`（getAssetsBaseUrl）

## 验证
- `npm run build`（vite build + tsc）退出码 0；`vue-tsc --noEmit` 仅 2 个预存无关错误（main.ts ElMessage / stores/index.ts pomodoro），零新增
- 产物核查：dist/main/main.js 含回环服务（127.0.0.1×5）；渲染 chunk 含 `__ofvGetTextContentPatched`；dist/renderer/pdfjs 169 cmaps + 16 standard_fonts（含 GBK-EUC-H / Adobe-GB1-UCS2 / UniGB-UCS2-H 等关键中文 CMap）
- 行为模拟（node mock pdfjs）：正常透传 PASS / reject 降级 PASS / 畸形结果兜底 PASS / 模拟库 renderPage 失败后 canvas 保留 PASS / 二次包装 no-op PASS
- 已知限制：无法本地实测打包版 Electron（二进制国内下载失败）；若用户机器上能抓到 console.warn 中的原始 worker 异常，可进一步定位具体 PDF 特性并考虑根治

## 发布
- 版本保持 3.5.2（覆盖更新），推送 main 后**删除远程 tag `v3.5.2` 再重建**触发 CI（GitHub 对已存在 tag 的重复推送不触发 workflow）
