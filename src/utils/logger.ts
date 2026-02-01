import { config } from '../config.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
    private levelValue(level: LogLevel): number {
        switch (level) {
            case 'debug': return 0;
            case 'info': return 1;
            case 'warn': return 2;
            case 'error': return 3;
            default: return 1;
        }
    }

    private shouldLog(level: LogLevel): boolean {
        return this.levelValue(level) >= this.levelValue(config.LOG_LEVEL as LogLevel);
    }

    private format(level: LogLevel, message: string, meta?: any) {
        return JSON.stringify({
            level,
            time: new Date().toISOString(),
            msg: message,
            ...meta,
        });
    }

    info(message: string, meta?: any) {
        if (this.shouldLog('info')) {
            console.log(this.format('info', message, meta));
        }
    }

    warn(message: string, meta?: any) {
        if (this.shouldLog('warn')) {
            console.warn(this.format('warn', message, meta));
        }
    }

    error(message: string, meta?: any) {
        if (this.shouldLog('error')) {
            console.error(this.format('error', message, meta));
        }
    }

    debug(message: string, meta?: any) {
        if (this.shouldLog('debug')) {
            console.debug(this.format('debug', message, meta));
        }
    }
}

export const logger = new Logger();
