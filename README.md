# 임헌수의 AI 독서클럽

AI 시대에 책을 더 깊이 읽고, 매일 인증하며, 월 2회 새벽 줌미팅으로 실행을 만드는 프리미엄 독서클럽 웹사이트.

## 페이지 구조

| 경로 | 파일 | 설명 |
|------|------|------|
| `/` | home.dc.html | 메인 랜딩 |
| `/about` | about.dc.html | 클럽 소개 |
| `/books` | books.dc.html | 선정 도서 |
| `/program` | program.dc.html | 프로그램 안내 |
| `/ai-use` | ai-use.dc.html | AI 활용법 |
| `/benefits` | benefits.dc.html | 멤버 혜택 |
| `/join` | join.dc.html | 가입 안내 |

## GitHub → Vercel 배포 방법

### 1. GitHub 업로드
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ai-bookclub.git
git push -u origin main
```

### 2. Vercel 연결
1. [vercel.com](https://vercel.com) 로그인
2. **Add New Project** → GitHub 저장소 선택
3. Framework Preset: **Other** (빌드 없음)
4. **Deploy** 클릭

### 3. 커스텀 도메인 (선택)
- Vercel 대시보드 → Settings → Domains
- `aireadingclub.kr` 등 도메인 추가 후 DNS 설정

### 4. 배포 후 OG 이미지 경로 업데이트
도메인이 확정되면 각 `.dc.html` 파일의 `og:image` URL을 실제 도메인으로 변경:
```
https://ai-bookclub.vercel.app/og-image.png
→ https://YOUR_DOMAIN/og-image.png
```

## 로컬 미리보기
별도 빌드 없이 정적 서버로 실행:
```bash
npx serve .
# 또는
python3 -m http.server 3000
```

## 파일 구조
```
/
├── home.dc.html        # 홈
├── about.dc.html       # 클럽 소개
├── books.dc.html       # 선정 도서
├── program.dc.html     # 프로그램
├── ai-use.dc.html      # AI 활용
├── benefits.dc.html    # 멤버 혜택
├── join.dc.html        # 가입 안내
├── support.js          # DC 런타임 (수정 금지)
├── index.html          # 루트 리다이렉트
├── vercel.json         # Vercel URL 라우팅
├── robots.txt          # 검색엔진 크롤링
├── sitemap.xml         # 사이트맵
├── og-image.png        # SNS 공유 이미지
├── favicon.png         # 파비콘
└── uploads/            # 이미지 에셋
```
