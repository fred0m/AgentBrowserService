import dotenv from 'dotenv';
import { z } from 'zod';

// 加载 .env 文件
dotenv.config();

// 定义配置 Schema
const ConfigSchema = z.object({
    API_KEY: z.string().min(1, "API_KEY 不能为空"),
    MAX_SESSIONS: z.coerce.number().int().positive().default(2),
    SESSION_TTL_SEC: z.coerce.number().int().positive().default(900),
    SNAPSHOT_TEXT_MAX_CHARS: z.coerce.number().int().positive().default(1200),
    SNAPSHOT_ACTIONS_MAX: z.coerce.number().int().positive().default(60),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    PORT: z.coerce.number().int().positive().default(8000),
    HOST: z.string().default('0.0.0.0'),
    DATA_DIR: z.string().default('/data'),
});

// 解析和验证配置
const rawConfig = {
    API_KEY: process.env.API_KEY,
    MAX_SESSIONS: process.env.MAX_SESSIONS,
    SESSION_TTL_SEC: process.env.SESSION_TTL_SEC,
    SNAPSHOT_TEXT_MAX_CHARS: process.env.SNAPSHOT_TEXT_MAX_CHARS,
    SNAPSHOT_ACTIONS_MAX: process.env.SNAPSHOT_ACTIONS_MAX,
    LOG_LEVEL: process.env.LOG_LEVEL,
    PORT: process.env.PORT,
    HOST: process.env.HOST,
    DATA_DIR: process.env.DATA_DIR,
};

// 验证失败会抛出异常
export const config = ConfigSchema.parse(rawConfig);
