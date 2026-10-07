# AI 독서클럽 가입 신청 — Google Sheets API 연결

홈페이지의 `/join#application` 폼은 `/api/join` Vercel Function을 통해 Google Sheets API에 직접 저장합니다. 브라우저에는 서비스 계정이나 시트 식별자가 전달되지 않습니다.

## Production 환경 변수

Vercel Production에 다음 서버 전용 값을 등록합니다. 실제 값은 Git, 브라우저 코드, 로그에 남기지 않습니다.

- `GOOGLE_SERVICE_ACCOUNT_JSON`: Google 서비스 계정 JSON 전체를 Secret으로 저장
- `GOOGLE_SHEET_ID`: 대상 스프레드시트 ID
- `GOOGLE_SHEET_NAME`: 대상 탭 이름

개인정보 안내에 표시할 운영자와 보유기간이 확정된 경우에만 아래 값을 추가합니다. 값을 추측해서 입력하지 않습니다.

- `JOIN_PRIVACY_OPERATOR_NAME`
- `JOIN_PRIVACY_RETENTION_PERIOD`

## 시트 저장 형식

`시트명!A:G`에 다음 순서로 한 행을 추가합니다.

1. 신청일시 — 서버가 생성한 한국 시간
2. 이름
3. 휴대전화
4. 이메일
5. 관심 분야
6. 개인정보 수집·이용 동의 — `동의` 또는 `미동의`
7. 소식 수신 동의 — `동의` 또는 `미동의`

Sheets append 요청은 `valueInputOption=RAW`와 `insertDataOption=INSERT_ROWS`를 사용합니다. 휴대전화는 문자열로 전달해 앞자리 `0`을 보존하며, 수식 기호로 시작하는 텍스트는 서버에서 중립화합니다.

## 보안과 오류 처리

- 이름, 휴대전화, 필수 개인정보 동의는 서버에서 다시 검증합니다.
- 이메일과 관심 분야는 선택 입력이며, 관심 분야는 폼의 선택지만 허용합니다.
- 허니팟, 최소 작성 시간, 요청 본문 크기 제한, 인스턴스 단위 요청 제한을 적용합니다.
- Google Sheets가 한 행 저장을 확인한 뒤에만 성공 응답을 반환합니다.
- 실패 응답에는 인증 정보, 시트 정보, 개인정보를 포함하지 않습니다.
- Production Secret은 Preview나 로컬에 있다고 가정하지 않습니다.

## 배포 후 확인

1. Production을 새로 배포합니다.
2. `/api/join-config`가 `configured: true`를 반환하는지 확인합니다.
3. `/join#application`에서 실제 사람이 아닌 테스트 연락처로 1건을 제출합니다.
4. `시트1`의 마지막 행에서 A:G 순서, 한국 시간, 휴대전화 앞자리 `0`, 동의 값을 확인합니다.
5. 개인정보 안내의 `설정 필요` 문구는 운영자·보유기간이 확정되기 전까지 남아 있을 수 있습니다.
