import {SKILL_SEED, ASSIST_CITIES, CANCEL_REASONS} from './data.js';
import {DatabaseSync} from 'node:sqlite';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {PORT, db, all, normAr, seedSkills, seedSections, err, tx, hash, check, notify, bal, award, log, audit, startSession, userOf, need, adm, str, num, R, route, ADMIN, get, run, SET, hooks, restricted} from './src/core.js';
import './src/routes/admin.js';
route('POST','/register',c=>{const b=c.b,name=str(b.name,2,60,'الاسم'),email=str(b.email,5,120,'البريد').toLowerCase(),city=str(b.city||'',0,60,'المدينة');
if(!/^\S+@\S+\.\S+$/.test(email))throw err(400,'البريد غير صالح');str(b.password,8,100,'كلمة المرور');if(!b.terms)throw err(400,'يجب قبول الشروط وسياسة الخصوصية');if(!b.age)throw err(400,'التسجيل متاح لمن عمره 18 سنة فأكثر');
const acct=b.account_type==='helper'?'helper':'client',spec=b.skill_ids!==undefined?resolveSkills(b.skill_ids):null,secIds=spec?spec.catIds:cleanSections(b.category_ids);if(acct==='helper'&&!secIds.length)throw err(400,'اختر قسمًا واحدًا على الأقل لتقديم الخدمات');if(acct==='client'&&secIds.length)throw err(400,'الأقسام للمساعدين فقط');let id;try{id=Number(run('INSERT INTO users(name,email,pass,city,role,account_type,email_verified) VALUES(?,?,?,?,?,?,?)',name,email,hash(b.password),city,'user',acct,VERIFY_REQUIRED?0:1).lastInsertRowid)}catch{throw err(409,'البريد مسجّل مسبقًا')}
run("UPDATE users SET age_ok=1,terms_version=?,terms_at=datetime('now') WHERE id=?",TERMS_VERSION,id);if(spec)saveSpecialties(id,spec.skillIds,spec.catIds);else saveSections(id,secIds);if(VERIFY_REQUIRED)issueVerify(id,email).then(ok=>{if(!ok)console.error('verify: تعذّر إرسال رابط التفعيل عند التسجيل، المستخدم',id)}).catch(e=>console.error('verify:',e.message));startSession(c.res,id);return{ok:1}});
route('POST','/login',c=>{const email=String(c.b.email||'').toLowerCase(),k=c.ip+'|'+email;let f=get('SELECT n,t FROM login_attempts WHERE k=?',k)||{n:0,t:Date.now()};if(Date.now()-f.t>9e5)f={n:0,t:Date.now()};
if(f.n>=8)throw err(429,'محاولات كثيرة، حاول بعد قليل');const u=get('SELECT * FROM users WHERE email=?',email);
if(!u||!check(String(c.b.password||''),u.pass)){run('INSERT INTO login_attempts(k,n,t) VALUES(?,?,?) ON CONFLICT(k) DO UPDATE SET n=excluded.n,t=excluded.t',k,f.n+1,f.t);throw err(401,'البريد أو كلمة المرور غير صحيحة')}
if(!u.active)throw err(403,'الحساب معطّل');run('DELETE FROM login_attempts WHERE k=?',k);startSession(c.res,u.id);return{ok:1}});
route('POST','/logout',c=>{run('DELETE FROM sessions WHERE token=?',c.tok||'');return{ok:1}});
route('GET','/me',c=>c.u?{user:c.u,unread:get('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read=0',c.u.id).n}:{user:null});
route('POST','/profile',c=>{const u=need(c),ph=String(c.b.phone||'').replace(/[\s-]/g,'');
let phone=null;if(ph){const m=/^(?:\+?966|0)(5\d{8})$/.exec(ph);if(!m)throw err(400,'رقم الجوال غير صالح (مثال: 05XXXXXXXX)');phone='0'+m[1]}
const ad=str(c.b.address||'',0,200,'العنوان');
run('UPDATE users SET name=?,city=COALESCE(?,city),phone=COALESCE(?,phone),address=COALESCE(?,address) WHERE id=?',str(c.b.name,2,60,'الاسم'),c.b.city===undefined?null:str(c.b.city,0,60,'المدينة'),phone,ad||null,u.id);return{ok:1}}); route('GET','/requests',c=>{const q=c.q,w=['r.hidden=0'],a=[];
if(q.q){w.push("(r.title LIKE ? ESCAPE '\\' OR r.description LIKE ? ESCAPE '\\' OR r.city LIKE ? ESCAPE '\\')");const l=`%${likeEsc(q.q)}%`;a.push(l,l,l)}
if(!q.mine)w.push("r.status!='draft'");
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
if(u.account_type!=='helper')throw err(403,'التقدم للمهام متاح للمساعدين فقط');
if(r.user_id===u.id)throw err(400,'لا يمكنك التقدم لطلبك');if(!['published','negotiating'].includes(r.status))throw err(400,'الطلب لم يعد متاحًا');if(blocked(u.id,r.user_id))throw err(403,'لا يمكن التقدم لهذا الطلب');if(!get('SELECT 1 x FROM pledges WHERE user_id=? AND version=?',u.id,PV))throw err(403,'يجب تأكيد تعهد سداد العمولة أولًا');

if(get("SELECT 1 x FROM commissions WHERE helper_id=? AND status IN ('due','rejected') AND created_at<=datetime('now',?)",u.id,`-${+(SET().commission_grace_days??3)} days`))throw err(403,'لديك عمولة مستحقة للمنصة؛ سدّدها لتتمكن من التقدم لمهام جديدة');
const m=str(c.b.message,3,1000,'الرسالة'),p=num(c.b.price,'السعر');
try{run('INSERT INTO offers(request_id,user_id,message,price) VALUES(?,?,?,?)',r.id,u.id,m,p)}catch{throw err(409,'تقدمت لهذا الطلب مسبقًا')}
if(r.status==='published'){run("UPDATE requests SET status='negotiating' WHERE id=?",r.id);log(r.id,'negotiating',u.id)}
notify(r.user_id,`${u.name} تقدّم لطلبك: ${r.title}`,'#/r/'+r.id);return{ok:1}});
route('POST','/requests/(\\d+)/choose',c=>tx(()=>{const u=need(c),r=get('SELECT * FROM requests WHERE id=?',c.p[0]);if(!r||r.user_id!==u.id)throw err(403,'غير مصرح');
if(!['published','negotiating'].includes(r.status))throw err(400,'تم اختيار مساعد مسبقًا');const o=get('SELECT * FROM offers WHERE id=? AND request_id=?',+c.b.offer_id,r.id);if(!o)throw err(400,'العرض غير موجود');
run("UPDATE requests SET helper_id=?,status='helper_chosen' WHERE id=?",o.user_id,r.id);log(r.id,'helper_chosen',u.id);notify(o.user_id,'تم اختيارك لتنفيذ: '+r.title,'#/r/'+r.id);return{ok:1}}));
const ACT={start:['helper',['helper_chosen'],'in_progress'],complete:['owner',['in_progress'],'completed'],cancel:['owner',['draft','published','negotiating'],'cancelled'],publish:['owner',['draft'],'published'],dispute:['party',['helper_chosen','in_progress'],'disputed']};
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
const hasThread=(rid,a,b)=>!!get('SELECT 1 x FROM messages WHERE request_id=? AND ((from_id=? AND to_id=?) OR (from_id=? AND to_id=?)) LIMIT 1',rid,a,b,b,a);
const hasOffer=(rid,uid)=>!!get('SELECT 1 x FROM offers WHERE request_id=? AND user_id=?',rid,uid);
const peerOk=(r,me,peer)=>me===r.user_id?(hasOffer(r.id,peer)||hasThread(r.id,me,peer)):(peer===r.user_id&&(hasOffer(r.id,me)||hasThread(r.id,me,peer)));
const blocked=(a,b)=>!!get('SELECT 1 x FROM blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)',a,b,b,a);
const own=(u,id)=>{if(!id)return null;if(!get('SELECT 1 x FROM attachments WHERE id=? AND user_id=?',+id,u.id))throw err(400,'المرفق غير صالح');return +id};
const send=(r,u,to,body,att)=>{if(blocked(u.id,to))throw err(403,'لا يمكن التواصل مع هذا المستخدم');const id=Number(run('INSERT INTO messages(request_id,from_id,to_id,body,attachment_id) VALUES(?,?,?,?,?)',r.id,u.id,to,body,att).lastInsertRowid);notify(to,`رسالة جديدة بخصوص: ${r.title}`,'#/chat/'+r.id+'/'+u.id);notifyMessageMail(to,u.name,`/chat/${r.id}/${u.id}`);return id};
route('GET','/requests/(\\d+)/messages',c=>{const u=need(c),r=get('SELECT * FROM requests WHERE id=?',c.p[0]),peer=+c.q.with;if(!r||!peerOk(r,u.id,peer))throw err(403,'غير مصرح');
return{blocked:blocked(u.id,peer),messages:all('SELECT id,from_id,body,attachment_id,created_at FROM messages WHERE request_id=? AND ((from_id=? AND to_id=?) OR (from_id=? AND to_id=?)) ORDER BY id',r.id,u.id,peer,peer,u.id)}});
route('POST','/requests/(\\d+)/messages',c=>{const u=need(c),r=get('SELECT * FROM requests WHERE id=?',c.p[0]),to=+c.b.to;if(!r||!peerOk(r,u.id,to))throw err(403,'غير مصرح');
const att=own(u,c.b.attachment_id);if(att&&u.id===r.user_id&&r.helper_id)throw err(400,'لإرسال سند التحويل استخدم زر «إرسال إثبات التحويل»، والصور العادية لا تُرسل بعد اختيار المساعد');send(r,u,to,str(c.b.body||(att?'📎 صورة':''),1,2000,'الرسالة'),att);return{ok:1}});
route('GET','/chats',c=>{const u=need(c);return all('SELECT x.request_id,x.peer,r.title,u.name peer_name,m.body,m.created_at FROM (SELECT request_id,CASE WHEN from_id=? THEN to_id ELSE from_id END peer,MAX(id) mid FROM messages WHERE from_id=? OR to_id=? GROUP BY 1,2) x JOIN messages m ON m.id=x.mid JOIN requests r ON r.id=x.request_id JOIN users u ON u.id=x.peer ORDER BY x.mid DESC',u.id,u.id,u.id)});
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
route('GET','/users/(\\d+)',c=>{need(c);const u=get('SELECT id,name,city FROM users WHERE id=?',c.p[0]);if(!u)throw err(404,'غير موجود');return Object.assign(u,get('SELECT ROUND(AVG(stars),1) avg,COUNT(*) n FROM ratings WHERE ratee_id=? AND hidden=0',u.id))});
route('POST','/report',c=>{const u=need(c),t=c.b.type,id=+c.b.id,q={user:'SELECT 1 x FROM users WHERE id=?',request:'SELECT 1 x FROM requests WHERE id=?',rating:'SELECT 1 x FROM ratings WHERE id=?',message:`SELECT 1 x FROM messages WHERE id=? AND (from_id=${u.id} OR to_id=${u.id})`}[t];if(!q||!get(q,id))throw err(400,'الهدف غير صالح');
try{run('INSERT INTO reports(reporter_id,type,target_id,reason) VALUES(?,?,?,?)',u.id,t,id,str(c.b.reason,3,500,'السبب'))}catch(e){if(e.s)throw e;throw err(409,'بلّغت عن هذا مسبقًا')}return{ok:1}});
route('POST','/block',c=>{const u=need(c),b=+c.b.user_id;if(!b||b===u.id)throw err(400,'غير صالح');if(c.b.blocked)run('INSERT OR IGNORE INTO blocks VALUES(?,?)',u.id,b);else run('DELETE FROM blocks WHERE blocker_id=? AND blocked_id=?',u.id,b);return{ok:1}});
route('GET','/notifications',c=>{const u=need(c),n=all('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 50',u.id);run('UPDATE notifications SET read=1 WHERE user_id=?',u.id);return n});
route('GET','/wallet',c=>{const u=need(c),p=bal(u.id);const dueRow=get("SELECT COALESCE(SUM(amount),0) s FROM agreement_commissions WHERE helper_id=? AND status='due'",u.id).s;return{points:p,riyal:p/20,agr_due:dueRow,agr_items:all("SELECT ac.id,ac.amount,ac.created_at,a.description FROM agreement_commissions ac JOIN agreements a ON a.id=ac.agreement_id WHERE ac.helper_id=? AND ac.status='due' ORDER BY ac.id DESC",u.id),ledger:all('SELECT delta,reason,created_at FROM points_ledger WHERE user_id=? ORDER BY id DESC LIMIT 100',u.id)}});
route('POST','/wallet/redeem',c=>tx(()=>{const u=need(c),p=+c.b.points,key=str(c.b.key,8,64,'المفتاح'),purpose=str(c.b.purpose,2,100,'الغرض'),ref=`redeem:${u.id}:${key}`;
if(!Number.isInteger(p)||p<=0)throw err(400,'عدد النقاط غير صالح');if(get('SELECT 1 x FROM points_ledger WHERE ref=?',ref))return{duplicate:1,points:bal(u.id)};
if(bal(u.id)<p)throw err(400,'رصيدك غير كافٍ');run('INSERT INTO points_ledger(user_id,delta,reason,ref) VALUES(?,?,?,?)',u.id,-p,'استخدام: '+purpose,ref);
notify(u.id,`تم خصم ${p} نقطة (${p/20} ريال)`,'#/profile');return{points:bal(u.id)}}));
route('POST','/requests/(\\d+)/price',c=>tx(()=>{const u=need(c),r=get('SELECT * FROM requests WHERE id=?',c.p[0]);if(!r||![r.user_id,r.helper_id].includes(u.id))throw err(403,'غير مصرح');if(!['helper_chosen','in_progress'].includes(r.status))throw err(400,'الحالة لا تسمح بتحديد السعر');
const amt=num(c.b.amount,'السعر');if(!amt)throw err(400,'أدخل سعرًا أكبر من صفر');if(get("SELECT 1 x FROM payments WHERE request_id=? AND status!='rejected'",r.id))throw err(400,'لا يمكن تغيير السعر بعد تسجيل دفعة');
run('UPDATE requests SET agreed_price=?,price_by=?,price_ok=0 WHERE id=?',amt,u.id,r.id);notify(u.id===r.user_id?r.helper_id:r.user_id,`اقتراح سعر نهائي ${amt} ر.س لـ «${r.title}»`,'#/r/'+r.id);return{ok:1}}));
route('POST','/requests/(\\d+)/price/accept',c=>tx(()=>{const u=need(c),r=get('SELECT * FROM requests WHERE id=?',c.p[0]);if(!r||![r.user_id,r.helper_id].includes(u.id)||r.price_by===u.id||!r.agreed_price)throw err(403,'لا يمكنك الموافقة على هذا السعر');
if(r.price_ok)throw err(400,'السعر معتمد مسبقًا');if(!['helper_chosen','in_progress'].includes(r.status))throw err(400,'الحالة لا تسمح بذلك');run('UPDATE requests SET price_ok=1 WHERE id=?',r.id);notify(r.price_by,`تم اعتماد السعر النهائي ${r.agreed_price} ر.س`,'#/r/'+r.id);return{ok:1}}));
route('GET','/org',()=>{const s=SET();return{org_name:s.org_name||'',org_cr:s.org_cr||'',support_email:s.support_email||'',support_phone:s.support_phone||'',support_address:s.support_address||'',terms_text:s.terms_text||'',privacy_text:s.privacy_text||''}});
route('GET','/platform-account',c=>{need(c);const s=SET();return{bank_name:s.bank_name||'',account_name:s.account_name||'',iban:s.iban||'',commission_percent:+(s.commission_percent||0),commission_grace_days:s.commission_grace_days==null?3:+s.commission_grace_days,org_name:s.org_name||'',org_cr:s.org_cr||'',dispute_clause:s.dispute_clause||'',penalty_rules:s.penalty_rules||'',terms_text:s.terms_text||'',privacy_text:s.privacy_text||'',support_email:s.support_email||'',support_phone:s.support_phone||'',support_address:s.support_address||'',cancel_warn_at:+(s.cancel_warn_at??2),cancel_suspend_at:+(s.cancel_suspend_at??3),cancel_review_at:+(s.cancel_review_at??5),cancel_suspend_days:+(s.cancel_suspend_days??7)}});
route('GET','/requests/(\\d+)/helper-account',c=>{const u=need(c),r=get('SELECT * FROM requests WHERE id=?',c.p[0]);if(!r||r.user_id!==u.id||!r.helper_id)throw err(403,'غير مصرح');const h=get('SELECT name FROM users WHERE id=?',r.helper_id);return{name:h.name}});
route('POST','/payments/(\\d+)/confirm',c=>{const u=need(c),p=get('SELECT * FROM payments WHERE id=?',c.p[0]);if(!p||p.payee_id!==u.id)throw err(403,'غير مصرح');if(p.status!=='pending')throw err(400,'تمت مراجعة هذه الدفعة');const d=c.b.decision;if(!['verified','rejected'].includes(d))throw err(400,'قرار غير صالح');
const note=str(c.b.note||'',d==='rejected'?3:0,300,'الملاحظة');run('UPDATE payments SET status=?,note=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?',d,note,u.id,p.id);notify(p.payer_id,d==='verified'?'أكّد المساعد استلام المبلغ':'لم يؤكد المساعد الاستلام: '+note,'#/r/'+p.request_id);return{ok:1}});
route('POST','/commissions/(\\d+)/proof',c=>{const u=need(c),m=get('SELECT * FROM commissions WHERE id=?',c.p[0]);if(!m||m.helper_id!==u.id)throw err(403,'غير مصرح');if(!['due','rejected'].includes(m.status))throw err(400,'لا يمكن إرسال إثبات الآن');
const at=own(u,c.b.attachment_id);if(!at)throw err(400,'أرفق صورة التحويل');run("UPDATE commissions SET proof_id=?,status='submitted',submitted_at=CURRENT_TIMESTAMP WHERE id=?",at,m.id);all("SELECT id FROM users WHERE role='admin'").forEach(a=>notify(a.id,'إثبات تحويل عمولة بانتظار المراجعة','#/admin'));return{ok:1}});
const PV=1;
const pledgeBody=s=>[
`1. أقرّ بأنني اطلعت على شروط المنصة وسياسة الخصوصية، وأن هذا التعهد ملزم لي نظامًا.`,
`2. ألتزم بسداد عمولة للمنصة قدرها ${s.commission_percent||0}% من السعر النهائي المتفق عليه في كل مهمة أنجزها عبر المنصة، سواء تم الدفع بالتحويل المباشر أو بأي وسيلة أخرى.`,
`3. تستحق العمولة بمجرد إتمام المهمة وتأكيدها في المنصة، وأسددها خلال ${s.commission_grace_days??3} أيام بالتحويل إلى حساب المنصة المعلن فيها، وأرفع صورة الإثبات.`,
`4. ألتزم بعدم التحايل على المنصة، فلا أتفق مع طالب المساعدة على إتمام المهمة أو الدفع خارجها لتفادي العمولة. وإذا ثبت ذلك استحقت المنصة العمولة كاملة، مع التعويض الذي يقدّره المحكم أو الجهة المختصة.`,
`5. عند التأخر عن السداد يحق للمنصة: (أ) إيقاف حسابي أو منعي من التقدم لمهام جديدة، (ب) مطالبتي بالمبلغ المستحق، (ج) اللجوء إلى الجهات القضائية والتنفيذية والتحكيمية المختصة في المملكة لاستيفاء حقها.`,
`6. أتحمل ما تتكبده المنصة في سبيل التحصيل من رسوم ومصاريف تقاضٍ أو تحكيم وتنفيذ وأتعاب محاماة، وفق ما يقرره المحكم أو الجهة المختصة.`,
`7. تعد سجلات المنصة حجة عليّ، وهي: المحادثات، وصور التحويلات، والسعر المعتمد، وحالة المهمة، وسجلات الدخول والموافقة، ما لم أثبت خلاف ذلك.`,
`8. أقرّ بأن موافقتي الإلكترونية على هذا التعهد تعد توقيعًا إلكترونيًا معتبرًا نظامًا، وأن بياناتي المدخلة صحيحة وأتحمل مسؤولية صحتها.`,
`9. أوافق على إفصاح المنصة عن بياناتي للجهات القضائية والرسمية والتحكيمية بالقدر اللازم لتحصيل حقها.`,
`10. يخضع هذا التعهد لأنظمة المملكة العربية السعودية. ${s.dispute_clause}`,
`11. يسري هذا التعهد على جميع المهام التي أنجزها عبر المنصة، وتبقى التزاماتي قائمة بعد إغلاق حسابي فيما استحق قبل ذلك.`].join('\n');
route('GET','/pledge',c=>{const u=need(c),s=SET();return{ready:!!(s.org_name&&s.org_cr&&s.dispute_clause),accepted:!!get('SELECT 1 x FROM pledges WHERE user_id=? AND version=?',u.id,PV),org:s.org_name||'',org_cr:s.org_cr||'',body:pledgeBody(s)}});
route('POST','/pledge',c=>{const u=need(c),s=SET();if(!(s.org_name&&s.org_cr&&s.dispute_clause))throw err(400,'التعهد غير مفعّل بعد، تواصل مع الإدارة');if(!c.b.accept)throw err(400,'يجب تحديد الموافقة');
if(get('SELECT 1 x FROM pledges WHERE user_id=? AND version=?',u.id,PV))return{ok:1};
const name=str(c.b.name,2,60,'الاسم');
const text=`تعهد والتزام بسداد عمولة المنصة\n\nالمتعهِّد: ${name}.\nلصالح: ${s.org_name}، سجل تجاري رقم ${s.org_cr}، مالكة منصة «المساعد».\n\n﴿وَأَوْفُوا بِالْعَهْدِ إِنَّ الْعَهْدَ كَانَ مَسْئُولًا﴾\n\n${pledgeBody(s)}`;
tx(()=>{run('UPDATE users SET name=? WHERE id=?',name,u.id);run('INSERT INTO pledges(user_id,version,ip,ua,text) VALUES(?,?,?,?,?)',u.id,PV,`${c.ip}`,String(c.ua||'').slice(0,200),text)});return{ok:1}});

const CFG=()=>{const s=SET();return{warn:+(s.cancel_warn_at??2),sus:+(s.cancel_suspend_at??3),rev:+(s.cancel_review_at??5),days:+(s.cancel_suspend_days??7)}};
const applyPenalty=uid=>{const c=CFG(),n=get("SELECT COUNT(*) n FROM cancellations WHERE by_id=? AND created_at>datetime('now','-30 days')",uid).n;
if(n>=c.rev){run('UPDATE users SET flagged=1 WHERE id=?',uid);all("SELECT id FROM users WHERE role='admin'").forEach(a=>notify(a.id,'حساب يحتاج مراجعة بسبب تكرار الإلغاء بعد الاختيار','#/admin'))}
if(n>=c.sus){run("UPDATE users SET suspended_until=datetime('now', '+' || ? || ' days') WHERE id=?",c.days,uid);notify(uid,`أُوقف نشرك وتقدمك لمدة ${c.days} أيام بسبب تكرار الإلغاء بعد اختيار المساعد`,'#/profile')}
else if(n>=c.warn)notify(uid,'تنبيه: تكرار الإلغاء بعد اختيار المساعد قد يؤدي إلى إيقاف حسابك','#/profile')};
const pairCheck=(a,b)=>{const n=get("SELECT COUNT(*) n FROM cancellations WHERE ((by_id=? AND other_id=?) OR (by_id=? AND other_id=?)) AND created_at>datetime('now','-30 days')",a,b,b,a).n;
if(n>=2)all("SELECT id FROM users WHERE role='admin'").forEach(x=>notify(x.id,`تكرار إلغاء بعد الاختيار بين طرفين (${n} مرات خلال 30 يومًا)`,'#/admin'))};
route('POST','/requests/(\\d+)/cancel',c=>tx(()=>{const u=need(c),r=get('SELECT * FROM requests WHERE id=?',c.p[0]);if(!r||![r.user_id,r.helper_id].includes(u.id))throw err(403,'غير مصرح');
if(r.status!=='helper_chosen')throw err(400,'هذا الإلغاء متاح بعد اختيار المساعد فقط');
const reason=String(c.b.reason||'');if(!CANCEL_REASONS.includes(reason))throw err(400,'اختر سببًا من القائمة');
if(get("SELECT 1 x FROM payments WHERE request_id=? AND status!='rejected'",r.id))throw err(400,'لا يمكن الإلغاء بعد تسجيل دفعة؛ استخدم الاعتراض');
const other=u.id===r.user_id?r.helper_id:r.user_id;
run("UPDATE requests SET status='cancelled' WHERE id=?",r.id);log(r.id,'cancelled',u.id);
run('INSERT INTO cancellations(request_id,by_id,other_id,reason) VALUES(?,?,?,?)',r.id,u.id,other,reason);
if(u.id===r.user_id&&reason===CANCEL_REASONS[1])run("INSERT OR IGNORE INTO reports(reporter_id,type,target_id,reason) VALUES(?,?,?,?)",u.id,'request',r.id,'إلغاء بسبب عدم التزام المساعد');
notify(other,`ألغى الطرف الآخر المهمة «${r.title}» بعد الاختيار`,'#/r/'+r.id);applyPenalty(u.id);pairCheck(u.id,other);return{ok:1}}));

const likeEsc=v=>String(v).replace(/[\\%_]/g,m=>'\\'+m);
const cleanSearch=t=>String(t).replace(/\+?\d[\d\s-]{7,}\d/g,'[رقم]').replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g,'[بريد]').slice(0,200);
const stripAl=w=>w.length>3&&w.startsWith('ال')?w.slice(2):w;
const toksOf=t=>normAr(t).split(/[\s,،.!?؟:;()\-\/]+/).filter(Boolean);
const matchSections=text=>{const toks=toksOf(text),padded=' '+toks.join(' ')+' ',set=new Set(toks.flatMap(x=>[x,stripAl(x)]));const hit=new Map();for(const r of all('SELECT c.id,c.name,k.word FROM skill_categories c JOIN section_keywords k ON k.category_id=c.id')){const w=r.word;if(!w||w.length<2)continue;const ok=w.includes(' ')?padded.includes(' '+w+' '):(set.has(w)||set.has(stripAl(w)));if(ok){const h=hit.get(r.id)||{id:r.id,name:r.name,score:0};h.score++;hit.set(r.id,h)}}return[...hit.values()].sort((a,b)=>b.score-a.score)};
const resolveSkills=raw=>{const ids=[...new Set((Array.isArray(raw)?raw:[]).map(Number).filter(Number.isInteger))];if(ids.length>15)throw err(400,'يمكن اختيار 15 تخصصًا كحد أقصى');
const rows=ids.length?all(`SELECT id,category_id FROM skills WHERE status='approved' AND id IN (${ids.map(()=>'?').join(',')})`,...ids):[];if(rows.length!==ids.length)throw err(400,'التخصص غير صالح');
const catIds=[...new Set(rows.map(r=>r.category_id))];if(catIds.length>3)throw err(400,'يمكن اختيار تخصصات من 3 أقسام كحد أقصى');return{skillIds:ids,catIds}};
const saveSpecialties=(uid,skillIds,catIds)=>{run('DELETE FROM user_skills WHERE user_id=?',uid);for(const id of skillIds)run('INSERT INTO user_skills(user_id,skill_id) VALUES(?,?)',uid,id);saveSections(uid,catIds)};
const tagSkills=rid=>{const r=get('SELECT title,description FROM requests WHERE id=?',rid);if(!r)return;const toks=toksOf(`${r.title} ${r.description}`),padded=' '+toks.join(' ')+' ',set=new Set(toks.flatMap(x=>[x,stripAl(x)]));
for(const k of all("SELECT s.id,k.word FROM skills s JOIN skill_keywords k ON k.skill_id=s.id WHERE s.status='approved'")){const w=k.word;if(!w||w.length<2)continue;const ok=w.includes(' ')?padded.includes(' '+w+' '):(set.has(w)||set.has(stripAl(w)));if(ok)run('INSERT OR IGNORE INTO request_skills(request_id,skill_id) VALUES(?,?)',rid,k.id)}};
const cleanSections=raw=>{const ids=[...new Set((Array.isArray(raw)?raw:[]).map(Number).filter(Number.isInteger))];if(ids.length>3)throw err(400,'يمكن اختيار 3 أقسام كحد أقصى');for(const id of ids)if(!get('SELECT 1 x FROM skill_categories WHERE id=?',id))throw err(400,'القسم غير صالح');return ids};
const saveSections=(uid,ids)=>{run('DELETE FROM user_sections WHERE user_id=?',uid);for(const id of ids)run('INSERT INTO user_sections(user_id,category_id) VALUES(?,?)',uid,id)};
route('POST','/assistant',c=>{const t=String(c.b.message||'').trim();if(t.length<3||t.length>500)throw err(400,'اكتب طلبك في جملة واضحة');
if(!c.u)return{reply:'سجّل دخولك حتى أبحث لك عن المساعدين المسجّلين.',needLogin:1,providers:[],requests:[]};
const hits=matchSections(t),city=ASSIST_CITIES.find(x=>t.includes(x))||null;
if(!hits.length){run('INSERT INTO failed_searches(text) VALUES(?)',cleanSearch(t));return{reply:'لم أجد قسمًا مناسبًا لطلبك. جرّب وصف الخدمة بكلمات أخرى، أو اقترح قسمًا جديدًا إذا كانت خدمتك غير موجودة.',noMatch:1,providers:[],requests:[]}}
const ids=hits.map(h=>h.id),ph=ids.map(()=>'?').join(','),names=hits.map(h=>h.name).join('، ');
const providers=all(`SELECT u.id,u.name,u.city,(SELECT COUNT(*) FROM requests r WHERE r.helper_id=u.id AND r.status='completed') done,(SELECT ROUND(AVG(a.stars),1) FROM ratings a WHERE a.ratee_id=u.id AND a.hidden=0) avg,COUNT(DISTINCT us.category_id) matched FROM users u JOIN user_sections us ON us.user_id=u.id WHERE us.category_id IN (${ph}) AND u.active=1 AND u.flagged=0 AND (u.suspended_until IS NULL OR u.suspended_until<=datetime('now')) ${city?"AND u.city LIKE ? ESCAPE '\\'":''} GROUP BY u.id ORDER BY matched DESC,done DESC,avg DESC LIMIT 10`,...ids,...(city?[`%${likeEsc(city)}%`]:[]));
const reply=providers.length?`وجدت ${providers.length} مساعدًا مسجلًا في: ${names}${city?' في '+city:''}.`:`لا يوجد مساعدون مسجلون في: ${names}${city?' في '+city:''} بعد.`+(city?'':' حدّد المدينة لنتائج أدق.');
return{reply,category:hits[0].name,providers:providers.map(x=>({id:x.id,name:String(x.name).split(' ')[0],city:x.city,done:x.done,avg:x.avg})),requests:[]}});
route('GET','/skills',()=>{const cats=all('SELECT id,name FROM skill_categories ORDER BY sort,id');const sk=all("SELECT id,name,category_id FROM skills WHERE status='approved' ORDER BY name");return{categories:cats.map(c=>({...c,skills:sk.filter(s=>s.category_id===c.id)}))}});
route('POST','/me/account-type',c=>tx(()=>{const u=need(c),t=c.b.type;if(!['client','helper'].includes(t))throw err(400,'نوع غير صالح');
if(t==='helper'){if(c.b.skill_ids!==undefined){const sp=resolveSkills(c.b.skill_ids);if(!sp.skillIds.length)throw err(400,'اختر تخصصًا واحدًا على الأقل');run("UPDATE users SET account_type='helper' WHERE id=?",u.id);saveSpecialties(u.id,sp.skillIds,sp.catIds);return{ok:1}}const ids=cleanSections(c.b.category_ids);if(!ids.length)throw err(400,'اختر قسمًا واحدًا على الأقل لتقديم الخدمات');run("UPDATE users SET account_type='helper' WHERE id=?",u.id);saveSections(u.id,ids);return{ok:1}}
if(get("SELECT 1 x FROM requests WHERE (user_id=? OR helper_id=?) AND status IN ('helper_chosen','in_progress','disputed')",u.id,u.id))throw err(400,'لديك مهام قيد التنفيذ أو متنازع عليها، أنهِها أو تواصل مع الإدارة أولًا');
if(get("SELECT 1 x FROM commissions WHERE helper_id=? AND status IN ('due','submitted','rejected')",u.id))throw err(400,'عليك عمولة غير مسددة للمنصة، سدّدها أولًا');
run("UPDATE users SET account_type='client' WHERE id=?",u.id);run('DELETE FROM user_sections WHERE user_id=?',u.id);run("DELETE FROM offers WHERE user_id=? AND request_id IN (SELECT id FROM requests WHERE status IN ('published','negotiating'))",u.id);run("UPDATE requests SET status='published' WHERE status='negotiating' AND id NOT IN (SELECT request_id FROM offers)");return{ok:1}}));
route('GET','/me/export',c=>{const u=need(c);return{exported_at:new Date().toISOString(),profile:get('SELECT name,email,city,phone,address,bio,role,account_type,created_at,terms_version,terms_at FROM users WHERE id=?',u.id),
requests:all('SELECT * FROM requests WHERE user_id=?',u.id),offers:all('SELECT * FROM offers WHERE user_id=?',u.id),messages:all('SELECT * FROM messages WHERE from_id=? OR to_id=?',u.id,u.id),
direct_messages:all('SELECT * FROM direct_messages WHERE from_id=? OR to_id=?',u.id,u.id),pledges:all('SELECT version,text,accepted_at FROM pledges WHERE user_id=?',u.id),points:all('SELECT * FROM points_ledger WHERE user_id=?',u.id),
specialties:all('SELECT s.name FROM user_skills us JOIN skills s ON s.id=us.skill_id WHERE us.user_id=?',u.id).map(x=>x.name)}});
route('GET','/me/specialties',c=>{const u=need(c);return all('SELECT skill_id FROM user_skills WHERE user_id=?',u.id).map(x=>x.skill_id)});
route('GET','/me/sections',c=>{const u=need(c);return all('SELECT category_id FROM user_sections WHERE user_id=?',u.id).map(x=>x.category_id)});
route('POST','/me/sections',c=>tx(()=>{const u=need(c);if(u.account_type!=='helper')throw err(403,'الأقسام للمساعدين فقط');if(c.b.skill_ids!==undefined){const sp=resolveSkills(c.b.skill_ids);if(!sp.skillIds.length)throw err(400,'اختر تخصصًا واحدًا على الأقل');saveSpecialties(u.id,sp.skillIds,sp.catIds);return{ok:1}}const ids=cleanSections(c.b.category_ids);if(!ids.length)throw err(400,'اختر قسمًا واحدًا على الأقل');saveSections(u.id,ids);return{ok:1}}));
route('POST','/skills/suggest',c=>{const u=need(c),cat=+c.b.category_id;if(!get('SELECT 1 x FROM skill_categories WHERE id=?',cat))throw err(400,'القسم غير صالح');const name=str(c.b.name,2,60,'اسم المهارة');
const kws=String(c.b.keywords||'').split(/[,،]/).map(normAr).filter(x=>x.length>=2).slice(0,15);
if(get("SELECT COUNT(*) n FROM skills WHERE suggested_by=? AND status='pending'",u.id).n>=5)throw err(429,'لديك مهارات بانتظار الاعتماد، انتظر حتى تُراجع');
if(get('SELECT 1 x FROM skills WHERE name=?',name))throw err(409,'هذه المهارة موجودة أو بانتظار الاعتماد');
const id=Number(run("INSERT INTO skills(category_id,name,status,suggested_by) VALUES(?,?,'pending',?)",cat,name,u.id).lastInsertRowid);
for(const k of new Set([normAr(name),...kws]))run('INSERT OR IGNORE INTO skill_keywords(skill_id,word) VALUES(?,?)',id,k);
all("SELECT id FROM users WHERE role='admin'").forEach(a=>notify(a.id,`مهارة جديدة بانتظار الاعتماد: ${name}`,'#/admin'));return{id,status:'pending'}});
route('GET','/providers/(\\d+)',c=>{need(c);const id=+c.p[0];const u=get('SELECT id,name,city,bio FROM users WHERE id=? AND active=1',id);if(!u)throw err(404,'المساعد غير موجود');
return{id:u.id,name:u.name,city:u.city||'',bio:u.bio||'',skills:(()=>{const sp=all("SELECT s.name FROM user_skills us JOIN skills s ON s.id=us.skill_id WHERE us.user_id=? AND s.status='approved' ORDER BY s.name",id).map(x=>x.name);return sp.length?sp:all("SELECT c.name FROM user_sections us JOIN skill_categories c ON c.id=us.category_id WHERE us.user_id=? ORDER BY c.sort",id).map(x=>x.name)})(),done:get("SELECT COUNT(*) n FROM requests WHERE helper_id=? AND status='completed'",id).n,avg:get('SELECT ROUND(AVG(stars),1) a FROM ratings WHERE ratee_id=? AND hidden=0',id).a,count:get('SELECT COUNT(*) n FROM ratings WHERE ratee_id=? AND hidden=0',id).n,reviews:all("SELECT a.stars,a.comment,a.created_at,r.name FROM ratings a JOIN users r ON r.id=a.rater_id WHERE a.ratee_id=? AND a.hidden=0 ORDER BY a.id DESC LIMIT 10",id).map(x=>({stars:x.stars,comment:x.comment||'',at:String(x.created_at).slice(0,10),name:String(x.name).split(' ')[0]})),portfolio:all('SELECT p.id,p.attachment_id,p.caption FROM portfolio p WHERE p.user_id=? ORDER BY p.id DESC LIMIT 30',id)}});
route('POST','/me/bio',c=>{const u=need(c);run('UPDATE users SET bio=? WHERE id=?',str(c.b.bio||'',0,500,'النبذة')||null,u.id);return{ok:1}});
route('POST','/me/portfolio',c=>{const u=need(c);if(get('SELECT COUNT(*) n FROM portfolio WHERE user_id=?',u.id).n>=12)throw err(400,'الحد الأقصى 12 صورة');const at=own(u,c.b.attachment_id);if(!at)throw err(400,'أرفق صورة');run('INSERT INTO portfolio(user_id,attachment_id,caption) VALUES(?,?,?)',u.id,at,str(c.b.caption||'',0,120,'الوصف')||null);return{ok:1}});
route('POST','/me/portfolio/(\\d+)/delete',c=>{const u=need(c);run('DELETE FROM portfolio WHERE id=? AND user_id=?',+c.p[0],u.id);return{ok:1}});
route('GET','/direct/(\\d+)',c=>{const u=need(c),peer=+c.p[0];if(peer===u.id)throw err(400,'غير صالح');if(!get('SELECT 1 x FROM users WHERE id=? AND active=1',peer))throw err(404,'المستخدم غير موجود');
return{blocked:blocked(u.id,peer),messages:all('SELECT id,from_id,body,attachment_id,created_at FROM direct_messages WHERE (from_id=? AND to_id=?) OR (from_id=? AND to_id=?) ORDER BY id DESC LIMIT 100',u.id,peer,peer,u.id).reverse()}});
route('GET','/direct/(\\d+)/agreements',c=>{const u=need(c),peer=+c.p[0];const rows=all('SELECT id,a_id,b_id,amount,description,status,created_at,updated_at FROM agreements WHERE (a_id=? AND b_id=?) OR (a_id=? AND b_id=?) ORDER BY id DESC LIMIT 20',u.id,peer,peer,u.id);const me_=get('SELECT account_type FROM users WHERE id=?',u.id);const cfg=SET();const pct=Number(cfg.commission_percent)||0,grace=Number(cfg.commission_grace_days??3);return rows.map(g=>(g.status==='agreed'&&me_.account_type==='helper')?{...g,commission:Math.round(g.amount*pct)/100,commission_pct:pct,grace_days:grace}:g)});
route('POST','/direct/(\\d+)/agreements',c=>tx(()=>{const u=need(c),peer=+c.p[0];if(peer===u.id)throw err(400,'غير صالح');if(!get('SELECT 1 x FROM users WHERE id=? AND active=1',peer))throw err(404,'المستخدم غير موجود');if(blocked(u.id,peer))throw err(403,'لا يمكن التواصل مع هذا المستخدم');
const amount=Math.floor(Number(c.b.amount));if(!Number.isFinite(amount)||amount<1||amount>100000)throw err(400,'أدخل مبلغًا صحيحًا بين 1 و 100000 ريال');
const description=str(c.b.description,3,300,'وصف الخدمة');
run("UPDATE agreements SET status='cancelled',updated_at=datetime('now') WHERE status='pending' AND ((a_id=? AND b_id=?) OR (a_id=? AND b_id=?))",u.id,peer,peer,u.id);
const id=Number(run('INSERT INTO agreements(a_id,b_id,amount,description) VALUES(?,?,?,?)',u.id,peer,amount,description).lastInsertRowid);
run('INSERT INTO direct_messages(from_id,to_id,body) VALUES(?,?,?)',u.id,peer,`اقترح اتفاقًا: ${description} بمبلغ ${amount} ريال`);return{id}}));
route('POST','/agreements/(\\d+)/approve',c=>tx(()=>{const u=need(c),id=+c.p[0];const a=get('SELECT * FROM agreements WHERE id=?',id);if(!a)throw err(404,'الاتفاق غير موجود');if(a.b_id!==u.id)throw err(403,'الموافقة للطرف الآخر فقط');if(a.status!=='pending')throw err(400,'لم يعد هذا الاتفاق قائمًا');
run("UPDATE agreements SET status='agreed',updated_at=datetime('now') WHERE id=?",id);const hb=get('SELECT id FROM users WHERE id IN (?,?) AND account_type=\'helper\' ORDER BY id LIMIT 1',a.a_id,a.b_id);if(hb){const pct=Number(SET().commission_percent)||0;run('INSERT OR IGNORE INTO agreement_commissions(agreement_id,helper_id,amount) VALUES(?,?,?)',id,hb.id,Math.round(a.amount*pct)/100)};run('INSERT INTO direct_messages(from_id,to_id,body) VALUES(?,?,?)',u.id,a.a_id,`تمت الموافقة على الاتفاق بمبلغ ${a.amount} ريال`);return{ok:1}}));
route('POST','/agreements/(\\d+)/cancel',c=>tx(()=>{const u=need(c),id=+c.p[0];const a=get('SELECT * FROM agreements WHERE id=?',id);if(!a)throw err(404,'الاتفاق غير موجود');if(a.a_id!==u.id&&a.b_id!==u.id)throw err(403,'غير مسموح');if(a.status!=='pending')throw err(400,'لا يمكن إلغاء اتفاق مكتمل أو ملغى');
run("UPDATE agreements SET status='cancelled',updated_at=datetime('now') WHERE id=?",id);return{ok:1}}));
route('POST','/direct/(\\d+)',c=>{const u=need(c),peer=+c.p[0];if(peer===u.id)throw err(400,'غير صالح');if(!get('SELECT 1 x FROM users WHERE id=? AND active=1',peer))throw err(404,'المستخدم غير موجود');
if(blocked(u.id,peer))throw err(403,'لا يمكن التواصل مع هذا المستخدم');
if(get("SELECT COUNT(*) n FROM direct_messages WHERE from_id=? AND created_at>datetime('now','-1 hour')",u.id).n>=30)throw err(429,'عدد الرسائل كبير، حاول بعد قليل');
const att=own(u,c.b.attachment_id);if(att&&get("SELECT 1 x FROM requests WHERE ((user_id=? AND helper_id=?) OR (user_id=? AND helper_id=?)) AND status IN ('helper_chosen','in_progress','completed')",u.id,peer,peer,u.id))throw err(400,'الصور بين طرفين متعاقدين ترسل داخل الطلب فقط');const body=str(c.b.body||(att?'صورة مرفقة':''),1,1000,'الرسالة');
run('INSERT INTO direct_messages(from_id,to_id,body,attachment_id) VALUES(?,?,?,?)',u.id,peer,body,att);notify(peer,`رسالة استفسار جديدة من ${u.name}`,'#/p/'+u.id);return{ok:1}});
route('GET','/setup-status',()=>({needed:!!(process.env.ADMIN_SETUP_TOKEN&&!get("SELECT 1 x FROM users WHERE role='admin'"))}));
route('POST','/me/delete',c=>tx(()=>{const u=need(c),pw=String(c.b.password||'');if(c.b.confirm!=='حذف')throw err(400,'اكتب كلمة «حذف» للتأكيد');
if(!check(pw,get('SELECT pass FROM users WHERE id=?',u.id).pass))throw err(403,'كلمة المرور غير صحيحة');
if(get("SELECT 1 x FROM requests WHERE (user_id=? OR helper_id=?) AND status IN ('helper_chosen','in_progress','disputed')",u.id,u.id))throw err(400,'لديك مهام قيد التنفيذ أو متنازع عليها، أنهِها أو تواصل مع الإدارة أولًا');
if(get("SELECT 1 x FROM commissions WHERE helper_id=? AND status IN ('due','submitted','rejected')",u.id))throw err(400,'عليك عمولة غير مسددة للمنصة، سدّدها أولًا');
run("UPDATE requests SET status='cancelled' WHERE user_id=? AND status IN ('draft','published','negotiating')",u.id);
run('DELETE FROM portfolio WHERE user_id=?',u.id);run('DELETE FROM user_skills WHERE user_id=?',u.id);run('DELETE FROM sessions WHERE user_id=?',u.id);run('DELETE FROM notifications WHERE user_id=?',u.id);run('DELETE FROM direct_messages WHERE from_id=? OR to_id=?',u.id,u.id);run('DELETE FROM user_sections WHERE user_id=?',u.id);
run("UPDATE users SET name='مستخدم محذوف',email='deleted-'||id||'@deleted.invalid',pass=?,city=NULL,phone=NULL,national_id=NULL,address=NULL,iban=NULL,bio=NULL,active=0,flagged=0,suspended_until=NULL,role='user' WHERE id=?",hash(crypto.randomBytes(24).toString('hex')),u.id);
audit(u.id,'account_delete',`user:${u.id}`);return{ok:1}}));
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const hesc=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const sendMail=async(to,subject,html)=>{const key=process.env.RESEND_API_KEY;if(!key){console.error('mail: RESEND_API_KEY غير مضبوط، لم تُرسل الرسالة');return false}
try{const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.MAIL_FROM||'المساعد <onboarding@resend.dev>',to:[to],subject,html})});if(!r.ok){console.error('mail: Resend رفض الطلب، الحالة',r.status);return false}return true}catch(e){console.error('mail: خطأ في الاتصال',e.message);return false}};
route('POST','/forgot',async c=>{const email=String(c.b.email||'').trim().toLowerCase();const u=email?get('SELECT id,name,email FROM users WHERE email=? AND active=1',email):null;
if(u&&get("SELECT COUNT(*) n FROM password_resets WHERE user_id=? AND created_at>datetime('now','-1 hour')",u.id).n<3){
const tok=crypto.randomBytes(32).toString('hex');run("INSERT INTO password_resets(user_id,token_hash,expires_at) VALUES(?,?,datetime('now','+30 minutes'))",u.id,sha(tok));
const base=(process.env.APP_URL||'').replace(/\/$/,''),link=`${base}/#/reset/${tok}`;
await sendMail(u.email,'استعادة كلمة المرور - المساعد',`<div dir="rtl"><p>مرحبًا ${hesc(u.name)}،</p><p>لطلب استعادة كلمة المرور اضغط الرابط التالي، وهو صالح لمدة 30 دقيقة ويُستخدم مرة واحدة:</p><p><a href="${link}">${link}</a></p><p>إذا لم تطلب ذلك فتجاهل هذه الرسالة.</p></div>`)}
return{ok:1}});
route('POST','/verify-email',c=>tx(()=>{const tok=String(c.b.token||'');if(!/^[0-9a-f]{64}$/.test(tok))throw err(400,'الرابط غير صالح أو منتهي');const r=get("SELECT user_id FROM verify_tokens WHERE token_hash=? AND used=0 AND expires_at>datetime('now')",sha(tok));if(!r)throw err(400,'الرابط غير صالح أو منتهي');run('UPDATE users SET email_verified=1 WHERE id=?',r.user_id);run('UPDATE verify_tokens SET used=1 WHERE user_id=?',r.user_id);return{ok:1}}));
route('POST','/me/notify',c=>{const u=need(c);run('UPDATE users SET notify_email=? WHERE id=?',c.b.enabled?1:0,u.id);return{ok:1}});
route('POST','/me/email',async c=>{const u=need(c),email=String(c.b.email||'').trim().toLowerCase();
if(!check(String(c.b.password||''),get('SELECT pass FROM users WHERE id=?',u.id).pass))throw err(401,'كلمة المرور غير صحيحة');
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw err(400,'البريد الإلكتروني غير صالح');
if(email===u.email)return{ok:1};
if(get('SELECT 1 x FROM users WHERE email=? AND id!=?',email,u.id))throw err(409,'البريد مسجّل مسبقًا');
tx(()=>{run('UPDATE users SET email=?,email_verified=? WHERE id=?',email,VERIFY_REQUIRED?0:1,u.id);run('UPDATE verify_tokens SET used=1 WHERE user_id=?',u.id)});
const mailed=VERIFY_REQUIRED?await issueVerify(u.id,email):true;return{ok:1,mailed}});
route('POST','/me/resend-verification',async c=>{const u=need(c);if(u.email_verified)return{ok:1};if(get("SELECT COUNT(*) n FROM verify_tokens WHERE user_id=? AND expires_at>datetime('now','-1 day')",u.id).n>=3)throw err(429,'طلبت رابط التفعيل كثيرًا، جرّب لاحقًا');if(!await issueVerify(u.id,u.email))throw err(503,'تعذّر إرسال البريد الآن، حاول بعد قليل');return{ok:1}});
route('POST','/reset',c=>tx(()=>{const tok=String(c.b.token||''),pw=str(c.b.password,8,100,'كلمة المرور');if(!/^[0-9a-f]{64}$/.test(tok))throw err(400,'الرابط غير صالح أو منتهي');
const r=get("SELECT id,user_id FROM password_resets WHERE token_hash=? AND used=0 AND expires_at>datetime('now')",sha(tok));if(!r)throw err(400,'الرابط غير صالح أو منتهي');
run('UPDATE users SET pass=? WHERE id=?',hash(pw),r.user_id);run('UPDATE password_resets SET used=1 WHERE user_id=?',r.user_id);run('DELETE FROM sessions WHERE user_id=?',r.user_id);audit(r.user_id,'password_reset_self',`user:${r.user_id}`);return{ok:1}}));
const TERMS_VERSION='2026-10';
const VERIFY_REQUIRED=process.env.EMAIL_VERIFY_REQUIRED==='1';
const issueVerify=async(uid,email)=>{const tok=crypto.randomBytes(32).toString('hex');run("INSERT INTO verify_tokens(token_hash,user_id,expires_at) VALUES(?,?,datetime('now','+2 days'))",sha(tok),uid);const base=(process.env.APP_URL||'').replace(/\/$/,''),link=`${base}/#/verify/${tok}`;return sendMail(email,'تأكيد بريدك - المساعد',`<div dir="rtl"><p>أهلًا بك في المساعد،</p><p>لتفعيل حسابك اضغط الرابط التالي (صالح يومين):</p><p><a href="${link}">${link}</a></p></div>`)};
// ---- إشعارات البريد للمساعدين عند نشر طلب يناسب أقسامهم ----
const hx=v=>String(v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
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
const msgMailAt=new Map();
const notifyMessageMail=(toId,fromName,path)=>{const u=get('SELECT email,name,notify_email FROM users WHERE id=?',toId);if(!u||!u.email||u.notify_email!==1)return;
const k=toId+'|'+path,last=msgMailAt.get(k)||0;if(Date.now()-last<15*60e3)return;msgMailAt.set(k,Date.now());
const base=(process.env.APP_URL||'').replace(/\/$/,'');sendMail(u.email,'رسالة جديدة - المساعد',`<div dir="rtl"><p>أهلًا ${hx(u.name)}،</p><p>وصلتك رسالة جديدة من ${hx(fromName)} على المنصة.</p><p><a href="${base}/#${path}">افتح المحادثة</a></p><p style="color:#777;font-size:12px">لإيقاف هذه الرسائل عدّل إعدادات الإشعارات في ملفك الشخصي.</p></div>`).catch(()=>{})};
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
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://x');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');
if(/^\/(app\.css|app\.js)$/.test(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.css')?'text/css; charset=utf-8':'application/javascript; charset=utf-8');res.setHeader('Cache-Control','no-cache');return res.end(fs.readFileSync(new URL('./public'+url.pathname,import.meta.url)))}
if(/^\/(logo|hand)\.png$|^\/splash\.jpg$/.test(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.jpg')?'image/jpeg':'image/png');res.setHeader('Cache-Control','public,max-age=86400');return res.end(fs.readFileSync(new URL('./public'+url.pathname,import.meta.url)))}
if(!url.pathname.startsWith('/api')){res.setHeader('Content-Type','text/html;charset=utf-8');return res.end(fs.readFileSync(new URL('./public/index.html',import.meta.url)))}
let raw='';for await(const ch of req){raw+=ch;if(raw.length>(url.pathname==='/api/upload'?3e6:1e5))throw err(413,'الطلب كبير')}
if(req.method!=='GET'&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw err(403,'مرفوض');
const tok=/sid=(\w+)/.exec(req.headers.cookie||'')?.[1];
for(const[m,re,f]of R){const x=m===req.method&&re.exec(url.pathname);if(x){const out=await f({u:userOf(tok),tok,b:raw?JSON.parse(raw):{},q:Object.fromEntries(url.searchParams),p:x.slice(1),res,ip:clientIp(req),ua:req.headers['user-agent']});if(out?.raw){res.setHeader('Content-Type',out.mime);res.setHeader('Cache-Control','private,max-age=3600');return res.end(out.raw)}
res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(out))}}
throw err(404,'غير موجود')}catch(e){if(!e.s&&/UNIQUE constraint failed: users\.(national_id|phone)/.test(String(e.message)))Object.assign(e,{s:409,message:'هذه الهوية أو الجوال مسجّلة على حساب آخر'});const s=e.s||(e instanceof SyntaxError?400:500);if(s===500)console.error(e);res.statusCode=s;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:e.s?e.message:s===400?'بيانات غير صالحة':'خطأ في الخادم'}))}}).listen(PORT,()=>console.log('http://localhost:'+PORT));
