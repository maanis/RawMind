/**
 * Intent Detection Service
 * Hybrid flow:
 * 1. Lightweight rules for obvious yes/no cases
 * 2. Ollama JSON classifier for ambiguous cases
 *
 * Returns { needsSearch, reason, actionMessage, source }
 */

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const INTENT_MODEL = process.env.OLLAMA_INTENT_MODEL || process.env.OLLAMA_MODEL || 'rawmind-v3';
const CLASSIFIER_TIMEOUT = 4000;

const OBVIOUS_SEARCH_PATTERNS = [
  /\b(latest|recent|current|currently|today|yesterday|tomorrow|live|breaking|right now)\b/i,
  /\b(news|headline|headlines|update|updates|event|events|situation|status|development)\b/i,
  /\b(what happened|what happened with|what happened to|what's happening|what is happening)\b/i,
  /\b(stock|price|market cap|exchange rate|score|match|weather|forecast|temperature|traffic)\b/i,
  /\b(released|launch(ed)?|announced|shipped|rolled out|won|lost)\b/i,
];

const OBVIOUS_NO_SEARCH_PATTERNS = [
  /\b(write|create|generate|draft|brainstorm|roleplay|story|poem|lyrics)\b/i,
  /\b(code|program|function|component|script|debug|refactor|algorithm)\b/i,
  /\b(explain|define|meaning of|history of|how does|how do)\b/i,
];

const RUNTIME_CONTEXT_PATTERNS = [
  /\b(today'?s? date|what date is today|current date|date today)\b/i,
  /\b(what time is it|current time|time now)\b/i,
  /\b(which day is today|day today)\b/i,
];

function getActionMessage(query, mode, needsSearch) {
  if (!needsSearch) {
    return 'Let me think through that carefully...';
  }

  if (mode === 'thinking') {
    return 'Let me gather fresh context before I answer...';
  }

  const q = query.toLowerCase();

  if (/price|stock|market|rate/.test(q)) {
    return 'Let me look up the current data...';
  }

  if (/weather|forecast|temperature/.test(q)) {
    return 'Let me check the current conditions...';
  }

  return 'Let me check the latest information...';
}

function quickIntentCheck(query, mode) {
  if (mode === 'thinking') {
    return {
      needsSearch: true,
      reason: 'Thinking mode always gathers fresh web context before answering.',
      source: 'mode',
    };
  }

  if (RUNTIME_CONTEXT_PATTERNS.some((pattern) => pattern.test(query))) {
    return {
      needsSearch: false,
      reason: 'The backend runtime context can answer this without a web search.',
      source: 'rule',
    };
  }

  if (OBVIOUS_SEARCH_PATTERNS.some((pattern) => pattern.test(query))) {
    return {
      needsSearch: true,
      reason: 'The query appears to depend on recent or real-time information.',
      source: 'rule',
    };
  }

  if (OBVIOUS_NO_SEARCH_PATTERNS.some((pattern) => pattern.test(query))) {
    return {
      needsSearch: false,
      reason: 'The query looks like a timeless or generative request.',
      source: 'rule',
    };
  }

  return null;
}

function extractJsonObject(text) {
  if (!text) return null;

  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function ollamaIntentCheck(query, now = new Date()) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLASSIFIER_TIMEOUT);

  try {
    const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: INTENT_MODEL,
        stream: false,
        messages: [
          {
            role: 'user',
            content: [
              'Classify this query.',
              '',
              `CURRENT DATE: ${now.toUTCString()}`,
              `Query: "${query}"`,
              '',
              'Return JSON only:',
              '{',
              '  "needs_search": true/false,',
              '  "reason": "short explanation"',
              '}',
              '',
              'Rules:',
              '- needs_search = true if the answer depends on current events, recent facts, live status, dates, or real-time information',
              '- needs_search = false if the query is opinion, timeless knowledge, explanation, or creative work',
            ].join('\n'),
          },
        ],
        options: {
          num_predict: 50,
          temperature: 0,
          top_p: 0.1,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Intent classifier error ${response.status}`);
    }

    const data = await response.json();
    const parsed = extractJsonObject(data?.message?.content ?? '');

    if (!parsed || typeof parsed.needs_search !== 'boolean') {
      throw new Error('Intent classifier returned invalid JSON');
    }

    return {
      needsSearch: parsed.needs_search,
      reason:
        typeof parsed.reason === 'string' && parsed.reason.trim()
          ? parsed.reason.trim()
          : parsed.needs_search
            ? 'The classifier marked this as needing fresh information.'
            : 'The classifier marked this as answerable without fresh web data.',
      source: 'classifier',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function detectIntent(query, options = {}) {
  const {
    mode = 'fast',
    now = new Date(),
  } = options;

  if (!query || query.trim().length === 0) {
    return {
      needsSearch: false,
      reason: 'Empty query.',
      actionMessage: null,
      source: 'rule',
    };
  }

  const quickDecision = quickIntentCheck(query, mode);
  const decision = quickDecision ?? await ollamaIntentCheck(query, now).catch(() => ({
    needsSearch: false,
    reason: 'Intent classifier was unavailable, so the backend used direct generation.',
    source: 'fallback',
  }));

  return {
    ...decision,
    actionMessage: getActionMessage(query, mode, decision.needsSearch),
  };
}

module.exports = { detectIntent };
