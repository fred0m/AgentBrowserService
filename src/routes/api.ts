import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { sessionManager } from '../services/SessionManager.js';
import { AgentBrowserAdapter } from '../services/AgentBrowserAdapter.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

// 鉴权中间件验证逻辑 (在路由 handler 中调用，或注册为 hook)
const verifyAuth = (req: FastifyRequest, reply: FastifyReply) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${config.API_KEY}`) {
        reply.status(401).send({ ok: false, error: '鉴权失败: 无效的 API Key' });
        throw new Error('Unauthorized');
    }
};

export async function apiRoutes(fastify: FastifyInstance) {
    // 健康检查 (无需鉴权)
    fastify.get('/health', async () => {
        return { ok: true };
    });

    // 鉴权 Hook (除 health 外)
    fastify.addHook('preHandler', async (req, reply) => {
        if (req.routerPath === '/api/v1/health') return;
        try {
            verifyAuth(req, reply);
        } catch (e) {
            return; // verifyAuth 已经发送了 reply
        }
    });

    // 创建会话
    fastify.post('/sessions', async (req, reply) => {
        try {
            const sessionId = await sessionManager.createSession();
            return { ok: true, session_id: sessionId };
        } catch (error: any) {
            // 如果是并发限制，返回 429
            if (error.message.includes('限制')) {
                reply.status(429);
            } else {
                reply.status(500);
            }
            return { ok: false, error: error.message };
        }
    });

    // 关闭会话
    fastify.delete<{ Params: { id: string } }>('/sessions/:id', async (req, reply) => {
        const { id } = req.params;
        const result = await sessionManager.closeSession(id);
        if (!result) {
            reply.status(404);
            return { ok: false, error: '会话不存在或已关闭' };
        }
        return { ok: true };
    });

    // 页面打开
    const OpenPageSchema = z.object({
        session_id: z.string(),
        url: z.string().url(),
    });

    fastify.post('/page/open', async (req, reply) => {
        const body = OpenPageSchema.safeParse(req.body);
        if (!body.success) {
            reply.status(400);
            return { ok: false, error: '参数无效', details: body.error.format() };
        }

        const session = sessionManager.getSession(body.data.session_id);
        if (!session) {
            reply.status(404);
            return { ok: false, error: '会话不存在' };
        }

        try {
            logger.info(`[API] 正在打开页面`, { url: body.data.url, session_id: session.id });
            await AgentBrowserAdapter.goto(session.id, session.profileDir, body.data.url);

            // Wait a bit for page to load and get title
            await session.page.waitForTimeout(500);
            const title = await session.page.title();
            return { ok: true, url: session.page.url(), title };
        } catch (error: any) {
            logger.error(`[API] 页面打开失败`, { error: error.message, session_id: session.id });
            reply.status(500);
            return { ok: false, error: `打开页面失败: ${error.message}` };
        }
    });

    // 页面快照
    const SnapshotSchema = z.object({
        session_id: z.string(),
        mode: z.enum(['compact', 'text_only', 'actions_only']).default('compact'),
    });

    fastify.post('/page/snapshot', async (req, reply) => {
        const body = SnapshotSchema.safeParse(req.body);
        if (!body.success) {
            reply.status(400);
            return { ok: false, error: '参数无效', details: body.error.format() };
        }

        const session = sessionManager.getSession(body.data.session_id);
        if (!session) {
            reply.status(404);
            return { ok: false, error: '会话不存在' };
        }

        try {
            // 根据配置模式获取快照
            const mode = config.SNAPSHOT_FILTER_MODE;
            const depth = config.SNAPSHOT_MAX_DEPTH;

            const { snapshot, refMap } = await AgentBrowserAdapter.snapshot(
                session.id,
                session.profileDir,
                { mode, depth }
            );

            // 更新会话的 RefMap
            session.refMap = refMap;

            return snapshot;
        } catch (error: any) {
            logger.error(`[API] 快照失败`, { error: error.message, session_id: session.id });
            reply.status(500);
            return { ok: false, error: `获取快照失败: ${error.message}` };
        }
    });

    // 交互接口 Schema
    const InteractSchema = z.object({
        session_id: z.string(),
        ref: z.string().optional(),
        text: z.string().optional(),
        key: z.string().optional(),
        ms: z.number().optional(),
    });

    // 验证 Session 和 Ref
    const getSessionAndSelector = (sessionId: string, ref?: string) => {
        const session = sessionManager.getSession(sessionId);
        if (!session) throw new Error('Session not found');

        let selector = '';
        if (ref) {
            selector = session.refMap.get(ref) || '';
            if (!selector) throw new Error(`Ref '${ref}' not found (expired or invalid)`);
        }
        return { session, selector };
    };

    // Click
    fastify.post('/page/click', async (req, reply) => {
        const body = InteractSchema.parse(req.body);
        try {
            const session = sessionManager.getSession(body.session_id);
            if (!session) throw new Error('Session not found');
            if (!body.ref) throw new Error('Ref is required for click');

            logger.info(`[API] Click`, { ref: body.ref, session_id: session.id });
            await AgentBrowserAdapter.click(session.id, session.profileDir, body.ref);
            return { ok: true };
        } catch (error: any) {
            reply.status(error.message.includes('not found') ? 404 : 500);
            return { ok: false, error: error.message };
        }
    });

    // Fill
    fastify.post('/page/fill', async (req, reply) => {
        const body = InteractSchema.parse(req.body);
        try {
            const session = sessionManager.getSession(body.session_id);
            if (!session) throw new Error('Session not found');
            if (!body.ref || body.text === undefined) throw new Error('Ref and text are required for fill');

            logger.info(`[API] Fill`, { ref: body.ref, text: body.text, session_id: session.id });
            await AgentBrowserAdapter.fill(session.id, session.profileDir, body.ref, body.text);
            return { ok: true };
        } catch (error: any) {
            reply.status(error.message.includes('not found') ? 404 : 500);
            return { ok: false, error: error.message };
        }
    });

    // Press
    fastify.post('/page/press', async (req, reply) => {
        const body = InteractSchema.parse(req.body);
        try {
            const session = sessionManager.getSession(body.session_id);
            if (!session) { reply.status(404); return { ok: false, error: 'Session not found' }; }
            if (!body.key) throw new Error('Key is required for press');

            logger.info(`[API] Press`, { key: body.key, session_id: session.id });
            await session.page.keyboard.press(body.key);
            return { ok: true };
        } catch (error: any) {
            reply.status(500);
            return { ok: false, error: error.message };
        }
    });

    // Wait
    fastify.post('/page/wait', async (req, reply) => {
        const body = InteractSchema.parse(req.body);
        try {
            const session = sessionManager.getSession(body.session_id);
            if (!session) { reply.status(404); return { ok: false, error: 'Session not found' }; }

            const ms = body.ms || 1000; // default 1s
            logger.info(`[API] Wait`, { ms, session_id: session.id });
            await session.page.waitForTimeout(ms);
            return { ok: true };
        } catch (error: any) {
            reply.status(500);
            return { ok: false, error: error.message };
        }
    });
}
