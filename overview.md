# 11408 考研助手 v3.6.2 更新概述

本次迭代（覆盖更新）：**修复拖动进度条仍重置 + appendBuffer 报错**、**移动播放悬浮窗口卡片（右移）**、**模式切换按钮上移至顶栏同一行**。

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

## 4. 验证与发布

- `npm run build` 退出码 0；`vue-tsc` 仅 2 个预存无关错误（ElMessage / pomodoro），零新增；
- 行为模拟 16 项断言全 PASS：并发重启序列（慢旧丢弃/快新应用/串行应用）、append 竞态静默分类（abort/InvalidState/Quota/网络错误）、read 后 abort 提前返回、Range 失败回退、就绪轮询管道绑定；
- 产物核查：面板右移特征（`padding-left:160px`）**已消失**、悬浮窗右移（`margin-left:160px`）已编入、`InvalidStateError` 静默防护已编入、`materials-mode-bar` 已移除、`calc(100% - 56px)` 已生效；
- 版本号 **3.6.2**，提交并推送 main + 重建 tag `v3.6.2` 触发 CI。

---

### 历史（v3.6.2 前序轮次）

- **appendBuffer removed 根治 + 播放卡片右移（已修正为悬浮窗）**（523066d）
- **侧栏 58vh 滚动修复 + 拖动 Range 定位 + playurl 缓存 + 卡片居中**（ccc9564）
- **侧栏 63→51vh 内部滚动 + 修复"一直跳开头"**（9c32dee）
- **侧栏 1.5 倍 + 移除弹幕 + 进度保存续播**（571dd00）
- **弹窗关闭 Assignment to constant variable**（5046309）
- **弹幕 rAF 像素驱动重构**（55d6003）；**弹幕时序 bug + 降清移除**（d31723c）
