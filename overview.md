# v3.5.3 更新：学习资料页集成哔哩哔哩（登录 / 收藏夹 / 搜索 / 热门推荐 / 视频播放）

## 新功能：哔哩哔哩在线学习视频（学习资料页）

学习资料页顶栏新增「本地资料 / 哔哩哔哩」胶囊模式切换，B 站能力以独立组件 `BiliBiliPanel.vue` 集成，
与本地文件浏览完全解耦：本地资料 DOM/逻辑零改动（仅外层 v-show 切换显隐），PDF 阅读器与本地视频播放器实例在模式切换时保活不中断。

### 功能清单
| 功能 | 说明 |
|---|------|
| 扫码登录 | `passport-login/web/qrcode/generate` + `poll` 轮询（2s 间隔，180s 过期自动提示刷新），成功后解析 Set-Cookie 与 crossDomain url 凭证 |
| Cookie 登录 | 粘贴浏览器 Cookie（需含 SESSDATA），nav 接口校验后持久化 |
| 登录态持久化 | Cookie 存于 userData `bilibili-cookies.json`，重启自动恢复；支持退出登录 |
| 收藏夹 | `v3/fav/folder/created/list-all` 文件夹列表 + `v3/fav/resource/list` 分页内容（过滤失效资源） |
| 视频搜索 | `web-interface/search/type`（自动经 `frontend/finger/spi` 领取 buvid3/buvid4 防 -412 风控），结果剥离关键词高亮 HTML |
| 热门推荐 | `web-interface/popular` 热门视频，"换一批"随机跳页 + 加载更多 |
| 视频播放 | `web-interface/view`（分 P / 数据）+ `player/playurl`（fnval=1 durl 合并流）：分 P 切换、清晰度选择（accept_quality 映射中文标签）、多分段自动连播、备用 CDN 失败自动切换 |
| 相关视频 | `archive/related` 播放弹窗内推荐，点击直接换播 |
| 防盗链 | 主进程 `session.webRequest.onBeforeSendHeaders` 仅对 B 站媒体 CDN 域（hdslb/bilivideo/bilivod/akamaized/bcdn）注入 Referer + UA，渲染层 `<video>` 直连 CDN，无代理中转开销 |

### 风格与性能
- 卡片/工具栏/弹窗全部复用全局液态玻璃 CSS 变量（--glass-* / --mo-*），深浅主题与护眼模式自动适配
- B 站面板懒挂载：首次切入「哔哩哔哩」才创建组件并请求数据，未使用时零网络/零内存开销；之后 v-show 保活，播放不被打断
- 封面图 `loading="lazy"`；相关推荐异步加载不阻塞起播；请求全部主进程代理，渲染进程不引入任何新依赖

## 改动文件
- `src/main/main.ts`（bilibili API 代理段 + CDN 请求头注入 + session 导入）
- `src/preload/preload.ts`（bili* 桥接 12 项）
- `src/renderer/src/vite-env.d.ts`（BiliVideo / BiliUser / bili* 类型）
- `src/renderer/src/components/BiliBiliPanel.vue`（新增）
- `src/renderer/src/views/Materials.vue`（模式切换 + 面板挂载，本地逻辑未动）
- `package.json`（3.5.2 → 3.5.3，输出目录 release-v353）、`README.md`（版本/功能/目录说明）

## 验证
- `npm run build` 退出码 0（vite 5085 模块 + tsc 主进程编译通过），dist/main/main.js 确认含 bili:* 全部 handler 与 onBeforeSendHeaders
- 本地资料功能回归核查：Materials.vue 文件树/预览/视频逻辑无改动，仅新增外层显隐切换
- 已有功能（网易云/天气/更新/PDF 预览）无任何改动路径

## 发布
- 版本号 3.5.3，打 tag `v3.5.3` 推送触发 CI 自动构建 Windows 安装包
