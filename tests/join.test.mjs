import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import core from '../api/join-core.cjs';

const {
  appendToGoogleSheet,
  formatKoreanTimestamp,
  getJoinConfig,
  normalizePhone,
  safeSheetText,
  validateJoinPayload,
} = core;

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

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const serviceAccount = JSON.stringify({
  client_email: 'sheet-writer@example.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
});
const config = {
  credentialsJson: serviceAccount,
  sheetId: 'test-sheet-id',
  sheetName: '시트1',
  operatorName: '',
  retentionPeriod: '',
};

test('Sheets 환경 변수 세 가지가 있을 때만 접수가 활성화된다', () => {
  assert.equal(getJoinConfig({}).configured, false);
  assert.equal(getJoinConfig({ GOOGLE_SERVICE_ACCOUNT_JSON: serviceAccount }).configured, false);
  const result = getJoinConfig({
    GOOGLE_SERVICE_ACCOUNT_JSON: serviceAccount,
    GOOGLE_SHEET_ID: config.sheetId,
    GOOGLE_SHEET_NAME: config.sheetName,
  });
  assert.equal(result.configured, true);
  assert.equal(result.sheetName, '시트1');
});

test('휴대전화 앞자리 0을 보존하고 필수·선택 항목을 검증한다', () => {
  assert.equal(normalizePhone('010-1234-5678'), '01012345678');
  const result = validateJoinPayload(validPayload());
  assert.equal(result.ok, true);
  assert.equal(result.value.phone, '01012345678');
  assert.equal(validateJoinPayload(validPayload({ privacyConsent: false })).ok, false);
  assert.equal(validateJoinPayload(validPayload({ email: 'wrong' })).ok, false);
  assert.equal(validateJoinPayload(validPayload({ interest: '허용되지 않은 값' })).ok, false);
});

test('한국 시간 형식과 수식 시작 입력을 안전한 문자열로 만든다', () => {
  assert.equal(formatKoreanTimestamp(new Date('2026-10-07T00:00:00.000Z')), '2026-10-07 09:00:00');
  assert.equal(safeSheetText('=IMPORTXML("https://example.com")'), '\'=IMPORTXML("https://example.com")');
  assert.equal(safeSheetText('일반 입력'), '일반 입력');
});

test('Google Sheets A:G에 RAW 방식으로 한 행을 추가한다', async () => {
  const payload = validateJoinPayload(validPayload()).value;
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('oauth2.googleapis.com/token')) {
      assert.match(String(options.body), /grant_type=/);
      return new Response(JSON.stringify({ access_token: 'test-access-token' }), { status: 200 });
    }
    return new Response(JSON.stringify({ updates: { updatedRows: 1 } }), { status: 200 });
  };

  const result = await appendToGoogleSheet(payload, config, fetchImpl, new Date('2026-10-07T00:00:00.000Z'));
  assert.equal(result.applicationId, payload.applicationId);
  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /values\/%EC%8B%9C%ED%8A%B81!A%3AG:append/);
  assert.match(calls[1].url, /valueInputOption=RAW/);
  assert.match(calls[1].url, /insertDataOption=INSERT_ROWS/);
  assert.equal(calls[1].options.headers.authorization, 'Bearer test-access-token');
  const sent = JSON.parse(calls[1].options.body);
  assert.deepEqual(sent.values[0], [
    '2026-10-07 09:00:00', '홍길동', '01012345678', 'reader@example.com', 'AI 활용', '동의', '미동의',
  ]);
});

test('Sheets가 한 행 저장을 확인하지 못하면 실패한다', async () => {
  const payload = validateJoinPayload(validPayload()).value;
  let call = 0;
  await assert.rejects(
    () => appendToGoogleSheet(payload, config, async () => {
      call += 1;
      if (call === 1) return new Response(JSON.stringify({ access_token: 'test-access-token' }), { status: 200 });
      return new Response(JSON.stringify({ error: { status: 'PERMISSION_DENIED' } }), { status: 403 });
    }),
    /google_sheets_append_failed/
  );
});
