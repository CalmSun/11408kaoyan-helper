---
kind: logging_system
name: 基于 console 的轻量日志输出（无结构化日志框架）
category: logging_system
scope:
    - '**'
source_files:
    - src/main/main.ts
    - src/preload/preload.ts
---

## 1. 使用的系统/方法

本仓库**没有引入任何第三方日志框架**（如 winston、pino、bunyan、debug 等），也没有自定义 logger 模块。主进程与渲染进程均直接使用 Node.js / Electron 内置的 `console` API 进行输出，属于最轻量的日志方式。

- 主进程 (`src/main/main.ts`)：使用 `console.error('[Main] ...')` 输出未捕获异常和错误；在文件写入失败等场景也通过 `console.error('Failed to save ...', err)` 记录错误。
- 渲染进程 (`src/renderer/src/**`)：未发现任何 `console.log/debug/info/warn/error` 调用，即前端侧完全无日志输出。
- preload (`src/preload/preload.ts`)：仅做 IPC 桥接，无日志。

## 2. 关键文件

- `src/main/main.ts`：唯一出现日志输出的文件，包含全局异常处理器与少量业务错误日志。
- `package.json`：依赖中不包含任何日志库（可确认无 winston/pino/bunyan/debug 等）。

## 3. 架构与约定

- **单点异常兜底**：应用启动时注册 `process.on('uncaughtException')` 与 `process.on('unhandledRejection')`，统一以 `console.error('[Main] uncaughtException/unhandledRejection: ...')` 形式输出到标准错误流，避免 Electron 主进程崩溃弹窗。
- **错误路径就地打印**：在 `saveMusicFolder`、`saveMaterialsFolder`、`music:read-lyric` 等 I/O 操作的 catch 分支中直接 `console.error` 打印错误信息，不向上抛出也不封装为结构化对象。
- **无日志级别管理**：没有 debug/info/warn/error 分级，全部走 `console.error`。
- **无结构化字段**：日志是拼接字符串（如 `'[Main] uncaughtException:', err.message`），不含 timestamp、pid、module、traceId 等结构化字段。
- **无 sink/输出目标配置**：所有日志默认输出到 Electron 控制台（开发模式下 DevTools + 终端 stderr），生产环境不可见，也无文件落盘或远程上报能力。
- **无跨进程聚合**：渲染进程完全不输出日志，主进程也不收集渲染进程日志，不存在跨进程日志通道。

## 4. 约定与约束

- **实际约束**：代码中未声明任何强制性的日志规范文档或 lint 规则；当前行为是“自然形成”的约定——仅在主进程的关键错误路径使用 `console.error`，且对未捕获异常做了统一兜底。
- **可观察到的模式**：
  - 所有日志均以 `console.error` 形式输出，未见 `console.log` 用于调试。
  - 主进程错误日志统一带 `[Main]` 前缀，便于区分来源。
  - 渲染进程零日志输出，排查问题主要依赖 Electron DevTools 控制台。
- **缺失的能力**：无日志级别开关、无结构化 JSON 日志、无文件 sink、无采样/限流、无敏感信息脱敏策略。