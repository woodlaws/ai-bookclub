# 임헌수의 AI 독서클럽 — 다페이지 홈페이지

정적 HTML 사이트 (빌드 불필요). Vercel에 그대로 배포됩니다.

## 페이지 구조

| URL | 파일 | 내용 |
|---|---|---|
| `/` | `home.dc.html` | 홈 (메인 랜딩) |
| `/about` | `about.dc.html` | 클럽 소개 |
| `/books` | `books.dc.html` | 선정 도서 (2026년 8월 기준) |
| `/program` | `program.dc.html` | 프로그램 |
| `/ai` | `ai-use.dc.html` | AI 활용 |
| `/benefits` | `benefits.dc.html` | 멤버 혜택 |
| `/writing-school` | `writing-school.dc.html` | 비즈니스 책쓰기 스쿨 |
| `/join` | `join.dc.html` | 가입 안내 |

URL 매핑과 구 주소 301 리다이렉트는 `vercel.json`에서 처리합니다.

## GitHub 업로드

1. ZIP 압축 해제
2. GitHub 새 저장소 생성
3. 파일 전체 업로드 후 Commit

## Vercel 배포 설정

- Framework Preset: **Other**
- Root Directory: `./`
- Install Command: (비워둠)
- Build Command: (비워둠)
- Output Directory: (비워둠)
- Environment Variables: **필요 없음**

## 배포 후 확인할 주소

`/` `/about` `/books` `/program` `/ai` `/benefits` `/writing-school` `/join`
`/og-image.png` `/favicon.png` `/apple-touch-icon.png` `/robots.txt` `/sitemap.xml` `/llms.txt`

## 카카오톡 공유 미리보기

`/og-image.png`가 직접 열리는지 확인 후, 카카오 디버거에서 캐시 초기화:
https://developers.kakao.com/tool/debugger/sharing
(`도메인`, `도메인/`, `도메인/?v=2` 각각 초기화)

## 추후 수정 항목

- **도메인 연결 시** — 각 페이지 `canonical`, `og:url`, `sitemap.xml`, `robots.txt`의 도메인을 실제 도메인으로 교체 (현재 `https://ai-bookclub.vercel.app` 기준)
- **책쓰기스쿨 지원 폼** — `writing-school.dc.html`의 `/join` 링크를 전용 신청 폼 URL로 교체
- **선정 도서 갱신** — `books.dc.html`의 `#current-books` 섹션과 월별 아카이브 수정
- 가입 신청 폼: `https://forms.gle/QDwMA7CM3oxFNQK37`
