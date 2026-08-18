# v3.5.4 更新：B 站视频一键三连 + 个性化推荐 + 播放器弹窗体验优化

## 新功能：视频交互与个性化推荐

在 v3.5.3 哔哩哔哩集成基础上，补齐视频互动能力与推荐体验，全部沿用主进程 API 代理模式（渲染层零新依赖）。

### 功能清单
| 功能 | 说明 |
|---|------|
| 点赞 / 取消点赞 | `web-interface/archive/like`（POST + csrf=bili_jct），按钮实时回显已点赞态 |
| 投币（1/2 个） | `web-interface/web/coin/add`，下拉选择投币数，已投满 2 币自动拦截 |
| 收藏 / 取消收藏 | `v3/fav/resource/deal` 收藏至默认收藏夹（收藏夹列表首项），成功提示目标收藏夹名 |
| 交互状态查询 | `web-interface/archive/relation` 打开视频时异步查询点赞/投币/收藏状态，未登录静默降级为默认态 |
| 个性化推荐 | `web-interface/wbi/index/top/feed/rcmd`（WBI 签名：nav 获取 img_key/sub_key → 混排表 → md5，密钥缓存 30 分钟），过滤直播与商业推广；登录后按兴趣个性化 |
| 页签体系 | 「个性推荐 / 热门推荐 / 收藏夹 / 搜索结果」四页签，默认进入个性推荐 |

### 播放器弹窗体验优化
- 弹窗宽度 920px → 1080px，改用 `align-center` 屏幕水平垂直居中
- 相关视频限制展示 8 条并紧凑化卡片（minmax 150px / 字号缩小），弹窗不再被过度拉长
- 播放信息栏下新增点赞 / 投币 / 收藏胶囊按钮栏，玻璃拟态风格与整体一致

### 界面布局统一
- 「本地资料 / 哔哩哔哩」模式切换从头部右侧移出，独立成行水平居中，两种模式下位置统一

## 改动文件
- `src/main/main.ts`（biliPost / WBI 签名 / bili:rcmd / bili:relation / bili:like / bili:coin / bili:fav-toggle，crypto 导入）
- `src/preload/preload.ts`（bili* 桥接新增 5 项，共 17 项）
- `src/renderer/src/vite-env.d.ts`（新增 5 个 bili* 类型声明）
- `src/renderer/src/components/BiliBiliPanel.vue`（推荐页签 / 交互按钮 / 弹窗居中增大 / 相关视频紧凑化）
- `src/renderer/src/views/Materials.vue`（模式切换栏居中，本地逻辑未动）
- `package.json`（3.5.3 → 3.5.4，输出目录 release-v354）、`README.md`（版本徽章 / 功能说明）

## 验证
- `npm run build` 构建通过（vite + tsc 主进程编译）
- 本地资料功能回归核查：Materials.vue 仅移动模式切换 DOM 位置并新增居中样式，文件树 / PDF / 视频逻辑零改动
- 已有功能（网易云 / 天气 / 更新 / 本地播放）无任何改动路径

## 发布
- 版本号 3.5.4，打 tag `v3.5.4` 推送触发 CI 自动构建 Windows 安装包
