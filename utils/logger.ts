type LogLevel = 'log' | 'info' | 'warn' | 'error';

interface RuntimeLogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  details?: string[];
}

type ConsoleMethod = (...args: unknown[]) => void;
type ErrorHandler = (error: unknown, isFatal?: boolean) => void;

declare global {
  var __RAWMIND_RUNTIME_LOGS__: RuntimeLogEntry[] | undefined;
  var __RAWMIND_ERROR_HANDLERS_INSTALLED__: boolean | undefined;
}

const MAX_RUNTIME_LOGS = 200;

const originalConsole: Record<LogLevel, ConsoleMethod> = {
  log: console.log.bind(console),
  info: (console.info ?? console.log).bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

function toLogString(value: unknown): string {
  if (value instanceof Error) {
    return value.stack || value.message;
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getRuntimeLogStore(): RuntimeLogEntry[] {
  if (!globalThis.__RAWMIND_RUNTIME_LOGS__) {
    globalThis.__RAWMIND_RUNTIME_LOGS__ = [];
  }

  return globalThis.__RAWMIND_RUNTIME_LOGS__;
}

function appendRuntimeLog(level: LogLevel, message: string, details: unknown[] = []): void {
  const entries = getRuntimeLogStore();
  entries.push({
    level,
    message,
    timestamp: new Date().toISOString(),
    details: details.length > 0 ? details.map(toLogString) : undefined,
  });

  if (entries.length > MAX_RUNTIME_LOGS) {
    entries.splice(0, entries.length - MAX_RUNTIME_LOGS);
  }
}

function wrapConsole(level: LogLevel): void {
  const original = originalConsole[level];

  console[level] = (...args: unknown[]) => {
    const [firstArg, ...rest] = args;
    appendRuntimeLog(level, toLogString(firstArg), rest);
    original(...args);
  };
}

export function getRuntimeLogs(): RuntimeLogEntry[] {
  return [...getRuntimeLogStore()];
}

export function logInfo(message: string, ...details: unknown[]): void {
  appendRuntimeLog('info', message, details);
  originalConsole.info(message, ...details);
}

export function logWarn(message: string, ...details: unknown[]): void {
  appendRuntimeLog('warn', message, details);
  originalConsole.warn(message, ...details);
}

export function logError(message: string, ...details: unknown[]): void {
  appendRuntimeLog('error', message, details);
  originalConsole.error(message, ...details);
}

export function installGlobalErrorHandling(): void {
  if (globalThis.__RAWMIND_ERROR_HANDLERS_INSTALLED__) {
    return;
  }

  globalThis.__RAWMIND_ERROR_HANDLERS_INSTALLED__ = true;

  wrapConsole('log');
  wrapConsole('info');
  wrapConsole('warn');
  wrapConsole('error');

  const errorUtils = (globalThis as typeof globalThis & {
    ErrorUtils?: {
      getGlobalHandler?: () => ErrorHandler;
      setGlobalHandler?: (handler: ErrorHandler) => void;
    };
  }).ErrorUtils;

  const existingHandler = errorUtils?.getGlobalHandler?.();
  errorUtils?.setGlobalHandler?.((error, isFatal) => {
    appendRuntimeLog('error', 'Unhandled JavaScript error', [
      error,
      { isFatal: Boolean(isFatal) },
    ]);
    originalConsole.error('[GlobalError]', error, { isFatal: Boolean(isFatal) });

    try {
      existingHandler?.(error, isFatal);
    } catch (handlerError) {
      originalConsole.error('[GlobalErrorHandlerFailure]', handlerError);
    }
  });
}
