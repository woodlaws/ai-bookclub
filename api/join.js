import { timingSafeEqual } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONSENT_VERSION = '2026-09-30-v1';
const ORIGINS = new Set(['https://aibookclub.kr', 'https://www.aibookclub.kr', 'https://aibookclub.vercel.app']);

function connection() {
  const url = process.env.GOOGLE_SHEETS_WEB_APP_URL;
  const secret = process.env.JOIN_FORM_SECRET;
  if (!url || !secret || secret.length < 32) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'script.google.com' ||
        !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(parsed.pathname) || parsed.search || parsed.hash) return null;
    return { url, secret };
  } catch { return null; }
}

export function validateApplication(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('신청 내용을 다시 확인해 주세요.');
  const clean = (key, max, required = false) => {
    if (body[key] !== undefined && typeof body[key] !== 'string') throw new Error('입력 형식을 확인해 주세요.');
    const value = (body[key] || '').trim();
    if (value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error('입력 내용을 확인해 주세요.');
    if (required && !value) throw new Error(key === 'name' ? '이름을 입력해 주세요.' : '휴대전화를 입력해 주세요.');
    return value;
  };
  const requestId = clean('requestId', 36, true);
  if (!UUID.test(requestId)) throw new Error('신청 페이지를 새로 열어 다시 시도해 주세요.');
  if (clean('website', 200)) throw new Error('신청 내용을 다시 확인해 주세요.');
  const name = clean('name', 80, true);
  const phone = clean('phone', 32, true).replace(/[\s()-]/g, '');
  if (!/^(?:0\d{8,10}|\+\d{8,15})$/.test(phone)) throw new Error('연락 가능한 전화번호를 확인해 주세요.');
  const email = clean('email', 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('이메일 주소를 확인해 주세요.');
  if (body.privacyConsent !== true || body.privacyConsentVersion !== CONSENT_VERSION) throw new Error('개인정보 수집·이용 동의를 확인해 주세요.');
  return { requestId, name, phone, email, purpose: clean('purpose', 1200), address: clean('address', 300),
    privacyConsent: true, privacyConsentVersion: CONSENT_VERSION, source: 'aibookclub.kr' };
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  const configured = connection();
  if (request.method === 'GET') {
    return response.status(configured ? 200 : 503).json({ configured: !!configured,
      message: configured ? '신청서를 작성해 주세요.' : '현재 신청 접수를 준비 중입니다. 잠시 후 다시 방문해 주세요.' });
  }
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({ ok: false, message: '지원하지 않는 요청입니다.' });
  }
  const origin = request.headers.origin;
  if (origin && !ORIGINS.has(origin)) return response.status(403).json({ ok: false, message: '홈페이지에서 다시 신청해 주세요.' });
  if (!configured) return response.status(503).json({ ok: false, message: '현재 신청 접수를 준비 중입니다. 입력 내용은 전송되지 않았습니다.' });
  const type = String(request.headers['content-type'] || '');
  if (!type.startsWith('application/json')) return response.status(415).json({ ok: false, message: '신청 페이지에서 다시 시도해 주세요.' });
  if (Number(request.headers['content-length'] || 0) > 12000) return response.status(413).json({ ok: false, message: '입력 내용이 너무 깁니다.' });
  let payload;
  try {
    const raw = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
    if (typeof raw !== 'string' || Buffer.byteLength(raw) > 12000) throw new Error('입력 내용을 확인해 주세요.');
    payload = validateApplication(JSON.parse(raw));
  } catch (error) {
    const message = error instanceof SyntaxError ? '신청 내용을 다시 확인해 주세요.' : error.message;
    return response.status(400).json({ ok: false, message });
  }
  try {
    const upstream = await fetch(configured.url, { method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, secret: configured.secret }), signal: AbortSignal.timeout(30000) });
    const content = await upstream.text();
    let result;
    try { result = JSON.parse(content); } catch { throw new Error('INVALID_RESPONSE'); }
    // A 200 response, redirect or resolved fetch alone never proves that a row was saved.
    if (!upstream.ok || result.ok !== true || result.saved !== true || typeof result.requestId !== 'string') throw new Error('SAVE_FAILED');
    const expected = Buffer.from(payload.requestId);
    const actual = Buffer.from(result.requestId);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error('ID_MISMATCH');
    return response.status(200).json({ ok: true, saved: true, requestId: payload.requestId,
      message: '신청이 접수되었습니다. 운영진 확인 후 참여 안내를 드리겠습니다.' });
  } catch {
    return response.status(502).json({ ok: false, message: '접수 결과를 확인하지 못했습니다. 입력 내용을 유지한 채 다시 시도해 주세요. 같은 신청은 중복 접수되지 않습니다.' });
  }
}
