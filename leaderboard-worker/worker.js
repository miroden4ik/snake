// ===== Лидерборд для змейки (Cloudflare Worker) =====
// Отдельный воркер от Fruit Blast: данные изолированы (своё KV).
// Категории: race60/race90/race120 — «Гонка», endless_slow/endless_normal/endless_fast — «Бесконечная».

const ALLOWED_CATEGORIES = [
  'race60', 'race90', 'race120',
  'endless_slow', 'endless_normal', 'endless_fast',
];
const DEFAULT_CATEGORY = 'race60';
const CACHE_TOP = 100;
const CACHE_TTL = 300;
const RANK_CACHE_TTL = 60;
const RATE_LIMIT_TTL = 3;
const MAX_NAME_LENGTH = 64;
const MAX_PHOTO_LENGTH = 512;
const MAX_SIGN_PARAMS_LENGTH = 4096;
// Потолок очков: яблоки съедаются не чаще одного шага змейки. Это защита от
// абсурдных значений, а не точный античит.
const SCORE_CAP_PER_SECOND = 6;
// Поле 15x15: больше 225 яблок съесть невозможно.
const MAX_ENDLESS_SCORE = 225;

const JSON_HEADERS = { 'Content-Type': 'application/json' };
let warnedAboutMissingSecret = false;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') {
      return handleCors(new Response(null, { status: 204 }));
    }

    try {
      if (path === '/leaderboard' && method === 'GET') {
        return await getLeaderboard(env, url);
      }
      if (path === '/rank' && method === 'GET') {
        return await getRank(env, url);
      }
      if (path === '/submit' && method === 'POST') {
        return await submitScore(request, env);
      }
      return jsonResponse({ error: 'Not found' }, 404);
    } catch (err) {
      console.error('Request error:', err);
      return jsonResponse({ error: 'Internal server error' }, 500);
    }
  },
};

function handleCors(response) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Max-Age', '86400');
  return response;
}

function jsonResponse(body, status = 200) {
  return handleCors(new Response(JSON.stringify(body), { status, headers: JSON_HEADERS }));
}

function normalizeCategory(raw, { strict = false } = {}) {
  const cat = typeof raw === 'string' ? raw.trim() : '';
  if (!cat && !strict) return DEFAULT_CATEGORY;
  return ALLOWED_CATEGORIES.includes(cat) ? cat : null;
}

function maxScoreFor(category) {
  if (category.indexOf('endless_') === 0) return MAX_ENDLESS_SCORE;
  const seconds = Number(category.replace('race', '')) || 0;
  return Math.max(1, seconds) * SCORE_CAP_PER_SECOND;
}

function cleanText(value, maxLength) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, maxLength);
}

function cleanPhoto(value) {
  const url = cleanText(value, MAX_PHOTO_LENGTH);
  return /^https?:\/\//i.test(url) ? url : '';
}

function normalizeUserId(value) {
  const uid = String(value == null ? '' : value).trim();
  return /^[0-9]{1,20}$/.test(uid) ? uid : null;
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyVKSignature(paramsStr, secret) {
  if (!secret) {
    if (!warnedAboutMissingSecret) {
      warnedAboutMissingSecret = true;
      console.warn('[WARNING] VK_CLIENT_SECRET не задан: подпись не проверяется, рекорды принимаются от любого клиента.');
    }
    return true;
  }

  try {
    const params = new URLSearchParams(paramsStr);
    const sign = params.get('sign');
    if (!sign) return false;

    const ordered = [...params.entries()]
      .filter(([key]) => key !== 'sign')
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    const cryptoKey = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const rawSig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(ordered));
    const hash = btoa(String.fromCharCode(...new Uint8Array(rawSig)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    return timingSafeEqual(hash, sign);
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
}

// Категория приходит из запроса, но попасть в KV может только из белого списка.
async function getLeaderboard(env, url) {
  const kv = env.SNAKE_LB;
  const category = normalizeCategory(url.searchParams.get('category'));
  if (!category) return jsonResponse({ success: false, error: 'Unknown category' }, 400);

  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20));
  const cacheKey = '_index:' + category;
  const cached = await kv.get(cacheKey, { type: 'json' });

  if (Array.isArray(cached)) {
    return jsonResponse({ success: true, category, leaderboard: cached.slice(0, limit) });
  }

  const top = (await scanAllUsers(kv, category))
    .sort((a, b) => b.score - a.score)
    .slice(0, CACHE_TOP);

  // Кэшируем полный топ, а не обрезанный под конкретный limit.
  await kv.put(cacheKey, JSON.stringify(top), { expirationTtl: CACHE_TTL });

  return jsonResponse({ success: true, category, leaderboard: top.slice(0, limit) });
}

async function getRank(env, url) {
  const kv = env.SNAKE_LB;
  const category = normalizeCategory(url.searchParams.get('category'));
  if (!category) return jsonResponse({ success: false, error: 'Unknown category' }, 400);

  const uid = normalizeUserId(url.searchParams.get('vk_user_id'));
  if (!uid) return jsonResponse({ success: false, error: 'Missing or invalid vk_user_id' }, 400);

  const cacheKey = '_rank:' + category;
  let cached = await kv.get(cacheKey, { type: 'json' });
  if (!cached || !Array.isArray(cached.scores) || Math.floor(Date.now() / 1000) - cached.ts > RANK_CACHE_TTL) {
    const allUsers = await scanAllUsers(kv, category);
    allUsers.sort((a, b) => b.score - a.score);
    const ts = Math.floor(Date.now() / 1000);
    cached = { ts, scores: allUsers.map((user) => user.score) };
    await kv.put(cacheKey, JSON.stringify(cached), { expirationTtl: RANK_CACHE_TTL * 2 });
  }

  const me = await kv.get(`user:${category}:${uid}`, { type: 'json' });
  if (!me) {
    return jsonResponse({ success: true, rank: null, total: cached.scores.length, score: null });
  }

  const above = cached.scores.filter((score) => score > me.score).length;
  return jsonResponse({ success: true, rank: above + 1, total: cached.scores.length, score: me.score });
}

async function scanAllUsers(kv, category) {
  const results = [];
  let cursor = null;
  const prefix = 'user:' + category + ':';

  do {
    const list = await kv.list({ prefix, cursor, limit: 1000 });
    for (const key of list.keys) {
      const user = await kv.get(key.name, { type: 'json' });
      if (user && typeof user.score === 'number') results.push(user);
    }
    cursor = list.cursor;
  } while (cursor);

  return results;
}

async function submitScore(request, env) {
  const kv = env.SNAKE_LB;
  let payload;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON' }, 400);
  }

  if (!payload || typeof payload !== 'object') {
    return jsonResponse({ success: false, error: 'Invalid payload' }, 400);
  }

  const uid = normalizeUserId(payload.vk_user_id);
  const category = normalizeCategory(payload.category, { strict: true });
  const score = payload.score;

  if (!uid) return jsonResponse({ success: false, error: 'Missing or invalid vk_user_id' }, 400);
  if (!category) return jsonResponse({ success: false, error: 'Unknown category' }, 400);
  if (!Number.isInteger(score) || score < 0 || score > maxScoreFor(category)) {
    return jsonResponse({ success: false, error: 'Invalid score' }, 400);
  }

  const signParams = payload.vk_sign_params;
  if (signParams != null && (typeof signParams !== 'string' || signParams.length > MAX_SIGN_PARAMS_LENGTH)) {
    return jsonResponse({ success: false, error: 'Invalid vk_sign_params' }, 400);
  }

  const secret = (env && env.VK_CLIENT_SECRET) || '';
  if (secret && !signParams) {
    return jsonResponse({ success: false, error: 'vk_sign_params required' }, 400);
  }
  if (signParams) {
    // Подпись подтверждает launch-параметры конкретного игрока, поэтому uid из
    // подписанной строки должен совпадать с uid, за который отправляют рекорд.
    const signedUid = normalizeUserId(new URLSearchParams(signParams).get('vk_user_id'));
    if (signedUid !== uid) {
      return jsonResponse({ success: false, error: 'Signature does not match vk_user_id' }, 403);
    }
    if (!(await verifyVKSignature(signParams, secret))) {
      return jsonResponse({ success: false, error: 'Invalid VK signature' }, 403);
    }
  }

  const rateKey = `_rl:${category}:${uid}`;
  if (await kv.get(rateKey)) {
    return jsonResponse({ success: false, error: 'Too many requests' }, 429);
  }
  await kv.put(rateKey, '1', { expirationTtl: RATE_LIMIT_TTL });

  const userKey = `user:${category}:${uid}`;
  const existing = await kv.get(userKey, { type: 'json' });
  const existingScore = existing && typeof existing.score === 'number' ? existing.score : 0;

  if (existing && score <= existingScore) {
    return jsonResponse({
      success: true,
      updated: false,
      score: existingScore,
      message: 'New score is not higher than current record',
    });
  }

  const record = {
    vk_user_id: uid,
    first_name: cleanText(payload.first_name, MAX_NAME_LENGTH) || 'Игрок',
    last_name: cleanText(payload.last_name, MAX_NAME_LENGTH),
    photo_100: cleanPhoto(payload.photo_100),
    score,
    category,
    updated_at: Date.now(),
  };

  await kv.put(userKey, JSON.stringify(record));
  await Promise.all([
    kv.delete('_index:' + category),
    kv.delete('_rank:' + category),
  ]);

  return jsonResponse({
    success: true,
    updated: true,
    previous_score: existingScore,
    new_score: score,
    record,
  });
}
