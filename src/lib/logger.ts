type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogPayload {
  [key: string]: unknown;
}

class BackendLogger {
  private isServer = typeof window === 'undefined';

  private formatMessage(level: LogLevel, scope: string, message: string, data?: LogPayload): string {
    const timestamp = new Date().toISOString();
    const tag = `[${timestamp}] [${level.toUpperCase()}] [${scope}]`;
    if (!data || Object.keys(data).length === 0) {
      return `${tag} ${message}`;
    }
    return `${tag} ${message} :: ${JSON.stringify(data)}`;
  }

  info(scope: string, message: string, data?: LogPayload): void {
    if (!this.isServer) return;
    console.log(this.formatMessage('info', scope, message, data));
  }

  warn(scope: string, message: string, data?: LogPayload): void {
    if (!this.isServer) return;
    console.warn(this.formatMessage('warn', scope, message, data));
  }

  error(scope: string, message: string, error?: unknown, data?: LogPayload): void {
    if (!this.isServer) return;
    const errObj = error instanceof Error
      ? { errorMessage: error.message }
      : error ? { error } : {};
    console.error(this.formatMessage('error', scope, message, { ...errObj, ...data }));
  }

  debug(scope: string, message: string, data?: LogPayload): void {
    if (!this.isServer || process.env.NODE_ENV === 'production') return;
    console.debug(this.formatMessage('debug', scope, message, data));
  }
}

export const logger = new BackendLogger();
