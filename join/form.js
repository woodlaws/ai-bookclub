(function () {
  'use strict';
  const version = '2026-09-30-v1';
  const initialized = new WeakSet();
  let readiness;
  let requestId;
  let pending = false;
  let completed = false;
  function form() { return document.getElementById('club-application'); }
  function message(text, state) {
    const target = document.getElementById('application-status');
    if (!target) return;
    target.textContent = text;
    target.dataset.state = state;
    target.setAttribute('role', state === 'error' ? 'alert' : 'status');
  }
  function init() {
    const target = form();
    if (!target || initialized.has(target)) return;
    initialized.add(target);
    if (!readiness) readiness = fetch('/api/join', { cache: 'no-store' }).then(async response => {
      const result = await response.json();
      return { ready: response.ok && result.configured === true, message: result.message };
    }).catch(() => ({ ready: false, message: '접수 상태를 확인하지 못했습니다.' }));
    readiness.then(result => {
      if (!target.isConnected || completed) return;
      const button = target.querySelector('[type="submit"]');
      button.disabled = !result.ready || pending;
      button.textContent = '가입 신청하기';
      message(result.ready ? '필수 항목을 입력한 뒤 신청해 주세요.' : '현재 신청 접수를 준비 중입니다. 잠시 후 다시 방문해 주세요.', result.ready ? 'ready' : 'unavailable');
    });
  }
  document.addEventListener('submit', async event => {
    const target = event.target;
    if (!(target instanceof HTMLFormElement) || target.id !== 'club-application') return;
    event.preventDefault();
    if (pending || completed || !target.reportValidity()) return;
    const state = await readiness;
    if (!state?.ready) { message('현재 신청 접수를 준비 중입니다. 잠시 후 다시 방문해 주세요.', 'error'); return; }
    const data = new FormData(target);
    if (!requestId) requestId = crypto.randomUUID();
    const payload = { requestId, name: data.get('name'), phone: data.get('phone'), email: data.get('email'),
      address: data.get('address'), purpose: data.get('purpose'), website: data.get('website'),
      privacyConsent: data.get('privacyConsent') === 'on', privacyConsentVersion: version };
    const button = target.querySelector('[type="submit"]');
    pending = true;
    button.disabled = true;
    button.textContent = '신청 접수 중…';
    target.setAttribute('aria-busy', 'true');
    message('신청 내용을 접수하고 있습니다. 잠시 기다려 주세요.', 'loading');
    try {
      const response = await fetch('/api/join', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(45000) });
      const result = await response.json();
      if (!response.ok || result.ok !== true || result.saved !== true || result.requestId !== requestId) {
        // A validation error is known not to have saved a row; permit corrections under a new request ID.
        if (response.status === 400) requestId = undefined;
        throw new Error(result.message || '접수 결과를 확인하지 못했습니다. 다시 시도해 주세요.');
      }
      completed = true;
      target.hidden = true;
      const success = document.getElementById('application-success');
      success.hidden = false;
      success.querySelector('[data-receipt]').textContent = requestId;
      success.focus();
      message(result.message, 'success');
    } catch (error) {
      message(error.name === 'TimeoutError' ? '접수 결과를 확인하지 못했습니다. 입력 내용을 유지한 채 다시 시도해 주세요.' : (error.message || '접수 결과를 확인하지 못했습니다. 다시 시도해 주세요.'), 'error');
    } finally {
      pending = false;
      target.removeAttribute('aria-busy');
      if (!completed) { button.disabled = false; button.textContent = '다시 신청하기'; }
    }
  });
  document.addEventListener('DOMContentLoaded', init);
  new MutationObserver(init).observe(document.documentElement, { childList: true, subtree: true });
  init();
}());
