import { fetch as rnFetch } from 'react-native-fetch-api';
import { ChatMessage, ChatMode, NicheId, Religion, SSEEvent } from '@/types';
import { getSystemPrompt, CONTEXT_WINDOW } from '@/constants/niches';
import { useAppStore } from '@/store';

export const DEFAULT_BACKEND_URL = 'http://localhost:3000';
const REQUEST_TIMEOUT = 120000;
const CHUNK_BUFFER_SIZE = 20;

function normalizeBackendUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function getBackendUrl(): string {
  const { backendUrlMode, customBackendUrl } = useAppStore.getState();
  const normalizedCustomUrl = normalizeBackendUrl(customBackendUrl);

  if (backendUrlMode === 'custom' && normalizedCustomUrl) {
    return normalizedCustomUrl;
  }

  return DEFAULT_BACKEND_URL;
}

const buildContext = (messages: ChatMessage[]): { role: string; content: string }[] =>
  messages.slice(-CONTEXT_WINDOW).map((message) => ({ role: message.role, content: message.content }));

function parseSSEChunk(raw: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const lines = raw.replace(/\r/g, '').split('\n');

  for (const line of lines) {
    if (!line.startsWith('data:')) continue;
    const jsonStr = line.slice(5).trim();
    if (!jsonStr) continue;

    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && parsed.type) {
        events.push(parsed as SSEEvent);
      }
    } catch {
      // ignore malformed SSE payloads
    }
  }

  return events;
}

function isSSEResponse(response: Response): boolean {
  const contentType = response.headers.get('Content-Type') ?? '';
  return contentType.includes('text/event-stream');
}

async function collectSSEText(response: Response): Promise<string> {
  const body = response.body;
  if (!body) {
    return (await response.text()) || '';
  }

  const reader = body.getReader?.();
  if (!reader) {
    return (await response.text()) || '';
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let collected = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

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
  signal?: AbortSignal
): Promise<void> => {
  const systemPrompt = getSystemPrompt(nicheId, religion, customPrompt);
  const backendUrl = getBackendUrl();
  const context = buildContext(messages);
  const requestBody = {
    nicheId,
    mode,
    messages: [
      { role: 'system', content: systemPrompt },
      ...context,
      { role: 'user', content: userMessage },
    ],
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await rnFetch(`${backendUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'keep-alive',
      },
      body: JSON.stringify(requestBody),
      signal: signal || controller.signal,
      reactNative: { textStreaming: true },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      callbacks.onError(`Backend error ${response.status}: ${error}`);
      return;
    }

    const body = response.body;
    if (!body) throw new Error('Streaming not supported: response.body unavailable.');

    const reader = body.getReader?.();
    if (!reader) throw new Error('Streaming reader unavailable.');

    const decoder = new TextDecoder();
    const sseMode = isSSEResponse(response);

    let fullText = '';
    let chunkBuffer = '';
    let sseBuffer = '';

    while (true) {
      let done: boolean;
      let value: Uint8Array | undefined;

      try {
        ({ done, value } = await reader.read());
      } catch (readerErr: any) {
        if (readerErr?.name === 'AbortError') return;
        throw readerErr;
      }

      if (done) {
        if (chunkBuffer.length > 0) {
          callbacks.onChunk(chunkBuffer);
          chunkBuffer = '';
        }
        callbacks.onDone(fullText);
        return;
      }

      const decoded = decoder.decode(value, { stream: true });

      if (!sseMode) {
        if (decoded) {
          fullText += decoded;
          chunkBuffer += decoded;
          if (chunkBuffer.length >= CHUNK_BUFFER_SIZE) {
            callbacks.onChunk(chunkBuffer);
            chunkBuffer = '';
          }
        }
        continue;
      }

      sseBuffer += decoded;
      const parts = sseBuffer.split(/\r?\n\r?\n/);
      sseBuffer = parts.pop() ?? '';

      for (const part of parts) {
        const events = parseSSEChunk(part);

        for (const event of events) {
          if (signal?.aborted) return;

          if (event.type === 'action') {
            callbacks.onAction(event.message);
          } else if (event.type === 'status') {
            callbacks.onStatus(event.message);
          } else if (event.type === 'token') {
            fullText += event.content;
            chunkBuffer += event.content;
            if (chunkBuffer.length >= CHUNK_BUFFER_SIZE) {
              callbacks.onChunk(chunkBuffer);
              chunkBuffer = '';
            }
          } else if (event.type === 'done') {
            if (chunkBuffer.length > 0) {
              callbacks.onChunk(chunkBuffer);
              chunkBuffer = '';
            }
            callbacks.onDone(fullText);
            return;
          } else if (event.type === 'error') {
            callbacks.onError(event.message);
            return;
          }
        }
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') return;

    const errorMsg = err?.message || String(err);
    console.error('[Streaming Error]', errorMsg);

    if (errorMsg.includes('Failed to fetch') || errorMsg.includes('Network')) {
      callbacks.onError(
        `Cannot reach backend at ${backendUrl}\n\n` +
        `Checklist:\n` +
        `✓ Docker container or backend is running\n` +
        `✓ If you are using ngrok, paste the public URL in Sidebar > Backend\n` +
        `✓ If you are on an emulator or another device, switch to a reachable custom URL`
      );
    } else if (errorMsg.includes('timeout')) {
      callbacks.onError('Request timeout — Ollama took too long (> 120s)');
    } else {
      callbacks.onError(errorMsg || 'Unknown streaming error');
    }
  }
};

export const chatOnce = async (
  systemPrompt: string,
  userMessage: string
): Promise<string> => {
  try {
    const backendUrl = getBackendUrl();
    const response = await rnFetch(`${backendUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'fast',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
      reactNative: { textStreaming: true },
    });

    if (!response.ok) throw new Error(`Backend error ${response.status}`);
    return isSSEResponse(response) ? await collectSSEText(response) : ((await response.text()) || '');
  } catch (err: any) {
    console.error('[chatOnce Error]', err.message);
    return '';
  }
};

export const buildCustomPersonaPrompt = async (userDescription: string): Promise<string> => {
  const engineerPrompt = `You are an expert AI persona designer. The user wants to create a custom AI persona.
Take their rough description and rewrite it as a precise system prompt that:
1. Defines exactly who this AI is — name (invent one if not given), personality, speaking style, knowledge domain
2. Sets clear behavioral rules — what it will discuss and how
3. Stays under 120 words — brevity = lower latency
4. Uses second person ("You are...")
5. Has a strong voice — not generic

Return ONLY the system prompt text. No explanation, no preamble, no quotes around it.`;

  return chatOnce(engineerPrompt, `User's persona description: "${userDescription}"`);
};

export const summarizeMessages = async (messages: ChatMessage[]): Promise<string> => {
  const conversation = messages
    .map((message) => `${message.role === 'user' ? 'User' : 'AI'}: ${message.content}`)
    .join('\n');

  return chatOnce(
    'Summarize this conversation in 3-5 sentences, keeping key facts and context.',
    conversation
  );
};
