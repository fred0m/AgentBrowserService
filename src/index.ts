import Fastify, { FastifyInstance } from 'fastify';
import { config } from './config.js';
import { apiRoutes } from './routes/api.js';
import { mcpRoutes } from './mcp/server.js';
import { sessionManager } from './services/SessionManager.js';
import { logger } from './utils/logger.js';

const fastify: FastifyInstance = Fastify({
    logger: false, // 禁用 Fastify 自带日志，使用我们的 logger
});

// 注册 API 路由
fastify.register(apiRoutes, { prefix: '/api/v1' });

// 注册 MCP 路由
fastify.register(mcpRoutes, { prefix: '/mcp' });

// 启动服务
const start = async () => {
    try {
        await fastify.listen({ port: config.PORT, host: config.HOST });
        logger.info(`[启动] 服务已启动`, { host: config.HOST, port: config.PORT, data_dir: config.DATA_DIR });
        logger.info(`[配置] 配置加载完成`, { max_sessions: config.MAX_SESSIONS, ttl_sec: config.SESSION_TTL_SEC });
    } catch (err: any) {
        logger.error(`[启动] 服务启动失败`, { error: err.message });
        process.exit(1);
    }
};

// 优雅退出
const shutdown = async (signal: string) => {
    logger.info(`[退出] 收到信号，正在关闭服务`, { signal });
    await sessionManager.closeAll();
    await fastify.close();
    process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
