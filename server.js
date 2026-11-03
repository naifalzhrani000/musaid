import {SKILL_SEED, ASSIST_CITIES, CANCEL_REASONS} from './data.js';
import {DatabaseSync} from 'node:sqlite';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {route, PORT, db, all, normAr, seedSkills, seedSections, err, tx, hash, check, notify, bal, award, log, audit, startSession, userOf, need, adm, str, num, R, ADMIN, get, run, SET, restricted, PV, TERMS_VERSION, VERIFY_REQUIRED, cleanSections, hesc, issueVerify, own, pledgeBody, resolveSkills, saveSections, saveSpecialties, sendMail, sha, hooks, ACT, CFG, applyPenalty, blocked, cleanSearch, hasOffer, hasThread, hx, likeEsc, matchSections, msgMailAt, notifyMessageMail, pairCheck, peerOk, send, stripAl, toksOf} from './src/core.js';
import './src/routes/messages.js';
import './src/routes/requests.js';
import './src/routes/account.js';
import './src/routes/admin.js';




 

















































const tagSkills=rid=>{const r=get('SELECT title,description,city FROM requests WHERE id=?',rid);if(!r)return;for(const h of matchSections(`${r.title} ${r.description} ${r.city||''}`))run('INSERT OR IGNORE INTO request_categories(request_id,category_id) VALUES(?,?)',rid,h.id)};
const notifyHelpers=async rid=>{if(!process.env.RESEND_API_KEY){console.error('notify: RESEND_API_KEY غير مضبوط، لم تُرسل إشعارات الطلبات');return}
const r=get('SELECT id,user_id,title,description,city FROM requests WHERE id=? AND status=?',rid,'published');if(!r)return;
const hits=matchSections(`${r.title} ${r.description} ${r.city||''}`);if(!hits.length)return;
const ids=hits.map(h=>h.id),ph=ids.map(()=>'?').join(',');
const people=all(`SELECT DISTINCT u.id,u.email,u.name FROM users u JOIN user_sections us ON us.user_id=u.id WHERE us.category_id IN (${ph}) AND u.active=1 AND u.notify_email=1 AND u.id!=? LIMIT 300`,...ids,r.user_id);
const base=(process.env.APP_URL||'').replace(/\/$/,''),link=`${base}/#/r/${r.id}`;
for(const p of people){await sendMail(p.email,'طلب جديد يناسب خدماتك - المساعد',`<div dir="rtl"><p>أهلًا ${hx(p.name)}،</p><p>نُشر طلب جديد في قسم خدماتك:</p><p><b>${hx(r.title)}</b></p><p>${hx(String(r.description).slice(0,300))}</p><p><a href="${link}">عرض الطلب</a></p><p style="color:#777;font-size:12px">لإيقاف هذه الرسائل عدّل إعدادات الإشعارات في ملفك الشخصي.</p></div>`);await new Promise(res=>setTimeout(res,600))}};

// ---- عنوان العميل: لا يُقرأ من الرأس إلا خلف وكيل موثوق (TRUST_PROXY=1) ----
const TRUST_PROXY=process.env.TRUST_PROXY==='1';
const clientIp=req=>{if(TRUST_PROXY){const x=String(req.headers['x-forwarded-for']||'').split(',').pop().trim();if(x)return x}return req.socket.remoteAddress||''};
// ---- بريد عند وصول رسالة جديدة (مرة كل 15 دقيقة لكل محادثة) ----


hooks.onPublished=id=>{tagSkills(id);notifyHelpers(id).catch(e=>console.error('notify:',e.message))};
// ---- نسخ احتياطي تلقائي دوري ----
const BACKUP_DIR=process.env.BACKUP_DIR||path.join(path.dirname(path.resolve(process.env.DB_FILE||'data.db')),'backups');
const BACKUP_EVERY=Math.max(60,+process.env.BACKUP_EVERY_SECONDS||24*3600);
const BACKUP_KEEP=Math.max(1,+process.env.BACKUP_KEEP||14);
const runBackup=()=>{fs.mkdirSync(BACKUP_DIR,{recursive:true,mode:0o700});const f=path.join(BACKUP_DIR,`backup-${new Date().toISOString().replace(/[:.]/g,'-')}.db`);db.exec(`VACUUM INTO '${f.replace(/'/g,"''")}'`);fs.chmodSync(f,0o600);
  const old=fs.readdirSync(BACKUP_DIR).filter(x=>/^backup-.*\.db$/.test(x)).sort().reverse().slice(BACKUP_KEEP);for(const x of old)fs.unlinkSync(path.join(BACKUP_DIR,x));return f};
const pruneFailed=()=>{db.exec("DELETE FROM failed_searches WHERE at<datetime('now','-30 days')");db.exec('DELETE FROM failed_searches WHERE id NOT IN (SELECT id FROM failed_searches ORDER BY id DESC LIMIT 5000)')};
const backupTick=()=>{try{pruneFailed();const f=runBackup();console.log('backup: تم إنشاء نسخة احتياطية',path.basename(f))}catch(e){console.error('backup: فشل النسخ الاحتياطي:',e.message)}};
setTimeout(backupTick,5000).unref();
setInterval(backupTick,BACKUP_EVERY*1000).unref();
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://x');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
if(/^\/(app\.css|app\.js|splash\.js)$/.test(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.css')?'text/css; charset=utf-8':'application/javascript; charset=utf-8');res.setHeader('Cache-Control','no-cache');return res.end(fs.readFileSync(new URL('./public'+url.pathname,import.meta.url)))}
if(/^\/(logo|hand)\.png$|^\/splash\.jpg$/.test(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.jpg')?'image/jpeg':'image/png');res.setHeader('Cache-Control','public,max-age=86400');return res.end(fs.readFileSync(new URL('./public'+url.pathname,import.meta.url)))}
if(!url.pathname.startsWith('/api')){res.setHeader('Content-Type','text/html;charset=utf-8');return res.end(fs.readFileSync(new URL('./public/index.html',import.meta.url)))}
let raw='';for await(const ch of req){raw+=ch;if(raw.length>(url.pathname==='/api/upload'?3e6:url.pathname==='/api/admin/restore/preview'?3e7:1e5))throw err(413,'الطلب كبير')}
if(req.method!=='GET'&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw err(403,'مرفوض');
const tok=/sid=(\w+)/.exec(req.headers.cookie||'')?.[1];
for(const[m,re,f]of R){const x=m===req.method&&re.exec(url.pathname);if(x){const out=await f({u:userOf(tok),tok,b:raw?JSON.parse(raw):{},q:Object.fromEntries(url.searchParams),p:x.slice(1),res,ip:clientIp(req),ua:req.headers['user-agent']});if(out?.raw){res.setHeader('Content-Type',out.mime);res.setHeader('Cache-Control','private,max-age=3600');return res.end(out.raw)}
res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(out))}}
throw err(404,'غير موجود')}catch(e){if(!e.s&&/UNIQUE constraint failed: users\.(national_id|phone)/.test(String(e.message)))Object.assign(e,{s:409,message:'هذه الهوية أو الجوال مسجّلة على حساب آخر'});const s=e.s||(e instanceof SyntaxError?400:500);if(s===500)console.error(e);res.statusCode=s;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:e.s?e.message:s===400?'بيانات غير صالحة':'خطأ في الخادم'}))}}).listen(PORT,()=>console.log('http://localhost:'+PORT));
