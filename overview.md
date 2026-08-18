# 11408 考研助手 v3.6.1 更新概述

本次迭代聚焦 B 站板块五项遗留问题：**投币点击 404**、**取消收藏未真正移除**、**弹幕仍无法显示**、**长视频自动降清**、**播放卡片居中与侧栏卡片尺寸**。

## 1. 投币按钮点击提示 404（URL 路径错误，根治）

**根因**：主进程投币接口 URL 写成了 `https://api.bilibili.com/x/web-interface/web/coin/add`，比官方路径 `x/web-interface/coin/add` **多了一个 `web/` 段**，B 站返回 HTTP 404，前端提示"投币失败: bilibili HTTP 404"。

**修复**（src/main/main.ts）：URL 修正为 `https://api.bilibili.com/x/web-interface/coin/add`，参数（aid/multiply/select_like/csrf）不变。

## 2. 取消收藏后未从默认收藏夹移除（favinfo 参数错误 + deal 空值占位）

**根因**（两点叠加）：
1. `favinfo` 查询接口参数名写错：官方为 **`rid`**（稿件 avid），旧代码用了 `oid`，导致查询始终拿不到视频实际所在收藏夹列表，删除目标不可靠；
2. `deal` 接口不操作的一侧传 `'0'` 占位，部分账号下被 B 站误判为"操作 id=0 的收藏夹"而静默失败（code=0 但实际未移除）。

**修复**（src/main/main.ts）：
- `favinfo?oid=` → `favinfo?rid=`（官方参数名）；
- 取消收藏时**合并去重**：`Set` 合并 favinfo 返回的真实收藏夹 ID 与传入的默认收藏夹 mediaId，确保目标收藏夹一定被移除；
- `add_media_ids`/`del_media_ids` 不操作的一侧改为**空字符串**（官方抓包行为），不再用 `'0'` 占位。

## 3. 弹幕仍无法显示（seg.so 优先策略不合理 + CSS 动画不可靠）

**根因**（实测验证）：
- 实测 `list.so` XML 接口一次返回**全量**弹幕（样例视频 2322 条），而 seg.so 每段仅约 50 条、长视频需 WBI 拉取最多 40 段，慢且易被风控/超时——v3.6.0 把 seg.so 设为优先导致弹幕迟迟不返回；
- 渲染层弹幕动画依赖 CSS keyframes 全局注入，在弹窗 teleport + scoped 样式 + 系统"减少动态效果"（prefers-reduced-motion）下 animation 可能不执行，弹幕元素停留在屏幕外被兜底移除 → "看不到弹幕"。

**修复**：
- **主进程**（src/main/main.ts）：弹幕改为 **XML 优先、seg.so 补充**——先 `list.so`（全量单次、无 WBI），空则 `comment.bilibili.com/{cid}.xml`，仍空才走 seg.so 分段兜底；
- **渲染层**（BiliBiliPanel.vue）：`spawnDanmaku` 改用 **Web Animations API（element.animate）** 驱动滚动/淡出动画，不依赖 CSS keyframes，规避 scoped/teleport/reduced-motion 导致的动画不执行；保留 setTimeout 兜底移除防 DOM 泄漏；移除已无引用的 `ensureDmKeyframes`。

## 4. 长视频自动降低清晰度（配额不足即降清 + 缓冲水位过高）

**根因**：`pumpTrack` 拉流遇 MSE `QuotaExceededError` 时**立即** `switchQuality(80→64→48)` 逐级降清；长视频缓冲大、码率高，配额频繁打满，表现为"看一会清晰度就掉"。

**修复**（BiliBiliPanel.vue）：
- 缓冲水位收紧：`DASH_BUFFER_AHEAD` 45→30、`DASH_BUFFER_RESUME` 20→12，降低配额压力；
- 配额不足时**不再立即降清**：先激进清理全部已播缓冲（保留播放点前 2s），等待 300ms 后**重试同清晰度**（重启 DASH 拉流），仅当同清晰度连续失败 3 次（低配设备/极高码率）才降一档（80→64→48，最低 480P），降清后重置计数。

## 5. 播放卡片居中 + 评论/投稿/相关卡片适度增长（布局）

- `.bili-panel` 增加 `max-width: 1560px; margin: 0 auto`——面板整体在"学习资料"板块中水平居中，播放卡片不再贴左；
- `.bili-player-side` 宽度 246→280px，评论/投稿/相关列表获得更宽展示区；
- `.bili-row-card`：缩略图 92×54 → **112×63**（16:9）、内边距/间距/字号整体放大（标题 12→13px、meta 10→11px）；
- `.bili-reply-item`：头像 28→34px、内边距 7 8 → 9 10、间距 6→8。

## 验证

- `npm run build`（vite build + tsc）退出码 0；`vue-tsc --noEmit` 仅 2 个预存无关错误（main.ts ElMessage、stores pomodoro 类型），零新增；
- 产物核查：`dist/main/main.js` 含修正后的 `x/web-interface/coin/add`（错误 URL 已不存在）、`favinfo?rid=`；Materials chunk 含降清重试逻辑；pdfjs 资源 169 cmaps + 16 字体完整；
- 行为实测：B 站弹幕 XML 接口解析 2322 条 ✓、seg.so protobuf 解析 52 条/段 ✓（接口链路验证）。

> 说明：投币/收藏为登录态接口，无法在无 Cookie 环境端到端实测；修复依据 bilibili-API-collect 官方文档（fav/list.md favinfo 参数 rid、coin/add 路径）与抓包行为（deal 空值占位）。
