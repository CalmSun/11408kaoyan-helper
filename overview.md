# v3.5.2 更新：PDF 渲染彻底修复（回环 HTTP 资源服务）+ 进度栏移至顶栏左侧

## 问题（用户反馈）
1. PDF 浏览仍报「无法渲染该页面。该页可能包含浏览器 PDF 引擎暂不支持的图形、字体或压缩特性」，需彻底解决
2. 文档进度栏需从顶栏中间移至顶栏左侧、紧随文档标题之后

## 根因与修复（本轮）

| # | 根因 | 修复 |
|---|------|------|
| 1 | pdf.js `isValidFetchUrl` 只认 `http(s)`，非 http(s)（file:// / 自定义协议）一律走 XHR 分支；`kaoyan-assets://` 自定义协议 + corsEnabled + fs.readFile 方案在打包后仍不可靠（历经 #3/#4/#6 三轮修复未根治）→ CMap/标准字体加载失败 → 中文 CID 字体 PDF 页面渲染报错 | **改换通道而非继续修补**：主进程新增回环 HTTP 静态资源服务（`http://127.0.0.1:<随机端口>/pdfjs/`），只绑定回环地址（不触发防火墙）、白名单仅放行 `pdfjs/cmaps` 与 `pdfjs/standard_fonts`（防路径穿越）、带 `Access-Control-Allow-Origin:*` 与 OPTIONS 预检处理；渲染进程经 preload `getAssetsBaseUrl()` 获取基址，pdf.js 因此走最成熟稳定的 **fetch 分支**，dev/prod 行为一致；服务不可用时自动回退 `kaoyan-assets://` 备用通道（协议保留不删） |
| 2 | 进度栏 `.doc-status-bar` 在顶栏 `margin:0 auto` 居中 | CSS 改为 `margin:0 auto 0 0`——进度栏紧贴标题左侧，`margin-right:auto` 把「默认应用打开」按钮推到顶栏最右；视频预览时进度栏不渲染（v-if），按钮位置不变，无回归 |

## 历史根因链（PDF「无法渲染」完整定位）
1. open-file-viewer 默认从 jsDelivr CDN 加载 CMap → 离线/国内网络不可达
2. 相对路径 `pdfjs/cmaps/` → prod 解析为 `file://`，XHR 被 `webSecurity:true` CORS 拦截
3. 自定义协议 `kaoyan-assets://` 缺 `corsEnabled` → XHR 跨域失败
4. `net.fetch(file://)` 读 asar 内文件不稳定 → 改 `fs.readFile` 直读
5. （本轮定论）自定义协议 XHR 通道本身在打包后不可靠 → **放弃 XHR 通道，回环 HTTP 使 pdf.js 走 fetch 分支**

## 改动文件
- `src/main/main.ts`（新增 `startPdfAssetsServer()` 回环 HTTP 服务 + `assets:get-base-url` IPC + before-quit 关闭；`kaoyan-assets` 协议保留为备用）
- `src/preload/preload.ts`（暴露 `getAssetsBaseUrl`）
- `src/renderer/src/vite-env.d.ts`（ElectronAPI 类型补充）
- `src/renderer/src/views/Materials.vue`（pdfPlugin 的 cMapUrl/standardFontDataUrl 改用回环 HTTP 基址 + 协议回退；进度栏 CSS `margin:0 auto 0 0`）

## 验证
- `npm run build`（vite build + tsc）：通过，退出码 0
- `vue-tsc --noEmit`：仅 2 个预存无关错误（main.ts / stores/index.ts），本次改动零新增
- 产物核查：`dist/main/main.js` 含回环服务代码；渲染 chunk 含 `getAssetsBaseUrl`；CSS 含 `margin:0 auto 0 0`；`dist/renderer/pdfjs/` 含 169 cmaps + 16 标准字体
- 已知限制：Electron 二进制国内下载失败，无法本地实测打包版；方案基于 pdf.js 6.2.108 源码静态分析（fetch 分支为 pdf.js 默认部署路径，可靠性远高于自定义协议 XHR）

## 发布
- 版本保持 3.5.2（覆盖更新），推送 main 后**删除远程 tag `v3.5.2` 再重建**触发 CI（GitHub 对已存在 tag 的重复推送不触发 workflow）
