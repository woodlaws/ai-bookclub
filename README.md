# 임헌수의 AI 독서클럽 — 다페이지 홈페이지

정적 HTML 사이트 (빌드 불필요). Vercel에 그대로 배포됩니다.

## 페이지 구조

| URL | 파일 | 내용 |
|---|---|---|
| `/` | `index.html` | 홈 (메인 랜딩) |
| `/about` | `about/index.html` | 클럽 소개 |
| `/books` | `books/index.html` | 선정 도서 (2026년 8월 기준) |
| `/program` | `program/index.html` | 프로그램 |
| `/ai` | `ai/index.html` | AI 활용 |
| `/benefits` | `benefits/index.html` | 멤버 혜택 |
| `/writing-school` | `writing-school/index.html` | 비즈니스 책쓰기 스쿨 |
| `/join` | `join/index.html` | 가입 안내 |

폴더형 `index.html` 구조라 Vercel에서 별도 rewrite 없이 clean URL이 그대로 동작합니다. 구 `.dc.html` 주소는 `vercel.json`의 301 리다이렉트로 처리됩니다.

공통 자산(`support.js`, `uploads/`, 파비콘)은 루트에 있으며, 하위 페이지는 `../` 상대경로로 참조합니다.

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
- **책쓰기스쿨 지원 폼** — `writing-school/index.html`의 `/join` 링크를 전용 신청 폼 URL로 교체
- **선정 도서 갱신** — `books/index.html`의 `#current-books` 섹션과 월별 아카이브 수정
- 가입 신청 폼: `https://forms.gle/QDwMA7CM3oxFNQK37`
