/**
 * Web Search Service
 * Primary:  Brave Search API (fast, reliable, free tier 2000/month)
 * Fallback: DuckDuckGo scraping via ddg-api-https
 *
 * Returns array of { title, snippet, url }
 */

const BRAVE_API_KEY = process.env.BRAVE_API_KEY || '';
const MAX_RESULTS = 5;
const FETCH_TIMEOUT = 8000;
const TEMPORAL_QUERY_HINTS =
  /\b(latest|recent|current|today|yesterday|tomorrow|news|update|updates|event|events|status|price|weather|score|stock|released|announced|launched|right now)\b/i;

/**
 * Brave Search API
 * Free tier: 2000 requests/month — https://api.search.brave.com
 */
async function braveSearch(query) {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${MAX_RESULTS}&text_decorations=0&search_lang=en`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': BRAVE_API_KEY,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`Brave API ${response.status}`);

    const data = await response.json();
    const results = data?.web?.results ?? [];

    return results.slice(0, MAX_RESULTS).map((r) => ({
      title: r.title ?? '',
      snippet: r.description ?? r.extra_snippets?.[0] ?? '',
      url: r.url ?? '',
    }));
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * DuckDuckGo fallback — uses the instant answer + search API
 * No key required, but less reliable
 */
async function duckDuckGoSearch(query) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RawMind/1.0)' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`DDG ${response.status}`);

    const data = await response.json();
    const results = [];

    // Abstract (main result)
    if (data.AbstractText) {
      results.push({
        title: data.Heading ?? query,
        snippet: data.AbstractText.slice(0, 400),
        url: data.AbstractURL ?? '',
      });
    }

    // Related topics
    const topics = (data.RelatedTopics ?? []).slice(0, MAX_RESULTS - results.length);
    for (const topic of topics) {
      if (topic.Text && results.length < MAX_RESULTS) {
        results.push({
          title: topic.Text.slice(0, 80),
          snippet: topic.Text.slice(0, 300),
          url: topic.FirstURL ?? '',
        });
      }
    }

    return results;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * In-memory result cache with TTL
 * Same query within 10 min → return cached (no API call)
 */
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function enrichSearchQuery(query, now = new Date()) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return normalizedQuery;
  if (/\b20\d{2}\b/.test(normalizedQuery)) return normalizedQuery;
  if (!TEMPORAL_QUERY_HINTS.test(normalizedQuery)) return normalizedQuery;
  return `${normalizedQuery} ${now.getUTCFullYear()}`;
}

function getCached(query) {
  const key = query.toLowerCase().trim();
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.results;
}

function setCache(query, results) {
  const key = query.toLowerCase().trim();
  cache.set(key, { results, timestamp: Date.now() });
  // Keep cache size bounded
  if (cache.size > 200) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

/**
 * Main search function with cache + fallback
 * @param {string} query
 * @returns {Promise<Array<{title: string, snippet: string, url: string}>>}
 */
async function searchWeb(query, options = {}) {
  const { now = new Date() } = options;
  const enrichedQuery = enrichSearchQuery(query, now);

  // Check cache first
  const cached = getCached(enrichedQuery);
  if (cached) {
    console.log('[Search] Cache hit:', enrichedQuery.slice(0, 50));
    return cached;
  }

  let results = [];

  try {
    if (BRAVE_API_KEY) {
      console.log('[Search] Using Brave API');
      results = await braveSearch(enrichedQuery);
      if (results.length === 0) {
        throw new Error('Brave returned no results');
      }
    } else {
      throw new Error('No Brave key, using fallback');
    }
  } catch (err) {
    console.log('[Search] Brave failed, trying DuckDuckGo:', err.message);
    try {
      results = await duckDuckGoSearch(enrichedQuery);
    } catch (ddgErr) {
      console.error('[Search] Both sources failed:', ddgErr.message);
      return [];
    }
  }

  if (results.length > 0) {
    setCache(enrichedQuery, results);
  }

  return results;
}

/**
 * Format search results into clean context string for LLM injection
 * Keeps it tight: max 200 chars per snippet = ~600 chars total
 */
function formatSearchContext(results, now = new Date()) {
  if (!results || results.length === 0) {
    return [
      '---',
      'WEB CONTEXT:',
      'No fresh web results were found for this query.',
      '---',
    ].join('\n');
  }

  const formatted = results.map((result, index) => {
    const title = (result.title ?? '').slice(0, 140) || 'Untitled result';
    const snippet = (result.snippet ?? '').slice(0, 320) || 'No snippet available.';
    const url = result.url ?? '';

    const lines = [`${index + 1}. ${title}`, snippet];
    if (url) {
      lines.push(`URL: ${url}`);
    }

    return lines.join('\n');
  });

  return [
    '---',
    `WEB CONTEXT (${now.toUTCString()}):`,
    ...formatted,
    '---',
  ].join('\n');
}

module.exports = { searchWeb, formatSearchContext, enrichSearchQuery };
