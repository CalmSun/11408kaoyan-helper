# 11408 考研助手 v3.5.9 更新概述

本次迭代聚焦三大核心问题：长视频清晰度被限制在 720p、取消收藏无效、弹幕不显示。

## 1. 长视频 720p 限制解除（v3.5.8 回退链误伤）

**根因**：v3.5.8 引入的 durl 直链回退机制（`fnval=1`）导致部分长视频被 B 站强制限至 720p，因为 durl 合并流与 DASH fMP4 流的清晰度供给策略不一致。

**修复策略**：
- **始终走 fnval=4048**：废弃 preferDurl 参数与 tryDashFallback 回退链，playurl 请求固定使用 DASH 模式；
- **预清理历史缓冲**：起播前对全部 SourceBuffer 移除过去 10s 以内的碎片区间，降低配额压力；
- **收紧缓冲水位**：超前上限 60→45s、恢复阈值 30→20s，进一步从源头降耗；
- **降清重试**：QuotaExceededError 多次失败后，自动切换清晰度重跑（qn 80→48→32），避免中断播放；
- **渲染层控制流**：pumpTrack 增加 qn 参数传递，触发 switchQuality 降级并重试，错误提示保留。

## 2. 取消收藏仍无效（favinfo 字段兼容）

**根因**：B 站 favinfo 返回结构可能为 `media_list` 或 `collection_list`，前者每元素含 `id`，后者有时为 `vid`，原有单字段映射无法覆盖全量场景。

**修复**：
- 主进程优先查询 `collection_list`，其次 `media_list`，双字段兼容 (`f.id || f.vid`)；
- 过滤 isNaN/id ≤ 0 非法 ID，确保删除列表有效；
- 控制台输出解析到的收藏夹数量便于排查。

## 3. 弹幕仍不显示（压缩体识别 + 空列表重试 + 调试信息）

**根因**：部分 CDN 节点返回 gzip / deflate / compress / identity 等压缩体且自动解压不可靠，导致 xml 解析结果为 0 条；list.so 接口与 XML 备份域名均可能出现假阴性。

**修复**：
- 主进程 `fetchBiliDanmakuXml` 扩展支持 `compress` / `identity` 头识别，gzip 用 gunzipSync，deflate/compress 用 inflateSync → inflateRawSync 兜底；
- `bili:danmaku` 接口逻辑调整：先 list.so，若无结果再试 comment.bilibili.com/{cid}.xml；两次均为空也返回 success=true+空列表（调用方自行判断）；
- 渲染层 `loadDanmaku` 改为 ref<BiliDanmaku[]>，统一响应式，并在控制台输出"CID xx: 解析到 xx 条弹幕”；
- DM_MAX_VISIBLE 由 80 放宽至 200，避免高负载下误删真实弹幕；
- `spawnDanmaku` 控制台输出"渲染 X 号模式条弹幕，当前可见数：N”，便于实时定位渲染层是否收到条目；
- keyframes 全局注入（ensureDmKeyframes）+ 行内样式组合，确保弹窗 teleport 后动画生效。

## 改动文件

- `src/main/main.ts`：playurl 始终 fnval=4048（废弃 preferDurl）、取消收藏双结构兼容、弹幕 compress/identity 解压与空列表重试；
- `src/renderer/src/components/BiliBiliPanel.vue`：preCleanBuffers 预清理缓冲、pumpTrack 降清重试参数化、DM_MAX_VISIBLE 放宽至 200、控制台输出条数与可见计数、ref 化 danmakuAll；
- `package.json` / `README.md` / `overview.md`：版本与文档。

## 验证

- `npm run build` 通过（遗留 TS 错误无新增）；
- 已有功能（推荐 / 热门 / 收藏夹 / 搜索 / 分 P / 清晰度切换 / 点赞投币收藏 / 弹幕开关 / 登录 / 评论区）行为不变；
- 控制台调试日志已开放，可在 DevTools 中观察“弹幕：解析条数 / 可见数”。

## 发布

- commit → tag `v3.5.9` → push origin main + tag，发布至 GitHub（CalmSun/11408kaoyan-helper）。
