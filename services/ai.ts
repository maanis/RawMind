import Constants from 'expo-constants';
import { fetch as rnFetch } from 'react-native-fetch-api';
import { getSystemPrompt, CONTEXT_WINDOW } from '@/constants/niches';
import { useAppStore } from '@/store';
import { ChatMessage, ChatMode, NicheId, Religion, SSEEvent } from '@/types';
import { logError, logWarn } from '@/utils/logger';
import { isValidHttpUrl, safeArray, safeString, toErrorMessage } from '@/utils/safe';

const REQUEST_TIMEOUT = 120000;
const CHUNK_BUFFER_SIZE = 20;

function normalizeBackendUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function getExpoHostIp(): string | null {
  const candidates = [
    Constants.expoConfig?.hostUri,
    (Constants as Record<string, any>).manifest2?.extra?.expoClient?.hostUri,
    (Constants as Record<string, any>).manifest?.debuggerHost,
    (Constants as Record<string, any>).manifest?.hostUri,
    (Constants as Record<string, any>).expoGoConfig?.debuggerHost,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || candidate.trim().length === 0) {
      continue;
    }

    const cleaned = candidate.replace(/^https?:\/\//, '').replace(/^exp:\/\//, '');
    const hostPart = cleaned.split(':')[0]?.trim();
    if (hostPart) {
      return hostPart;
    }
  }

  return null;
}

function getConfiguredBackendUrl(): string {
  const extraCandidates = [
    Constants.expoConfig?.extra?.defaultBackendUrl,
    Constants.expoConfig?.extra?.backendUrl,
    (Constants as Record<string, any>).manifest2?.extra?.defaultBackendUrl,
    (Constants as Record<string, any>).manifest2?.extra?.backendUrl,
    (Constants as Record<string, any>).manifest?.extra?.defaultBackendUrl,
    (Constants as Record<string, any>).manifest?.extra?.backendUrl,
  ];

  for (const candidate of extraCandidates) {
    const normalized = normalizeBackendUrl(safeString(candidate));
    if (isValidHttpUrl(normalized)) {
      return normalized;
    }
  }

  return '';
}

function getMissingBackendMessage(): string {
  return [
    'Backend URL is not configured for this build.',
    '',
    'Add a reachable URL in Sidebar > Backend, or set expo.extra.defaultBackendUrl before generating the release APK.',
  ].join('\n');
}

function getNetworkFailureMessage(backendUrl: string): string {
  return [
    `Cannot reach backend at ${backendUrl}.`,
    '',
    'Checklist:',
    '1. Make sure the backend is running and reachable from the device.',
    '2. Use a LAN, ngrok, or production HTTPS URL instead of localhost.',
    '3. If this is a release build, set a default backend URL in Expo config or save a custom URL in the sidebar.',
  ].join('\n');
}

export function getDefaultBackendUrl(): string {
  const configuredBackendUrl = getConfiguredBackendUrl();
  if (configuredBackendUrl) {
    return configuredBackendUrl;
  }

  const hostIp = getExpoHostIp();
  if (hostIp) {
    return `http://${hostIp}:3000`;
  }

  return '';
}

export function getBackendUrl(): string {
  const { backendUrlMode, customBackendUrl } = useAppStore.getState();
  const normalizedCustomUrl = normalizeBackendUrl(customBackendUrl);

  if (backendUrlMode === 'custom' && isValidHttpUrl(normalizedCustomUrl)) {
    return normalizedCustomUrl;
  }

  return getDefaultBackendUrl();
}

const buildContext = (messages: ChatMessage[]): Array<{ role: string; content: string }> =>
  safeArray<ChatMessage>(messages)
    .slice(-CONTEXT_WINDOW)
    .map((message) => ({
      role: message.role,
      content: safeString(message.content),
    }));

function parseSSEChunk(raw: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const lines = raw.replace(/\r/g, '').split('\n');

  for (const line of lines) {
    if (!line.startsWith('data:')) {
      continue;
    }

    const jsonStr = line.slice(5).trim();
    if (!jsonStr) {
      continue;
    }

    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed.type === 'string') {
        events.push(parsed as SSEEvent);
      }
    } catch {
      // Ignore malformed SSE events so one bad chunk does not crash the app.
    }
  }

  return events;
}

function isSSEResponse(response: Response): boolean {
  const contentType = response.headers.get('Content-Type') ?? '';
  return contentType.includes('text/event-stream');
}

async function safeReadResponseText(response: Response): Promise<string> {
  try {
    return (await response.text()) || '';
  } catch (error) {
    logError('Failed to read response body as text', error);
    return '';
  }
}

function parseSSEText(raw: string): {
  fullText: string;
  actions: string[];
  statuses: string[];
  errorMessage: string | null;
} {
  const parts = raw.split(/\r?\n\r?\n/);
  let fullText = '';
  const actions: string[] = [];
  const statuses: string[] = [];
  let errorMessage: string | null = null;

  for (const part of parts) {
    const events = parseSSEChunk(part);

    for (const event of events) {
      if (event.type === 'action') {
        actions.push(event.message);
      } else if (event.type === 'status') {
        statuses.push(event.message);
      } else if (event.type === 'token') {
        fullText += event.content;
      } else if (event.type === 'error') {
        errorMessage = event.message;
      }
    }
  }

  return {
    fullText,
    actions,
    statuses,
    errorMessage,
  };
}

async function collectSSEText(response: Response): Promise<string> {
  const body = response.body;
  const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

  if (!body || !decoder) {
    const rawText = await safeReadResponseText(response);
    return parseSSEText(rawText).fullText;
  }

  const reader = body.getReader?.();
  if (!reader) {
    const rawText = await safeReadResponseText(response);
    return parseSSEText(rawText).fullText;
  }

  let buffer = '';
  let collected = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split(/\r?\n\r?\n/);
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        const events = parseSSEChunk(part);
        for (const event of events) {
          if (event.type === 'token') {
            collected += event.content;
          } else if (event.type === 'error') {
            throw new Error(event.message);
          }
        }
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Ignore cleanup failures.
    }

    reader.releaseLock();
  }

  if (buffer.trim()) {
    const events = parseSSEChunk(buffer);
    for (const event of events) {
      if (event.type === 'token') {
        collected += event.content;
      }
    }
  }

  return collected;
}

function createAbortController(signal?: AbortSignal): {
  controller: AbortController;
  cleanup: () => void;
  timeoutId: ReturnType<typeof setTimeout>;
} {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();

  signal?.addEventListener('abort', abortFromCaller);

  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  return {
    controller,
    cleanup: () => {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', abortFromCaller);
    },
    timeoutId,
  };
}

async function requestChatResponse(
  url: string,
  body: string,
  signal: AbortSignal,
): Promise<Response> {
  const requestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Connection: 'keep-alive',
    },
    body,
    signal,
  };

  try {
    return await rnFetch(url, {
      ...requestInit,
      reactNative: { textStreaming: true },
    });
  } catch (error) {
    logWarn('Streaming request failed, retrying without react-native-fetch-api streaming', error);
    return fetch(url, requestInit);
  }
}

function emitChunkBuffer(chunkBuffer: string, callbacks: StreamCallbacks): string {
  if (chunkBuffer.length > 0) {
    callbacks.onChunk(chunkBuffer);
  }

  return '';
}

export interface StreamCallbacks {
  onAction: (message: string) => void;
  onStatus: (message: string) => void;
  onChunk: (chunk: string) => void;
  onDone: (fullText: string) => void;
  onError: (err: string) => void;
}

export const streamChat = async (
  messages: ChatMessage[],
  userMessage: string,
  nicheId: NicheId,
  religion: Religion | undefined,
  customPrompt: string | undefined,
  mode: ChatMode,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> => {
  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    callbacks.onError(getMissingBackendMessage());
    return;
  }

  const systemPrompt = getSystemPrompt(nicheId, religion, customPrompt);
  const context = buildContext(messages);
  const requestBody = JSON.stringify({
    nicheId,
    mode,
    messages: [
      { role: 'system', content: systemPrompt },
      ...context,
      { role: 'user', content: safeString(userMessage) },
    ],
  });

  const { controller, cleanup } = createAbortController(signal);
  let completed = false;
  let reader:
    | ReadableStreamDefaultReader<Uint8Array>
    | undefined;

  const finishDone = (fullText: string) => {
    if (completed) {
      return;
    }

    completed = true;
    callbacks.onDone(fullText);
  };

  const finishError = (message: string) => {
    if (completed) {
      return;
    }

    completed = true;
    callbacks.onError(message);
  };

  try {
    const response = await requestChatResponse(`${backendUrl}/chat`, requestBody, controller.signal);

    if (!response.ok) {
      const errorText = await safeReadResponseText(response);
      finishError(
        `Backend error ${response.status}${errorText ? `: ${errorText}` : ''}`,
      );
      return;
    }

    if (controller.signal.aborted || signal?.aborted) {
      return;
    }

    const body = response.body;
    const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;
    const sseMode = isSSEResponse(response);

    if (!body || !body.getReader || !decoder) {
      const rawText = await safeReadResponseText(response);
      if (!rawText) {
        finishError('Backend returned an empty response.');
        return;
      }

      if (sseMode) {
        const parsed = parseSSEText(rawText);
        parsed.actions.forEach(callbacks.onAction);
        parsed.statuses.forEach(callbacks.onStatus);

        if (parsed.errorMessage) {
          finishError(parsed.errorMessage);
          return;
        }

        if (parsed.fullText) {
          callbacks.onChunk(parsed.fullText);
        }

        finishDone(parsed.fullText);
        return;
      }

      callbacks.onChunk(rawText);
      finishDone(rawText);
      return;
    }

    reader = body.getReader();

    let fullText = '';
    let chunkBuffer = '';
    let sseBuffer = '';

    while (true) {
      if (controller.signal.aborted || signal?.aborted) {
        return;
      }

      const { done, value } = await reader.read();
      if (done) {
        chunkBuffer = emitChunkBuffer(chunkBuffer, callbacks);
        finishDone(fullText);
        return;
      }

      const decoded = decoder.decode(value, { stream: true });
      if (!decoded) {
        continue;
      }

      if (!sseMode) {
        fullText += decoded;
        chunkBuffer += decoded;
        if (chunkBuffer.length >= CHUNK_BUFFER_SIZE) {
          chunkBuffer = emitChunkBuffer(chunkBuffer, callbacks);
        }
        continue;
      }

      sseBuffer += decoded;
      const parts = sseBuffer.split(/\r?\n\r?\n/);
      sseBuffer = parts.pop() ?? '';

      for (const part of parts) {
        const events = parseSSEChunk(part);

        for (const event of events) {
          if (controller.signal.aborted || signal?.aborted) {
            return;
          }

          if (event.type === 'action') {
            callbacks.onAction(event.message);
          } else if (event.type === 'status') {
            callbacks.onStatus(event.message);
          } else if (event.type === 'token') {
            fullText += event.content;
            chunkBuffer += event.content;
            if (chunkBuffer.length >= CHUNK_BUFFER_SIZE) {
              chunkBuffer = emitChunkBuffer(chunkBuffer, callbacks);
            }
          } else if (event.type === 'done') {
            chunkBuffer = emitChunkBuffer(chunkBuffer, callbacks);
            finishDone(fullText);
            return;
          } else if (event.type === 'error') {
            finishError(event.message);
            return;
          }
        }
      }
    }
  } catch (error) {
    if ((error as Error)?.name === 'AbortError' || controller.signal.aborted || signal?.aborted) {
      return;
    }

    const errorMsg = toErrorMessage(error, 'Unknown streaming error');
    logError('[Streaming Error]', error);

    if (/Failed to fetch|Network request failed|Network/i.test(errorMsg)) {
      finishError(getNetworkFailureMessage(backendUrl));
      return;
    }

    if (/timeout/i.test(errorMsg)) {
      finishError('Request timeout. The backend took longer than 120 seconds to respond.');
      return;
    }

    finishError(errorMsg);
  } finally {
    cleanup();

    if (reader) {
      try {
        await reader.cancel();
      } catch {
        // Ignore cleanup failures.
      }

      reader.releaseLock();
    }
  }
};

export const chatOnce = async (
  systemPrompt: string,
  userMessage: string,
): Promise<string> => {
  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    logWarn(getMissingBackendMessage());
    return '';
  }

  const { controller, cleanup } = createAbortController();

  try {
    const response = await requestChatResponse(
      `${backendUrl}/chat`,
      JSON.stringify({
        mode: 'fast',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: safeString(userMessage) },
        ],
      }),
      controller.signal,
    );

    if (!response.ok) {
      throw new Error(`Backend error ${response.status}`);
    }

    if (isSSEResponse(response)) {
      return await collectSSEText(response);
    }

    return (await safeReadResponseText(response)) || '';
  } catch (error) {
    logError('[chatOnce Error]', error);
    return '';
  } finally {
    cleanup();
  }
};

export const buildCustomPersonaPrompt = async (userDescription: string): Promise<string> => {
  const engineerPrompt = `You are an expert AI persona designer. The user wants to create a custom AI persona.
Take their rough description and rewrite it as a precise system prompt that:
1. Defines exactly who this AI is - name (invent one if not given), personality, speaking style, knowledge domain
2. Sets clear behavioral rules - what it will discuss and how
3. Stays under 120 words - brevity = lower latency
4. Uses second person ("You are...")
5. Has a strong voice - not generic

Return ONLY the system prompt text. No explanation, no preamble, no quotes around it.`;

  return chatOnce(engineerPrompt, `User's persona description: "${safeString(userDescription)}"`);
};

export const summarizeMessages = async (messages: ChatMessage[]): Promise<string> => {
  const conversation = safeArray<ChatMessage>(messages)
    .map((message) => `${message.role === 'user' ? 'User' : 'AI'}: ${safeString(message.content)}`)
    .join('\n');

  return chatOnce(
    'Summarize this conversation in 3-5 sentences, keeping key facts and context.',
    conversation,
  );
};
