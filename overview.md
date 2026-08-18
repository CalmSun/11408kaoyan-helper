# 11408 考研助手 v3.6.2 更新概述

本次迭代着重根治 B 站板块两大顽疾：**视频播放自动降清**与**弹幕完全不显示**，并完成侧栏卡片底部对齐。

## 1. 长视频自动降清（彻底根治）

**根因**（两处叠加）：
1. **播放中降清**：`pumpTrack` 拉流遇 MSE `QuotaExceededError` 时走"降清链"（v3.6.1 为连续 3 次后降 80→64→48）。长视频/高码率在低配设备上配额频繁打满，仍会触发自动降清。**MSE 实践的正确做法是定期清理播放点前历史缓冲（evict），而非降清晰度**（Chrome 桌面 SourceBuffer 配额约 150MB）。
2. **起播覆盖降清**：`loadStream` 里 `if (res.quality) currentQn.value = res.quality` 无条件用服务端返回值覆盖用户选择——服务端因风控/临时限制返回更低清晰度时，用户选的 1080P 被悄悄改成 720P（"自动降清"观感来源）。

**修复**（BiliBiliPanel.vue）：
- **彻底移除自动降清链**：`pumpTrack` 遇配额不足 → 激进清理（保留播放点前 2s）→ 等待缓冲消耗 → 同清晰度重启拉流；无法重启则保留已缓冲内容继续播放，绝不降清、不弹错误页；
- **新增 `evictOldBuffers` 主动清理**：每次 append 前清理播放点前 10s 之外的历史缓冲（音视频双缓冲），从源头防止配额打满；
- `loadStream` 不再用 `res.quality` 覆盖用户选择；仅当用户选择高于服务端最高可用（`acceptQualities` 上限）时才降到最高可用，且直接使用本次响应中的 DASH 轨道播放（DASH 响应含全部可用轨道，省去二次请求）；
- 清晰度切换仅保留用户手动选择（下拉框）。

## 2. 弹幕完全不显示（时序 bug + 拉取链路加固）

**根因**（两个独立 bug）：
1. **渲染时序 bug（v3.6.1 引入的回归）**：`spawnDanmaku` 中 `el.animate()` 在 `layer.appendChild(el)` **之前**调用——对未挂载文档的元素调用 `element.animate()`，动画从创建时刻就开始计时，元素插入 DOM 时动画往往已结束（`onfinish` 已触发移除），弹幕因此"完全看不到"。这是本轮弹幕不显示的首要原因；
2. **拉取链路脆弱**：seg.so 走 WBI 签名（`/x/v2/dm/wbi/web/seg.so`），需先调 nav 拿密钥再签名，任一环失败（密钥获取失败/签名算法不一致/风控）则整体不可用。

**修复**：
- **先 append 再 animate**：弹幕元素先挂载到层，再启动 Web Animations API 动画，保证动画在元素可见时正常播放（滚动/淡出），保留 setTimeout 兜底移除；
- **seg.so 改无 WBI 直连**：实测 `/x/v2/dm/web/seg.so` 无需 w_rid/wts 即可正常返回（每段 50+ 条弹幕），移除 WBI 依赖；
- 弹幕数据仍以 XML 优先（list.so 全量单次、无 WBI，实测 2322 条）、seg.so 分段兜底。

## 3. 评论/投稿/相关列表卡片底部与视频信息底部齐平

**根因**：`.bili-player-side` 固定 `max-height: 54vh` 且自身滚动，左右分栏底部错位（左侧视频+信息栏更高时，右侧列表底部悬空）。

**修复**（BiliBiliPanel.vue CSS）：
- `.bili-player-body` 改 `align-items: stretch`——右侧栏高度与左侧 main 等高；
- `.bili-player-side` 移除 `max-height` 与自身滚动，滚动下沉到 `.bili-side-content`（`overflow-y: auto`）；
- `.bili-section` 移除独立 max-height，由内容区统一滚动，卡片列表高度随左侧伸展、底部齐平。

## 验证

- `npm run build` 退出码 0；`vue-tsc --noEmit` 仅 2 个预存无关错误，零新增；
- 主进程产物：含 `x/v2/dm/web/seg.so`（无 WBI），旧 `wbi/web/seg.so` 已不存在；
- 渲染产物：含降清重构文案（`保持当前清晰度`/`清理历史缓冲后等待消耗`）与侧栏对齐 CSS（`align-items:stretch`）；
- 行为实测（node 直连 B 站）：无 WBI seg.so 每段解析 52/57/50 条 ✓、XML list.so 2322 条 ✓。

> 说明：弹幕时序 bug 为代码级回归，已静态修复并验证产物；播放降清为 MSE 配额管理重构，理论上不再发生自动降清（清晰度仅受服务端可用档位限制）。
