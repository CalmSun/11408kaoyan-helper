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

位移图是运行时用 canvas 按圆角矩形 SDF 现算的：R 通道编码 x 位移、B 通道编码 y 位移、A 通道编码"离轮廓多近"。`feDisplacementMap` 按这张图位移像素，**中心零形变、越靠边缘位移越大**，这就是边缘透镜。三通道用略微不同的位移量叠加，边缘自然出现色差。

### 2. 与参考项目的两处适配

库不能直接套用——它要求玻璃元素必须是组件自己的根节点，而本项目卡片嵌在多层之下。两处改动：

| 差异 | 参考项目 | 本项目 |
|---|---|---|
| 滤镜 | 每个组件实例一个 uuid 滤镜 | 按「宽高比 + 圆角占短边比例」分桶共享，几十张卡片通常落到 2~6 个桶 |
| 位移图 | 内置 40KB+ 硬编码 JPEG/PNG | 启动时 canvas 现算，不占包体，且斜面宽度随卡片尺寸自适应（小卡片不会被斜面吞掉） |

### 3. 全站统一（原来只覆盖了一部分）

`Materials.vue` / `Music.vue` 各自复制了一整套卡片视觉（含 4 段 `body.liquid-glass` 覆盖），用的是裸 `.glass-card`，全局样式覆盖不到。现在 `.glass-card` 提升为全局一等类，两页只保留布局属性，共删除 **124 行**重复样式。

### 4. 文字可读性：靠抬背景，不靠加厚玻璃

清透玻璃压在高反差照片（亮天空 + 近黑树影）上，文字必然看不清。解法是在滤镜链里**压缩背景动态范围**，而不是往玻璃里加白（加了就退化成磨砂）：

```
backdrop-filter: blur(7px) saturate(155%) contrast(0.32) brightness(1.40)
                                          ↑ 先压进窄带    ↑ 再整体抬到可读区间
```

实测卡片玻璃面亮度 0.675，文字对比度：

| 色阶 | 调整前 | 调整后 |
|---|---|---|
| text-1 | 7.5:1 | **7.5:1** |
| text-2 | 5.0:1 | **6.5:1** |
| text-3 | 3.25:1 | **4.3:1** |

### 5. 无用代码清理

| 项 | 说明 |
|---|---|
| `.glass` | 全项目零引用，从三个选择器组里移除（改由 `.glass-card` 承接） |
| `.gradient-text` / `.number-emphasis` | 仅定义、无引用 |
| `.theme-*` / `.user-*` | SideNav 里 7 段死样式（主题与用户栏早已移到顶栏） |
| Materials / Music 重复玻璃样式 | 124 行 |

### 6. 性能与降级

- 采样真实 backdrop，滚动 / 自定义背景 / 嵌套内容全部自动正确，无需逐帧 JS
- 滚出视口的卡片自动撤掉 warp 退回 CSS 玻璃，GPU 只为可见区域付费
- 卡片自身的 `backdrop-filter` 会撤掉，杜绝嵌套滤镜的双重模糊与双重开销
- 不支持 `filter: url()` 时整体不挂载，视图层零改动自动退回原 CSS 玻璃

### 7. 一处刻意的排除

侧边导航与顶栏**不参与**折射。它们承载导航与状态文字，一旦变通透，菜单文字压在背景照片上会明显变淡。这两处保持原有的半透明底色 + 模糊，观感一致但不牺牲可读性。

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
