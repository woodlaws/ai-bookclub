/* Set SPREADSHEET_ID and JOIN_FORM_SECRET in Project Settings > Script properties.
 * Deploy as a web app: execute as owner; anonymous access. No applicant data is served by GET.
 */
var JOIN_HEADERS = ['접수번호', '신청일시', '이름', '휴대전화', '이메일', '참여목적', '개인정보동의', '동의문버전', '유입경로', '처리상태', '주소'];
var JOIN_VERSION = '2026-09-30-v1';

function jsonOutput(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('JOIN_FORM_SECRET') || '';
  return jsonOutput({ configured: !!props.getProperty('SPREADSHEET_ID') && secret.length >= 32 });
}

function doPost(event) {
  var lock;
  var locked = false;
  try {
    var props = PropertiesService.getScriptProperties();
    var expectedSecret = props.getProperty('JOIN_FORM_SECRET') || '';
    var sheetId = props.getProperty('SPREADSHEET_ID');
    if (!sheetId || expectedSecret.length < 32) return jsonOutput({ ok: false, code: 'NOT_CONFIGURED' });
    if (!event || !event.postData || event.postData.contents.length > 12000) return jsonOutput({ ok: false, code: 'INVALID_BODY' });
    var input = JSON.parse(event.postData.contents);
    if (!input || typeof input !== 'object' || input.secret !== expectedSecret) return jsonOutput({ ok: false, code: 'UNAUTHORIZED' });
    var read = function (key, maximum, required) {
      if (input[key] !== undefined && typeof input[key] !== 'string') throw new Error('INVALID');
      var value = (input[key] || '').trim();
      if ((required && !value) || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error('INVALID');
      return value;
    };
    var id = read('requestId', 36, true);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new Error('INVALID');
    var name = read('name', 80, true);
    var phone = read('phone', 32, true).replace(/[\s()-]/g, '');
    var email = read('email', 200, false);
    var purpose = read('purpose', 1200, false);
    var address = read('address', 300, false);
    if (!/^(?:0\d{8,10}|\+\d{8,15})$/.test(phone) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error('INVALID');
    if (input.privacyConsent !== true || input.privacyConsentVersion !== JOIN_VERSION) throw new Error('INVALID');

    lock = LockService.getScriptLock();
    lock.waitLock(10000);
    locked = true;
    var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('가입신청');
    if (!sheet) throw new Error('MISSING_SHEET');
    if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, JOIN_HEADERS.length).setValues([JOIN_HEADERS]);
    var headers = sheet.getRange(1, 1, 1, JOIN_HEADERS.length).getValues()[0];
    // Preserve the original 10 columns and append the optional address column at K.
    for (var h = 0; h < 10; h++) if (headers[h] !== JOIN_HEADERS[h]) throw new Error('HEADER_MISMATCH');
    if (!headers[10]) sheet.getRange(1, 11).setValue('주소');
    else if (headers[10] !== '주소') throw new Error('HEADER_MISMATCH');

    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      var duplicate = sheet.getRange(2, 1, lastRow - 1, 1).createTextFinder(id).matchEntireCell(true).findNext();
      if (duplicate) {
        var previous = sheet.getRange(duplicate.getRow(), 1, 1, JOIN_HEADERS.length).getDisplayValues()[0];
        var submitted = [name, phone, email, purpose, address];
        var prior = [previous[2], previous[3], previous[4], previous[5], previous[10]];
        for (var p = 0; p < submitted.length; p++) {
          // Some sheet APIs retain the protective apostrophe, others return the displayed text.
          if (prior[p] !== submitted[p] && prior[p] !== "'" + submitted[p]) return jsonOutput({ ok: false, code: 'REQUEST_CONFLICT' });
        }
        return jsonOutput({ ok: true, saved: true, requestId: id, duplicate: true });
      }
    }
    var safeCell = function (value) { return /^[=+\-@]/.test(value) ? "'" + value : value; };
    var date = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
    var row = [id, date, safeCell(name), safeCell(phone), safeCell(email), safeCell(purpose), '동의', JOIN_VERSION, 'aibookclub.kr', '신규', safeCell(address)];
    var next = lastRow + 1;
    sheet.getRange(next, 1, 1, JOIN_HEADERS.length).setNumberFormat('@').setValues([row]);
    SpreadsheetApp.flush();
    return jsonOutput({ ok: true, saved: true, requestId: id });
  } catch (error) {
    return jsonOutput({ ok: false, code: error.message === 'INVALID' ? 'INVALID_INPUT' : 'SAVE_FAILED' });
  } finally {
    if (locked) lock.releaseLock();
  }
}
