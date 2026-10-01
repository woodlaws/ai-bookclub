import test from 'node:test';
import assert from 'node:assert/strict';
import core from '../api/join-core.cjs';
const { forwardToAppsScript, getJoinConfig, normalizePhone, validateJoinPayload } = core;

const validPayload = (overrides = {}) => ({
  applicationId: 'JOIN-550e8400-e29b-41d4-a716-446655440000',
  name: '홍길동',
  phone: '010-1234-5678',
  email: 'reader@example.com',
  interest: 'AI 활용',
  privacyConsent: true,
  newsConsent: false,
  website: '',
  startedAt: Date.now() - 2000,
  source: '/join#application',
  ...overrides,
});

const config = {
  webAppUrl: 'https://script.google.com/macros/s/example/exec',
  sharedSecret: 'test-secret',
  operatorName: '테스트 운영자',
  retentionPeriod: '테스트 보유기간',
};

test('설정 누락 시 접수가 비활성화된다', () => {
  assert.equal(getJoinConfig({}).configured, false);
  assert.equal(getJoinConfig({ ...config, GOOGLE_APPS_SCRIPT_WEB_APP_URL: config.webAppUrl }).configured, false);
  assert.equal(getJoinConfig({
    GOOGLE_APPS_SCRIPT_WEB_APP_URL: config.webAppUrl,
    GOOGLE_APPS_SCRIPT_SHARED_SECRET: config.sharedSecret,
    JOIN_PRIVACY_OPERATOR_NAME: config.operatorName,
    JOIN_PRIVACY_RETENTION_PERIOD: config.retentionPeriod,
  }).configured, true);
});

test('휴대전화 하이픈을 제거하고 필수·선택 항목을 검증한다', () => {
  assert.equal(normalizePhone('010-1234-5678'), '01012345678');
  const result = validateJoinPayload(validPayload());
  assert.equal(result.ok, true);
  assert.equal(result.value.phone, '01012345678');
  assert.equal(validateJoinPayload(validPayload({ privacyConsent: false })).ok, false);
  assert.equal(validateJoinPayload(validPayload({ email: 'wrong' })).ok, false);
});

test('Apps Script 성공 본문과 신청 ID가 일치할 때만 성공한다', async () => {
  const payload = validateJoinPayload(validPayload()).value;
  const result = await forwardToAppsScript(payload, config, async (_url, options) => {
    const sent = JSON.parse(options.body);
    assert.equal(sent.sharedSecret, config.sharedSecret);
    return new Response(JSON.stringify({ ok: true, applicationId: payload.applicationId }), { status: 200 });
  });
  assert.deepEqual(result, { applicationId: payload.applicationId, duplicate: false });
});

test('HTTP 200이어도 Apps Script 실패 본문이면 실패한다', async () => {
  const payload = validateJoinPayload(validPayload()).value;
  await assert.rejects(
    () => forwardToAppsScript(payload, config, async () => new Response(JSON.stringify({ ok: false, error: 'save_failed' }), { status: 200 })),
    /upstream_rejected/
  );
});

test('중복 신청 ID 응답은 저장 확인 성공으로 처리하되 duplicate를 유지한다', async () => {
  const payload = validateJoinPayload(validPayload()).value;
  const result = await forwardToAppsScript(payload, config, async () => new Response(JSON.stringify({
    ok: true, duplicate: true, applicationId: payload.applicationId,
  }), { status: 200 }));
  assert.equal(result.duplicate, true);
});
