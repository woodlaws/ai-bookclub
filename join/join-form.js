(() => {
  const ready = () => {
    const form = document.getElementById('join-form');
    if (!form || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';
    const startedAt = Date.now();
    let configured = false;

    const setStatus = (message, type = '') => {
      const currentStatus = document.getElementById('join-status');
      if (!currentStatus) return;
      currentStatus.textContent = message;
      currentStatus.className = `form-status ${type}`.trim();
    };
    const fieldError = (name, message) => {
      const node = document.getElementById(`${name}-error`);
      if (node) node.textContent = message || '';
    };
    const validate = () => {
      ['name', 'phone', 'email', 'privacy'].forEach((name) => fieldError(name, ''));
      const name = form.elements.name.value.trim();
      const phone = form.elements.phone.value.replace(/\D/g, '');
      const email = form.elements.email.value.trim();
      let valid = true;
      if (name.length < 2 || name.length > 40) { fieldError('name', '이름은 2~40자로 입력해 주세요.'); valid = false; }
      if (!/^01[016789]\d{7,8}$/.test(phone)) { fieldError('phone', '휴대전화 번호를 확인해 주세요.'); valid = false; }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { fieldError('email', '이메일 형식을 확인해 주세요.'); valid = false; }
      if (!form.elements.privacyConsent.checked) { fieldError('privacy', '필수 개인정보 수집·이용 동의가 필요합니다.'); valid = false; }
      return valid;
    };
    const getApplicationId = () => {
      let id = sessionStorage.getItem('joinApplicationId');
      if (!id) {
        id = `JOIN-${crypto.randomUUID()}`;
        sessionStorage.setItem('joinApplicationId', id);
      }
      return id;
    };

    fetch('/api/join-config', { headers: { accept: 'application/json' }, cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || body.ok !== true) throw new Error('config');
        document.getElementById('privacy-operator').textContent = body.privacy?.operatorName || '설정 필요';
        document.getElementById('privacy-retention').textContent = body.privacy?.retentionPeriod || '설정 필요';
        configured = body.configured === true;
        document.getElementById('join-submit').disabled = !configured;
        setStatus(configured ? '신청 내용을 입력해 주세요.' : '온라인 신청 접수 준비 중입니다.');
      })
      .catch(() => {
        document.getElementById('join-submit').disabled = true;
        setStatus('온라인 신청 접수 준비 중입니다.');
      });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!configured) return setStatus('온라인 신청 접수 준비 중입니다.');
      if (!validate()) return setStatus('입력 내용을 확인해 주세요.', 'error');
      const submit = document.getElementById('join-submit');
      submit.disabled = true;
      submit.textContent = '접수 중…';
      setStatus('신청 내용을 안전하게 저장하고 있습니다.');
      const payload = {
        applicationId: getApplicationId(),
        name: form.elements.name.value,
        phone: form.elements.phone.value,
        email: form.elements.email.value,
        interest: form.elements.interest.value,
        privacyConsent: form.elements.privacyConsent.checked,
        newsConsent: form.elements.newsConsent.checked,
        website: form.elements.website.value,
        startedAt,
        source: `${location.pathname}${location.hash}`,
      };
      try {
        const response = await fetch('/api/join', {
          method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(payload),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok || body?.ok !== true || body.applicationId !== payload.applicationId) throw new Error(body?.message || '신청을 저장하지 못했습니다.');
        form.reset();
        sessionStorage.removeItem('joinApplicationId');
        configured = false;
        setStatus('신청이 접수되었습니다. 입력하신 연락처로 참여 안내를 드리겠습니다.', 'success');
      } catch (error) {
        submit.disabled = false;
        setStatus(error?.message || '신청을 저장하지 못했습니다. 입력 내용은 그대로 유지됩니다. 잠시 후 다시 시도해 주세요.', 'error');
      } finally {
        submit.textContent = '독서클럽 신청하기';
      }
    });
  };
  const start = () => setTimeout(ready, 150);
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
})();
