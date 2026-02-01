# Browser Agent Service (交互式浏览器 Agent 服务)

[English Version](./README_EN.md) | 中文版


这是一个可在 Docker 中稳定运行的“交互式浏览器 Agent 服务”，专为 LLM Agent 设计。它基于 Playwright 实现，支持会话隔离、省 Token 的紧凑快照（Compact Snapshot）以及基于引用（Ref）的交互操作。

同时提供 **HTTP API** (OpenAPI) 和 **MCP** (Model Context Protocol) 两种调用方式，方便接入 Dify或其他 Agent 平台。

## 特性

- **会话隔离**: 每个会话拥有独立的 User Data Dir (Cookie, LocalStorage 等互不干扰)。
- **省 Token**: 页面快照经过清洗和压缩，自动提取交互元素并分配短 ID (Ref, 如 `a1`, `i2`)，大幅减少 LLM 上下文消耗。
- **持久化**: 浏览器会话状态保存在 `/data` 目录，支持服务重启后恢复。
- **双协议支持**:
  - HTTP API: `POST /api/v1/...`
  - MCP Server: `POST /mcp` (HTTP Transport)
- **工程化加固**:
  - 自动回收过期会话 (TTL)
  - 并发限制 (Max Sessions)
  - 结构化 JSON 日志
  - 严格限制资源 (1GB SHM, UID 1000)

## 分支说明

本项目目前维护两个主要分支，您可以根据需求选择：

| 分支 | 描述 | 适用场景 | Token 消耗 | 依赖 |
| :--- | :--- | :--- | :--- | :--- |
| **`main`** | 使用原生 Playwright 实现，稳定且依赖少 | 通用开发，需要完全控制浏览器行为 | 中等 | `playwright` |
| **`feature/agent-browser-integration`** | 集成 Vercel `agent-browser` 库，深度优化 AI 交互 | **AI Agent 生产环境**，对 Token 成本敏感 | **极低** (-75%) | `agent-browser` |

> **差异点**：`feature/agent-browser-integration` 分支引入了独立的 CLI 进程和更激进的快照清洗策略（默认为 `interactive` 模式，仅保留交互元素），在大幅降低 Token 的同时，可能会丢失部分非交互性的页面细节。

## 技术栈

本项目站在巨人的肩膀上，主要依赖以下优秀的开源项目：

- **[Playwright](https://playwright.dev/)**: 强大的自动化浏览器控制引擎。
- **[agent-browser](https://github.com/vercel-labs/agent-browser)**: Vercel 开发的 AI Agent 浏览器自动化 CLI，用于优化快照和减少 Token 使用。
- **[Fastify](https://www.fastify.io/)**: 高性能、低开销的 Node.js Web 框架。
- **[Zod](https://zod.dev/)**: 类型安全的架构验证工具。

## 快速开始

### 前置要求
- Docker & Docker Compose
- 端口 `8000` 未被占用

### 启动服务

```bash
# 1. 克隆/下载项目
git clone <repo_url>
cd AgentBrowserService

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，修改 API_KEY 等配置
# nano .env

# 3. 启动 (首次启动会自动构建镜像)
docker compose up -d --build

# 4. 检查健康状态
curl http://127.0.0.1:8000/api/v1/health
# 输出: {"ok":true}
```

### 停止服务
```bash
docker compose down
```

## 配置说明

所有配置可以通过环境变量或 `.env` 文件管理，优先级以 `docker-compose.yml` 或宿主机环境变量为准：

| 变量名 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `API_KEY` | `testkey` | **[必填]** API 鉴权密钥 (Bearer Token) |
| `MAX_SESSIONS` | `2` | 最大并发会话数，超限返回 429 |
| `SESSION_TTL_SEC` | `900` | 会话无活动自动回收时间 (秒) |
| `SNAPSHOT_TEXT_MAX_CHARS` | `1200` | 快照中文本内容最大长度 |
| `SNAPSHOT_ACTIONS_MAX` | `60` | 快照中最大交互元素数量 |
| `SNAPSHOT_FILTER_MODE` | `interactive` | 快照过滤模式 (interactive/compact/full) |
| `SNAPSHOT_MAX_DEPTH` | `5` | 快照 DOM 树最大深度 |
| `LOG_LEVEL` | `info` | 日志级别 (debug, info, warn, error) |

## 数据卷 (Volumes)

服务**必须**挂载 `/data` 目录以保证会话持久化和功能正常：
- `./data:/data`: 宿主机目录映射到容器数据目录。
- 容器内以用户 `1000:1000` 运行，请确保宿主机 `./data` 目录具备相应权限（通常无需额外操作，服务会自动尝试创建）。

## 接口文档

- **HTTP API**: 详见 [docs/API.md](docs/API.md)
- **Dify / MCP 集成**: 详见 [docs/DIFY_INTEGRATION.md](docs/DIFY_INTEGRATION.md)

## 故障排查

### 1. 启动失败或浏览器崩溃
**表现**: `Target closed` 或 `Browser closed unexpectedly`。
**原因**: 共享内存不足。
**解决**: 确保 `docker-compose.yml` 中配置了 `shm_size: 1gb` (或 `docker run --shm-size=1g`)。

### 2. 权限问题
**表现**: `EACCES: permission denied`。
**原因**: 容器以 UID 1000 运行，无法写入挂载的卷。
**解决**: 
```bash
chown -R 1000:1000 ./data
```

### 3. API 调用 401 Unauthorized
**原因**: 未提供正确的 API Key。
**解决**: Header 中必须包含 `Authorization: Bearer <API_KEY>`。

### 4. 429 Too Many Requests
**原因**: 达到 `MAX_SESSIONS` 限制。
**解决**: 调用 `DELETE /api/v1/sessions/{id}` 清理旧会话，或调大 `MAX_SESSIONS` 配置。
