/**
 * RawMind Backend - Streaming Proxy for Ollama
 * Minimal, production-quality streaming server
 */

const express = require('express');
const cors = require('cors');
const chatRoutes = require('./routes/chat');
const { OLLAMA_HOST, OLLAMA_MODEL, modelExists } = require('./services/ollama');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/ready', async (req, res) => {
  try {
    const hasModel = await modelExists();

    if (!hasModel) {
      return res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        ollamaHost: OLLAMA_HOST,
        model: OLLAMA_MODEL,
        reason: `Model ${OLLAMA_MODEL} is not available yet`,
      });
    }

    return res.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      ollamaHost: OLLAMA_HOST,
      model: OLLAMA_MODEL,
    });
  } catch (error) {
    return res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      ollamaHost: OLLAMA_HOST,
      model: OLLAMA_MODEL,
      reason: error.message,
    });
  }
});

// Chat routes
app.use('/chat', chatRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({
    error: err.message || 'Internal server error',
    ...(NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
  console.log(`📡 Ollama endpoint: ${process.env.OLLAMA_HOST || 'http://localhost:11434'}`);
  console.log(`🔧 Environment: ${NODE_ENV}`);
});
