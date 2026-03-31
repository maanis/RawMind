import { fetch as rnFetch } from 'react-native-fetch-api';
import { ChatMessage, NicheId, Religion } from '@/types';
import { getSystemPrompt, OLLAMA_MODEL, CONTEXT_WINDOW } from '@/constants/niches';

export interface StreamChunk {
  content: string;
  done: boolean;
}

// Backend server URL - using your machine IP
const BACKEND_URL = 'http://10.151.66.43:3000';
const REQUEST_TIMEOUT = 60000; // 60 seconds for long responses
const CHUNK_BUFFER_SIZE = 20; // Micro-buffer: flush every 20 characters for optimal UI updates

/**
 * Sliding window context — keeps last N messages to control token usage
 */
const buildContext = (messages: ChatMessage[]): { role: string; content: string }[] => {
  const window = messages.slice(-CONTEXT_WINDOW);
  return window.map((m) => ({ role: m.role, content: m.content }));
};

/**
 * Stream a chat completion from backend with true real-time streaming.
 * 
 * CRITICAL FIX:
 * - Uses react-native-fetch-api instead of default fetch
 * - Enables textStreaming: true for React Native streaming support
 * - Uses response.body.getReader() for true chunked streaming
 * - Processes chunks as they arrive (no buffering)
 * - Micro-buffers (20 chars) to optimize UI renders without jank
 * 
 * WHY THIS WORKS:
 * - Default React Native fetch: Buffers entire response before returning
 * - react-native-fetch-api: Supports streaming like browser fetch
 * - textStreaming: true: Enables Transfer-Encoding: chunked support
 */
export const streamChat = async (
  messages: ChatMessage[],
  userMessage: string,
  nicheId: NicheId,
  religion: Religion | undefined,
  onChunk: (chunk: string) => void,
  onDone: (fullText: string) => void,
  onError: (err: string) => void,
  signal?: AbortSignal
): Promise<void> => {
  const systemPrompt = getSystemPrompt(nicheId, religion);
  const context = buildContext(messages);

  const requestBody = {
    messages: [
      { role: 'system', content: systemPrompt },
      ...context,
      { role: 'user', content: userMessage },
    ],
  };

  let fullText = '';
  let chunkBuffer = '';

  try {
    // Create timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    // FIX: Use react-native-fetch-api with streaming enabled
    // Default React Native fetch doesn't support streaming - this does
    const response = await rnFetch(`${BACKEND_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'keep-alive',
      },
      body: JSON.stringify(requestBody),
      signal: signal || controller.signal,
      // CRITICAL: Enable streaming for React Native
      reactNative: { textStreaming: true },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      onError(`Backend error ${response.status}: ${error}`);
      return;
    }

    // Get the readable stream from response body
    const body = response.body;
    if (!body) {
      throw new Error(
        'Streaming not supported: response.body unavailable. ' +
        'Ensure react-native-fetch-api is installed and backend sends chunked encoding.'
      );
    }

    // Get reader for true streaming (chunks arrive as they're generated)
    const reader = body.getReader?.();
    if (!reader) {
      throw new Error(
        'Streaming reader unavailable. ' +
        'Ensure react-native-fetch-api is properly installed with npm install react-native-fetch-api'
      );
    }

    const decoder = new TextDecoder();
    let isStreamComplete = false;

    // Read chunks as they arrive (NOT waiting for full response)
    while (!isStreamComplete) {
      try {
        const { done, value } = await reader.read();

        if (done) {
          isStreamComplete = true;
          // Flush any remaining buffered content
          if (chunkBuffer.length > 0) {
            onChunk(chunkBuffer);
            fullText += chunkBuffer;
            chunkBuffer = '';
          }
          onDone(fullText);
          return;
        }

        // Decode chunk as it arrives (streaming mode)
        const decodedChunk = decoder.decode(value, { stream: true });

        if (decodedChunk) {
          fullText += decodedChunk;
          chunkBuffer += decodedChunk;

          // Micro-buffer optimization:
          // Flush when buffer reaches size to avoid too many synchronous UI updates
          // This keeps latency low (~20ms) while preventing UI jank
          if (chunkBuffer.length >= CHUNK_BUFFER_SIZE) {
            onChunk(chunkBuffer);
            chunkBuffer = '';
          }
        }
      } catch (readerErr: any) {
        // Handle stream reading errors
        if (readerErr?.name === 'AbortError') {
          console.warn('[Streaming Cancelled]');
          return;
        }
        throw readerErr;
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.warn('[Streaming Cancelled]');
      return;
    }

    const errorMsg = err?.message || String(err);
    console.error('[Streaming Error]', errorMsg, err);

    // Determine error type and provide actionable message
    if (errorMsg.includes('Failed to fetch') || errorMsg.includes('Network')) {
      onError(
        `Cannot reach backend at ${BACKEND_URL}\n\n` +
        `Checklist:\n` +
        `✓ Backend running: npm start (in node-backend folder)\n` +
        `✓ Ollama running: pnpm ollama\n` +
        `✓ Phone WiFi: Same network as ${BACKEND_URL.split(':')[1].slice(2)}\n` +
        `✓ Library: npm install react-native-fetch-api`
      );
    } else if (errorMsg.includes('timeout') || errorMsg.includes('Timeout')) {
      onError('Request timeout - Ollama took too long (> 60 seconds)');
    } else if (errorMsg.includes('Streaming') || errorMsg.includes('unavailable')) {
      onError(
        `Streaming not available: ${errorMsg}\n\n` +
        `Fix: npm install react-native-fetch-api`
      );
    } else {
      onError(errorMsg || 'Unknown streaming error');
    }
  }
};

/**
 * Non-streaming version for simpler use cases / summaries
 * Uses react-native-fetch-api for consistency
 */
export const chatOnce = async (
  systemPrompt: string,
  userMessage: string
): Promise<string> => {
  try {
    const response = await rnFetch(`${BACKEND_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
      reactNative: { textStreaming: true },
    });

    if (!response.ok) {
      throw new Error(`Backend error ${response.status}`);
    }

    const text = await response.text();
    return text || '';
  } catch (err: any) {
    console.error('[chatOnce Error]', err.message);
    return '';
  }
};

/**
 * Summarize old messages to compress context
 */
export const summarizeMessages = async (messages: ChatMessage[]): Promise<string> => {
  const conversation = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
    .join('\n');

  return chatOnce(
    'You are a summarizer. Summarize the following conversation in 3-5 sentences, preserving key facts and context.',
    conversation
  );
};
