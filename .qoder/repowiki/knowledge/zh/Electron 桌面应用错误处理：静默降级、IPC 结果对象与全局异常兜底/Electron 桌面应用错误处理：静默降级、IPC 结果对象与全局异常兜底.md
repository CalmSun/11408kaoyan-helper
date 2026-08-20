---
kind: error_handling
name: Electron 桌面应用错误处理：静默降级、IPC 结果对象与全局异常兜底
category: error_handling
scope:
    - '**'
source_files:
    - src/main/main.ts
    - src/preload/preload.ts
    - src/renderer/src/utils/storage.ts
    - src/renderer/src/utils/weather.ts
    - ref-api/util_request.js
---

## 1. 整体策略

本仓库是一个基于 Vue 3 + Electron 28 的桌面应用，**没有统一的错误类型体系或全局错误中间件**。错误处理以「局部 try/catch + 静默降级 + IPC 返回 `{success, message}` 结果对象」为主，主进程通过 `process.on('uncaughtException' / 'unhandledRejection')` 做全局兜底，避免崩溃弹窗。

核心原则（从代码行为可观察到的模式）：
- 非致命 I/O/网络失败一律吞掉并回退到默认值或旧数据，不中断用户流程。
- 所有跨进程的 IPC 调用统一返回结构化结果对象（`{ success: boolean, ... }`），渲染层据此判断成功/失败而非依赖抛出异常。
- 主进程对文件系统、协议处理器、托盘气泡等副作用操作使用 try/catch 包裹，失败时仅记录日志或忽略。
- 第三方 API（网易云、B站、天气）失败时保持 UI 展示上一帧数据，不清空状态。

## 2. 关键位置与文件

### 主进程全局异常兜底
- `src/main/main.ts` 第 8–14 行：注册 `uncaughtException` 和 `unhandledRejection`，仅 `console.error` 打印后继续运行，防止 Electron 弹出崩溃对话框。

### 文件系统与配置读写
- `src/main/main.ts` 中多处 `try/catch` 包裹 `fs.readFileSync`、`fs.existsSync`、`fs.mkdirSync`、`fs.writeFileSync`（如 `getDataDir`、`saveMusicFolder`、`loadMusicFolder`、`migrateLegacyDataFiles`、`loadNeteaseCookies`、`saveNeteaseCookies`）。失败时回退默认值或忽略，不影响启动。
- 自定义协议处理器（`protocol.handle('kaoyan-music'|'kaoyan-data'|'kaoyan-material'|'kaoyan-assets')`）在解析 URL、校验路径、读取文件时均用 try/catch，失败返回 HTTP 语义的 `Response('bad request', {status: 400})`、`forbidden (403)`、`not found (404)`。

### IPC 结果对象约定
- 所有 `ipcMain.handle` 回调统一返回 `{ success: boolean, canceled?: boolean, files?: any[], folder?: string, message?: string }` 形式的对象。例如：
  - `music:pick-folder` → `{ success, canceled, files }`
  - `materials:open-external` → `{ success, message }`
  - `open-external-url` → `{ success, message }`
  - `weather:current` / `weather:search` → `{ success, data/results }`
- 渲染层通过检查 `res.success` 分支处理，而不是捕获 Promise reject。

### 渲染层本地存储错误处理
- `src/renderer/src/utils/storage.ts`：
  - `lsSet` 写入 localStorage 失败时尝试 `cleanupOldData()` 清理旧数据后重试；仍失败则 `console.error` 并忽略。
  - `lsGet` / `lsDelete` 直接 try/catch 返回 null 或忽略。
  - `importAllData` 解析失败返回 `false`，由调用方决定提示。
  - 数据迁移 `runDataMigrations` 单个 key 迁移失败仅 `console.error` 并跳过该 key。
  - 启动时 `beforeunload` / `pagehide` 双保险 flush，确保退出前持久化。

### 网络请求错误处理
- `ref-api/util_request.js`（网易云 eapi/weapi 封装）：
  - axios 响应 `.then` 内 try/catch 解密/解析 body，失败时把原始 body 放入 `answer.body`，`answer.status` 设为 `res.status`。
  - 特殊状态码集合 `SPECIAL_STATUS_CODES = new Set([201,302,400,502,800,801,802,803])` 被归一化为 200。
  - `.catch(err)` 统一设置 `status=502`、`body={code:502,msg}` 后 reject。
  - 上层模块通过检查 `answer.code` / `answer.status` 判断业务错误，而非抛 JS Error。
- 主进程内置网易云 eapi 请求（`neteaseEapiRequest`）使用 `fetch`，未看到显式 `.catch`，但调用处（`ipcMain.handle('netease:*')`）外层有 try/catch 包裹，失败返回 `{success:false,message}`。

### 渲染层业务错误处理
- `src/renderer/src/utils/weather.ts`：`fetchWeather` 调用 `window.electronAPI.weatherCurrent`，失败时 catch 为空（静默），保留上次缓存的天气数据；fallback 到 `wttr.in` 浏览器接口，`!res.ok` 直接 return。
- 其他 store 组件（`stores/music.ts`、`stores/pomodoro.ts`、`stores/user.ts`）遵循相同模式：调用 IPC 后检查 `res.success`，失败时不清空状态、不中断流程。

### B站集成
- `preload.ts` 暴露 `biliQrKey` / `biliQrCheck` / `biliLoginStatus` / `biliLogout` / `biliSearch` / `biliView` / `biliPlayurl` 等 IPC 方法，错误处理同样依赖主进程返回的结果对象。

## 3. 架构与约定

| 层级 | 错误形式 | 处理方式 |
|---|---|---|
| 主进程全局 | `uncaughtException` / `unhandledRejection` | `console.error` 后继续运行 |
| 主进程 I/O | `try/catch` 包裹 fs/协议处理 | 失败返回 4xx Response 或忽略 |
| IPC 边界 | 统一返回 `{success,...}` 对象 | 渲染层按字段判断 |
| 渲染层本地存储 | try/catch + 容量不足自动清理 | 降级为内存缓存，丢失即丢弃 |
| 渲染层网络 | try/catch + 保留旧数据 | 静默失败，UI 不闪烁 |
| 第三方 API | 检查 `answer.code/status` | 业务错误归一化为 code |

## 4. 约束与规则（从实现可验证）

1. **IPC 调用禁止 throw**：所有 `ipcMain.handle` 必须返回 `{success:boolean,...}` 对象，渲染层通过 `res.success` 分支，而非 `.catch` 捕获异常（见 `main.ts` 中所有 handle 实现及 `preload.ts` 暴露的 API 契约）。
2. **文件系统操作必须 try/catch**：任何 `fs.*` 调用都包裹在 try/catch 中，失败时回退默认值或忽略，不得让异常冒泡到主进程事件循环（见 `getDataDir`、`migrateLegacyDataFiles`、协议处理器等）。
3. **自定义协议必须返回 HTTP 语义 Response**：`protocol.handle` 对非法路径返回 403，不存在返回 404，格式错误返回 400，保证渲染端能区分错误原因。
4. **localStorage 写入失败必须降级**：`storage.ts` 在写入失败时先尝试 `cleanupOldData()` 再写一次，仍失败则记录日志并忽略，不允许阻塞主流程。
5. **网络失败不得清空 UI 状态**：`weather.ts` 明确注释“失败：保留旧展示，不清空”，此模式被渲染层各工具函数复用。
6. **主进程崩溃弹窗必须禁用**：通过 `uncaughtException` / `unhandledRejection` 监听并仅输出日志，这是 v3.1.2 引入的强制行为（见文件顶部注释）。
7. **无全局错误类/错误码枚举**：仓库未定义统一的 `AppError`、`ErrorCode` 等类型，错误信息以字符串形式在 `{message}` 字段传递。
8. **无 `throw` 作为正常控制流**：搜索渲染层与主进程业务代码未发现将 `throw new Error(...)` 用于业务分支控制的用法，错误均以返回值表达。

## 5. 缺失与风险

- 没有集中式错误日志上报或用户可见的错误提示框架，大部分错误仅 `console.error` 或静默忽略，用户无法感知。
- 未使用 `errorBoundary`（Vue 3 可通过插件实现）捕获组件级渲染异常。
- `ref-api/util_request.js` 是独立 npm 包（网易云增强版），其错误模型（`answer.code`）与主进程自建 eapi 不一致，存在两套错误约定并存。
- 未使用 TypeScript 的 `Result<T,E>` 或 `Either` 类型来强制调用方处理错误，`success` 字段靠约定而非类型系统保障。
