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
