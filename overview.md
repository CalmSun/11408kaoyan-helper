# 11408 考研助手 v3.6.2 更新概述

本次迭代（覆盖更新）：**侧栏 58vh + 列表滚动修复**、**修复拖动进度条重置到开头**、**播放响应/流畅性优化**、**播放卡片中心对齐切换按钮**。

## 1. 侧栏列表高度 51vh → 58vh + 修复列表无法滚动

- `.bili-player-side` 的 `max-height` 由 51vh → **58vh**；
- **滚动失效根因**：旧实现滚动在 `.bili-side-content`（`overflow-y:auto`），但内部 `.bili-section { flex:1 }` 被拉伸填满容器高度 → side-content 无溢出内容 → 无滚动条；而 section 自身 `overflow:hidden` 把超长列表直接裁剪掉 → "列表内容无法滚动且被截断"。
- **修复**：`.bili-side-content` 自身不滚（`overflow:hidden`），**滚动下沉到每个 `.bili-section`（`overflow-y:auto`）**——section 被 flex 约束到内容区高度，内部列表溢出时在 section 内滚动，UP 主卡片（sticky）与 Tab 栏固定不动。

## 2. 修复拖动播放进度条重置到开头（核心）

### 根因（两条链路叠加）
1. **超缓冲 seek 无管道追位**：DASH 是单文件流、pumpTrack 顺序拉取。拖动到未缓冲的远处（如 30 分钟处）时，MSE seek 后只能等拉流从 0 顺序推进到目标——长时间 waiting，且旧管道在 seek 后 append 乱序数据，浏览器易把播放头重置到开头；
2. **restore 竞态**：打开视频后 restore 轮询有 12s 窗口，若用户在此窗口内拖动进度条，restore 的 `el.currentTime = saved.time` 会覆盖用户拖动（看起来"跳回开头"）。

### 修复
| 项 | 内容 |
|---|---|
| **Range 定位拉流** | `pumpTrack` 增加 `startSec` 参数：先 `HEAD` 拿总大小 → 拉头部 2MB init segment（fMP4 moov/init）→ 按 `时间比例 × 总大小 × 0.95` 计算字节偏移，`Range: bytes=offset-` 拉取目标附近数据（主进程流代理已透传 Range/206）。seek 超缓冲时立即命中目标，不再从 0 追赶 |
| **seek 重启管道** | `onVideoSeeking` → `seekDashIfNeeded()`：目标在缓冲内 → 浏览器原生处理；超出缓冲 → `stopDash` + 重新 `startDash`（携带 `pendingSeekSec`）→ 数据就绪后 `scheduleSeekAfterReady` 自动定位 |
| **restore 竞态消除** | 新增 `userSeeked` 标记：用户一旦手动 seek，restore 的 trySeek 直接跳过，绝不覆盖用户操作 |
| **进度防覆盖**（上轮已有） | 保存 >10s 阈值 + 回退不覆盖 + seek 后校验放弃，三重防线保留 |

## 3. 播放响应速度与流畅性优化

- **播放地址缓存**：`getPlayurlCached`（key = bvid:cid:qn:preferDurl，TTL 10 分钟，上限 40 条）——重开视频、切清晰度、seek 重启管道、配额恢复时免重复请求 playurl，起播/恢复响应显著加快（loadStream、seekDashIfNeeded、pumpTrack 配额恢复分支均走缓存）；
- 音视频双轨道并发拉流（原有）+ Range 定位（新）保证拖动后流畅衔接。

## 4. 播放卡片中心对齐"本地资料/哔哩哔哩"切换按钮

- Materials.vue 为 BiliBiliPanel 增加 `.bili-host` 宿主：`display:flex; justify-content:center`——面板内容水平中心与顶栏切换按钮（同容器 `justify-content:center` 居中）**严格对齐**；
- 播放弹窗（el-dialog）本就 `align-center + append-to-body + width:min(1400px,96vw)` 视口居中，与切换按钮中心一致。

## 5. 验证与发布

- `npm run build` 退出码 0；`vue-tsc` 仅 2 个预存无关错误（ElMessage / pomodoro），零新增；主进程编译通过；
- 行为模拟 14 项断言全 PASS：Range 偏移计算（含 0.95 保守前移与 clamp）、seek 决策（缓冲内不干预/超缓冲重启）、playurl 缓存 TTL、userSeeked 竞态；
- 产物核查：`max-height:58vh`、`.bili-section` 内部滚动、`bytes=0-2097151`（Range init）、`重启拉流管道`/`超出缓冲`/`已定位到` 特征、`.bili-host` 均已编入；
- 版本号 **3.6.2**，提交并推送 main + 重建 tag `v3.6.2` 触发 CI。

---

### 历史（v3.6.2 前序轮次）

- **侧栏 63→51vh 内部滚动 + 修复"一直跳开头"**（9c32dee）：进度续播三层防线（保存 >10s 阈值/回退不覆盖/seek 后校验放弃）。
- **侧栏 1.5 倍 + 移除弹幕 + 进度保存续播**（571dd00）：彻底移除弹幕（净删约 360 行）；新增观看进度保存/续播。
- **弹窗关闭 Assignment to constant variable**（5046309）：弹幕 rAF 循环生命周期修复；侧栏 max-height:42vh。
- **弹幕 rAF 像素驱动重构**（55d6003）；**弹幕时序 bug + 降清移除**（d31723c）。
