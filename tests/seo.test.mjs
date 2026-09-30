import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const verification = '<meta name="naver-site-verification" content="d6bb19bc73e7eb1970b9c739e5875321d80ffdd7" />';

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    const full = join(directory, name);
    return statSync(full).isDirectory() && name !== '.git' ? walk(full) : [full];
  });
}

test('모든 HTML은 정적 head에 네이버 인증과 대표 URL을 한 번만 제공한다', () => {
  const htmlFiles = walk(root).filter((file) => file.endsWith('.html'));
  assert.ok(htmlFiles.length > 0);
  for (const file of htmlFiles) {
    const source = readFileSync(file, 'utf8');
    const head = source.slice(0, source.indexOf('</head>'));
    assert.equal(source.split(verification).length - 1, 1, file);
    assert.ok(head.includes(verification), file);
    assert.equal((source.match(/rel="canonical"/g) || []).length, 1, file);
    assert.equal((source.match(/property="og:url"/g) || []).length, 1, file);
    assert.match(source, /(?:rel="canonical" href|property="og:url" content)="https:\/\/aibookclub\.kr(?:\/|\")/, file);
    assert.doesNotMatch(source, /(?:ai-bookclub|aibookclub)\.vercel\.app|aireadingclub\.kr/, file);
  }
});

test('robots와 사이트맵은 대표 도메인과 비공개 경로 제한을 유지한다', () => {
  const robots = readFileSync(join(root, 'robots.txt'), 'utf8');
  const index = readFileSync(join(root, 'sitemap.xml'), 'utf8');
  const statics = readFileSync(join(root, 'sitemap-static.xml'), 'utf8');
  assert.match(robots, /Sitemap: https:\/\/aibookclub\.kr\/sitemap\.xml/);
  assert.match(robots, /Disallow: \/admin\//);
  assert.match(robots, /Disallow: \/community\/records/);
  assert.match(robots, /Disallow: \/community\/inquiries/);
  assert.match(index, /https:\/\/aibookclub\.kr\/sitemap-static\.xml/);
  assert.match(index, /https:\/\/aibookclub\.kr\/api\/community-sitemap/);
  assert.doesNotMatch(statics, /\/admin\/|\/community\/records|\/community\/inquiries/);
  assert.doesNotMatch(`${robots}${index}${statics}`, /\.vercel\.app/);
});

test('동적 게시판 대표 URL도 새 도메인을 사용한다', () => {
  const community = readFileSync(join(root, 'community', 'community.js'), 'utf8');
  const dynamicSitemap = readFileSync(join(root, 'api', 'community-sitemap.js'), 'utf8');
  assert.match(community, /https:\/\/aibookclub\.kr\/community\//);
  assert.match(dynamicSitemap, /SITE_URL='https:\/\/aibookclub\.kr'/);
  assert.doesNotMatch(`${community}${dynamicSitemap}`, /\.vercel\.app/);
});
