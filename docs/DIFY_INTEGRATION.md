# Dify 集成指南

本服务提供两种方式接入 Dify：**OpenAPI (HTTP API)** 和 **MCP (Model Context Protocol)**。推荐根据您的 Dify 版本和偏好选择。

---

## 方式一：OpenAPI (推荐)

将服务作为标准的 API 工具接入 Dify。

### 1. 准备 OpenAPI Schema
您可以直接使用以下 JSON 定义（保存为 `openapi.json`），或根据 `docs/API.md` 自行编写。

*(此处提供一个简化的 Schema 示例，实际部署时可提供完整版)*
```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "Browser Agent Service",
    "version": "1.0.0"
  },
  "servers": [
    { "url": "http://<YOUR_HOST_IP>:8000/api/v1" }
  ],
  "components": {
    "securitySchemes": {
      "BearerAuth": {
        "type": "http",
        "scheme": "bearer"
      }
    }
  },
  "security": [{ "BearerAuth": [] }],
  "paths": {
    "/sessions": {
      "post": {
        "operationId": "createSession",
        "summary": "Create a new browser session",
        "responses": { "200": { "description": "OK" } }
      }
    },
    "/page/open": {
      "post": {
        "operationId": "openPage",
        "summary": "Open a URL",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "session_id": { "type": "string" },
                  "url": { "type": "string" }
                }
              }
            }
          }
        },
        "responses": { "200": { "description": "OK" } }
      }
    },
    "/page/snapshot": {
      "post": {
        "operationId": "getSnapshot",
        "summary": "Get compact page snapshot",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "session_id": { "type": "string" },
                  "mode": { "type": "string", "enum": ["compact", "text_only", "actions_only"] }
                }
              }
            }
          }
        },
        "responses": { "200": { "description": "OK" } }
      }
    },
    "/page/click": {
      "post": {
        "operationId": "clickElement",
        "summary": "Click an element by ref",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "session_id": { "type": "string" },
                  "ref": { "type": "string" }
                }
              }
            }
          }
        },
        "responses": { "200": { "description": "OK" } }
      }
    }
  }
}
```

### 2. 在 Dify 中添加工具
1. 进入 **工具 (Tools)** -> **自定义 (Custom)** -> **创建自定义工具 (Create Custom Tool)**。
2. **名称**: Browser Agent
3. **Schema**: 粘贴上面的 OpenAPI JSON。注意修改 `servers.url` 为您的服务实际地址（如果 Dify 也在 Docker 中，可能需要用宿主机 IP）。
4. **鉴权**:
   - 类型: `API Key`
   - Header: `Authorization`
   - Value: `Bearer <你的API_KEY>` (注意带 Bearer 前缀)

---

## 方式二：MCP (Model Context Protocol)

如果您的 Dify 版本支持 MCP (通过 HTTP Transport)，可直接配置 MCP Endpoint。

### 配置信息
- **Endpoint URL**: `http://<YOUR_HOST_IP>:8000/mcp`
- **Transport Type**: HTTP (SSE not supported yet, using JSON-RPC over HTTP)

### 可用 MCP 工具
成功连接后，Dify 将自动识别以下工具：

| 工具名称 | 功能 | 参数 |
| :--- | :--- | :--- |
| `session_create` | 创建会话 | 无 |
| `session_close` | 关闭会话 | `session_id` |
| `page_open` | 打开页面 | `session_id`, `url` |
| `page_snapshot` | 获取快照 | `session_id`, `mode` |
| `page_click` | 点击元素 | `session_id`, `ref` |
| `page_fill` | 填写输入 | `session_id`, `ref`, `text` |
| `page_press` | 按键 | `session_id`, `key` |
| `page_wait` | 等待 | `session_id`, `ms` |

---

## 典型工作流示例 (Workflow)

无论使用哪种方式，建议的 Agent 工作流如下：

1. **Start**: 接收用户指令（例如“查询 Google 关于 LLM 的最新消息”）。
2. **Tool Call**: `session_create()` -> 获取 `session_id`。
3. **Tool Call**: `page_open(session_id, "https://google.com")`。
4. **Tool Call**: `page_snapshot(session_id, "compact")` -> 获取页面内容和交互元素 Refs。
5. **LLM**: 分析快照，找到搜索框的 Ref (例如 `i1`)。
6. **Tool Call**: `page_fill(session_id, "i1", "LLM latest news")`。
7. **Tool Call**: `page_press(session_id, "Enter")`。
8. **Tool Call**: `page_wait(session_id, 2000)`。
9. **Tool Call**: `page_snapshot(session_id, "compact")` -> 获取搜索结果。
10. **LLM**: 总结结果并回答用户。
11. **Tool Call**: `session_close(session_id)` (可选，或依赖 TTL 自动回收)。
