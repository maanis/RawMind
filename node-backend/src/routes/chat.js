/**
 * Chat Route — unified SSE pipeline for direct and search-grounded responses.
 */

const express = require('express');
const {
  streamChat,
  parseOllamaStream,
  injectRuntimeContext,
} = require('../services/ollama');
const { detectIntent } = require('../services/intent');
const { searchWeb, formatSearchContext } = require('../services/search');

const router = express.Router();
const VALID_MODES = new Set(['fast', 'thinking']);

function sendSSE(res, data) {
  if (res.writableEnded) return;
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  if (typeof res.flush === 'function') {
    res.flush();
  }
}

function setupSSEHeaders(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

async function streamAssistantResponse(res, messages, model, abortSignal) {
  const ollamaStream = await streamChat(messages, model, abortSignal);

  for await (const token of parseOllamaStream(ollamaStream, abortSignal)) {
    if (abortSignal?.aborted || res.writableEnded) break;
    sendSSE(res, { type: 'token', content: token });
  }
}

async function runDirectPipeline({
  res,
  messages,
  model,
  abortSignal,
  now,
  userLocation,
}) {
  const groundedMessages = injectRuntimeContext(messages, { now, userLocation });

  sendSSE(res, { type: 'status', message: '🧠 Generating response...' });
  await streamAssistantResponse(res, groundedMessages, model, abortSignal);
}

async function runSearchPipeline({
  res,
  messages,
  model,
  query,
  abortSignal,
  now,
  userLocation,
  actionMessage,
}) {
  if (actionMessage) {
    sendSSE(res, { type: 'action', message: actionMessage });
  }

  sendSSE(res, { type: 'status', message: '🔍 Searching the web...' });

  let searchResults = [];
  try {
    searchResults = await searchWeb(query, { now });
  } catch (error) {
    console.error('[Chat] Search failed:', error.message);
  }

  if (abortSignal?.aborted) return;

  sendSSE(res, { type: 'status', message: '⚙️ Processing results...' });
  const webContext = formatSearchContext(searchResults, now);
  const groundedMessages = injectRuntimeContext(messages, {
    now,
    userLocation,
    webContext,
  });

  if (abortSignal?.aborted) return;

  sendSSE(res, { type: 'status', message: '🧠 Generating response...' });
  await streamAssistantResponse(res, groundedMessages, model, abortSignal);
}

router.post('/', async (req, res) => {
  const abortController = new AbortController();
  let responseClosed = false;

  const handleClientDisconnect = () => {
    responseClosed = true;
    abortController.abort();
  };

  req.on('aborted', handleClientDisconnect);
  res.on('close', handleClientDisconnect);

  try {
    const {
      messages,
      model,
      nicheId = 'raw',
      mode: requestedMode = 'fast',
      userLocation,
    } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Invalid request: messages array required' });
    }

    const mode = VALID_MODES.has(requestedMode) ? requestedMode : 'fast';
    const now = new Date();
    const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user');
    const userQuery = lastUserMessage?.content?.trim() ?? '';

    setupSSEHeaders(res);
    sendSSE(res, { type: 'status', message: '🧭 Understanding your question...' });

    const intent = await detectIntent(userQuery, { nicheId, mode, now });
    if (abortController.signal.aborted || responseClosed) return;

    if (intent.needsSearch) {
      await runSearchPipeline({
        res,
        messages,
        model,
        query: userQuery,
        abortSignal: abortController.signal,
        now,
        userLocation,
        actionMessage: intent.actionMessage,
      });
    } else {
      await runDirectPipeline({
        res,
        messages,
        model,
        abortSignal: abortController.signal,
        now,
        userLocation,
      });
    }

    if (!res.writableEnded) {
      sendSSE(res, { type: 'done' });
      res.end();
    }
  } catch (error) {
    if (abortController.signal.aborted) {
      if (!res.writableEnded) res.end();
      return;
    }

    if (res.headersSent) {
      sendSSE(res, { type: 'error', message: error.message });
      if (!res.writableEnded) res.end();
    } else {
      const statusCode =
        error.message.includes('Ollama error 404') ? 404 :
        error.message.includes('Ollama error 500') ? 503 :
        error.message.includes('timeout') ? 504 :
        error.message.includes('ECONNREFUSED') ? 503 :
        500;

      res.status(statusCode).json({ error: error.message });
    }
  } finally {
    req.off('aborted', handleClientDisconnect);
    res.off('close', handleClientDisconnect);
  }
});

module.exports = router;
