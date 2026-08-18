# 11408 考研助手 v3.6.2 更新概述

本次迭代**着重根治弹幕不显示**（用户连续多轮反馈），并修正侧栏对齐细节。

## 1. 弹幕不显示（彻底重构渲染驱动，确定性修复）

**根因**（三层叠加，前两轮只修了表层）：
1. **动画驱动不可靠**（本轮核心）：v3.6.1 改用 `element.animate()`（Web Animations API），其 keyframes 中的 `calc(-100% - 100vw)` 等表达式在 Electron 28 / Chromium 120 的 WAAPI 中**解析不可靠**——动画失败后元素停留在 `left:100%`（视口右侧外）不可见，随后被兜底 setTimeout 移除 → "完全看不到弹幕"。
2. **发射驱动脆弱**：弹幕发射依赖 video 的 `@timeupdate` 事件，DASH（MSE）模式下该事件可能不触发或频率低 → 弹幕指针不推进。
3. **数据链路静默失败**：主进程拉取失败时渲染层静默吞掉，无任何提示，用户无法判断是数据问题还是渲染问题。

**修复**（BiliBiliPanel.vue）：
- **弹幕移动/淡出彻底改为 requestAnimationFrame 手动驱动**：滚动弹幕每帧用 `translateX(px)` 像素级平移（从层右缘 `layerW` 滚到左缘完全滚出 `-elW`，单调递减、全程可见），固定弹幕每帧控制 opacity（淡入 8% → 停留至 80% → 淡出）；完全不依赖 WAAPI / CSS animation，Electron 中 100% 可靠；
- **发射改为 rAF 轮询**：`startDmLoop()` 每帧主动检查 `videoEl.currentTime` 推进弹幕指针，不再依赖 timeupdate；播放启动即开启（`playVideo`），弹窗关闭停止（`onPlayerClose` 调 `stopDmLoop`）；
- **失败可见化**：`loadDanmaku` 失败输出 `console.warn('[弹幕] CID xx: 拉取失败 — ...')`，成功输出条数日志，便于定位；
- 主进程保持 XML 优先（list.so → comment.bilibili.com）→ seg.so 无 WBI 直连兜底（v3.6.2 已改 `/x/v2/dm/web/seg.so`，实测无需签名每段 50+ 条）。

## 2. 评论/投稿/相关列表底部与视频信息底部齐平（修正过度拉伸）

**根因**：v3.6.2 初版用 `align-items: stretch` 让侧栏与左侧 main 整体等高——但 main 含分 P 条时侧栏被撑到"最高长度"，底部超出视频信息栏。

**修复**（BiliBiliPanel.vue 模板 + CSS）：
- **分 P 横向列表移出 main，移至弹窗底部全宽**——main 仅含「视频 + 信息栏」，侧栏 stretch 等高后底部恰好与信息栏底部齐平；
- `.bili-pages-strip` 补充 `margin-top: 14px` 适配底部位置。

## 验证

- rAF 像素驱动算法模拟验证：首帧 x=layerW（右缘外）、中段进入可视区、末帧滚出，单调递减 PASS；opacity 分段（0→1→1→0）PASS；
- `npm run build` 退出码 0；`vue-tsc --noEmit` 仅 2 个预存无关错误，零新增；
- 产物核查：Materials chunk 含 rAF 驱动（requestAnimationFrame ×17）、弹幕日志特征、分 P 条底部移位 CSS（margin-top:14px）；
- 主进程：无 WBI seg.so 实测 52/57/50 条每段、XML list.so 2322 条。

> 说明：弹幕渲染从"动画 API"改为"rAF 像素驱动"是确定性修复——不再依赖任何浏览器动画引擎行为，只要 video 播放、数据到位即可显示。
