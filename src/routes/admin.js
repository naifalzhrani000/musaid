import {DatabaseSync as DBX} from 'node:sqlite';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {route, supplyOf, syncCashHold, matchSections, PORT, db, all, normAr, seedSkills, seedSections, err, tx, hash, check, notify, bal, award, audit, startSession, userOf, need, adm, str, num, R, ADMIN, get, run, SET, restricted, hitOr429, DB_PATH, RESTORE_PENDING, can, helperOf, ensureCommission, cityCoverage, cityOpen} from '../core.js';
import {ASSIST_CITIES} from '../../data.js';
import {snapshot as perfSnapshot} from '../metrics.js';
route('GET','/admin/reports',c=>{can(c,'support');const Q={user:'SELECT name t FROM users WHERE id=?'};
return all("SELECT rp.*,u.name reporter FROM reports rp JOIN users u ON u.id=rp.reporter_id ORDER BY (rp.status='open') DESC,rp.id DESC LIMIT 100").map(r=>({...r,info:get(Q[r.type],r.target_id)?.t}))});
route('POST','/admin/reports/(\\d+)/resolve',c=>{const a=can(c,'support'),r=get('SELECT * FROM reports WHERE id=?',c.p[0]);if(!r)throw err(404,'غير موجود');const note=str(c.b.note,3,300,'الملاحظة');if(c.b.hide&&r.type==='user'&&a.role!=='admin')throw err(403,'إيقاف الحسابات للمدير فقط');
if(c.b.hide){if(r.type==='rating')run('UPDATE ratings SET hidden=1 WHERE id=?',r.target_id);if(r.type==='user'&&r.target_id!==a.id){run('UPDATE users SET active=0 WHERE id=?',r.target_id);run('DELETE FROM sessions WHERE user_id=?',r.target_id)}}
run("UPDATE reports SET status='resolved',note=? WHERE id=?",note,r.id);audit(a.id,'report',`${r.id}:${r.type}:${c.b.hide?'hide':'keep'}:${note}`);return{ok:1}});
route('GET','/admin/stats',c=>{adm(c);const n=s=>get(s).n;return{users:n('SELECT COUNT(*) n FROM users'),points_issued:n('SELECT COALESCE(SUM(delta),0) n FROM points_ledger WHERE delta>0'),rules:all('SELECT * FROM reward_rules'),users_list:all('SELECT id,name,email,role,active,phone,flagged,suspended_until,(flagged=1 OR suspended_until>datetime(\'now\')) restricted,(SELECT COUNT(*) FROM pledges WHERE user_id=users.id) pledged,(SELECT COUNT(*) FROM agreement_cancellations c WHERE c.by_id=users.id AND c.created_at>datetime(\'now\',\'-30 days\')) cancels FROM users ORDER BY id DESC LIMIT 100')}});
route('POST','/admin/rules',c=>{const a=adm(c),p=+c.b.points;if(!Number.isInteger(p)||p<0||!get('SELECT 1 x FROM reward_rules WHERE key=?',c.b.key))throw err(400,'قيمة غير صالحة');
run('UPDATE reward_rules SET points=? WHERE key=?',p,c.b.key);audit(a.id,'rule',`${c.b.key}=${p}`);return{ok:1}});
route('POST','/admin/users/(\\d+)/active',c=>{const a=adm(c),why=str(c.b.reason,3,300,'السبب');if(+c.p[0]===a.id)throw err(400,'لا يمكنك تعطيل حسابك');
run('UPDATE users SET active=? WHERE id=?',c.b.active?1:0,+c.p[0]);if(!c.b.active)run('DELETE FROM sessions WHERE user_id=?',+c.p[0]);audit(a.id,'user_active',`${c.p[0]}:${c.b.active}:${why}`);return{ok:1}});
route('POST','/admin/settings',c=>{const a=adm(c),b=c.b,ib=String(b.iban||'').replace(/\s/g,'').toUpperCase(),cp=+b.commission_percent||0,gd=b.commission_grace_days===''||b.commission_grace_days==null?3:Math.max(0,Math.floor(+b.commission_grace_days||0));if(!/^SA\d{22}$/.test(ib))throw err(400,'رقم الآيبان غير صالح (SA متبوعة بـ 22 رقمًا)');if(cp<0||cp>100)throw err(400,'نسبة العمولة من 0 إلى 100');
const v={bank_name:str(b.bank_name,2,80,'اسم البنك'),account_name:str(b.account_name,2,120,'اسم الحساب'),iban:ib,commission_percent:String(cp),commission_grace_days:String(gd)};for(const k of ['org_name','org_cr','dispute_clause','penalty_rules','support_email','support_phone','support_address'])if(String(b[k]||'').trim())v[k]=str(b[k],2,3000,k);
for(const k of ['terms_text','privacy_text'])if(String(b[k]||'').trim())v[k]=str(b[k],2,20000,k);for(const k of ['cancel_suspend_days']){if(String(b[k]??'')!==''){const n=Math.floor(+b[k]);if(!(n>=1&&n<=3650))throw err(400,'قيمة غير صالحة لإعدادات الإلغاء');v[k]=String(n)}}
for(const k in v)run('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',k,v[k]);audit(a.id,'settings',`iban=${ib};commission=${cp}`);return{ok:1}});
route('GET','/admin/users/(\\d+)/pledge',c=>{adm(c);const r=get('SELECT text,ip,accepted_at FROM pledges WHERE user_id=? ORDER BY id DESC',c.p[0]);if(!r)throw err(404,'لم يوقّع هذا المستخدم التعهد بعد');return r});
route('POST','/admin/users/(\\d+)/lift',c=>{const a=adm(c),why=str(c.b.reason,3,300,'السبب');run('UPDATE users SET flagged=0,suspended_until=NULL WHERE id=?',+c.p[0]);audit(a.id,'lift',`${c.p[0]}:${why}`);notify(+c.p[0],'تم رفع القيود عن حسابك','#/profile');return{ok:1}});
route('GET','/admin/finance',c=>{adm(c);
const sum=s=>get(s).s;
const income=sum("SELECT COALESCE(SUM(amount),0) s FROM agreement_commissions WHERE status='paid'"),due=sum("SELECT COALESCE(SUM(amount),0) s FROM agreement_commissions WHERE status='due'"),expenses=sum("SELECT COALESCE(SUM(amount),0) s FROM expenses"),transfers=0;
const ledger=[...all("SELECT 'وارد' type,'عمولة مؤكدة من اتفاق' title,amount,COALESCE(paid_at,created_at) at FROM agreement_commissions WHERE status='paid' ORDER BY id DESC LIMIT 60"),...all("SELECT 'صادر' type,title,amount,created_at at FROM expenses ORDER BY id DESC LIMIT 60")].sort((a,b)=>String(b.at).localeCompare(String(a.at))).slice(0,80);
return{income,due,expenses,profit:income-expenses,transfers,ledger}});
route('POST','/admin/expenses',c=>{const a=adm(c),title=str(c.b.title,3,120,'البند'),amt=Number(c.b.amount),cat=str(c.b.category||'',0,60,'التصنيف');if(!(amt>0)||amt>1e7)throw err(400,'المبلغ غير صالح');run('INSERT INTO expenses(title,amount,category,by_id) VALUES(?,?,?,?)',title,amt,cat||null,a.id);audit(a.id,'expense',`${title}:${amt}`);return{ok:1}});
route('GET','/admin/users/(\\d+)/activity',c=>{adm(c);const id=+c.p[0],u=get('SELECT id,name,email,city,role,active,flagged FROM users WHERE id=?',id);if(!u)throw err(404,'المستخدم غير موجود');
return{user:u,agreements:get('SELECT COUNT(*) n FROM agreements WHERE a_id=? OR b_id=?',id,id).n,cancels:get('SELECT COUNT(*) n FROM agreement_cancellations WHERE by_id=?',id).n,cancels30:get("SELECT COUNT(*) n FROM agreement_cancellations WHERE by_id=? AND created_at>datetime('now','-30 days')",id).n,reports_against:get("SELECT COUNT(*) n FROM reports WHERE type='user' AND target_id=?",id).n,reports_by:get('SELECT COUNT(*) n FROM reports WHERE reporter_id=?',id).n,rating:get('SELECT ROUND(AVG(stars),1) a,COUNT(*) n FROM ratings WHERE ratee_id=? AND hidden=0',id),pledged:!!get('SELECT 1 x FROM pledges WHERE user_id=?',id)}});

route('GET','/admin/agreement-commissions',c=>{can(c,'finance');return all("SELECT ac.id,ac.amount,ac.status,ac.created_at,u.name helper,a.description FROM agreement_commissions ac JOIN users u ON u.id=ac.helper_id JOIN agreements a ON a.id=ac.agreement_id WHERE ac.status='due' ORDER BY ac.id DESC LIMIT 200")});
route('GET','/admin/failed-searches',c=>{adm(c);return all("SELECT f.text,f.reason,f.city,f.category_id,c.name category,COUNT(*) n,MAX(f.at) last FROM failed_searches f LEFT JOIN skill_categories c ON c.id=f.category_id GROUP BY f.text,f.reason,f.city,f.category_id ORDER BY n DESC,last DESC LIMIT 100")});
route('POST','/admin/sections/(\\d+)/keywords',c=>{const a=adm(c),cat=get('SELECT id,name FROM skill_categories WHERE id=?',+c.p[0]);if(!cat)throw err(404,'القسم غير موجود');const kws=String(c.b.keywords||'').split(/[,،]/).map(normAr).filter(x=>x.length>=2&&x.length<=60).slice(0,15);if(!kws.length)throw err(400,'أدخل كلمة واحدة على الأقل');for(const k of kws)run('INSERT OR IGNORE INTO section_keywords(category_id,word) VALUES(?,?)',cat.id,k);audit(a.id,'section_keywords',`${cat.name}:${kws.join('،')}`);return{ok:1,added:kws}});
route('GET','/admin/audit',c=>{adm(c);return all("SELECT a.id,a.action,a.detail,a.at,u.name admin FROM audit_log a LEFT JOIN users u ON u.id=a.admin_id ORDER BY a.id DESC LIMIT 200")});
route('POST','/admin/users/(\\d+)/role',c=>{const a=adm(c),id=+c.p[0],role=c.b.role;if(!['user','admin'].includes(role))throw err(400,'دور غير صالح');if(id===a.id)throw err(400,'لا يمكنك تغيير دورك بنفسك');if(!get('SELECT 1 x FROM users WHERE id=?',id))throw err(404,'المستخدم غير موجود');
const why=str(c.b.reason,3,300,'السبب');run('UPDATE users SET role=? WHERE id=?',role,id);audit(a.id,'role',`${id}:${role}:${why}`);return{ok:1}});
route('POST','/admin/users/(\\d+)/password',c=>{const a=adm(c),id=+c.p[0];if(!get('SELECT 1 x FROM users WHERE id=?',id))throw err(404,'المستخدم غير موجود');const pw=str(c.b.password,8,100,'كلمة المرور'),why=str(c.b.reason,3,300,'السبب');
run('UPDATE users SET pass=? WHERE id=?',hash(pw),id);run('DELETE FROM sessions WHERE user_id=?',id);audit(a.id,'password_reset',`${id}:${why}`);notify(id,'تم تغيير كلمة مرورك بواسطة الإدارة، سجّل دخولك بالكلمة الجديدة','#/login');return{ok:1}});
route('POST','/admin/broadcast',c=>tx(()=>{const a=adm(c),text=str(c.b.text,5,500,'النص'),link=String(c.b.link||'#/').slice(0,200);const aud=['all','helpers','clients'].includes(c.b.audience)?c.b.audience:'all';const where=aud==='helpers'?" AND account_type='helper'":aud==='clients'?" AND account_type!='helper'":'';const us=all('SELECT id FROM users WHERE active=1'+where);us.forEach(x=>notify(x.id,text,link));audit(a.id,'broadcast',`${aud}:${us.length}:${text.slice(0,80)}`);return{sent:us.length,audience:aud}}));
route('GET','/admin/broadcasts',c=>{adm(c);return all("SELECT a.id,a.detail,a.at,u.name admin FROM audit_log a LEFT JOIN users u ON u.id=a.admin_id WHERE a.action='broadcast' ORDER BY a.id DESC LIMIT 100").map(r=>{const [aud,n,...t]=String(r.detail||'').split(':');return{id:r.id,audience:aud,sent:Number(n)||0,text:t.join(':'),at:r.at,admin:r.admin}})});
route('GET','/admin/backup',c=>{const a=adm(c),f=path.join(os.tmpdir(),`musaed-backup-${Date.now()}.db`);db.exec(`VACUUM INTO '${f.replace(/'/g,"''")}'`);const raw=fs.readFileSync(f);fs.unlinkSync(f);audit(a.id,'backup','manual');return{raw,mime:'application/octet-stream'}});
route('GET','/admin/skills',c=>{adm(c);return all("SELECT s.id,s.name,s.status,c.name cat,u.name suggested_by,(SELECT GROUP_CONCAT(word,'، ') FROM skill_keywords k WHERE k.skill_id=s.id) keywords FROM skills s JOIN skill_categories c ON c.id=s.category_id LEFT JOIN users u ON u.id=s.suggested_by ORDER BY (s.status='pending') DESC,s.id DESC LIMIT 200")});
route('POST','/admin/skills/(\\d+)/review',c=>{const a=adm(c),s=get('SELECT * FROM skills WHERE id=?',+c.p[0]);if(!s)throw err(404,'غير موجود');if(s.status!=='pending')throw err(400,'هذه المهارة ليست بانتظار الاعتماد');const d=c.b.decision;
if(d==='approve'){run("UPDATE skills SET status='approved' WHERE id=?",s.id);run('INSERT OR IGNORE INTO section_keywords(category_id,word) SELECT s.category_id,k.word FROM skill_keywords k JOIN skills s ON s.id=k.skill_id WHERE k.skill_id=?',s.id);audit(a.id,'skill_approve',s.name);if(s.suggested_by)notify(s.suggested_by,`تم اعتماد مهارتك «${s.name}»`,'#/profile');return{ok:1}}
if(d==='reject'){const why=str(c.b.reason,3,300,'السبب');run('DELETE FROM user_skills WHERE skill_id=?',s.id);run('DELETE FROM skill_keywords WHERE skill_id=?',s.id);run('DELETE FROM skills WHERE id=?',s.id);audit(a.id,'skill_reject',`${s.name}:${why}`);if(s.suggested_by)notify(s.suggested_by,`لم تُعتمد مهارة «${s.name}»: ${why}`,'#/profile');return{ok:1}}
throw err(400,'قرار غير صالح')});
route('POST','/admin/skills/(\\d+)/keywords',c=>{const a=adm(c),s=get('SELECT id,name FROM skills WHERE id=?',+c.p[0]);if(!s)throw err(404,'غير موجود');const kws=String(c.b.keywords||'').split(/[,،]/).map(normAr).filter(x=>x.length>=2).slice(0,15);if(!kws.length)throw err(400,'أدخل كلمة واحدة على الأقل');for(const k of kws){run('INSERT OR IGNORE INTO skill_keywords(skill_id,word) VALUES(?,?)',s.id,k);run('INSERT OR IGNORE INTO section_keywords(category_id,word) SELECT category_id,? FROM skills WHERE id=?',k,s.id)}audit(a.id,'skill_keywords',`${s.name}:${kws.join(',')}`);return{ok:1}});
route('POST','/admin/bootstrap',c=>{const u=need(c),T=process.env.ADMIN_SETUP_TOKEN||'';if(!T)throw err(404,'غير متاح');if(get("SELECT 1 x FROM users WHERE role='admin'"))throw err(403,'تم إعداد المدير مسبقًا');
if(!ADMIN||u.email!==ADMIN)throw err(403,'هذا الحساب ليس حساب المالك');const t=String(c.b.token||'');if(t.length!==T.length||!crypto.timingSafeEqual(Buffer.from(t),Buffer.from(T)))throw err(403,'الرمز غير صحيح');
run("UPDATE users SET role='admin' WHERE id=?",u.id);audit(u.id,'bootstrap_admin',`user:${u.id}`);return{ok:1}});

const RESTORE_PREVIEW=DB_PATH+'.preview';
const restoreBackupDir=process.env.BACKUP_DIR||path.join(path.dirname(path.resolve(DB_PATH)),'backups');
const readSqliteFile=(file)=>{const d=new DBX(file);try{const t=new Set(d.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x=>x.name));if(!t.has('users')||!t.has('agreements')||!t.has('skill_categories'))throw err(400,'الملف ليس نسخة صالحة من قاعدة المنصة');const c=n=>d.prepare('SELECT COUNT(*) n FROM '+n).get().n;return{users:c('users'),agreements:c('agreements')}}finally{d.close()}};
route('POST','/admin/restore/preview',c=>{const a=adm(c);const b64=String(c.b.data||'');if(!b64)throw err(400,'اختر ملف النسخة أولًا');const buf=Buffer.from(b64,'base64');if(buf.length<100||buf.subarray(0,15).toString('latin1')!=='SQLite format 3')throw err(400,'الملف ليس قاعدة بيانات SQLite');
fs.writeFileSync(RESTORE_PREVIEW,buf);try{const counts=readSqliteFile(RESTORE_PREVIEW);audit(a.id,'restore_preview',`${buf.length} bytes`);return{ok:1,counts}}catch(e){try{fs.unlinkSync(RESTORE_PREVIEW)}catch{}throw e}});
route('POST','/admin/restore/cancel',c=>{adm(c);try{fs.unlinkSync(RESTORE_PREVIEW)}catch{}try{fs.unlinkSync(RESTORE_PENDING)}catch{}return{ok:1}});
route('POST','/admin/restore/apply',c=>{const a=adm(c);if(String(c.b.confirm||'').trim()!=='استعادة')throw err(400,'اكتب كلمة «استعادة» للتأكيد');if(!fs.existsSync(RESTORE_PREVIEW))throw err(400,'لا توجد معاينة نشطة، اختر الملف وعاينه أولًا');
fs.mkdirSync(restoreBackupDir,{recursive:true,mode:0o700});const safety=path.join(restoreBackupDir,`pre-restore-${new Date().toISOString().replace(/[:.]/g,'-')}.db`);db.exec(`VACUUM INTO '${safety.replace(/'/g,"''")}'`);fs.chmodSync(safety,0o600);
fs.renameSync(RESTORE_PREVIEW,RESTORE_PENDING);audit(a.id,'restore_apply',path.basename(safety));
setTimeout(()=>process.exit(0),800);return{ok:1,restarting:true,safety:path.basename(safety)}});
route('GET','/admin/contact-messages',c=>{can(c,'support');return all('SELECT id,name,email,body,created_at FROM contact_messages ORDER BY id DESC LIMIT 100')});
route('POST','/admin/contact-messages/(\\d+)/delete',c=>{const a=can(c,'support');const m=get('SELECT id FROM contact_messages WHERE id=?',+c.p[0]);if(!m)throw err(404,'غير موجودة');run('DELETE FROM contact_messages WHERE id=?',m.id);audit(a.id,'contact_message_deleted',String(m.id));return{ok:1}});

route('GET','/admin/users',c=>{can(c,'support');const q=String(c.q.q||'').trim().slice(0,80);const like=q?`%${q.replace(/[%_\\]/g,m=>'\\'+m)}%`:'%';return all("SELECT id,name,email,role,account_type,active,flagged,created_at FROM users WHERE (name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\') ORDER BY id DESC LIMIT 200",like,like)});
route('GET','/admin/categories',c=>{adm(c);return all('SELECT id,name,sort FROM skill_categories ORDER BY sort').map(x=>({...x,words:all('SELECT word FROM section_keywords WHERE category_id=? ORDER BY word',x.id).map(r=>r.word)}))});
route('POST','/admin/sections/(\\d+)/keywords/remove',c=>{const a=adm(c),cat=get('SELECT id FROM skill_categories WHERE id=?',+c.p[0]);if(!cat)throw err(404,'القسم غير موجود');const w=normAr(String(c.b.word||''));if(!w)throw err(400,'الكلمة غير صالحة');run('DELETE FROM section_keywords WHERE category_id=? AND word=?',cat.id,w);audit(a.id,'keyword_removed',`${cat.id}:${w}`);return{ok:1}});


route('GET','/admin/points',c=>{can(c,'finance');const q=String(c.q.q||'').trim().slice(0,80);const like=q?`%${q.replace(/[%_\\]/g,m=>'\\'+m)}%`:'%';return all("SELECT u.id,u.name,u.email,COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id=u.id),0) balance FROM users u WHERE (u.name LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\') ORDER BY balance DESC,u.id DESC LIMIT 100",like,like)});
route('POST','/admin/users/(\\d+)/points',c=>{const a=can(c,'finance'),uid=+c.p[0];const u=get('SELECT id FROM users WHERE id=?',uid);if(!u)throw err(404,'المستخدم غير موجود');
const d=Number(c.b.delta);if(!Number.isInteger(d)||d===0||Math.abs(d)>10000)throw err(400,'أدخل عددًا صحيحًا بين -10000 و 10000 (غير صفر)');
const why=str(c.b.reason,3,200,'السبب');const bal=get('SELECT COALESCE(SUM(delta),0) n FROM points_ledger WHERE user_id=?',uid).n;if(bal+d<0)throw err(400,'الرصيد لا يكفي للخصم');
run('INSERT INTO points_ledger(user_id,delta,reason,ref) VALUES(?,?,?,?)',uid,d,'إدارة: '+why,'admin:'+crypto.randomUUID());audit(a.id,'points_adjust',`${uid}:${d}`);return{ok:1,balance:bal+d}});
route('GET','/admin/growth',c=>{adm(c);return{users:all("SELECT date(created_at) d,COUNT(*) n FROM users WHERE created_at>=datetime('now','-30 days') GROUP BY d ORDER BY d")}});

route('GET','/admin/staff',c=>{adm(c);return all("SELECT id,name,email,perms FROM users WHERE role='staff' ORDER BY id")});
route('POST','/admin/staff',c=>{const a=adm(c),email=String(c.b.email||'').trim().toLowerCase();const t=email?get('SELECT id,role FROM users WHERE email=? AND active=1',email):null;if(!t)throw err(404,'لا يوجد حساب فعّال بهذا البريد');if(t.id===a.id)throw err(400,'لا يمكنك تغيير صلاحياتك');if(t.role==='admin')throw err(400,'هذا الحساب مدير بالفعل');
const allowed=['finance','support','accounting'];const perms=[...new Set((Array.isArray(c.b.perms)?c.b.perms:[]).filter(p=>allowed.includes(p)))];
run("UPDATE users SET role=?,perms=? WHERE id=?",perms.length?'staff':'user',perms.join(','),t.id);audit(a.id,'staff_perms',`${t.id}:${perms.join(',')||'none'}`);return{ok:1,perms}});

const wdSince=ts=>{if(!ts)return 0;let d=new Date(String(ts).replace(' ','T')+'Z'),n=0;const now=new Date();for(let x=new Date(d);x<now;x.setUTCDate(x.getUTCDate()+1)){const w=x.getUTCDay();if(w!==5&&w!==6)n++}return n};
route('GET','/admin/disputes',c=>{can(c,'support');const rows=all("SELECT g.id,g.amount,g.description,g.status,g.dispute_decision,g.dispute_note,g.dispute_by,g.dispute_review_by,g.dispute_final,g.disputed_at,g.dispute_decided_at,g.a_id,g.b_id FROM agreements g WHERE g.status='disputed' ORDER BY g.disputed_at");return rows.map(r=>{const open=!r.dispute_decision;const wd=open?wdSince(r.disputed_at):wdSince(r.dispute_decided_at);const limit=open?6:3;return{...r,wd_elapsed:wd,deadline_working_days:limit,overdue:wd>limit}})});
route('POST','/admin/disputes/(\\d+)/decide',c=>tx(()=>{const u=can(c,'support'),id=+c.p[0];const g=get('SELECT * FROM agreements WHERE id=?',id);if(!g||g.status!=='disputed')throw err(404,'النزاع غير موجود أو مغلق');if(g.a_id===u.id||g.b_id===u.id)throw err(403,'لا يفصل في النزاع أحد طرفيه');if(g.dispute_decision)throw err(400,'سبق اتخاذ قرار أولي');
const d=c.b.decision;if(!['completed','not_proven','partial'].includes(d))throw err(400,'قرار غير صالح');const note=str(c.b.note,3,300,'التعليل');
run('UPDATE agreements SET dispute_decision=?,dispute_note=?,dispute_by=?,dispute_decided_at=datetime(\'now\') WHERE id=?',d,note,u.id,id);audit(u.id,'dispute_decide',id+':'+d);return{ok:1}}));
route('POST','/admin/disputes/(\\d+)/review',c=>tx(()=>{const u=can(c,'support'),id=+c.p[0];const g=get('SELECT * FROM agreements WHERE id=?',id);if(!g||g.status!=='disputed'||!g.dispute_decision)throw err(404,'لا يوجد قرار أولي للمراجعة');if(g.dispute_by===u.id)throw err(403,'المراجعة من مسؤول آخر غير من اتخذ القرار الأول');if(g.a_id===u.id||g.b_id===u.id)throw err(403,'لا يراجع أحد طرفي الاتفاق');
const d=c.b.decision;if(!['completed','not_proven','partial'].includes(d))throw err(400,'قرار غير صالح');const final=d;
run('UPDATE agreements SET dispute_review_by=?,dispute_final=?,dispute_decision=?,status=? WHERE id=?',u.id,final==='completed'?1:0,final,final==='completed'?'completed':'closed_disputed',id);
if(final==='completed'){ensureCommission(id)}
if(final==='completed'){run("UPDATE agreement_commissions SET status='due' WHERE agreement_id=? AND status='on_hold' AND amount>0",id)}else{run("UPDATE agreement_commissions SET status='refund_due' WHERE agreement_id=? AND status='paid'",id);run("UPDATE agreement_commissions SET status='void' WHERE agreement_id=? AND status IN ('due','on_hold')",id)}
audit(u.id,'dispute_final',id+':'+final);return{ok:1,status:final==='completed'?'completed':'closed_disputed'}}));

route('GET','/admin/city-coverage',c=>{adm(c);return ASSIST_CITIES.map(city=>{const cv=cityCoverage(city);const missing=all(`SELECT name FROM skill_categories WHERE mode!='online' AND id NOT IN (SELECT us.category_id FROM user_sections us JOIN users u ON u.id=us.user_id WHERE u.city=? AND u.account_type='helper' AND u.active=1 AND u.email_verified=1 AND u.flagged=0) ORDER BY sort,name`,city).map(r=>r.name);return{city,covered:cv.covered,total:cv.total,pct:Math.round(cv.pct*1000)/10,open:cv.open||(JSON.parse(SET().opened_cities||'[]')).includes(city),missing}}).sort((a,b)=>b.pct-a.pct)});
route('POST','/admin/cities/open',c=>{const a=adm(c),city=String(c.b.city||'');if(!ASSIST_CITIES.includes(city))throw err(400,'المدينة غير مدرجة');let list=[];try{list=JSON.parse(SET().opened_cities||'[]')}catch{}if(!list.includes(city))list.push(city);run("INSERT INTO settings(key,value) VALUES('opened_cities',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",JSON.stringify(list));audit(a.id,'city_open',city);return{ok:1}});
route('GET','/admin/supply-report',c=>{adm(c);const thr=Number(SET().vat_threshold)||0;
const months=[];const now=new Date();for(let i=11;i>=0;i--){const d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-i,1));months.push(d.toISOString().slice(0,7))}
const rows=months.map(m=>{
const comm=get("SELECT COALESCE(SUM(c.amount),0) s FROM agreement_commissions c JOIN agreements g ON g.id=c.agreement_id WHERE c.amount>0 AND strftime('%Y-%m',g.completed_at)=?",m).s;
const agr=all("SELECT amount,a_id,b_id FROM agreements WHERE status='completed' AND strftime('%Y-%m',completed_at)=?",m);const value=agr.reduce((s,a)=>s+a.amount,0);const supply=agr.reduce((s,a)=>s+supplyOf(a),0);
const freeCount=get("SELECT COUNT(*) n FROM agreement_commissions c JOIN agreements g ON g.id=c.agreement_id WHERE c.amount=0 AND strftime('%Y-%m',g.completed_at)=?",m).n;
const cancelled=get("SELECT COUNT(*) n FROM agreements WHERE status='cancelled' AND strftime('%Y-%m',updated_at)=?",m).n;
const disputes=get("SELECT COUNT(*) n FROM agreements WHERE disputed_at IS NOT NULL AND strftime('%Y-%m',disputed_at)=?",m).n;
return{month:m,platform_commission:Math.round(comm*100)/100,platform_supply:Math.round(supply*100)/100,task_value:value,free_month_completions:freeCount,cancelled,disputes}});
const total=rows.reduce((s,r)=>s+r.platform_supply,0);const last3=rows.slice(-3).reduce((s,r)=>s+r.platform_supply,0)/3;const projected=Math.round(last3*12);
const status=thr<=0?'not_set':total>=thr?'exceeded':(total>=thr*0.8?'near':'below');
const expectedStatus=thr<=0?'not_set':(total+projected>=thr||projected>=thr?'expected_to_exceed':'below');
return{threshold:thr,trailing_12_months_value:total,projected_next_12_months_value:projected,status,expected_status:expectedStatus,warn_at:Math.round(thr*0.8),deemed_supply_counting:true,rows,note:'تقدير داخلي للمتابعة. الحد الإلزامي يحدده المحاسب، وطلب التسجيل يقدَّم خلال 30 يومًا من نهاية الشهر المعني عند التجاوز أو توقعه.'}});
route('POST','/admin/supply-threshold',c=>{const u=adm(c);const v=Number(c.b.value);if(!Number.isFinite(v)||v<0)throw err(400,'قيمة غير صالحة');run("INSERT INTO settings(key,value) VALUES('vat_threshold',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",String(v));audit(u.id,'vat_threshold',String(v));return{ok:1}});


route('GET','/admin/verifications',c=>{adm(c);return{vat:all("SELECT id,name,email,helper_type,vat_number FROM users WHERE account_type='helper' AND helper_type IN ('establishment','company') AND vat_status='registered' AND vat_verified!=1"),type_requests:all("SELECT id,name,email,helper_type,helper_type_request FROM users WHERE helper_type_request IS NOT NULL")}});
route('POST','/admin/vat/(\\d+)/verify',c=>{const a=adm(c),id=+c.p[0];const u=get('SELECT id FROM users WHERE id=?',id);if(!u)throw err(404,'المستخدم غير موجود');const ok=c.b.decision==='approve';
if(ok)run('UPDATE users SET vat_verified=1 WHERE id=?',id);else run("UPDATE users SET vat_verified=2 WHERE id=?",id);
run('INSERT INTO direct_messages(from_id,to_id,body) VALUES(?,?,?)',a.id,id,ok?'تم التحقق من رقمك الضريبي، ويمكنك الآن استقبال الطلبات.':'لم يتم التحقق من الرقم الضريبي، يرجى مراجعة البيانات وإعادة الإرسال.');audit(a.id,'vat_verify',id+':'+(ok?'approve':'reject'));return{ok:1}});
route('POST','/admin/helper-type/(\\d+)/decide',c=>{const a=adm(c),id=+c.p[0];const u=get('SELECT id,helper_type_request FROM users WHERE id=?',id);if(!u||!u.helper_type_request)throw err(404,'لا يوجد طلب تغيير');
if(c.b.decision==='approve'){run("UPDATE users SET helper_type=?,helper_type_request=NULL,vat_verified=0 WHERE id=?",u.helper_type_request,id)}else{run('UPDATE users SET helper_type_request=NULL WHERE id=?',id)}
run('INSERT INTO direct_messages(from_id,to_id,body) VALUES(?,?,?)',a.id,id,c.b.decision==='approve'?'تمت الموافقة على تغيير نوع حسابك.':'لم تتم الموافقة على تغيير نوع حسابك.');audit(a.id,'helper_type_decide',id+':'+c.b.decision);return{ok:1}});

route('POST','/admin/invoicing',c=>{const a=adm(c);const reg=!!c.b.platform_vat_registered;const vat=String(c.b.platform_vat_number||'').replace(/\s/g,'');
if(reg&&!/^3\d{14}$/.test(vat))throw err(400,'الرقم الضريبي للمنصة يتكون من 15 رقمًا ويبدأ بـ 3');
run("INSERT INTO settings(key,value) VALUES('platform_vat_registered',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",reg?'1':'0');
run("INSERT INTO settings(key,value) VALUES('platform_vat_number',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",reg?vat:'');
audit(a.id,'invoicing_config',reg?'registered':'not_registered');return{ok:1}});
route('POST','/admin/agreement-commissions/(\\d+)/refunded',c=>{can(c,'finance');const row=get("SELECT id FROM agreement_commissions WHERE id=? AND status='refund_due'",c.p[0]);if(!row)throw err(400,'هذه العمولة لا تحتاج استردادًا');run("UPDATE agreement_commissions SET status='refunded' WHERE id=?",row.id);audit(c.u.id,'agreement_commission_refunded',String(row.id));return{ok:1}});

// تحليلات البحث وتحليلات الأقسام (الطلبات المنشورة أُلغيت، فيبقى البحث الفاشل والعرض)
route('GET','/admin/insights',c=>{adm(c);const days=[7,30,0].includes(+c.q.days)?+c.q.days:30,since=days?new Date(Date.now()-days*864e5).toISOString().slice(0,19).replace('T',' '):'1970-01-01 00:00:00';
const supply=new Map(all("SELECT us.category_id,COUNT(*) n FROM user_sections us JOIN users u ON u.id=us.user_id WHERE u.active=1 AND u.account_type='helper' GROUP BY us.category_id").map(x=>[x.category_id,x.n]));
const demand=[];const gap=demand.map(d=>({id:d.id,name:d.name,cat:d.cat,n:d.n,helpers:supply.get(d.id)||0}));
const failed=all(`SELECT text,COUNT(*) n,MAX(at) last FROM failed_searches WHERE at>=? GROUP BY text ORDER BY n DESC,last DESC LIMIT 20`,since);
return{days,total:0,demand,gap,failed}});

// بلاغات الرسائل المباشرة: عرض المحادثة بين الطرفين
route('GET','/admin/reports/(\\d+)/conversation',c=>{const a=can(c,'support'),r=get('SELECT * FROM reports WHERE id=?',+c.p[0]);if(!r)throw err(404,'البلاغ غير موجود');
const m=r.type==='message'?get('SELECT from_id,to_id FROM direct_messages WHERE id=?',r.target_id):null;if(!m)throw err(400,'هذا البلاغ لا يتعلق بمحادثة');
const rows=all('SELECT m.id,m.body,m.from_id,m.created_at,u.name sender FROM direct_messages m JOIN users u ON u.id=m.from_id WHERE (m.from_id=? AND m.to_id=?) OR (m.from_id=? AND m.to_id=?) ORDER BY m.id LIMIT 300',m.from_id,m.to_id,m.to_id,m.from_id);
audit(a.id,'chat_view','report:'+r.id);return{messages:rows}});

route('GET','/admin/ratings',c=>{can(c,'support');return all('SELECT r.id,r.stars,r.comment,r.hidden,r.agreement_id,u.name rater,t.name rated FROM ratings r JOIN users u ON u.id=r.rater_id JOIN users t ON t.id=r.ratee_id ORDER BY r.id DESC LIMIT 200')});
route('POST','/admin/ratings/(\\d+)/hidden',c=>{const a=can(c,'support'),x=get('SELECT id FROM ratings WHERE id=?',+c.p[0]);if(!x)throw err(404,'التقييم غير موجود');const h=c.b.hidden?1:0;run('UPDATE ratings SET hidden=? WHERE id=?',h,x.id);audit(a.id,h?'rating_hidden':'rating_shown',String(x.id));return{ok:1}});

// لوحة الرئيسية: أرقام وسلاسل زمنية من قاعدة البيانات الفعلية (لا بيانات تجريبية)
const DASH_ACTIONS={settings:'تحديث إعدادات المنصة',expense:'تسجيل مصروف',lift:'رفع القيود عن مستخدم',post_hide:'إخفاء منشور',comment_delete:'حذف تعليق',vat_threshold:'تحديث حد التسجيل',invoicing:'تحديث إعدادات الفوترة'};
route('GET','/admin/monitor',c=>{
  adm(c);
  const one=(sql,...a)=>{const r=get(sql,...a);return r?Number(r.n)||0:0};
  const backupDir=process.env.BACKUP_DIR||path.join(path.dirname(path.resolve(DB_PATH)),'backups');
  let lastBackup=null;
  try{
    const files=fs.readdirSync(backupDir).filter(f=>/^backup-.*\.db$/.test(f)).sort();
    if(files.length){const f=files[files.length-1];lastBackup={file:f,at:fs.statSync(path.join(backupDir,f)).mtime.toISOString()}}
  }catch{}
  let dbOk=true;try{get('SELECT 1 x')}catch{dbOk=false}
  let dbSize=0;try{dbSize=fs.statSync(DB_PATH).size}catch{}
  const A={
      open_reports:one("SELECT COUNT(*) n FROM reports WHERE status='open'"),
      disputes:one("SELECT COUNT(*) n FROM agreements WHERE status='disputed'"),
      vat_pending:one("SELECT COUNT(*) n FROM users WHERE account_type='helper' AND vat_status='registered' AND vat_verified=0"),
      type_requests:one("SELECT COUNT(*) n FROM users WHERE helper_type_request IS NOT NULL"),
      stuck_pending:one("SELECT COUNT(*) n FROM agreements WHERE status='pending' AND created_at<datetime('now','-3 days')"),
      stuck_completion:one("SELECT COUNT(*) n FROM agreements WHERE status='completion_requested' AND updated_at<datetime('now','-7 days')"),
      failed_week:one("SELECT COUNT(*) n FROM failed_searches WHERE at>=datetime('now','-7 days')")
  };
  const perf=perfSnapshot();
  const activity={
    sessions_now:one('SELECT COUNT(*) n FROM sessions WHERE exp>?',Date.now()),
    new_users_24h:one("SELECT COUNT(*) n FROM users WHERE created_at>=datetime('now','-1 day')"),
    agreements_24h:one("SELECT COUNT(*) n FROM agreements WHERE created_at>=datetime('now','-1 day')"),
    messages_24h:one("SELECT COUNT(*) n FROM direct_messages WHERE created_at>=datetime('now','-1 day')"),
    posts_24h:one("SELECT COUNT(*) n FROM posts WHERE hidden=0 AND created_at>=datetime('now','-1 day')"),
    login_blocked:one('SELECT COUNT(*) n FROM login_attempts WHERE n>=5 AND t>?',Date.now()-9e5)
  };
  const notifications={
    sent_24h:one("SELECT COUNT(*) n FROM notifications WHERE created_at>=datetime('now','-1 day')"),
    unread_total:one('SELECT COUNT(*) n FROM notifications WHERE read=0'),
    broadcasts_week:one("SELECT COUNT(*) n FROM audit_log WHERE action='broadcast' AND at>=datetime('now','-7 days')")
  };
  const ev=[];
  for(const r of all("SELECT name,created_at at FROM users ORDER BY id DESC LIMIT 5"))ev.push({kind:'user',text:'تسجيل مستخدم جديد: '+r.name,at:r.at,link:'users'});
  for(const r of all("SELECT reason,created_at at FROM reports ORDER BY id DESC LIMIT 5"))ev.push({kind:'report',text:'بلاغ جديد: '+String(r.reason||'').slice(0,60),at:r.at,link:'rpt'});
  for(const r of all("SELECT id,updated_at at FROM agreements WHERE status='disputed' ORDER BY updated_at DESC LIMIT 5"))ev.push({kind:'dispute',text:'نزاع على الطلب رقم '+r.id,at:r.at,link:'rpt'});
  for(const r of all("SELECT id,created_at at FROM agreements ORDER BY id DESC LIMIT 5"))ev.push({kind:'order',text:'طلب جديد رقم '+r.id,at:r.at,link:'orders'});
  for(const r of all("SELECT detail,at FROM audit_log WHERE action='broadcast' ORDER BY id DESC LIMIT 3"))ev.push({kind:'broadcast',text:'إشعار عام أُرسل: '+String(r.detail||'').split(':').slice(2).join(':').slice(0,60),at:r.at,link:'audit'});
  const events=ev.sort((a,b)=>String(b.at).localeCompare(String(a.at))).slice(0,12);
  const L=[],add=(level,text,link)=>L.push({level,text,link});
  const bkAge=lastBackup?(Date.now()-new Date(lastBackup.at).getTime())/36e5:null;
  if(!dbOk)add('critical','قاعدة البيانات لا تستجيب','sys');
  if(perf.requests>=20&&perf.error_rate>=5)add('critical','نسبة أخطاء الخادم مرتفعة: '+perf.error_rate+'%','home');
  else if(perf.errors_5xx>0)add('warn','أخطاء خادم منذ آخر تشغيل: '+perf.errors_5xx,'home');
  if(perf.p95_ms>1500)add('warn','بطء في الاستجابة (الأبطأ 5%): '+perf.p95_ms+' مللي ثانية','home');
  if(perf.memory.heap_pct>=90)add('warn','استهلاك الذاكرة مرتفع: '+perf.memory.heap_pct+'%','home');
  if(perf.loop_lag_p99_ms>200)add('warn','تأخر في معالجة الطلبات: '+perf.loop_lag_p99_ms+' مللي ثانية','home');
  if(bkAge===null)add('warn','لا توجد نسخة احتياطية بعد','sys');
  else if(bkAge>48)add('warn','آخر نسخة احتياطية قبل '+Math.round(bkAge)+' ساعة','sys');
  if(activity.login_blocked>0)add('warn','محاولات دخول محظورة مؤقتًا: '+activity.login_blocked,'users');
  if(A.disputes)add('warn','نزاعات قيد المراجعة: '+A.disputes,'rpt');
  if(A.open_reports)add('warn','بلاغات مفتوحة: '+A.open_reports,'rpt');
  if(A.stuck_pending)add('warn','اتفاقات معلّقة منذ أكثر من 3 أيام: '+A.stuck_pending,'orders');
  if(A.stuck_completion)add('warn','طلبات إتمام بلا تأكيد منذ أكثر من 7 أيام: '+A.stuck_completion,'orders');
  if(A.vat_pending)add('info','أرقام ضريبية بانتظار التوثيق: '+A.vat_pending,'verify');
  if(A.type_requests)add('info','طلبات تغيير نوع الحساب: '+A.type_requests,'verify');
  if(A.failed_week)add('info','عمليات بحث بلا نتيجة خلال 7 أيام: '+A.failed_week,'cats');
  if(!process.env.RESEND_API_KEY)add('info','البريد الإلكتروني غير مفعّل','sys');
  if(!process.env.VAPID_PUBLIC_KEY)add('info','إشعارات الدفع غير مفعّلة','sys');
  if(!process.env.HALA_WEBHOOK_SECRET)add('info','بوابة الدفع غير مفعّلة','sys');
  const status=L.some(x=>x.level==='critical')?'critical':L.some(x=>x.level==='warn')?'warn':'ok';
  return{
    status,alerts_list:L,performance:perf,activity,notifications,events,
    alerts:A,
    system:{
      database:dbOk?'ok':'error',
      db_size_bytes:dbSize,
      uptime_seconds:Math.round(process.uptime()),
      node:process.version,
      last_backup:lastBackup,
      mail:!!process.env.RESEND_API_KEY,
      push:!!process.env.VAPID_PUBLIC_KEY,
      payments:!!process.env.HALA_WEBHOOK_SECRET
    },
    platform:{
      active_users:one("SELECT COUNT(*) n FROM users WHERE active=1"),
      active_helpers:one("SELECT COUNT(*) n FROM users WHERE active=1 AND account_type='helper'"),
      new_users_week:one("SELECT COUNT(*) n FROM users WHERE created_at>=datetime('now','-7 days')"),
      open_agreements:one("SELECT COUNT(*) n FROM agreements WHERE status IN ('pending','agreed','completion_requested')")
    }
  };
});
route('GET','/admin/dashboard',c=>{
  adm(c);
  const days=[7,30,90].includes(+c.q?.days)?+c.q.days:30;
  const since=`-${days} days`;
  const dayList=[];const now=new Date();
  for(let i=days-1;i>=0;i--){const d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-i));dayList.push(d.toISOString().slice(0,10))}
  const fill=(rows,key='n')=>{const m=Object.fromEntries(rows.map(r=>[r.d,Number(r[key])||0]));return dayList.map(d=>m[d]||0)};
  const byDay=(sql,...args)=>all(sql,...args);
  const usersSeries=fill(byDay(`SELECT substr(created_at,1,10) d,COUNT(*) n FROM users WHERE created_at>=datetime('now',?) GROUP BY d`,since));
  const requestsSeries=fill(byDay(`SELECT substr(created_at,1,10) d,COUNT(*) n FROM agreements WHERE created_at>=datetime('now',?) GROUP BY d`,since));
  const profitSeries=fill(byDay(`SELECT substr(paid_at,1,10) d,COALESCE(SUM(amount),0) n FROM agreement_commissions WHERE status='paid' AND paid_at>=datetime('now',?) GROUP BY d`,since),'n');
  const helperSeries=fill(byDay(`SELECT substr(g.created_at,1,10) d,COUNT(DISTINCT x.id) n FROM agreements g JOIN users x ON x.id IN (g.a_id,g.b_id) AND x.account_type='helper' WHERE g.created_at>=datetime('now',?) GROUP BY d`,since));
  const one=(sql,...a)=>get(sql,...a);
  const totals={
    users:one('SELECT COUNT(*) n FROM users').n,
    helpers:one("SELECT COUNT(*) n FROM users WHERE account_type='helper'").n,
    requests:one('SELECT COUNT(*) n FROM agreements').n,
    active_requests:one("SELECT COUNT(*) n FROM agreements WHERE status IN ('agreed','completion_requested')").n,
    completed_requests:one("SELECT COUNT(*) n FROM agreements WHERE status='completed'").n,
    commissions_total:Math.round(one("SELECT COALESCE(SUM(amount),0) s FROM agreement_commissions WHERE status='paid'").s*100)/100,
    commissions_due:Math.round(one("SELECT COALESCE(SUM(amount),0) s FROM agreement_commissions WHERE status='due'").s*100)/100,
    commissions_due_count:one("SELECT COUNT(*) n FROM agreement_commissions WHERE status='due'").n,
    open_reports:one("SELECT COUNT(*) n FROM reports WHERE status='open'").n,
    new_users_period:usersSeries.reduce((a,b)=>a+b,0),
    new_requests_period:requestsSeries.reduce((a,b)=>a+b,0),
  };
  const activity=all('SELECT a.action,a.detail,a.at,u.name admin FROM audit_log a LEFT JOIN users u ON u.id=a.admin_id ORDER BY a.id DESC LIMIT 15').map(r=>({action:DASH_ACTIONS[r.action]||r.action,detail:r.detail||'',at:r.at,admin:r.admin||'النظام'}));
  return{days,labels:dayList,series:{users:usersSeries,requests:requestsSeries,profit:profitSeries,helpers:helperSeries},totals,activity};
});

// ---- الطلبات (الاتفاقات) للإدارة: قائمة وتصنيف ومتعثرة ----
const STUCK_RULES={pending:3,agreed:14,completion_requested:7};
const ORDER_GROUPS={open:['pending'],active:['agreed','completion_requested'],completed:['completed'],cancelled:['cancelled'],disputed:['disputed','closed_disputed']};
const ordersQuery=c=>{
  const g=String(c.q?.group||'all'), q=String(c.q?.q||'').trim().slice(0,80);
  let where='1=1';const args=[];
  if(ORDER_GROUPS[g]){where+=` AND g.status IN (${ORDER_GROUPS[g].map(()=>'?').join(',')})`;args.push(...ORDER_GROUPS[g])}
  if(g==='stuck'){where+=` AND ((g.status='pending' AND julianday('now')-julianday(g.updated_at)>${STUCK_RULES.pending}) OR (g.status='agreed' AND julianday('now')-julianday(g.updated_at)>${STUCK_RULES.agreed}) OR (g.status='completion_requested' AND julianday('now')-julianday(g.updated_at)>${STUCK_RULES.completion_requested}))`}
  if(q){const like=`%${q.replace(/[%_\\]/g,m=>'\\'+m)}%`;where+=` AND (g.description LIKE ? ESCAPE '\\' OR a.name LIKE ? ESCAPE '\\' OR b.name LIKE ? ESCAPE '\\' OR CAST(g.id AS TEXT)=?)`;args.push(like,like,like,q.replace(/\D/g,'')||'-1')}
  return{where,args};
};
route('GET','/admin/orders',c=>{
  can(c,'support');
  const {where,args}=ordersQuery(c);
  const page=Math.max(0,+(c.q?.page)||0);
  const rows=all(`SELECT g.id,g.description,g.amount,g.status,g.created_at,g.updated_at,g.paid_at,
      a.id a_id,a.name a_name,a.account_type a_type,b.id b_id,b.name b_name,b.account_type b_type,
      (SELECT amount FROM agreement_commissions ac WHERE ac.agreement_id=g.id) commission
    FROM agreements g JOIN users a ON a.id=g.a_id JOIN users b ON b.id=g.b_id
    WHERE ${where} ORDER BY g.id DESC LIMIT 50 OFFSET ?`,...args,page*50);
  return rows.map(r=>{const days=(Date.now()-Date.parse(String(r.updated_at).replace(' ','T')+'Z'))/864e5;const lim=STUCK_RULES[r.status];return{...r,days_idle:Math.floor(days),stuck:lim!==undefined&&days>lim}});
});
route('GET','/admin/orders/summary',c=>{
  can(c,'support');
  const cnt=(sql)=>get(sql).n;
  return{all:cnt('SELECT COUNT(*) n FROM agreements'),open:cnt("SELECT COUNT(*) n FROM agreements WHERE status='pending'"),active:cnt("SELECT COUNT(*) n FROM agreements WHERE status IN ('agreed','completion_requested')"),completed:cnt("SELECT COUNT(*) n FROM agreements WHERE status='completed'"),cancelled:cnt("SELECT COUNT(*) n FROM agreements WHERE status='cancelled'"),disputed:cnt("SELECT COUNT(*) n FROM agreements WHERE status IN ('disputed','closed_disputed')"),stuck:get(`SELECT COUNT(*) n FROM agreements g WHERE (g.status='pending' AND julianday('now')-julianday(g.updated_at)>${STUCK_RULES.pending}) OR (g.status='agreed' AND julianday('now')-julianday(g.updated_at)>${STUCK_RULES.agreed}) OR (g.status='completion_requested' AND julianday('now')-julianday(g.updated_at)>${STUCK_RULES.completion_requested})`).n};
});
// تذكير الطرفين بطلب متعثر: إشعار فقط، ولا يغيّر الحالة أو المال
route('POST','/admin/orders/(\\d+)/nudge',c=>{
  const a=can(c,'support'),id=+c.p[0];
  const g=get('SELECT id,a_id,b_id,status FROM agreements WHERE id=?',id);
  if(!g)throw err(404,'الطلب غير موجود');
  const why=str(c.b.reason,3,200,'سبب التذكير');
  const txt=`تذكير من إدارة المنصة بالطلب رقم ${id}: ${why}`;
  notify(g.a_id,txt,'#/direct/'+g.b_id);notify(g.b_id,txt,'#/direct/'+g.a_id);
  audit(a.id,'order_nudge',`${id}:${why}`);
  return{ok:1};
});
// تصدير CSV للطلبات والمستخدمين (للمدير)
const csvEsc=v=>{let t=v==null?'':String(v);if(/^[=+\-@\t\r]/.test(t))t="'"+t;return /[",\n\r]/.test(t)?`"${t.replace(/"/g,'""')}"`:t};
route('GET','/admin/export',c=>{
  adm(c);
  const type=String(c.q?.type||'');
  let head,rows;
  if(type==='orders'){head=['رقم الطلب','الوصف','المبلغ','الحالة','تاريخ الإنشاء','آخر تحديث'];rows=all('SELECT id,description,amount,status,created_at,updated_at FROM agreements ORDER BY id DESC LIMIT 5000').map(r=>[r.id,r.description,r.amount,r.status,r.created_at,r.updated_at])}
  else if(type==='users'){head=['الرقم','الاسم','البريد','المدينة','النوع','الحالة','تاريخ التسجيل'];rows=all('SELECT id,name,email,city,account_type,active,created_at FROM users ORDER BY id DESC LIMIT 5000').map(r=>[r.id,r.name,r.email,r.city,r.account_type,r.active?'مفعل':'موقوف',r.created_at])}
  else throw err(400,'نوع التصدير غير صالح');
  const csv='\ufeff'+[head,...rows].map(r=>r.map(csvEsc).join(',')).join('\r\n');
  return{raw:Buffer.from(csv,'utf8'),mime:'text/csv; charset=utf-8'};
});

// ملف المستخدم للإدارة: بياناته، أقسامه، تقييماته، وطلباته
route('POST','/admin/helpers/(\\d+)/platform-invoice',c=>tx(()=>{const a=adm(c),hid=+c.p[0];const h=get("SELECT id,name FROM users WHERE id=? AND account_type='helper'",hid);if(!h)throw err(404,'المساعد غير موجود');
const rows=all("SELECT id,amount FROM agreement_commissions WHERE helper_id=? AND status='due' ORDER BY id",hid);if(!rows.length)throw err(400,'لا توجد مستحقات مفتوحة لهذا المساعد');
const total=Math.round(rows.reduce((t,r)=>t+Number(r.amount),0)*100)/100;const y=new Date().getFullYear();const n=get('SELECT COUNT(*)+1 n FROM platform_invoices WHERE number LIKE ?',`PI-${y}-%`).n;const number=`PI-${y}-${String(n).padStart(4,'0')}`;
const id=Number(run('INSERT INTO platform_invoices(number,helper_id,amount,commission_ids) VALUES(?,?,?,?)',number,hid,total,JSON.stringify(rows.map(r=>r.id))).lastInsertRowid);
run('INSERT INTO audit_log(admin_id,action,detail) VALUES(?,?,?)',a.id,'platform_invoice_issued',`${number}:helper=${hid}:amount=${total}`);
notify(hid,`أصدرت المنصة فاتورة مستحقات رقم ${number} بقيمة ${total} ريال، وتُسدَّد بالطريقة المتفق عليها عبر حسابك في هلا`,'#/platform-dues');
return{ok:1,id,number,amount:total}}));
route('GET','/admin/platform-invoices',c=>{adm(c);return all('SELECT p.id,p.number,p.amount,p.status,p.issued_at,p.paid_at,u.name helper FROM platform_invoices p JOIN users u ON u.id=p.helper_id ORDER BY p.id DESC LIMIT 200')});
route('POST','/admin/platform-invoices/(\\d+)/mark-paid',c=>tx(()=>{const a=adm(c),id=+c.p[0];const r=get('SELECT * FROM platform_invoices WHERE id=?',id);if(!r)throw err(404,'الفاتورة غير موجودة');if(r.status==='paid')throw err(400,'الفاتورة مسددة');
const ids=JSON.parse(r.commission_ids||'[]').map(Number).filter(Boolean);if(ids.length)run(`UPDATE agreement_commissions SET status='settled',paid_at=datetime('now') WHERE status='due' AND helper_id=? AND id IN (${ids.map(()=>'?').join(',')})`,r.helper_id,...ids);
run("UPDATE platform_invoices SET status='paid',paid_at=datetime('now'),paid_note=? WHERE id=?",String(c.b.note||'').trim().slice(0,200),id);
run('INSERT INTO audit_log(admin_id,action,detail) VALUES(?,?,?)',a.id,'platform_invoice_paid',`${r.number}`);syncCashHold(r.helper_id);notify(r.helper_id,`سُجِّلت تسوية الفاتورة ${r.number}`,'#/platform-dues');return{ok:1}}));

route('GET','/admin/users/(\\d+)/profile',c=>{
  can(c,'support');
  const id=+c.p[0];
  const u=get('SELECT id,name,email,phone,city,role,account_type,helper_type,vat_status,vat_verified,active,flagged,suspended_until,cash_hold,created_at,email_verified FROM users WHERE id=?',id);
  if(!u)throw err(404,'المستخدم غير موجود');
  const sections=all('SELECT c.name FROM user_sections us JOIN skill_categories c ON c.id=us.category_id WHERE us.user_id=?',id).map(x=>x.name);
  const reviews=all('SELECT r.stars,r.comment,r.created_at,r.hidden,rv.name rater FROM ratings r JOIN users rv ON rv.id=r.rater_id WHERE r.ratee_id=? ORDER BY r.id DESC LIMIT 30',id);
  const orders=all(`SELECT g.id,g.description,g.amount,g.status,g.updated_at,a.name a_name,b.name b_name FROM agreements g JOIN users a ON a.id=g.a_id JOIN users b ON b.id=g.b_id WHERE g.a_id=? OR g.b_id=? ORDER BY g.id DESC LIMIT 30`,id,id);
  const avg=get('SELECT ROUND(AVG(stars),1) a,COUNT(*) n FROM ratings WHERE ratee_id=? AND hidden=0',id);
  return{user:u,sections,reviews,orders,rating:{avg:avg.a,count:avg.n},stats:{orders:orders.length,completed:orders.filter(o=>o.status==='completed').length,cancelled:orders.filter(o=>o.status==='cancelled').length}};
});

route('GET','/admin/admins',c=>{adm(c);return all("SELECT id,name,email,active,created_at FROM users WHERE role='admin' ORDER BY id")});

// إعدادات المنصة للمدير: قراءة كل المفاتيح القابلة للتحرير
const SETTING_KEYS=['bank_name','account_name','iban','commission_percent','commission_grace_days','org_name','org_cr','dispute_clause','penalty_rules','support_email','support_phone','support_address','platform_vat_registered','platform_vat_number'];
route('GET','/admin/settings',c=>{adm(c);const out={};for(const k of SETTING_KEYS)out[k]=SET()[k]??'';return out});

// اختبار محرك المطابقة للمدير: أي الأقسام تطابق عبارة بحث، دون حفظ شيء
route('POST','/admin/match-test',c=>{
  adm(c);
  const text=str(c.b.text,2,200,'عبارة البحث');
  const hits=matchSections(text);
  return{text,matched:hits.length>0,hits:hits.map(h=>({id:h.id,name:h.name,score:h.score}))};
});

// أداء المساعدين: تقييم وطلبات وإلغاءات وبلاغات ضدهم وعمولات، من الجداول الفعلية
route('GET','/admin/helper-performance',c=>{
  can(c,'support');
  const days=[30,90,365].includes(+c.q?.days)?+c.q.days:90;
  return all(`SELECT u.id,u.name,u.city,u.vat_status,u.active,
      (SELECT ROUND(AVG(r.stars),2) FROM ratings r WHERE r.ratee_id=u.id AND r.hidden=0) rating,
      (SELECT COUNT(*) FROM ratings r WHERE r.ratee_id=u.id AND r.hidden=0) rating_count,
      (SELECT COUNT(*) FROM agreements g WHERE (g.a_id=u.id OR g.b_id=u.id) AND g.created_at>=datetime('now',?)) orders,
      (SELECT COUNT(*) FROM agreements g WHERE (g.a_id=u.id OR g.b_id=u.id) AND g.status='completed' AND g.created_at>=datetime('now',?)) completed,
      (SELECT COUNT(*) FROM agreements g WHERE (g.a_id=u.id OR g.b_id=u.id) AND g.status='cancelled' AND g.created_at>=datetime('now',?)) cancelled,
      (SELECT COUNT(*) FROM reports rp WHERE rp.type='user' AND rp.target_id=u.id) reports,
      (SELECT COALESCE(SUM(ac.amount),0) FROM agreement_commissions ac WHERE ac.helper_id=u.id AND ac.status='paid') commissions_paid
    FROM users u WHERE u.account_type='helper' AND u.role!='admin' ORDER BY completed DESC, u.id LIMIT 200`,`-${days} days`,`-${days} days`,`-${days} days`).map(r=>({...r,days}));
});

// بلاغ محادثة واحد للإدارة: بيانات البلاغ والطرفان، والقرار السابق إن وُجد
route('GET','/admin/reports/(\\d+)',c=>{
  can(c,'support');
  const r=get('SELECT rp.id,rp.type,rp.target_id,rp.reason,rp.status,rp.note,rp.created_at,u.name reporter FROM reports rp JOIN users u ON u.id=rp.reporter_id WHERE rp.id=?',+c.p[0]);
  if(!r)throw err(404,'البلاغ غير موجود');
  if(r.type!=='message')throw err(400,'هذا البلاغ لا يتعلق بمحادثة');
  const m=get('SELECT m.from_id,m.to_id,fa.name from_name,ta.name to_name FROM direct_messages m JOIN users fa ON fa.id=m.from_id JOIN users ta ON ta.id=m.to_id WHERE m.id=?',r.target_id);
  return{...r,parties:m?{from_id:m.from_id,from_name:m.from_name,to_id:m.to_id,to_name:m.to_name}:null};
});

route('POST','/admin/helpers/(\\d+)/settle-dues',c=>tx(()=>{adm(c);const id=+c.p[0];if(!get('SELECT 1 x FROM users WHERE id=?',id))throw err(404,'المستخدم غير موجود');const r=run("UPDATE agreement_commissions SET status='settled',paid_at=datetime('now') WHERE helper_id=? AND status='due'",id);run("INSERT INTO audit_log(admin_id,action,detail) VALUES(NULL,?,?)",'settle_dues',id+':'+r.changes);if(r.changes)notify(id,'تم تسجيل سداد عمولاتك المستحقة لدى المنصة','#/profile');return{ok:1,settled:r.changes}}));
