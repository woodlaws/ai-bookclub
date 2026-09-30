# 연결 및 운영 안내

## 1. Supabase 연결

1. **반드시 AI 독서클럽 대상 프로젝트인지** 프로젝트 이름과 URL을 확인합니다. 다른 홈페이지 프로젝트에서는 실행하지 마세요.
2. SQL Editor에서 `supabase/migrations/202609300001_community_board.sql`을 Supabase AI로 먼저 검토한 뒤 실행합니다.
3. Database의 Tables에서 새 테이블, Storage에서 비공개 `community-private` 버킷이 생성되었는지 확인합니다.
4. SQL Editor에서 Security/Performance Advisor를 실행하고 경고를 검토합니다.

## 2. Vercel 환경변수

Vercel → 기존 `aibookclub` 프로젝트 → Settings → Environment Variables에 다음 두 값을 Production/Preview/Development에 등록한 뒤 재배포합니다.

- `SUPABASE_URL`: Project Settings → API의 Project URL
- `SUPABASE_PUBLISHABLE_KEY`: Project Settings → API Keys의 publishable key

secret key 또는 legacy `service_role` 키는 등록하거나 브라우저/대화/GitHub에 공개하지 않습니다. `.env.example`은 이름 예시뿐이며 실제 값은 커밋하지 않습니다.

## 3. 이메일 인증

1. Supabase → Authentication → Sign In / Providers → Email에서 이메일 로그인을 켭니다.
2. Email OTP가 코드 방식이 되도록 Magic Link 템플릿을 `{{ .Token }}`을 포함한 한국어 안내로 설정합니다.
3. URL Configuration의 Site URL을 `https://aibookclub.vercel.app`으로 설정합니다.
4. Redirect URLs에 `https://aibookclub.vercel.app/**`와 필요한 Preview URL만 등록합니다.
5. 운영 도메인 발신자/SMTP를 설정하고 외부 이메일에서 실제 수신, 만료, 재전송을 확인합니다.

## 4. 최초 관리자 지정

관리자로 쓸 실제 이메일 계정으로 홈페이지에서 한 번 인증해야 `profiles` 행이 생깁니다. 그 다음 SQL Editor에서 이메일만 바꿔 아래 문장을 한 번 실행합니다. 최초 가입자를 자동 관리자로 만들지 않습니다.

```sql
update public.profiles p
set role = 'admin', membership_status = 'approved', updated_at = now()
from auth.users u
where p.id = u.id and lower(u.email) = lower('실제-관리자-이메일@example.com');
```

실행 뒤 `select`로 해당 한 행만 변경됐는지 확인하고 로그아웃 후 다시 로그인합니다.

## 5. 운영 방법

- 공지 작성: 로그인 → 상단 **관리자** → 공지·일정 탭 → **글쓰기** → 공개 범위와 상단 고정 설정
- 자료 업로드: 자료실 → **글쓰기** → 자료 유형/공개 범위 선택 → 파일 또는 다시보기 URL 등록
- 회원 승인: 관리자 화면 → **회원 승인** → 대상 이름 확인 → **회원 승인**. 해제 시 새 회원 파일 다운로드 URL 발급도 차단됩니다.
- 후기 승인: 관리자 화면 → **후기 승인** → 내용을 확인 → **공개 승인**. 공개 동의 없는 후기는 승인되지 않습니다.
- 문의 답변: 관리자 화면 → **문의 답변** → 문의 확인 → 답변 입력. 저장되면 상태가 답변 완료로 바뀝니다.

## 6. 배포 전 실제 계정 검수

방문자, 승인 전 계정, 회원 A, 회원 B, 관리자 계정을 별도로 사용해 `ToDo.md`의 연결 후 검수 목록을 확인합니다. 브라우저 버튼뿐 아니라 직접 URL과 Supabase API/RLS Tester에서도 차단되는지 검증합니다. Supabase AI가 SQL을 변경했다면 배포 전에 `community/community.js`의 테이블·컬럼·RPC 이름도 같은 값으로 수정합니다.
