# 11408 考研助手 v3.6.0 更新概述

本次迭代聚焦四大核心问题：**长视频自动降清至 320p**、**取消收藏无效**、**弹幕不显示**、**右侧栏布局优化**。

## 1. 长视频自动降清修复（v3.6.0：最高带宽轨道选择）

**根因**：B 站部分长视频被限至 720p/480p，原有 `pickDashTrack` 按 qn 降序 fallback 导致选择高 qn 低带宽的不可用轨道，播放器最终退至 320p。

**修复**：
- `pickDashTrack` 优先选**带宽最大**的 DASH 轨道而非 Qn，避免“高 Qn 低带宽”坑；
- `loadStream` 起播时检测 `accept_quality` 中最高可用 Qn，若当前 Qn 高于此值则自动切换至最高可用；
- 控制台输出 `[自动降清] 当前 X → 最高可用 Y`，便于实时定位限制原因。

## 2. 取消收藏仍无效（双结构兼容 + 实际收藏夹查询）

**根因**：`favinfo` 返回可能为 `media_list` / `collection_list`，字段为 `id` 或 `vid`，原有单字段映射无法覆盖全量场景。

**修复**：
- 主进程依次查询 `collection_list` → `media_list`，支持 `f.id || f.vid` 双字段；
- 过滤非法 ID（isNaN/id≤0），确保删除列表有效；
- 控制台输出解析到的收藏夹数量便于排查。

## 3. 弹幕仍不显示（compress/identity 解压 + 空列表重试 + 控制台输出）

**根因**：CDN 节点返回 gzip/deflate/compress/identity 等压缩体且自动解压不可靠，`list.so` 与 XML 备份均可能出现假阴性。

**修复**：
- 主进程扩展 `fetchBiliDanmakuXml` 支持 `compress`/`identity` 头识别，gzip 用 `gunzipSync`，deflate/compress 兜底 `inflateRawSync`；
- `bili:danmaku` 逻辑调整：先 `list.so`，再 `comment.bilibili.com/{cid}.xml`，两次均为空也返回 `success=true+ 空列表`；
- 渲染层 `loadDanmaku` 统一响应式 `ref<BiliDanmaku[]>`，并在控制台输出"CID xx: 解析到 xx 条弹幕”；
- `DM_MAX_VISIBLE` 由 80 放宽至 200，避免高负载下误删真实弹幕；
- `spawnDanmaku` 控制台输出"渲染 X 号模式条弹幕，当前可见数：N”，便于实时定位渲染层是否收到条目；
- keyframes 全局注入 + 行内样式组合，确保弹窗 teleport 后动画生效。

## 4. 右侧栏布局重构（作者卡片固定顶部 + Tab 切换）

**根因**：原右侧栏所有内容独立滚动，UP 主信息易丢失；简介/投稿/相关/评论同时展示，占用大量空间。

**修复**：
- **作者卡片固定顶部**：`position: sticky` 固定，背景磨砂玻璃，不参与滚动；
- **Tab 切换三视图**：简介 / 投稿 / 相关视频 / 评论通过按钮切换，同一时间只显示其一；
- **作者按钮直接打开主页**：不再在侧栏展开投稿列表，改为新标签页跳转 `space.bilibili.com`；
- CSS 新增 `.bili-tabs`（四按钮横排）+ `.bili-section`（内容区独立滚动 + max-height）。

## 改动文件

- `src/main/main.ts`：取消收藏双结构兼容、弹幕 compress/identity 解压与空列表重试；
- `src/renderer/src/components/BiliBiliPanel.vue`：`pickDashTrack` 改带宽优先、`loadStream` 自动降清检测、右侧栏 Tab 切换 + 作者卡片固定、控制台输出调试信息；
- `package.json` / `README.md` / `overview.md`：版本升级至 3.6.0，补充发布说明。

## 验证

- `npm run build` 通过（遗留 TS 错误无新增）；
- 已有功能（推荐/热门/收藏夹/搜索/分 P/清晰度切换/点赞投币收藏/弹幕开关/登录/评论区）行为不变；
- 控制台已开放更多日志：`[自动降清]`、`[弹幕]`、解析条数、可见数、收藏解析列表。

## 发布

- commit → tag `v3.5.9` → push origin main + tag，发布至 GitHub（CalmSun/11408kaoyan-helper）。
