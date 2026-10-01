const INTERESTS = new Set(['', 'AI 활용', '독서 습관', '글쓰기', '비즈니스 활용', '기타']);
const APPLICATION_ID_PATTERN = /^JOIN-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getJoinConfig(env = process.env) {
  const operatorName = (env.JOIN_PRIVACY_OPERATOR_NAME || '').trim();
  const retentionPeriod = (env.JOIN_PRIVACY_RETENTION_PERIOD || '').trim();
  const webAppUrl = (env.GOOGLE_APPS_SCRIPT_WEB_APP_URL || '').trim();
  const sharedSecret = (env.GOOGLE_APPS_SCRIPT_SHARED_SECRET || '').trim();
  return {
    configured: Boolean(operatorName && retentionPeriod && webAppUrl && sharedSecret),
    operatorName,
    retentionPeriod,
    webAppUrl,
    sharedSecret,
  };
}

export function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

export function validateJoinPayload(input) {
  const body = input && typeof input === 'object' ? input : {};
  const name = String(body.name || '').trim();
  const phone = normalizePhone(body.phone);
  const email = String(body.email || '').trim().toLowerCase();
  const interest = String(body.interest || '').trim();
  const applicationId = String(body.applicationId || '').trim();
  const source = String(body.source || '').trim().slice(0, 160);
  const startedAt = Number(body.startedAt);
  const elapsed = Date.now() - startedAt;

  if (String(body.website || '').trim()) return { ok: false, code: 'spam', message: '신청을 처리할 수 없습니다.' };
  if (name.length < 2 || name.length > 40) return { ok: false, code: 'name', message: '이름은 2~40자로 입력해 주세요.' };
  if (!/^01[016789]\d{7,8}$/.test(phone)) return { ok: false, code: 'phone', message: '휴대전화 번호를 확인해 주세요.' };
  if (email && (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { ok: false, code: 'email', message: '이메일 형식을 확인해 주세요.' };
  if (!INTERESTS.has(interest)) return { ok: false, code: 'interest', message: '관심 분야를 다시 선택해 주세요.' };
  if (body.privacyConsent !== true) return { ok: false, code: 'privacy', message: '개인정보 수집·이용에 동의해 주세요.' };
  if (!APPLICATION_ID_PATTERN.test(applicationId)) return { ok: false, code: 'application_id', message: '신청 정보를 새로고침한 뒤 다시 시도해 주세요.' };
  if (!Number.isFinite(startedAt) || elapsed < 1200 || elapsed > 86_400_000) return { ok: false, code: 'timing', message: '잠시 후 다시 시도해 주세요.' };

  return {
    ok: true,
    value: {
      applicationId,
      name,
      phone,
      email,
      interest,
      privacyConsent: true,
      newsConsent: body.newsConsent === true,
      source,
    },
  };
}

export function isAllowedOrigin(req) {
  const origin = String(req.headers?.origin || '');
  const host = String(req.headers?.host || '');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function isValidAppsScriptUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'script.google.com' && /\/macros\/s\/.+\/exec$/.test(url.pathname);
  } catch {
    return false;
  }
}

export async function forwardToAppsScript(payload, config, fetchImpl = fetch) {
  if (!isValidAppsScriptUrl(config.webAppUrl)) throw new Error('invalid_web_app_url');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetchImpl(config.webAppUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        sharedSecret: config.sharedSecret,
        privacyOperator: config.operatorName,
        privacyRetentionPeriod: config.retentionPeriod,
        privacyNoticeVersion: '2026-10-01',
      }),
      redirect: 'follow',
      signal: controller.signal,
    });
    const text = await response.text();
    let result;
    try { result = JSON.parse(text); } catch { throw new Error('invalid_upstream_response'); }
    if (!response.ok || result?.ok !== true || result?.applicationId !== payload.applicationId) {
      throw new Error('upstream_rejected');
    }
    return { applicationId: result.applicationId, duplicate: result.duplicate === true };
  } finally {
    clearTimeout(timer);
  }
}
