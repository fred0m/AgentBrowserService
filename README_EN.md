# Browser Agent Service (Interactive Browser Agent)

An "Interactive Browser Agent Service" designed for stable operation in Docker, specifically tailored for LLM Agents. Based on Playwright, it supports session isolation, token-saving compact snapshots, and reference (Ref) based interactions.

Provides both **HTTP API** (OpenAPI) and **MCP** (Model Context Protocol) for easy integration with Dify or other Agent platforms.

## Features

- **Session Isolation**: Each session has an independent User Data Dir (Cookies, LocalStorage separated).
- **Token Efficient**: Page snapshots are cleaned and compressed, automatically extracting interactive elements and assigning short Ref IDs (e.g., `a1`, `i2`) to significantly reduce LLM context consumption.
- **Persistence**: Browser session state is saved in the `/data` directory, supporting recovery after service restarts.
- **Dual Protocol Support**:
  - HTTP API: `POST /api/v1/...`
  - MCP Server: `POST /mcp` (HTTP Transport)
- **Engineering Hardening**:
  - Automatic reclamation of expired sessions (TTL).
  - Concurrency control (Max Sessions).
  - Structured JSON logging.
  - Strict resource constraints (1GB SHM, UID 1000).

## Tech Stack

This project is built on top of several amazing open-source projects:

- **[Playwright](https://playwright.dev/)**: Reliable end-to-end testing and automation for modern web apps.
- **[Fastify](https://www.fastify.io/)**: Fast and low overhead web framework for Node.js.
- **[Zod](https://zod.dev/)**: TypeScript-first schema declaration and validation library.

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Port `8000` available

### Start Service

```bash
# 1. Clone the repository
git clone <repo_url>
cd AgentBrowserService

# 2. Configure environment variables
cp .env.example .env
# Edit .env and modify API_KEY, etc.
# nano .env

# 3. Start (First start will automatically build the image)
docker compose up -d --build

# 4. Check health status
curl http://127.0.0.1:8000/api/v1/health
# Output: {"ok":true}
```

### Stop Service
```bash
docker compose down
```

## Configuration

All configurations are managed via environment variables or a `.env` file:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `API_KEY` | `testkey` | **[Required]** API Authentication key (Bearer Token) |
| `MAX_SESSIONS` | `2` | Maximum concurrent sessions, returns 429 if exceeded |
| `SESSION_TTL_SEC` | `900` | Session inactivity timeout (seconds) |
| `SNAPSHOT_TEXT_MAX_CHARS` | `1200` | Max length of text content in snapshots |
| `SNAPSHOT_ACTIONS_MAX` | `60` | Max number of interactive elements in snapshots |
| `LOG_LEVEL` | `info` | Log level (debug, info, warn, error) |

## Volumes

The service **must** mount the `/data` directory:
- `./data:/data`: Maps host directory to container data directory.
- The container runs as user `1000:1000`. Ensure the host `./data` directory has appropriate permissions.

## Documentation

- **HTTP API**: See [docs/API.md](docs/API.md)
- **Dify / MCP Integration**: See [docs/DIFY_INTEGRATION.md](docs/DIFY_INTEGRATION.md)

## Troubleshooting

### 1. Startup failure or browser crash
**Symptoms**: `Target closed` or `Browser closed unexpectedly`.
**Reason**: Insufficient shared memory.
**Solution**: Ensure `shm_size: 1gb` is configured in `docker-compose.yml`.

### 2. Permission issues
**Symptoms**: `EACCES: permission denied`.
**Reason**: Container running as UID 1000 cannot write to the mounted volume.
**Solution**: `chown -R 1000:1000 ./data`.

---

## License
MIT License. See [LICENSE](LICENSE) for details.
