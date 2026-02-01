import { BrowserContext, Page } from 'playwright';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { BrowserFactory } from './BrowserFactory.js';
import fs from 'fs/promises';
import { logger } from '../utils/logger.js';

interface SessionData {
    id: string;
    context: BrowserContext;
    page: Page;
    refMap: Map<string, string>; // Ref -> Selector
    createdAt: number;
    lastActiveAt: number;
    profileDir: string;
}

export class SessionManager {
    private sessions: Map<string, SessionData> = new Map();
    private cleanupInterval: NodeJS.Timeout;

    constructor() {
        // 启动定期清理任务 (每10秒检查一次)
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredSessions();
        }, 10000);
    }

    /**
     * 清理过期会话
     */
    private async cleanupExpiredSessions() {
        const now = Date.now();
        const ttlMs = config.SESSION_TTL_SEC * 1000;

        for (const [id, session] of this.sessions.entries()) {
            if (now - session.lastActiveAt > ttlMs) {
                logger.info(`[自动回收] 会话已过期，正在关闭`, { session_id: id });
                await this.closeSession(id);
            }
        }
    }

    /**
     * 创建新会话
     */
    async createSession(): Promise<string> {
        // 检查并发限制
        if (this.sessions.size >= config.MAX_SESSIONS) {
            const msg = `达到最大会话数限制 (${config.MAX_SESSIONS})，请稍后再试`;
            logger.warn(msg);
            throw new Error(msg); // 必须包含特定关键词以便上层识别
        }

        const sessionId = `s_${uuidv4().slice(0, 8)}`; // 使用短 ID 方便阅读
        const profileDir = path.join(config.DATA_DIR, 'sessions', sessionId, 'profile');

        logger.info(`[会话管理] 创建会话`, { session_id: sessionId, profile_dir: profileDir });

        try {
            const context = await BrowserFactory.launchContext(profileDir);

            // 创建新页面或使用默认页面
            const pages = context.pages();
            const page = pages.length > 0 ? pages[0] : await context.newPage();

            const session: SessionData = {
                id: sessionId,
                context,
                page,
                refMap: new Map(),
                createdAt: Date.now(),
                lastActiveAt: Date.now(),
                profileDir,
            };

            this.sessions.set(sessionId, session);

            // 记录 meta 信息（可选）
            const metaPath = path.join(config.DATA_DIR, 'sessions', sessionId, 'meta.json');
            await fs.writeFile(metaPath, JSON.stringify({
                id: sessionId,
                createdAt: session.createdAt,
            })).catch(err => logger.error(`[会话管理] 写入 meta 失败`, { error: err.message }));

            return sessionId;
        } catch (error: any) {
            logger.error(`[会话管理] 创建会话失败`, { error: error.message });
            throw error;
        }
    }

    /**
     * 获取会话
     */
    getSession(sessionId: string): SessionData | undefined {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.lastActiveAt = Date.now();
        }
        return session;
    }

    /**
     * 关闭会话
     */
    async closeSession(sessionId: string): Promise<boolean> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            logger.warn(`[会话管理] 关闭会话失败，未找到会话`, { session_id: sessionId });
            return false;
        }

        logger.info(`[会话管理] 正在关闭会话`, { session_id: sessionId });
        try {
            await session.context.close();
        } catch (error: any) {
            logger.error(`[会话管理] 关闭 Playwright 上下文出错`, { error: error.message, session_id: sessionId });
        }

        this.sessions.delete(sessionId);
        return true;
    }

    /**
     * 清理所有会话（用于关闭服务时）
     */
    async closeAll(): Promise<void> {
        clearInterval(this.cleanupInterval);
        for (const id of this.sessions.keys()) {
            await this.closeSession(id);
        }
    }
}

// 导出单例
export const sessionManager = new SessionManager();
