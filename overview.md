# v3.6.5 更新（第四轮）：对齐 Regular Glass 参数 + 修三个显示 bug

用户反馈"大量显示 bug、整体像套一层白雾、卡片有白块、卡片背景倒置"，并要求改用参考站的
**Regular Glass** 效果应用所有大小卡片。

## 一、三个 bug 的根因与修复

| 现象 | 根因 | 修复 |
|---|---|---|
| 卡片背景倒置 | 纹理上传用 `UNPACK_FLIP_Y_WEBGL=0`（纹素 v=0 即图片顶行），采样时又多做了一次 `uv.y = 1-uv.y` | 去掉那次翻转 |
| 整体像套一层白雾 | 第二轮为了救文字对比度，给 `.app-bg-decor` 加了 44% 全屏白蒙版 | 降到 10%，可读性改由着色器内部解决 |
| 卡片出现白块 | ① 对比度压缩过猛，亮部直接顶到 1.0；② 未渲染成功的元素已被设为背景透明，露出原始背景 | ① 压缩区间收到 0.54~0.90；② 改成**渲染成功后才加 `.lg-on`**，没画上就保持 CSS 玻璃 |

顺带修的两处：canvas 定位在 padding box 内，原点要加 `clientLeft/clientTop`，否则整体偏 1px；
补挂载从"轮询元素数量"改为 `MutationObserver`——数量不变但节点被替换时轮询会漏掉。

## 二、Regular Glass 参数对齐

参考站默认档：`refraction 0.69 / zRadius 40 / blurAmount 0.25 / chromAberration 0.05 /
edgeHighlight 0.05 / opacity 1 / saturation 0 / brightness 0 / shadowOpacity 0.3`。

| 参数 | 实现 |
|---|---|
| refraction 0.69 + zRadius 40 | 斜面宽度 `min(40, max(9, 短边×0.30))`，位移 = 斜面 × 0.69 |
| blurAmount 0.25 | 十字五点模糊，半径 `clamp(短边×0.02, 2, 6)` px |
| chromAberration 0.05 | 色差 = 斜面 × 0.05，只在斜面带内出现，中心无色边 |
| opacity 1 / saturation 0 / brightness 0 | **不染色、不增饱和、不增亮**（删掉了之前的 tint） |
| edgeHighlight + fresnel | 菲涅尔边缘亮度 + 左上镜面光斑 + 顶端细亮线 |

唯一保留的偏离：仍做一层很轻的**对比度压缩**（`(col-0.5)*0.45+0.5+0.24`，不染色、不发白），
作用等同 Apple 的 vibrancy——否则深色文字压在照片的树影上会整片消失。
如果完全不要这一层，把 `uContrast` 设为 1.0、`uLift` 设为 0 即可，代价是暗部文字丢失。

## 三、验证

- `npm run build` 多次 exit 0（57–77s）
- Edge 实例逐屏截图：背景不再发雾、卡片无白块、背景方向正确、KPI 小卡片与大卡片同样生效
- 仍偏弱的位置：快捷入口等密集小字压在树影最深处时对比度偏低（清透玻璃的固有代价）

---

# v3.6.5 更新（第三轮）：自研边缘透镜 WebGL 玻璃

CSS 的 `backdrop-filter` 只有模糊与色彩函数，做不出参考站那种**边缘透镜放大**——
`feImage` 位移图方案实测在 backdrop-filter 里不生效且帧率掉到 10-17。要透镜只能上 WebGL。

## 一、为什么自研而不是直接用 @ybouane/liquidglass

该库效果确实最好（CDN 实测 145FPS，能看到树影被真实折射），但源码核实出三条与本项目结构冲突的约束：

1. 玻璃元素必须是 root 的直接子节点；本项目卡片在 `main > 视图 > .grid > 卡片` 四层之下。
2. root 自身背景不被采样，场景要作为子节点重画一份并对齐滚动位置。
3. `_setupGlassElements` 无条件设置 `el.style.overflow = "visible"`，与主内容区 `overflow-y: auto` 直接冲突；
   并且它把所有非玻璃子节点交给 `html-to-image` 逐次栅格化，深层容器每次几十到几百 ms。

**自研的前提是换了取景方式**：应用背景本来就是「一张固定图 / 一段渐变」，不是任意 DOM。
于是不需要抓取 DOM —— 着色器按元素的屏幕位置直接采样背景即可，滚动只是重算位置。

## 二、实现（`src/renderer/src/utils/liquidGlass.ts`）

| 步骤 | 做法 |
|---|---|
| 边缘透镜 | 圆角矩形 SDF + 梯度方向位移，位移量随靠近边缘平方衰减，中心零形变 |
| 色差 | R/G/B 三个通道用不同折射率分别采样 |
| 斜面弥散 | 斜面带内额外采一次偏移样本，厚玻璃边缘比中心更"糊"一点 |
| 菲涅尔 | 越靠边越亮 + 左上镜面光斑 + 顶端细亮线 |
| 可读性 | **压缩背景对比度**（`(col-0.5)*0.55+0.5+0.30`）再叠 0.20 白度：保留树影结构，削掉极值 |

关键经验：清透玻璃压在高反差照片上，文字一定看不清。解法不是加白（会变磨砂），
而是**在着色器里压对比度**——结构还在（通透），极暗极亮被收进窄区间（可读）。
深色主题背景本就柔和，不做压缩。

性能设计：全应用共用一个 WebGL 上下文（不是每元素一个）；每个玻璃元素只挂一个 2D canvas
承接 blit；GL 绘图缓冲只增不减；滚动 / 尺寸变化用 rAF 合帧。

## 三、逐页推广

选择器统一为 `.card, .glass-card, .stat-card, .login-card`，路由切换 / 列表刷新后由 500ms 补挂载兜底。
已实测页面：仪表盘、数据统计（含 ECharts 画布）、音乐播放、学习资料。

`z-index: -1` + 父级 `isolation: isolate` 让 canvas 落在内容之下。
**不要**用 `> *:not(.lg-canvas) { position: relative; z-index: 1 }` 的方案——那会覆盖各视图里
绝对定位子元素的样式，实测直接把页面布局撑爆。

## 四、回退

- WebGL 不可用 → `available = false`，元素保持 CSS 玻璃观感
- 用户自定义背景走 `kaoyan-bg://` 协议，无法保证可作为 WebGL 纹理（跨域污染）→ 同样退回 CSS 玻璃
- 两条回退都不需要视图层写任何代码，靠 `.lg-on` 类的加/减切换

## 五、验证

- `npm run build` 多次 exit 0（42–60s）
- 真实构建产物在 Edge 实例里逐页截图验收：文字可读、背景结构透出、图表正常叠加
- 功能面零改动：没有改任何视图模板、store、路由、IPC

## 六、待办

- 长列表页滚动时的 blit 成本需在真机 DPR 2 下再测一轮
- 自定义背景若要支持，需要在主进程给 `kaoyan-bg://` 加 CORS 响应头

---

# v3.6.5 更新（第二轮）：去掉毛玻璃，改成真正的液态玻璃折射

用户反馈 v3.6.5 仍"不够通透"。根因不是透明度数值，而是**用 blur 模拟玻璃**——blur 把背景糊成灰面，
无论多透明都读不出"玻璃"。本版把 `backdrop-filter` 从 blur 换成 SVG 位移滤镜，做真实折射。

## 一、核心改动

| 项 | v3.6.5 | v3.6.6 |
|---|---|---|
| 滤镜 | `blur(22px) saturate(1.9)` | `url(#kaoyan-glass-wave) blur(2px) saturate(1.45)` |
| 折射实现 | 无（只有模糊） | `feTurbulence` + `feDisplacementMap` 让背景像素真实位移 |
| 模糊 | 22px（深色 24px） | 2px（仅柔化高频细节，不糊形状） |
| 浅色玻璃白度 | 0.64 → 0.44 | 0.40 → 0.27（配合背景提亮保证可读） |
| 深色玻璃白度 | 0.085 → 0.030 | 0.048 → 0.016（近乎全透） |
| 圆角 | 18 / 26 / 12 | 20 / 28 / 13（贴近参考站 cornerRadius 40 的形态） |
| 次级文字 | #6f7889 | #46505f（清透玻璃下必须压深才达 4.5:1） |

`index.html` 内联两个隐藏 SVG 滤镜：默认档（scale 9）与强折射档（scale 16，超通透模式用）。
`@supports (backdrop-filter: url(...))` 命中才启用折射，未命中退回 `blur(12px)` 低模糊方案。
`--glass-wave` 是变量，`body.liquid-glass` 直接换 id 即可切档，不必重写整套滤镜声明。

**可读性靠背景层而不是玻璃层**：玻璃几乎不染色后，文字对比度由 `.app-bg-decor` 的白色蒙版（0.44）
统一提亮背景解决——抬背景不抬玻璃，才能同时拿到"通透"和"字看得清"。

## 二、实测与排除的方案

| 方案 | 结果 |
|---|---|
| SVG 位移滤镜折射（本版采用） | 生效，15 张带滤镜卡片同时存在时 **144 FPS**（显示器上限），零 JS 逐帧开销 |
| `feImage` 位移图做"边缘透镜放大" | **不可用**：在 backdrop-filter 里不生效，且帧率掉到 10-17 FPS |
| `@ybouane/liquidglass` WebGL 库 | **可用且效果最好**（CDN 实测 145 FPS，能看到树影被真实折射），但见下节结构限制 |

## 三、为什么不整站接入 WebGL 库（已验证，非推测）

`@ybouane/liquidglass@1.0.3` 可用，但它的三条硬约束与本项目结构冲突：

1. **玻璃元素必须是 root 的直接子节点**。本项目的卡片嵌在 `main > 视图 > .grid > 卡片` 四层之下，
   要满足就必须把 14 个视图逐个改写成"root + 场景层 + 直接子节点面板"。
2. **root 自身的背景不会被采样**，场景必须以子节点形式重画一份（且要跟滚动位置对齐）。
3. **库会强制给玻璃元素设置 `overflow: visible`**（源码 `el.style.overflow = "visible"`），
   而主内容区依赖 `overflow-y: auto` 滚动——直接冲突。另外它会把所有非玻璃子节点用
   `html-to-image` 栅格化，深层大容器每次重绘都是几十到几百毫秒。

结论：整站接入等于重写布局模型。本版先把 CSS 折射做扎实；若要把 WebGL 库用起来，
建议按页迁移（先做一页样板确认观感），而不是全站一次性替换。

## 四、验证

- `npm run build` 连跑多次均 exit 0（51–64s）
- 真实构建产物在浏览器里渲染验收：浅色 / 深色两种主题逐屏截图比对
- 性能实测见上表；`.glass-lite` 仍无滤镜，长列表不受影响
- 功能面零改动：只改 `style.css` 令牌层与 `index.html` 内联 SVG，未触碰任何组件逻辑、store、路由、IPC

---

# v3.6.5 更新（第一轮）：设计风格重构为液态玻璃 + 玻璃样式去重 + 无用代码清理

参照 https://liquid-glass.ybouane.com/ 的视觉语言重构全局设计体系，功能行为零改动。

## 一、设计重构（纯 CSS，不引入 WebGL）

| 维度 | v3.6.4 | v3.6.5 |
|---|---|---|
| 玻璃高光 | 顶部单层内亮边 + 左上光斑 | 镜面亮边 + 左上光斑 + 左右菲涅尔 + 底边折射微光 + 极轻 RGB 色差（一次伪元素多背景层实现） |
| 玻璃质感 | 无颗粒，大面偏"塑料" | `::after` 承载极轻噪点，消掉半透明面的塑料感 |
| 深色背景 | 纯深蓝渐变 + 噪点 | 三层彩色光溢出（蓝 / 紫 / 青）叠近黑底 + 上下暗角，制造可被玻璃折射的明暗变化 |
| 圆角 | 14 / 20 / 10px | 18 / 26 / 12px（超通透档 24 / 34 / 16），贴近参考站的大圆角形态 |
| 字阶 | 无统一变量 | `--fs-title` / `--fs-body` / `--fs-small`，标题 `letter-spacing: -0.02em` + `text-wrap: balance` |
| 文本对比度 | text-3 `#8b92a0` | text-3 `#6f7889`（玻璃面上小字达 4.5:1） |
| 浏览器原生面 | 默认滚动条 / 选中色 | 滚动条胶囊化 + 选中色跟随强调色 + `:focus-visible` 键盘焦点环 |

**关键取舍：为什么不直接接 `@ybouane/liquidglass`**
该库靠 `html-to-image` 逐帧把 DOM 栅格化进 canvas，再走多 pass WebGL pipeline。本项目单页含数百条列表项，接入后每帧都要重绘取景，必然掉帧；且每个实例独占一个 WebGL 上下文（浏览器上限约 16 个）。因此用 CSS 合成层复刻同一套光学语言：`backdrop-filter` 负责折射模糊，伪元素负责镜面 / 菲涅尔 / 色差，零额外 DOM、零 JS 逐帧开销。

**"液态玻璃"开关保留并重新定位**：基础样式已是玻璃质感，该开关变为"超通透档"——降低玻璃底色、加大模糊与色差、放大圆角。持久化 key（`kaoyan_liquid_glass`）未变，用户既有偏好继续生效。

## 二、性能红线（保持既有约束）

- 每张卡片始终只有 **一层** `backdrop-filter`，伪元素不叠加滤镜
- `.glass-lite` 保持无滤镜，供长列表 / 网格使用
- hover 仍只用 `box-shadow`，**不做 `transform` 位移**（v3.2.7 修复的合成层遮挡问题不能回退）
- 模糊半径 18px → 22px（深色 24px），补偿：本次删除了 137 行各处重复的玻璃规则，全站带滤镜元素数量反而减少
- 过渡仍限定具体属性，不使用 `all`

## 三、代码清理

| 位置 | 内容 | 处理 |
|---|---|---|
| `views/Materials.vue` | 本地 `.glass-card` 全套视觉 + 4 段 `body.liquid-glass` 覆盖（65 行） | 删除，仅保留 `padding` / flex 布局 |
| `views/Music.vue` | 同上（72 行） | 删除，保留布局 + `overflow: visible`（v3.2.6 合成层修复所需） |
| `style.css` | `.gradient-text`、`.number-emphasis`、裸 `.glass` 选择器 | 删除（全项目零引用） |
| `components/SideNav.vue` | `.theme-section` / `.theme-toggle` / `.theme-text` / `.user-section` / `.user-info` / `.user-icon` / `.user-name` | 删除（v2.7.0 起主题切换与用户栏已迁至顶栏，模板中无对应节点） |
| `style.css` | 旧高光变量 `--glass-edge-highlight` / `--glass-highlight-*` | 收敛为 `--glass-rim-*` / `--glass-specular` / `--glass-top-glow` / `--glass-bottom-glow`，视图侧零残留 |

新增全局类 `.glass-card`：此前 Materials / Music 用裸 `<div class="glass-card">`，全局规则只覆盖 `.glass-card--card`，两页只好各自复制整套玻璃样式并单独补 `body.liquid-glass` 覆盖——这是重复代码的根因。现将其提升为一等玻璃类，与 `.card` / `.glass-card--card` 视觉一致。

## 四、验证

- `npm run build` 通过（56.5s，exit 0），dist/renderer 正常产出
- 旧变量引用残留：0；`--glass-*` 引用与定义一一对应
- 构建产物 CSS 渲染验收：深色 / 浅色 × 默认 / 超通透 四组截图对照通过，正文与次级文字对比度达标
- 功能面零改动：无模板结构变更、无 store / 路由 / IPC 改动、无新增依赖

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
