import { chromium, BrowserContext } from 'playwright';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../utils/logger.js';

export class BrowserFactory {
    /**
     * 启动一个持久化的浏览器上下文
     * @param profilePath 用户数据目录
     */
    static async launchContext(profilePath: string): Promise<BrowserContext> {
        try {
            logger.info(`[浏览器工厂] 正在启动上下文`, { profile_path: profilePath });

            // 确保目录存在
            await fs.mkdir(profilePath, { recursive: true });

            const context = await chromium.launchPersistentContext(profilePath, {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage', // 配合 shm_size=1gb 使用，以防万一
                    '--disable-blink-features=AutomationControlled',
                ],
                viewport: { width: 1280, height: 720 },
                deviceScaleFactor: 1,
            });

            logger.info(`[浏览器工厂] 上下文启动成功`);
            return context;
        } catch (error: any) {
            logger.error(`[浏览器工厂] 启动失败`, { error: error.message });
            throw error;
        }
    }
}
