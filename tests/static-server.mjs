import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,join,normalize} from 'node:path';

const root=process.cwd();
const port=Number(process.env.JOIN_TEST_PORT||4173);
const joinMode=process.env.JOIN_TEST_MODE||'missing';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{
  try{
    if(req.url==='/api/config'){res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({configured:false,message:'게시판 연결 준비 중입니다. 운영자에게 문의해 주세요.'}));return;}
    if(req.url==='/api/join-config'){
      const configured=joinMode!=='missing';
      res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
      res.end(JSON.stringify({ok:true,configured,privacy:{operatorName:configured?'검수용 운영자':'',retentionPeriod:configured?'검수용 보유기간':''}}));return;
    }
    if(req.url==='/api/join'&&req.method==='POST'){
      let body='';for await(const chunk of req)body+=chunk;
      const data=JSON.parse(body||'{}');
      if(joinMode==='success'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,applicationId:data.applicationId,duplicate:false}));return;}
      res.writeHead(502,{'content-type':'application/json'});res.end(JSON.stringify({ok:false,message:'신청을 저장하지 못했습니다. 입력 내용은 그대로 유지됩니다. 잠시 후 다시 시도해 주세요.'}));return;
    }
    let pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname==='/community') {res.writeHead(307,{location:'/community/notices'});res.end();return;}
    if((pathname.startsWith('/community/')&&!extname(pathname))||pathname==='/admin/community') pathname='/community/index.html';
    else if(pathname.endsWith('/')) pathname+='index.html';
    const file=normalize(join(root,pathname));
    if(!file.startsWith(root))throw new Error('blocked');
    const body=await readFile(file);res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(body);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`http://127.0.0.1:${port}`));
