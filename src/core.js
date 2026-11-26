import {sendWebPush,vapidProblem,cleanKey,pushFailure} from './push-crypto.js';
import {SKILL_SEED, ASSIST_CITIES, CANCEL_REASONS, CATALOG, EXTRA_KEYWORDS, NEW_CATALOG} from '../data.js';
import {DatabaseSync} from 'node:sqlite';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
const PORT=+process.env.PORT||3000,ADMINS=new Set((process.env.ADMIN_EMAIL||'').split(/[\s,;،]+/).map(s=>s.trim().toLowerCase()).filter(Boolean)),ADMIN=[...ADMINS][0]||'';
const DB_PATH=process.env.DB_FILE||'data.db',RESTORE_PENDING=DB_PATH+'.restore';
if(fs.existsSync(RESTORE_PENDING)){for(const x of [DB_PATH+'-wal',DB_PATH+'-shm'])if(fs.existsSync(x))fs.unlinkSync(x);fs.renameSync(RESTORE_PENDING,DB_PATH);console.log('restore: تم تطبيق الاستعادة من نسخة احتياطية')}
const db=new DatabaseSync(DB_PATH);
db.exec(`PRAGMA foreign_keys=ON;PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,pass TEXT NOT NULL,city TEXT,role TEXT NOT NULL DEFAULT 'user',active INT NOT NULL DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INT NOT NULL REFERENCES users(id),exp INT NOT NULL);
CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY,user_id INT NOT NULL,text TEXT NOT NULL,link TEXT,read INT DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS push_subscriptions(id INTEGER PRIMARY KEY,user_id INT NOT NULL,endpoint TEXT UNIQUE NOT NULL,p256dh TEXT NOT NULL,auth TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS reward_rules(key TEXT PRIMARY KEY,points INT NOT NULL DEFAULT 0 CHECK(points>=0));
CREATE TABLE IF NOT EXISTS points_ledger(id INTEGER PRIMARY KEY,user_id INT NOT NULL,delta INT NOT NULL,reason TEXT NOT NULL,ref TEXT UNIQUE NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY,admin_id INT,action TEXT,detail TEXT,at TEXT DEFAULT CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO reward_rules(key,points) VALUES('complete_requester',0),('complete_helper',0);`);
db.exec(`CREATE TABLE IF NOT EXISTS attachments(id INTEGER PRIMARY KEY,user_id INT NOT NULL,mime TEXT NOT NULL,data BLOB NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY,reporter_id INT NOT NULL,type TEXT NOT NULL,target_id INT NOT NULL,reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',note TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(reporter_id,type,target_id));
CREATE TABLE IF NOT EXISTS blocks(blocker_id INT NOT NULL,blocked_id INT NOT NULL,PRIMARY KEY(blocker_id,blocked_id));
CREATE TABLE IF NOT EXISTS pledges(id INTEGER PRIMARY KEY,user_id INT NOT NULL,version INT NOT NULL,ip TEXT,ua TEXT,text TEXT NOT NULL,accepted_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(user_id,version));
CREATE TABLE IF NOT EXISTS expenses(id INTEGER PRIMARY KEY,title TEXT NOT NULL,amount REAL NOT NULL CHECK(amount>0),category TEXT,by_id INT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS skill_categories(id INTEGER PRIMARY KEY,name TEXT UNIQUE NOT NULL,sort INT DEFAULT 0);
CREATE TABLE IF NOT EXISTS skills(id INTEGER PRIMARY KEY,category_id INT NOT NULL REFERENCES skill_categories(id),name TEXT UNIQUE NOT NULL,status TEXT NOT NULL DEFAULT 'pending',suggested_by INT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS skill_keywords(id INTEGER PRIMARY KEY,skill_id INT NOT NULL REFERENCES skills(id),word TEXT NOT NULL,UNIQUE(skill_id,word));
CREATE TABLE IF NOT EXISTS user_skills(user_id INT NOT NULL REFERENCES users(id),skill_id INT NOT NULL REFERENCES skills(id),PRIMARY KEY(user_id,skill_id));
CREATE TABLE IF NOT EXISTS portfolio(id INTEGER PRIMARY KEY,user_id INT NOT NULL REFERENCES users(id),attachment_id INT NOT NULL REFERENCES attachments(id),caption TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS direct_messages(id INTEGER PRIMARY KEY,from_id INT NOT NULL REFERENCES users(id),to_id INT NOT NULL REFERENCES users(id),body TEXT NOT NULL,attachment_id INT REFERENCES attachments(id),created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS ix_direct ON direct_messages(from_id,to_id);
CREATE TABLE IF NOT EXISTS password_resets(id INTEGER PRIMARY KEY,user_id INT NOT NULL REFERENCES users(id),token_hash TEXT NOT NULL UNIQUE,expires_at TEXT NOT NULL,used INT NOT NULL DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
for(const s of ['ALTER TABLE users ADD COLUMN iban TEXT','ALTER TABLE users ADD COLUMN national_id TEXT','ALTER TABLE users ADD COLUMN phone TEXT','ALTER TABLE users ADD COLUMN address TEXT','ALTER TABLE users ADD COLUMN short_address TEXT','ALTER TABLE users ADD COLUMN map_url TEXT','ALTER TABLE users ADD COLUMN suspended_until TEXT','ALTER TABLE users ADD COLUMN flagged INT DEFAULT 0','ALTER TABLE users ADD COLUMN bio TEXT','ALTER TABLE users ADD COLUMN email_verified INT NOT NULL DEFAULT 1','ALTER TABLE users ADD COLUMN notify_email INT NOT NULL DEFAULT 1','ALTER TABLE users ADD COLUMN push_enabled INT NOT NULL DEFAULT 1','ALTER TABLE users ADD COLUMN age_ok INT NOT NULL DEFAULT 1','ALTER TABLE users ADD COLUMN terms_version TEXT','ALTER TABLE users ADD COLUMN terms_at TEXT','ALTER TABLE users ADD COLUMN account_type TEXT NOT NULL DEFAULT \'client\'','CREATE UNIQUE INDEX IF NOT EXISTS ux_users_nid ON users(national_id) WHERE national_id IS NOT NULL','CREATE UNIQUE INDEX IF NOT EXISTS ux_users_phone ON users(phone) WHERE phone IS NOT NULL'])try{db.exec(s)}catch{}
const all=(s,...a)=>db.prepare(s).all(...a),get=(s,...a)=>db.prepare(s).get(...a),run=(s,...a)=>db.prepare(s).run(...a);
const normAr=s=>String(s||'').normalize('NFKC').replace(/[\u064B-\u065F\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').toLowerCase().trim();

const seedSkills=()=>{if(get('SELECT COUNT(*) n FROM skill_categories').n>0)return;SKILL_SEED.forEach(([cn,skills],ci)=>{const cid=Number(run('INSERT INTO skill_categories(name,sort) VALUES(?,?)',cn,ci).lastInsertRowid);skills.forEach(([sn,kws])=>{const sid=Number(run("INSERT INTO skills(category_id,name,status) VALUES(?,?,'approved')",cid,sn).lastInsertRowid);for(const k of new Set([normAr(sn),...kws.map(normAr)]))run('INSERT OR IGNORE INTO skill_keywords(skill_id,word) VALUES(?,?)',sid,k)})})};
seedSkills();
db.exec(`CREATE TABLE IF NOT EXISTS section_keywords(category_id INT NOT NULL REFERENCES skill_categories(id),word TEXT NOT NULL,PRIMARY KEY(category_id,word));
CREATE TABLE IF NOT EXISTS user_sections(user_id INT NOT NULL REFERENCES users(id),category_id INT NOT NULL REFERENCES skill_categories(id),PRIMARY KEY(user_id,category_id));
CREATE TABLE IF NOT EXISTS verify_tokens(token_hash TEXT PRIMARY KEY,user_id INT NOT NULL REFERENCES users(id),expires_at TEXT NOT NULL,used INT NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS login_attempts(k TEXT PRIMARY KEY,n INT NOT NULL,t INT NOT NULL);
CREATE TABLE IF NOT EXISTS agreements(id INTEGER PRIMARY KEY,a_id INT NOT NULL REFERENCES users(id),b_id INT NOT NULL REFERENCES users(id),amount INT NOT NULL,description TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS agreement_commissions(id INTEGER PRIMARY KEY,agreement_id INT UNIQUE NOT NULL REFERENCES agreements(id),helper_id INT NOT NULL REFERENCES users(id),amount REAL NOT NULL,status TEXT NOT NULL DEFAULT 'due',created_at TEXT DEFAULT CURRENT_TIMESTAMP,paid_at TEXT);
CREATE TABLE IF NOT EXISTS reset_codes(user_id INT PRIMARY KEY REFERENCES users(id),code_hash TEXT NOT NULL,expires_at TEXT NOT NULL,attempts INT NOT NULL DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS verify_codes(user_id INT PRIMARY KEY REFERENCES users(id),code_hash TEXT NOT NULL,expires_at TEXT NOT NULL,attempts INT NOT NULL DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS ratings(id INTEGER PRIMARY KEY,agreement_id INT NOT NULL REFERENCES agreements(id),rater_id INT NOT NULL REFERENCES users(id),ratee_id INT NOT NULL REFERENCES users(id),stars INT NOT NULL CHECK(stars BETWEEN 1 AND 5),comment TEXT,hidden INT NOT NULL DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(agreement_id,rater_id));
CREATE TABLE IF NOT EXISTS agreement_cancellations(id INTEGER PRIMARY KEY,agreement_id INT NOT NULL REFERENCES agreements(id),by_id INT NOT NULL REFERENCES users(id),reason TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS contact_messages(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL,body TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS helper_docs(user_id INT NOT NULL REFERENCES users(id),kind TEXT NOT NULL CHECK(kind IN ('cr','vat','address')),number TEXT NOT NULL,attachment_id INT NOT NULL REFERENCES attachments(id),updated_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,kind));CREATE TABLE IF NOT EXISTS helper_extra(user_id INT NOT NULL REFERENCES users(id),kind TEXT NOT NULL CHECK(kind IN ('iban','logo','org')),number TEXT,attachment_id INT REFERENCES attachments(id),updated_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,kind));
CREATE TABLE IF NOT EXISTS failed_searches(id INTEGER PRIMARY KEY,text TEXT NOT NULL,at TEXT DEFAULT CURRENT_TIMESTAMP);`);
const seedSections=()=>{if(get('SELECT COUNT(*) n FROM section_keywords').n>0)return;db.exec("INSERT OR IGNORE INTO section_keywords(category_id,word) SELECT s.category_id,k.word FROM skill_keywords k JOIN skills s ON s.id=k.skill_id WHERE s.status='approved'");for(const c of all('SELECT id,name FROM skill_categories'))run('INSERT OR IGNORE INTO section_keywords(category_id,word) VALUES(?,?)',c.id,normAr(c.name))};
seedSections();

if(!db.prepare("SELECT 1 x FROM pragma_table_info('portfolio') WHERE name='kind'").get())db.exec("ALTER TABLE portfolio ADD COLUMN kind TEXT NOT NULL DEFAULT 'post'");
if(!db.prepare("SELECT 1 x FROM pragma_table_info('users') WHERE name='perms'").get())db.exec("ALTER TABLE users ADD COLUMN perms TEXT NOT NULL DEFAULT ''");
for(const [col,def] of [['reason',"TEXT NOT NULL DEFAULT 'no_category'"],['city','TEXT'],['category_id','INT']]){if(!db.prepare("SELECT 1 x FROM pragma_table_info('failed_searches') WHERE name=?").get(col))db.exec(`ALTER TABLE failed_searches ADD COLUMN ${col} ${def}`)}
for(const [col,def] of [['completion_requested_at','TEXT'],['completion_by','INT'],['completed_at','TEXT'],['disputed_at','TEXT']]){if(!db.prepare("SELECT 1 x FROM pragma_table_info('agreements') WHERE name=?").get(col))db.exec(`ALTER TABLE agreements ADD COLUMN ${col} ${def}`)}
for(const [col,def] of [['dispute_decision','TEXT'],['dispute_note','TEXT'],['dispute_by','INT'],['dispute_decided_at','TEXT'],['dispute_review_by','INT'],['dispute_final','INT']]){if(!db.prepare("SELECT 1 x FROM pragma_table_info('agreements') WHERE name=?").get(col))db.exec(`ALTER TABLE agreements ADD COLUMN ${col} ${def}`)}
for(const [col,def] of [['vat_status',"TEXT NOT NULL DEFAULT ''"],['vat_number','TEXT']]){if(!db.prepare("SELECT 1 x FROM pragma_table_info('users') WHERE name=?").get(col))db.exec(`ALTER TABLE users ADD COLUMN ${col} ${def}`)}
for(const [col,def] of [['paid_at','TEXT']]){if(!db.prepare("SELECT 1 x FROM pragma_table_info('agreements') WHERE name=?").get(col))db.exec(`ALTER TABLE agreements ADD COLUMN ${col} ${def}`)}
if(!db.prepare("SELECT 1 x FROM pragma_table_info('attachments') WHERE name='ext_key'").get())db.exec("ALTER TABLE attachments ADD COLUMN ext_key TEXT");
for(const [col,def] of [['helper_type',"TEXT NOT NULL DEFAULT ''"],['vat_verified','INT NOT NULL DEFAULT 0'],['helper_type_request','TEXT']]){if(!db.prepare("SELECT 1 x FROM pragma_table_info('users') WHERE name=?").get(col))db.exec(`ALTER TABLE users ADD COLUMN ${col} ${def}`)}
for(const [col,def] of [['cash_hold','INT NOT NULL DEFAULT 0']]){if(!db.prepare("SELECT 1 x FROM pragma_table_info('users') WHERE name=?").get(col))db.exec(`ALTER TABLE users ADD COLUMN ${col} ${def}`)}
// إحالة المحلات: العميل المسجّل عبر بطاقة QR محل (مؤسسة/شركة) يُنسب إليه، ويُحفظ أول تسجيل فقط
for(const [col,def] of [['referred_by','INT'],['referred_at','TEXT']]){if(!db.prepare("SELECT 1 x FROM pragma_table_info('users') WHERE name=?").get(col))db.exec(`ALTER TABLE users ADD COLUMN ${col} ${def}`)}
for(const s of ["ALTER TABLE users ADD COLUMN cr_number TEXT","ALTER TABLE users ADD COLUMN cr_verified INT NOT NULL DEFAULT 0","ALTER TABLE contact_messages ADD COLUMN status TEXT NOT NULL DEFAULT 'new'","ALTER TABLE contact_messages ADD COLUMN reply TEXT","ALTER TABLE contact_messages ADD COLUMN replied_at TEXT","ALTER TABLE contact_messages ADD COLUMN replied_by INT"])try{db.exec(s)}catch{}
for(const [col,def] of [['vat_amount','REAL'],['total_amount','REAL'],['helper_net','REAL'],['payment_ref','TEXT'],['paid_via','TEXT'],['materials','REAL']]){if(!db.prepare("SELECT 1 x FROM pragma_table_info('agreements') WHERE name=?").get(col))db.exec(`ALTER TABLE agreements ADD COLUMN ${col} ${def}`)}
// vat_verified: 0 = قيد المراجعة (يعمل)، 1 = معتمد، 2 = مرفوض (موقوف حتى يعدّل الرقم)
// تشفير مفاتيح المساعد (AES-256-GCM)، والمفتاح من متغير البيئة SECRETS_KEY (32 بايت بصيغة base64)
const secretsKey=()=>{const b=Buffer.from(process.env.SECRETS_KEY||'','base64');return b.length===32?b:null};
const encSecret=(plain)=>{const key=secretsKey();if(!key)throw err(503,'مفتاح التشفير غير مُعدّ على الخادم، لا يمكن حفظ المفاتيح');const iv=crypto.randomBytes(12);const c=crypto.createCipheriv('aes-256-gcm',key,iv);const enc=Buffer.concat([c.update(String(plain),'utf8'),c.final()]);return [iv,c.getAuthTag(),enc].map(x=>x.toString('base64')).join('.')};
const decSecret=(blob)=>{const key=secretsKey();if(!key||!blob)return null;try{const [iv,tag,enc]=blob.split('.').map(x=>Buffer.from(x,'base64'));const d=crypto.createDecipheriv('aes-256-gcm',key,iv);d.setAuthTag(tag);return Buffer.concat([d.update(enc),d.final()]).toString('utf8')}catch{return null}};
const helperHalaSecret=uid=>{const r=get('SELECT webhook_secret_enc FROM helper_hala WHERE user_id=?',uid);return r?decSecret(r.webhook_secret_enc):null};
const needsVat=u=>!!u&&u.account_type==='helper'&&u.vat_status==='registered'&&u.vat_verified===2;
const helperOf=a=>{const h=get("SELECT id FROM users WHERE id=? AND account_type='helper'",a.a_id);return h?a.a_id:a.b_id};
db.exec("DROP TABLE IF EXISTS invoices"); // إلغاء نظام الفواتير: حُذفت السجلات القديمة بموافقة المالك
db.exec("DROP TABLE IF EXISTS chat_invoices");
// مسح بطاقة QR لمحل: سجل واحد لكل مسح (بلا هوية الزائر)، يُستخدم لإحصاء المسح ونسبة التسجيل
db.exec("CREATE TABLE IF NOT EXISTS shop_scans(id INTEGER PRIMARY KEY,shop_id INT NOT NULL REFERENCES users(id),at TEXT DEFAULT CURRENT_TIMESTAMP);CREATE INDEX IF NOT EXISTS ix_shop_scans ON shop_scans(shop_id)");
db.exec("CREATE TABLE IF NOT EXISTS helper_hala(user_id INTEGER PRIMARY KEY REFERENCES users(id),api_key_enc TEXT NOT NULL,webhook_secret_enc TEXT NOT NULL,last4 TEXT,updated_at TEXT DEFAULT CURRENT_TIMESTAMP)");
db.exec("CREATE TABLE IF NOT EXISTS platform_invoices(id INTEGER PRIMARY KEY,number TEXT UNIQUE NOT NULL,helper_id INT NOT NULL REFERENCES users(id),amount REAL NOT NULL,commission_ids TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'unpaid',issued_at TEXT DEFAULT CURRENT_TIMESTAMP,paid_at TEXT,paid_note TEXT)");
if(!db.prepare("SELECT 1 x FROM pragma_table_info('platform_invoices') WHERE name='vat_amount'").get())db.exec("ALTER TABLE platform_invoices ADD COLUMN vat_amount REAL NOT NULL DEFAULT 0");
db.exec("CREATE TABLE IF NOT EXISTS tasks(id INTEGER PRIMARY KEY,client_id INT NOT NULL REFERENCES users(id),helper_id INT NOT NULL REFERENCES users(id),status TEXT NOT NULL,agreement_id INT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP)");
if(!db.prepare("SELECT 1 x FROM pragma_table_info('tasks') WHERE name='rated'").get())db.exec("ALTER TABLE tasks ADD COLUMN rated INT NOT NULL DEFAULT 0");
for(const [col,def] of [['source','TEXT']]){if(!db.prepare("SELECT 1 x FROM pragma_table_info('agreements') WHERE name=?").get(col))db.exec(`ALTER TABLE agreements ADD COLUMN ${col} ${def}`)}
db.exec("CREATE TABLE IF NOT EXISTS agreement_notes(agreement_id INTEGER PRIMARY KEY REFERENCES agreements(id),notes TEXT NOT NULL DEFAULT '',updated_at TEXT)");
// المتابعة
db.exec(`CREATE TABLE IF NOT EXISTS user_follows(follower_id INT NOT NULL REFERENCES users(id),followed_id INT NOT NULL REFERENCES users(id),created_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(follower_id,followed_id));`);
// متجر المساعد: منتجات بسعر تعريفي، وسلة لكل زوج (عميل، متجر). السعر النهائي يحدده رابط الدفع لا السلة.
db.exec("CREATE TABLE IF NOT EXISTS shop_products(id INTEGER PRIMARY KEY,helper_id INT NOT NULL REFERENCES users(id),title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',price REAL NOT NULL CHECK(price>0),active INT NOT NULL DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP);CREATE INDEX IF NOT EXISTS ix_shop_products_helper ON shop_products(helper_id);");
db.exec("CREATE TABLE IF NOT EXISTS discount_codes(id INTEGER PRIMARY KEY,code TEXT UNIQUE NOT NULL,percent INT NOT NULL CHECK(percent BETWEEN 1 AND 100),max_uses INT NOT NULL CHECK(max_uses>0),used INT NOT NULL DEFAULT 0,active INT NOT NULL DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
for(const [col,def] of [['discount_code_id','INT'],['discount_amount','REAL']]){if(!db.prepare("SELECT 1 x FROM pragma_table_info('agreements') WHERE name=?").get(col))db.exec(`ALTER TABLE agreements ADD COLUMN ${col} ${def}`)}
if(!db.prepare("SELECT 1 x FROM pragma_table_info('shop_products') WHERE name='image_id'").get())db.exec('ALTER TABLE shop_products ADD COLUMN image_id INT REFERENCES attachments(id)');

db.exec("DELETE FROM settings WHERE key='commission_percent'"); // تنظيف: حذف أي نسبة قديمة مخزّنة
const VAT_THRESHOLD=375000;
// توريدات المنصة الخاضعة: المنصة تستلم العمولة فقط، فلا تُحسب قيمة المهمة كاملة إلا للمساعد غير المسجل (مورّد مفترض) إن كان العد الاحتياطي مفعّلًا
const supplyOf=a=>Math.round(Number(a.amount)*COMMISSION_PCT)/100; // توريد المنصة = عمولتها فقط
const turnover12m=()=>all("SELECT amount,a_id,b_id FROM agreements WHERE paid_at IS NOT NULL AND paid_at>=datetime('now','-365 days')").reduce((s,a)=>s+supplyOf(a),0);
// called BEFORE a new agreement is priced: if the platform's supplies would reach the threshold, VAT is switched on first
const activateVatIfNeeded=(extra)=>{if(SET().platform_vat_registered==='1')return true;if(turnover12m()+Number(extra||0)<VAT_THRESHOLD)return false;
run("INSERT OR REPLACE INTO settings(key,value) VALUES('platform_vat_registered','1')");run("INSERT OR REPLACE INTO settings(key,value) VALUES('platform_vat_activated_at',?)",new Date().toISOString());
all("SELECT id FROM users WHERE role='admin'").forEach(a=>notify(a.id,'بلغ إجمالي توريدات المنصة حد التسجيل الإلزامي 375,000 ريال، وفُعّلت ضريبة القيمة المضافة تلقائيًا','#/admin'));return true};
const COMMISSION_PCT=5; // نسبة عمولة المنصة الثابتة (5%)
const commissionPctFor=()=>COMMISSION_PCT;
const ensureCommission=(id)=>{const a=get('SELECT * FROM agreements WHERE id=?',id);if(!a||!a.paid_at)return;const pct=commissionPctFor(helperOf(a));run("INSERT OR IGNORE INTO agreement_commissions(agreement_id,helper_id,amount,status,paid_at) VALUES(?,?,?,'paid',datetime('now'))",id,helperOf(a),Math.round(a.amount*pct)/100)};
const clientOf=a=>helperOf(a)===a.a_id?a.b_id:a.a_id;
const CATALOG_VERSION='4';
const applyCatalog=()=>{const v=get("SELECT value FROM settings WHERE key='catalog_version'");if(v&&v.value===CATALOG_VERSION)return;
db.exec("DELETE FROM section_keywords;DELETE FROM user_sections;DELETE FROM user_skills;DELETE FROM skill_keywords;DELETE FROM skills;DELETE FROM skill_categories;");
CATALOG.forEach((c,i)=>{const id=Number(run('INSERT INTO skill_categories(name,sort) VALUES(?,?)',c.name,i+1).lastInsertRowid);for(const w of [c.name,...c.words])run('INSERT OR IGNORE INTO section_keywords(category_id,word) VALUES(?,?)',id,normAr(w))});
run("INSERT OR REPLACE INTO settings(key,value) VALUES('catalog_version',?)",CATALOG_VERSION)};
applyCatalog();
const addNewCatalog=()=>{let sort=get('SELECT COALESCE(MAX(sort),0) m FROM skill_categories').m;for(const nc of NEW_CATALOG){if(get('SELECT 1 x FROM skill_categories WHERE name=?',nc.name))continue;const id=Number(run('INSERT INTO skill_categories(name,sort) VALUES(?,?)',nc.name,++sort).lastInsertRowid);for(const w of [nc.name,...nc.words])run('INSERT OR IGNORE INTO section_keywords(category_id,word) VALUES(?,?)',id,normAr(w))}};
addNewCatalog();
const addExtraKeywords=()=>{for(const [name,words] of Object.entries(EXTRA_KEYWORDS)){const c=get('SELECT id FROM skill_categories WHERE name=?',name);if(!c)continue;for(const w of words)run('INSERT OR IGNORE INTO section_keywords(category_id,word) VALUES(?,?)',c.id,normAr(w))}};
addExtraKeywords();
try{db.exec("ALTER TABLE skill_categories ADD COLUMN mode TEXT NOT NULL DEFAULT 'onsite'");db.exec("UPDATE skill_categories SET mode='online' WHERE name='تقنية وتصميم'")}catch{}
db.exec("UPDATE users SET account_type='helper' WHERE account_type='client' AND id IN (SELECT user_id FROM user_sections)");
// تنظيف لمرة واحدة: الهوية والآيبان القديمان في users (النسخة الفعلية للآيبان في helper_extra). يُسجَّل في settings فلا يتكرر عند كل تشغيل
if(!get("SELECT 1 x FROM settings WHERE key='legacy_pii_scrubbed'")){db.exec("UPDATE users SET iban=NULL,national_id=NULL");run("INSERT OR REPLACE INTO settings(key,value) VALUES('legacy_pii_scrubbed','1')")}
const err=(s,m)=>Object.assign(new Error(m),{s});
const tx=f=>{db.exec('BEGIN IMMEDIATE');try{const r=f();db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}};
const hash=p=>{const s=crypto.randomBytes(16).toString('hex');return s+':'+crypto.scryptSync(p,s,64).toString('hex')};
const check=(p,h)=>{try{const [s,x]=String(h||'').split(':');if(!s||!x)return false;const a=crypto.scryptSync(p,s,64),b=Buffer.from(x,'hex');return b.length===a.length&&crypto.timingSafeEqual(a,b)}catch{return false}};
const notify=(u,t,l,{mail=true}={})=>{l=safeLink(l);const r=run('INSERT INTO notifications(user_id,text,link) VALUES(?,?,?)',u,t,l??null);pushTo(u,t,l);if(mail)notifyEmail(u,'إشعار جديد',t,l&&l.startsWith('#/')?l.slice(1):'/notifs');return r};
const pushHits=new Map();
const vapidSubject=()=>{const ok=v=>v&&/^(mailto:[^@\s]+@[^@\s]+\.[^@\s]+|https:\/\/[^\s]+)$/.test(v)&&!/example\.(com|org|net)/i.test(v);const e=process.env.VAPID_SUBJECT,a=ADMIN?'mailto:'+ADMIN:'',u=(process.env.APP_URL||'').replace(/\/$/,'');return ok(e)?e:ok(a)?a:ok(u)?u:e||'mailto:admin@example.com'};
const pushCfg=()=>{const publicKey=cleanKey(process.env.VAPID_PUBLIC_KEY),privateKey=cleanKey(process.env.VAPID_PRIVATE_KEY);return publicKey&&privateKey?{publicKey,privateKey,subject:vapidSubject()}:null};
const pushKeyProblem=()=>{const c=pushCfg();return c?vapidProblem(c):''};
const pushTo=(uid,title,link)=>{const cfg=pushCfg();if(!cfg||vapidProblem(cfg))return;const pref=get('SELECT push_enabled FROM users WHERE id=?',uid);if(!pref||!pref.push_enabled)return;const nowT=Date.now(),hits=(pushHits.get(uid)||[]).filter(t=>nowT-t<600000);if(hits.length>=10){pushHits.set(uid,hits);return}hits.push(nowT);pushHits.set(uid,hits);const cnt=get('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read=0',uid).n;for(const sub of all('SELECT id,endpoint,p256dh,auth FROM push_subscriptions WHERE user_id=?',uid))sendWebPush(sub,JSON.stringify({title:'المساعد',body:String(title),url:'/'+(link||''),count:cnt}),cfg).then(async r=>{if(r.ok)return;const f=await pushFailure(r);if(f.dead)run('DELETE FROM push_subscriptions WHERE id=?',sub.id);if(f.status!==404&&f.status!==410)console.error('push: '+f.status+' '+f.reason+(f.dead?' (حُذف الاشتراك القديم)':''))}).catch(e=>console.error('push: '+e.message))};
const pushTestAt=new Map();
const pushTest=async uid=>{
const cfg=pushCfg();if(!cfg)return{sent:0,reason:'مفاتيح VAPID غير مضبوطة على الخادم'};
const bad=vapidProblem(cfg);if(bad)return{sent:0,reason:'مفاتيح VAPID غير صالحة: '+bad};
const last=pushTestAt.get(uid)||0;if(Date.now()-last<15000)return{sent:0,reason:'انتظر قليلًا ثم أعد المحاولة'};pushTestAt.set(uid,Date.now());if(pushTestAt.size>5000)pushTestAt.clear();
const subs=all('SELECT id,endpoint,p256dh,auth FROM push_subscriptions WHERE user_id=?',uid);if(!subs.length)return{sent:0,reason:'لا يوجد جهاز مشترك. فعّل إشعارات الدفع من هذا الجهاز أولًا'};
const cnt=get('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read=0',uid).n;let ok=0,dead=0,st=0,why='',ex='';
for(const s of subs){try{const r=await sendWebPush(s,JSON.stringify({title:'المساعد',body:'إشعار تجريبي: إذا ظهر لك هذا فالإشعارات تعمل',url:'/#/notifs',count:cnt}),cfg);if(r.ok)ok++;else{const f=await pushFailure(r);st=f.status;why=f.reason;console.error('push test: '+f.status+' '+f.reason);if(f.dead){dead++;run('DELETE FROM push_subscriptions WHERE id=?',s.id)}}}catch(e){ex=e.message;console.error('push test: '+e.message)}}
if(ok)return{sent:ok};
if(dead){pushTestAt.delete(uid);return{sent:0,stale:1,reason:'كان اشتراك هذا الجهاز قديمًا أو مرتبطًا بمفتاح إشعارات سابق، وأُعيد ربطه الآن. اضغط «إرسال إشعار تجريبي» مرة أخرى'}}
if(st)return{sent:0,reason:'رفضت خدمة الدفع الإرسال (الحالة '+st+(why?'، السبب: '+why:'')+')'+(st===401||st===403?'. تحقق من VAPID_SUBJECT (بريد حقيقي) ومن المفاتيح في الاستضافة':'. أعد تفعيل الإشعارات من هذا الجهاز')};
return{sent:0,reason:'تعذر الاتصال بخدمة الدفع'+(ex?': '+ex:'')}};
const bal=u=>get('SELECT COALESCE(SUM(delta),0) b FROM points_ledger WHERE user_id=?',u).b;
const award=(u,key,ref)=>{const p=get('SELECT points FROM reward_rules WHERE key=?',key)?.points||0;if(p>0&&run('INSERT OR IGNORE INTO points_ledger(user_id,delta,reason,ref) VALUES(?,?,?,?)',u,p,key,ref).changes)notify(u,`أُضيفت ${p} نقطة إلى محفظتك`,'#/profile')};
const audit=(a,act,d)=>run('INSERT INTO audit_log(admin_id,action,detail) VALUES(?,?,?)',a,act,d);
// رابط الإشعار يجب أن يكون مسارًا داخليًا (#/...) فقط، وإلا يُهمل
const safeLink=l=>{const s=String(l??'');return s.length<=200&&/^#\/[A-Za-z0-9_\-\/.?=&%#]*$/.test(s)?s:null};
// نسخة احتياطية بصلاحية 0600 من لحظة الإنشاء: يُنشأ ملف فارغ مقيّد أولًا ثم يُملأ بـ VACUUM INTO
const vacuumTo=f=>{fs.writeFileSync(f,'',{mode:0o600,flag:'wx'});try{db.exec(`VACUUM INTO '${f.replace(/'/g,"''")}'`);fs.chmodSync(f,0o600)}catch(e){try{fs.unlinkSync(f)}catch{}throw e}};
// إزالة السلة والفواتير المؤقتة مرة واحدة (بطلب المالك): نسخة احتياطية أولًا، ثم حذف الفواتير وجدول السلة
{const cartTbl=db.prepare("SELECT 1 x FROM sqlite_master WHERE type='table' AND name='shop_cart'").get();
const tmpInv=db.prepare("SELECT COUNT(*) n FROM direct_messages WHERE body LIKE '[فاتورة المتجر]%'").get().n;
if(cartTbl||tmpInv){const dir=process.env.BACKUP_DIR||path.join(path.dirname(path.resolve(DB_PATH)),'backups');fs.mkdirSync(dir,{recursive:true});
const bak=path.join(dir,`backup-before-cart-removal-${Date.now()}.db`);vacuumTo(bak);
db.exec("DELETE FROM direct_messages WHERE body LIKE '[فاتورة المتجر]%'");db.exec("DROP TABLE IF EXISTS shop_cart");
console.log(`إزالة السلة: حذف ${tmpInv} فاتورة مؤقتة. النسخة الاحتياطية: ${bak}`)}}
const startSession=(res,uid)=>{const t=crypto.randomBytes(32).toString('hex'),priv=['admin','staff'].includes(get('SELECT role FROM users WHERE id=?',uid)?.role),ttl=priv?432e5:6048e5;run('INSERT INTO sessions VALUES(?,?,?)',sha(t),uid,Date.now()+ttl);res.setHeader('Set-Cookie',`sid=${t}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${ttl/1000}${((process.env.APP_URL||'').startsWith('https')||res.req.headers['x-forwarded-proto']==='https')?'; Secure':''}`)};
// مالكو المنصة: كل حساب ببريد من ADMIN_EMAIL (أكثر من بريد مفصول بفاصلة) يصير مديرًا تلقائيًا، بشرط أن يكون البريد موثّقًا برمز التفعيل (ولا يعمل إذا عُطّل التحقق)
const ownerPromote=u=>{if(u&&ADMINS.size&&VERIFY_REQUIRED&&u.email_verified===1&&u.role!=='admin'&&ADMINS.has(String(u.email).toLowerCase())){run("UPDATE users SET role='admin' WHERE id=?",u.id);audit(u.id,'owner_admin',`user:${u.id}`);u.role='admin'}return u};
const userOf=t=>ownerPromote(t?get('SELECT u.id,u.name,u.email,u.city,u.role,u.active,u.account_type,u.phone,u.address,u.short_address,u.map_url,u.email_verified,u.notify_email,u.push_enabled,u.perms,u.vat_status,u.vat_number,u.helper_type,u.vat_verified,u.cr_number,u.cr_verified FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.exp>? AND u.active=1',sha(t),Date.now()):undefined);
const need=c=>{if(!c.u)throw err(401,'سجّل الدخول أولًا');return c.u};
const verified=c=>{const u=need(c);if(!u.email_verified&&VERIFY_REQUIRED)throw err(403,'فعّل بريدك الإلكتروني أولًا');return u};
const adm=c=>{if(need(c).role!=='admin')throw err(403,'غير مصرح');return c.u};
const can=(c,area)=>{const u=need(c);if(u.role==='admin')return u;if(u.role==='staff'&&(u.perms||'').split(',').includes(area))return u;throw err(403,'لا تملك صلاحية لهذا القسم')};
const str=(v,min,max,n)=>{v=String(v??'').trim();if(v.length<min||v.length>max)throw err(400,`${n}: الطول بين ${min} و${max} حرفًا`);return v};
const num=(v,n)=>{if(v===''||v==null)return null;v=Number(v);if(!(v>=0)||v>1e7)throw err(400,n+' غير صالح');return v};
const R=[],route=(m,p,f)=>R.push([m,new RegExp('^/api'+p+'$'),f]);


const SET=()=>Object.fromEntries(all('SELECT key,value FROM settings').map(r=>[r.key,r.value]));
const restricted=uid=>{const x=get("SELECT flagged,cash_hold,(suspended_until>datetime('now')) on_hold FROM users WHERE id=?",uid);
if(x?.flagged)throw err(403,'حسابك قيد مراجعة الإدارة بسبب تكرار الإلغاء بعد الاختيار');
if(x?.on_hold)throw err(403,'حسابك موقوف مؤقتًا عن النشر والتقدم بسبب تكرار الإلغاء');
if(x?.cash_hold)throw err(403,'حسابك موقوف مؤقتًا حتى سداد مستحقات الطلبات الكاش');};
const own=(u,id)=>{if(!id)return null;if(!get('SELECT 1 x FROM attachments WHERE id=? AND user_id=?',+id,u.id))throw err(400,'المرفق غير صالح');return +id};
const PV=4;
const pledgeBody=s=>[
`1. أقرّ بأنني اطلعت على شروط المنصة وسياسة الخصوصية، وأن هذا التعهد ملزم لي نظامًا.`,
`2. ألتزم بسداد عمولة للمنصة قدرها ${COMMISSION_PCT}% من السعر النهائي المتفق عليه في كل مهمة أو اتفاق يتم عبر المنصة (طلب أو محادثة)، سواء تم الدفع بالتحويل المباشر أو بأي وسيلة أخرى.`,
`3. تُخصم العمولة تلقائيًا من المبلغ المدفوع عبر بوابة هلا عند نجاح الدفع، ويُوزَّع الباقي على المساعد دون أي تحويل يدوي من الطرفين. ولا تُستحق عن المهمة الملغاة أو المعترض عليها أو الجزء غير المنفَّذ.`,
`4. ألتزم بعدم التحايل على المنصة، فلا أتفق مع طالب المساعدة على إتمام المهمة أو الدفع خارجها لتفادي العمولة. وإذا ثبت ذلك استحقت المنصة العمولة كاملة، مع حقها في المطالبة بالتعويض عما لحقها من ضرر أمام الجهة المختصة.`,
`5. عند التأخر عن السداد يحق للمنصة: (أ) إيقاف حسابي أو منعي من التقدم لمهام جديدة، (ب) مطالبتي بالمبلغ المستحق، (ج) اللجوء إلى الجهات القضائية والتنفيذية والتحكيمية المختصة في المملكة لاستيفاء حقها.`,
`6. أتحمل ما تتكبده المنصة في سبيل التحصيل من رسوم ومصاريف تقاضٍ أو تحكيم وتنفيذ وأتعاب محاماة، وفق ما يقرره المحكم أو الجهة المختصة.`,
`7. تعد سجلات المنصة حجة عليّ، وهي: المحادثات، وصور التحويلات، والسعر المعتمد، وحالة المهمة، وسجلات الدخول والموافقة، ما لم أثبت خلاف ذلك.`,
`8. أقرّ بأن موافقتي الإلكترونية على هذا التعهد تعد توقيعًا إلكترونيًا معتبرًا نظامًا، وأن بياناتي المدخلة صحيحة وأتحمل مسؤولية صحتها.`,
`9. أوافق على إفصاح المنصة عن بياناتي للجهات القضائية والرسمية والتحكيمية بالقدر اللازم لتحصيل حقها.`,
`10. يخضع هذا التعهد لأنظمة المملكة العربية السعودية. ${s.dispute_clause}`,
`11. يسري هذا التعهد على جميع المهام التي أنجزها عبر المنصة، وتبقى التزاماتي قائمة بعد إغلاق حسابي فيما استحق قبل ذلك.`].join('\n');
const resolveSkills=raw=>{const ids=[...new Set((Array.isArray(raw)?raw:[]).map(Number).filter(Number.isInteger))];if(ids.length>15)throw err(400,'يمكن اختيار 15 تخصصًا كحد أقصى');
const rows=ids.length?all(`SELECT id,category_id FROM skills WHERE status='approved' AND id IN (${ids.map(()=>'?').join(',')})`,...ids):[];if(rows.length!==ids.length)throw err(400,'التخصص غير صالح');
const catIds=[...new Set(rows.map(r=>r.category_id))];if(catIds.length>2)throw err(400,'يمكن اختيار قسمين كحد أقصى');return{skillIds:ids,catIds}};
const saveSpecialties=(uid,skillIds,catIds)=>{run('DELETE FROM user_skills WHERE user_id=?',uid);for(const id of skillIds)run('INSERT INTO user_skills(user_id,skill_id) VALUES(?,?)',uid,id);saveSections(uid,catIds)};
const cleanSections=raw=>{const ids=[...new Set((Array.isArray(raw)?raw:[]).map(Number).filter(Number.isInteger))];if(ids.length>2)throw err(400,'اختر قسمًا أو قسمين كحد أقصى لخدماتك');for(const id of ids)if(!get('SELECT 1 x FROM skill_categories WHERE id=?',id))throw err(400,'القسم غير صالح');return ids};
const saveSections=(uid,ids)=>{run('DELETE FROM user_sections WHERE user_id=?',uid);for(const id of ids)run('INSERT INTO user_sections(user_id,category_id) VALUES(?,?)',uid,id)};
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
// مفتاح HMAC للرموز القصيرة: من APP_SECRET إن وُجد (يُفضّل ألا يُخزَّن مع البيانات)، وإلا مفتاح عشوائي محفوظ في الإعدادات
let _macKey=null;const macKey=()=>{if(_macKey)return _macKey;if(process.env.APP_SECRET){_macKey=process.env.APP_SECRET;return _macKey}let r=get("SELECT value FROM settings WHERE key='mac_key'");if(!r){run("INSERT OR IGNORE INTO settings(key,value) VALUES('mac_key',?)",crypto.randomBytes(32).toString('hex'));r=get("SELECT value FROM settings WHERE key='mac_key'")}_macKey=r.value;return _macKey};
const macOf=s=>crypto.createHmac('sha256',macKey()).update(s).digest('hex');
const hesc=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const sendMail=async(to,subject,html)=>{const key=process.env.RESEND_API_KEY;if(!key){console.error('mail: RESEND_API_KEY غير مضبوط، لم تُرسل الرسالة');return false}
try{const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.MAIL_FROM||'المساعد <onboarding@resend.dev>',to:[to],subject,html,text:html.replace(/<a href="([^"]+)"[^>]*>([^<]*)<\/a>/g,'$2: $1').replace(/<\/p>/g,'\n').replace(/<[^>]+>/g,'').trim()})});if(!r.ok){console.error('mail: Resend رفض الطلب، الحالة',r.status);return false}return true}catch(e){console.error('mail: خطأ في الاتصال',e.message);return false}};
const chatUnreadOf=uid=>get("SELECT COUNT(*) n FROM direct_messages m WHERE m.to_id=? AND m.created_at>COALESCE((SELECT value FROM settings WHERE key='chatread:'||CAST(? AS INTEGER)||':'||m.from_id),'')",uid,uid).n;
const notifyEmail=(uid,subject,text,path)=>{const x=get('SELECT name,email,notify_email FROM users WHERE id=?',uid);if(!x||!x.notify_email||!x.email)return;const base=(process.env.APP_URL||'').replace(/\/$/,'');sendMail(x.email,subject+' - المساعد',`<div dir="rtl"><p>أهلًا ${hx(x.name)}،</p><p>${hx(text)}</p><p><a href="${base}/#${path}">${path.startsWith('/direct/')?'افتح المحادثة':'فتح المنصة'}</a></p><p style="color:#777;font-size:12px">لإيقاف هذه الرسائل عدّل إعدادات الإشعارات في حسابك.</p></div>`).catch(()=>{})};
const TERMS_VERSION='2026-12';
const VERIFY_REQUIRED=process.env.EMAIL_VERIFY_REQUIRED!=='0';
const issueVerify=async(uid,email)=>{const code=String(crypto.randomInt(0,10000)).padStart(4,'0');run("INSERT OR REPLACE INTO verify_codes(user_id,code_hash,expires_at,attempts,created_at) VALUES(?,?,datetime('now','+10 minutes'),0,datetime('now'))",uid,macOf(code+':'+uid));const u=get('SELECT name FROM users WHERE id=?',uid);return sendMail(email,'رمز تفعيل البريد - المساعد',`<div dir="rtl"><p>أهلًا ${hx(u?u.name:'')}،</p><p>رمز تفعيل بريدك الإلكتروني:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>الرمز صالح لمدة 10 دقائق. إذا لم تطلب ذلك فتجاهل هذه الرسالة.</p></div>`)};
const ACT={start:['helper',['helper_chosen'],'in_progress'],complete:['owner',['in_progress'],'completed'],cancel:['owner',['draft','published','negotiating'],'cancelled'],publish:['owner',['draft'],'published'],dispute:['party',['helper_chosen','in_progress'],'disputed']};
const blocked=(a,b)=>!!get('SELECT 1 x FROM blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)',a,b,b,a);
// قاعدة الإلغاء: 15 إلغاءً خلال 7 أيام، أو 5 إلغاءات متتالية دون أي طلب مكتمل بينها ← إغلاق 7 أيام
const applyPenalty=uid=>{
  const weekly=get("SELECT COUNT(*) n FROM agreement_cancellations WHERE by_id=? AND created_at>datetime('now','-7 days')",uid).n;
  const last5=all("SELECT created_at FROM agreement_cancellations WHERE by_id=? ORDER BY id DESC LIMIT 5",uid);
  let streak=false;
  if(last5.length===5){const since=last5[4].created_at;streak=!get("SELECT 1 x FROM agreements WHERE status='completed' AND (a_id=? OR b_id=?) AND completed_at>=?",uid,uid,since)}
  if(weekly>=15||streak){
    run("UPDATE users SET suspended_until=datetime('now','+7 days') WHERE id=?",uid);
    notify(uid,'أُغلق حسابك 7 أيام بسبب تكرار الإلغاء');
  }
};

// الطلبات الكاش: 3 طلبات كاش لم تُسدَّد عمولاتها ← إيقاف مؤقت حتى السداد
const CASH_HOLD_AT=3;
const syncCashHold=uid=>{
  const n=get("SELECT COUNT(*) n FROM agreement_commissions ac JOIN agreements a ON a.id=ac.agreement_id WHERE ac.helper_id=? AND ac.status='due' AND a.paid_via='cash'",uid).n;
  const want=n>=CASH_HOLD_AT?1:0;
  const cur=(get('SELECT cash_hold FROM users WHERE id=?',uid)||{}).cash_hold||0;
  if(want!==cur){
    run('UPDATE users SET cash_hold=? WHERE id=?',want,uid);
    if(want)notify(uid,`أُوقف حسابك مؤقتًا لوجود ${n} طلبات كاش لم تُسدَّد عمولاتها، ويُفعَّل بعد السداد`,'#/profile');
  }
};
const likeEsc=v=>String(v).replace(/[\\%_]/g,m=>'\\'+m);
const cleanSearch=t=>String(t).replace(/\+?[\d\u0660-\u0669][\d\u0660-\u0669\s-]{7,}[\d\u0660-\u0669]/g,'[\u0631\u0642\u0645]').replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g,'[\u0628\u0631\u064a\u062f]').trim().slice(0,200);
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
// فتح المدينة للخدمات الحضورية: مساعد واحد نشط على الأقل في 80% من التخصصات الحضورية
const CITY_OPEN_PCT=0.8;
const cityCoverage=city=>{
  const total=get("SELECT COUNT(*) n FROM skill_categories WHERE mode!='online'").n;
  const covered=get(`SELECT COUNT(DISTINCT us.category_id) n FROM user_sections us
    JOIN skill_categories sc ON sc.id=us.category_id AND sc.mode!='online'
    JOIN users u ON u.id=us.user_id
    WHERE u.city=? AND u.account_type='helper' AND u.active=1 AND u.email_verified=1 AND u.flagged=0`,city).n;
  const pct=total?covered/total:0;
  return{total,covered,pct,open:pct>=CITY_OPEN_PCT};
};
// بعد بلوغ العتبة تبقى المدينة مفتوحة حتى لو انخفض العدد لاحقًا
const cityOpen=city=>{
  let list=[];try{list=JSON.parse(SET().opened_cities||'[]')}catch{}
  if(list.includes(city))return true;
  if(!cityCoverage(city).open)return false;
  list.push(city);
  run("INSERT INTO settings(key,value) VALUES('opened_cities',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",JSON.stringify(list));
  return true;
};

export {pushCfg,pushKeyProblem,pushTest,verified,cityCoverage,cityOpen,CITY_OPEN_PCT,macOf,DB_PATH, notifyEmail, activateVatIfNeeded, supplyOf, RESTORE_PENDING, route, PORT, db, all, normAr, seedSkills, seedSections, err, tx, hash, check, notify, chatUnreadOf, bal, award, audit, startSession, userOf, need, adm, str, num, R, ADMIN, get, run, SET, restricted, PV, TERMS_VERSION, VERIFY_REQUIRED, cleanSections, hesc, issueVerify, own, pledgeBody, resolveSkills, saveSections, saveSpecialties, sendMail, sha, ACT, applyPenalty, blocked, cleanSearch, hx, likeEsc, matchSections, msgMailAt, notifyMessageMail, stripAl, toksOf, hitOr429, can, helperOf, clientOf, ensureCommission, needsVat, commissionPctFor, COMMISSION_PCT, syncCashHold, helperHalaSecret, encSecret, secretsKey, safeLink, vacuumTo};

// تنظيف محاولات الدخول القديمة عند التشغيل (الجدول كان ينمو بلا حد)
try{run('DELETE FROM login_attempts WHERE t<?',Date.now()-864e5)}catch{}
