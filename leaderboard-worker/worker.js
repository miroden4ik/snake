// ===== Лидерборд для змейки (Cloudflare Worker) =====
// Отдельный воркер от Fruit Blast: данные изолированы (своё KV).
// Категории: race60, race90, race120 — «Гонка». Лидерборд ведётся ТОЛЬКО для Гонки.

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') {
      return handleCors(new Response(null, { status: 204 }));
    }

    try {
      if (path === '/leaderboard' && method === 'GET') {
        return handleCors(await getLeaderboard(env, url));
      }
      if (path === '/rank' && method === 'GET') {
        return handleCors(await getRank(env, url));
      }
      if (path === '/submit' && method === 'POST') {
        return handleCors(await submitScore(request, env));
      }
      if (path === '/delete' && method === 'POST') {
        return handleCors(await deleteUser(request, env));
      }
      return handleCors(new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }));
    } catch (err) {
      console.error('Request error:', err);
      return handleCors(new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }));
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

const CLIENT_SECRET = ''; // Legacy: вставьте Client Secret сюда ИЛИ (лучше) задайте env-секрет VK_CLIENT_SECRET через `wrangler secret put VK_CLIENT_SECRET`

async function verifyVKSignature(paramsStr, secret) {
  if (!secret) {
    console.warn('[WARNING] Секрет VK не установлен (VK_CLIENT_SECRET пуст). Подпись НЕ проверяется, принимаются все запросы!');
    return true;
  }

  try {
    const params = new URLSearchParams(paramsStr);
    const sign = params.get('sign');
    if (!sign) return false;

    const ordered = [...params.entries()]
      .filter(([k]) => k !== 'sign')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    const keyData = new TextEncoder().encode(CLIENT_SECRET);
    const msgData = new TextEncoder().encode(ordered);

    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const rawSig = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    const hashHex = btoa(String.fromCharCode(...new Uint8Array(rawSig)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    return hashHex === sign;
  } catch (e) {
    console.error('Signature verification error:', e);
    return false;
  }
}

// Категории лидерборда: race60 / race90 / race120 («Гонка»). Ограничиваем
// имя, чтобы не разрастались ключи KV. Значение по умолчанию — 'default'.
function categoryFromName(cat) {
  const c = typeof cat === 'string' ? cat.trim().replace(/[^a-zA-Z0-9_-]/g, '') : '';
  return (c && c.length <= 32) ? c : 'default';
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function getLeaderboard(env, url) {
  const kv = env.SNAKE_LB;
  const category = categoryFromName(url.searchParams.get('category'));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20));
  const cacheKey = '_index:' + category;
  const cached = await kv.get(cacheKey, { type: 'json' });
  if (cached && Array.isArray(cached)) {
    return new Response(JSON.stringify({ success: true, category, leaderboard: cached.slice(0, limit) }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  }

  const allUsers = await scanAllUsers(kv, category);
  const top = allUsers
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  await kv.put(cacheKey, JSON.stringify(top), { expirationTtl: 300 });

  return new Response(JSON.stringify({ success: true, category, leaderboard: top }), {
    status: 200,
    headers: JSON_HEADERS,
  });
}

async function getRank(env, url) {
  const kv = env.SNAKE_LB;
  const category = categoryFromName(url.searchParams.get('category'));
  const uid = url.searchParams.get('vk_user_id');
  if (!uid) {
    return new Response(JSON.stringify({ success: false, error: 'Missing vk_user_id' }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  // кэш на 60 сек, чтобы не сканировать KV на каждый запрос ранга
  const cacheKey = '_rank:' + category;
  let cached = await kv.get(cacheKey, { type: 'json' });
  if (!cached || !Array.isArray(cached.scores) || Math.floor(Date.now() / 1000) - cached.ts > 60) {
    const allUsers = await scanAllUsers(kv, category);
    allUsers.sort((a, b) => b.score - a.score);
    const scores = allUsers.map((u) => u.score);
    const ts = Math.floor(Date.now() / 1000);
    await kv.put(cacheKey, JSON.stringify({ ts, scores }), { expirationTtl: 120 });
    cached = { ts, scores };
  }

  const userKey = `user:${category}:${uid}`;
  const me = await kv.get(userKey, { type: 'json' });
  if (!me) {
    return new Response(JSON.stringify({ success: true, rank: null, total: cached.scores.length, score: null }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  }

  // ранг = сколько пользователей со строго большим счётом + 1
  const above = cached.scores.filter((s) => s > me.score).length;
  const rank = above + 1;

  return new Response(JSON.stringify({ success: true, rank, total: cached.scores.length, score: me.score }), {
    status: 200,
    headers: JSON_HEADERS,
  });
}

async function scanAllUsers(kv, category) {
  const results = [];
  let cursor = null;
  const prefix = 'user:' + category + ':';

  do {
    const list = await kv.list({ prefix, cursor, limit: 1000 });
    for (const key of list.keys) {
      const user = await kv.get(key.name, { type: 'json' });
      if (user && typeof user.score === 'number') {
        results.push(user);
      }
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
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON' }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  const { vk_user_id, first_name, last_name, photo_100, score, vk_sign_params, category } = payload || {};

  if (!vk_user_id || typeof score !== 'number' || score < 0) {
    return new Response(JSON.stringify({ success: false, error: 'Missing or invalid fields: vk_user_id, score' }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  const secret = (env && env.VK_CLIENT_SECRET) || CLIENT_SECRET;

  if (vk_sign_params) {
    const valid = await verifyVKSignature(vk_sign_params, secret);
    if (!valid) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid VK signature' }), {
        status: 403,
        headers: JSON_HEADERS,
      });
    }
  } else if (secret) {
    return new Response(JSON.stringify({ success: false, error: 'vk_sign_params required' }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  const cat = categoryFromName(category);
  const userKey = `user:${cat}:${vk_user_id}`;
  const existing = await kv.get(userKey, { type: 'json' });
  const existingScore = existing?.score || 0;

  if (existing && score <= existingScore) {
    return new Response(JSON.stringify({
      success: true,
      updated: false,
      score: existingScore,
      message: 'New score is not higher than current record',
    }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  }

  const record = {
    vk_user_id,
    first_name: first_name || 'Игрок',
    last_name: last_name || '',
    photo_100: photo_100 || '',
    score,
    category: cat,
    updated_at: Date.now(),
  };

  await kv.put(userKey, JSON.stringify(record));
  await kv.delete('_index:' + cat);

  return new Response(JSON.stringify({
    success: true,
    updated: true,
    previous_score: existingScore,
    new_score: score,
    record,
  }), {
    status: 200,
    headers: JSON_HEADERS,
  });
}

async function deleteUser(request, env) {
  const kv = env.SNAKE_LB;
  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON' }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }
  const { vk_user_id, category } = payload || {};
  if (!vk_user_id) {
    return new Response(JSON.stringify({ success: false, error: 'Missing vk_user_id' }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }
  const cat = categoryFromName(category);
  const userKey = `user:${cat}:${vk_user_id}`;
  await kv.delete(userKey);
  await kv.delete('_index:' + cat);
  return new Response(JSON.stringify({ success: true, deleted: vk_user_id, category: cat }), {
    status: 200,
    headers: JSON_HEADERS,
  });
}