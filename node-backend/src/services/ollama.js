/**
 * Ollama Service — Streaming proxy for dolphin-llama3:8b-q4_0
 * Raw mode: no safety, no filters, direct output
 */

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'rawmind-v2';
const REQUEST_TIMEOUT = 120000;

async function streamChat(messages, model = OLLAMA_MODEL, signal) {
  const url = `${OLLAMA_HOST}/api/chat`;

  const body = JSON.stringify({
    model,
    messages,
    stream: true,
    options: {
      temperature: 0.9,        // Higher = more raw, less filtered
      num_predict: 1024,
      top_p: 0.92,
      repeat_penalty: 1.1,     // Reduces repetitive safety phrasing
      top_k: 40,
      stop: [],                 // No stop tokens — let it run
    },
  });

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener('abort', abortFromCaller);
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama error ${response.status}: ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body from Ollama');
    }

    return response.body;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  } finally {
    signal?.removeEventListener('abort', abortFromCaller);
  }
}

async function* parseOllamaStream(stream, signal) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) return;

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines[lines.length - 1];

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
          const json = JSON.parse(line);
          const content = json?.message?.content ?? '';
          if (content) yield content;
          if (json?.done) return;
        } catch (e) {
          // skip malformed lines
        }
      }
    }

    if (buffer.trim()) {
      try {
        const json = JSON.parse(buffer);
        const content = json?.message?.content ?? '';
        if (content) yield content;
      } catch (e) { }
    }
  } finally {
    try { await reader.cancel(); } catch (e) { }
    reader.releaseLock();
  }
}

module.exports = { streamChat, parseOllamaStream, OLLAMA_HOST, OLLAMA_MODEL };
