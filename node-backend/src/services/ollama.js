/**
 * Ollama Service — Streaming proxy for dolphin-llama3:8b-q4_0
 * Raw mode: no safety, no filters, direct output
 */

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'rawmind-v3';
const REQUEST_TIMEOUT = 120000;

function normalizeModelName(modelName = '') {
  return modelName.replace(/:latest$/, '');
}

async function fetchOllamaTags(timeoutMs = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Ollama tags error ${response.status}`);
    }

    const data = await response.json();
    return data?.models ?? [];
  } finally {
    clearTimeout(timeoutId);
  }
}

async function modelExists(model = OLLAMA_MODEL, timeoutMs = 5000) {
  const models = await fetchOllamaTags(timeoutMs);
  const expectedName = normalizeModelName(model);

  return models.some((entry) => normalizeModelName(entry?.name ?? '') === expectedName);
}

function buildRuntimeContextBlock({
  now = new Date(),
  userLocation,
  webContext,
} = {}) {
  const sections = [
    `CURRENT DATE: ${now.toUTCString()}`,
    `USER LOCATION: ${userLocation || 'Unknown'}`,
    '',
    'GROUNDING RULES:',
    '- Use CURRENT DATE when resolving relative time references like today, yesterday, tomorrow, and this week.',
    '- If the user asks for the current date or current time, answer strictly from CURRENT DATE.',
    '- Use WEB CONTEXT if it is available.',
    '- If WEB CONTEXT contradicts prior knowledge, prefer WEB CONTEXT.',
    '- If you are unsure, say you are not certain instead of guessing.',
  ];

  if (webContext) {
    sections.push('', webContext);
  }

  return sections.join('\n');
}

function injectRuntimeContext(messages, runtimeContext = {}) {
  const contextBlock = buildRuntimeContextBlock(runtimeContext);
  const systemIndex = messages.findIndex((message) => message.role === 'system');

  if (systemIndex === -1) {
    return [{ role: 'system', content: contextBlock }, ...messages];
  }

  return messages.map((message, index) => {
    if (index !== systemIndex) return message;

    return {
      ...message,
      content: `${message.content}\n\n${contextBlock}`,
    };
  });
}

async function streamChat(messages, model = OLLAMA_MODEL, signal) {
  const url = `${OLLAMA_HOST}/api/chat`;

  const body = JSON.stringify({
    model,
    messages,
    stream: true,
    options: {
      temperature: 0.7,
      num_predict: 2048,
      top_p: 0.92,
      repeat_penalty: 1.12,
      top_k: 40,
      stop: [],
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

module.exports = {
  streamChat,
  parseOllamaStream,
  buildRuntimeContextBlock,
  injectRuntimeContext,
  fetchOllamaTags,
  modelExists,
  OLLAMA_HOST,
  OLLAMA_MODEL,
};
