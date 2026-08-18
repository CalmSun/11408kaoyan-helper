# 11408 考研助手 v3.6.2 更新概述

本次迭代（覆盖更新）：**修复拖动进度条仍重置 + appendBuffer 报错**、**移动播放悬浮窗口卡片（右移）**、**模式切换按钮上移至顶栏同一行**、**优化高清晰度视频播放卡顿**、**修复切换按钮位置漂移**、**缩短推荐/热门卡片高度**、**视频信息缓存加速二次起播**、**封面图片异步解码**、**修复流拉取 502 与播放自动停止**。

## 1. 修复拖动进度条报错 `SourceBuffer has been removed` 与仍重置到开头

### 根因
拖动进度条超出缓冲时触发 `seekDashIfNeeded` 重启拉流管道（stopDash 销毁旧 MediaSource + startDash 新建），存在两类竞态：
1. **旧 pumpTrack 竞态 append**：旧管道 `reader.read()` resolve 出数据后，若未检查 abort 就 `appendBuffer` 到**已从 MediaSource 移除的 SourceBuffer** → 抛 `InvalidStateError: This SourceBuffer has been removed from the parent media source` → 被 pumpTrack catch 显示为"视频流加载失败…"错误页（用户实测报错）；
2. **连续快速拖动并发重启**：多次 `seekDashIfNeeded` 并发，`pendingSeekSec` 模块变量互相覆盖、旧管道覆盖新管道 → 播放头被重置到开头/管道错乱。

### 修复（全链路防护，仅改 BiliBiliPanel.vue）
| 防线 | 实现 |
|---|---|
| **append 竞态静默** | `appendWithQuotaGuard`：abort 后直接返回；catch 中 `InvalidStateError`/`InvalidAccessError`/`AbortError`（管道替换类）**一律静默返回**，不再向 UI 报错；`pumpTrack` 的 `reader.read()` 返回后、evict 前、append 后均加 abort 检查；pumpTrack catch 同样静默管道替换类错误 |
| **并发重启序列防护** | `seekDashIfNeeded` 增加 `dashRestartSeq` 序列号：每次重启递增，`getPlayurlCached` 完成后若序列已过期（期间用户又拖了）→ **丢弃本次重启**，防止旧管道覆盖新管道 |
| **seek 目标显式传递** | `startDash` 增加 `seekSecOverride` 参数（seekDashIfNeeded 显式传目标），`pendingSeekSec` 仅作默认——并发重启互不污染 |
| **就绪轮询绑定管道** | `scheduleSeekAfterReady` 绑定本管道的 SourceBuffer/MediaSource，旧管道轮询因 `ms !== mediaSource` 直接退出，不误 seek |
| **Range 失败回退** | Range 分支（HEAD/init/seg）任一失败 → try/catch **静默回退从头拉取**，不抛错不显示错误页 |

## 2. 移动播放悬浮窗口卡片（右移）

- **修正对象**：用户所指"播放卡片"是**播放视频时的悬浮窗口卡片**（el-dialog 播放器弹窗），而非整个 B 站面板——此前误将右移加在面板上，本轮撤销。
- **撤销**：`.bili-host` 的 `padding-left: 160px`（面板右移）已移除；`.bili-panel` 的 `flex: 0 1 auto` 还原为 `flex: 1`。
- **正确实现**：`.bili-player-dialog { margin-left: 160px; }`——播放悬浮窗（el-dialog，`align-center` + `append-to-body` + `width: min(1400px, 96vw)`）默认视口居中，`margin-left: 160px` 使其**中心相对视口水平中心右移约 80px**；用 margin 而非 transform，避免与 el-dialog 打开动画（zoom-in）的 transform 冲突。

## 3. 模式切换按钮上移至顶栏同一行

- "本地资料 / 哔哩哔哩"切换按钮从独立一行（原 `.materials-mode-bar`）**上移并入 `.materials-header`**，与"学习资料"标题、选择资料文件夹按钮、刷新按钮**同一行**（header 为 `flex + space-between`：标题左、切换按钮中、操作按钮右）；
- 移除 `.materials-mode-bar` 模板与 CSS；`.materials-mode-switch` 加 `flex-shrink: 0` 防压缩；`.materials-body` 高度由 `calc(100% - 70px)` 收紧为 `calc(100% - 56px)`（让出原 mode-bar 行的高度）。

## 4. 优化高清晰度视频播放卡顿

高清晰度（1080P+）卡顿的三个主要来源与优化（仅改 BiliBiliPanel.vue）：

| 优化项 | 内容 |
|---|---|
| **轨道选择优先 H.264 + 低码率** | `pickDashTrack`：同清晰度下**优先 avc1（H.264，Electron Chromium 硬件解码）**轨道，规避 hev/av1 软解卡顿；组内取**带宽最低**的轨道，降低缓冲/网络压力（仍是该清晰度） |
| **缓冲水位按清晰度自适应** | 新增 `applyBufferWatermark(qn)`：qn≥80（1080P+）用**低水位 18s/8s**（高码率下 30s 缓冲会快速打满 MSE 配额，频繁 Quota 清理/重拉是高清卡顿主因）；低清晰度保持 30s/12s 保证流畅；`loadStream` 获取可播放清晰度后调用 |
| **append 流水线化** | `appendWithQuotaGuard`：`appendBuffer` 后**不再等待 updateend**——SourceBuffer 内部队列自动串行，下次 append 前的 `sb.updating` 检查处理排队；QuotaExceededError 由 appendBuffer 同步抛出不影响配额保护；大 chunk 连续追加吞吐显著提升 |

## 5. 验证与发布

- `npm run build` 退出码 0；`vue-tsc` 仅 2 个预存无关错误（ElMessage / pomodoro），零新增；
- 行为模拟 24 项断言全 PASS：并发重启序列（慢旧丢弃/快新应用/串行应用）、append 竞态静默分类（abort/InvalidState/Quota/网络错误）、read 后 abort 提前返回、Range 失败回退、就绪轮询管道绑定、轨道选择（同 qn 优先 avc 低带宽/无 avc 选 hev 低带宽/无匹配 qn 选 avc）、水位自适应（1080P+ 低水位 18/8、低清 30/12）；
- 产物核查：面板右移特征（`padding-left:160px`）**已消失**、悬浮窗右移（`margin-left:160px`）已编入、`InvalidStateError` 静默防护已编入、`materials-mode-bar` 已移除、`calc(100% - 56px)` 已生效、`avc1` 轨道选择特征已编入；
- 版本号 **3.6.2**，提交并推送 main + 重建 tag `v3.6.2` 触发 CI。

## 6. 本轮追加修复（2026-08-18）

| 项目 | 内容 |
|---|---|
| **切换按钮位置固定** | `.materials-header` 由 `flex + space-between` 改为三列 `grid`（标题居左 / 切换按钮居中 / 文件夹·刷新按钮居右）；bili 模式下 `.materials-actions` 由 `v-show`（`display:none`）改为 `visibility: hidden` 占位——旧实现会在 actions 隐藏后把切换按钮挤到最右，造成切换本地/哔哩时位置漂移，现固定不动 |
| **缩短卡片高度** | `.bili-card-info` padding `8/10 → 6/8`、`.bili-card-title` min-height `36 → 34`、`.bili-card-meta` margin-top `6 → 4`，个性推荐/热门推荐卡片整体更紧凑（两行标题仍完整显示） |
| **二次起播加速** | 新增 `getViewCached`：`biliView` 结果缓存 5 分钟 TTL（LRU 上限 40 条），配合已有 playurl 10 分钟缓存，重开同一视频免重复请求 |
| **图片异步解码** | 推荐/热门/收藏/搜索封面与投稿/相关缩略图 `img` 加 `decoding="async"`，减少 24 张卡片同时解码造成的主线程卡顿 |

验证：`vite build` 到临时目录 `✓ built`；`vue-tsc` 仅 2 个预存无关错误（main.ts ElMessage / stores pomodoro），改动文件零新增错误。

## 7. 修复"流拉取失败（HTTP 502）"与"播放自动停止"（2026-08-18 晚）

| 项目 | 根因 | 修复 |
|---|---|---|
| **HTTP 502 报错** | `startDash` 只用 `vTrack.baseUrl` 单个 CDN 地址拉流，B 站备用 CDN（`backupUrl`）从未使用；主节点 502/被限流时无备用可切，`pumpTrack` 直接抛"流拉取失败（HTTP 502）" | `startDash` 收集 `[baseUrl, ...backupUrl]` 全部候选地址并逐一签发代理 token；`pumpTrack` 阶段一按候选地址**轮换**——非 2xx 或网络异常自动 `continue` 切下一个，全部失败才报错 |
| **播放自动停止** | DASH 流播放中 CDN 连接被掐断：`reader.read()` 提前返回 `done` 或抛 `TypeError`，旧逻辑一律按"自然结束"或"加载失败"处理 → `endOfStream()` 后视频停住 / 直接弹错误页 | ① 读取中断（`.catch` 捕获网络错误）→ 触发 `recoverDashStream()` 续播；② `done` 时对比已知时长（`durationSec`），未播到末尾判定为提前断流 → 同样触发续播；③ `recoverDashStream()` 复用 Range 重启（`startDash(..., currentTime)`）从断点续播，带 `dashRecoverySeq` 并发防护 + 30 秒内限 5 次防网络持续抖动无限重启 |
| **管道替换竞态防护** | 备用地址轮换期间可能发生 `appendBuffer` 到已移除 SourceBuffer | 阶段一 catch 中 `InvalidStateError/InvalidAccessError/AbortError` 静默返回；`QuotaExceededError` 透传外层配额恢复，不在此换地址 |

验证：`vite build` 到临时目录 `✓ built in 35.49s`；`vue-tsc` 改动文件零新增错误（仅 2 个预存无关错误）。

---

### 历史（v3.6.2 前序轮次）

- **appendBuffer removed 根治 + 播放卡片右移（已修正为悬浮窗）**（523066d）
- **侧栏 58vh 滚动修复 + 拖动 Range 定位 + playurl 缓存 + 卡片居中**（ccc9564）
- **侧栏 63→51vh 内部滚动 + 修复"一直跳开头"**（9c32dee）
- **侧栏 1.5 倍 + 移除弹幕 + 进度保存续播**（571dd00）
- **弹窗关闭 Assignment to constant variable**（5046309）
- **弹幕 rAF 像素驱动重构**（55d6003）；**弹幕时序 bug + 降清移除**（d31723c）
