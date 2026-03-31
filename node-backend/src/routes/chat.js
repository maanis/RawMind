/**
 * Chat Route - Handles streaming chat requests
 * Receives messages, streams from Ollama, sends to client
 */

const express = require('express');
const { streamChat, parseOllamaStream } = require('../services/ollama');

const router = express.Router();

/**
 * POST /chat
 * Stream chat responses from Ollama
 *
 * Request body:
 * {
 *   "messages": [{ "role": "user", "content": "..." }],
 *   "model": "dolphin-raw" (optional)
 * }
 */
router.post('/', async (req, res) => {
  try {
    const { messages, model } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'Invalid request: messages array required',
      });
    }

    // Set streaming headers
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Start streaming from Ollama
    const ollamaStream = await streamChat(messages, model);

    // Parse and forward chunks
    for await (const chunk of parseOllamaStream(ollamaStream)) {
      res.write(chunk);
    }

    // End response
    res.end();
  } catch (error) {
    // Handle errors gracefully
    if (res.headersSent) {
      // If we already started streaming, we can only close the connection
      res.end();
    } else {
      // Send error response
      const statusCode =
        error.message.includes('Ollama error 404') ? 404 :
        error.message.includes('Ollama error 500') ? 503 :
        error.message.includes('timeout') ? 504 :
        error.message.includes('ECONNREFUSED') ? 503 :
        500;

      res.status(statusCode).json({
        error: error.message,
      });
    }
  }
});

module.exports = router;
