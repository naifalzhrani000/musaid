import {SKILL_SEED, ASSIST_CITIES, CANCEL_REASONS, CATALOG} from '../data.js';
import {DatabaseSync} from 'node:sqlite';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
const PORT=+process.env.PORT||3000,ADMIN=(process.env.ADMIN_EMAIL||'').toLowerCase();
const DB_PATH=process.env.DB_FILE||'data.db',RESTORE_PENDING=DB_PATH+'.restore';
if(fs.existsSync(RESTORE_PENDING)){for(const x of [DB_PATH+'-wal',DB_PATH+'-shm'])if(fs.existsSync(x))fs.unlinkSync(x);fs.renameSync(RESTORE_PENDING,DB_PATH);console.log('restore: تم تطبيق الاستعادة من نسخة احتياطية')}
const db=new DatabaseSync(DB_PATH);
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
for(const s of ['ALTER TABLE requests ADD COLUMN category TEXT','ALTER TABLE requests ADD COLUMN image_id INT','ALTER TABLE messages ADD COLUMN attachment_id INT','ALTER TABLE users ADD COLUMN iban TEXT','ALTER TABLE users ADD COLUMN national_id TEXT','ALTER TABLE users ADD COLUMN phone TEXT','ALTER TABLE users ADD COLUMN address TEXT','ALTER TABLE requests ADD COLUMN agreed_price REAL','ALTER TABLE requests ADD COLUMN price_by INT','ALTER TABLE requests ADD COLUMN price_ok INT DEFAULT 0','ALTER TABLE users ADD COLUMN suspended_until TEXT','ALTER TABLE users ADD COLUMN flagged INT DEFAULT 0','ALTER TABLE users ADD COLUMN bio TEXT','ALTER TABLE users ADD COLUMN email_verified INT NOT NULL DEFAULT 1','ALTER TABLE users ADD COLUMN notify_email INT NOT NULL DEFAULT 1','ALTER TABLE users ADD COLUMN age_ok INT NOT NULL DEFAULT 1','ALTER TABLE users ADD COLUMN terms_version TEXT','ALTER TABLE users ADD COLUMN terms_at TEXT','ALTER TABLE users ADD COLUMN account_type TEXT NOT NULL DEFAULT \'client\'','CREATE UNIQUE INDEX IF NOT EXISTS ux_users_nid ON users(national_id) WHERE national_id IS NOT NULL','CREATE UNIQUE INDEX IF NOT EXISTS ux_users_phone ON users(phone) WHERE phone IS NOT NULL'])try{db.exec(s)}catch{}
const all=(s,...a)=>db.prepare(s).all(...a),get=(s,...a)=>db.prepare(s).get(...a),run=(s,...a)=>db.prepare(s).run(...a);
const normAr=s=>String(s||'').normalize('NFKC').replace(/[\u064B-\u065F\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').toLowerCase().trim();

const seedSkills=()=>{if(get('SELECT COUNT(*) n FROM skill_categories').n>0)return;SKILL_SEED.forEach(([cn,skills],ci)=>{const cid=Number(run('INSERT INTO skill_categories(name,sort) VALUES(?,?)',cn,ci).lastInsertRowid);skills.forEach(([sn,kws])=>{const sid=Number(run("INSERT INTO skills(category_id,name,status) VALUES(?,?,'approved')",cid,sn).lastInsertRowid);for(const k of new Set([normAr(sn),...kws.map(normAr)]))run('INSERT OR IGNORE INTO skill_keywords(skill_id,word) VALUES(?,?)',sid,k)})})};
seedSkills();
db.exec(`CREATE TABLE IF NOT EXISTS section_keywords(category_id INT NOT NULL REFERENCES skill_categories(id),word TEXT NOT NULL,PRIMARY KEY(category_id,word));
CREATE TABLE IF NOT EXISTS user_sections(user_id INT NOT NULL REFERENCES users(id),category_id INT NOT NULL REFERENCES skill_categories(id),PRIMARY KEY(user_id,category_id));
CREATE TABLE IF NOT EXISTS verify_tokens(token_hash TEXT PRIMARY KEY,user_id INT NOT NULL REFERENCES users(id),expires_at TEXT NOT NULL,used INT NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS login_attempts(k TEXT PRIMARY KEY,n INT NOT NULL,t INT NOT NULL);
CREATE TABLE IF NOT EXISTS request_skills(request_id INT NOT NULL REFERENCES requests(id),skill_id INT NOT NULL REFERENCES skills(id),PRIMARY KEY(request_id,skill_id));
CREATE TABLE IF NOT EXISTS agreements(id INTEGER PRIMARY KEY,a_id INT NOT NULL REFERENCES users(id),b_id INT NOT NULL REFERENCES users(id),amount INT NOT NULL,description TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS agreement_commissions(id INTEGER PRIMARY KEY,agreement_id INT UNIQUE NOT NULL REFERENCES agreements(id),helper_id INT NOT NULL REFERENCES users(id),amount REAL NOT NULL,status TEXT NOT NULL DEFAULT 'due',created_at TEXT DEFAULT CURRENT_TIMESTAMP,paid_at TEXT);
CREATE TABLE IF NOT EXISTS reset_codes(user_id INT PRIMARY KEY REFERENCES users(id),code_hash TEXT NOT NULL,expires_at TEXT NOT NULL,attempts INT NOT NULL DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS verify_codes(user_id INT PRIMARY KEY REFERENCES users(id),code_hash TEXT NOT NULL,expires_at TEXT NOT NULL,attempts INT NOT NULL DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS agreement_cancellations(id INTEGER PRIMARY KEY,agreement_id INT NOT NULL REFERENCES agreements(id),by_id INT NOT NULL REFERENCES users(id),reason TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS contact_messages(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL,body TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS request_categories(request_id INT NOT NULL REFERENCES requests(id),category_id INT NOT NULL REFERENCES skill_categories(id),PRIMARY KEY(request_id,category_id));
CREATE TABLE IF NOT EXISTS failed_searches(id INTEGER PRIMARY KEY,text TEXT NOT NULL,at TEXT DEFAULT CURRENT_TIMESTAMP);`);
const seedSections=()=>{if(get('SELECT COUNT(*) n FROM section_keywords').n>0)return;db.exec("INSERT OR IGNORE INTO section_keywords(category_id,word) SELECT s.category_id,k.word FROM skill_keywords k JOIN skills s ON s.id=k.skill_id WHERE s.status='approved'");for(const c of all('SELECT id,name FROM skill_categories'))run('INSERT OR IGNORE INTO section_keywords(category_id,word) VALUES(?,?)',c.id,normAr(c.name))};
seedSections();

if(!db.prepare("SELECT 1 x FROM pragma_table_info('users') WHERE name='perms'").get())db.exec("ALTER TABLE users ADD COLUMN perms TEXT NOT NULL DEFAULT ''");
const CATALOG_VERSION='3';
const applyCatalog=()=>{const v=get("SELECT value FROM settings WHERE key='catalog_version'");if(v&&v.value===CATALOG_VERSION)return;
db.exec("DELETE FROM request_categories;DELETE FROM section_keywords;DELETE FROM user_sections;DELETE FROM user_skills;DELETE FROM request_skills;DELETE FROM skill_keywords;DELETE FROM skills;DELETE FROM skill_categories;");
CATALOG.forEach((c,i)=>{const id=Number(run('INSERT INTO skill_categories(name,sort) VALUES(?,?)',c.name,i+1).lastInsertRowid);for(const w of [c.name,...c.words])run('INSERT OR IGNORE INTO section_keywords(category_id,word) VALUES(?,?)',id,normAr(w))});
run("INSERT OR REPLACE INTO settings(key,value) VALUES('catalog_version',?)",CATALOG_VERSION)};
applyCatalog();
db.exec("UPDATE users SET account_type='helper' WHERE account_type='client' AND id IN (SELECT user_id FROM user_sections)");
db.exec("UPDATE users SET iban=NULL,address=NULL,national_id=NULL");
const err=(s,m)=>Object.assign(new Error(m),{s});
const tx=f=>{db.exec('BEGIN IMMEDIATE');try{const r=f();db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}};
const hash=p=>{const s=crypto.randomBytes(16).toString('hex');return s+':'+crypto.scryptSync(p,s,64).toString('hex')};
const check=(p,h)=>{const [s,x]=h.split(':');return crypto.timingSafeEqual(crypto.scryptSync(p,s,64),Buffer.from(x,'hex'))};
const notify=(u,t,l)=>run('INSERT INTO notifications(user_id,text,link) VALUES(?,?,?)',u,t,l??null);
const bal=u=>get('SELECT COALESCE(SUM(delta),0) b FROM points_ledger WHERE user_id=?',u).b;
const award=(u,key,ref)=>{const p=get('SELECT points FROM reward_rules WHERE key=?',key)?.points||0;if(p>0&&run('INSERT OR IGNORE INTO points_ledger(user_id,delta,reason,ref) VALUES(?,?,?,?)',u,p,key,ref).changes)notify(u,`أُضيفت ${p} نقطة إلى محفظتك`,'#/profile')};
export const hooks={onPublished:()=>{}};
const log=(id,st,by)=>{run('INSERT INTO status_log(request_id,status,by_id) VALUES(?,?,?)',id,st,by);if(st==='published')hooks.onPublished(id)};
const audit=(a,act,d)=>run('INSERT INTO audit_log(admin_id,action,detail) VALUES(?,?,?)',a,act,d);
const startSession=(res,uid)=>{const t=crypto.randomBytes(32).toString('hex');run('INSERT INTO sessions VALUES(?,?,?)',t,uid,Date.now()+6048e5);res.setHeader('Set-Cookie',`sid=${t}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${((process.env.APP_URL||'').startsWith('https')||res.req.headers['x-forwarded-proto']==='https')?'; Secure':''}`)};
const userOf=t=>t?get('SELECT u.id,u.name,u.email,u.city,u.role,u.active,u.account_type,u.phone,u.address,u.email_verified,u.notify_email,u.perms FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.exp>? AND u.active=1',t,Date.now()):undefined;
const need=c=>{if(!c.u)throw err(401,'سجّل الدخول أولًا');return c.u};
const adm=c=>{if(need(c).role!=='admin')throw err(403,'غير مصرح');return c.u};
const can=(c,area)=>{const u=need(c);if(u.role==='admin')return u;if(u.role==='staff'&&(u.perms||'').split(',').includes(area))return u;throw err(403,'لا تملك صلاحية لهذا القسم')};
const str=(v,min,max,n)=>{v=String(v??'').trim();if(v.length<min||v.length>max)throw err(400,`${n}: الطول بين ${min} و${max} حرفًا`);return v};
const num=(v,n)=>{if(v===''||v==null)return null;v=Number(v);if(!(v>=0)||v>1e7)throw err(400,n+' غير صالح');return v};
const R=[],route=(m,p,f)=>R.push([m,new RegExp('^/api'+p+'$'),f]);


const SET=()=>Object.fromEntries(all('SELECT key,value FROM settings').map(r=>[r.key,r.value]));
const restricted=uid=>{const x=get("SELECT flagged,(suspended_until>datetime('now')) on_hold FROM users WHERE id=?",uid);
if(x?.flagged)throw err(403,'حسابك قيد مراجعة الإدارة بسبب تكرار الإلغاء بعد الاختيار');
if(x?.on_hold)throw err(403,'حسابك موقوف مؤقتًا عن النشر والتقدم بسبب تكرار الإلغاء بعد الاختيار');};
const own=(u,id)=>{if(!id)return null;if(!get('SELECT 1 x FROM attachments WHERE id=? AND user_id=?',+id,u.id))throw err(400,'المرفق غير صالح');return +id};
const PV=2;
const pledgeBody=s=>[
`1. أقرّ بأنني اطلعت على شروط المنصة وسياسة الخصوصية، وأن هذا التعهد ملزم لي نظامًا.`,
`2. ألتزم بسداد عمولة للمنصة قدرها ${s.commission_percent||0}% من السعر النهائي المتفق عليه في كل مهمة أو اتفاق يتم عبر المنصة (طلب أو محادثة)، سواء تم الدفع بالتحويل المباشر أو بأي وسيلة أخرى.`,
`3. تستحق العمولة بمجرد إتمام المهمة أو اعتماد الاتفاق في المنصة، وأسددها خلال ${s.commission_grace_days??3} أيام بالتحويل إلى حساب المنصة المعلن فيها، وأرفع صورة الإثبات.`,
`4. ألتزم بعدم التحايل على المنصة، فلا أتفق مع طالب المساعدة على إتمام المهمة أو الدفع خارجها لتفادي العمولة. وإذا ثبت ذلك استحقت المنصة العمولة كاملة، مع التعويض الذي يقدّره المحكم أو الجهة المختصة.`,
`5. عند التأخر عن السداد يحق للمنصة: (أ) إيقاف حسابي أو منعي من التقدم لمهام جديدة، (ب) مطالبتي بالمبلغ المستحق، (ج) اللجوء إلى الجهات القضائية والتنفيذية والتحكيمية المختصة في المملكة لاستيفاء حقها.`,
`6. أتحمل ما تتكبده المنصة في سبيل التحصيل من رسوم ومصاريف تقاضٍ أو تحكيم وتنفيذ وأتعاب محاماة، وفق ما يقرره المحكم أو الجهة المختصة.`,
`7. تعد سجلات المنصة حجة عليّ، وهي: المحادثات، وصور التحويلات، والسعر المعتمد، وحالة المهمة، وسجلات الدخول والموافقة، ما لم أثبت خلاف ذلك.`,
`8. أقرّ بأن موافقتي الإلكترونية على هذا التعهد تعد توقيعًا إلكترونيًا معتبرًا نظامًا، وأن بياناتي المدخلة صحيحة وأتحمل مسؤولية صحتها.`,
`9. أوافق على إفصاح المنصة عن بياناتي للجهات القضائية والرسمية والتحكيمية بالقدر اللازم لتحصيل حقها.`,
`10. يخضع هذا التعهد لأنظمة المملكة العربية السعودية. ${s.dispute_clause}`,
`11. يسري هذا التعهد على جميع المهام التي أنجزها عبر المنصة، وتبقى التزاماتي قائمة بعد إغلاق حسابي فيما استحق قبل ذلك.`].join('\n');
const resolveSkills=raw=>{const ids=[...new Set((Array.isArray(raw)?raw:[]).map(Number).filter(Number.isInteger))];if(ids.length>15)throw err(400,'يمكن اختيار 15 تخصصًا كحد أقصى');
const rows=ids.length?all(`SELECT id,category_id FROM skills WHERE status='approved' AND id IN (${ids.map(()=>'?').join(',')})`,...ids):[];if(rows.length!==ids.length)throw err(400,'التخصص غير صالح');
const catIds=[...new Set(rows.map(r=>r.category_id))];if(catIds.length>3)throw err(400,'يمكن اختيار تخصصات من 3 أقسام كحد أقصى');return{skillIds:ids,catIds}};
const saveSpecialties=(uid,skillIds,catIds)=>{run('DELETE FROM user_skills WHERE user_id=?',uid);for(const id of skillIds)run('INSERT INTO user_skills(user_id,skill_id) VALUES(?,?)',uid,id);saveSections(uid,catIds)};
const cleanSections=raw=>{const ids=[...new Set((Array.isArray(raw)?raw:[]).map(Number).filter(Number.isInteger))];if(ids.length>1)throw err(400,'اختر قسمًا واحدًا فقط لخدماتك');for(const id of ids)if(!get('SELECT 1 x FROM skill_categories WHERE id=?',id))throw err(400,'القسم غير صالح');return ids};
const saveSections=(uid,ids)=>{run('DELETE FROM user_sections WHERE user_id=?',uid);for(const id of ids)run('INSERT INTO user_sections(user_id,category_id) VALUES(?,?)',uid,id)};
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const hesc=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const sendMail=async(to,subject,html)=>{const key=process.env.RESEND_API_KEY;if(!key){console.error('mail: RESEND_API_KEY غير مضبوط، لم تُرسل الرسالة');return false}
try{const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.MAIL_FROM||'المساعد <onboarding@resend.dev>',to:[to],subject,html})});if(!r.ok){console.error('mail: Resend رفض الطلب، الحالة',r.status);return false}return true}catch(e){console.error('mail: خطأ في الاتصال',e.message);return false}};
const TERMS_VERSION='2026-10';
const VERIFY_REQUIRED=process.env.EMAIL_VERIFY_REQUIRED==='1';
const issueVerify=async(uid,email)=>{const code=String(crypto.randomInt(0,10000)).padStart(4,'0');run("INSERT OR REPLACE INTO verify_codes(user_id,code_hash,expires_at,attempts,created_at) VALUES(?,?,datetime('now','+10 minutes'),0,datetime('now'))",uid,sha(code+':'+uid));const u=get('SELECT name FROM users WHERE id=?',uid);return sendMail(email,'رمز تفعيل البريد - المساعد',`<div dir="rtl"><p>أهلًا ${hx(u?u.name:'')}،</p><p>رمز تفعيل بريدك الإلكتروني:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>الرمز صالح لمدة 10 دقائق. إذا لم تطلب ذلك فتجاهل هذه الرسالة.</p></div>`)};
const ACT={start:['helper',['helper_chosen'],'in_progress'],complete:['owner',['in_progress'],'completed'],cancel:['owner',['draft','published','negotiating'],'cancelled'],publish:['owner',['draft'],'published'],dispute:['party',['helper_chosen','in_progress'],'disputed']};
const hasThread=(rid,a,b)=>!!get('SELECT 1 x FROM messages WHERE request_id=? AND ((from_id=? AND to_id=?) OR (from_id=? AND to_id=?)) LIMIT 1',rid,a,b,b,a);
const hasOffer=(rid,uid)=>!!get('SELECT 1 x FROM offers WHERE request_id=? AND user_id=?',rid,uid);
const peerOk=(r,me,peer)=>me===r.user_id?(hasOffer(r.id,peer)||hasThread(r.id,me,peer)):(peer===r.user_id&&(hasOffer(r.id,me)||hasThread(r.id,me,peer)));
const blocked=(a,b)=>!!get('SELECT 1 x FROM blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)',a,b,b,a);
const send=(r,u,to,body,att)=>{if(blocked(u.id,to))throw err(403,'لا يمكن التواصل مع هذا المستخدم');const id=Number(run('INSERT INTO messages(request_id,from_id,to_id,body,attachment_id) VALUES(?,?,?,?,?)',r.id,u.id,to,body,att).lastInsertRowid);notify(to,`رسالة جديدة بخصوص: ${r.title}`,'#/chat/'+r.id+'/'+u.id);notifyMessageMail(to,u.name,`/chat/${r.id}/${u.id}`);return id};
const CFG=()=>{const s=SET();return{warn:+(s.cancel_warn_at??2),sus:+(s.cancel_suspend_at??3),rev:+(s.cancel_review_at??5),days:+(s.cancel_suspend_days??7)}};
const applyPenalty=uid=>{const c=CFG(),n=get("SELECT (SELECT COUNT(*) FROM cancellations WHERE by_id=? AND created_at>datetime('now','-30 days'))+(SELECT COUNT(*) FROM agreement_cancellations WHERE by_id=? AND created_at>datetime('now','-30 days')) n",uid,uid).n;
if(n>=c.rev){run('UPDATE users SET flagged=1 WHERE id=?',uid);all("SELECT id FROM users WHERE role='admin'").forEach(a=>notify(a.id,'حساب يحتاج مراجعة بسبب تكرار الإلغاء بعد الاختيار','#/admin'))}
if(n>=c.sus){run("UPDATE users SET suspended_until=datetime('now', '+' || ? || ' days') WHERE id=?",c.days,uid);notify(uid,`أُوقف نشرك وتقدمك لمدة ${c.days} أيام بسبب تكرار الإلغاء بعد اختيار المساعد`,'#/profile')}
else if(n>=c.warn)notify(uid,'تنبيه: تكرار الإلغاء بعد اختيار المساعد قد يؤدي إلى إيقاف حسابك','#/profile')};
const pairCheck=(a,b)=>{const n=get("SELECT COUNT(*) n FROM cancellations WHERE ((by_id=? AND other_id=?) OR (by_id=? AND other_id=?)) AND created_at>datetime('now','-30 days')",a,b,b,a).n;
if(n>=2)all("SELECT id FROM users WHERE role='admin'").forEach(x=>notify(x.id,`تكرار إلغاء بعد الاختيار بين طرفين (${n} مرات خلال 30 يومًا)`,'#/admin'))};
const likeEsc=v=>String(v).replace(/[\\%_]/g,m=>'\\'+m);
const cleanSearch=t=>String(t).replace(/\+?\d[\d\s-]{7,}\d/g,'[رقم]').replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g,'[بريد]').slice(0,200);
const stripAl=w=>w.length>3&&w.startsWith('ال')?w.slice(2):w;
const toksOf=t=>normAr(t).split(/[\s,،.!?؟:;()\-\/]+/).filter(Boolean);
const matchSections=text=>{const toks=toksOf(text),padded=' '+toks.join(' ')+' ',set=new Set(toks.flatMap(x=>[x,stripAl(x)]));const hit=new Map();for(const r of all('SELECT c.id,c.name,k.word FROM skill_categories c JOIN section_keywords k ON k.category_id=c.id')){const w=r.word;if(!w||w.length<2)continue;const ok=w.includes(' ')?padded.includes(' '+w+' '):(set.has(w)||set.has(stripAl(w)));if(ok){const h=hit.get(r.id)||{id:r.id,name:r.name,score:0};h.score++;hit.set(r.id,h)}}return[...hit.values()].sort((a,b)=>b.score-a.score)};
const hx=v=>String(v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const msgMailAt=new Map();
const notifyMessageMail=(toId,fromName,path)=>{const u=get('SELECT email,name,notify_email FROM users WHERE id=?',toId);if(!u||!u.email||u.notify_email!==1)return;
const k=toId+'|'+path,last=msgMailAt.get(k)||0;if(Date.now()-last<15*60e3)return;if(msgMailAt.size>50000)msgMailAt.clear();msgMailAt.set(k,Date.now());
const base=(process.env.APP_URL||'').replace(/\/$/,'');sendMail(u.email,'رسالة جديدة - المساعد',`<div dir="rtl"><p>أهلًا ${hx(u.name)}،</p><p>وصلتك رسالة جديدة من ${hx(fromName)} على المنصة.</p><p><a href="${base}/#${path}">افتح المحادثة</a></p><p style="color:#777;font-size:12px">لإيقاف هذه الرسائل عدّل إعدادات الإشعارات في ملفك الشخصي.</p></div>`).catch(()=>{})};

const RATE=new Map();
const hitOr429=(key,limit,windowMs=3600e3)=>{if(RATE.size>50000)RATE.clear();const now=Date.now(),r=RATE.get(key)||{n:0,t:now};if(now-r.t>windowMs){r.n=0;r.t=now}r.n++;RATE.set(key,r);if(r.n>limit)throw err(429,'محاولات كثيرة، حاول بعد قليل')};
export {DB_PATH, RESTORE_PENDING, route, PORT, db, all, normAr, seedSkills, seedSections, err, tx, hash, check, notify, bal, award, log, audit, startSession, userOf, need, adm, str, num, R, ADMIN, get, run, SET, restricted, PV, TERMS_VERSION, VERIFY_REQUIRED, cleanSections, hesc, issueVerify, own, pledgeBody, resolveSkills, saveSections, saveSpecialties, sendMail, sha, ACT, CFG, applyPenalty, blocked, cleanSearch, hasOffer, hasThread, hx, likeEsc, matchSections, msgMailAt, notifyMessageMail, pairCheck, peerOk, send, stripAl, toksOf, hitOr429, can};
