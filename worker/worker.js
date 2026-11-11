// Cloudflare Worker: keeps the Anthropic API key off the phone/browser.
// POST { image: <base64 JPEG>, species?, refName?, refCm } -> { text, model }
import { buildPrompt, cleanField } from './prompt.js';

const MAX_IMAGE_B64 = 6_000_000;       // ~4.5 MB of JPEG
const UPSTREAM_TIMEOUT_MS = 50_000;
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
}

export default {
  async fetch(req, env) {
    const origins = allowedOrigins(env);
    const origin = req.headers.get('Origin') || '';
    const originOk = origins.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': originOk ? origin : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };
    const send = (o, s = 200) => new Response(JSON.stringify(o), {
      status: s, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });

    if (!origins.length) return send({ error: 'Server not configured (ALLOWED_ORIGINS).' }, 500);
    if (!originOk) return send({ error: 'Origin not allowed.' }, 403);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return send({ error: 'POST only.' }, 405);
    if (!env.ANTHROPIC_API_KEY) return send({ error: 'Server not configured (API key).' }, 500);

    let body;
    try { body = await req.json(); } catch { return send({ error: 'Bad JSON.' }, 400); }

    const { image, species, refName } = body || {};
    const refCm = Number(body && body.refCm);
    if (typeof image !== 'string' || image.length < 100 || image.length > MAX_IMAGE_B64 || !B64.test(image)) {
      return send({ error: 'Invalid image.' }, 400);
    }
    if (!image.startsWith('/9j/')) return send({ error: 'Image must be a JPEG.' }, 400);
    if (!Number.isFinite(refCm) || refCm <= 0 || refCm > 1000) return send({ error: 'Invalid reference length.' }, 400);

    const model = env.MODEL || 'claude-sonnet-5-5';
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
    let r;
    try {
      r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model, max_tokens: 1500,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
            { type: 'text', text: buildPrompt({ species: cleanField(species), refName: cleanField(refName), refCm }) },
          ] }],
        }),
      });
    } catch {
      return send({ error: 'The AI service timed out or is unreachable.' }, 504);
    } finally {
      clearTimeout(timer);
    }

    let j;
    try { j = await r.json(); } catch { return send({ error: 'Bad reply from the AI service.' }, 502); }
    if (!r.ok) return send({ error: 'AI service error (' + r.status + ').' }, 502);
    return send({ text: (j.content || []).map((c) => c.text || '').join(''), model: j.model || model });
  },
};
