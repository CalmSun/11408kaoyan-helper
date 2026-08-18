# v3.5.5 更新：DASH 高清晰度播放 + 弹幕显示与开关 + UP 主卡片投稿 + 推荐布局 4×6

## 新功能：高清晰度播放（DASH + MSE）

v3.5.4 之前播放走 `fnval=1` 合并流（durl），未登录 / 大会员最高仅 720P。本版升级为 DASH 音视频分离 + MSE 播放：

| 环节 | 实现 |
|---|---|
| playurl | `fnval=4048 & fourk=1`，返回 `dash.video / dash.audio` 分离 fMP4 轨道；无 DASH 时回退 durl 合并流，兼容不受影响 |
| 清晰度选择 | 清晰度下拉按视频轨 qn 生成（1080P 高码率 / 1080P60 / 4K 等大会员档位），切换即换轨重播 |
| MSE 播放引擎 | `MediaSource` + 双 `SourceBuffer` 流式 append；流控水位：缓冲超前 90s 暂停拉流、消耗至 45s 恢复，长视频不整段载入 |
| 回环流代理 | 渲染层 fetch CDN 有 CORS 限制，主进程新增 `127.0.0.1` 回环 HTTP 代理（token → CDN URL 内存映射，上限 64 FIFO），透传 Range、注入 UA/Referer/Origin，渲染层不接触真实 CDN 地址 |

## 新功能：弹幕显示与开关

- `x/v1/dm/list.so?oid=cid` XML 弹幕拉取（主进程正则解析，实体解码，上限 4000 条，按时间排序）
- video `timeupdate` 驱动补发区间弹幕，CSS 动画滚动；mode 4/5 顶底固定弹幕停留淡出；seek 二分重定位并清空重发；同屏上限 80 条
- 播放信息栏新增「弹幕开 / 弹幕关」胶囊按钮，开关偏好经 `kaoyan_bili_danmaku` 本地持久化；加载失败静默不影响播放

## 新功能：UP 主卡片与投稿播放

- `web-interface/card?mid=&photo=true` 获取 UP 主头像 / 昵称 / 签名 / 粉丝数 / 投稿数
- 播放弹窗交互栏下方展示 UP 主卡片，「查看投稿」展开 `space/wbi/arc/search`（WBI 签名）投稿列表，单行 6 列分页加载、点击直接播放

## 布局调整

- 个性推荐 / 热门推荐改为固定 **4 列 × 6 行**（每批 24 条），适配面板宽度；「换一批」经 `fresh_idx` 递增真刷新
- 播放弹窗相关视频只展示 **一行 6 条**（1×6），控制弹窗高度

## 改动文件
- `src/main/main.ts`（playurl DASH 模式 / `startBiliStreamProxy` 回环流代理 / `bili:stream-token` / `bili:danmaku` / `bili:card` / `bili:space-videos`，rcmd 加 fresh_idx，stream/Readable 导入）
- `src/preload/preload.ts`（新增 biliStreamToken / biliDanmaku / biliCard / biliSpaceVideos，rcmd 加 freshIdx）
- `src/renderer/src/vite-env.d.ts`（新增 BiliDashTrack / BiliDanmaku / BiliUpCard 类型，playurl 返回加 mode/dash）
- `src/renderer/src/components/BiliBiliPanel.vue`（4×6 网格 / 相关 1×6 / MSE DASH 引擎 / 弹幕层与开关 / UP 主卡片与投稿区 / 对应样式）
- `package.json`（3.5.4 → 3.5.5，输出目录 release-v355）、`README.md`（版本徽章 / 功能说明）

## 验证
- `npm run build` 构建通过（vite + tsc 主进程编译）
- durl 回退分支完整保留：DASH 不可用（版权受限 / 编码不支持）时自动走原合并流路径，播放能力不回退
- 弹幕 / UP 主卡片加载失败均静默降级，不影响播放主流程；本地资料与其他功能零改动

## 发布
- 版本号 3.5.5，打 tag `v3.5.5` 推送触发 CI 自动构建 Windows 安装包
