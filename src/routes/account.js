import {SKILL_SEED, ASSIST_CITIES, CANCEL_REASONS} from '../../data.js';
import {DatabaseSync} from 'node:sqlite';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {route, PORT, db, all, normAr, seedSkills, seedSections, err, tx, hash, check, notify, bal, award, log, audit, startSession, userOf, need, adm, str, num, R, ADMIN, get, run, SET, restricted, PV, TERMS_VERSION, VERIFY_REQUIRED, cleanSections, hesc, issueVerify, own, pledgeBody, resolveSkills, saveSections, saveSpecialties, sendMail, sha, hitOr429, hx} from '../core.js';

route('POST','/register',c=>{hitOr429('reg|'+c.ip,+(process.env.REGISTER_PER_HOUR)||20);const b=c.b,name=str(b.name,2,60,'الاسم'),email=str(b.email,5,120,'البريد').toLowerCase(),city=str(b.city||'',0,60,'المدينة');
if(!/^\S+@\S+\.\S+$/.test(email))throw err(400,'البريد غير صالح');str(b.password,8,100,'كلمة المرور');if(!/^[^\s@<>\"'`]+@[^\s@<>\"'`]+\.[^\s@<>\"'`]+$/.test(email))throw err(400,'البريد الإلكتروني غير صالح');if(!b.terms)throw err(400,'يجب قبول الشروط وسياسة الخصوصية');if(!b.age)throw err(400,'التسجيل متاح لمن عمره 18 سنة فأكثر');
const acct=b.account_type==='helper'?'helper':'client',spec=b.skill_ids!==undefined?resolveSkills(b.skill_ids):null,secIds=spec?spec.catIds:cleanSections(b.category_ids);if(acct==='helper'&&!secIds.length)throw err(400,'اختر قسمًا واحدًا على الأقل لتقديم الخدمات');if(acct==='client'&&secIds.length)throw err(400,'الأقسام للمساعدين فقط');let id;try{id=Number(run('INSERT INTO users(name,email,pass,city,role,account_type,email_verified) VALUES(?,?,?,?,?,?,?)',name,email,hash(b.password),city,'user',acct,VERIFY_REQUIRED?0:1).lastInsertRowid)}catch{throw err(409,'البريد مسجّل مسبقًا')}
if(acct==='helper'){const ht=['individual','establishment','company'].includes(b.helper_type)?b.helper_type:'individual';run('UPDATE users SET helper_type=? WHERE id=?',ht,id)}
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
const vs=['','registered','not_registered'].includes(c.b.vat_status)?c.b.vat_status:null;let vn=null;if(vs==='registered'){vn=String(c.b.vat_number||'').replace(/\s/g,'');if(!/^3\d{14}$/.test(vn))throw err(400,'الرقم الضريبي يتكون من 15 رقمًا ويبدأ بـ 3');}else if(vs==='not_registered'){vn='';}
if(vs!==null&&u.account_type==='helper'){run('UPDATE users SET vat_status=?,vat_number=?,vat_verified=0 WHERE id=?',vs,vn,u.id)}
run('UPDATE users SET name=?,city=COALESCE(?,city),phone=COALESCE(?,phone),address=COALESCE(?,address) WHERE id=?',str(c.b.name,2,60,'الاسم'),c.b.city===undefined?null:str(c.b.city,0,60,'المدينة'),phone,ad||null,u.id);return{ok:1}});
route('GET','/pledge',c=>{const u=need(c),s=SET();return{ready:!!(s.org_name&&s.org_cr&&s.dispute_clause),accepted:!!get('SELECT 1 x FROM pledges WHERE user_id=? AND version=?',u.id,PV),org:s.org_name||'',org_cr:s.org_cr||'',body:pledgeBody(s)}});
route('POST','/pledge',c=>{const u=need(c),s=SET();if(!(s.org_name&&s.org_cr&&s.dispute_clause))throw err(400,'التعهد غير مفعّل بعد، تواصل مع الإدارة');if(!c.b.accept)throw err(400,'يجب تحديد الموافقة');
if(get('SELECT 1 x FROM pledges WHERE user_id=? AND version=?',u.id,PV))return{ok:1};
const name=str(c.b.name,2,60,'الاسم');
const text=`تعهد والتزام بسداد عمولة المنصة\n\nالمتعهِّد: ${name}.\nلصالح: ${s.org_name}، سجل تجاري رقم ${s.org_cr}، مالكة منصة «المساعد».\n\n﴿وَأَوْفُوا بِالْعَهْدِ إِنَّ الْعَهْدَ كَانَ مَسْئُولًا﴾\n\n${pledgeBody(s)}`;
tx(()=>{run('UPDATE users SET name=? WHERE id=?',name,u.id);run('INSERT INTO pledges(user_id,version,ip,ua,text) VALUES(?,?,?,?,?)',u.id,PV,`${c.ip}`,String(c.ua||'').slice(0,200),text)});return{ok:1}});
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
route('POST','/me/bio',c=>{const u=need(c);run('UPDATE users SET bio=? WHERE id=?',str(c.b.bio||'',0,500,'النبذة')||null,u.id);return{ok:1}});
route('POST','/me/portfolio',c=>{const u=need(c);if(get('SELECT COUNT(*) n FROM portfolio WHERE user_id=?',u.id).n>=12)throw err(400,'الحد الأقصى 12 صورة');const at=own(u,c.b.attachment_id);if(!at)throw err(400,'أرفق صورة');run('INSERT INTO portfolio(user_id,attachment_id,caption) VALUES(?,?,?)',u.id,at,str(c.b.caption||'',0,120,'الوصف')||null);return{ok:1}});
route('POST','/me/portfolio/(\\d+)/delete',c=>{const u=need(c);run('DELETE FROM portfolio WHERE id=? AND user_id=?',+c.p[0],u.id);return{ok:1}});
route('GET','/setup-status',()=>({needed:!!(process.env.ADMIN_SETUP_TOKEN&&!get("SELECT 1 x FROM users WHERE role='admin'"))}));
route('POST','/me/delete',c=>tx(()=>{const u=need(c),pw=String(c.b.password||'');if(c.b.confirm!=='حذف')throw err(400,'اكتب كلمة «حذف» للتأكيد');
if(!check(pw,get('SELECT pass FROM users WHERE id=?',u.id).pass))throw err(403,'كلمة المرور غير صحيحة');
if(get("SELECT 1 x FROM requests WHERE (user_id=? OR helper_id=?) AND status IN ('helper_chosen','in_progress','disputed')",u.id,u.id))throw err(400,'لديك مهام قيد التنفيذ أو متنازع عليها، أنهِها أو تواصل مع الإدارة أولًا');
if(get("SELECT 1 x FROM commissions WHERE helper_id=? AND status IN ('due','submitted','rejected')",u.id))throw err(400,'عليك عمولة غير مسددة للمنصة، سدّدها أولًا');
run("UPDATE requests SET status='cancelled' WHERE user_id=? AND status IN ('draft','published','negotiating')",u.id);
run('DELETE FROM portfolio WHERE user_id=?',u.id);run('DELETE FROM user_skills WHERE user_id=?',u.id);run('DELETE FROM sessions WHERE user_id=?',u.id);run('DELETE FROM notifications WHERE user_id=?',u.id);run('DELETE FROM direct_messages WHERE from_id=? OR to_id=?',u.id,u.id);run('DELETE FROM user_sections WHERE user_id=?',u.id);
run("UPDATE users SET name='مستخدم محذوف',email='deleted-'||id||'@deleted.invalid',pass=?,city=NULL,phone=NULL,national_id=NULL,address=NULL,iban=NULL,bio=NULL,active=0,flagged=0,suspended_until=NULL,role='user' WHERE id=?",hash(crypto.randomBytes(24).toString('hex')),u.id);
audit(u.id,'account_delete',`user:${u.id}`);return{ok:1}}));
route('POST','/forgot',async c=>{const email=String(c.b.email||'').trim().toLowerCase();const u=email?get('SELECT id,name,email FROM users WHERE email=? AND active=1',email):null;
let allowed=false;if(u){try{hitOr429('fg|'+u.id,3);allowed=true}catch{}}
if(allowed){const code=String(crypto.randomInt(0,10000)).padStart(4,'0');run("INSERT OR REPLACE INTO reset_codes(user_id,code_hash,expires_at,attempts,created_at) VALUES(?,?,datetime('now','+10 minutes'),0,datetime('now'))",u.id,sha(code+':'+u.id));
await sendMail(u.email,'رمز استعادة كلمة المرور - المساعد',`<div dir="rtl"><p>أهلًا ${hx(u.name)}،</p><p>رمز استعادة كلمة المرور:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>الرمز صالح لمدة 10 دقائق، ويُستخدم مرة واحدة. إذا لم تطلب ذلك فتجاهل هذه الرسالة.</p></div>`).catch(()=>{})}
return{ok:1}});
route('POST','/reset-code',c=>{const email=String(c.b.email||'').trim().toLowerCase(),code=String(c.b.code||'').trim();const bad=()=>{throw err(400,'الرمز غير صحيح أو منتهي، اطلب رمزًا جديدًا')};
const u=email?get('SELECT id FROM users WHERE email=? AND active=1',email):null;if(!u)bad();
const r=get('SELECT code_hash,attempts,datetime(expires_at)>datetime(\'now\') AS fresh FROM reset_codes WHERE user_id=?',u.id);if(!r||!r.fresh||r.attempts>=5)bad();
if(r.code_hash!==sha(code+':'+u.id)){run('UPDATE reset_codes SET attempts=attempts+1 WHERE user_id=?',u.id);bad()}
run('DELETE FROM reset_codes WHERE user_id=?',u.id);const tok=crypto.randomBytes(32).toString('hex');run("INSERT INTO password_resets(user_id,token_hash,expires_at) VALUES(?,?,datetime('now','+15 minutes'))",u.id,sha(tok));return{token:tok}});
route('POST','/verify-email',c=>tx(()=>{const tok=String(c.b.token||'');if(!/^[0-9a-f]{64}$/.test(tok))throw err(400,'الرابط غير صالح أو منتهي');const r=get("SELECT user_id FROM verify_tokens WHERE token_hash=? AND used=0 AND expires_at>datetime('now')",sha(tok));if(!r)throw err(400,'الرابط غير صالح أو منتهي');run('UPDATE users SET email_verified=1 WHERE id=?',r.user_id);run('UPDATE verify_tokens SET used=1 WHERE user_id=?',r.user_id);return{ok:1}}));
route('POST','/me/notify',c=>{const u=need(c);run('UPDATE users SET notify_email=? WHERE id=?',c.b.enabled?1:0,u.id);return{ok:1}});
route('POST','/me/email',async c=>{const u=need(c),email=String(c.b.email||'').trim().toLowerCase();
if(!check(String(c.b.password||''),get('SELECT pass FROM users WHERE id=?',u.id).pass))throw err(401,'كلمة المرور غير صحيحة');
if(!/^[^\s@<>\"'`]+@[^\s@<>\"'`]+\.[^\s@<>\"'`]+$/.test(email))throw err(400,'البريد الإلكتروني غير صالح');
if(email===u.email)return{ok:1};
if(get('SELECT 1 x FROM users WHERE email=? AND id!=?',email,u.id))throw err(409,'البريد مسجّل مسبقًا');
tx(()=>{run('UPDATE users SET email=?,email_verified=? WHERE id=?',email,VERIFY_REQUIRED?0:1,u.id);run('DELETE FROM sessions WHERE user_id=? AND token!=?',u.id,c.tok||'');run('UPDATE verify_tokens SET used=1 WHERE user_id=?',u.id)});
const oldEmail=u.email;sendMail(oldEmail,'تم تغيير بريد حسابك - المساعد','<div dir="rtl"><p>تم تغيير البريد الإلكتروني لحسابك في المساعد.</p><p>إذا لم تكن أنت من قام بذلك، تواصل مع الدعم فورًا.</p></div>').catch(()=>{});
const mailed=VERIFY_REQUIRED?await issueVerify(u.id,email):true;return{ok:1,mailed}});
route('POST','/me/resend-verification',async c=>{const u=need(c);if(u.email_verified)return{ok:1};try{hitOr429('vr|'+u.id,3)}catch{throw err(429,'طلبت الرمز كثيرًا، جرّب لاحقًا')}if(!await issueVerify(u.id,u.email))throw err(503,'تعذّر إرسال البريد الآن، حاول بعد قليل');return{ok:1}});
route('POST','/reset',c=>tx(()=>{const tok=String(c.b.token||''),pw=str(c.b.password,8,100,'كلمة المرور');if(!/^[0-9a-f]{64}$/.test(tok))throw err(400,'الرابط غير صالح أو منتهي');
const r=get("SELECT id,user_id FROM password_resets WHERE token_hash=? AND used=0 AND expires_at>datetime('now')",sha(tok));if(!r)throw err(400,'الرابط غير صالح أو منتهي');
run('UPDATE users SET pass=? WHERE id=?',hash(pw),r.user_id);run('UPDATE password_resets SET used=1 WHERE user_id=?',r.user_id);run('DELETE FROM sessions WHERE user_id=?',r.user_id);audit(r.user_id,'password_reset_self',`user:${r.user_id}`);return{ok:1}}));
route('POST','/verify-code',c=>{const u=need(c),code=String(c.b.code||'').trim();const bad=()=>{throw err(400,'الرمز غير صحيح أو منتهي، اطلب رمزًا جديدًا')};
if(u.email_verified)return{ok:1};const r=get("SELECT code_hash,attempts,datetime(expires_at)>datetime('now') AS fresh FROM verify_codes WHERE user_id=?",u.id);if(!r||!r.fresh||r.attempts>=5)bad();
if(r.code_hash!==sha(code+':'+u.id)){run('UPDATE verify_codes SET attempts=attempts+1 WHERE user_id=?',u.id);bad()}
run('UPDATE users SET email_verified=1 WHERE id=?',u.id);run('DELETE FROM verify_codes WHERE user_id=?',u.id);run('UPDATE verify_tokens SET used=1 WHERE user_id=?',u.id);return{ok:1}});

route('POST','/me/password',c=>{const u=need(c),cur=String(c.b.current||''),nw=String(c.b.password||'');try{hitOr429('pw|'+u.id,10)}catch{throw err(429,'محاولات كثيرة، جرّب لاحقًا')}
if(!check(cur,get('SELECT pass FROM users WHERE id=?',u.id).pass))throw err(401,'كلمة المرور الحالية غير صحيحة');
if(nw.length<8||nw.length>100)throw err(400,'كلمة المرور الجديدة 8 أحرف على الأقل');if(nw===cur)throw err(400,'اختر كلمة مرور مختلفة عن الحالية');
run('UPDATE users SET pass=? WHERE id=?',hash(nw),u.id);run('DELETE FROM sessions WHERE user_id=? AND token!=?',u.id,c.tok||'');return{ok:1}});

route('POST','/contact',async c=>{try{hitOr429('ct|'+c.ip,5)}catch{throw err(429,'أرسلت رسائل كثيرة، جرّب لاحقًا')}
const name=str(c.b.name,2,60,'الاسم'),email=str(c.b.email,5,120,'البريد').toLowerCase(),body=str(c.b.body,10,2000,'الرسالة');
if(!/^[^\s@<>"'`]+@[^\s@<>"'`]+\.[^\s@<>"'`]+$/.test(email))throw err(400,'البريد الإلكتروني غير صالح');
run('INSERT INTO contact_messages(name,email,body) VALUES(?,?,?)',name,email,body);
const s=SET();if(s.support_email)sendMail(s.support_email,'رسالة جديدة من نموذج التواصل - المساعد',`<div dir="rtl"><p>من: ${hx(name)} (${hx(email)})</p><p>${hx(body)}</p></div>`).catch(()=>{});
return{ok:1}});

route('POST','/me/helper-type-request',c=>{const u=need(c);if(u.account_type!=='helper')throw err(400,'للمساعدين فقط');const ht=c.b.helper_type;if(!['individual','establishment','company'].includes(ht))throw err(400,'نوع غير صالح');if(ht===u.helper_type)throw err(400,'هذا هو نوعك الحالي');run('UPDATE users SET helper_type_request=? WHERE id=?',ht,u.id);return{ok:1,pending:ht}});
