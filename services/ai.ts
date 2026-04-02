import { fetch as rnFetch } from 'react-native-fetch-api';
import { ChatMessage, NicheId, Religion } from '@/types';
import { getSystemPrompt, OLLAMA_MODEL, CONTEXT_WINDOW } from '@/constants/niches';

const BACKEND_URL = 'http://10.151.66.43:3000';
const REQUEST_TIMEOUT = 120000;
const CHUNK_BUFFER_SIZE = 20;

const buildContext = (messages: ChatMessage[]): { role: string; content: string }[] =>
  messages.slice(-CONTEXT_WINDOW).map((m) => ({ role: m.role, content: m.content }));

export const streamChat = async (
  messages: ChatMessage[],
  userMessage: string,
  nicheId: NicheId,
  religion: Religion | undefined,
  customPrompt: string | undefined,
  onChunk: (chunk: string) => void,
  onDone: (fullText: string) => void,
  onError: (err: string) => void,
  signal?: AbortSignal
): Promise<void> => {
  const systemPrompt = getSystemPrompt(nicheId, religion, customPrompt);
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await rnFetch(`${BACKEND_URL}/chat`, {
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
      onError(`Backend error ${response.status}: ${error}`);
      return;
    }

    const body = response.body;
    if (!body) {
      throw new Error('Streaming not supported: response.body unavailable.');
    }

    const reader = body.getReader?.();
    if (!reader) {
      throw new Error('Streaming reader unavailable.');
    }

    const decoder = new TextDecoder();
    let isStreamComplete = false;

    while (!isStreamComplete) {
      try {
        const { done, value } = await reader.read();

        if (done) {
          isStreamComplete = true;
          if (chunkBuffer.length > 0) {
            onChunk(chunkBuffer);
            fullText += chunkBuffer;
            chunkBuffer = '';
          }
          // Persist final message
          onDone(fullText);
          return;
        }

        const decodedChunk = decoder.decode(value, { stream: true });

        if (decodedChunk) {
          fullText += decodedChunk;
          chunkBuffer += decodedChunk;

          if (chunkBuffer.length >= CHUNK_BUFFER_SIZE) {
            onChunk(chunkBuffer);
            chunkBuffer = '';
          }
        }
      } catch (readerErr: any) {
        if (readerErr?.name === 'AbortError') return;
        throw readerErr;
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') return;

    const errorMsg = err?.message || String(err);
    console.error('[Streaming Error]', errorMsg);

    if (errorMsg.includes('Failed to fetch') || errorMsg.includes('Network')) {
      onError(
        `Cannot reach backend at ${BACKEND_URL}\n\n` +
        `Checklist:\n` +
        `✓ Backend running: npm start (in node-backend folder)\n` +
        `✓ Ollama running with dolphin-llama3:8b-q4_0\n` +
        `✓ Phone WiFi: Same network as PC`
      );
    } else if (errorMsg.includes('timeout')) {
      onError('Request timeout — Ollama took too long (> 60s)');
    } else {
      onError(errorMsg || 'Unknown streaming error');
    }
  }
};

/**
 * Non-streaming single call — used for custom persona prompt refinement
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

    if (!response.ok) throw new Error(`Backend error ${response.status}`);
    return (await response.text()) || '';
  } catch (err: any) {
    console.error('[chatOnce Error]', err.message);
    return '';
  }
};

/**
 * Refines a rough user description into a tight, locked system prompt.
 * Uses dolphin-llama3 itself for the refinement — meta prompt engineering.
 */
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
    .map((m) => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
    .join('\n');

  return chatOnce(
    'Summarize this conversation in 3-5 sentences, keeping key facts and context.',
    conversation
  );
};
