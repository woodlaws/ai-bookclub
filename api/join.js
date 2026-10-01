import { forwardToAppsScript, getJoinConfig, isAllowedOrigin, validateJoinPayload } from './join-core.mjs';

const windows = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 5;

function isRateLimited(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const current = windows.get(ip);
  if (!current || current.resetAt <= now) {
    windows.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  if (windows.size > 1000) {
    for (const [key, value] of windows) if (value.resetAt <= now) windows.delete(key);
  }
  return current.count > MAX_REQUESTS;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: '허용되지 않은 요청입니다.' });
  if (!isAllowedOrigin(req)) return res.status(403).json({ ok: false, message: '홈페이지에서 다시 시도해 주세요.' });
  if (Number(req.headers['content-length'] || 0) > 12_000) return res.status(413).json({ ok: false, message: '입력 내용이 너무 깁니다.' });
  if (isRateLimited(req)) return res.status(429).json({ ok: false, message: '요청이 많습니다. 10분 뒤 다시 시도해 주세요.' });

  const config = getJoinConfig();
  if (!config.configured) return res.status(503).json({ ok: false, message: '온라인 신청 접수 준비 중입니다.' });
  const validation = validateJoinPayload(req.body);
  if (!validation.ok) return res.status(validation.code === 'spam' ? 400 : 422).json({ ok: false, message: validation.message });

  try {
    const result = await forwardToAppsScript(validation.value, config);
    return res.status(200).json({ ok: true, applicationId: result.applicationId, duplicate: result.duplicate });
  } catch (error) {
    console.error('join_forward_failed', { code: error?.name === 'AbortError' ? 'timeout' : String(error?.message || 'unknown') });
    return res.status(502).json({ ok: false, message: '신청을 저장하지 못했습니다. 입력 내용은 그대로 유지됩니다. 잠시 후 다시 시도해 주세요.' });
  }
}
