import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MCP_TOOLS } from './tools.js';
import { sessionManager } from '../services/SessionManager.js';
import { AgentBrowserAdapter } from '../services/AgentBrowserAdapter.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

/**
 * MCP Server 实现 (HTTP Transport)
 * 遵循 MCP 协议规范，通过 HTTP 提供工具调用能力
 */

interface MCPRequest {
    jsonrpc: '2.0';
    id?: string | number;
    method: string;
    params?: any;
}

interface MCPResponse {
    jsonrpc: '2.0';
    id?: string | number;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}

export async function mcpRoutes(fastify: FastifyInstance) {
    // 鉴权 Hook
    fastify.addHook('preHandler', async (req, reply) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || authHeader !== `Bearer ${config.API_KEY}`) {
            reply.status(401).send({
                jsonrpc: '2.0',
                error: { code: -32000, message: 'Unauthorized' }
            });
            throw new Error('Unauthorized');
        }
    });

    // MCP 端点：处理所有 MCP 请求
    fastify.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
        const mcpReq = req.body as MCPRequest;

        logger.info('[MCP] 收到请求', { method: mcpReq.method, id: mcpReq.id });

        try {
            let result: any;

            switch (mcpReq.method) {
                case 'initialize':
                    result = {
                        protocolVersion: '2024-11-05',
                        capabilities: {
                            tools: {}
                        },
                        serverInfo: {
                            name: 'agent-browser-service',
                            version: '1.0.0'
                        }
                    };
                    break;

                case 'notifications/initialized':
                    return reply.status(204).send();

                case 'tools/list':
                    result = { tools: MCP_TOOLS };
                    break;

                case 'tools/call':
                    result = await handleToolCall(mcpReq.params);
                    break;

                default:
                    throw { code: -32601, message: `未知方法: ${mcpReq.method}` };
            }

            const response: MCPResponse = {
                jsonrpc: '2.0',
                id: mcpReq.id,
                result,
            };

            return response;
        } catch (error: any) {
            logger.error('[MCP] 请求处理失败', { error: error.message, method: mcpReq.method });

            const response: MCPResponse = {
                jsonrpc: '2.0',
                id: mcpReq.id,
                error: {
                    code: error.code || -32603,
                    message: error.message || '内部错误',
                    data: error.data,
                },
            };

            reply.status(error.code === -32601 ? 404 : 500);
            return response;
        }
    });
}

/**
 * 处理工具调用
 */
async function handleToolCall(params: any): Promise<any> {
    const { name, arguments: args } = params;

    logger.info('[MCP] 工具调用', { tool: name, args });

    switch (name) {
        case 'session_create':
            return await toolSessionCreate();

        case 'session_close':
            return await toolSessionClose(args.session_id);

        case 'page_open':
            return await toolPageOpen(args.session_id, args.url);

        case 'page_snapshot':
            return await toolPageSnapshot(args.session_id);

        case 'page_click':
            return await toolPageClick(args.session_id, args.ref);

        case 'page_fill':
            return await toolPageFill(args.session_id, args.ref, args.text);

        case 'page_press':
            return await toolPagePress(args.session_id, args.key);

        case 'page_wait':
            return await toolPageWait(args.session_id, args.ms || 1000);

        default:
            throw { code: -32602, message: `未知工具: ${name}` };
    }
}

// 工具实现（复用现有逻辑）

async function toolSessionCreate() {
    const sessionId = await sessionManager.createSession();
    return { session_id: sessionId };
}

async function toolSessionClose(sessionId: string) {
    const result = await sessionManager.closeSession(sessionId);
    if (!result) {
        throw { code: -32602, message: '会话不存在' };
    }
    return { ok: true };
}

async function toolPageOpen(sessionId: string, url: string) {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
        throw { code: -32602, message: '会话不存在' };
    }

    await AgentBrowserAdapter.goto(session.id, session.profileDir, url);
    await session.page.waitForTimeout(500);
    const title = await session.page.title();
    return { ok: true, url: session.page.url(), title };
}

async function toolPageSnapshot(sessionId: string) {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
        throw { code: -32602, message: '会话不存在' };
    }

    const filterMode = config.SNAPSHOT_FILTER_MODE;
    const depth = config.SNAPSHOT_MAX_DEPTH;

    const { snapshot, refMap } = await AgentBrowserAdapter.snapshot(
        session.id,
        session.profileDir,
        { mode: filterMode, depth }
    );
    session.refMap = refMap;
    return snapshot;
}

async function toolPageClick(sessionId: string, ref: string) {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
        throw { code: -32602, message: '会话不存在' };
    }

    await AgentBrowserAdapter.click(session.id, session.profileDir, ref);
    return { ok: true };
}

async function toolPageFill(sessionId: string, ref: string, text: string) {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
        throw { code: -32602, message: '会话不存在' };
    }

    await AgentBrowserAdapter.fill(session.id, session.profileDir, ref, text);
    return { ok: true };
}

async function toolPagePress(sessionId: string, key: string) {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
        throw { code: -32602, message: '会话不存在' };
    }

    await session.page.keyboard.press(key);
    return { ok: true };
}

async function toolPageWait(sessionId: string, ms: number) {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
        throw { code: -32602, message: '会话不存在' };
    }

    await session.page.waitForTimeout(ms);
    return { ok: true };
}
