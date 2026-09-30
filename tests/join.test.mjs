import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import handler, { validateApplication } from '../api/join.js';

const requestId = '12345678-1234-4234-8234-123456789abc';
const application = { requestId, name: '접수 확인 테스트', phone: '010-0000-0000', email: '',
  address: '테스트 지역', purpose: '연결 검수', website: '', privacyConsent: true, privacyConsentVersion: '2026-09-30-v1' };
const secret = 'local-test-only-secret-32-characters-long';
const appUrl = 'https://script.google.com/macros/s/EXAMPLE_DEPLOYMENT/exec';

function response() {
  return { code: null, data: null, headers: {}, setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
}
function request(body = application) { return { method: 'POST', headers: { origin: 'https://aibookclub.kr', 'content-type': 'application/json' }, body }; }
async function withConnection(callback) {
  const previousUrl = process.env.GOOGLE_SHEETS_WEB_APP_URL;
  const previousSecret = process.env.JOIN_FORM_SECRET;
  process.env.GOOGLE_SHEETS_WEB_APP_URL = appUrl;
  process.env.JOIN_FORM_SECRET = secret;
  try { await callback(); } finally {
    if (previousUrl === undefined) delete process.env.GOOGLE_SHEETS_WEB_APP_URL; else process.env.GOOGLE_SHEETS_WEB_APP_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.JOIN_FORM_SECRET; else process.env.JOIN_FORM_SECRET = previousSecret;
  }
}

test('신청 입력을 검증하고 전화번호와 선택 주소를 보존한다', () => {
  const value = validateApplication(application);
  assert.equal(value.phone, '01000000000');
  assert.equal(value.address, '테스트 지역');
  assert.equal(value.email, '');
  assert.equal(value.source, 'aibookclub.kr');
  assert.throws(() => validateApplication({ ...application, privacyConsent: false }), /동의/);
  assert.throws(() => validateApplication({ ...application, phone: '000' }), /전화번호/);
  assert.throws(() => validateApplication({ ...application, email: 'not-an-email' }), /이메일/);
  assert.throws(() => validateApplication({ ...application, website: 'spam.example' }));
});

test('미연결 상태에서 저장 성공을 반환하지 않는다', async () => {
  const old = process.env.JOIN_FORM_SECRET;
  delete process.env.JOIN_FORM_SECRET;
  try {
    const output = response();
    await handler(request(), output);
    assert.equal(output.code, 503);
    assert.equal(output.data.ok, false);
    assert.equal(output.data.saved, undefined);
  } finally { if (old !== undefined) process.env.JOIN_FORM_SECRET = old; }
});

test('외부 Origin을 거부한다', async () => withConnection(async () => {
  const output = response();
  await handler({ ...request(), headers: { ...request().headers, origin: 'https://other.example' } }, output);
  assert.equal(output.code, 403);
}));

for (const [title, result] of [
  ['구글 로그인 HTML', '<html>Please sign in</html>'],
  ['저장 실패 JSON', JSON.stringify({ ok: false })],
  ['저장 확인 없는 성공 JSON', JSON.stringify({ ok: true, requestId })],
  ['다른 접수번호', JSON.stringify({ ok: true, saved: true, requestId: 'different' })],
]) {
  test(`${title} 응답을 접수 완료로 표시하지 않는다`, async t => withConnection(async () => {
    t.mock.method(globalThis, 'fetch', async () => ({ ok: true, text: async () => result }));
    const output = response();
    await handler(request(), output);
    assert.equal(output.code, 502);
    assert.equal(output.data.ok, false);
  }));
}

test('실제 저장 확인과 일치하는 접수번호만 성공으로 반환한다', async t => withConnection(async () => {
  let forwarded;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, appUrl);
    assert.equal(options.redirect, 'follow');
    forwarded = JSON.parse(options.body);
    return { ok: true, text: async () => JSON.stringify({ ok: true, saved: true, requestId }) };
  });
  const output = response();
  await handler(request(), output);
  assert.equal(output.code, 200);
  assert.equal(output.data.saved, true);
  assert.equal(forwarded.secret, secret);
  assert.equal(forwarded.address, application.address);
  assert.equal(output.data.secret, undefined);
  assert.equal(output.data.phone, undefined);
}));

async function scriptRuntime() {
  const rows = [['접수번호', '신청일시', '이름', '휴대전화', '이메일', '참여목적', '개인정보동의', '동의문버전', '유입경로', '처리상태']];
  let flushes = 0;
  const sheet = {
    getLastRow() { return rows.length; },
    getRange(row, column, height = 1, width = 1) {
      const range = {
        getValues() { return Array.from({ length: height }, (_, i) => Array.from({ length: width }, (_, j) => rows[row - 1 + i]?.[column - 1 + j] || '')); },
        getDisplayValues() { return this.getValues().map(values => values.map(v => typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v)); },
        setValues(values) { values.forEach((values, i) => { rows[row - 1 + i] ||= []; values.forEach((v, j) => { rows[row - 1 + i][column - 1 + j] = v; }); }); return this; },
        setValue(value) { return this.setValues([[value]]); },
        setNumberFormat(format) { assert.equal(format, '@'); return this; },
        createTextFinder(value) { return { matchEntireCell() { return this; }, findNext() {
          const index = rows.findIndex((values, i) => i >= row - 1 && i < row - 1 + height && values[column - 1] === value);
          return index < 0 ? null : { getRow() { return index + 1; } };
        } }; },
      };
      return range;
    },
  };
  const context = vm.createContext({
    PropertiesService: { getScriptProperties() { return { getProperty(key) { return key === 'SPREADSHEET_ID' ? 'test-sheet' : secret; } }; } },
    SpreadsheetApp: { openById(id) { assert.equal(id, 'test-sheet'); return { getSheetByName(name) { assert.equal(name, '가입신청'); return sheet; } }; }, flush() { flushes++; } },
    LockService: { getScriptLock() { return { waitLock() {}, releaseLock() {} }; } },
    Utilities: { formatDate() { return '2026-09-30 23:00:00'; } },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput(value) { return { value, setMimeType() { return this; } }; } },
  });
  vm.runInContext(await readFile(new URL('../docs/google-apps-script/Code.gs', import.meta.url), 'utf8'), context);
  const post = input => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(input) } }).value);
  return { rows, post, flushes: () => flushes };
}

test('Apps Script가 주소 열을 추가하고 실제 행을 한 번만 저장한다', async () => {
  const script = await scriptRuntime();
  const payload = { ...validateApplication(application), secret };
  assert.equal(script.post(payload).saved, true);
  assert.equal(script.rows.length, 2);
  assert.equal(script.rows[0][10], '주소');
  assert.equal(script.rows[1][3], '01000000000');
  assert.equal(script.rows[1][10], '테스트 지역');
  assert.equal(script.flushes(), 1);
  assert.equal(script.post(payload).duplicate, true);
  assert.equal(script.rows.length, 2);
  assert.equal(script.post({ ...payload, name: '다른 이름' }).code, 'REQUEST_CONFLICT');
  assert.equal(script.post({ ...payload, secret: 'wrong' }).code, 'UNAUTHORIZED');
});

test('서버부터 Apps Script의 행 저장 및 재전송까지 연결 계약을 검증한다', async t => withConnection(async () => {
  const script = await scriptRuntime();
  t.mock.method(globalThis, 'fetch', async (_, options) => ({ ok: true, text: async () => JSON.stringify(script.post(JSON.parse(options.body))) }));
  for (let i = 0; i < 2; i++) {
    const output = response();
    await handler(request(), output);
    assert.equal(output.code, 200);
    assert.equal(output.data.saved, true);
  }
  assert.equal(script.rows.length, 2);
}));
