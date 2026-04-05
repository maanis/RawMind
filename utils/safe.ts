import { logError } from '@/utils/logger';

export function toErrorMessage(error: unknown, fallback = 'Unknown error'): string {
  if (error instanceof Error) {
    return error.message || fallback;
  }

  if (typeof error === 'string') {
    return error || fallback;
  }

  return fallback;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function safeArray<T>(value: unknown, fallback: T[] = []): T[] {
  return Array.isArray(value) ? value : fallback;
}

export function safeJsonParse<T>(
  value: string | null | undefined,
  fallback: T,
): T {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    logError('Failed to parse JSON payload', error);
    return fallback;
  }
}

export function safeEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fallback: T,
): T {
  return typeof value === 'string' && allowedValues.includes(value as T)
    ? (value as T)
    : fallback;
}

export function isValidHttpUrl(value: string): boolean {
  if (!value.trim()) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

export async function safeAsync<T>(
  operation: () => Promise<T>,
  options?: {
    context?: string;
    fallback?: T;
  },
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    logError(options?.context ?? 'Async operation failed', error);
    return options?.fallback;
  }
}

export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  timeoutMessage = 'Operation timed out',
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
