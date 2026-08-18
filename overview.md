# 11408 考研助手 v3.6.2 更新概述

本次迭代：**侧栏列表高度增至 1.5 倍**、**彻底移除弹幕功能**、**新增 B 站视频观看进度保存/续播**。

## 1. 侧栏列表高度增至 1.5 倍

- `.bili-player-side` 的 `max-height` 由 **42vh → 63vh**（1.5 倍），评论/投稿/相关列表获得更大展示区，超长内容仍内部滚动。

## 2. 彻底移除弹幕功能

用户多轮反馈弹幕问题后决定**移除**。清理范围：
- **渲染层**（BiliBiliPanel.vue）：删除弹幕层 DOM、弹幕开关按钮、`loadDanmaku`/`spawnDanmaku`/`onDanmakuTick`/`startDmLoop`/`stopDmLoop`/`clearDanmakuLayer`/`onVideoSeeking`（弹幕版）等全部函数与状态、弹幕 CSS（`.bili-danmaku-layer`/`.bili-dm-toggle`）、`@timeupdate="onDanmakuTick"` 绑定、storage import；
- **主进程**（main.ts）：删除 `bili:danmaku` IPC handler、XML/seg.so 弹幕拉取与 protobuf 解析器、`decodeBiliXmlEntities`、zlib import；
- **preload / 类型**：删除 `biliDanmaku` 暴露与 `BiliDanmaku` 类型、`biliDanmaku` 方法声明；
- 保留：视频数据中的 `stat.danmaku`（弹幕数统计）等字段，属视频信息。

## 3. 新增 B 站视频观看进度保存 / 续播

- **保存**：播放中 `@timeupdate` 节流每 5 秒写入 `localStorage`（key `kaoyan_bili_progress_v1`，结构 `{ bvid: { pageIdx, time, updatedAt } }`，上限 200 条 LRU 淘汰）；关闭弹窗时立即保存当前进度；拖动进度条（`onVideoSeeking`）即时保存最新位置；
- **续播**：`playVideo` 打开视频时读取上次进度——上次停留在非第一 P 则自动切到该分 P 并重新加载流，随后等待 video 元数据就绪（`readyState>=1` 且 duration 有效，最多等待 12s）后 `seek` 到上次时间（距末尾 <5s 不跳，视为已看完）；
- 数据仅存本机 localStorage，不影响播放器/交互任何既有功能。

## 验证

- `npm run build`（vite build + tsc）退出码 0；`vue-tsc --noEmit` 仅 2 个预存无关错误，零新增；
- 主进程编译通过；产物核查：渲染层弹幕相关 0 残留、进度保存特征（`kaoyan_bili_progress_v1`/`已续播`）编入、侧栏 `max-height:63vh` 生效；
- 主进程残留 `danmaku` 均为视频数据字段（弹幕数统计），属视频信息，正确保留。
