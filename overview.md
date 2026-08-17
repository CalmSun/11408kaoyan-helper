# v3.5.2 更新：PDF 黑屏彻底修复（getTextContent 防御性包装·修正 namespace 兼容）+ 回环 HTTP 资源服务 + 进度栏移至顶栏左侧

## 问题（用户反馈）
1. PDF 浏览仍报「无法渲染该页面。该页可能包含浏览器 PDF 引擎暂不支持的图形、字体或压缩特性」
2. 关键新症状：**PDF 刷新时一瞬间有效画面，很快变黑屏并报错**——canvas 已渲染成功、随后才被错误页替换
3. 修复 #8 引入回归：控制台报 `Cannot add property __ofvGetTextContentPatched, object is not extensible`，PDF 无法打开
4. 文档进度栏需移至顶栏左侧、紧随文档标题之后

## 根因（两层叠加 + 一轮回归）

### 根因 A（黑屏直接触发点）
- 库 pdfPlugin.renderPage 把「canvas 渲染（核心）」与「文本层 getTextContent（可选增强）」放在同一 try/catch（dist/index.js:6128 replaceChildren(canvas) → :6136 render 成功 → :6138 await page.getTextContent() → :6176-6182 catch → replaceChildren(ofv-pdf-error)）。
- getTextContent 是独立 worker 任务，有 render 路径没有的抛异常点：circular reference（pdf.worker.mjs:41584）、Type3 bbox TypeError（:41671）、CID/Type0 buildToUnicode 拉外部 CMap 无 try/catch（:42604-42630）等。render 路径对字体失败有 ErrorFont 兜底（:40810-40816）→ **CMap 资产不是黑屏直接触发点**（历史 4 轮资产修复均未根治与此一致）。

### 根因 B（回归：patch 函数与 ES module namespace 冲突）
- `import('pdfjs-dist/legacy/build/pdf.mjs')` 返回 **ES module namespace**：不可扩展、属性只读。
- 旧实现 `pdfjs.__ofvGetTextContentPatched = true`（加属性）与 `pdfjs.getDocument = ...`（替换只读属性）在严格模式下分别抛 `Cannot add property ... object is not extensible` / `Cannot assign to read only property` → openDocumentViewer 直接失败。
- 且 `PDFPageProxy` 未在 pdfjs-dist 6.2.108 legacy 构建导出列表，无法直接拿 prototype。

### 根因 C（资产链路，仍须保证）
- pdf.js 6.2.108 `isValidFetchUrl` 只认 http(s)，非 http(s) 一律走 XHR；打包后 XHR 访问自定义协议不可靠 → 主进程回环 HTTP 服务（`http://127.0.0.1:<随机端口>/pdfjs/`，白名单 `^pdfjs/(cmaps|standard_fonts)/[\w.%-]+$`、CORS `ACAO:*` + OPTIONS 预检、`fs.readFileSync` 直读 asar），pdf.js 走 fetch 分支；`kaoyan-assets://` 保留备用。已核实 asar 打包（files:["dist/**/*"]）、无 CSP、打包路径解析正确。

## 修复
1. **`Materials.vue`（黑屏根治 + namespace 修正）**：`patchPdfGetTextContent(pdfjs)` 改为**基于 namespace 浅拷贝生成可写代理对象**（`{ ...pdfjs }`，GlobalWorkerOptions 仍指向原单例引用，库对 workerSrc 的赋值语义不变），在代理上替换 `getDocument`；文档就绪后经 `doc.getPage(1)` 定位 `PDFPageProxy.prototype`，包装 `getTextContent`：正常透传；**异常/畸形结果降级为空文本层 `{ items: [], styles: {}, lang: null }`**（库内文本层循环自然跳过、canvas 保留、黑屏消除）；`WeakSet` 防重复包装；不改 node_modules、不改 pdfjs 模块本身。调用点：openDocumentViewer 的 .pdf 分支 import pdfjs 后、pdfPlugin 创建前（`pdfjs: patchPdfGetTextContent(pdfjs)`）。
2. **`main.ts`（资产链路）**：回环 HTTP 资源服务 + `assets:get-base-url` IPC。
3. **`Materials.vue`（进度栏）**：`.doc-status-bar` 改 `margin:0 auto 0 0`——顶栏左侧紧随标题，`margin-right:auto` 推「默认应用打开」按钮到最右；视频预览按钮位置不变，零回归。

## 改动文件
- `src/renderer/src/views/Materials.vue`（patch 代理化 + 回环基址 cMapUrl + 进度栏位置）
- `src/main/main.ts`（回环 HTTP 服务 + IPC + before-quit 关闭；kaoyan-assets 协议保留）
- `src/preload/preload.ts`、`src/renderer/src/vite-env.d.ts`（getAssetsBaseUrl）

## 验证
- `npm run build`（vite build + tsc）退出码 0；`vue-tsc --noEmit` 仅 2 个预存无关错误（main.ts ElMessage / stores/index.ts pomodoro），零新增
- 行为模拟（node ESM 严格模式 + frozen namespace + class 语义 mock，12 项断言全 PASS）：① 旧实现两处修改复现用户报错（Cannot add property / read only）② patch 不抛错返回可扩展代理 ③ GlobalWorkerOptions 同引用（workerSrc 赋值语义不变）④ 页面实例 constructor 定位 prototype 正确 ⑤ 正常路径透传 ⑥ reject 降级空文本层 ⑦ 畸形结果兜底 ⑧ 二次 patch no-op ⑨ 库 renderPage 等价流程：getTextContent 失败 → 文本层为空、canvas 保留、无抛错
- 产物核查：dist/main/main.js 含回环服务（127.0.0.1×5）、dist/preload/preload.js 存在、渲染 chunk 含降级文案、pdfjs 资源 169+16
- **构建注意**：`mv dist` 备份后增量 tsc 不会重建主进程产物（composite tsbuildinfo 判定无变化）→ 须 `rm tsconfig.node.tsbuildinfo` 后重跑 tsc
- 已知限制：无法本地实测打包版 Electron；若用户机器抓到 console.warn 原始 worker 异常可进一步定位具体 PDF 特性根治

## 发布
- 版本保持 3.5.2（覆盖更新），推送 main 后**删除远程 tag `v3.5.2` 再重建**触发 CI
