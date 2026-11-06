import {DatabaseSync} from 'node:sqlite';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {SKILL_SEED, ASSIST_CITIES, CANCEL_REASONS} from '../../data.js';
import {route, PORT, db, all, normAr, seedSkills, seedSections, err, tx, hash, check, notify, bal, award, log, audit, startSession, userOf, need, adm, str, num, R, ADMIN, get, run, SET, restricted, PV, TERMS_VERSION, VERIFY_REQUIRED, cleanSections, hesc, issueVerify, own, pledgeBody, resolveSkills, saveSections, saveSpecialties, sendMail, sha, ACT, CFG, applyPenalty, blocked, cleanSearch, hasOffer, hasThread, hx, likeEsc, matchSections, msgMailAt, notifyMessageMail, pairCheck, peerOk, send, stripAl, toksOf, hitOr429} from '../core.js';

route('GET','/requests',c=>{const q=c.q,w=['r.hidden=0'],a=[];
if(q.q){w.push("(r.title LIKE ? ESCAPE '\\' OR r.description LIKE ? ESCAPE '\\' OR r.city LIKE ? ESCAPE '\\')");const l=`%${likeEsc(q.q)}%`;a.push(l,l,l)}
if(q.mine)need(c);else w.push("r.status!='draft'");
if(q.category){w.push('r.category=?');a.push(q.category)}
if(q.city){w.push("r.city LIKE ? ESCAPE '\\'");a.push(`%${likeEsc(q.city)}%`)}
if(q.min){w.push('r.budget>=?');a.push(+q.min)}if(q.max){w.push('r.budget<=?');a.push(+q.max)}
if(q.status){w.push('r.status=?');a.push(q.status)}
if(q.mine&&c.u){w.push('(r.user_id=? OR r.helper_id=? OR r.id IN (SELECT request_id FROM offers WHERE user_id=?))');a.push(c.u.id,c.u.id,c.u.id)}
return all(`SELECT r.id,r.title,substr(r.description,1,140) description,r.city,r.category,r.image_id,r.budget,r.negotiable,r.status,r.created_at,u.name owner,(SELECT COUNT(*) FROM offers o WHERE o.request_id=r.id) offers FROM requests r JOIN users u ON u.id=r.user_id WHERE ${w.join(' AND ')} ORDER BY r.id DESC LIMIT 60`,...a)});
route('POST','/requests',c=>{const u=need(c);if(VERIFY_REQUIRED&&!u.email_verified)throw err(403,'فعّل بريدك الإلكتروني قبل نشر طلب');if(!u.phone)throw err(403,'أضف رقم جوالك في الملف الشخصي قبل نشر طلب');const b=c.b,_=restricted(u.id),title=str(b.title,3,120,'العنوان'),d=str(b.description,10,3000,'الوصف'),city=str(b.city||'',0,60,'المدينة'),budget=num(b.budget,'الميزانية'),cat=str(b.category||'',0,40,'التصنيف'),st=b.draft?'draft':'published',img=own(u,b.image_id);
if(get("SELECT 1 x FROM requests WHERE user_id=? AND title=? AND description=? AND created_at>datetime('now','-1 day')",u.id,title,d))throw err(409,'هذا الطلب منشور مسبقًا');
const id=Number(run('INSERT INTO requests(user_id,title,description,city,category,budget,negotiable,status,image_id) VALUES(?,?,?,?,?,?,?,?,?)',u.id,title,d,city,cat,budget,b.negotiable?1:0,st,img).lastInsertRowid);log(id,st,u.id);return{id}});
route('GET','/requests/(\\d+)',c=>{const r=get('SELECT r.*,u.name owner FROM requests r JOIN users u ON u.id=r.user_id WHERE r.id=?',c.p[0]);if(!r||(r.hidden&&c.u?.role!=='admin')||(r.status==='draft'&&r.user_id!==c.u?.id&&c.u?.role!=='admin'))throw err(404,'الطلب غير موجود');
const me=c.u?.id;r.isOwner=me===r.user_id;r.isHelper=me===r.helper_id;
r.offers=r.isOwner?all('SELECT o.id,o.user_id,o.message,o.price,u.name FROM offers o JOIN users u ON u.id=o.user_id WHERE o.request_id=?',r.id):[];
r.offerCount=get('SELECT COUNT(*) n FROM offers WHERE request_id=?',r.id).n;r.myOffer=me?get('SELECT * FROM offers WHERE request_id=? AND user_id=?',r.id,me)||null:null;
r.history=all('SELECT status,at FROM status_log WHERE request_id=? ORDER BY id',r.id);
r.ratings=all('SELECT a.id,a.stars,a.comment,a.rater_id,u.name FROM ratings a JOIN users u ON u.id=a.rater_id WHERE a.request_id=? AND a.hidden=0',r.id);
r.payments=me&&(r.isOwner||r.isHelper||c.u.role==='admin')?all('SELECT id,amount,status,note,proof_id,created_at FROM payments WHERE request_id=? ORDER BY id',r.id):[];r.isAdmin=c.u?.role==='admin';r.commission=(r.isHelper||r.isAdmin)?get('SELECT id,amount,status,note FROM commissions WHERE request_id=?',r.id)||null:null;if(!(r.isOwner||r.isHelper||r.isAdmin)){delete r.agreed_price;delete r.price_by;delete r.price_ok}return r});
route('POST','/requests/(\\d+)/offers',c=>{const u=need(c),_=restricted(u.id),r=get('SELECT * FROM requests WHERE id=? AND hidden=0',c.p[0]);if(!r)throw err(404,'الطلب غير موجود');
if(VERIFY_REQUIRED&&!u.email_verified)throw err(403,'فعّل بريدك الإلكتروني قبل التقدم');if(!u.phone)throw err(403,'أضف رقم جوالك في الملف الشخصي قبل التقدم');
if(u.account_type!=='helper')throw err(403,'التقدم للمهام متاح للمساعدين فقط');if(get("SELECT 1 x FROM agreement_commissions WHERE helper_id=? AND status='due' AND datetime(created_at,'+'||?||' days')<datetime('now') LIMIT 1",u.id,Number(SET().commission_grace_days??3)))throw err(403,'لديك عمولة اتفاق متأخرة، سدّدها أولًا');
if(r.user_id===u.id)throw err(400,'لا يمكنك التقدم لطلبك');if(!['published','negotiating'].includes(r.status))throw err(400,'الطلب لم يعد متاحًا');if(blocked(u.id,r.user_id))throw err(403,'لا يمكن التقدم لهذا الطلب');if(!get('SELECT 1 x FROM pledges WHERE user_id=? AND version=?',u.id,PV))throw err(403,'يجب تأكيد تعهد سداد العمولة أولًا');

if(get("SELECT 1 x FROM commissions WHERE helper_id=? AND status IN ('due','rejected') AND created_at<=datetime('now',?)",u.id,`-${+(SET().commission_grace_days??3)} days`))throw err(403,'لديك عمولة مستحقة للمنصة؛ سدّدها لتتمكن من التقدم لمهام جديدة');
const m=str(c.b.message,3,1000,'الرسالة'),p=num(c.b.price,'السعر');
try{run('INSERT INTO offers(request_id,user_id,message,price) VALUES(?,?,?,?)',r.id,u.id,m,p)}catch{throw err(409,'تقدمت لهذا الطلب مسبقًا')}
if(r.status==='published'){run("UPDATE requests SET status='negotiating' WHERE id=?",r.id);log(r.id,'negotiating',u.id)}
notify(r.user_id,`${u.name} تقدّم لطلبك: ${r.title}`,'#/r/'+r.id);return{ok:1}});
route('POST','/requests/(\\d+)/choose',c=>tx(()=>{const u=need(c),r=get('SELECT * FROM requests WHERE id=?',c.p[0]);if(!r||r.user_id!==u.id)throw err(403,'غير مصرح');
if(!['published','negotiating'].includes(r.status))throw err(400,'تم اختيار مساعد مسبقًا');const o=get('SELECT * FROM offers WHERE id=? AND request_id=?',+c.b.offer_id,r.id);if(!o)throw err(400,'العرض غير موجود');
run("UPDATE requests SET helper_id=?,status='helper_chosen' WHERE id=?",o.user_id,r.id);log(r.id,'helper_chosen',u.id);notify(o.user_id,'تم اختيارك لتنفيذ: '+r.title,'#/r/'+r.id);return{ok:1}}));
route('POST','/requests/(\\d+)/action',c=>tx(()=>{const u=need(c),r=get('SELECT * FROM requests WHERE id=?',c.p[0]),a=ACT[c.b.action];if(!r||!a)throw err(404,'غير موجود');
const own=r.user_id===u.id,hlp=r.helper_id===u.id;if(!(a[0]==='owner'?own:a[0]==='helper'?hlp:own||hlp))throw err(403,'غير مصرح');
if(!a[1].includes(r.status))throw err(400,'الإجراء غير متاح في هذه الحالة');
const paid=get("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE request_id=? AND status='verified'",r.id).s;
if(a[2]==='completed'&&!(r.price_ok&&paid>=r.agreed_price-1e-9))throw err(400,'لا يمكن تأكيد الإنجاز قبل اعتماد السعر وتأكيد المساعد استلام كامل المبلغ');
if(a[2]==='cancelled'&&paid>0)throw err(400,'توجد دفعة موثقة لهذا الطلب؛ استخدم «اعتراض» لتتولى الإدارة المعالجة');
if(a[2]==='published')restricted(u.id);
run('UPDATE requests SET status=? WHERE id=?',a[2],r.id);log(r.id,a[2],u.id);const other=own?r.helper_id:r.user_id;if(other)notify(other,`تغيّرت حالة «${r.title}»`,'#/r/'+r.id);
if(a[2]==='completed'){award(r.user_id,'complete_requester','done:'+r.id+':o');award(r.helper_id,'complete_helper','done:'+r.id+':h');
const cp=+(SET().commission_percent||0),amt=Math.round(r.agreed_price*cp)/100;
if(amt>0){run('INSERT OR IGNORE INTO commissions(request_id,helper_id,amount) VALUES(?,?,?)',r.id,r.helper_id,amt);notify(r.helper_id,`عليك عمولة للمنصة (${amt} ر.س): حوّلها إلى حساب المنصة وأرسل صورة الإثبات`,'#/r/'+r.id)}}return{status:a[2]}}));
route('GET','/requests/(\\d+)/messages',c=>{const u=need(c),r=get('SELECT * FROM requests WHERE id=?',c.p[0]),peer=+c.q.with;if(!r||!peerOk(r,u.id,peer))throw err(403,'غير مصرح');
return{blocked:blocked(u.id,peer),messages:all('SELECT id,from_id,body,attachment_id,created_at FROM messages WHERE request_id=? AND ((from_id=? AND to_id=?) OR (from_id=? AND to_id=?)) ORDER BY id',r.id,u.id,peer,peer,u.id)}});
route('POST','/requests/(\\d+)/messages',c=>{const u=need(c),r=get('SELECT * FROM requests WHERE id=?',c.p[0]),to=+c.b.to;if(!r||!peerOk(r,u.id,to))throw err(403,'غير مصرح');
const att=own(u,c.b.attachment_id);if(att&&u.id===r.user_id&&r.helper_id)throw err(400,'لإرسال سند التحويل استخدم زر «إرسال إثبات التحويل»، والصور العادية لا تُرسل بعد اختيار المساعد');send(r,u,to,str(c.b.body||(att?'📎 صورة':''),1,2000,'الرسالة'),att);return{ok:1}});
route('POST','/upload',c=>{const u=need(c),m=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(c.b.data||''));if(!m)throw err(400,'صيغة الصورة غير مدعومة');const d=Buffer.from(m[2],'base64');if(d.length>2e6||d.length<12)throw err(400,'حجم الصورة غير مقبول');
const h=d.subarray(0,12).toString('latin1'),ok=m[1]==='png'?d[0]===0x89&&h.slice(1,4)==='PNG':m[1]==='jpeg'?d[0]===0xff&&d[1]===0xd8:h.startsWith('RIFF')&&h.slice(8)==='WEBP';if(!ok)throw err(400,'الملف ليس صورة صالحة');
if(get("SELECT COUNT(*) n FROM attachments WHERE user_id=? AND created_at>datetime('now','-1 hour')",u.id).n>=40)throw err(429,'تجاوزت حد الرفع');
return{id:Number(run('INSERT INTO attachments(user_id,mime,data) VALUES(?,?,?)',u.id,'image/'+m[1],d).lastInsertRowid)}});
route('GET','/files/(\\d+)',c=>{const f=get('SELECT * FROM attachments WHERE id=?',c.p[0]);if(!f)throw err(404,'غير موجود');const me=c.u?.id||0;
const ok=c.u?.role==='admin'||f.user_id===me||get('SELECT 1 x FROM messages WHERE attachment_id=? AND (from_id=? OR to_id=?)',f.id,me,me)||get("SELECT 1 x FROM requests WHERE image_id=? AND hidden=0 AND (status!='draft' OR user_id=?)",f.id,me);if(!ok&&!get('SELECT 1 x FROM portfolio WHERE attachment_id=?',f.id)&&!get('SELECT 1 x FROM direct_messages WHERE attachment_id=? AND (from_id=? OR to_id=?)',f.id,me,me))throw err(403,'غير مصرح');return{raw:f.data,mime:f.mime}});
route('POST','/requests/(\\d+)/payment',c=>tx(()=>{const u=need(c),r=get('SELECT * FROM requests WHERE id=?',c.p[0]);if(!r||r.user_id!==u.id||!r.helper_id)throw err(403,'غير مصرح');if(!['helper_chosen','in_progress'].includes(r.status))throw err(400,'الحالة لا تسمح بتسجيل دفعة');if(!r.price_ok)throw err(400,'يجب أن يعتمد الطرفان السعر النهائي قبل التحويل');
const amt=num(c.b.amount,'المبلغ'),proof=own(u,c.b.attachment_id);if(!amt||!proof)throw err(400,'أدخل المبلغ وأرفق صورة التحويل');
const used=get("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE request_id=? AND status!='rejected'",r.id).s;if(used+amt>r.agreed_price+1e-9)throw err(400,`المبلغ يتجاوز المتبقي من السعر المتفق عليه (${r.agreed_price-used} ر.س)`);
const pid=Number(run('INSERT INTO payments(request_id,payer_id,payee_id,amount,proof_id) VALUES(?,?,?,?,?)',r.id,u.id,r.helper_id,amt,proof).lastInsertRowid);
send(r,u,r.helper_id,`إثبات تحويل بمبلغ ${amt} ر.س إلى المساعد (بانتظار تأكيد الاستلام)`,proof);all("SELECT id FROM users WHERE role='admin'").forEach(a=>notify(a.id,`دفعة بانتظار المراجعة: ${r.title}`,'#/admin'));return{id:pid}}));
route('POST','/requests/(\\d+)/rate',c=>{const u=need(c),r=get('SELECT * FROM requests WHERE id=?',c.p[0]);if(!r||r.status!=='completed'||![r.user_id,r.helper_id].includes(u.id))throw err(403,'التقييم متاح لطرفي مهمة مكتملة فقط');
const s=+c.b.stars;if(!Number.isInteger(s)||s<1||s>5)throw err(400,'التقييم من 1 إلى 5');const to=u.id===r.user_id?r.helper_id:r.user_id;
try{run('INSERT INTO ratings(request_id,rater_id,ratee_id,stars,comment) VALUES(?,?,?,?,?)',r.id,u.id,to,s,str(c.b.comment||'',0,500,'التعليق'))}catch(e){if(e.s)throw e;throw err(409,'قيّمت هذه المهمة مسبقًا')}notify(to,'وصلك تقييم جديد','#/r/'+r.id);return{ok:1}});
route('POST','/requests/(\\d+)/price',c=>tx(()=>{const u=need(c),r=get('SELECT * FROM requests WHERE id=?',c.p[0]);if(!r||![r.user_id,r.helper_id].includes(u.id))throw err(403,'غير مصرح');if(!['helper_chosen','in_progress'].includes(r.status))throw err(400,'الحالة لا تسمح بتحديد السعر');
const amt=num(c.b.amount,'السعر');if(!amt)throw err(400,'أدخل سعرًا أكبر من صفر');if(get("SELECT 1 x FROM payments WHERE request_id=? AND status!='rejected'",r.id))throw err(400,'لا يمكن تغيير السعر بعد تسجيل دفعة');
run('UPDATE requests SET agreed_price=?,price_by=?,price_ok=0 WHERE id=?',amt,u.id,r.id);notify(u.id===r.user_id?r.helper_id:r.user_id,`اقتراح سعر نهائي ${amt} ر.س لـ «${r.title}»`,'#/r/'+r.id);return{ok:1}}));
route('POST','/requests/(\\d+)/price/accept',c=>tx(()=>{const u=need(c),r=get('SELECT * FROM requests WHERE id=?',c.p[0]);if(!r||![r.user_id,r.helper_id].includes(u.id)||r.price_by===u.id||!r.agreed_price)throw err(403,'لا يمكنك الموافقة على هذا السعر');
if(r.price_ok)throw err(400,'السعر معتمد مسبقًا');if(!['helper_chosen','in_progress'].includes(r.status))throw err(400,'الحالة لا تسمح بذلك');run('UPDATE requests SET price_ok=1 WHERE id=?',r.id);notify(r.price_by,`تم اعتماد السعر النهائي ${r.agreed_price} ر.س`,'#/r/'+r.id);return{ok:1}}));
route('GET','/requests/(\\d+)/helper-account',c=>{const u=need(c),r=get('SELECT * FROM requests WHERE id=?',c.p[0]);if(!r||r.user_id!==u.id||!r.helper_id)throw err(403,'غير مصرح');const h=get('SELECT name FROM users WHERE id=?',r.helper_id);return{name:h.name}});
route('POST','/requests/(\\d+)/cancel',c=>tx(()=>{const u=need(c),r=get('SELECT * FROM requests WHERE id=?',c.p[0]);if(!r||![r.user_id,r.helper_id].includes(u.id))throw err(403,'غير مصرح');
if(r.status!=='helper_chosen')throw err(400,'هذا الإلغاء متاح بعد اختيار المساعد فقط');
const reason=String(c.b.reason||'');if(!CANCEL_REASONS.includes(reason))throw err(400,'اختر سببًا من القائمة');
if(get("SELECT 1 x FROM payments WHERE request_id=? AND status!='rejected'",r.id))throw err(400,'لا يمكن الإلغاء بعد تسجيل دفعة؛ استخدم الاعتراض');
const other=u.id===r.user_id?r.helper_id:r.user_id;
run("UPDATE requests SET status='cancelled' WHERE id=?",r.id);log(r.id,'cancelled',u.id);
run('INSERT INTO cancellations(request_id,by_id,other_id,reason) VALUES(?,?,?,?)',r.id,u.id,other,reason);
if(u.id===r.user_id&&reason===CANCEL_REASONS[1])run("INSERT OR IGNORE INTO reports(reporter_id,type,target_id,reason) VALUES(?,?,?,?)",u.id,'request',r.id,'إلغاء بسبب عدم التزام المساعد');
notify(other,`ألغى الطرف الآخر المهمة «${r.title}» بعد الاختيار`,'#/r/'+r.id);applyPenalty(u.id);pairCheck(u.id,other);return{ok:1}}));
route('POST','/assistant',c=>{hitOr429('ast|'+(c.u?c.u.id:c.ip),+(process.env.ASSISTANT_PER_HOUR)||300);const t=String(c.b.message||'').trim();if(t.length<3||t.length>500)throw err(400,'اكتب طلبك في جملة واضحة');
if(!c.u)return{reply:'سجّل دخولك حتى أبحث لك عن المساعدين المسجّلين.',needLogin:1,providers:[],requests:[]};
const hits=matchSections(t),city=ASSIST_CITIES.find(x=>t.includes(x))||null;
if(!hits.length){run("INSERT INTO failed_searches(text,reason,city) VALUES(?,'no_category',?)",cleanSearch(t),city);return{reply:'لم أجد قسمًا مناسبًا لطلبك. جرّب وصف الخدمة بكلمات أخرى، أو اقترح قسمًا جديدًا إذا كانت خدمتك غير موجودة.',noMatch:1,providers:[],requests:[]}}
const ids=hits.map(h=>h.id),ph=ids.map(()=>'?').join(','),names=hits.map(h=>h.name).join('، ');
const providers=all(`SELECT u.id,u.name,u.city,(SELECT COUNT(*) FROM requests r WHERE r.helper_id=u.id AND r.status='completed') done,(SELECT ROUND(AVG(a.stars),1) FROM ratings a WHERE a.ratee_id=u.id AND a.hidden=0) avg,COUNT(DISTINCT us.category_id) matched FROM users u JOIN user_sections us ON us.user_id=u.id WHERE us.category_id IN (${ph}) AND u.active=1 AND u.flagged=0 AND (u.suspended_until IS NULL OR u.suspended_until<=datetime('now')) ${city?"AND u.city LIKE ? ESCAPE '\\'":''} GROUP BY u.id ORDER BY matched DESC,done DESC,avg DESC LIMIT 10`,...ids,...(city?[`%${likeEsc(city)}%`]:[]));
if(!providers.length)run("INSERT INTO failed_searches(text,reason,city,category_id) VALUES(?,'no_provider',?,?)",cleanSearch(t),city,hits[0].id);
const reply=providers.length?`وجدت ${providers.length} مساعدًا مسجلًا في: ${names}${city?' في '+city:''}.`:`لا يوجد مساعدون مسجلون في: ${names}${city?' في '+city:''} بعد.`+(city?'':' حدّد المدينة لنتائج أدق.');
return{reply,category:hits[0].name,providers:providers.map(x=>({id:x.id,name:String(x.name).split(' ')[0],city:x.city,done:x.done,avg:x.avg})),requests:[]}});
route('GET','/skills',()=>{const cats=all('SELECT id,name FROM skill_categories ORDER BY sort,id');const sk=all("SELECT id,name,category_id FROM skills WHERE status='approved' ORDER BY name");return{categories:cats.map(c=>({...c,skills:sk.filter(s=>s.category_id===c.id)}))}});
route('POST','/skills/suggest',c=>{const u=need(c),cat=+c.b.category_id;if(!get('SELECT 1 x FROM skill_categories WHERE id=?',cat))throw err(400,'القسم غير صالح');const name=str(c.b.name,2,60,'اسم المهارة');
const kws=String(c.b.keywords||'').split(/[,،]/).map(normAr).filter(x=>x.length>=2).slice(0,15);
if(get("SELECT COUNT(*) n FROM skills WHERE suggested_by=? AND status='pending'",u.id).n>=5)throw err(429,'لديك مهارات بانتظار الاعتماد، انتظر حتى تُراجع');
if(get('SELECT 1 x FROM skills WHERE name=?',name))throw err(409,'هذه المهارة موجودة أو بانتظار الاعتماد');
const id=Number(run("INSERT INTO skills(category_id,name,status,suggested_by) VALUES(?,?,'pending',?)",cat,name,u.id).lastInsertRowid);
for(const k of new Set([normAr(name),...kws]))run('INSERT OR IGNORE INTO skill_keywords(skill_id,word) VALUES(?,?)',id,k);
all("SELECT id FROM users WHERE role='admin'").forEach(a=>notify(a.id,`مهارة جديدة بانتظار الاعتماد: ${name}`,'#/admin'));return{id,status:'pending'}});
route('GET','/providers/(\\d+)',c=>{need(c);const id=+c.p[0];const u=get('SELECT id,name,city,bio FROM users WHERE id=? AND active=1',id);if(!u)throw err(404,'المساعد غير موجود');
return{id:u.id,name:u.name,city:u.city||'',bio:u.bio||'',skills:(()=>{const sp=all("SELECT s.name FROM user_skills us JOIN skills s ON s.id=us.skill_id WHERE us.user_id=? AND s.status='approved' ORDER BY s.name",id).map(x=>x.name);return sp.length?sp:all("SELECT c.name FROM user_sections us JOIN skill_categories c ON c.id=us.category_id WHERE us.user_id=? ORDER BY c.sort",id).map(x=>x.name)})(),done:get("SELECT COUNT(*) n FROM requests WHERE helper_id=? AND status='completed'",id).n,avg:get('SELECT ROUND(AVG(stars),1) a FROM ratings WHERE ratee_id=? AND hidden=0',id).a,count:get('SELECT COUNT(*) n FROM ratings WHERE ratee_id=? AND hidden=0',id).n,reviews:all("SELECT a.stars,a.comment,a.created_at,r.name FROM ratings a JOIN users r ON r.id=a.rater_id WHERE a.ratee_id=? AND a.hidden=0 ORDER BY a.id DESC LIMIT 10",id).map(x=>({stars:x.stars,comment:x.comment||'',at:String(x.created_at).slice(0,10),name:String(x.name).split(' ')[0]})),portfolio:all('SELECT p.id,p.attachment_id,p.caption FROM portfolio p WHERE p.user_id=? ORDER BY p.id DESC LIMIT 30',id)}});
