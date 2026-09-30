import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {validateFiles,safeReturnTo,safeHttpUrl,formatBytes}=require('../community/community.js');

test('허용 파일과 크기를 검증한다',()=>{
  assert.equal(validateFiles([{name:'자료.pdf',type:'application/pdf',size:1024}]),'');
  assert.match(validateFiles([{name:'악성.html',type:'text/html',size:10}]),/지원하지 않는/);
  assert.match(validateFiles([{name:'큰파일.pdf',type:'application/pdf',size:21*1024*1024}]),/20MB/);
  assert.match(validateFiles(Array.from({length:6},(_,i)=>({name:`${i}.pdf`,type:'application/pdf',size:1}))),/최대 5개/);
});
test('로그인 복귀 경로는 사이트 내부만 허용한다',()=>{
  assert.equal(safeReturnTo('/community/inquiries'),'/community/inquiries');
  assert.equal(safeReturnTo('//evil.example'),'/community/notices');
  assert.equal(safeReturnTo('https://evil.example'),'/community/notices');
});
test('외부 링크는 http와 https만 허용한다',()=>{
  assert.equal(safeHttpUrl('javascript:alert(1)'),null);
  assert.equal(safeHttpUrl('https://example.com/video'),'https://example.com/video');
});
test('파일 크기 표시',()=>assert.equal(formatBytes(1048576),'1.0 MB'));
