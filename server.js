import {DatabaseSync} from 'node:sqlite';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
const PORT=+process.env.PORT||3000,ADMIN=(process.env.ADMIN_EMAIL||'').toLowerCase();
const db=new DatabaseSync(process.env.DB_FILE||'data.db');
db.exec(`PRAGMA foreign_keys=ON;PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,pass TEXT NOT NULL,city TEXT,role TEXT NOT NULL DEFAULT 'user',active INT NOT NULL DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INT NOT NULL REFERENCES users(id),exp INT NOT NULL);
CREATE TABLE IF NOT EXISTS requests(id INTEGER PRIMARY KEY,user_id INT NOT NULL REFERENCES users(id),title TEXT NOT NULL,description TEXT NOT NULL,city TEXT,category TEXT,budget REAL,negotiable INT DEFAULT 1,status TEXT NOT NULL DEFAULT 'published',helper_id INT REFERENCES users(id),hidden INT DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS ix_req ON requests(status,city,id);
CREATE TABLE IF NOT EXISTS offers(id INTEGER PRIMARY KEY,request_id INT NOT NULL REFERENCES requests(id),user_id INT NOT NULL REFERENCES users(id),message TEXT NOT NULL,price REAL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(request_id,user_id));
CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY,request_id INT NOT NULL REFERENCES requests(id),from_id INT NOT NULL,to_id INT NOT NULL,body TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS ix_msg ON messages(request_id,from_id,to_id);
CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY,user_id INT NOT NULL,text TEXT NOT NULL,link TEXT,read INT DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS reward_rules(key TEXT PRIMARY KEY,points INT NOT NULL DEFAULT 0 CHECK(points>=0));
CREATE TABLE IF NOT EXISTS points_ledger(id INTEGER PRIMARY KEY,user_id INT NOT NULL,delta INT NOT NULL,reason TEXT NOT NULL,ref TEXT UNIQUE NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS status_log(id INTEGER PRIMARY KEY,request_id INT,status TEXT,by_id INT,at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY,admin_id INT,action TEXT,detail TEXT,at TEXT DEFAULT CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO reward_rules(key,points) VALUES('complete_requester',0),('complete_helper',0);`);
db.exec(`CREATE TABLE IF NOT EXISTS attachments(id INTEGER PRIMARY KEY,user_id INT NOT NULL,mime TEXT NOT NULL,data BLOB NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY,request_id INT NOT NULL REFERENCES requests(id),payer_id INT NOT NULL,payee_id INT NOT NULL,amount REAL NOT NULL CHECK(amount>0),proof_id INT NOT NULL REFERENCES attachments(id),status TEXT NOT NULL DEFAULT 'pending',note TEXT,reviewed_by INT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,reviewed_at TEXT);
CREATE TABLE IF NOT EXISTS ratings(id INTEGER PRIMARY KEY,request_id INT NOT NULL REFERENCES requests(id),rater_id INT NOT NULL,ratee_id INT NOT NULL,stars INT NOT NULL CHECK(stars BETWEEN 1 AND 5),comment TEXT,hidden INT DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(request_id,rater_id));
CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY,reporter_id INT NOT NULL,type TEXT NOT NULL,target_id INT NOT NULL,reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',note TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(reporter_id,type,target_id));
CREATE TABLE IF NOT EXISTS blocks(blocker_id INT NOT NULL,blocked_id INT NOT NULL,PRIMARY KEY(blocker_id,blocked_id));
CREATE TABLE IF NOT EXISTS commissions(id INTEGER PRIMARY KEY,request_id INT UNIQUE NOT NULL REFERENCES requests(id),helper_id INT NOT NULL,amount REAL NOT NULL,status TEXT NOT NULL DEFAULT 'due',proof_id INT,note TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,submitted_at TEXT,reviewed_at TEXT);
CREATE TABLE IF NOT EXISTS pledges(id INTEGER PRIMARY KEY,user_id INT NOT NULL,version INT NOT NULL,ip TEXT,ua TEXT,text TEXT NOT NULL,accepted_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(user_id,version));
CREATE TABLE IF NOT EXISTS cancellations(id INTEGER PRIMARY KEY,request_id INT NOT NULL REFERENCES requests(id),by_id INT NOT NULL,other_id INT NOT NULL,reason TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS expenses(id INTEGER PRIMARY KEY,title TEXT NOT NULL,amount REAL NOT NULL CHECK(amount>0),category TEXT,by_id INT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS skill_categories(id INTEGER PRIMARY KEY,name TEXT UNIQUE NOT NULL,sort INT DEFAULT 0);
CREATE TABLE IF NOT EXISTS skills(id INTEGER PRIMARY KEY,category_id INT NOT NULL REFERENCES skill_categories(id),name TEXT UNIQUE NOT NULL,status TEXT NOT NULL DEFAULT 'pending',suggested_by INT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS skill_keywords(id INTEGER PRIMARY KEY,skill_id INT NOT NULL REFERENCES skills(id),word TEXT NOT NULL,UNIQUE(skill_id,word));
CREATE TABLE IF NOT EXISTS user_skills(user_id INT NOT NULL REFERENCES users(id),skill_id INT NOT NULL REFERENCES skills(id),PRIMARY KEY(user_id,skill_id));
CREATE TABLE IF NOT EXISTS portfolio(id INTEGER PRIMARY KEY,user_id INT NOT NULL REFERENCES users(id),attachment_id INT NOT NULL REFERENCES attachments(id),caption TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS direct_messages(id INTEGER PRIMARY KEY,from_id INT NOT NULL REFERENCES users(id),to_id INT NOT NULL REFERENCES users(id),body TEXT NOT NULL,attachment_id INT REFERENCES attachments(id),created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS ix_direct ON direct_messages(from_id,to_id);
CREATE TABLE IF NOT EXISTS password_resets(id INTEGER PRIMARY KEY,user_id INT NOT NULL REFERENCES users(id),token_hash TEXT NOT NULL UNIQUE,expires_at TEXT NOT NULL,used INT NOT NULL DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS payouts(id INTEGER PRIMARY KEY,request_id INT UNIQUE NOT NULL REFERENCES requests(id),helper_id INT NOT NULL,amount REAL NOT NULL CHECK(amount>=0),status TEXT NOT NULL DEFAULT 'pending',ref TEXT,paid_by INT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,paid_at TEXT);`);
for(const s of ['ALTER TABLE requests ADD COLUMN category TEXT','ALTER TABLE requests ADD COLUMN image_id INT','ALTER TABLE messages ADD COLUMN attachment_id INT','ALTER TABLE users ADD COLUMN iban TEXT','ALTER TABLE users ADD COLUMN national_id TEXT','ALTER TABLE users ADD COLUMN phone TEXT','ALTER TABLE users ADD COLUMN address TEXT','ALTER TABLE requests ADD COLUMN agreed_price REAL','ALTER TABLE requests ADD COLUMN price_by INT','ALTER TABLE requests ADD COLUMN price_ok INT DEFAULT 0','ALTER TABLE users ADD COLUMN suspended_until TEXT','ALTER TABLE users ADD COLUMN flagged INT DEFAULT 0','ALTER TABLE users ADD COLUMN bio TEXT','CREATE UNIQUE INDEX IF NOT EXISTS ux_users_nid ON users(national_id) WHERE national_id IS NOT NULL','CREATE UNIQUE INDEX IF NOT EXISTS ux_users_phone ON users(phone) WHERE phone IS NOT NULL'])try{db.exec(s)}catch{}
const all=(s,...a)=>db.prepare(s).all(...a),get=(s,...a)=>db.prepare(s).get(...a),run=(s,...a)=>db.prepare(s).run(...a);
const normAr=s=>String(s||'').normalize('NFKC').replace(/[\u064B-\u065F\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').toLowerCase().trim();
const SKILL_SEED=[['تقنية وتصميم',[['برمجة',['برمجة','مبرمج','مطور','developer']],['تصميم مواقع',['موقع','مواقع','ووردبريس','متجر','website']],['تصميم شعارات',['شعار','لوقو','هوية بصرية']],['تصميم تطبيقات',['تطبيق','تطبيقات','app']]]],
['تصوير وإعلام',[['تصوير',['تصوير','فوتو','فوتوغرافي','كاميرا','مصور']],['مونتاج فيديو',['مونتاج','فيديو','مصمم فيديو']],['إدارة حسابات تواصل',['تواصل اجتماعي','انستقرام','سوشيال ميديا']]]],
['نقل وتوصيل',[['نقل أثاث',['نقل','عفش','اثاث','أثاث']],['توصيل مشتريات',['مشتريات','بقالة','سوبرماركت']],['توصيل طلبات',['توصيل','اوصل','أوصل']]]],
['صيانة وإصلاح',[['كهرباء',['كهرباء','كهربائي']],['سباكة',['سباكة','سباك','تسريب']],['تكييف',['مكيف','تكييف']],['نجارة',['نجار','نجارة','باب']],['سيارات',['سيارة','سيارات']]]],
['منزل وتنظيف',[['تنظيف',['تنظيف','نظافة','غسيل']],['ترتيب',['ترتيب','تنظيم']],['حدائق',['حديقة','حدائق']]]],
['طبخ وضيافة',[['طبخ منزلي',['طبخ','طباخ','وجبات']],['تجهيز مناسبات',['مناسبة','حفل','ضيافة']]]],
['أعمال يدوية ومهن',[['خياطة',['خياطة','خياط','تفصيل']],['حرف يدوية',['يدوي','حرف يدوية']]]],
['تعليم ومساعدة شخصية',[['دروس',['دروس','تدريس','مدرس']],['معاملات وأوراق',['معاملة','معاملات','اوراق']]]],
['أخرى',[['أخرى',['أخرى']]]]];
const seedSkills=()=>{if(get('SELECT COUNT(*) n FROM skill_categories').n>0)return;SKILL_SEED.forEach(([cn,skills],ci)=>{const cid=Number(run('INSERT INTO skill_categories(name,sort) VALUES(?,?)',cn,ci).lastInsertRowid);skills.forEach(([sn,kws])=>{const sid=Number(run("INSERT INTO skills(category_id,name,status) VALUES(?,?,'approved')",cid,sn).lastInsertRowid);for(const k of new Set([normAr(sn),...kws.map(normAr)]))run('INSERT OR IGNORE INTO skill_keywords(skill_id,word) VALUES(?,?)',sid,k)})})};
seedSkills();
const err=(s,m)=>Object.assign(new Error(m),{s});
const tx=f=>{db.exec('BEGIN IMMEDIATE');try{const r=f();db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}};
const hash=p=>{const s=crypto.randomBytes(16).toString('hex');return s+':'+crypto.scryptSync(p,s,64).toString('hex')};
const check=(p,h)=>{const [s,x]=h.split(':');return crypto.timingSafeEqual(crypto.scryptSync(p,s,64),Buffer.from(x,'hex'))};
const notify=(u,t,l)=>run('INSERT INTO notifications(user_id,text,link) VALUES(?,?,?)',u,t,l??null);
const bal=u=>get('SELECT COALESCE(SUM(delta),0) b FROM points_ledger WHERE user_id=?',u).b;
const award=(u,key,ref)=>{const p=get('SELECT points FROM reward_rules WHERE key=?',key)?.points||0;if(p>0&&run('INSERT OR IGNORE INTO points_ledger(user_id,delta,reason,ref) VALUES(?,?,?,?)',u,p,key,ref).changes)notify(u,`أُضيفت ${p} نقطة إلى محفظتك`,'#/profile')};
const log=(id,st,by)=>run('INSERT INTO status_log(request_id,status,by_id) VALUES(?,?,?)',id,st,by);
const audit=(a,act,d)=>run('INSERT INTO audit_log(admin_id,action,detail) VALUES(?,?,?)',a,act,d);
const startSession=(res,uid)=>{const t=crypto.randomBytes(32).toString('hex');run('INSERT INTO sessions VALUES(?,?,?)',t,uid,Date.now()+6048e5);res.setHeader('Set-Cookie',`sid=${t}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${res.req.headers['x-forwarded-proto']==='https'?'; Secure':''}`)};
const userOf=t=>t?get('SELECT u.id,u.name,u.email,u.city,u.role,u.active,u.iban,u.national_id,u.phone,u.address FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.exp>? AND u.active=1',t,Date.now()):undefined;
const need=c=>{if(!c.u)throw err(401,'سجّل الدخول أولًا');return c.u};
const adm=c=>{if(need(c).role!=='admin')throw err(403,'غير مصرح');return c.u};
const str=(v,min,max,n)=>{v=String(v??'').trim();if(v.length<min||v.length>max)throw err(400,`${n}: الطول بين ${min} و${max} حرفًا`);return v};
const num=(v,n)=>{if(v===''||v==null)return null;v=Number(v);if(!(v>=0)||v>1e7)throw err(400,n+' غير صالح');return v};
const R=[],route=(m,p,f)=>R.push([m,new RegExp('^/api'+p+'$'),f]);
const fails=new Map();
route('POST','/register',c=>{const b=c.b,name=str(b.name,2,60,'الاسم'),email=str(b.email,5,120,'البريد').toLowerCase(),city=str(b.city||'',0,60,'المدينة');
if(!/^\S+@\S+\.\S+$/.test(email))throw err(400,'البريد غير صالح');str(b.password,8,100,'كلمة المرور');if(!b.terms)throw err(400,'يجب قبول الشروط وسياسة الخصوصية');
let id;try{id=Number(run('INSERT INTO users(name,email,pass,city,role) VALUES(?,?,?,?,?)',name,email,hash(b.password),city,'user').lastInsertRowid)}catch{throw err(409,'البريد مسجّل مسبقًا')}
startSession(c.res,id);return{ok:1}});
route('POST','/login',c=>{const email=String(c.b.email||'').toLowerCase(),k=c.ip+email,f=fails.get(k)||{n:0,t:Date.now()};if(Date.now()-f.t>9e5){f.n=0;f.t=Date.now()}
if(f.n>=8)throw err(429,'محاولات كثيرة، حاول بعد قليل');const u=get('SELECT * FROM users WHERE email=?',email);
if(!u||!check(String(c.b.password||''),u.pass)){f.n++;fails.set(k,f);throw err(401,'البريد أو كلمة المرور غير صحيحة')}
if(!u.active)throw err(403,'الحساب معطّل');startSession(c.res,u.id);return{ok:1}});
route('POST','/logout',c=>{run('DELETE FROM sessions WHERE token=?',c.tok||'');return{ok:1}});
route('GET','/me',c=>c.u?{user:c.u,unread:get('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read=0',c.u.id).n}:{user:null});
route('POST','/profile',c=>{const u=need(c),ib=String(c.b.iban||'').replace(/\s/g,'').toUpperCase(),nid=String(c.b.national_id||'').replace(/\s/g,''),ph=String(c.b.phone||'').replace(/[\s-]/g,'');
if(ib&&!/^SA\d{22}$/.test(ib))throw err(400,'رقم الآيبان غير صالح (SA متبوعة بـ 22 رقمًا)');
if(nid&&!/^[12]\d{9}$/.test(nid))throw err(400,'رقم الهوية أو الإقامة غير صالح (10 أرقام تبدأ بـ 1 أو 2)');
let phone=null;if(ph){const m=/^(?:\+?966|0)(5\d{8})$/.exec(ph);if(!m)throw err(400,'رقم الجوال غير صالح (مثال: 05XXXXXXXX)');phone='0'+m[1]}
const ad=str(c.b.address||'',0,200,'العنوان');
run('UPDATE users SET name=?,city=?,iban=?,national_id=COALESCE(?,national_id),phone=COALESCE(?,phone),address=COALESCE(?,address) WHERE id=?',str(c.b.name,2,60,'الاسم'),str(c.b.city||'',0,60,'المدينة'),ib||null,nid||null,phone,ad||null,u.id);return{ok:1}});
route('GET','/requests',c=>{const q=c.q,w=['r.hidden=0'],a=[];
if(q.q){w.push('(r.title LIKE ? OR r.description LIKE ? OR r.city LIKE ?)');const l=`%${q.q}%`;a.push(l,l,l)}
if(!q.mine)w.push("r.status!='draft'");
if(q.category){w.push('r.category=?');a.push(q.category)}
if(q.city){w.push('r.city LIKE ?');a.push(`%${q.city}%`)}
if(q.min){w.push('r.budget>=?');a.push(+q.min)}if(q.max){w.push('r.budget<=?');a.push(+q.max)}
if(q.status){w.push('r.status=?');a.push(q.status)}
if(q.mine&&c.u){w.push('(r.user_id=? OR r.helper_id=? OR r.id IN (SELECT request_id FROM offers WHERE user_id=?))');a.push(c.u.id,c.u.id,c.u.id)}
return all(`SELECT r.id,r.title,substr(r.description,1,140) description,r.city,r.category,r.image_id,r.budget,r.negotiable,r.status,r.created_at,u.name owner,(SELECT COUNT(*) FROM offers o WHERE o.request_id=r.id) offers FROM requests r JOIN users u ON u.id=r.user_id WHERE ${w.join(' AND ')} ORDER BY r.id DESC LIMIT 60`,...a)});
route('POST','/requests',c=>{const u=need(c),b=c.b,_=restricted(u.id),title=str(b.title,3,120,'العنوان'),d=str(b.description,10,3000,'الوصف'),city=str(b.city||'',0,60,'المدينة'),budget=num(b.budget,'الميزانية'),cat=str(b.category||'',0,40,'التصنيف'),st=b.draft?'draft':'published',img=own(u,b.image_id);
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
if(r.user_id===u.id)throw err(400,'لا يمكنك التقدم لطلبك');if(!['published','negotiating'].includes(r.status))throw err(400,'الطلب لم يعد متاحًا');if(blocked(u.id,r.user_id))throw err(403,'لا يمكن التقدم لهذا الطلب');
if(!get('SELECT 1 x FROM pledges WHERE user_id=? AND version=?',u.id,PV))throw err(403,'يجب تأكيد تعهد سداد العمولة أولًا');
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
const peerOk=(r,me,peer)=>me===r.user_id?!!get('SELECT 1 x FROM offers WHERE request_id=? AND user_id=?',r.id,peer):peer===r.user_id&&!!get('SELECT 1 x FROM offers WHERE request_id=? AND user_id=?',r.id,me);
const blocked=(a,b)=>!!get('SELECT 1 x FROM blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)',a,b,b,a);
const own=(u,id)=>{if(!id)return null;if(!get('SELECT 1 x FROM attachments WHERE id=? AND user_id=?',+id,u.id))throw err(400,'المرفق غير صالح');return +id};
const send=(r,u,to,body,att)=>{if(blocked(u.id,to))throw err(403,'لا يمكن التواصل مع هذا المستخدم');const id=Number(run('INSERT INTO messages(request_id,from_id,to_id,body,attachment_id) VALUES(?,?,?,?,?)',r.id,u.id,to,body,att).lastInsertRowid);notify(to,`رسالة جديدة بخصوص: ${r.title}`,'#/chat/'+r.id+'/'+u.id);return id};
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
route('POST','/requests/(\\d+)/payment',c=>tx(()=>{const u=need(c),r=get('SELECT * FROM requests WHERE id=?',c.p[0]);if(!r||r.user_id!==u.id||!r.helper_id)throw err(403,'غير مصرح');if(!['helper_chosen','in_progress'].includes(r.status))throw err(400,'الحالة لا تسمح بتسجيل دفعة');if(!r.price_ok)throw err(400,'يجب أن يعتمد الطرفان السعر النهائي قبل التحويل');if(!get('SELECT iban FROM users WHERE id=?',r.helper_id).iban)throw err(400,'المساعد لم يضف رقم الآيبان بعد، اطلب منه إضافته من ملفه الشخصي');
const amt=num(c.b.amount,'المبلغ'),proof=own(u,c.b.attachment_id);if(!amt||!proof)throw err(400,'أدخل المبلغ وأرفق صورة التحويل');
const used=get("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE request_id=? AND status!='rejected'",r.id).s;if(used+amt>r.agreed_price+1e-9)throw err(400,`المبلغ يتجاوز المتبقي من السعر المتفق عليه (${r.agreed_price-used} ر.س)`);
const pid=Number(run('INSERT INTO payments(request_id,payer_id,payee_id,amount,proof_id) VALUES(?,?,?,?,?)',r.id,u.id,r.helper_id,amt,proof).lastInsertRowid);
send(r,u,r.helper_id,`إثبات تحويل بمبلغ ${amt} ر.س إلى المساعد (بانتظار تأكيد الاستلام)`,proof);all("SELECT id FROM users WHERE role='admin'").forEach(a=>notify(a.id,`دفعة بانتظار المراجعة: ${r.title}`,'#/admin'));return{id:pid}}));
route('GET','/admin/payments',c=>{adm(c);return all("SELECT p.*,r.title,r.agreed_price,a.name payer,b.name payee FROM payments p JOIN requests r ON r.id=p.request_id JOIN users a ON a.id=p.payer_id JOIN users b ON b.id=p.payee_id ORDER BY (p.status='pending') DESC,p.id DESC LIMIT 100")});
route('POST','/admin/payments/(\\d+)/review',c=>{const a=adm(c),p=get('SELECT * FROM payments WHERE id=?',c.p[0]);if(!p||p.status==='verified')throw err(400,'لا يمكن مراجعة هذه الدفعة');const d=c.b.decision;if(!['verified','rejected'].includes(d))throw err(400,'قرار غير صالح');
const note=str(c.b.note||'',d==='rejected'?3:0,300,'الملاحظة');run('UPDATE payments SET status=?,note=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?',d,note,a.id,p.id);audit(a.id,'payment_'+d,`${p.id}:${p.amount}`);
const t=d==='verified'?'تم التحقق من وصول الدفعة':'رُفضت الدفعة: '+note;notify(p.payer_id,t,'#/r/'+p.request_id);notify(p.payee_id,t,'#/r/'+p.request_id);return{ok:1}});
route('POST','/requests/(\\d+)/rate',c=>{const u=need(c),r=get('SELECT * FROM requests WHERE id=?',c.p[0]);if(!r||r.status!=='completed'||![r.user_id,r.helper_id].includes(u.id))throw err(403,'التقييم متاح لطرفي مهمة مكتملة فقط');
const s=+c.b.stars;if(!Number.isInteger(s)||s<1||s>5)throw err(400,'التقييم من 1 إلى 5');const to=u.id===r.user_id?r.helper_id:r.user_id;
try{run('INSERT INTO ratings(request_id,rater_id,ratee_id,stars,comment) VALUES(?,?,?,?,?)',r.id,u.id,to,s,str(c.b.comment||'',0,500,'التعليق'))}catch(e){if(e.s)throw e;throw err(409,'قيّمت هذه المهمة مسبقًا')}notify(to,'وصلك تقييم جديد','#/r/'+r.id);return{ok:1}});
route('GET','/users/(\\d+)',c=>{need(c);const u=get('SELECT id,name,city FROM users WHERE id=?',c.p[0]);if(!u)throw err(404,'غير موجود');return Object.assign(u,get('SELECT ROUND(AVG(stars),1) avg,COUNT(*) n FROM ratings WHERE ratee_id=? AND hidden=0',u.id))});
route('POST','/report',c=>{const u=need(c),t=c.b.type,id=+c.b.id,q={user:'SELECT 1 x FROM users WHERE id=?',request:'SELECT 1 x FROM requests WHERE id=?',rating:'SELECT 1 x FROM ratings WHERE id=?',message:`SELECT 1 x FROM messages WHERE id=? AND (from_id=${u.id} OR to_id=${u.id})`}[t];if(!q||!get(q,id))throw err(400,'الهدف غير صالح');
try{run('INSERT INTO reports(reporter_id,type,target_id,reason) VALUES(?,?,?,?)',u.id,t,id,str(c.b.reason,3,500,'السبب'))}catch(e){if(e.s)throw e;throw err(409,'بلّغت عن هذا مسبقًا')}return{ok:1}});
route('POST','/block',c=>{const u=need(c),b=+c.b.user_id;if(!b||b===u.id)throw err(400,'غير صالح');if(c.b.blocked)run('INSERT OR IGNORE INTO blocks VALUES(?,?)',u.id,b);else run('DELETE FROM blocks WHERE blocker_id=? AND blocked_id=?',u.id,b);return{ok:1}});
route('GET','/admin/reports',c=>{adm(c);const Q={user:'SELECT name t FROM users WHERE id=?',request:'SELECT title t FROM requests WHERE id=?',message:'SELECT body t FROM messages WHERE id=?',rating:'SELECT comment t FROM ratings WHERE id=?'};
return all("SELECT rp.*,u.name reporter FROM reports rp JOIN users u ON u.id=rp.reporter_id ORDER BY (rp.status='open') DESC,rp.id DESC LIMIT 100").map(r=>({...r,info:get(Q[r.type],r.target_id)?.t}))});
route('POST','/admin/reports/(\\d+)/resolve',c=>{const a=adm(c),r=get('SELECT * FROM reports WHERE id=?',c.p[0]);if(!r)throw err(404,'غير موجود');const note=str(c.b.note,3,300,'الملاحظة');
if(c.b.hide){if(r.type==='request')run('UPDATE requests SET hidden=1 WHERE id=?',r.target_id);if(r.type==='rating')run('UPDATE ratings SET hidden=1 WHERE id=?',r.target_id);if(r.type==='user'&&r.target_id!==a.id){run('UPDATE users SET active=0 WHERE id=?',r.target_id);run('DELETE FROM sessions WHERE user_id=?',r.target_id)}}
run("UPDATE reports SET status='resolved',note=? WHERE id=?",note,r.id);audit(a.id,'report',`${r.id}:${r.type}:${c.b.hide?'hide':'keep'}:${note}`);return{ok:1}});
route('GET','/notifications',c=>{const u=need(c),n=all('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 50',u.id);run('UPDATE notifications SET read=1 WHERE user_id=?',u.id);return n});
route('GET','/wallet',c=>{const u=need(c),p=bal(u.id);return{points:p,riyal:p/20,ledger:all('SELECT delta,reason,created_at FROM points_ledger WHERE user_id=? ORDER BY id DESC LIMIT 100',u.id)}});
route('POST','/wallet/redeem',c=>tx(()=>{const u=need(c),p=+c.b.points,key=str(c.b.key,8,64,'المفتاح'),purpose=str(c.b.purpose,2,100,'الغرض'),ref=`redeem:${u.id}:${key}`;
if(!Number.isInteger(p)||p<=0)throw err(400,'عدد النقاط غير صالح');if(get('SELECT 1 x FROM points_ledger WHERE ref=?',ref))return{duplicate:1,points:bal(u.id)};
if(bal(u.id)<p)throw err(400,'رصيدك غير كافٍ');run('INSERT INTO points_ledger(user_id,delta,reason,ref) VALUES(?,?,?,?)',u.id,-p,'استخدام: '+purpose,ref);
notify(u.id,`تم خصم ${p} نقطة (${p/20} ريال)`,'#/profile');return{points:bal(u.id)}}));
route('GET','/admin/stats',c=>{adm(c);const n=s=>get(s).n;return{users:n('SELECT COUNT(*) n FROM users'),requests:n('SELECT COUNT(*) n FROM requests'),completed:n("SELECT COUNT(*) n FROM requests WHERE status='completed'"),cancelled:n("SELECT COUNT(*) n FROM requests WHERE status='cancelled'"),points_issued:n('SELECT COALESCE(SUM(delta),0) n FROM points_ledger WHERE delta>0'),rules:all('SELECT * FROM reward_rules'),users_list:all('SELECT id,name,email,role,active,national_id,phone,address,flagged,suspended_until,(flagged=1 OR suspended_until>datetime(\'now\')) restricted,(SELECT COUNT(*) FROM pledges WHERE user_id=users.id) pledged,(SELECT COUNT(*) FROM cancellations c WHERE c.by_id=users.id AND c.created_at>datetime(\'now\',\'-30 days\')) cancels FROM users ORDER BY id DESC LIMIT 100'),disputes:all("SELECT id,title FROM requests WHERE status='disputed'")}});
route('POST','/admin/rules',c=>{const a=adm(c),p=+c.b.points;if(!Number.isInteger(p)||p<0||!get('SELECT 1 x FROM reward_rules WHERE key=?',c.b.key))throw err(400,'قيمة غير صالحة');
run('UPDATE reward_rules SET points=? WHERE key=?',p,c.b.key);audit(a.id,'rule',`${c.b.key}=${p}`);return{ok:1}});
route('POST','/admin/users/(\\d+)/active',c=>{const a=adm(c),why=str(c.b.reason,3,300,'السبب');if(+c.p[0]===a.id)throw err(400,'لا يمكنك تعطيل حسابك');
run('UPDATE users SET active=? WHERE id=?',c.b.active?1:0,+c.p[0]);if(!c.b.active)run('DELETE FROM sessions WHERE user_id=?',+c.p[0]);audit(a.id,'user_active',`${c.p[0]}:${c.b.active}:${why}`);return{ok:1}});
route('POST','/admin/requests/(\\d+)/hide',c=>{const a=adm(c),why=str(c.b.reason,3,300,'السبب');run('UPDATE requests SET hidden=? WHERE id=?',c.b.hidden?1:0,+c.p[0]);audit(a.id,'request_hide',`${c.p[0]}:${why}`);return{ok:1}});
route('POST','/requests/(\\d+)/price',c=>tx(()=>{const u=need(c),r=get('SELECT * FROM requests WHERE id=?',c.p[0]);if(!r||![r.user_id,r.helper_id].includes(u.id))throw err(403,'غير مصرح');if(!['helper_chosen','in_progress'].includes(r.status))throw err(400,'الحالة لا تسمح بتحديد السعر');
const amt=num(c.b.amount,'السعر');if(!amt)throw err(400,'أدخل سعرًا أكبر من صفر');if(get("SELECT 1 x FROM payments WHERE request_id=? AND status!='rejected'",r.id))throw err(400,'لا يمكن تغيير السعر بعد تسجيل دفعة');
run('UPDATE requests SET agreed_price=?,price_by=?,price_ok=0 WHERE id=?',amt,u.id,r.id);notify(u.id===r.user_id?r.helper_id:r.user_id,`اقتراح سعر نهائي ${amt} ر.س لـ «${r.title}»`,'#/r/'+r.id);return{ok:1}}));
route('POST','/requests/(\\d+)/price/accept',c=>tx(()=>{const u=need(c),r=get('SELECT * FROM requests WHERE id=?',c.p[0]);if(!r||![r.user_id,r.helper_id].includes(u.id)||r.price_by===u.id||!r.agreed_price)throw err(403,'لا يمكنك الموافقة على هذا السعر');
if(r.price_ok)throw err(400,'السعر معتمد مسبقًا');if(!['helper_chosen','in_progress'].includes(r.status))throw err(400,'الحالة لا تسمح بذلك');run('UPDATE requests SET price_ok=1 WHERE id=?',r.id);notify(r.price_by,`تم اعتماد السعر النهائي ${r.agreed_price} ر.س`,'#/r/'+r.id);return{ok:1}}));
const SET=()=>Object.fromEntries(all('SELECT key,value FROM settings').map(r=>[r.key,r.value]));
route('GET','/org',()=>{const s=SET();return{org_name:s.org_name||'',org_cr:s.org_cr||'',support_email:s.support_email||'',support_phone:s.support_phone||'',support_address:s.support_address||'',terms_text:s.terms_text||'',privacy_text:s.privacy_text||''}});
route('GET','/platform-account',c=>{need(c);const s=SET();return{bank_name:s.bank_name||'',account_name:s.account_name||'',iban:s.iban||'',commission_percent:+(s.commission_percent||0),commission_grace_days:s.commission_grace_days==null?3:+s.commission_grace_days,org_name:s.org_name||'',org_cr:s.org_cr||'',dispute_clause:s.dispute_clause||'',penalty_rules:s.penalty_rules||'',terms_text:s.terms_text||'',privacy_text:s.privacy_text||'',support_email:s.support_email||'',support_phone:s.support_phone||'',support_address:s.support_address||'',cancel_warn_at:+(s.cancel_warn_at??2),cancel_suspend_at:+(s.cancel_suspend_at??3),cancel_review_at:+(s.cancel_review_at??5),cancel_suspend_days:+(s.cancel_suspend_days??7)}});
route('POST','/admin/settings',c=>{const a=adm(c),b=c.b,ib=String(b.iban||'').replace(/\s/g,'').toUpperCase(),cp=+b.commission_percent||0,gd=b.commission_grace_days===''||b.commission_grace_days==null?3:Math.max(0,Math.floor(+b.commission_grace_days||0));if(!/^SA\d{22}$/.test(ib))throw err(400,'رقم الآيبان غير صالح (SA متبوعة بـ 22 رقمًا)');if(cp<0||cp>100)throw err(400,'نسبة العمولة من 0 إلى 100');
const v={bank_name:str(b.bank_name,2,80,'اسم البنك'),account_name:str(b.account_name,2,120,'اسم الحساب'),iban:ib,commission_percent:String(cp),commission_grace_days:String(gd)};for(const k of ['org_name','org_cr','dispute_clause','penalty_rules','support_email','support_phone','support_address'])if(String(b[k]||'').trim())v[k]=str(b[k],2,3000,k);
for(const k of ['terms_text','privacy_text'])if(String(b[k]||'').trim())v[k]=str(b[k],2,20000,k);for(const k of ['cancel_warn_at','cancel_suspend_at','cancel_review_at','cancel_suspend_days']){if(String(b[k]??'')!==''){const n=Math.floor(+b[k]);if(!(n>=1&&n<=3650))throw err(400,'قيمة غير صالحة لإعدادات الإلغاء');v[k]=String(n)}}
for(const k in v)run('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',k,v[k]);audit(a.id,'settings',`iban=${ib};commission=${cp}`);return{ok:1}});
route('GET','/requests/(\\d+)/helper-account',c=>{const u=need(c),r=get('SELECT * FROM requests WHERE id=?',c.p[0]);if(!r||r.user_id!==u.id||!r.helper_id)throw err(403,'غير مصرح');const h=get('SELECT name,iban FROM users WHERE id=?',r.helper_id);return{name:h.name,iban:h.iban||''}});
route('POST','/payments/(\\d+)/confirm',c=>{const u=need(c),p=get('SELECT * FROM payments WHERE id=?',c.p[0]);if(!p||p.payee_id!==u.id)throw err(403,'غير مصرح');if(p.status!=='pending')throw err(400,'تمت مراجعة هذه الدفعة');const d=c.b.decision;if(!['verified','rejected'].includes(d))throw err(400,'قرار غير صالح');
const note=str(c.b.note||'',d==='rejected'?3:0,300,'الملاحظة');run('UPDATE payments SET status=?,note=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?',d,note,u.id,p.id);notify(p.payer_id,d==='verified'?'أكّد المساعد استلام المبلغ':'لم يؤكد المساعد الاستلام: '+note,'#/r/'+p.request_id);return{ok:1}});
route('POST','/commissions/(\\d+)/proof',c=>{const u=need(c),m=get('SELECT * FROM commissions WHERE id=?',c.p[0]);if(!m||m.helper_id!==u.id)throw err(403,'غير مصرح');if(!['due','rejected'].includes(m.status))throw err(400,'لا يمكن إرسال إثبات الآن');
const at=own(u,c.b.attachment_id);if(!at)throw err(400,'أرفق صورة التحويل');run("UPDATE commissions SET proof_id=?,status='submitted',submitted_at=CURRENT_TIMESTAMP WHERE id=?",at,m.id);all("SELECT id FROM users WHERE role='admin'").forEach(a=>notify(a.id,'إثبات تحويل عمولة بانتظار المراجعة','#/admin'));return{ok:1}});
route('GET','/admin/commissions',c=>{adm(c);return all("SELECT m.*,r.title,u.name helper FROM commissions m JOIN requests r ON r.id=m.request_id JOIN users u ON u.id=m.helper_id ORDER BY (m.status='submitted') DESC,(m.status IN ('due','rejected')) DESC,m.id DESC LIMIT 100")});
route('POST','/admin/commissions/(\\d+)/review',c=>{const a=adm(c),m=get('SELECT * FROM commissions WHERE id=?',c.p[0]);if(!m||m.status!=='submitted')throw err(400,'لا يمكن مراجعة هذه العمولة');const d=c.b.decision;if(!['verified','rejected'].includes(d))throw err(400,'قرار غير صالح');
const note=str(c.b.note||'',d==='rejected'?3:0,300,'الملاحظة');run('UPDATE commissions SET status=?,note=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?',d,note,m.id);audit(a.id,'commission_'+d,`${m.id}:${m.amount}`);notify(m.helper_id,d==='verified'?'تم تأكيد وصول عمولة المنصة، شكرًا لك':'رُفض إثبات العمولة: '+note,'#/r/'+m.request_id);return{ok:1}});
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
const name=str(c.b.name,2,60,'الاسم'),nid=String(c.b.national_id||'').replace(/\s/g,''),ph=String(c.b.phone||'').replace(/[\s-]/g,''),ad=str(c.b.address,5,200,'العنوان');
if(!/^[12]\d{9}$/.test(nid))throw err(400,'رقم الهوية أو الإقامة غير صالح (10 أرقام تبدأ بـ 1 أو 2)');const m=/^(?:\+?966|0)(5\d{8})$/.exec(ph);if(!m)throw err(400,'رقم الجوال غير صالح (مثال: 05XXXXXXXX)');const phone='0'+m[1];
const text=`تعهد والتزام بسداد عمولة المنصة\n\nالمتعهِّد: ${name}، هوية/إقامة رقم ${nid}، جوال ${phone}، العنوان: ${ad}.\nلصالح: ${s.org_name}، سجل تجاري رقم ${s.org_cr}، مالكة منصة «المساعد».\n\n﴿وَأَوْفُوا بِالْعَهْدِ إِنَّ الْعَهْدَ كَانَ مَسْئُولًا﴾\n\n${pledgeBody(s)}`;
tx(()=>{run('UPDATE users SET name=?,national_id=?,phone=?,address=? WHERE id=?',name,nid,phone,ad,u.id);run('INSERT INTO pledges(user_id,version,ip,ua,text) VALUES(?,?,?,?,?)',u.id,PV,`${c.xff||''} | ${c.ip}`,String(c.ua||'').slice(0,200),text)});return{ok:1}});
route('GET','/admin/users/(\\d+)/pledge',c=>{adm(c);const r=get('SELECT text,ip,accepted_at FROM pledges WHERE user_id=? ORDER BY id DESC',c.p[0]);if(!r)throw err(404,'لم يوقّع هذا المستخدم التعهد بعد');return r});
const CANCEL_REASONS=['المهمة لم تعد مطلوبة','المساعد لم يلتزم','ظرف طارئ','أخرى'];
const CFG=()=>{const s=SET();return{warn:+(s.cancel_warn_at??2),sus:+(s.cancel_suspend_at??3),rev:+(s.cancel_review_at??5),days:+(s.cancel_suspend_days??7)}};
const restricted=uid=>{const x=get("SELECT flagged,(suspended_until>datetime('now')) on_hold FROM users WHERE id=?",uid);
if(x?.flagged)throw err(403,'حسابك قيد مراجعة الإدارة بسبب تكرار الإلغاء بعد الاختيار');
if(x?.on_hold)throw err(403,'حسابك موقوف مؤقتًا عن النشر والتقدم بسبب تكرار الإلغاء بعد الاختيار');};
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
route('POST','/admin/users/(\\d+)/lift',c=>{const a=adm(c),why=str(c.b.reason,3,300,'السبب');run('UPDATE users SET flagged=0,suspended_until=NULL WHERE id=?',+c.p[0]);audit(a.id,'lift',`${c.p[0]}:${why}`);notify(+c.p[0],'تم رفع القيود عن حسابك','#/profile');return{ok:1}});
route('GET','/admin/finance',c=>{adm(c);
const sum=s=>get(s).s;
const income=sum("SELECT COALESCE(SUM(amount),0) s FROM commissions WHERE status='verified'"),due=sum("SELECT COALESCE(SUM(amount),0) s FROM commissions WHERE status IN ('due','submitted','rejected')"),expenses=sum("SELECT COALESCE(SUM(amount),0) s FROM expenses"),transfers=sum("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE status='verified'");
const ledger=[...all("SELECT 'وارد' type,'عمولة مؤكدة من مهمة' title,amount,COALESCE(reviewed_at,created_at) at FROM commissions WHERE status='verified' ORDER BY id DESC LIMIT 60"),...all("SELECT 'صادر' type,title,amount,created_at at FROM expenses ORDER BY id DESC LIMIT 60")].sort((a,b)=>String(b.at).localeCompare(String(a.at))).slice(0,80);
return{income,due,expenses,profit:income-expenses,transfers,ledger}});
route('POST','/admin/expenses',c=>{const a=adm(c),title=str(c.b.title,3,120,'البند'),amt=Number(c.b.amount),cat=str(c.b.category||'',0,60,'التصنيف');if(!(amt>0)||amt>1e7)throw err(400,'المبلغ غير صالح');run('INSERT INTO expenses(title,amount,category,by_id) VALUES(?,?,?,?)',title,amt,cat||null,a.id);audit(a.id,'expense',`${title}:${amt}`);return{ok:1}});
route('GET','/admin/users/(\\d+)/activity',c=>{adm(c);const id=+c.p[0],u=get('SELECT id,name,email,city,role,active,flagged FROM users WHERE id=?',id);if(!u)throw err(404,'المستخدم غير موجود');
return{user:u,requests:get('SELECT COUNT(*) n FROM requests WHERE user_id=?',id).n,offers:get('SELECT COUNT(*) n FROM offers WHERE user_id=?',id).n,helped:get('SELECT COUNT(*) n FROM requests WHERE helper_id=?',id).n,completed:get("SELECT COUNT(*) n FROM requests WHERE (user_id=? OR helper_id=?) AND status='completed'",id,id).n,cancels:get('SELECT COUNT(*) n FROM cancellations WHERE by_id=?',id).n,cancels30:get("SELECT COUNT(*) n FROM cancellations WHERE by_id=? AND created_at>datetime('now','-30 days')",id).n,reports_against:get("SELECT COUNT(*) n FROM reports WHERE type='user' AND target_id=?",id).n,reports_by:get('SELECT COUNT(*) n FROM reports WHERE reporter_id=?',id).n,rating:get('SELECT ROUND(AVG(stars),1) a,COUNT(*) n FROM ratings WHERE ratee_id=? AND hidden=0',id),pledged:!!get('SELECT 1 x FROM pledges WHERE user_id=?',id),commissions_due:get("SELECT COALESCE(SUM(amount),0) s FROM commissions WHERE helper_id=? AND status IN ('due','submitted','rejected')",id).s}});
route('GET','/admin/requests',c=>{adm(c);return all("SELECT r.id,r.title,r.status,r.hidden,r.created_at,u.name owner,h.name helper,(SELECT COUNT(*) FROM offers o WHERE o.request_id=r.id) offers FROM requests r JOIN users u ON u.id=r.user_id LEFT JOIN users h ON h.id=r.helper_id ORDER BY r.id DESC LIMIT 100")});
route('GET','/admin/cancellations',c=>{adm(c);return all("SELECT c.id,c.reason,c.created_at,c.request_id,r.title,u.name by_name,o.name other_name FROM cancellations c JOIN requests r ON r.id=c.request_id JOIN users u ON u.id=c.by_id JOIN users o ON o.id=c.other_id ORDER BY c.id DESC LIMIT 200")});
route('GET','/admin/audit',c=>{adm(c);return all("SELECT a.id,a.action,a.detail,a.at,u.name admin FROM audit_log a LEFT JOIN users u ON u.id=a.admin_id ORDER BY a.id DESC LIMIT 200")});
route('POST','/admin/users/(\\d+)/role',c=>{const a=adm(c),id=+c.p[0],role=c.b.role;if(!['user','admin'].includes(role))throw err(400,'دور غير صالح');if(id===a.id)throw err(400,'لا يمكنك تغيير دورك بنفسك');if(!get('SELECT 1 x FROM users WHERE id=?',id))throw err(404,'المستخدم غير موجود');
const why=str(c.b.reason,3,300,'السبب');run('UPDATE users SET role=? WHERE id=?',role,id);audit(a.id,'role',`${id}:${role}:${why}`);return{ok:1}});
route('POST','/admin/users/(\\d+)/password',c=>{const a=adm(c),id=+c.p[0];if(!get('SELECT 1 x FROM users WHERE id=?',id))throw err(404,'المستخدم غير موجود');const pw=str(c.b.password,8,100,'كلمة المرور'),why=str(c.b.reason,3,300,'السبب');
run('UPDATE users SET pass=? WHERE id=?',hash(pw),id);run('DELETE FROM sessions WHERE user_id=?',id);audit(a.id,'password_reset',`${id}:${why}`);notify(id,'تم تغيير كلمة مرورك بواسطة الإدارة، سجّل دخولك بالكلمة الجديدة','#/login');return{ok:1}});
route('POST','/admin/broadcast',c=>tx(()=>{const a=adm(c),text=str(c.b.text,5,500,'النص'),link=String(c.b.link||'#/').slice(0,200);const us=all('SELECT id FROM users WHERE active=1');us.forEach(x=>notify(x.id,text,link));audit(a.id,'broadcast',`${us.length}:${text.slice(0,80)}`);return{sent:us.length}}));
route('GET','/admin/backup',c=>{const a=adm(c),f=path.join(os.tmpdir(),`musaed-backup-${Date.now()}.db`);db.exec(`VACUUM INTO '${f.replace(/'/g,"''")}'`);const raw=fs.readFileSync(f);fs.unlinkSync(f);audit(a.id,'backup','manual');return{raw,mime:'application/octet-stream'}});
const ASSIST_CITIES=['الرياض','جدة','مكة','المدينة','الدمام','الخبر','الطائف','تبوك','أبها','بريدة','حائل','القصيم','الجبيل','ينبع'];
const matchSkills=text=>{const t=normAr(text);const rows=all("SELECT s.id,s.name,k.word FROM skills s JOIN skill_keywords k ON k.skill_id=s.id WHERE s.status='approved'");const hit=new Map();for(const r of rows){if(!hit.has(r.id)&&r.word.length>=2&&t.includes(r.word))hit.set(r.id,{id:r.id,name:r.name})}return[...hit.values()]};
route('POST','/assistant',c=>{const t=String(c.b.message||'').trim();if(t.length<3||t.length>500)throw err(400,'اكتب طلبك في جملة واضحة');
if(!c.u)return{reply:'سجّل دخولك حتى أبحث لك عن المساعدين المسجّلين.',needLogin:1,providers:[],requests:[]};
const hits=matchSkills(t),city=ASSIST_CITIES.find(x=>t.includes(x))||null;
if(!hits.length)return{reply:'ما قدرت أحدد المهارة المطلوبة. جرّب تكتب نوع الخدمة بوضوح، مثل: مبرمج، مصوّر، نجار، أو نقل عفش.',providers:[],requests:[]};
const ids=hits.map(h=>h.id),ph=ids.map(()=>'?').join(','),names=hits.map(h=>h.name).join('، ');
const providers=all(`SELECT u.id,u.name,u.city,(SELECT COUNT(*) FROM requests r WHERE r.helper_id=u.id AND r.status='completed') done,(SELECT ROUND(AVG(a.stars),1) FROM ratings a WHERE a.ratee_id=u.id AND a.hidden=0) avg FROM users u JOIN user_skills us ON us.user_id=u.id WHERE us.skill_id IN (${ph}) AND u.active=1 ${city?'AND u.city LIKE ?':''} GROUP BY u.id ORDER BY done DESC,avg DESC LIMIT 10`,...ids,...(city?[`%${city}%`]:[]));
const reply=providers.length?`وجدت ${providers.length} مساعدًا مسجلًا في: ${names}${city?' في '+city:''}.`:`لا يوجد مساعدون مسجلون في: ${names}${city?' في '+city:''} بعد.`+(city?'':' حدّد المدينة لنتائج أدق.');
return{reply,category:hits[0].name,providers:providers.map(x=>({id:x.id,name:String(x.name).split(' ')[0],city:x.city,done:x.done,avg:x.avg})),requests:[]}});
route('GET','/skills',()=>{const cats=all('SELECT id,name FROM skill_categories ORDER BY sort,id');const sk=all("SELECT id,name,category_id FROM skills WHERE status='approved' ORDER BY name");return{categories:cats.map(c=>({...c,skills:sk.filter(s=>s.category_id===c.id)}))}});
route('GET','/me/skills',c=>{const u=need(c);return all('SELECT skill_id FROM user_skills WHERE user_id=?',u.id).map(x=>x.skill_id)});
route('POST','/me/skills',c=>tx(()=>{const u=need(c);const ids=[...new Set((c.b.skill_ids||[]).map(Number).filter(Number.isInteger))];if(ids.length>30)throw err(400,'عدد المهارات كبير');run('DELETE FROM user_skills WHERE user_id=?',u.id);for(const id of ids)if(get("SELECT 1 x FROM skills WHERE id=? AND status='approved'",id))run('INSERT INTO user_skills(user_id,skill_id) VALUES(?,?)',u.id,id);return{ok:1}}));
route('POST','/skills/suggest',c=>{const u=need(c),cat=+c.b.category_id;if(!get('SELECT 1 x FROM skill_categories WHERE id=?',cat))throw err(400,'القسم غير صالح');const name=str(c.b.name,2,60,'اسم المهارة');
const kws=String(c.b.keywords||'').split(/[,،]/).map(normAr).filter(x=>x.length>=2).slice(0,15);
if(get("SELECT COUNT(*) n FROM skills WHERE suggested_by=? AND status='pending'",u.id).n>=5)throw err(429,'لديك مهارات بانتظار الاعتماد، انتظر حتى تُراجع');
if(get('SELECT 1 x FROM skills WHERE name=?',name))throw err(409,'هذه المهارة موجودة أو بانتظار الاعتماد');
const id=Number(run("INSERT INTO skills(category_id,name,status,suggested_by) VALUES(?,?,'pending',?)",cat,name,u.id).lastInsertRowid);
for(const k of new Set([normAr(name),...kws]))run('INSERT OR IGNORE INTO skill_keywords(skill_id,word) VALUES(?,?)',id,k);
all("SELECT id FROM users WHERE role='admin'").forEach(a=>notify(a.id,`مهارة جديدة بانتظار الاعتماد: ${name}`,'#/admin'));return{id,status:'pending'}});
route('GET','/admin/skills',c=>{adm(c);return all("SELECT s.id,s.name,s.status,c.name cat,u.name suggested_by,(SELECT GROUP_CONCAT(word,'، ') FROM skill_keywords k WHERE k.skill_id=s.id) keywords FROM skills s JOIN skill_categories c ON c.id=s.category_id LEFT JOIN users u ON u.id=s.suggested_by ORDER BY (s.status='pending') DESC,s.id DESC LIMIT 200")});
route('POST','/admin/skills/(\\d+)/review',c=>{const a=adm(c),s=get('SELECT * FROM skills WHERE id=?',+c.p[0]);if(!s)throw err(404,'غير موجود');if(s.status!=='pending')throw err(400,'هذه المهارة ليست بانتظار الاعتماد');const d=c.b.decision;
if(d==='approve'){run("UPDATE skills SET status='approved' WHERE id=?",s.id);audit(a.id,'skill_approve',s.name);if(s.suggested_by)notify(s.suggested_by,`تم اعتماد مهارتك «${s.name}»`,'#/profile');return{ok:1}}
if(d==='reject'){const why=str(c.b.reason,3,300,'السبب');run('DELETE FROM user_skills WHERE skill_id=?',s.id);run('DELETE FROM skill_keywords WHERE skill_id=?',s.id);run('DELETE FROM skills WHERE id=?',s.id);audit(a.id,'skill_reject',`${s.name}:${why}`);if(s.suggested_by)notify(s.suggested_by,`لم تُعتمد مهارة «${s.name}»: ${why}`,'#/profile');return{ok:1}}
throw err(400,'قرار غير صالح')});
route('POST','/admin/skills/(\\d+)/keywords',c=>{const a=adm(c),s=get('SELECT id,name FROM skills WHERE id=?',+c.p[0]);if(!s)throw err(404,'غير موجود');const kws=String(c.b.keywords||'').split(/[,،]/).map(normAr).filter(x=>x.length>=2).slice(0,15);if(!kws.length)throw err(400,'أدخل كلمة واحدة على الأقل');for(const k of kws)run('INSERT OR IGNORE INTO skill_keywords(skill_id,word) VALUES(?,?)',s.id,k);audit(a.id,'skill_keywords',`${s.name}:${kws.join(',')}`);return{ok:1}});
route('GET','/providers/(\\d+)',c=>{need(c);const id=+c.p[0];const u=get('SELECT id,name,city,bio FROM users WHERE id=? AND active=1',id);if(!u)throw err(404,'المساعد غير موجود');
return{id:u.id,name:u.name,city:u.city||'',bio:u.bio||'',skills:all("SELECT s.name FROM user_skills us JOIN skills s ON s.id=us.skill_id WHERE us.user_id=? AND s.status='approved'",id).map(x=>x.name),done:get("SELECT COUNT(*) n FROM requests WHERE helper_id=? AND status='completed'",id).n,avg:get('SELECT ROUND(AVG(stars),1) a FROM ratings WHERE ratee_id=? AND hidden=0',id).a,count:get('SELECT COUNT(*) n FROM ratings WHERE ratee_id=? AND hidden=0',id).n,reviews:all("SELECT a.stars,a.comment,a.created_at,r.name FROM ratings a JOIN users r ON r.id=a.rater_id WHERE a.ratee_id=? AND a.hidden=0 ORDER BY a.id DESC LIMIT 10",id).map(x=>({stars:x.stars,comment:x.comment||'',at:String(x.created_at).slice(0,10),name:String(x.name).split(' ')[0]})),portfolio:all('SELECT p.id,p.attachment_id,p.caption FROM portfolio p WHERE p.user_id=? ORDER BY p.id DESC LIMIT 30',id)}});
route('POST','/me/bio',c=>{const u=need(c);run('UPDATE users SET bio=? WHERE id=?',str(c.b.bio||'',0,500,'النبذة')||null,u.id);return{ok:1}});
route('POST','/me/portfolio',c=>{const u=need(c);if(get('SELECT COUNT(*) n FROM portfolio WHERE user_id=?',u.id).n>=12)throw err(400,'الحد الأقصى 12 صورة');const at=own(u,c.b.attachment_id);if(!at)throw err(400,'أرفق صورة');run('INSERT INTO portfolio(user_id,attachment_id,caption) VALUES(?,?,?)',u.id,at,str(c.b.caption||'',0,120,'الوصف')||null);return{ok:1}});
route('POST','/me/portfolio/(\\d+)/delete',c=>{const u=need(c);run('DELETE FROM portfolio WHERE id=? AND user_id=?',+c.p[0],u.id);return{ok:1}});
route('GET','/direct/(\\d+)',c=>{const u=need(c),peer=+c.p[0];if(peer===u.id)throw err(400,'غير صالح');if(!get('SELECT 1 x FROM users WHERE id=? AND active=1',peer))throw err(404,'المستخدم غير موجود');
return{blocked:blocked(u.id,peer),messages:all('SELECT id,from_id,body,attachment_id,created_at FROM direct_messages WHERE (from_id=? AND to_id=?) OR (from_id=? AND to_id=?) ORDER BY id DESC LIMIT 100',u.id,peer,peer,u.id).reverse()}});
route('POST','/direct/(\\d+)',c=>{const u=need(c),peer=+c.p[0];if(peer===u.id)throw err(400,'غير صالح');if(!get('SELECT 1 x FROM users WHERE id=? AND active=1',peer))throw err(404,'المستخدم غير موجود');
if(blocked(u.id,peer))throw err(403,'لا يمكن التواصل مع هذا المستخدم');
if(get("SELECT COUNT(*) n FROM direct_messages WHERE from_id=? AND created_at>datetime('now','-1 hour')",u.id).n>=30)throw err(429,'عدد الرسائل كبير، حاول بعد قليل');
const att=own(u,c.b.attachment_id);if(att&&get("SELECT 1 x FROM requests WHERE ((user_id=? AND helper_id=?) OR (user_id=? AND helper_id=?)) AND status IN ('helper_chosen','in_progress','completed')",u.id,peer,peer,u.id))throw err(400,'الصور بين طرفين متعاقدين ترسل داخل الطلب فقط');const body=str(c.b.body||(att?'صورة مرفقة':''),1,1000,'الرسالة');
run('INSERT INTO direct_messages(from_id,to_id,body,attachment_id) VALUES(?,?,?,?)',u.id,peer,body,att);notify(peer,`رسالة استفسار جديدة من ${u.name}`,'#/p/'+u.id);return{ok:1}});
route('GET','/setup-status',()=>({needed:!!(process.env.ADMIN_SETUP_TOKEN&&!get("SELECT 1 x FROM users WHERE role='admin'"))}));
route('POST','/admin/bootstrap',c=>{const u=need(c),T=process.env.ADMIN_SETUP_TOKEN||'';if(!T)throw err(404,'غير متاح');if(get("SELECT 1 x FROM users WHERE role='admin'"))throw err(403,'تم إعداد المدير مسبقًا');
if(!ADMIN||u.email!==ADMIN)throw err(403,'هذا الحساب ليس حساب المالك');const t=String(c.b.token||'');if(t.length!==T.length||!crypto.timingSafeEqual(Buffer.from(t),Buffer.from(T)))throw err(403,'الرمز غير صحيح');
run("UPDATE users SET role='admin' WHERE id=?",u.id);audit(u.id,'bootstrap_admin',`user:${u.id}`);return{ok:1}});
route('POST','/me/delete',c=>tx(()=>{const u=need(c),pw=String(c.b.password||'');if(c.b.confirm!=='حذف')throw err(400,'اكتب كلمة «حذف» للتأكيد');
if(!check(pw,get('SELECT pass FROM users WHERE id=?',u.id).pass))throw err(403,'كلمة المرور غير صحيحة');
if(get("SELECT 1 x FROM requests WHERE (user_id=? OR helper_id=?) AND status IN ('helper_chosen','in_progress','disputed')",u.id,u.id))throw err(400,'لديك مهام قيد التنفيذ أو متنازع عليها، أنهِها أو تواصل مع الإدارة أولًا');
if(get("SELECT 1 x FROM commissions WHERE helper_id=? AND status IN ('due','submitted','rejected')",u.id))throw err(400,'عليك عمولة غير مسددة للمنصة، سدّدها أولًا');
run("UPDATE requests SET status='cancelled' WHERE user_id=? AND status IN ('draft','published','negotiating')",u.id);
run('DELETE FROM portfolio WHERE user_id=?',u.id);run('DELETE FROM user_skills WHERE user_id=?',u.id);run('DELETE FROM sessions WHERE user_id=?',u.id);run('DELETE FROM notifications WHERE user_id=?',u.id);
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
route('POST','/reset',c=>tx(()=>{const tok=String(c.b.token||''),pw=str(c.b.password,8,100,'كلمة المرور');if(!/^[0-9a-f]{64}$/.test(tok))throw err(400,'الرابط غير صالح أو منتهي');
const r=get("SELECT id,user_id FROM password_resets WHERE token_hash=? AND used=0 AND expires_at>datetime('now')",sha(tok));if(!r)throw err(400,'الرابط غير صالح أو منتهي');
run('UPDATE users SET pass=? WHERE id=?',hash(pw),r.user_id);run('UPDATE password_resets SET used=1 WHERE user_id=?',r.user_id);run('DELETE FROM sessions WHERE user_id=?',r.user_id);audit(r.user_id,'password_reset_self',`user:${r.user_id}`);return{ok:1}}));
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://x');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');
if(/^\/(logo|hand)\.png$/.test(url.pathname)){res.setHeader('Content-Type','image/png');res.setHeader('Cache-Control','public,max-age=86400');return res.end(fs.readFileSync(new URL('./public'+url.pathname,import.meta.url)))}
if(!url.pathname.startsWith('/api')){res.setHeader('Content-Type','text/html;charset=utf-8');return res.end(fs.readFileSync(new URL('./public/index.html',import.meta.url)))}
let raw='';for await(const ch of req){raw+=ch;if(raw.length>(url.pathname==='/api/upload'?3e6:1e5))throw err(413,'الطلب كبير')}
if(req.method!=='GET'&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw err(403,'مرفوض');
const tok=/sid=(\w+)/.exec(req.headers.cookie||'')?.[1];
for(const[m,re,f]of R){const x=m===req.method&&re.exec(url.pathname);if(x){const out=await f({u:userOf(tok),tok,b:raw?JSON.parse(raw):{},q:Object.fromEntries(url.searchParams),p:x.slice(1),res,ip:req.socket.remoteAddress,xff:req.headers['x-forwarded-for'],ua:req.headers['user-agent']});if(out?.raw){res.setHeader('Content-Type',out.mime);res.setHeader('Cache-Control','private,max-age=3600');return res.end(out.raw)}
res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(out))}}
throw err(404,'غير موجود')}catch(e){if(!e.s&&/UNIQUE constraint failed: users\.(national_id|phone)/.test(String(e.message)))Object.assign(e,{s:409,message:'هذه الهوية أو الجوال مسجّلة على حساب آخر'});const s=e.s||(e instanceof SyntaxError?400:500);if(s===500)console.error(e);res.statusCode=s;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:e.s?e.message:s===400?'بيانات غير صالحة':'خطأ في الخادم'}))}}).listen(PORT,()=>console.log('http://localhost:'+PORT));
