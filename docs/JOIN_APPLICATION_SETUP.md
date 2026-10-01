# AI 독서클럽 가입 신청 — Google Sheets 연결 안내

현재 홈페이지 코드는 신청서, 서버 검증, Apps Script 전달, 결과 확인까지 준비되어 있습니다. 아직 실제 시트와 웹 앱이 없으므로 환경변수를 넣기 전에는 제출 버튼이 비활성화되고 `온라인 신청 접수 준비 중입니다.`가 표시됩니다.

## Codex가 완료한 작업

- `/join#application` 내부 신청서와 모바일 화면
- `/api/join-config` 준비 상태 확인 API와 `/api/join` 서버 API
- 입력 검증, 신청 ID 재사용, Apps Script 응답 본문 확인, 시간 초과 및 오류 처리
- Apps Script용 `google-apps-script/join-applications.gs`
- 공유 비밀값, 잠금, 신청 ID 중복 방지, 한국 시간, 수식 실행 방지, 전화번호 텍스트 저장 처리

## 운영자가 준비할 설정값

- Google Sheet의 `SPREADSHEET_ID`
- 시트 탭 이름(권장: `가입신청`)
- 직접 생성한 충분히 긴 `GOOGLE_APPS_SCRIPT_SHARED_SECRET` (Apps Script와 Vercel에 같은 값)
- 배포 후 `/exec`로 끝나는 `GOOGLE_APPS_SCRIPT_WEB_APP_URL`
- 확인된 개인정보 처리 운영자명 `JOIN_PRIVACY_OPERATOR_NAME`
- 확인된 개인정보 보유기간 `JOIN_PRIVACY_RETENTION_PERIOD`

비밀값은 채팅이나 GitHub에 붙여 넣지 말고 Apps Script 스크립트 속성과 Vercel 환경변수 화면에 직접 입력하세요.

## 연결 순서

1. **구글 시트 생성**  
   Google Drive → `새로 만들기` → `Google 스프레드시트`를 선택하고, 아래쪽 탭 이름을 `가입신청`으로 바꿉니다.

2. **첫 행에 열 제목 입력**  
   A1부터 I1까지 아래 순서로 정확히 입력합니다.  
   `신청일시 | 이름 | 휴대전화 | 이메일 | 관심 분야 | 개인정보 동의 | 소식 수신 동의 | 처리 상태 | 신청 ID`

3. **Apps Script 열기**  
   시트 메뉴 `확장 프로그램` → `Apps Script`를 선택합니다.

4. **코드 붙여 넣기**  
   기본 코드를 모두 지우고 `google-apps-script/join-applications.gs` 내용을 그대로 붙여 넣은 뒤 저장합니다.

5. **스크립트 속성 설정**  
   Apps Script 왼쪽 `프로젝트 설정(톱니바퀴)` → `스크립트 속성` → `스크립트 속성 추가`에서 다음 세 항목을 저장합니다.

   - `SPREADSHEET_ID`: 시트 주소의 `/d/`와 `/edit` 사이 문자열
   - `SHEET_NAME`: `가입신청`
   - `GOOGLE_APPS_SCRIPT_SHARED_SECRET`: 직접 만든 길고 무작위인 비밀값

6. **웹 앱으로 배포**  
   오른쪽 위 `배포` → `새 배포` → 유형 선택의 `웹 앱`을 선택합니다.

7. **실행 주체와 접근 권한 설정**  
   `다음 사용자로 실행`은 **나**, `액세스 권한이 있는 사용자`는 **모든 사용자**로 선택한 뒤 배포하고 권한을 승인합니다. Vercel 서버가 Google 로그인 없이 호출하므로 이 공개 호출 권한이 필요하며, 공유 비밀값으로 요청을 검증합니다.

   Google Workspace 정책 때문에 `모든 사용자`가 보이지 않고 `조직 내부 사용자`만 선택된다면 외부 Vercel 서버는 이 웹 앱을 호출할 수 없습니다. Workspace 관리자에게 외부 웹 앱 배포 허용을 요청하거나, 정책상 허용되는 별도 Google 계정/Google Cloud 인증 구조를 사용해야 합니다. 조직 내부 권한으로 배포한 뒤 연결됐다고 간주하지 마세요.

8. **배포 주소 복사**  
   배포 완료 화면에서 반드시 `/exec`로 끝나는 웹 앱 URL을 복사합니다. `/dev` 주소는 운영용이 아닙니다.

9. **Vercel 서버 환경변수 설정**  
   Vercel → 프로젝트 → `Settings` → `Environment Variables`에서 Production(필요하면 Preview도)에 다음 값을 입력합니다.

   - `GOOGLE_APPS_SCRIPT_WEB_APP_URL`: 8단계의 `/exec` 주소
   - `GOOGLE_APPS_SCRIPT_SHARED_SECRET`: 5단계와 같은 비밀값
   - `JOIN_PRIVACY_OPERATOR_NAME`: 실제 개인정보 처리 운영자명
   - `JOIN_PRIVACY_RETENTION_PERIOD`: 실제로 확정한 보유기간 문구(예: 법률·운영정책 검토 후 확정한 내용)

10. **재배포**  
    Vercel → `Deployments` → 최신 배포의 메뉴 → `Redeploy`를 선택합니다. 환경변수는 재배포 후 적용됩니다.

11. **실제 홈페이지에서 시험 신청**  
    `/join#application`을 열고 개인정보 안내의 운영자와 보유기간이 정확한지 확인한 뒤 테스트 신청을 제출합니다. 성공 문구는 Apps Script의 JSON 성공 응답과 신청 ID가 일치할 때만 표시됩니다.

12. **구글 시트 행 확인**  
    `가입신청` 탭에 한 행이 생성되었는지, 휴대전화 앞자리 `0`이 유지되는지, 한국 시간과 `신규` 상태 및 신청 ID가 기록됐는지 확인합니다. 같은 신청을 네트워크에서 재전송해도 행이 하나만 있어야 합니다.

## 운영 점검 메모

- Apps Script 코드를 변경하면 `배포` → `배포 관리`에서 새 버전으로 업데이트해야 합니다.
- `/exec` 주소를 브라우저에서 열면 연결 상태 JSON만 나오며 신청자 데이터는 반환하지 않습니다.
- Vercel 함수의 메모리 기반 요청 제한은 인스턴스별 기본 방어입니다. 트래픽이 커지면 Vercel Firewall/외부 영속 저장소 기반 제한을 추가하세요.
- 실제 시트 저장 성공·실패·중복 처리 검증은 위 환경변수 설정과 재배포 후 완료해야 합니다.
