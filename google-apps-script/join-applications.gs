const EXPECTED_HEADERS = [
  '신청일시', '이름', '휴대전화', '이메일', '관심 분야',
  '개인정보 동의', '소식 수신 동의', '처리 상태', '신청 ID'
];
const ALLOWED_INTERESTS = ['', 'AI 활용', '독서 습관', '글쓰기', '비즈니스 활용', '기타'];

function jsonResponse_(body) {
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

function safeText_(value) {
  const text = String(value == null ? '' : value).trim();
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function validEmail_(value) {
  return !value || (value.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function validate_(data) {
  const name = String(data.name || '').trim();
  const phone = String(data.phone || '').replace(/\D/g, '');
  const email = String(data.email || '').trim().toLowerCase();
  const interest = String(data.interest || '').trim();
  const applicationId = String(data.applicationId || '').trim();
  if (name.length < 2 || name.length > 40) throw new Error('invalid_name');
  if (!/^01[016789]\d{7,8}$/.test(phone)) throw new Error('invalid_phone');
  if (!validEmail_(email)) throw new Error('invalid_email');
  if (ALLOWED_INTERESTS.indexOf(interest) === -1) throw new Error('invalid_interest');
  if (data.privacyConsent !== true) throw new Error('privacy_required');
  if (!/^JOIN-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(applicationId)) throw new Error('invalid_application_id');
  return {
    name: name,
    phone: phone,
    email: email,
    interest: interest,
    newsConsent: data.newsConsent === true,
    applicationId: applicationId
  };
}

function doGet() {
  return jsonResponse_({ ok: true, service: 'AI 독서클럽 가입 신청', status: 'ready' });
}

function doPost(e) {
  try {
    const properties = PropertiesService.getScriptProperties();
    const spreadsheetId = properties.getProperty('SPREADSHEET_ID');
    const sheetName = properties.getProperty('SHEET_NAME');
    const expectedSecret = properties.getProperty('GOOGLE_APPS_SCRIPT_SHARED_SECRET');
    if (!spreadsheetId || !sheetName || !expectedSecret) return jsonResponse_({ ok: false, error: 'service_not_configured' });

    const data = JSON.parse(e && e.postData && e.postData.contents ? e.postData.contents : '{}');
    if (typeof data.sharedSecret !== 'string' || data.sharedSecret !== expectedSecret) {
      return jsonResponse_({ ok: false, error: 'unauthorized' });
    }
    const value = validate_(data);
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return jsonResponse_({ ok: false, error: 'service_busy' });

    try {
      const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
      const sheet = spreadsheet.getSheetByName(sheetName);
      if (!sheet) return jsonResponse_({ ok: false, error: 'sheet_not_found' });
      const headers = sheet.getRange(1, 1, 1, EXPECTED_HEADERS.length).getDisplayValues()[0];
      if (headers.join('|') !== EXPECTED_HEADERS.join('|')) return jsonResponse_({ ok: false, error: 'invalid_headers' });

      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const duplicate = sheet.getRange(2, 9, lastRow - 1, 1)
          .createTextFinder(value.applicationId)
          .matchEntireCell(true)
          .findNext();
        if (duplicate) return jsonResponse_({ ok: true, duplicate: true, applicationId: value.applicationId });
      }

      const row = sheet.getLastRow() + 1;
      const timestamp = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
      const values = [[
        timestamp,
        safeText_(value.name),
        value.phone,
        safeText_(value.email),
        safeText_(value.interest),
        '동의',
        value.newsConsent ? '동의' : '미동의',
        '신규',
        value.applicationId
      ]];
      const range = sheet.getRange(row, 1, 1, EXPECTED_HEADERS.length);
      range.setNumberFormat('@');
      range.setValues(values);
      SpreadsheetApp.flush();
      return jsonResponse_({ ok: true, duplicate: false, applicationId: value.applicationId });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    console.error('join_save_failed: ' + String(error && error.message ? error.message : 'unknown'));
    return jsonResponse_({ ok: false, error: 'save_failed' });
  }
}
