const MAX_SCORE = 5000000;
const ALLOWED_COLLECTIONS = new Set(['pachinko_scores', 'scores']);

const GAME_LIMITS = {
  pachinko_scores: { MAX_BET: 100, MAX_MULTIPLIER: 10, MAX_ROUNDS: 10000 },
  scores: { MAX_BET: 5000, MAX_MULTIPLIER: 10, MAX_ROUNDS: 20000 }
};

function clampInt(n, min, max) {
  const num = Number(n);
  if (!Number.isFinite(num)) return min;
  return Math.min(Math.max(Math.floor(num), min), max);
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

function jsonResponse(status, body, extraHeaders = {}, origin = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
      ...extraHeaders
    }
  });
}

function getAllowedOrigin(origin, env) {
  if (!origin) return null;
  const raw = (env && env.ALLOWED_ORIGINS) ? env.ALLOWED_ORIGINS : '';
  const allowed = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (allowed.includes('*')) return origin;
  // Check if origin is in the allowed list
  if (allowed.includes(origin)) return origin;
  return null;
}

async function enforceRateLimit(env, request, origin) {
  if (!env || !env.RATE_LIMIT) return null;

  const ip = request.headers.get('CF-Connecting-IP')
    || (request.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    || 'unknown';

  const windowMs = 60_000;
  const limit = 20;
  const windowKey = `rl:${ip}:${Math.floor(Date.now() / windowMs)}`;

  const raw = await env.RATE_LIMIT.get(windowKey);
  const count = Number(raw || 0);
  if (count >= limit) {
    return jsonResponse(429, { error: 'Rate limit exceeded' }, {}, origin);
  }

  await env.RATE_LIMIT.put(windowKey, String(count + 1), { expirationTtl: 70 });
  return null;
}

function parseServiceAccount(raw) {
  if (!raw) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT');
  const trimmed = raw.trim();
  const json = trimmed.startsWith('{') ? trimmed : atob(trimmed);
  return JSON.parse(json);
}

function pemToArrayBuffer(pem) {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function base64UrlEncode(obj) {
  const json = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signJwt(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore'
  };

  const unsigned = `${base64UrlEncode(header)}.${base64UrlEncode(payload)}`;
  const keyData = pemToArrayBuffer(serviceAccount.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(unsigned));
  const sig = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
  return `${unsigned}.${sig}`;
}

async function getAccessToken(serviceAccount) {
  const assertion = await signJwt(serviceAccount);
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth token error: ${text}`);
  }
  const data = await res.json();
  return data.access_token;
}

export default {
  async fetch(request, env) {
    try {
      const origin = request.headers.get('Origin');
      // For now, allow all origins and add CORS headers
      const allowedOrigin = origin || '*';
      
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: corsHeaders(allowedOrigin)
        });
      }

      const rateLimited = await enforceRateLimit(env, request, allowedOrigin);
      if (rateLimited) return rateLimited;

      if (request.method !== 'POST') {
        return jsonResponse(405, { error: 'Method not allowed' }, {}, allowedOrigin);
      }

      const {
        name: rawName = 'Player',
        score: rawScore = 0,
        collection: rawCollection,
        maxBet: rawMaxBet,
        maxMultiplier: rawMaxMultiplier,
        roundsPlayed: rawRounds
      } = await request.json();
      
      const name = String(rawName).trim().slice(0, 20) || 'Player';
      const clientScore = Number(rawScore || 0);
      const collection = ALLOWED_COLLECTIONS.has(rawCollection) ? rawCollection : 'scores';

      if (!Number.isFinite(clientScore) || clientScore < 0) {
        return jsonResponse(400, { error: 'Invalid score' }, {}, allowedOrigin);
      }

      const limits = GAME_LIMITS[collection] || GAME_LIMITS.scores;
      const maxBet = clampInt(rawMaxBet, 1, limits.MAX_BET);
      const maxMultiplier = clampInt(rawMaxMultiplier, 1, limits.MAX_MULTIPLIER);
      const roundsPlayed = clampInt(rawRounds, 1, limits.MAX_ROUNDS);
      const maxPossibleScore = maxBet * maxMultiplier * roundsPlayed;
      const score = Math.min(MAX_SCORE, Math.floor(clientScore));

      if (score > maxPossibleScore) {
        return jsonResponse(422, { error: 'Score exceeds maximum possible' }, {}, allowedOrigin);
      }

      const serviceAccount = parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT);
      const accessToken = await getAccessToken(serviceAccount);
      const projectId = serviceAccount.project_id;
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}`;

      const firestoreBody = {
        fields: {
          name: { stringValue: name },
          score: { integerValue: String(score) },
          createdAt: { timestampValue: new Date().toISOString() }
        }
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(firestoreBody)
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Firestore error: ${text}`);
      }

      const saved = await res.json();
      return jsonResponse(200, { id: saved.name, score }, {}, allowedOrigin);
    } catch (err) {
      console.error('Worker error:', err);
      return jsonResponse(500, { error: err.message || 'Server error' }, {}, allowedOrigin);
    }
  }
};
