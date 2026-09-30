import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,join,normalize} from 'node:path';

const root=process.cwd();
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{
  try{
    if(req.url==='/api/config'){res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({configured:false,message:'게시판 연결 준비 중입니다. 운영자에게 문의해 주세요.'}));return;}
    let pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname==='/community') {res.writeHead(307,{location:'/community/notices'});res.end();return;}
    if((pathname.startsWith('/community/')&&!extname(pathname))||pathname==='/admin/community') pathname='/community/index.html';
    else if(pathname.endsWith('/')) pathname+='index.html';
    const file=normalize(join(root,pathname));
    if(!file.startsWith(root))throw new Error('blocked');
    const body=await readFile(file);res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(body);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(4173,'127.0.0.1',()=>console.log('http://127.0.0.1:4173'));
