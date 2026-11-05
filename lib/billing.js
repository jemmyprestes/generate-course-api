import { createHmac, timingSafeEqual } from 'node:crypto';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const PRODUCTS = Object.freeze({
  course: { price: 'price_1UQoxWEq0YRW8F2tWak663rl', amount: 699, mode: 'payment' },
  certificate: { price: 'price_1UQp1qEq0YRW8F2tMILTky6u', amount: 399, mode: 'payment' },
  plus: { price: 'price_1UQp8BEq0YRW8F2tcILJ0Z55', amount: 1499, mode: 'subscription' }
});
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function sandbox() {
  if (process.env.VERCEL_ENV === 'production' || process.env.BILLING_SANDBOX !== 'true') {
    throw new HttpError(503, 'Pagamentos de teste indisponíveis neste ambiente.');
  }
  if (!/^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY || '')) {
    throw new HttpError(503, 'É necessária uma chave Stripe de teste.');
  }
}
export const enforced = () => process.env.BILLING_ENFORCED === 'true';
export function cors(req, res, method = 'POST') {
  res.setHeader('Access-Control-Allow-Origin', 'https://e-learn-landing.webflow.io');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', `${method}, OPTIONS`);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  if (req.method !== method) { res.status(405).json({ error: 'Método não permitido.' }); return true; }
  return false;
}
export function body(req) {
  try { return (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) || {}; }
  catch { throw new HttpError(400, 'JSON inválido.'); }
}
export function failure(res, error) {
  return res.status(error instanceof HttpError ? error.status : 503).json({
    error: error instanceof HttpError ? error.message : 'Serviço indisponível. Pode repetir o pedido.'
  });
}
export async function db(path, data, method) {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new HttpError(503, 'Supabase não configurado.');
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: method || (data === undefined ? 'GET' : 'POST'),
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }), signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new HttpError(503, 'Não foi possível consultar os direitos de acesso.');
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
export async function user(req) {
  const token = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '')?.[1];
  if (!token) throw new HttpError(401, 'É necessário iniciar sessão.');
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new HttpError(503, 'Supabase não configurado.');
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new HttpError(response.status >= 500 ? 503 : 401, 'Não foi possível validar a sessão.');
  const result = await response.json();
  if (!UUID.test(result.id || '')) throw new HttpError(401, 'Sessão inválida.');
  return result;
}
export async function ownedCourse(userId, courseId) {
  if (!UUID.test(courseId || '')) throw new HttpError(400, 'courseId inválido.');
  const rows = await db(`courses?id=eq.${courseId}&user_id=eq.${userId}&select=*`);
  if (rows.length !== 1) throw new HttpError(404, 'Curso não encontrado.');
  return rows[0];
}
// Direct REST integration, pinned API contract; secrets never reach the browser.
export async function stripe(path, data, idempotencyKey) {
  sandbox();
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: data ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Stripe-Version': '2026-10-28.endive',
      ...(data ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
    ...(data ? { body: new URLSearchParams(data).toString() } : {}), signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new HttpError(503, 'Stripe de teste indisponível.');
  return response.json();
}
export function verifySignature(raw, header, secret, now = Date.now()) {
  if (!secret || typeof header !== 'string') throw new HttpError(400, 'Assinatura inválida.');
  const parts = header.split(',').map(x => x.split('='));
  const timestamp = parts.find(([k]) => k === 't')?.[1];
  if (!/^\d+$/.test(timestamp || '') || Math.abs(now / 1000 - Number(timestamp)) > 300) {
    throw new HttpError(400, 'Assinatura expirada ou inválida.');
  }
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(raw).digest();
  if (!parts.some(([k, value]) => k === 'v1' && /^[a-f0-9]{64}$/i.test(value || '') &&
      timingSafeEqual(expected, Buffer.from(value, 'hex')))) throw new HttpError(400, 'Assinatura inválida.');
}
export async function rawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  // Vercel bodyParser is disabled; never verify a reserialized JSON object.
  if (req.body !== undefined) throw new HttpError(400, 'É necessário o corpo original.');
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.from(chunk); size += bytes.length;
    if (size > 1024 * 1024) throw new HttpError(413, 'Evento demasiado grande.');
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}
