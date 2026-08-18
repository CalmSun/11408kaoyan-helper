# 11408 考研助手 v3.6.2 更新概述

本次迭代（覆盖更新）：**侧栏列表高度 63vh→51vh（内容内部滚动）**、**修复部分视频"一直跳开头"**。

## 1. 侧栏列表高度 51vh + 内容内部滚动

- `.bili-player-side` 的 `max-height` 由 **63vh → 51vh**；
- 滚动由侧栏自身（`overflow-y: auto`）**下沉到内容区 `.bili-side-content`（`overflow-y: auto`）**——UP 主卡片（sticky 固定顶部）与 Tab 切换栏不随列表滚动，列表内容在内部独立滚动。

## 2. 修复部分视频"一直跳开头"（进度续播链路加固）

### 根因分析
自动续播（v3.6.2 新增）在**部分视频**上形成"每次打开都跳回开头"的恶性循环，三层防线缺失：
1. **seek 失败被浏览器 clamp/回退**：DASH 模式下 seek 到未缓冲远处时，MSE 缓冲不足会将 `currentTime` 拉回 0~10s 的小值；
2. **小值被写回进度**：`onVideoSeeking`/`onVideoTick` 会把回退后的小值（如 3s）写进 localStorage，覆盖原正常进度；
3. **下次打开按小值恢复** → 又 seek 失败 → 又覆盖 → 永远跳开头。

### 修复（三层防线，仅改 BiliBiliPanel.vue）
1. **保存阈值**：`saveBiliProgress` 仅保存 `time > 10s`（与 `loadBiliProgress` 的 >10s 恢复阈值一致）——seek 失败回退的小值不再落盘；
2. **前进保护**：`onVideoTick` 保存前比对已存进度，`currentTime` 大幅回退（< 上次保存 -5s）时**跳过保存**；用户手动拖动进度条仍走 `onVideoSeeking` 正常保存；
3. **seek 校验 + 放弃**：`restoreBiliProgress` 移除重复 `loadStream()`（分 P 由 `playVideo` 统一恢复，消除二次加载竞态）；seek 后 5s 校验 `currentTime` 是否到达目标，未到达仅告警并**保持自然播放、绝不二次 seek**（原进度保留，下次可再尝试）。

### 行为模拟验证（node，6 项断言全 PASS）
- seek 失败回退 3s 不覆盖 600s 进度 ✓
- 正常前进 620s 保存 ✓
- 异常回退 100s 不覆盖 ✓
- 手动 seek 到 30s 保存 ✓
- 拖动到 5s（<10s 阈值）不保存 ✓
- restore seek 后校验通过 ✓

## 3. 验证与发布

- `npm run build` 退出码 0；`vue-tsc` 仅 2 个预存无关错误（ElMessage / pomodoro），零新增；
- 产物核查：侧栏 `max-height:51vh`、`bili-side-content` 滚动、进度防覆盖特征（`放弃续播`）均已编入；
- 版本号 **3.6.2**（package.json 保持），提交并推送 main + 重建 tag `v3.6.2` 触发 CI。

---

### 历史（v3.6.2 前序轮次）

#### 侧栏列表高度增至 1.5 倍 + 移除弹幕 + 进度保存续播（571dd00）
- 侧栏 42vh → 63vh；彻底移除弹幕功能（渲染层/主进程/preload/类型全清理，净删约 360 行）；新增 B 站视频观看进度保存/续播（localStorage `kaoyan_bili_progress_v1`，节流 5s + 关闭即时存 + 分 P 与 seek 恢复）。

#### 弹窗关闭 Assignment to constant variable（5046309）
- 弹幕 rAF 循环生命周期缺陷修复（卸载前停止）；弹幕层宽 0 兜底；侧栏缩短 max-height:42vh。

#### 弹幕 rAF 像素驱动重构（55d6003）
- 弹幕彻底改 rAF 像素驱动（不依赖 WAAPI）；分 P 条移至弹窗底部使侧栏与信息栏底部齐平。

#### 弹幕时序 bug + 降清移除（d31723c）
- 先挂载再启动动画；seg.so 无 WBI 直连；自动降清彻底移除（MSE evict + 不覆盖用户清晰度选择）。
