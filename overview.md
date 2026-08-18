# v3.5.7 更新：SourceBuffer 配额修复 + 弹幕渲染修复 + 热门自动首载 + 右侧栏紧凑化

## 修复：「SourceBuffer is full」播放中断

- **根因**：MSE 缓冲配额有限，v3.5.6 流控只限制「超前缓冲 90s」，已播放的历史缓冲随时间持续累积，高码率长视频最终超出配额，`appendBuffer` 抛 QuotaExceededError 导致播放中断
- **修复**：新增 `appendWithQuotaGuard()` 包裹每次 append —— 捕获 QuotaExceededError 后移除播放点之前 20s 以外的历史缓冲腾出配额并重试（保留 20s 便于回拖），仍失败才报错；普通错误行为不变

## 修复：弹幕看不到

- **根因**：弹幕条目为 JS 动态创建且位于 teleport 后的播放弹窗内，依赖组件 scoped 样式的 `:deep()` 选择器与 scoped keyframes 匹配不可靠，条目停留在起始位（可视区外）不可见
- **修复**：
  - keyframes 改为运行时全局注入（`ensureDmKeyframes` 一次性插入 `<style>`），条目样式全部行内设置，不再依赖组件作用域
  - 弹幕加载晚于播放开始时二分跳针到当前进度，避免历史弹幕一次性补发刷屏
  - 追加 setTimeout 兜底移除条目：系统禁用动画或 animationend 丢失时防止 DOM 泄漏

## 热门视频推荐首次访问自动刷新

- 首次切到热门页签自动触发一次 `loadPopular(true)`（随机跳页拉取 24 条）；之后复用缓存，仅「换一批 / 加载更多」手动触发
- 空态提示改为失败兜底文案

## 右侧栏紧凑化

- 右侧栏宽度 320px → 264px、最大高度 72vh → 58vh、间距收窄
- UP 主卡片紧凑化（头像 42px、内边距与字号缩小）；投稿 / 相关卡片信息区收紧（标题 12px / 元信息 11px），减少宽高占用

## 改动文件
- `src/renderer/src/components/BiliBiliPanel.vue`（appendWithQuotaGuard / 弹幕行内样式与全局 keyframes / 热门 popularTouched 自动首载 / 右侧栏紧凑样式）
- `package.json`（3.5.6 → 3.5.7，输出目录 release-v357）、`README.md`（版本徽章 / 功能说明）

## 验证
- `npm run build` 构建通过（vite + tsc 主进程编译）
- DASH 选轨 / 流代理 / 流控 / durl 回退 / 弹幕开关与持久化等既有链路零行为回归
- 本地资料与其他功能零改动路径

## 发布
- 版本号 3.5.7，打 tag `v3.5.7` 推送触发 CI 自动构建 Windows 安装包
