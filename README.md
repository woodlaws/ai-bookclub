# 임헌수의 AI 독서클럽 — 홈페이지

## 프로젝트 유형
**정적 HTML** (빌드 도구 불필요 · Node.js 불필요)  
Design Component 런타임(`support.js`)을 사용하는 멀티페이지 정적 사이트입니다.

---

## 페이지 구조

| URL | 파일 |
|---|---|
| `/` | `AI독서클럽 랜딩페이지.dc.html` |
| `/about` | `about.dc.html` |
| `/books` | `books.dc.html` |
| `/program` | `program.dc.html` |
| `/ai-use` | `ai-use.dc.html` |
| `/benefits` | `benefits.dc.html` |
| `/join` | `join.dc.html` |

Vercel 클린 URL 라우팅은 `vercel.json`에 설정되어 있습니다.

---

## GitHub 업로드 방법

1. ZIP 파일 압축 해제
2. GitHub 새 저장소 생성 (Public 권장)
3. 압축 해제된 파일 전체를 저장소 루트에 업로드
4. `Commit changes` 클릭

또는 Git CLI:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

---

## Vercel 배포 방법

1. [vercel.com](https://vercel.com) → **Add New Project**
2. GitHub 저장소 Import
3. 아래 설정 입력:

| 항목 | 값 |
|---|---|
| Framework Preset | **Other** |
| Root Directory | `./` |
| Install Command | *(비워두기)* |
| Build Command | *(비워두기)* |
| Output Directory | *(비워두기)* |
| Environment Variables | 없음 |

4. **Deploy** 클릭

---

## 배포 후 확인할 URL

배포 후 아래 주소가 모두 정상 열리는지 확인하세요.

- `/` — 홈
- `/about` — 클럽 소개
- `/books` — 선정 도서
- `/program` — 프로그램
- `/ai-use` — AI 활용
- `/benefits` — 멤버 혜택
- `/join` — 가입 안내
- `/robots.txt`
- `/sitemap.xml`
- `/llms.txt`
- `/og-image.svg`
- `/favicon.svg`

---

## 도메인 연결 후 반드시 수정할 항목

도메인이 확정되면 아래 파일의 `aireadingclub.kr`을 실제 도메인으로 일괄 교체하세요.

- `robots.txt` — `Sitemap:` URL
- `sitemap.xml` — `<loc>` URL 7개
- 각 `.dc.html` 파일 — `canonical`, `og:url` 메타 태그

---

## 추후 콘텐츠 입력 필요 항목

| 항목 | 위치 | 비고 |
|---|---|---|
| 구글 폼 링크 | `join.dc.html` 신청 버튼 | `href="#"` → 실제 폼 URL로 교체 |
| 클럽 소개 영상 링크 | `AI독서클럽 랜딩페이지.dc.html` 히어로 버튼 | `href="#"` → 유튜브 등 URL |
| 이용약관 / 개인정보처리방침 | 모든 페이지 푸터 | `href="#"` → 실제 URL |

---

## 포함된 주요 파일

```
├── AI독서클럽 랜딩페이지.dc.html  ← 홈 페이지
├── about.dc.html
├── books.dc.html
├── program.dc.html
├── ai-use.dc.html
├── benefits.dc.html
├── join.dc.html
├── support.js                       ← DC 런타임 (삭제 금지)
├── index.html                       ← 홈 리다이렉트
├── vercel.json                      ← 클린 URL 라우팅
├── robots.txt
├── sitemap.xml
├── llms.txt
├── og-image.svg                     ← SNS 공유 이미지
├── favicon.svg                      ← 브라우저 아이콘
├── README.md
└── uploads/                         ← 모든 이미지 파일
```

---

## 카카오톡 OG 미리보기

배포 후 카카오톡 공유 시 미리보기가 안 보이면 캐시 초기화가 필요합니다.  
👉 [카카오 OG 캐시 초기화](https://developers.kakao.com/tool/clear/og)에서 사이트 URL 입력 후 초기화하세요.
