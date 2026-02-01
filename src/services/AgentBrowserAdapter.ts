import { execa } from 'execa';
import { logger } from '../utils/logger.js';

/**
 * AgentBrowserAdapter
 * 封装 agent-browser CLI 调用，提供与现有接口兼容的方法
 */

interface SnapshotOptions {
    mode?: 'compact' | 'interactive' | 'full';
    depth?: number;
}

interface SnapshotResult {
    snapshot: {
        session_id: string;
        title: string;
        url: string;
        meta: {
            truncated: boolean;
            actions_truncated: boolean;
        };
        main_text?: string;
        actions: Array<{
            ref: string;
            type: string;
            label: string;
            hint: string;
        }>;
    };
    refMap: Map<string, string>;
}

export class AgentBrowserAdapter {
    /**
     * 获取页面快照
     */
    static async snapshot(
        sessionId: string,
        profileDir: string,
        options: SnapshotOptions = {}
    ): Promise<SnapshotResult> {
        const args = ['snapshot', '--json'];

        // 添加过滤选项
        if (options.mode === 'interactive' || options.mode === 'compact') {
            args.push('-i'); // 仅交互元素
            args.push('-c'); // 紧凑模式
        }

        if (options.depth) {
            args.push('-d', options.depth.toString());
        }

        try {
            logger.info('[AgentBrowserAdapter] 执行快照', { session_id: sessionId, args });

            const { stdout } = await execa('npx', ['agent-browser', ...args], {
                env: {
                    AGENT_BROWSER_SESSION: sessionId,
                    AGENT_BROWSER_PROFILE: profileDir,
                },
            });

            const result = JSON.parse(stdout);

            if (!result.success) {
                throw new Error(`agent-browser snapshot 失败: ${result.error || '未知错误'}`);
            }

            // 转换为现有格式
            const { data } = result;
            const snapshot = this.convertToLegacyFormat(data, sessionId);
            const refMap = this.extractRefMap(data.refs || {});

            return { snapshot, refMap };
        } catch (error: any) {
            logger.error('[AgentBrowserAdapter] 快照失败', {
                error: error.message,
                session_id: sessionId,
            });
            throw error;
        }
    }

    /**
     * 点击元素
     */
    static async click(sessionId: string, profileDir: string, ref: string): Promise<void> {
        try {
            logger.info('[AgentBrowserAdapter] 点击元素', { session_id: sessionId, ref });

            await execa('npx', ['agent-browser', 'click', `@${ref}`, '--json'], {
                env: {
                    AGENT_BROWSER_SESSION: sessionId,
                    AGENT_BROWSER_PROFILE: profileDir,
                },
            });
        } catch (error: any) {
            logger.error('[AgentBrowserAdapter] 点击失败', {
                error: error.message,
                session_id: sessionId,
                ref,
            });
            throw error;
        }
    }

    /**
     * 填充输入框
     */
    static async fill(
        sessionId: string,
        profileDir: string,
        ref: string,
        text: string
    ): Promise<void> {
        try {
            logger.info('[AgentBrowserAdapter] 填充输入', {
                session_id: sessionId,
                ref,
                text,
            });

            await execa('npx', ['agent-browser', 'fill', `@${ref}`, text, '--json'], {
                env: {
                    AGENT_BROWSER_SESSION: sessionId,
                    AGENT_BROWSER_PROFILE: profileDir,
                },
            });
        } catch (error: any) {
            logger.error('[AgentBrowserAdapter] 填充失败', {
                error: error.message,
                session_id: sessionId,
                ref,
            });
            throw error;
        }
    }

    /**
     * 打开页面
     */
    static async goto(sessionId: string, profileDir: string, url: string): Promise<void> {
        try {
            logger.info('[AgentBrowserAdapter] 打开页面', { session_id: sessionId, url });

            await execa('npx', ['agent-browser', 'open', url, '--json'], {
                env: {
                    AGENT_BROWSER_SESSION: sessionId,
                    AGENT_BROWSER_PROFILE: profileDir,
                },
            });
        } catch (error: any) {
            logger.error('[AgentBrowserAdapter] 页面打开失败', {
                error: error.message,
                session_id: sessionId,
                url,
            });
            throw error;
        }
    }

    /**
     * 转换 agent-browser 输出为现有格式
     */
    private static convertToLegacyFormat(data: any, sessionId: string) {
        const actions = [];
        const refs = data.refs || {};

        // 将 refs 对象转换为 actions 数组
        for (const [ref, info] of Object.entries<any>(refs)) {
            actions.push({
                ref,
                type: info.role || 'element',
                label: info.name || '',
                hint: info.description || '',
            });
        }

        return {
            session_id: sessionId,
            title: data.title || '',
            url: data.url || '',
            meta: {
                truncated: false,
                actions_truncated: actions.length > 60,
            },
            main_text: data.snapshot || '',
            actions: actions.slice(0, 60), // 限制数量
        };
    }

    /**
     * 提取 RefMap
     */
    private static extractRefMap(refs: Record<string, any>): Map<string, string> {
        const refMap = new Map<string, string>();

        for (const [ref] of Object.entries(refs)) {
            // agent-browser 的 ref 可以直接使用 @ref 语法
            refMap.set(ref, `@${ref}`);
        }

        return refMap;
    }
}
