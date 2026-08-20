---
kind: frontend_style
name: 基于 CSS 变量与 GlassCard 的液态玻璃双主题设计体系
category: frontend_style
scope:
    - '**'
source_files:
    - src/renderer/src/style.css
    - src/renderer/src/components/GlassCard.vue
    - src/renderer/src/utils/theme.ts
    - src/renderer/src/App.vue
    - vite.config.ts
    - package.json
---

## 1. 系统/方法概述

本仓库前端采用 **Vue 3 + Vite** 构建，UI 样式完全基于 **原生 CSS 自定义属性（CSS Variables）** 实现，未引入任何 CSS-in-JS、Tailwind、Sass/Less 等预处理或原子化框架。视觉风格围绕一套自研的 **“Liquid Glass 液态玻璃”设计体系 v8** 展开：通过 `backdrop-filter` + 多层渐变背景 + 伪元素高光 + 弥散阴影，在浅色/深色两套主题下呈现磨砂玻璃卡片效果；同时提供可选的 “液态玻璃模式”（`body.liquid-glass`）以切换更贴近 macOS 风格的菲涅尔镜面反射参数。

第三方 UI 组件库为 **Element Plus**，其主题色、文本色、圆角、输入框、对话框、弹层、表格等均通过覆盖 Element Plus 的 CSS 变量（如 `--el-color-primary`、`--el-text-color-regular`、`--el-border-radius-base`）并追加全局样式进行统一玻璃化适配。

## 2. 关键文件

- `src/renderer/src/style.css` — 唯一的全局样式入口，集中定义所有设计令牌（design tokens）、双主题变量、GlassCard 工具类、Element Plus 覆盖、护眼模式、液态玻璃模式、滚动条、背景装饰层等。
- `src/renderer/src/components/GlassCard.vue` — 全局玻璃卡片封装组件，仅输出结构占位，视觉全部由全局 `.glass-card--card/--strong/--lite` 类驱动，禁止嵌套（嵌套区改用 lite）。
- `src/renderer/src/utils/theme.ts` — 主题运行时逻辑：维护 `light/dark/system` 三种模式、护眼模式开关、液态玻璃模式开关、自定义背景 URL，通过向 `<html>` / `<body>` 注入 class 和 CSS 变量生效。
- `src/renderer/src/App.vue` — 应用根组件，挂载 `app-bg-decor` 背景装饰层、侧边栏、路由视图，并在启动时调用 `initTheme()` 与 `initCustomBg()`。
- `vite.config.ts` — 将 `@` 别名指向 `src/renderer/src`，并将 `element-plus`、`vue`、`echarts` 等拆分为独立 vendor chunk，便于样式资源随包加载。
- `package.json` — 依赖声明中可见 `element-plus`、`@element-plus/icons-vue`、`vue`、`vue-router`、`pinia`、`echarts`、`pdfjs-dist` 等前端依赖。

## 3. 架构与约定

### 设计令牌（Design Tokens）
所有颜色、尺寸、间距、圆角、阴影、模糊半径、高光强度均定义为 CSS 变量，集中在 `:root` 下，命名遵循 `mo-*`（主品牌）与 `glass-*`（玻璃效果）前缀：
- 强调色：`--mo-primary` / `--mo-primary-dark` / `--mo-primary-light` / `--mo-accent` / `--mo-gradient`
- 语义色：`--mo-danger` / `--mo-success` / `--mo-warning` / `--mo-info`
- 背景：`--mo-bg-fallback` / `--mo-bg-image` / `--mo-bg-gradient` / `--ring-track`
- 玻璃：`--glass-bg` / `--glass-bg-strong` / `--glass-bg-fallback` / `--glass-border` / `--glass-blur` / `--glass-saturate` / `--glass-highlight` / `--glass-shadow` 等
- 文字层级：`--mo-text-1` / `--mo-text-2` / `--mo-text-3` / `--mo-text-disabled`
- 布局：`--titlebar-h` / `--app-gap` / `--side-nav-w` / `--side-nav-w-collapsed`
- 圆角：`--mo-radius` / `--mo-radius-lg` / `--mo-radius-sm`

### 双主题机制
- 浅色主题：默认 `:root` 下的变量值。
- 深色主题：`html.dark` 选择器覆盖同名变量，包括背景渐变、玻璃渐变、文字色、侧边栏、顶栏等。
- 主题切换：`theme.ts` 中的 `applyTheme()` 在 `<html>` 上 toggle `dark` 类，并设置 `data-theme` 属性；同时监听系统 `prefers-color-scheme` 变化。

### 玻璃拟态三级体系
`style.css` 定义了三个层级的玻璃卡片类：
- `.glass` / `.card` / `.glass-card--card`：标准磨砂玻璃，使用 `backdrop-filter: blur(18px) saturate(1.8)`。
- `.glass-strong` / `.glass-card--strong`：弹窗级强磨砂，使用更大的模糊半径（`--glass-blur-pop`）。
- `.glass-lite` / `.glass-card--lite`：**无滤镜**轻量面，仅半透明底色 + 细边框，用于长列表/网格等高频率滚动场景，避免 backdrop-filter 性能问题。

所有玻璃卡片的顶部内亮线、左上镜面光斑、弥散外阴影均由伪元素 `::before` / `::after` 承载，内容通过 `z-index: 1` 置于其上，确保只有一层 `backdrop-filter`，避免嵌套导致重采样闪烁。

### 液态玻璃模式（可选）
当用户开启“液态玻璃模式”时，`theme.ts` 向 `<body>` 注入 `liquid-glass` 类，`style.css` 中 `body.liquid-glass` 块覆盖所有 `--glass-*` 变量，使模糊半径增大至 25px/30px、饱和度降至 1、圆角增至 24px/32px，并通过多层 inset box-shadow 模拟 RGB 色差边缘，通过 SVG noise 纹理增加真实感。

### Element Plus 集成
`style.css` 直接覆盖 Element Plus 的 CSS 变量与类名：
- 主题色映射到 `--mo-primary` 系列
- 输入框/文本域使用半透明背景 + inset 边框，聚焦时边框变为 `--mo-primary`
- 对话框、消息确认框、轻提示、popper 下拉、日期面板均强制使用 `--glass-bg-strong` + `--glass-filter-pop` 玻璃化
- 表格背景透明化，表头行使用 `--mo-surface`

### 响应式策略
- 使用 `clamp()` 控制页面标题字号（`clamp(22px, 2.4vw, 26px)`）。
- 侧边栏宽度通过 CSS 变量 `--side-nav-w` 动态切换（展开 224px / 收起 68px），由 `App.vue` 监听折叠事件写入。
- 背景图使用 `background-size: cover; background-position: center; background-attachment: fixed` 自适应窗口大小。
- 未检测到 `backdrop-filter` 支持时，`@supports not (...)` 块自动降级为不透明底色 + 关闭高光。

### 可访问性与动效
- 尊重系统偏好：`@media (prefers-reduced-motion: reduce)` 下禁用所有动画与过渡。
- 护眼模式：`html.eyecare` 对 `#app` 施加 `sepia/saturate/hue-rotate/brightness` 滤镜，独立于深浅主题。
- 字体渲染优化：`-webkit-font-smoothing: antialiased`、`text-rendering: optimizeLegibility`、`letter-spacing: 0.01em`。

## 4. 约定与约束

- **所有视觉参数必须通过 CSS 变量引用**，禁止在组件内硬编码颜色/阴影/模糊值（GlassCard 组件注释明确要求“一处调参全站生效”）。
- **禁止嵌套 GlassCard**：组件注释明确说明“自身只占一层 backdrop-filter”，嵌套区域应改用 `.glass-card--lite`。
- **hover 不使用 transform 上浮**：注释明确指出任何 `transform` 都会创建新的合成层，在有 `backdrop-filter` 的卡片网格中会导致 z-index/isolation 失效，因此 hover 仅增强 `box-shadow`。
- **主题持久化键名固定**：`kaoyan_theme`、`kaoyan_eyecare`、`kaoyan_liquid_glass`、`kaoyan_bg_custom`，通过 `utils/storage` 读写。
- **Element Plus 浮层必须走全局覆盖**：对话框、消息、popper、日期面板等均在 `style.css` 中以 `!important` 强制玻璃化，组件内不应重复定义。
- **背景装饰层与卡片分离**：`.app-bg-decor` 只做弥散光斑，不做全屏磨砂；磨砂效果限定在每张卡片自身的 `backdrop-filter` 上。
- **深色噪点纹理**：深色主题下通过内联 SVG data URI 叠加 fractalNoise 纹理，作为零额外渲染层的背景细节。
- **Vite 分包约定**：`vendor-vue`、`vendor-element-plus`、`vendor-echarts` 三组手动分包，保证 Element Plus 样式与 JS 同步加载。

该体系的核心思想是：**单一全局 CSS 变量源 + 三层 GlassCard 工具类 + 运行时 class 切换主题/模式**，在不引入任何 CSS 预处理器的情况下实现高度一致的液态玻璃视觉风格。