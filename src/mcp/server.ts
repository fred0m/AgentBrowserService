import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MCP_TOOLS } from './tools.js';
import { sessionManager } from '../services/SessionManager.js';
import { SnapshotSerializer } from '../services/SnapshotSerializer.js';
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
    // MCP 端点：处理所有 MCP 请求
    fastify.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
        const mcpReq = req.body as MCPRequest;

        logger.info('[MCP] 收到请求', { method: mcpReq.method, id: mcpReq.id });

        try {
            let result: any;

            switch (mcpReq.method) {
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
            return await toolPageSnapshot(args.session_id, args.mode || 'compact');

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

    await session.page.goto(url, { waitUntil: 'domcontentloaded' });
    const title = await session.page.title();
    return { ok: true, url: session.page.url(), title };
}

async function toolPageSnapshot(sessionId: string, mode: 'compact' | 'text_only' | 'actions_only') {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
        throw { code: -32602, message: '会话不存在' };
    }

    const { snapshot, refMap } = await SnapshotSerializer.capture(session.page, session.id, mode);
    session.refMap = refMap;
    return snapshot;
}

async function toolPageClick(sessionId: string, ref: string) {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
        throw { code: -32602, message: '会话不存在' };
    }

    const selector = session.refMap.get(ref);
    if (!selector) {
        throw { code: -32602, message: `Ref '${ref}' 未找到或已过期` };
    }

    await session.page.click(selector);
    return { ok: true };
}

async function toolPageFill(sessionId: string, ref: string, text: string) {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
        throw { code: -32602, message: '会话不存在' };
    }

    const selector = session.refMap.get(ref);
    if (!selector) {
        throw { code: -32602, message: `Ref '${ref}' 未找到或已过期` };
    }

    await session.page.fill(selector, text);
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
