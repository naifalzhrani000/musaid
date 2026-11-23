const S3O=process.env.S3_ENDPOINT?' '+(()=>{const u=new URL(process.env.S3_ENDPOINT);return process.env.S3_VHOST==='1'&&process.env.S3_BUCKET?`${u.protocol}//${process.env.S3_BUCKET}.${u.host}`:u.origin})():'';
import {SKILL_SEED, ASSIST_CITIES, CANCEL_REASONS} from './data.js';
import {record as recordMetric} from './src/metrics.js';
import {DatabaseSync} from 'node:sqlite';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import zlib from 'node:zlib';
const apiHits=new Map();
const INDEX_RAW=fs.readFileSync(new URL('./public/index.html',import.meta.url),'utf8');const INDEX_HTML=()=>{const b=(process.env.APP_URL||'').replace(/\/$/,'');return b?INDEX_RAW.replace('content="/og.png"',`content="${b}/og.png"`):INDEX_RAW};
const STATIC={};for(const f of ['app.css','app.js','admin.js','splash.js']){const body=fs.readFileSync(new URL('./public/'+f,import.meta.url));STATIC['/'+f]={type:f.endsWith('.css')?'text/css; charset=utf-8':'application/javascript; charset=utf-8',body,gz:zlib.gzipSync(body,{level:9}),etag:'"'+crypto.createHash('sha1').update(body).digest('hex').slice(0,16)+'"'}};
import {PORT, db, err, userOf, R, get, pushCfg, pushKeyProblem, vacuumTo} from './src/core.js';
import {pipeline} from 'node:stream';
// اسم الكوكي مثبّت في بداية الاسم: لا يطابق مثل xsid أو mysid
const sidOf=req=>/(?:^|;\s*)sid=(\w+)/.exec(req.headers.cookie||'')?.[1];
import './src/routes/messages.js';
import './src/routes/shared.js';
import './src/routes/account.js';
import './src/routes/feed.js';
import './src/routes/follow.js';
import './src/routes/accounting.js';
import './src/routes/admin.js';
import './src/routes/ai.js';
import {startScheduler as startAi} from './src/ai/center.js';
// ---- عنوان العميل: لا يُقرأ من الرأس إلا خلف وكيل موثوق (TRUST_PROXY=1) ----
const TRUST_PROXY=process.env.TRUST_PROXY==='1';
const clientIp=req=>{if(process.env.CF_PROXY==='1'&&req.headers['cf-connecting-ip']){const c=String(req.headers['cf-connecting-ip']).trim();if(c)return c}if(TRUST_PROXY){const x=String(req.headers['x-forwarded-for']||'').split(',').pop().trim();if(x)return x}return req.socket.remoteAddress||''};
// ---- بريد عند وصول رسالة جديدة (مرة كل 15 دقيقة لكل محادثة) ----
// ---- نسخ احتياطي تلقائي دوري ----
const BACKUP_DIR=process.env.BACKUP_DIR||path.join(path.dirname(path.resolve(process.env.DB_FILE||'data.db')),'backups');
const BACKUP_EVERY=Math.max(60,+process.env.BACKUP_EVERY_SECONDS||24*3600);
const BACKUP_KEEP=Math.max(1,+process.env.BACKUP_KEEP||14);
const runBackup=()=>{fs.mkdirSync(BACKUP_DIR,{recursive:true,mode:0o700});const f=path.join(BACKUP_DIR,`backup-${new Date().toISOString().replace(/[:.]/g,'-')}.db`);vacuumTo(f);
  const old=fs.readdirSync(BACKUP_DIR).filter(x=>/^backup-.*\.db$/.test(x)).sort().reverse().slice(BACKUP_KEEP);for(const x of old)fs.unlinkSync(path.join(BACKUP_DIR,x));return f};
const pruneFailed=()=>{db.exec("DELETE FROM failed_searches WHERE at<datetime('now','-30 days')");db.exec('DELETE FROM failed_searches WHERE id NOT IN (SELECT id FROM failed_searches ORDER BY id DESC LIMIT 5000)')};
const backupTick=()=>{try{pruneFailed();db.prepare('DELETE FROM sessions WHERE exp<?').run(Date.now());const f=runBackup();console.log('backup: تم إنشاء نسخة احتياطية',path.basename(f))}catch(e){console.error('backup: فشل النسخ الاحتياطي:',e.message)}};
setTimeout(backupTick,5000).unref();
setInterval(backupTick,BACKUP_EVERY*1000).unref();
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://x');if(url.pathname.startsWith('/api')){const t0=process.hrtime.bigint();res.on('finish',()=>recordMetric(req.method,url.pathname,res.statusCode,Number(process.hrtime.bigint()-t0)/1e6))}res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');res.setHeader('Strict-Transport-Security','max-age=31536000');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self'"+S3O+"; media-src 'self'"+S3O+"; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
if(/^\/fonts\/[a-z0-9-]+\.woff2$/.test(url.pathname)){res.setHeader('Content-Type','font/woff2');res.setHeader('Cache-Control','public, max-age=604800');return res.end(fs.readFileSync(new URL('./public'+url.pathname,import.meta.url)))}
if(STATIC[url.pathname]){const S=STATIC[url.pathname];res.setHeader('Content-Type',S.type);res.setHeader('ETag',S.etag);res.setHeader('Cache-Control','no-cache');res.setHeader('Vary','Accept-Encoding');if(req.headers['if-none-match']===S.etag){res.statusCode=304;return res.end()}if(String(req.headers['accept-encoding']||'').includes('gzip')){res.setHeader('Content-Encoding','gzip');res.setHeader('Content-Length',S.gz.length);return res.end(S.gz)}res.setHeader('Content-Length',S.body.length);return res.end(S.body)}
if(/^\/(logo|logo-new|admin-logo|hand|icon-192|icon-512|icon-maskable-192|icon-maskable-512|og|vat-logo|business-logo)\.png$|^\/splash\.(jpg|webp)$/.test(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.webp')?'image/webp':url.pathname.endsWith('.jpg')?'image/jpeg':'image/png');res.setHeader('Cache-Control','public,max-age=86400');return res.end(fs.readFileSync(new URL('./public'+url.pathname,import.meta.url)))}
if(url.pathname==='/healthz'){try{db.prepare('SELECT 1').get();res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');return res.end('{"ok":true}')}catch{res.statusCode=503;return res.end('{"ok":false}')}}
if(url.pathname==='/sw.js'){res.setHeader('Content-Type','application/javascript; charset=utf-8');res.setHeader('Cache-Control','no-cache');return res.end(fs.readFileSync(new URL('./public/sw.js',import.meta.url)))}
if(url.pathname==='/manifest.webmanifest'){res.setHeader('Content-Type','application/manifest+json; charset=utf-8');res.setHeader('Cache-Control','public,max-age=86400');return res.end(fs.readFileSync(new URL('./public/manifest.webmanifest',import.meta.url)))}
if(url.pathname==='/robots.txt'){res.setHeader('Content-Type','text/plain; charset=utf-8');const base=(process.env.APP_URL||'').replace(/\/$/,'');return res.end(`User-agent: *\nAllow: /\nDisallow: /api/\n${base?`Sitemap: ${base}/sitemap.xml\n`:''}`)}
if(url.pathname==='/sitemap.xml'){const base=(process.env.APP_URL||'').replace(/\/$/,'');if(!base){res.statusCode=404;return res.end('not found')}res.setHeader('Content-Type','application/xml; charset=utf-8');return res.end(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base}/</loc></url></urlset>`)}
if(!url.pathname.startsWith('/api')){res.setHeader('Content-Type','text/html;charset=utf-8');return res.end(INDEX_HTML())}
let bytes=0;const isRaw=url.pathname==='/api/upload-raw',chunks=[];const preTok=sidOf(req);const preAdmin=url.pathname==='/api/admin/restore/preview'&&userOf(preTok)?.role==='admin';for await(const ch of req){bytes+=ch.length;if(bytes>(url.pathname==='/api/upload'?7e6:url.pathname==='/api/upload-video'?12e6:isRaw?6e7:preAdmin?3e7:1e5))throw err(413,'الطلب كبير');chunks.push(ch)}
const bodyBuf=Buffer.concat(chunks),raw=isRaw?'':bodyBuf.toString('utf8');
if(req.method!=='GET'&&req.headers.origin){let oh='';try{oh=new URL(req.headers.origin).host}catch{}if(oh!==req.headers.host)throw err(403,'مرفوض')}
const ipAddr=clientIp(req)||'?';
const hitsNow=Date.now(),wh=(apiHits.get(ipAddr)||[]).filter(t=>hitsNow-t<60000);if(wh.length>=2000){apiHits.set(ipAddr,wh);throw err(429,'طلبات كثيرة جدًا، حاول بعد دقيقة')}wh.push(hitsNow);apiHits.set(ipAddr,wh);if(apiHits.size>20000)apiHits.clear();
const tok=sidOf(req);
for(const[m,re,f]of R){const x=m===req.method&&re.exec(url.pathname);if(x){const out=await f({u:userOf(tok),tok,b:raw?JSON.parse(raw):{},bin:isRaw?bodyBuf:null,q:Object.fromEntries(url.searchParams),p:x.slice(1),res,ip:clientIp(req),ua:req.headers['user-agent'],hdr:req.headers,rawBody:raw});if(out?.redirect){res.statusCode=302;res.setHeader('Location',out.redirect);res.setHeader('Cache-Control','no-store');return res.end()}
if(out?.file){const L=fs.statSync(out.file).size;res.setHeader('Content-Type',out.mime);res.setHeader('Cache-Control','private, max-age=86400');res.setHeader('Accept-Ranges','bytes');const rg=/bytes=(\d*)-(\d*)/.exec(req.headers.range||'');let s=0,e=L-1;if(rg&&(rg[1]!==''||rg[2]!=='')){if(rg[1]===''){s=Math.max(0,L-+rg[2])}else{s=+rg[1];e=rg[2]!==''?Math.min(+rg[2],L-1):L-1}if(s>e||s>=L){res.statusCode=416;res.setHeader('Content-Range',`bytes */${L}`);return res.end()}res.statusCode=206;res.setHeader('Content-Range',`bytes ${s}-${e}/${L}`)}res.setHeader('Content-Length',e-s+1);return pipeline(fs.createReadStream(out.file,{start:s,end:e}),res,x=>{if(x&&x.code!=='ERR_STREAM_PREMATURE_CLOSE')console.error('stream:',x.message)})}
if(out?.raw){res.setHeader('Content-Type',out.mime);res.setHeader('Cache-Control','private, max-age=86400');res.setHeader('Accept-Ranges','bytes');const rg=/bytes=(\d*)-(\d*)/.exec(req.headers.range||'');if(rg&&(rg[1]!==''||rg[2]!=='')){const L=out.raw.length;let s,e;if(rg[1]===''){s=Math.max(0,L-+rg[2]);e=L-1}else{s=+rg[1];e=rg[2]!==''?Math.min(+rg[2],L-1):L-1}if(s>e||s>=L){res.statusCode=416;res.setHeader('Content-Range',`bytes */${L}`);return res.end()}res.statusCode=206;res.setHeader('Content-Range',`bytes ${s}-${e}/${L}`);res.setHeader('Content-Length',e-s+1);return res.end(out.raw.subarray(s,e+1))}res.setHeader('Content-Length',out.raw.length);return res.end(out.raw)}
res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');return res.end(JSON.stringify(out))}}
throw err(404,'غير موجود')}catch(e){if(!e.s||e.s>=500)console.error('[unhandled]',String(req.url).split('?')[0],e.stack||e.message);if(!e.s&&/UNIQUE constraint failed: users\.(national_id|phone)/.test(String(e.message)))Object.assign(e,{s:409,message:'هذه الهوية أو الجوال مسجّلة على حساب آخر'});const s=e.s||(e instanceof SyntaxError?400:500);res.statusCode=s;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:e.s?e.message:s===400?'بيانات غير صالحة':'خطأ في الخادم'}))}});
server.headersTimeout=15000;server.requestTimeout=60000;server.keepAliveTimeout=65000;
server.listen(PORT,()=>{console.log('http://localhost:'+PORT);startAi();if(!process.env.VAPID_PUBLIC_KEY||!process.env.VAPID_PRIVATE_KEY)console.warn('push: مفاتيح VAPID غير مضبوطة، لن تصل إشعارات الدفع للجوال');else if(pushKeyProblem())console.warn('push: '+pushKeyProblem()+' — إشعارات الدفع معطّلة حتى تُصحَّح المفاتيح في الاستضافة');else if(/example\.(com|org|net)/i.test(pushCfg().subject))console.warn('push: غيّر VAPID_SUBJECT إلى بريد حقيقي (آبل ترفض أحيانًا example.com)');if(!process.env.MAIL_FROM||/resend\.dev/i.test(process.env.MAIL_FROM))console.warn('mail: MAIL_FROM يستخدم نطاق Resend التجريبي، وسيذهب البريد إلى الرسائل المزعجة. وثّق نطاقك في Resend')});
for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{console.log('shutdown:',sig);server.close(()=>{try{db.exec('PRAGMA wal_checkpoint(TRUNCATE)');db.close()}catch{}process.exit(0)});setTimeout(()=>process.exit(0),8000).unref()});
