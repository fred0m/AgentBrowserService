import { Page } from 'playwright';
import { config } from '../config.js';

export interface Action {
    ref: string;
    type: string; // 'link' | 'button' | 'input' | 'textarea' | 'other'
    label: string;
    hint: string;
}

export interface CompactSnapshot {
    session_id: string;
    title: string;
    url: string;
    html?: string;
    main_text?: string;
    actions?: Action[];
    meta: {
        truncated: boolean;
        actions_truncated: boolean;
    };
}

export class SnapshotSerializer {
    /**
     * 获取页面的紧凑快照和 RefMap
     * @param page Playwright Page 对象
     * @param sessionId 会话 ID
     * @param mode 快照模式
     * @returns { snapshot, refMap } RefMap 用于更新 Session 状态
     */
    static async capture(
        page: Page,
        sessionId: string,
        mode: 'compact' | 'text_only' | 'actions_only' = 'compact'
    ): Promise<{ snapshot: CompactSnapshot; refMap: Map<string, string> }> {

        const title = await page.title();
        const url = page.url();

        // 省流模式：只获取 body text
        let mainText = '';
        if (mode === 'compact' || mode === 'text_only') {
            mainText = await page.evaluate(() => document.body.innerText || '');
            mainText = mainText.replace(/\s+/g, ' ').trim();
        }

        // 截断逻辑
        const maxChars = config.SNAPSHOT_TEXT_MAX_CHARS;
        const isTruncated = mainText.length > maxChars;
        if (isTruncated) {
            mainText = mainText.substring(0, maxChars) + '...(已截断)';
        }

        // Interactive Elements Extraction
        let actions: Action[] = [];
        const refMap = new Map<string, string>();
        let actionsTruncated = false;

        if (mode === 'compact' || mode === 'actions_only') {
            const extracted = await this.extractActions(page);
            actions = extracted.actions;
            actionsTruncated = extracted.truncated;

            // Populate refMap
            extracted.refs.forEach((selector, ref) => {
                refMap.set(ref, selector);
            });
        }

        const snapshot: CompactSnapshot = {
            session_id: sessionId,
            title,
            url,
            meta: {
                truncated: isTruncated,
                actions_truncated: actionsTruncated,
            },
        };

        if (mode === 'compact' || mode === 'text_only') {
            snapshot.main_text = mainText;
        }

        if (mode === 'compact' || mode === 'actions_only') {
            snapshot.actions = actions;
        }

        return { snapshot, refMap };
    }

    /**
     * 在页面上下文中执行脚本，提取交互元素并分配 Ref
     */
    private static async extractActions(page: Page): Promise<{ actions: Action[], refs: Map<string, string>, truncated: boolean }> {
        const maxActions = config.SNAPSHOT_ACTIONS_MAX;

        // 注入脚本在浏览器端执行
        const result = await page.evaluate((max) => {
            const actions: { ref: string, type: string, label: string, hint: string, selector: string }[] = [];
            let truncated = false;

            // 辅助函数：生成唯一选择器
            function getSelector(el: Element): string {
                // ID 优先
                if (el.id) return `#${el.id}`;
                // 尝试 finding unique path (simplified)
                // 实际场景可能需要更复杂的 selector 生成逻辑
                // 这里为了 MVP 演示，我们使用 Playwright 友好的 selector 策略或简单的层级生成
                // 为保证准确性，我们可以动态给元素打上 data-agent-ref 属性
                return ''; // 将在后续处理中补全，或者直接由 loop 生成
            }

            // 获取可见且可交互的元素
            const elements = Array.from(document.querySelectorAll('a, button, input, textarea, [role="button"], [role="link"]'))
                .filter(el => {
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && el.getBoundingClientRect().width > 0;
                });

            if (elements.length > max) {
                truncated = true;
                elements.length = max;
            }

            let counter = 1;
            elements.forEach((el) => {
                const tagName = el.tagName.toLowerCase();
                let type = 'other';
                let label = '';
                let hint = '';

                // Determine Type & Label
                if (tagName === 'a') {
                    type = 'link';
                    label = el.textContent?.trim() || (el as HTMLAnchorElement).href;
                } else if (tagName === 'button' || el.getAttribute('role') === 'button') {
                    type = 'button';
                    label = el.textContent?.trim() || (el as HTMLButtonElement).value || 'button';
                } else if (tagName === 'input') {
                    type = 'input';
                    const input = el as HTMLInputElement;
                    const inputType = input.type;
                    if (['submit', 'button', 'reset'].includes(inputType)) {
                        type = 'button';
                        label = input.value || inputType;
                    } else {
                        label = input.placeholder || input.name || '';
                        hint = input.value;
                    }
                } else if (tagName === 'textarea') {
                    type = 'textarea';
                    const area = el as HTMLTextAreaElement;
                    label = area.placeholder || area.name || '';
                    hint = area.value;
                }

                const ref = tagName.substring(0, 1) + counter++;

                // 生成唯一 Selector：使用 nth-match 可能会有问题，最好加上 data-agent-ref
                el.setAttribute('data-browser-agent-ref', ref);
                const selector = `[data-browser-agent-ref="${ref}"]`;

                actions.push({
                    ref,
                    type,
                    label: label.substring(0, 50), // 限制 label 长度
                    hint: hint.substring(0, 50),
                    selector
                });
            });

            return { actions, truncated };
        }, maxActions);

        // 转换结果
        const actions: Action[] = [];
        const refs = new Map<string, string>();

        result.actions.forEach(item => {
            actions.push({ ref: item.ref, type: item.type, label: item.label, hint: item.hint });
            refs.set(item.ref, item.selector);
        });

        return { actions, refs, truncated: result.truncated };
    }
}
