# 11408 考研助手 v3.5.8 更新概述

本次迭代聚焦 B 站播放器的播放稳定性修复与播放卡片信息架构重构。

## 1. SourceBuffer 配额中断修复（多级自愈）

v3.5.7 的单缓冲区清理在部分高码率长视频上仍会触发「视频流加载失败：The SourceBuffer is full」。v3.5.8 改为多级自愈：

- **收紧缓冲水位**：超前缓冲上限 90s → 60s、恢复阈值 45s → 30s，从源头降低配额压力；
- **全缓冲区联合清理**：注册音视频全部 SourceBuffer，QuotaExceededError 时逐段移除所有缓冲区中播放点前 10s 以外的历史区间（含碎片区间），重试次数提升至 3 次；
- **durl 直链回退**：多次清理仍失败时静默回退 durl 合并流（playurl 新增 `preferDurl` 参数，fnval=1），播放不中断、不向用户报错。

## 2. 取消收藏无效果修复

- 根因：取消收藏只从渲染层传入的默认收藏夹移除，而视频实际可能收藏在其他收藏夹中，`resource/deal` 对未命中的收藏夹不产生效果；
- 修复：主进程取消收藏前先经 `x/v3/fav/resource/favinfo` 查询视频实际所在的全部收藏夹，`del_media_ids` 传入全部命中 ID 一次性移除；
- 渲染层补充：操作成功 1 秒后、以及失败时，重新查询 relation 实际状态，杜绝按钮与服务端状态脱节。

## 3. 播放卡片信息架构重构

- **卡片增大**：弹窗宽度 min(1320px, 96vw) → min(1400px, 96vw)，视频区获得更大显示面积；
- **视频简介**：右侧栏 UP 卡片下方新增简介区块（可滚动，保留换行格式）；
- **作者卡片改造**：不再显示投稿数，改为「粉丝数 + 查看投稿/收起投稿按钮」；
- **左图右文**：作者投稿与相关视频不再使用大封面网格，改为左缩略图（92×54）右标题/元信息的紧凑行卡；
- **评论区**：新增主进程 `bili:reply`（`x/v2/reply` 热评优先、每页 10 条），播放卡片右侧展示评论头像/昵称/内容/点赞数，支持分页加载更多；
- **侧栏再紧凑**：宽度 264 → 246px，最大高度 58vh → 54vh，行距与卡片内边距进一步收缩；窄窗口（≤1100px）自动降级为上下堆叠。

## 4. 弹幕拉取健壮性加固

- 根因排查：渲染层渲染链路（行内样式 + 全局 keyframes）已验证无异常，看不到弹幕的根因在主进程拉取环节——`list.so` 部分节点返回 gzip/deflate 压缩体且自动解压不可靠，导致解析结果为 0 条；
- 修复：改用 `arrayBuffer` + 按 `Content-Encoding` 手动解压（gzip / deflate / raw-deflate 逐级兜底）后再解析；XML 标签正则放宽为兼容单双引号与额外属性；
- 双源兜底：主接口 `list.so` 无结果时自动回退 `comment.bilibili.com/{cid}.xml`。

## 改动文件

- `src/main/main.ts`：playurl preferDurl、fav-toggle favinfo 查询、弹幕手动解压 + 备用域名、新增 bili:reply；
- `src/preload/preload.ts`：biliPlayurl 增加 preferDurl 参数、新增 biliReply；
- `src/renderer/src/vite-env.d.ts`：BiliReply 类型、biliReply/biliPlayurl 签名更新；
- `src/renderer/src/components/BiliBiliPanel.vue`：DASH 多级自愈与 durl 回退、收藏状态复查、右侧栏重构（简介/左图右文/评论区/作者卡片改造）、样式紧凑化；
- `package.json` / `README.md` / `overview.md`：版本与文档。

## 验证

- `npm run build` 通过（仅剩 2 个与本次无关的遗留 TS 提示：main.ts ElMessage、stores/index.ts pomodoro settings）；
- 已有功能（推荐 / 热门 / 收藏夹 / 搜索 / 分 P / 清晰度切换 / 点赞投币收藏 / 弹幕开关 / 登录）行为不变。

## 发布

- commit → tag `v3.5.8` → push origin main + tag，发布至 GitHub（CalmSun/11408kaoyan-helper）。
