const { createSign } = require('node:crypto');

const INTERESTS = new Set(['', 'AI 활용', '독서 습관', '글쓰기', '비즈니스 활용', '기타']);
const APPLICATION_ID_PATTERN = /^JOIN-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getJoinConfig(env = process.env) {
  const operatorName = (env.JOIN_PRIVACY_OPERATOR_NAME || '').trim();
  const retentionPeriod = (env.JOIN_PRIVACY_RETENTION_PERIOD || '').trim();
  const credentialsJson = (env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  const sheetId = (env.GOOGLE_SHEET_ID || '').trim();
  const sheetName = (env.GOOGLE_SHEET_NAME || '').trim();
  return {
    configured: Boolean(credentialsJson && sheetId && sheetName),
    operatorName,
    retentionPeriod,
    credentialsJson,
    sheetId,
    sheetName,
  };
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function validateJoinPayload(input) {
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

function isAllowedOrigin(req) {
  const origin = String(req.headers?.origin || '');
  const host = String(req.headers?.host || '');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function parseServiceAccount(credentialsJson) {
  let credentials;
  try {
    credentials = JSON.parse(credentialsJson);
    if (typeof credentials === 'string') credentials = JSON.parse(credentials);
  } catch {
    throw Object.assign(new Error('invalid_service_account_json'), { code: 'invalid_config' });
  }
  if (!credentials || typeof credentials !== 'object' || !credentials.client_email || !credentials.private_key) {
    throw Object.assign(new Error('invalid_service_account_fields'), { code: 'invalid_config' });
  }
  return {
    clientEmail: String(credentials.client_email),
    privateKey: String(credentials.private_key).replace(/\\n/g, '\n'),
  };
}

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function createServiceAccountAssertion(credentials, nowSeconds = Math.floor(Date.now() / 1000)) {
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64Url(JSON.stringify({
    iss: credentials.clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(credentials.privateKey, 'base64url')}`;
}

async function getGoogleAccessToken(config, fetchImpl = fetch) {
  const credentials = parseServiceAccount(config.credentialsJson);
  const assertion = createServiceAccountAssertion(credentials);
  const response = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.access_token) {
    throw Object.assign(new Error('google_auth_failed'), { code: 'google_auth_failed' });
  }
  return result.access_token;
}

function formatKoreanTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function safeSheetText(value) {
  const text = String(value || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  return /^\s*[=+\-@]/.test(text) ? `'${text}` : text;
}

async function appendToGoogleSheet(payload, config, fetchImpl = fetch, date = new Date()) {
  const accessToken = await getGoogleAccessToken(config, fetchImpl);
  const range = `${config.sheetName}!A:G`;
  const endpoint = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.sheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const values = [[
    formatKoreanTimestamp(date),
    safeSheetText(payload.name),
    payload.phone,
    safeSheetText(payload.email),
    safeSheetText(payload.interest),
    payload.privacyConsent ? '동의' : '미동의',
    payload.newsConsent ? '동의' : '미동의',
  ]];
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ range, majorDimension: 'ROWS', values }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.updates?.updatedRows !== 1) {
    throw Object.assign(new Error('google_sheets_append_failed'), { code: 'sheets_append_failed' });
  }
  return { applicationId: payload.applicationId };
}

module.exports = {
  appendToGoogleSheet,
  createServiceAccountAssertion,
  formatKoreanTimestamp,
  getJoinConfig,
  getGoogleAccessToken,
  isAllowedOrigin,
  normalizePhone,
  parseServiceAccount,
  safeSheetText,
  validateJoinPayload,
};
