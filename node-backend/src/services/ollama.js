/**
 * Ollama Service - Handles streaming communication with Ollama
 * Uses native fetch for zero-dependency streaming
 */

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'dolphin-raw';
const REQUEST_TIMEOUT = 120000; // 2 minutes for long responses

/**
 * Stream chat completion from Ollama
 * @param {Array} messages - Array of {role, content} message objects
 * @param {string} model - Model name (optional, uses env default)
 * @returns {Promise<ReadableStream>}
 */
async function streamChat(messages, model = OLLAMA_MODEL) {
  const url = `${OLLAMA_HOST}/api/chat`;

  const body = JSON.stringify({
    model,
    messages,
    stream: true,
    options: {
      temperature: 0.85,
      num_predict: 1024,
      top_p: 0.9,
    },
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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

    // Return the readable stream directly
    return response.body;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Parse NDJSON stream and extract text content
 * Yields text chunks one by one
 * @param {ReadableStream} stream - Ollama response stream
 */
async function* parseOllamaStream(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines[lines.length - 1]; // Keep incomplete line in buffer

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        try {
          const json = JSON.parse(line);
          const content = json?.message?.content ?? '';

          if (content) {
            yield content;
          }

          // Check if generation is complete
          if (json?.done) {
            return;
          }
        } catch (e) {
          // Skip malformed JSON lines
        }
      }
    }

    // Handle any remaining content
    if (buffer.trim()) {
      try {
        const json = JSON.parse(buffer);
        const content = json?.message?.content ?? '';
        if (content) {
          yield content;
        }
      } catch (e) {
        // Skip if final buffer isn't valid JSON
      }
    }
  } finally {
    reader.releaseLock();
  }
}

module.exports = {
  streamChat,
  parseOllamaStream,
  OLLAMA_HOST,
  OLLAMA_MODEL,
};
