import {test,before,after} from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
const macKeyOf=(file)=>{const d=new DatabaseSync(file);const r=d.prepare("SELECT value FROM settings WHERE key='mac_key'").get();d.close();return r?.value};
const macFor=(file,s)=>createHmac('sha256',macKeyOf(file)).update(s).digest('hex');
import {DatabaseSync} from 'node:sqlite';
import {createHash,createHmac} from 'node:crypto';
import {existsSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
let DBF;
let srv;const B='http://localhost:3999';
before(async()=>{DBF=join(tmpdir(),'t'+Date.now()+'.db');srv=spawn('node',['server.js'],{env:{...process.env,SECRETS_KEY:Buffer.alloc(32,7).toString('base64'),RESEND_API_KEY:'',REGISTER_PER_HOUR:'1000',ASSISTANT_PER_HOUR:'5000',PORT:3999,DB_FILE:DBF,ADMIN_EMAIL:'admin@t.sa',ADMIN_SETUP_TOKEN:'test-token',HALA_WEBHOOK_SECRET:'test-hala'},stdio:'ignore'});await new Promise(r=>setTimeout(r,1200))});
after(()=>srv.kill());
const cl=()=>{let ck='';return async(p,m='GET',b)=>{const r=await fetch(B+'/api'+p,{method:m,headers:{'content-type':'application/json',cookie:ck},body:b?JSON.stringify(b):undefined});ck=r.headers.get('set-cookie')?.split(';')[0]||ck;return{s:r.status,j:await r.json().catch(()=>({}))}}};
let phSeq=0;const ph=()=>'05'+String(70000000+(++phSeq));
const reg=async(e)=>{const c=cl();await c('/register','POST',{name:'مستخدم '+e,email:e+'@t.sa',password:'12345678',terms:1,age:1,phone:ph()}); await c('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'مستخدم '+e,phone:ph()}); await vfy(c);return c};
const asHelper=async c=>{const cats=(await c('/skills')).j.categories;return c('/me/account-type','POST',{type:'helper',helper_type:'establishment',vat_number:'3'+String(Math.floor(Math.random()*1e14)).padStart(14,'0'),category_ids:[cats[0].id]})};
const backdateHelper=e=>{const d=new DatabaseSync(DBF);d.prepare("UPDATE users SET created_at=datetime('now','-40 days') WHERE email=?").run(e);d.close()};
const vfy=async(c)=>{const id=(await c('/me')).j.user.id;const d=new DatabaseSync(DBF);d.prepare("UPDATE users SET email_verified=1,vat_verified=1,vat_status='registered',vat_number=CASE WHEN vat_number IS NULL OR vat_number='' THEN '312345678901234' ELSE vat_number END WHERE id=?").run(id);d.close();};
const verifyEmail=async(c)=>{const id=(await c('/me')).j.user.id;const d=new DatabaseSync(DBF);d.prepare('UPDATE users SET email_verified=1 WHERE id=?').run(id);d.close();};
const payReq=async(id,amt)=>{const r=await fetch(B+'/api/payments/hala/webhook',{method:'POST',headers:{'content-type':'application/json','x-hala-secret':'test-hala'},body:JSON.stringify({request_id:id,amount:amt,reference:'RQ'+id})});return{s:r.status,j:await r.json()}};
const payHala=async(id)=>{const r=await fetch(B+'/api/payments/hala/webhook',{method:'POST',headers:{'content-type':'application/json','x-hala-secret':'test-hala'},body:JSON.stringify({agreement_id:id,amount:99999,reference:'R'+id})});return r.status};
test('الحسابات المشتركة للاختبارات اللاحقة',async()=>{const adm=await reg('admin');await reg('o2');assert.equal((await adm('/admin/bootstrap','POST',{token:'test-token'})).s,200);});
test('المالية والمصروفات والنشاط وصلاحيات الإدارة',async()=>{
const adm=cl();await adm('/login','POST',{email:'admin@t.sa',password:'12345678'});
const user=await cl();await user('/login','POST',{email:'o2@t.sa',password:'12345678'});
const before=(await adm('/admin/finance')).j;
assert.equal((await adm('/admin/expenses','POST',{title:'استضافة الموقع',amount:25,category:'استضافة'})).s,200);
assert.equal((await adm('/admin/expenses','POST',{title:'بند سالب',amount:-5})).s,400);
const after=(await adm('/admin/finance')).j;
assert.equal(after.expenses-before.expenses,25);assert.equal(after.profit,after.income-after.expenses);
assert.ok(Array.isArray(after.ledger)&&after.ledger.some(x=>x.type==='صادر'&&x.title==='استضافة الموقع'));
assert.equal((await user('/admin/finance')).s,403);assert.equal((await user('/admin/expenses','POST',{title:'محاولة',amount:5})).s,403);
const uid=(await user('/me')).j.user.id;
const act=(await adm(`/admin/users/${uid}/activity`)).j;assert.equal(act.user.id,uid);assert.equal(typeof act.agreements,'number');
assert.equal((await user(`/admin/users/${uid}/activity`)).s,403);
await adm('/admin/settings','POST',{bank_name:'بنك',account_name:'مؤسسة',iban:'SA0380000000608010167519',commission_percent:2,penalty_rules:'المادة 1: الإلغاء المتكرر بعد الاختيار يوقف النشر مؤقتًا.'});
assert.ok((await adm('/platform-account')).j.penalty_rules.includes('المادة 1'));
});

test('أدوات الإدارة: الطلبات والإلغاءات والسجل والدور وكلمة المرور والإعلان والنسخة',async()=>{
const adm=cl();await adm('/login','POST',{email:'admin@t.sa',password:'12345678'});
const user=await cl();await user('/login','POST',{email:'o2@t.sa',password:'12345678'});
const uid=(await user('/me')).j.user.id;
for(const path of ['/admin/audit','/admin/backup']) assert.equal((await user(path)).s,403,path);
assert.ok((await adm('/admin/audit')).j.length>0);
assert.equal((await adm('/admin/users/1/role','POST',{role:'user',reason:'تجربة'})).s,400);
assert.equal((await adm(`/admin/users/${uid}/role`,'POST',{role:'admin',reason:'ترقية تجريبية'})).s,200);
assert.equal((await adm(`/admin/users/${uid}/role`,'POST',{role:'user',reason:'إعادة'})).s,200);
assert.equal((await user(`/admin/users/${uid}/role`,'POST',{role:'admin',reason:'محاولة'})).s,403);
assert.equal((await adm(`/admin/users/${uid}/password`,'POST',{password:'قصير',reason:'تجربة'})).s,400);
assert.equal((await adm(`/admin/users/${uid}/password`,'POST',{password:'newpass123',reason:'نسيان'})).s,200);
assert.equal((await user('/me')).j.user,null);
const u2=await cl();assert.equal((await u2('/login','POST',{email:'o2@t.sa',password:'newpass123'})).s,200);
assert.equal((await user('/login','POST',{email:'o2@t.sa',password:'12345678'})).s,401);
assert.equal((await adm('/admin/broadcast','POST',{text:'قصير'})).s,400);
assert.ok((await adm('/admin/broadcast','POST',{text:'صيانة مجدولة الليلة للمنصة',link:'#/'})).j.sent>=1);
});

test('المساعد الذكي: البحث بالمهارات المعتمدة فقط',async()=>{
const anon=await cl();
assert.equal((await anon('/assistant','POST',{message:'أبي كهربائي يصلح قاطع'})).j.needLogin,1);
const u=await cl();await u('/register','POST',{name:'باحث المساعد',email:'ai@t.sa',password:'12345678',terms:1,age:1,phone:ph()}); await u('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'باحث المساعد',phone:ph()}); await vfy(u);
const none=(await u('/assistant','POST',{message:'أبي طباخ يجهز لي عشاء'})).j;
assert.equal(none.category,undefined,'لا تخصص مطابق لعبارة الطبخ');assert.ok(Array.isArray(none.providers));
const r=(await u('/assistant','POST',{message:'أبي كهربائي يصلح قاطع في الرياض بـ 200 ريال'})).j;
assert.equal(r.category,'كهرباء');assert.ok(r.reply.length>5);
const unk=(await u('/assistant','POST',{message:'كيف الطقس اليوم؟'})).j;assert.equal(unk.category,undefined);
assert.equal((await u('/assistant','POST',{message:'مر'})).s,400);
});
test('الأقسام: للمساعدين فقط، ويُختار القسم عند التسجيل',async()=>{
const adm=cl();await adm('/login','POST',{email:'admin@t.sa',password:'12345678'});
const anon=await cl();const cats=(await anon('/skills')).j.categories;const tech=cats.find(c=>c.name==='كهرباء');
const c1=await cl();assert.equal((await c1('/register','POST',{name:'عميل قسم',email:'cat1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),account_type:'client',category_ids:[tech.id]})).s,400);
const c2=await cl();assert.equal((await c2('/register','POST',{name:'عميل قسم',email:'cat2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),account_type:'client'})).s,200);
assert.equal((await c2('/me/sections','POST',{category_ids:[tech.id]})).s,403);
assert.equal((await c2('/me/account-type','POST',{type:'helper',category_ids:[]})).s,400);
assert.equal((await c2('/me/account-type','POST',{type:'helper',helper_type:'establishment',vat_number:'399999999999993',category_ids:[tech.id]})).s,200);
assert.equal((await c2('/me')).j.user.account_type,'helper');
assert.equal((await c2('/me/account-type','POST',{type:'client'})).s,200);
assert.equal((await c2('/me')).j.user.account_type,'client');
assert.equal((await c2('/me/sections','POST',{category_ids:[tech.id]})).s,403);
const u=await cl();
assert.equal((await u('/register','POST',{name:'مصمم تجريبي',email:'sk0@t.sa',password:'12345678',terms:1,age:1,phone:ph(),account_type:'helper',helper_type:'establishment',category_ids:[]})).s,400);
assert.equal((await u('/register','POST',{name:'مصمم تجريبي',email:'sk1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'الرياض',account_type:'helper',helper_type:'establishment',category_ids:[tech.id]})).s,200);
assert.equal((await u('/me')).j.user.account_type,'helper');
assert.equal((await u('/me/sections','POST',{category_ids:[cats[0].id,cats[1].id]})).s,200,'قسمان مسموحان (سباكة وكهرباء)');
assert.equal((await u('/me/sections','POST',{category_ids:[]})).s,400);
assert.equal((await u('/me/sections','POST',{category_ids:[tech.id]})).s,200);
assert.deepEqual([...(await u('/me/sections')).j],[tech.id]);
assert.equal((await u('/assistant','POST',{message:'أبي شخص يصلح بابل'})).j.noMatch,1);
const sug=(await u('/skills/suggest','POST',{category_id:tech.id,name:'تصميم عروض تقديمية',keywords:'بوربوينت، سلايدات'})).j;assert.equal(sug.status,'pending');
assert.equal((await u('/assistant','POST',{message:'أبي بوربوينت فقط'})).j.noMatch,1);
assert.equal((await adm(`/admin/skills/${sug.id}/review`,'POST',{decision:'approve'})).s,200);
await u('/profile','POST',{vat_status:'registered',vat_number:'312345678901234'}); await vfy(u);const hit=(await u('/assistant','POST',{message:'أبي بوربوينت فقط'})).j;
assert.equal(hit.category,'كهرباء');assert.ok(hit.providers.length>=1);
assert.ok((await adm('/admin/failed-searches')).j.some(x=>x.text.includes('بابل')));
assert.equal((await adm(`/admin/sections/${tech.id}/keywords`,'POST',{keywords:'سلايد، تقديمي'})).j.added.length,2);
assert.equal((await adm('/admin/sections/999/keywords','POST',{keywords:'x'})).s,404);
assert.equal((await u(`/admin/sections/${tech.id}/keywords`,'POST',{keywords:'x'})).s,403);
assert.equal((await u('/skills/suggest','POST',{category_id:999,name:'خطأ'})).s,400);
});
test('صفحة المساعد: النبذة والأعمال والتقييمات والبحث القابل للنقر',async()=>{
const PNG3='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const w=await cl();
const cat=(await w('/skills')).j.categories.find(c=>c.name==='سباكة');
await w('/register','POST',{name:'نجار تجريبي',email:'carp@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'الرياض',account_type:'helper',helper_type:'establishment',category_ids:[cat.id]}); await w('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'نجار تجريبي',phone:ph()}); await vfy(w);
const wid=(await w('/me')).j.user.id;
assert.equal((await w('/me/bio','POST',{bio:'نجار بخبرة 10 سنوات في تركيب الأبواب والخزائن'})).s,200);
const at=(await w('/upload','POST',{data:'data:image/png;base64,'+PNG3})).j.id;
assert.equal((await w('/me/portfolio','POST',{attachment_id:at,caption:'باب خشب مصنوع يدويًا'})).s,200);
const pid=(await w('/providers/'+wid)).j;
assert.equal(pid.portfolio[0].kind,'post');const at2=(await w('/upload','POST',{data:'data:image/png;base64,'+PNG3})).j.id;assert.equal((await w('/me/portfolio','POST',{attachment_id:at2,kind:'reel'})).s,400);
assert.equal(pid.bio.includes('10 سنوات'),true);assert.equal(pid.skills[0],'سباكة');assert.equal(pid.portfolio.length,1);
const anon=await cl();assert.equal((await anon('/providers/'+wid)).s,401);
const hit=(await w('/assistant','POST',{message:'أبي سباك يصلح تسريب'})).j;
assert.equal(hit.category,'سباكة');assert.ok(hit.providers.some(x=>x.id===wid));
});

test('الشات المباشر للاستفسار: بدون ربط بالطلب، والصور للمشاركين فقط',async()=>{
const PNG4='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const a=await cl();
await a('/register','POST',{name:'عميل استفسار',email:'inq1@t.sa',password:'12345678',terms:1,age:1,phone:ph()}); await a('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'عميل استفسار',phone:ph()}); await vfy(a);const aid=(await a('/me')).j.user.id;
const b=await cl();await b('/register','POST',{name:'مساعد استفسار',email:'inq2@t.sa',password:'12345678',terms:1,age:1,phone:ph()}); await b('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'مساعد استفسار',phone:ph()}); await vfy(b);const bid=(await b('/me')).j.user.id;
const c3=await cl();await c3('/register','POST',{name:'غريب',email:'inq3@t.sa',password:'12345678',terms:1,age:1,phone:ph()}); await c3('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'غريب',phone:ph()}); await vfy(c3);
assert.equal((await a('/direct/'+bid,'POST',{body:'هل تقدر تنفذ الخدمة يوم الخميس؟'})).s,200);
assert.equal((await b('/direct/'+aid,'POST',{body:'نعم، أقدر'})).s,200);
const thread=(await a('/direct/'+bid)).j;assert.equal(thread.messages.length,2);assert.equal(thread.blocked,false);
const att=(await a('/upload','POST',{data:'data:image/png;base64,'+PNG4})).j.id;
assert.equal((await a('/direct/'+bid,'POST',{body:'',attachment_id:att})).s,400,'الصورة بلا عقد مقبول مرفوضة');
assert.equal((await c3('/files/'+att)).s,403);
assert.equal((await a('/direct/'+aid,'POST',{body:'لنفسي'})).s,400);
await a('/block','POST',{user_id:bid,blocked:true});
assert.equal((await a('/direct/'+bid,'POST',{body:'مرحبا'})).s,403);
});

test('حذف الحساب: يحفظ السجلات ويخفي البيانات الشخصية',async()=>{
const u=await cl();await u('/register','POST',{name:'محذوف تجريبي',email:'del1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'}); await u('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'محذوف تجريبي',phone:ph()}); await vfy(u);
assert.equal((await u('/me/delete','POST',{password:'12345678',confirm:'لا'})).s,400);
assert.equal((await u('/me/delete','POST',{password:'كلمة خاطئة',confirm:'حذف'})).s,403);
assert.equal((await u('/me/delete','POST',{password:'12345678',confirm:'حذف'})).s,200);
const v=await cl();assert.equal((await v('/login','POST',{email:'del1@t.sa',password:'12345678'})).s,401);
});

test('استعادة كلمة المرور: رمز لمرة واحدة ومدة محددة',async()=>{
const u=await cl();await u('/register','POST',{name:'نسيت',email:'fg1@t.sa',password:'12345678',terms:1,age:1,phone:ph()}); await u('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'نسيت',phone:ph()}); await vfy(u);
const uid=(await u('/me')).j.user.id;const x=await cl();
assert.equal((await x('/forgot','POST',{email:'fg1@t.sa'})).s,200);
assert.equal((await x('/forgot','POST',{email:'nobody@t.sa'})).s,200);
const db=new DatabaseSync(DBF);
const raw='b'.repeat(64),old='c'.repeat(64);
db.prepare("INSERT INTO password_resets(user_id,token_hash,expires_at) VALUES(?,?,datetime('now','+30 minutes'))").run(uid,createHash('sha256').update(raw).digest('hex'));
db.prepare("INSERT INTO password_resets(user_id,token_hash,expires_at) VALUES(?,?,datetime('now','-1 minutes'))").run(uid,createHash('sha256').update(old).digest('hex'));
db.close();
assert.equal((await x('/reset','POST',{token:old,password:'newpass999'})).s,400);
assert.equal((await x('/reset','POST',{token:'zz',password:'newpass999'})).s,400);
assert.equal((await x('/reset','POST',{token:raw,password:'قصير'})).s,400);
assert.equal((await x('/reset','POST',{token:raw,password:'newpass999'})).s,200);
assert.equal((await x('/reset','POST',{token:raw,password:'another999'})).s,400);
assert.equal((await x('/login','POST',{email:'fg1@t.sa',password:'newpass999'})).s,200);
assert.equal((await x('/login','POST',{email:'fg1@t.sa',password:'12345678'})).s,401);
});

test('لا تُجمع أرقام الحسابات البنكية من المستخدم',async()=>{
const c=await cl();await c('/register','POST',{name:'خصوصية تجريبية',email:'priv1@t.sa',password:'12345678',terms:1,age:1,phone:ph()}); await c('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'خصوصية تجريبية',phone:ph()}); await vfy(c);
await c('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'خصوصية تجريبية',iban:'SA0380000000608010167519',address:'الرياض، حي النخيل',phone:'0500000111'}); await vfy(c);
const me=(await c('/me')).j.user;assert.equal(me.iban,undefined);assert.equal(me.address,'الرياض، حي النخيل');assert.equal(me.phone,'0500000111');
});

test('لا تُجمع رقم الهوية من المستخدم',async()=>{
const c=await cl();await c('/register','POST',{name:'بلا هوية',email:'nid1@t.sa',password:'12345678',terms:1,age:1,phone:ph()}); await c('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'بلا هوية',phone:ph()}); await vfy(c);
await c('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'بلا هوية',national_id:'1098700001',phone:'0500000222'}); await vfy(c);
const me=(await c('/me')).j.user;assert.equal(me.national_id,undefined);assert.equal(me.phone,'0500000222');
});

test('التحقق من البريد: الرابط المزيف مرفوض، وإعادة الإرسال للحساب المفعّل لا تفشل',async()=>{
const c=await cl();await c('/register','POST',{name:'تحقق بريد',email:'ev1@t.sa',password:'12345678',terms:1,age:1,phone:ph()}); await c('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'تحقق بريد',phone:ph()}); await vfy(c);
assert.equal((await c('/verify-email','POST',{token:'x'})).s,400);
assert.equal((await c('/verify-email','POST',{token:'a'.repeat(64)})).s,400);
assert.equal((await c('/me/resend-verification','POST')).s,200);
});

test('تغيير البريد: يتطلب كلمة المرور، ويرفض البريد المكرر',async()=>{
const c=await cl();await c('/register','POST',{name:'تغيير بريد',email:'chg1@t.sa',password:'12345678',terms:1,age:1,phone:ph()});
await c('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'تغيير بريد',phone:'0500000555'}); await vfy(c);
assert.equal((await c('/me/email','POST',{email:'chg2@t.sa',password:'wrong-pass'})).s,401);
assert.equal((await c('/me/email','POST',{email:'ليس-بريدا',password:'12345678'})).s,400);
assert.equal((await c('/me/email','POST',{email:'chg2@t.sa',password:'12345678'})).s,200);
assert.equal((await c('/me')).j.user.email,'chg2@t.sa');
const other=await cl();await other('/register','POST',{name:'آخر',email:'chg3@t.sa',password:'12345678',terms:1,age:1,phone:ph()});
assert.equal((await c('/me/email','POST',{email:'chg3@t.sa',password:'12345678'})).s,409);
});

test('فشل إرسال البريد يظهر للمستخدم، ولا يُخفى',async()=>{
const c=await cl();await c('/register','POST',{name:'فشل بريد',email:'mf1@t.sa',password:'12345678',terms:1,age:1,phone:ph()});
const db=new DatabaseSync(DBF);db.prepare('UPDATE users SET email_verified=0 WHERE email=?').run('mf1@t.sa');db.close();
const r=await c('/me/resend-verification','POST');
assert.equal(r.s,503);
assert.match(r.j.error,/تعذّر إرسال البريد/);
});

test('النسخ الاحتياطي التلقائي: ينشئ نسخًا ويحذف القديم',async()=>{
const dir='/tmp/bk'+Date.now();const dbf='/tmp/bkdb'+Date.now()+'.db';
const srv3=spawn('node',['server.js'],{env:{...process.env,RESEND_API_KEY:'',PORT:3995,DB_FILE:dbf,BACKUP_DIR:dir,BACKUP_EVERY_SECONDS:'60',BACKUP_KEEP:'2',ADMIN_EMAIL:'admin@t.sa',ADMIN_SETUP_TOKEN:'test-token'},stdio:'ignore'});
try{
await new Promise(r=>setTimeout(r,1000));
const names=()=>existsSync(dir)?readdirSync(dir).filter(x=>/^backup-.*\.db$/.test(x)):[];
const deadline=Date.now()+25000;while(names().length<1&&Date.now()<deadline)await new Promise(r=>setTimeout(r,300));
assert.equal(names().length,1);
assert.equal(statSync(join(dir,names()[0])).mode&0o777,0o600);
const ok=names()[0];const db=new DatabaseSync(join(dir,ok));assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name='users'").get());db.close();
}finally{srv3.kill()}
});

test('محاولات الدخول الفاشلة تُحفظ في قاعدة البيانات، وتُحجب بعد 8',async()=>{
const c=await cl();await c('/register','POST',{name:'محاولات دخول',email:'lg1@t.sa',password:'12345678',terms:1,age:1,phone:ph()});
for(let i=0;i<8;i++)assert.equal((await cl()('/login','POST',{email:'lg1@t.sa',password:'wrong-pass'})).s,401);
assert.equal((await cl()('/login','POST',{email:'lg1@t.sa',password:'12345678'})).s,429);
const db=new DatabaseSync(DBF);const row=db.prepare("SELECT n FROM login_attempts WHERE k LIKE ?").get('%|lg1@t.sa');db.close();
assert.equal(row.n,8);
});

test('عمليات البحث الفاشلة: تُنظَّف من الأرقام والبريد قبل الحفظ',async()=>{
const c=await cl();await c('/register','POST',{name:'تنظيف بحث',email:'fs1@t.sa',password:'12345678',terms:1,age:1,phone:ph()});
assert.equal((await c('/assistant','POST',{message:'أبي شخص يساعدني 0501234567 على mail: fs.person@example.com'})).j.noMatch,1);
const db=new DatabaseSync(DBF);const row=db.prepare("SELECT text FROM failed_searches WHERE text LIKE '%يساعدني%' ORDER BY id DESC LIMIT 1").get();db.close();
assert.ok(row);assert.ok(!row.text.includes('0501234567'));assert.ok(!row.text.includes('@'));assert.ok(row.text.includes('[رقم]'));
});

test('الحد على الدخول لا يُتجاوز بتزوير رأس X-Forwarded-For دون وكيل موثوق',async()=>{
const c=await cl();await c('/register','POST',{name:'تزوير رأس',email:'xff1@t.sa',password:'12345678',terms:1,age:1,phone:ph()});
for(let i=0;i<8;i++){const r=await fetch(B+'/api/login',{method:'POST',headers:{'content-type':'application/json','x-forwarded-for':'10.0.0.'+i},body:JSON.stringify({email:'xff1@t.sa',password:'wrong-pass'})});assert.equal(r.status,401)}
const last=await fetch(B+'/api/login',{method:'POST',headers:{'content-type':'application/json','x-forwarded-for':'10.9.9.9'},body:JSON.stringify({email:'xff1@t.sa',password:'12345678'})});
assert.equal(last.status,429);
});

test('القسم: المساعد يختار قسمًا واحدًا، ويظهر في صفحته',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='سباكة');
const c=await cl();await c('/register','POST',{name:'قسم واحد',email:'sp1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',helper_type:'establishment',category_ids:[cat.id,cat.id+1]}).then(()=>{});
const r=await c('/register','POST',{name:'قسم واحد ب',email:'sp2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',helper_type:'establishment',category_ids:[cat.id]});assert.equal(r.s,200);
assert.deepEqual([...(await c('/me/sections')).j],[cat.id]);
{const d0=new DatabaseSync(DBF);if(!d0.prepare("SELECT 1 x FROM skill_categories WHERE name='قسم ثالث للاختبار'").get())d0.prepare("INSERT INTO skill_categories(name,sort) VALUES('قسم ثالث للاختبار',99)").run();d0.close()}
const all3=(await cl()('/skills')).j.categories.slice(0,3).map(x=>x.id);assert.equal(all3.length,3);
assert.equal((await c('/me/sections','POST',{category_ids:all3.slice(0,2)})).s,200,'قسمان مسموحان');
assert.deepEqual([...(await c('/me/sections')).j].sort(),all3.slice(0,2).sort());
assert.equal((await c('/me/sections','POST',{category_ids:all3})).s,400,'ثلاثة أقسام مرفوضة');{const d1=new DatabaseSync(DBF);d1.prepare("DELETE FROM skill_categories WHERE name='قسم ثالث للاختبار'").run();d1.close()}
});
test('الامتثال: التسجيل يتطلب تأكيد العمر، ويُحفظ إصدار الشروط، والتصدير يعيد بيانات المستخدم',async()=>{
const c=await cl();assert.equal((await c('/register','POST',{name:'امتثال تجريبي',email:'cp1@t.sa',password:'12345678',terms:1})).s,400);
assert.equal((await c('/register','POST',{name:'امتثال تجريبي',email:'cp1@t.sa',password:'12345678',terms:1,age:1,phone:ph()})).s,200);
const ex=(await c('/me/export')).j;assert.equal(ex.profile.email,'cp1@t.sa');assert.equal(ex.profile.terms_version,'2026-12');assert.ok(Array.isArray(ex.direct_messages));
});

test('الاتفاق في المحادثة: يقترحه طرف، ويعتمده الطرف الآخر فقط',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='سباكة').id;
const o=await cl();await o('/register','POST',{name:'عميل اتفاق',email:'ag1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});
await o('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'عميل اتفاق',phone:'0500000991'}); await vfy(o);
const h=await cl();await h('/register','POST',{name:'مساعد اتفاق',email:'ag2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',helper_type:'establishment',category_ids:[cat]});
await h('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'مساعد اتفاق',phone:'0500000992'}); await vfy(h);
const hid=(await h('/me')).j.user.id;const oid=(await o('/me')).j.user.id;
assert.equal((await o(`/direct/${hid}/agreements`,'POST',{amount:0,description:'تركيب باب'})).s,400);
const r=await o(`/direct/${hid}/agreements`,'POST',{amount:150,description:'تركيب باب خشب'});assert.equal(r.s,200);
const aid=r.j.id;
assert.ok((await h('/notifications')).j.some(n=>String(n.text).includes('اقترح عليك اتفاقًا')&&n.link==='#/direct/'+oid),'اقتراح الاتفاق يصل المساعد كإشعار داخلي (ومنه الدفع) وليس بالبريد فقط');
assert.equal((await o(`/agreements/${aid}/approve`,'POST')).s,403,'المقترح لا يعتمد اتفاقه بنفسه');
assert.equal((await h(`/agreements/${aid}/approve`,'POST')).s,200);
const list=(await o(`/direct/${hid}/agreements`)).j;assert.equal(list[0].status,'agreed');
assert.equal((await h(`/agreements/${aid}/cancel`,'POST')).s,400,'لا يُلغى اتفاق مكتمل');
});

test('عمولة الاتفاق: تظهر للمساعد فقط',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='سباكة').id;
const o=await cl();await o('/register','POST',{name:'عميل عمولة',email:'cm1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});
await o('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'عميل عمولة',phone:'0500000881'}); await vfy(o);
const h=await cl();await h('/register','POST',{name:'مساعد عمولة',email:'cm2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',helper_type:'establishment',category_ids:[cat]});
backdateHelper('cm2@t.sa');
await h('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'مساعد عمولة',phone:'0500000882'}); await vfy(h);
const hid=(await h('/me')).j.user.id;
const aid=(await o(`/direct/${hid}/agreements`,'POST',{amount:200,description:'تركيب نافذة'})).j.id;
await h(`/agreements/${aid}/approve`,'POST');await h(`/agreements/${aid}/request-completion`,'POST');await o(`/agreements/${aid}/confirm-completion`,'POST');await payHala(aid);
const forH=(await h(`/direct/${(await o('/me')).j.user.id}/agreements`)).j[0];
const forO=(await o(`/direct/${hid}/agreements`)).j[0];
assert.equal(typeof forH.commission,'number','المساعد يرى العمولة');
assert.equal(forO.commission,undefined,'العميل لا يرى العمولة');
});

test('محفظة المساعد: العمولة تُخصم تلقائيًا عند الدفع',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='سباكة').id;
const o=await cl();await o('/register','POST',{name:'عميل محفظة',email:'wl1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});
await o('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'عميل محفظة',phone:'0500000771'}); await vfy(o);
const h=await cl();await h('/register','POST',{name:'مساعد محفظة',email:'wl2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',helper_type:'establishment',category_ids:[cat]});
backdateHelper('wl2@t.sa');
await h('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'مساعد محفظة',phone:'0500000772'}); await vfy(h);
const hid=(await h('/me')).j.user.id;
const aid=(await o(`/direct/${hid}/agreements`,'POST',{amount:300,description:'تركيب مكيف'})).j.id;
await h(`/agreements/${aid}/approve`,'POST');await h(`/agreements/${aid}/request-completion`,'POST');await o(`/agreements/${aid}/confirm-completion`,'POST');await payHala(aid);
const w=(await h('/wallet')).j;assert.equal(w.agr_due,0,'العمولة تُخصم عند الدفع فلا رصيد مستحق');
const dRow=(()=>{const d=new DatabaseSync(DBF);const r=d.prepare('SELECT amount,status FROM agreement_commissions WHERE agreement_id=?').get(aid);d.close();return r})();
assert.equal(dRow.status,'paid');assert.equal(dRow.amount,6,'العمولة 2% من 300');
});

test('رؤوس الأمان: سياسة المحتوى موجودة على الصفحة الرئيسية',async()=>{
const r=await fetch(B+'/');const csp=r.headers.get('content-security-policy')||'';
assert.match(csp,/default-src 'self'/);assert.match(csp,/frame-ancestors 'none'/);
assert.equal(r.headers.get('x-frame-options'),'DENY');
});
test('تغيير البريد ينهي الجلسات الأخرى ويبقي الحالية',async()=>{
const c1=await cl();await c1('/register','POST',{name:'جلسات متعددة',email:'se1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});
const c2=await cl();await c2('/login','POST',{email:'se1@t.sa',password:'12345678'});
assert.ok((await c2('/me')).j.user,'الجلسة الثانية تعمل قبل التغيير');
assert.equal((await c1('/me/email','POST',{email:'se2@t.sa',password:'12345678'})).s,200);
assert.ok(!(await c2('/me')).j.user,'الجلسة الأخرى يجب أن تنتهي');
assert.equal((await c1('/me')).j.user.email,'se2@t.sa','الجلسة الحالية تبقى');
});
test('حد التسجيل: يُرفض بعد تجاوز العدد المسموح',async()=>{
const srv=spawn('node',['server.js'],{env:{...process.env,RESEND_API_KEY:'',REGISTER_PER_HOUR:'2',PORT:3994,DB_FILE:'/tmp/rl'+Date.now()+'.db',ADMIN_EMAIL:'admin@t.sa',ADMIN_SETUP_TOKEN:'x'},stdio:'ignore'});
try{await new Promise(r=>setTimeout(r,1200));
const post=(email)=>fetch('http://localhost:3994/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'حد تسجيل',email,password:'12345678',terms:1,age:1,phone:ph()})});
assert.equal((await post('rl1@t.sa')).status,200);assert.equal((await post('rl2@t.sa')).status,200);
assert.equal((await post('rl3@t.sa')).status,429);
}finally{srv.kill()}
});

test('التحقق من البريد: يرفض رموز HTML في العنوان',async()=>{
const c=await cl();
assert.equal((await c('/register','POST',{name:'بريد آمن',email:'<img src=x>@t.sa',password:'12345678',terms:1,age:1,phone:ph()})).s,400);
assert.equal((await c('/register','POST',{name:'بريد آمن',email:'ok@t.sa',password:'12345678',terms:1,age:1,phone:ph()})).s,200);
});

test('الاستعادة: معاينة نسخة صالحة، ترفض الملفات غير الصالحة وكلمة التأكيد الخاطئة',async()=>{
const adm=cl();await adm('/login','POST',{email:'admin@t.sa',password:'12345678'});
const bytes=await (await fetch(B+'/api/admin/backup',{headers:{cookie:(await (async()=>{const r=await fetch(B+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'admin@t.sa',password:'12345678'})});return r.headers.get('set-cookie').split(';')[0]})())}})).arrayBuffer();
const b64=Buffer.from(bytes).toString('base64');
const pv=await adm('/admin/restore/preview','POST',{data:b64});assert.equal(pv.s,200);assert.ok(pv.j.counts.users>=1,'المعاينة تعرض عدد المستخدمين');
assert.equal((await adm('/admin/restore/preview','POST',{data:Buffer.from('not a db at all, plain text here....').toString('base64')})).s,400,'ملف غير قاعدة بيانات يُرفض');
assert.equal((await adm('/admin/restore/apply','POST',{confirm:'خطأ'})).s,400,'التأكيد الخاطئ يُرفض');
assert.equal((await adm('/admin/restore/cancel','POST')).s,200);
assert.equal((await adm('/admin/restore/apply','POST',{confirm:'استعادة'})).s,400,'لا تطبيق بعد الإلغاء');
});

test('استعادة بالرمز: 6 أرقام، محدودة المحاولات، ثم كلمة مرور جديدة',async()=>{
const c=await cl();await c('/register','POST',{name:'رمز استعادة',email:'otp1@t.sa',password:'12345678',terms:1,age:1,phone:ph()});
const uid=(await c('/me')).j.user.id;
await c('/logout','POST');
await cl()('/forgot','POST',{email:'otp1@t.sa'});
const db=new DatabaseSync(DBF);const row=db.prepare('SELECT code_hash FROM reset_codes WHERE user_id=?').get(uid);db.close();
assert.ok(row,'الرمز محفوظ');
const sh=s=>createHash('sha256').update(s).digest('hex');
const code='482193';
const db2=new DatabaseSync(DBF);db2.prepare('UPDATE reset_codes SET code_hash=?,attempts=0 WHERE user_id=?').run(macFor(DBF,code+':'+uid),uid);db2.close();
const x=cl();
assert.equal((await x('/reset-code','POST',{email:'otp1@t.sa',code:'000000'})).s,400);
assert.equal((await x('/reset-code','POST',{email:'otp1@t.sa',code})).s,200,'الرمز الصحيح يعمل');
const t=(await x('/reset-code','POST',{email:'otp1@t.sa',code})).j;assert.equal(t.s,undefined);
});

test('الرمز المكوّن من 6 أرقام يُقفل بعد 5 محاولات خاطئة',async()=>{
const c=await cl();await c('/register','POST',{name:'قفل الرمز',email:'lock1@t.sa',password:'12345678',terms:1,age:1,phone:ph()});
const uid=(await c('/me')).j.user.id;const sh=s=>createHash('sha256').update(s).digest('hex');
const db=new DatabaseSync(DBF);db.prepare("INSERT OR REPLACE INTO reset_codes(user_id,code_hash,expires_at,attempts) VALUES(?,?,datetime('now','+10 minutes'),0)").run(uid,macFor(DBF,'777777:'+uid));db.close();
const x=cl();
for(let i=0;i<5;i++)assert.equal((await x('/reset-code','POST',{email:'lock1@t.sa',code:'000000'})).s,400);
assert.equal((await x('/reset-code','POST',{email:'lock1@t.sa',code:'777777'})).s,400,'بعد 5 محاولات حتى الرمز الصحيح لا يعمل');
});

test('تفعيل البريد بالرمز: الرمز الصحيح يفعّل، والخاطئ يُقفل بعد 5 محاولات',async()=>{
const c=await cl();await c('/register','POST',{name:'تفعيل بالرمز',email:'vc1@t.sa',password:'12345678',terms:1,age:1,phone:ph()});
const uid=(await c('/me')).j.user.id;const sh=s=>createHash('sha256').update(s).digest('hex');
const db=new DatabaseSync(DBF);db.prepare('UPDATE users SET email_verified=0 WHERE id=?').run(uid);
db.prepare("INSERT OR REPLACE INTO verify_codes(user_id,code_hash,expires_at,attempts) VALUES(?,?,datetime('now','+10 minutes'),0)").run(uid,macFor(DBF,'314159:'+uid));db.close();
for(let i=0;i<5;i++)assert.equal((await c('/verify-code','POST',{code:'000000'})).s,400);
assert.equal((await c('/verify-code','POST',{code:'314159'})).s,400,'بعد 5 محاولات يُقفل');
const db2=new DatabaseSync(DBF);db2.prepare("UPDATE verify_codes SET attempts=0 WHERE user_id=?").run(uid);db2.close();
assert.equal((await c('/verify-code','POST',{code:'314159'})).s,200,'الرمز الصحيح يفعّل');
assert.equal((await c('/me')).j.user.email_verified,1);
});

test('تغيير كلمة المرور: يتحقق من الحالية، ويُنهي الجلسات الأخرى',async()=>{
const c=await cl();await c('/register','POST',{name:'كلمة مرور',email:'pwc1@t.sa',password:'12345678',terms:1,age:1,phone:ph()});
const other=cl();await other('/login','POST',{email:'pwc1@t.sa',password:'12345678'});
assert.equal((await c('/me/password','POST',{current:'خطأ-كلمة',password:'newpass999'})).s,401);
assert.equal((await c('/me/password','POST',{current:'12345678',password:'short'})).s,400);
assert.equal((await c('/me/password','POST',{current:'12345678',password:'newpass999'})).s,200);
assert.ok(!(await other('/me')).j.user,'الجلسة الأخرى تنتهي');
assert.ok((await c('/me')).j.user,'الجلسة الحالية تبقى');
assert.equal((await cl()('/login','POST',{email:'pwc1@t.sa',password:'newpass999'})).s,200,'الدخول بالجديدة يعمل');
assert.equal((await cl()('/login','POST',{email:'pwc1@t.sa',password:'12345678'})).s,401,'القديمة لا تعمل');
});

test('نموذج التواصل: يحفظ الرسالة، ويرفض البيانات الناقصة',async()=>{
const c=cl();
assert.equal((await c('/contact','POST',{name:'أ',email:'x@t.sa',body:'قصيرة'})).s,400);
assert.equal((await c('/contact','POST',{name:'زائر تواصل',email:'visitor@t.sa',body:'أريد الاستفسار عن طريقة الدفع'})).s,200);
const db=new DatabaseSync(DBF);const row=db.prepare("SELECT name FROM contact_messages WHERE email='visitor@t.sa'").get();db.close();
assert.ok(row,'الرسالة محفوظة');
});

test('رسائل التواصل: تظهر للمدير، ويمكن حذفها',async()=>{
const admin=cl();await admin('/login','POST',{email:'admin@t.sa',password:'12345678'});
const list=(await admin('/admin/contact-messages')).j;const m=list.find(x=>x.email==='visitor@t.sa');
assert.ok(m,'الرسالة تظهر للمدير');
assert.equal((await admin(`/admin/contact-messages/${m.id}/delete`,'POST')).s,200);
assert.ok(!(await admin('/admin/contact-messages')).j.find(x=>x.id===m.id),'تُحذف بعد الحذف');
assert.notEqual((await cl()('/admin/contact-messages')).s,200,'الزائر لا يرى الرسائل');
});

test('إدارة الموقع: قائمة المستخدمين والأقسام وحذف كلمة مفتاحية',async()=>{
const admin=cl();await admin('/login','POST',{email:'admin@t.sa',password:'12345678'});
const users=(await admin('/admin/users?q=admin')).j;assert.ok(users.find(u=>u.email==='admin@t.sa'),'البحث يجد المدير');
const cats=(await admin('/admin/categories')).j;assert.equal(cats.length,2,'قسمان فقط: سباكة وكهرباء');assert.ok(Array.isArray(cats[0].words)&&cats[0].words.length>0);
const cat=cats.find(c=>c.name==='سباكة');const w=cat.words[0];
assert.equal((await admin(`/admin/sections/${cat.id}/keywords/remove`,'POST',{word:w})).s,200);
assert.ok(!(await admin('/admin/categories')).j.find(c=>c.id===cat.id).words.includes(w),'الكلمة حُذفت');
assert.equal((await cl()('/admin/users')).s,401,'الزائر لا يرى المستخدمين');
});

test('المرحلة الثالثة: المحادثات المبلَّغ عنها والتقييمات، ومحمية من غير المدير',async()=>{
const admin=cl();await admin('/login','POST',{email:'admin@t.sa',password:'12345678'});
assert.equal((await admin('/admin/reports/999999/conversation')).s,404);
});

test('المرحلة الرابعة: النقاط يدويًا مع منع الرصيد السالب، والنمو',async()=>{
const admin=cl();await admin('/login','POST',{email:'admin@t.sa',password:'12345678'});
const u=(await admin('/admin/users?q=admin')).j.find(x=>x.email==='admin@t.sa');
assert.equal((await admin(`/admin/users/${u.id}/points`,'POST',{delta:50,reason:'مكافأة تجريبية'})).s,200);
assert.equal((await admin(`/admin/users/${u.id}/points`,'POST',{delta:-999999,reason:'خصم كبير'})).s,400);
assert.equal((await admin(`/admin/users/${u.id}/points`,'POST',{delta:-40,reason:'تعديل'})).s,200);
assert.equal((await admin('/admin/points?q=admin')).j.find(x=>x.id===u.id).balance,10,'الرصيد 50-40');
assert.ok(Array.isArray((await admin('/admin/growth')).j.users));
assert.equal((await cl()('/admin/points')).s,401);
});

test('الموظفون: صلاحيات محددة، والمالية والدعم لا تتداخلان، والإدارة للمدير فقط',async()=>{
const admin=cl();await admin('/login','POST',{email:'admin@t.sa',password:'12345678'});
const st=cl();await st('/register','POST',{name:'موظف مالي',email:'stf1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});
const sid=(await st('/me')).j.user.id;
assert.equal((await admin('/admin/staff','POST',{email:'stf1@t.sa',perms:['finance']})).s,200);
assert.equal((await st('/admin/agreement-commissions')).s,200,'المالية تصل للعمولات');
assert.equal((await st('/admin/reports')).s,403,'المالية لا تصل للشكاوى');
assert.equal((await st('/admin/stats')).s,403,'الإحصاءات للمدير فقط');
assert.equal((await st('/admin/users/'+sid+'/role','POST',{role:'admin'})).s,403,'لا تغيير أدوار');
assert.equal((await admin('/admin/staff','POST',{email:'stf1@t.sa',perms:[]})).s,200);
assert.equal((await st('/admin/agreement-commissions')).s,403,'بعد إزالة الصلاحيات ينتهي الوصول');
});

test('مختبر الطلبات: يميّز عبارة بلا تخصص من عبارة بلا مساعد، ويجمع التكرار، ويحصر الوصول للمدير',async()=>{
const cats=(await cl()('/skills')).j.categories;const cat=cats.find(c=>c.name==='سباكة');
const askc=cl();await askc('/register','POST',{name:'باحث مختبر',email:'askl1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});
const admin=cl();await admin('/login','POST',{email:'admin@t.sa',password:'12345678'});
assert.equal((await askc('/assistant','POST',{message:'أبي زرنيخ بلورات كوكبية'})).j.noMatch,1,'بلا تخصص');
await askc('/assistant','POST',{message:'أبي زرنيخ بلورات كوكبية'});
await askc('/assistant','POST',{message:'أبي سباك مختلف في أبها'});
const list=(await admin('/admin/failed-searches')).j;
const none=list.find(x=>x.text.includes('زرنيخ بلورات'));
assert.equal(none.reason,'no_category');assert.equal(none.n,2,'التكرار يُجمع');
const np=list.find(x=>x.text.includes('سباك مختلف'));
assert.equal(np.reason,'no_provider','تخصص مطابق بلا مساعد');assert.equal(np.category,'سباكة');assert.equal(np.city,'أبها');
assert.equal((await cl()('/admin/failed-searches')).s,401,'غير المدير لا يقرأ المختبر');
});
test('مختبر الطلبات: مساعد مناسب لا ينشئ سجلًا، وتنظيف الجوال والبريد',async()=>{
const cats=(await cl()('/skills')).j.categories;const cat=cats.find(c=>c.name==='سباكة');
const adm0=cl();await adm0('/login','POST',{email:'admin@t.sa',password:'12345678'});assert.equal((await adm0('/admin/cities/open','POST',{city:'جدة'})).s,200,'فتح المدينة يدويًا');
const askc=cl();await askc('/register','POST',{name:'باحث مختبر ٢',email:'askl2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});
const hp=cl();await hp('/register','POST',{name:'نجار مختبر',email:'lab1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',helper_type:'establishment',category_ids:[cat.id]});
await hp('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'نجار مختبر',phone:'0500007777'}); await vfy(hp);await hp('/pledge','POST',{accept:true,name:'نجار مختبر'});
const dbx=new DatabaseSync(DBF);dbx.prepare("UPDATE users SET email_verified=1 WHERE email='lab1@t.sa'").run();dbx.close();
const cnt=()=>{const d=new DatabaseSync(DBF);const n=d.prepare("SELECT COUNT(*) n FROM failed_searches WHERE text LIKE '%باب مختبر%'").get().n;d.close();return n};
const nb=cnt();
const ok=(await askc('/assistant','POST',{message:'أبي سباك يصلح تسريب مختبر في جدة'})).j;
assert.ok(ok.providers.length>0,'يجد المساعد المناسب');
assert.equal(cnt(),nb,'لا سجل عند وجود مساعد');
await askc('/assistant','POST',{message:'أبي زرنيخ 0501234567 و test@mail.com'});
const admin=cl();await admin('/login','POST',{email:'admin@t.sa',password:'12345678'});
const scrub=(await admin('/admin/failed-searches')).j.find(x=>x.text.includes('زرنيخ'));
assert.ok(scrub,'السجل موجود');assert.ok(!/\d{5}|@/.test(scrub.text),'لا أرقام ولا بريد: '+scrub.text);
});
test('مختبر الطلبات: إضافة كلمة بعد الموافقة تجعل المطابقة تعمل، بلا تكرار',async()=>{
const cats=(await cl()('/skills')).j.categories;const cat=cats.find(c=>c.name==='سباكة');
const askc=cl();await askc('/register','POST',{name:'باحث مختبر ٣',email:'askl3@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});
const admin=cl();await admin('/login','POST',{email:'admin@t.sa',password:'12345678'});
const pre=(await askc('/assistant','POST',{message:'أبي زرنيخ بلورات كوكبية'})).j;assert.equal(pre.noMatch,1,'قبل الإضافة: '+JSON.stringify(pre));
assert.equal((await admin(`/admin/sections/${cat.id}/keywords`,'POST',{keywords:'زرنيخ بلورات كوكبية'})).s,200);
assert.equal((await askc('/assistant','POST',{message:'أبي زرنيخ بلورات كوكبية'})).j.category,'سباكة','المطابقة تعمل بعد الإضافة');
await admin(`/admin/sections/${cat.id}/keywords`,'POST',{keywords:'زرنيخ بلورات كوكبية'});
const words=(await admin('/admin/categories')).j.find(c=>c.id===cat.id).words;
assert.equal(words.filter(w=>w.startsWith('زرنيخ')).length,1,'لا تكرار للكلمة');
});

test('الاستحقاق: العمولة بعد التأكيد فقط، والاعتراض يمنعها، وصلاحيات الطرفين',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='سباكة').id;
const o=cl();await o('/register','POST',{name:'عميل استحقاق',email:'es1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});
await o('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'عميل استحقاق',phone:'0500005001'}); await vfy(o);
const h=cl();await h('/register','POST',{name:'مساعد استحقاق',email:'es2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',helper_type:'establishment',category_ids:[cat]});
await h('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'مساعد استحقاق',phone:'0500005002'}); await vfy(h);
const hid=(await h('/me')).j.user.id;
const S={bank_name:'بنك',account_name:'مؤسسة المساعد',iban:'SA0380000000608010167519',commission_percent:2,commission_grace_days:3};
const admin=cl();await admin('/login','POST',{email:'admin@t.sa',password:'12345678'});await admin('/admin/settings','POST',S);
const commOf=async()=>{const d=new DatabaseSync(DBF);const r=d.prepare('SELECT COUNT(*) n FROM agreement_commissions c JOIN agreements g ON g.id=c.agreement_id WHERE (g.a_id=? OR g.b_id=?) AND c.amount>0').get(hid,hid).n;d.close();return r};
const before=await commOf();
const a1=(await o(`/direct/${hid}/agreements`,'POST',{amount:500,description:'اختبار الاستحقاق'})).j.id;
await h(`/agreements/${a1}/approve`,'POST');
assert.equal(await commOf(),before,'لا عمولة عند الاعتماد');
assert.equal((await o(`/agreements/${a1}/request-completion`,'POST')).s,403,'العميل لا يطلب التأكيد');
assert.equal((await h(`/agreements/${a1}/confirm-completion`,'POST')).s,403,'المساعد لا يؤكد');
await h(`/agreements/${a1}/request-completion`,'POST');
assert.equal(await commOf(),before,'لا عمولة قبل تأكيد العميل');
await o(`/agreements/${a1}/confirm-completion`,'POST');await payHala(a1);
assert.equal(await commOf(),before+1,'بلا شهر مجاني: العمولة تُنشأ عند التأكيد والسداد');
const d1=new DatabaseSync(DBF);d1.prepare("UPDATE users SET created_at=datetime('now','-40 days') WHERE id=?").run(hid);d1.close();
const a2=(await o(`/direct/${hid}/agreements`,'POST',{amount:400,description:'اختبار الاعتراض'})).j.id;
await h(`/agreements/${a2}/approve`,'POST');await h(`/agreements/${a2}/request-completion`,'POST');
assert.equal((await o(`/agreements/${a2}/dispute`,'POST')).s,200,'الاعتراض يتم');
assert.equal((await o(`/agreements/${a2}/confirm-completion`,'POST')).s,400,'لا تأكيد بعد الاعتراض');
assert.equal(await commOf(),before+1,'الاعتراض يمنع عمولة الاتفاق الثاني، والأول فقط مُنشأ');
});

test('حل النزاع: قرار أولي من مسؤول غير طرف، ثم مراجعة من مسؤول آخر، والعمولة لا تُنشأ إلا عند ثبوت الإنجاز',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='سباكة').id;
const o=cl();await o('/register','POST',{name:'عميل نزاع',email:'dsp1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});
await o('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'عميل نزاع',phone:'0500006001'}); await vfy(o);
const h=cl();await h('/register','POST',{name:'مساعد نزاع',email:'dsp2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',helper_type:'establishment',category_ids:[cat]});
await h('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'مساعد نزاع',phone:'0500006002'}); await vfy(h);
const hid=(await h('/me')).j.user.id;
const d0=new DatabaseSync(DBF);d0.prepare("UPDATE users SET created_at=datetime('now','-40 days') WHERE id=?").run(hid);d0.close();
const admin=cl();await admin('/login','POST',{email:'admin@t.sa',password:'12345678'});
await admin('/admin/settings','POST',{bank_name:'بنك',account_name:'مؤسسة المساعد',iban:'SA0380000000608010167519',commission_percent:2,commission_grace_days:3});

const s1=cl();await s1('/register','POST',{name:'موظف مستقل',email:'dsp4@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});const sr=await admin('/admin/staff','POST',{email:'dsp4@t.sa',perms:['support']});assert.equal(sr.s,200,'تعيين الموظف المستقل');await s1('/login','POST',{email:'dsp4@t.sa',password:'12345678'});
const aid=(await o(`/direct/${hid}/agreements`,'POST',{amount:600,description:'نزاع اختبار'})).j.id;
await h(`/agreements/${aid}/approve`,'POST');await h(`/agreements/${aid}/request-completion`,'POST');await o(`/agreements/${aid}/dispute`,'POST');{const dq=new DatabaseSync(DBF);dq.close();}
const cnt=()=>{const d=new DatabaseSync(DBF);const n=d.prepare('SELECT COUNT(*) n FROM agreement_commissions WHERE agreement_id=? AND amount>0').get(aid).n;d.close();return n};
assert.equal(cnt(),0,'لا عمولة أثناء النزاع');
assert.equal((await o(`/admin/disputes/${aid}/decide`,'POST',{decision:'completed',note:'محاولة'})).s,403,'العميل لا يفصل');
const dr=await s1('/admin/disputes/'+aid+'/decide','POST',{decision:'completed',note:'قرار أولي'});assert.equal(dr.s,200,'مسؤول غير طرف يصدر القرار الأولي: '+JSON.stringify(dr.j));
assert.equal((await s1('/admin/disputes/'+aid+'/review','POST',{decision:'completed'})).s,403,'لا يراجع من اتخذ القرار');
assert.equal((await admin('/admin/disputes/'+aid+'/review','POST',{decision:'completed'})).s,200,'مراجعة من المدير بعد المسؤول الأول');
assert.equal(cnt(),0,'بلا سداد لا عمولة بعد ثبوت الإنجاز');await payHala(aid);assert.equal(cnt(),1,'ثبت الإنجاز فتُنشأ العمولة مرة واحدة');
const aid2=(await o(`/direct/${hid}/agreements`,'POST',{amount:300,description:'نزاع بلا إنجاز'})).j.id;
await h(`/agreements/${aid2}/approve`,'POST');await h(`/agreements/${aid2}/request-completion`,'POST');await o(`/agreements/${aid2}/dispute`,'POST');
await s1('/admin/disputes/'+aid2+'/decide','POST',{decision:'not_proven',note:'لم يثبت'});await admin('/admin/disputes/'+aid2+'/review','POST',{decision:'not_proven'});
const d2=new DatabaseSync(DBF);const st=d2.prepare('SELECT status FROM agreements WHERE id=?').get(aid2).status;const nc=d2.prepare('SELECT COUNT(*) n FROM agreement_commissions WHERE agreement_id=?').get(aid2).n;d2.close();
assert.equal(st,'closed_disputed');assert.equal(nc,0,'لا عمولة عند عدم الثبوت');
});

test('الرقم الضريبي: للمؤسسات والشركات فقط، عبر قسم خدماتك، ولا يُقبل من الملف الشخصي',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='سباكة').id;
const h=cl();await h('/register','POST',{name:'شركة ضريبية',email:'vat1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',helper_type:'company',category_ids:[cat]});
assert.equal((await h('/me/vat','POST',{vat_number:'123'})).s,400,'رقم قصير مرفوض');
assert.equal((await h('/me/vat','POST',{vat_number:'312345678901234'})).s,400,'شهادة الضريبة مطلوبة عند أول حفظ');
const vatImg=(await h('/upload','POST',{data:'data:image/png;base64,'+PNGDOC})).j.id;
assert.equal((await h('/me/vat','POST',{vat_number:'312345678901234',attachment_id:vatImg})).s,200,'رقم صحيح مع الشهادة');
assert.equal((await h('/me')).j.user.vat_number,'312345678901234');
await h('/profile','POST',{name:'شركة ضريبية',vat_status:'not_registered',vat_number:'999999999999999'});
assert.equal((await h('/me')).j.user.vat_number,'312345678901234','الملف الشخصي لا يغيّر الرقم الضريبي');
const f=cl();assert.equal((await f('/register','POST',{name:'مساعد فرد',email:'vat2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',helper_type:'individual',category_ids:[cat]})).s,400,'الأفراد لا يُقبلون كمساعدين');
assert.equal((await f('/register','POST',{name:'بلا نوع',email:'vat3@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',category_ids:[cat]})).s,400,'يلزم تحديد مؤسسة أو شركة');
});

test('لوحة المتابعة: التنبيهات وحالة النظام للمدير فقط',async()=>{
const admin=cl();await admin('/login','POST',{email:'admin@t.sa',password:'12345678'});
const m=(await admin('/admin/monitor')).j;
assert.equal(typeof m.alerts.open_reports,'number');assert.equal(typeof m.alerts.vat_pending,'number');
assert.equal(m.system.database,'ok');assert.equal(typeof m.system.uptime_seconds,'number');
assert.equal(typeof m.platform.active_users,'number');
assert.equal((await cl()('/admin/monitor')).s,401,'غير المدير لا يقرأ المتابعة');
});

test('مهل النزاع التلقائية وتقرير التوريدات الشهري',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='سباكة').id;
const o=cl();await o('/register','POST',{name:'عميل مهل',email:'dl1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});
await o('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'عميل مهل',phone:'0500007001'}); await vfy(o);
const h=cl();await h('/register','POST',{name:'مساعد مهل',email:'dl2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',helper_type:'establishment',category_ids:[cat]});
await h('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'مساعد مهل',phone:'0500007002'}); await vfy(h);
const hid=(await h('/me')).j.user.id;
const admin=cl();await admin('/login','POST',{email:'admin@t.sa',password:'12345678'});
const aid=(await o(`/direct/${hid}/agreements`,'POST',{amount:250,description:'اختبار المهل'})).j.id;
await h(`/agreements/${aid}/approve`,'POST');await h(`/agreements/${aid}/request-completion`,'POST');await o(`/agreements/${aid}/dispute`,'POST');
const d=new DatabaseSync(DBF);d.prepare("UPDATE agreements SET disputed_at=datetime('now','-40 days') WHERE id=?").run(aid);d.close();
const row=(await admin('/admin/disputes')).j.find(x=>x.id===aid);
assert.ok(row,'النزاع ظاهر');assert.equal(row.overdue,true,'تجاوز المهلة يظهر تلقائيًا');
const rep=(await admin('/admin/supply-report')).j;
assert.equal(rep.rows.length,12,'اثنا عشر شهرًا');assert.equal(rep.status,'not_set');
assert.equal((await admin('/admin/supply-threshold','POST',{value:1000})).s,200);
const rep2=(await admin('/admin/supply-report')).j;assert.equal(rep2.threshold,1000);assert.equal(rep2.warn_at,800);
assert.equal((await cl()('/admin/supply-report')).s,401,'غير المدير لا يقرأ التوريدات');
});

test('استحقاق متقدم: وسيلة التواصل بعد الاعتماد، والشكوى، وعكس العمولة عند عدم الإثبات',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='سباكة').id;
const o=cl();const rg=await o('/register','POST',{name:'عميل شكوى',email:'ztc1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});assert.equal(rg.s,200,'تسجيل العميل');
await o('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'عميل شكوى',phone:'0500008001'}); await vfy(o);
const h=cl();await h('/register','POST',{name:'مساعد شكوى',email:'ztc2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',helper_type:'establishment',category_ids:[cat]});
await h('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'مساعد شكوى',phone:'0500008002'}); await vfy(h);
const hid=(await h('/me')).j.user.id;
const d0=new DatabaseSync(DBF);d0.prepare("UPDATE users SET created_at=datetime('now','-40 days') WHERE id=?").run(hid);d0.close();
const admin=cl();await admin('/login','POST',{email:'admin@t.sa',password:'12345678'});
await admin('/admin/settings','POST',{bank_name:'بنك',account_name:'مؤسسة المساعد',iban:'SA0380000000608010167519',commission_percent:2,commission_grace_days:3});
const aid=(await o(`/direct/${hid}/agreements`,'POST',{amount:700,description:'اختبار الشكوى'})).j.id;
const gr=await o(`/direct/${hid}/agreements`);assert.ok(Array.isArray(gr.j),'قائمة الاتفاقات: '+gr.s+' '+JSON.stringify(gr.j).slice(0,120));const before=gr.j.find(x=>x.id===aid);
assert.ok(!before.peer_phone,'لا تظهر وسيلة التواصل قبل الاعتماد');
await h(`/agreements/${aid}/approve`,'POST');
const afterApprove=(await o(`/direct/${hid}/agreements`)).j.find(x=>x.id===aid);
assert.equal(afterApprove.peer_phone,'0500008002','تظهر وسيلة التواصل بعد الاعتماد');
await h(`/agreements/${aid}/request-completion`,'POST');await o(`/agreements/${aid}/confirm-completion`,'POST');await payHala(aid);
const st=()=>{const d=new DatabaseSync(DBF);const r=d.prepare('SELECT status,amount FROM agreement_commissions WHERE agreement_id=?').get(aid);d.close();return r};
assert.equal(st().status,'paid','العمولة تُخصم تلقائيًا عند الدفع');
assert.equal((await o(`/agreements/${aid}/complaint`,'POST')).s,200,'الشكوى بعد الإنجاز');
assert.equal(st().status,'paid','الشكوى لا تغيّر عمولة مدفوعة، والاسترداد يتم يدويًا');
const sup=cl();await sup('/register','POST',{name:'مراجع شكوى',email:'ztc3@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});
await admin('/admin/staff','POST',{email:'ztc3@t.sa',perms:['support']});await sup('/login','POST',{email:'ztc3@t.sa',password:'12345678'});
assert.equal((await admin('/admin/disputes/'+aid+'/decide','POST',{decision:'not_proven',note:'لم يثبت الإنجاز'})).s,200,'القرار الأولي من المدير');
assert.equal((await admin('/admin/disputes/'+aid+'/review','POST',{decision:'not_proven'})).s,403,'لا يراجع من أصدر القرار');
assert.equal((await sup('/admin/disputes/'+aid+'/review','POST',{decision:'not_proven'})).s,200,'مراجعة ثانية من مسؤول آخر');
assert.equal(st().status,'refund_due','عمولة مدفوعة تنتظر الاسترداد اليدوي');
{const dbx=new DatabaseSync(DBF);const cr=dbx.prepare('SELECT id FROM agreement_commissions WHERE agreement_id=?').get(aid);dbx.close();assert.equal((await admin('/admin/agreement-commissions/'+cr.id+'/refunded','POST')).s,200,'تسجيل الاسترداد');assert.equal(st().status,'refunded');}
});

test('توثيق المدير للرقم الضريبي، وتغيير نوع المساعد يُرفع للإدارة',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='سباكة').id;
const h=cl();await h('/register','POST',{name:'مساعد توثيق',email:'vf1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',helper_type:'establishment',category_ids:[cat]});
await h('/profile','POST',{name:'مساعد توثيق',phone:'0500009301'});
const hid=(await h('/me')).j.user.id;
assert.equal((await h('/me/helper-type-request','POST',{helper_type:'company'})).s,200,'طلب التغيير يُرسل');
assert.equal((await h('/me/helper-type-request','POST',{helper_type:'individual'})).s,400,'لا يمكن التحويل إلى فرد');assert.equal((await h('/me')).j.user.helper_type,'establishment','لا يتغير النوع قبل موافقة الإدارة');
const admin=cl();await admin('/login','POST',{email:'admin@t.sa',password:'12345678'});
assert.equal((await admin('/admin/helper-type/'+hid+'/decide','POST',{decision:'approve'})).s,200);
assert.equal((await h('/me')).j.user.helper_type,'company','بعد موافقة الإدارة يتغير النوع');
assert.equal((await cl()('/admin/verifications')).s,401,'غير المدير لا يرى التوثيق');
});

test('ضريبة المنصة: تُفعَّل بالإعداد وتُطبَّق على الإجمالي، ولا فواتير',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='سباكة').id;
const o=cl();await o('/register','POST',{name:'عميل فوترة',email:'bl1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});
await verifyEmail(o);
await o('/profile','POST',{name:'عميل فوترة',phone:'0500009401'});
const h=cl();await h('/register','POST',{name:'مساعد فوترة',email:'bl2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',helper_type:'establishment',category_ids:[cat]});
await verifyEmail(h);
await h('/profile','POST',{name:'مساعد فوترة',phone:'0500009402'});
const hid=(await h('/me')).j.user.id;
const admin=cl();await admin('/login','POST',{email:'admin@t.sa',password:'12345678'});
await admin('/admin/settings','POST',{bank_name:'بنك',account_name:'مؤسسة المساعد',iban:'SA0380000000608010167519',commission_percent:2,commission_grace_days:3,org_name:'مؤسسة المساعد',org_cr:'7054975474',dispute_clause:'تحكيم.',support_email:'support@almusaidgroup.shop'});
const deal=async(amt)=>{const id=(await o(`/direct/${hid}/agreements`,'POST',{amount:amt,description:'فوترة'})).j.id;await h(`/agreements/${id}/approve`,'POST');await h(`/agreements/${id}/request-completion`,'POST');await o(`/agreements/${id}/confirm-completion`,'POST');await payHala(id);return id};
const a2=await deal(1000);
assert.equal((await admin('/admin/invoicing','POST',{platform_vat_registered:true,platform_vat_number:'123'})).s,400,'رقم المنصة الضريبي يُتحقق منه');
assert.equal((await admin('/admin/invoicing','POST',{platform_vat_registered:true,platform_vat_number:'312345678901234'})).s,200);
const a3=await deal(1000);
assert.equal((await o(`/agreements/${a3}`)).j.total_amount,1150,'الضريبة تُطبَّق على الإجمالي بعد تفعيلها');
assert.equal((await admin('/admin/invoices')).s,404,'لا مسار للفواتير');
});

test('المنشورات: إعجاب بالتبديل، وتعليقات تُحفظ وتُعرض، وحذف التعليق لصاحبه فقط',async()=>{
const w=cl();await w('/register','POST',{name:'ناشر منشور',email:'fp1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});
await verifyEmail(w);
await w('/profile','POST',{name:'ناشر منشور',phone:'0500009701'});
const pid=(await w('/feed','POST',{body:'منشور للتفاعل'})).j;
const list=(await cl()('/feed')).j;const post=list.find(p=>p.body==='منشور للتفاعل');assert.ok(post,'المنشور ظاهر للزائر');
const liker=cl();await liker('/register','POST',{name:'معجب',email:'fp2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});
await verifyEmail(liker);
await liker('/profile','POST',{name:'معجب',phone:'0500009702'});
assert.equal((await cl()('/feed/'+post.id+'/like','POST')).s,401,'الإعجاب للمسجلين فقط');
const r1=(await liker('/feed/'+post.id+'/like','POST')).j;assert.equal(r1.liked,true);assert.equal(r1.likes,1);
const r2=(await liker('/feed/'+post.id+'/like','POST')).j;assert.equal(r2.liked,false,'الضغط الثاني يلغي الإعجاب');assert.equal(r2.likes,0);
const c1=(await liker('/feed/'+post.id+'/comments','POST',{body:'تعليق جميل'})).j;assert.ok(c1.id,'التعليق يُحفظ');
const cs=(await cl()('/feed/'+post.id+'/comments')).j;assert.equal(cs.length,1);assert.equal(cs[0].body,'تعليق جميل');
const after=(await cl()('/feed')).j.find(p=>p.id===post.id);assert.equal(after.comments,1,'عداد التعليقات');
assert.equal((await w('/feed/comments/'+c1.id+'/delete','POST')).s,403,'صاحب المنشور لا يحذف تعليق غيره');
assert.equal((await liker('/feed/comments/'+c1.id+'/delete','POST')).s,200,'صاحب التعليق يحذفه');
assert.equal((await cl()('/feed/'+post.id+'/comments')).j.length,0);
});

test('لوحة الرئيسية: أرقام وسلاسل من قاعدة البيانات، والمدير وحده',async()=>{
const admin=cl();await admin('/login','POST',{email:'admin@t.sa',password:'12345678'});
const d=(await admin('/admin/dashboard?days=7')).j;
assert.equal(d.days,7);assert.equal(d.labels.length,7);assert.equal(d.series.users.length,7);assert.equal(d.series.profit.length,7);
assert.ok(d.totals.users>=1,'عدد المستخدمين من الجدول');assert.equal(typeof d.totals.commissions_total,'number');
assert.equal((await admin('/admin/dashboard?days=999')).j.days,30,'الفترة غير المدرجة تُرد إلى 30');
assert.equal((await cl()('/admin/dashboard')).s,401,'غير المدير لا يرى اللوحة');
});

test('الطلبات والإعلانات والتصدير: تصنيف، تذكير، جمهور الإعلان، والمدير وحده',async()=>{
const admin=cl();await admin('/login','POST',{email:'admin@t.sa',password:'12345678'});
const all=(await admin('/admin/orders?group=all')).j;assert.ok(Array.isArray(all));
const open=(await admin('/admin/orders?group=open')).j;assert.ok(open.every(x=>x.status==='pending'),'تصنيف المفتوحة');
const sm=(await admin('/admin/orders/summary')).j;assert.equal(typeof sm.stuck,'number');
assert.equal((await cl()('/admin/orders')).s,401,'الطلبات للمدير والدعم فقط');
if(all[0]){assert.equal((await admin(`/admin/orders/${all[0].id}/nudge`,'POST',{reason:'تذكير اختباري'})).s,200,'التذكير يُرسل');}
const bad=(await admin('/admin/export?type=bogus'));assert.equal(bad.s,400);
const exp=await admin('/admin/export?type=users');assert.equal(exp.s,200);
const b1=(await admin('/admin/broadcast','POST',{text:'إعلان للمساعدين فقط',audience:'helpers'})).j;assert.equal(b1.audience,'helpers');
const b2=(await admin('/admin/broadcast','POST',{text:'إعلان لطالبي المساعدة',audience:'clients'})).j;assert.equal(b2.audience,'clients');
const hist=(await admin('/admin/broadcasts')).j;assert.ok(hist.some(x=>x.audience==='helpers'&&x.text.includes('للمساعدين')),'السجل يحفظ الجمهور');
});

test('ملف المستخدم للإدارة: بيانات وأقسام وطلبات وتقييمات، والزائر لا يراه',async()=>{
const admin=cl();await admin('/login','POST',{email:'admin@t.sa',password:'12345678'});
const me=(await admin('/me')).j.user;
const p=(await admin(`/admin/users/${me.id}/profile`)).j;
assert.equal(p.user.email,'admin@t.sa');assert.ok(Array.isArray(p.sections)&&Array.isArray(p.orders)&&Array.isArray(p.reviews));
assert.equal((await admin('/admin/users/999999/profile')).s,404);
assert.equal((await cl()(`/admin/users/${me.id}/profile`)).s,401,'الزائر لا يرى ملف المستخدم');
});

test('إعدادات المنصة: يقرأها المدير وحده، ويعرض الواجهة الحفظ نفسه',async()=>{
const admin=cl();await admin('/login','POST',{email:'admin@t.sa',password:'12345678'});
const s=(await admin('/admin/settings')).j;assert.ok('commission_percent' in s&&'iban' in s&&'org_cr' in s,'المفاتيح القابلة للتحرير');
assert.equal((await cl()('/admin/settings')).s,401,'غير المدير لا يقرأ الإعدادات');
});

test('اختبار محرك المطابقة: عبارة سباكة تطابق القسم، وعبارة لا علاقة لها لا تطابق',async()=>{
const admin=cl();await admin('/login','POST',{email:'admin@t.sa',password:'12345678'});
const ok=(await admin('/admin/match-test','POST',{text:'عندي تسريب مياه في الحمام'})).j;
assert.equal(ok.matched,true);assert.ok(ok.hits.some(h=>h.name==='سباكة'),'سباكة تُطابَق');
const no=(await admin('/admin/match-test','POST',{text:'أحتاج مدرب لياقة بدنية'})).j;assert.equal(no.matched,false);
assert.equal((await cl()('/admin/match-test','POST',{text:'تسريب'})).s,401);
});

test('أداء المساعدين: قائمة من الجداول الفعلية، والعميل لا يراها',async()=>{
const admin=cl();await admin('/login','POST',{email:'admin@t.sa',password:'12345678'});
const rows=(await admin('/admin/helper-performance?days=30')).j;assert.ok(Array.isArray(rows));
if(rows[0])assert.equal(rows[0].days,30);
assert.equal((await cl()('/admin/helper-performance')).s,401);
});

test('صفحة البلاغ عن محادثة: للدعم والمدير، ومعرّف غير موجود يعيد 404',async()=>{
const admin=cl();await admin('/login','POST',{email:'admin@t.sa',password:'12345678'});
assert.equal((await admin('/admin/reports/999999')).s,404);
assert.equal((await cl()('/admin/reports/1')).s,401,'الزائر لا يرى البلاغات');
});

test('الدفع عبر هلا فقط: لا سداد يدوي من العميل، والإشعار يتطلب السر المشترك',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='سباكة').id;
const o=cl();await o('/register','POST',{name:'عميل هلا',email:'hl1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});
await verifyEmail(o);
await o('/profile','POST',{name:'عميل هلا',phone:'0500009501'});
const h=cl();await h('/register','POST',{name:'مساعد هلا',email:'hl2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',helper_type:'establishment',category_ids:[cat]});
await verifyEmail(h);
await h('/profile','POST',{name:'مساعد هلا',phone:'0500009502'});await h('/pledge','POST',{accept:true,name:'مساعد هلا'});
const hid=(await h('/me')).j.user.id;
const aid=(await o(`/direct/${hid}/agreements`,'POST',{amount:1000,description:'اختبار هلا'})).j.id;
await h(`/agreements/${aid}/approve`,'POST');
const det=(await o(`/agreements/${aid}`)).j;
assert.equal(det.total_amount,1150,'العميل يدفع الخدمة مع الضريبة');assert.equal(det.helper_net,980,'صافي المساعد بعد 2%');
assert.equal((await o(`/agreements/${aid}/record-payment`,'POST')).s,403,'لا سداد يدوي من العميل');
assert.equal((await fetch(B+'/api/payments/hala/webhook',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({agreement_id:aid,amount:1150})})).status,401,'الإشعار بلا سر مرفوض');
const wh=b=>fetch(B+'/api/payments/hala/webhook',{method:'POST',headers:{'content-type':'application/json','x-hala-secret':'test-hala'},body:JSON.stringify(b)}).then(r=>r.status);
assert.equal(await wh({agreement_id:aid}),400,'إشعار بلا مبلغ مرفوض');assert.equal(await wh({agreement_id:aid,amount:'abc'}),400,'مبلغ غير رقمي مرفوض');assert.equal(await wh({agreement_id:aid,amount:100}),400,'مبلغ ناقص مرفوض');
const hm=async(b,sig)=>{const body=JSON.stringify(b);const s=sig??createHmac('sha256','test-hala').update(body).digest('hex');return (await fetch(B+'/api/payments/hala/webhook',{method:'POST',headers:{'content-type':'application/json','x-hala-signature':s},body})).status};
assert.equal(await hm({agreement_id:aid,amount:100}),400,'توقيع HMAC صحيح يُقبل ثم يُرفض المبلغ الناقص');assert.equal(await hm({agreement_id:aid,amount:100},'0'.repeat(64)),401,'توقيع HMAC خاطئ مرفوض');
const pl=(await o(`/agreements/${aid}/payment`)).j;assert.equal(pl.amount,1150);assert.equal(pl.status,'not_configured','رابط الدفع ينتظر ربط هلا');
});

test('الإنتاج: صحة الخادم والمانيفست وإشعار هلا بلا مبلغ مرفوض',async()=>{
assert.equal((await fetch(B+'/healthz')).status,200);
const m=await fetch(B+'/manifest.webmanifest');assert.equal(m.status,200);assert.equal((await m.json()).short_name,'المساعد');
assert.equal((await fetch(B+'/icon-192.png')).status,200);
const r=await fetch(B+'/api/payments/hala/webhook',{method:'POST',headers:{'content-type':'application/json','x-hala-secret':'test-hala'},body:JSON.stringify({agreement_id:1})});
assert.ok([400,404].includes(r.status),'إشعار بلا مبلغ لا يُقبل: '+r.status)});

test('الدفع: لا يُسجَّل سداد على اتفاق غير قائم، ولا يُلغى اتفاق مدفوع',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='سباكة').id;
const o=cl();await o('/register','POST',{name:'عميل دفع',email:'pay1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});
await o('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'عميل دفع',phone:'0500007001'}); await vfy(o);
const h=cl();await h('/register','POST',{name:'مساعد دفع',email:'pay2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',helper_type:'establishment',category_ids:[cat]});
await h('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'مساعد دفع',phone:'0500007002'}); await vfy(h);
const hid=(await h('/me')).j.user.id;
const pending=(await o(`/direct/${hid}/agreements`,'POST',{amount:120,description:'اتفاق معلّق للدفع'})).j.id;
const hook=async(id)=>{const r=await fetch(B+'/api/payments/hala/webhook',{method:'POST',headers:{'content-type':'application/json','x-hala-secret':'test-hala'},body:JSON.stringify({agreement_id:id,amount:99999,reference:'R'+id})});return{s:r.status,j:await r.json()}};
const r1=await hook(pending);
assert.equal(r1.j.refund_required,1,'سداد على اتفاق معلّق يُرفع للإدارة للاسترداد');
const st=(await o(`/agreements/${pending}`)).j;
assert.equal(st.paid_at,null,'لا يُسجَّل السداد على اتفاق غير قائم');
const paidOne=(await o(`/direct/${hid}/agreements`,'POST',{amount:200,description:'اتفاق مدفوع'})).j.id;
await h(`/agreements/${paidOne}/approve`,'POST');
assert.equal((await hook(paidOne)).s,200,'سداد اتفاق معتمد يُقبل');
assert.equal((await o(`/agreements/${paidOne}/cancel`,'POST',{reason:'تغيير الرأي'})).s,400,'لا إلغاء لاتفاق مدفوع');
});

test('إشعارات الدفع: الاشتراك والتشفير وفق RFC 8291',async()=>{
  const {encryptPayload}=await import('./src/push-crypto.js');
  const {createECDH,hkdfSync,createDecipheriv,randomBytes}=await import('node:crypto');
  const u=await reg('push1');
  assert.equal((await u('/push/key')).j.key,null,'بلا مفتاح VAPID في الاختبار');
  assert.equal((await u('/push/subscribe','POST',{endpoint:'http://insecure.example/x',keys:{p256dh:'a',auth:'b'}})).s,400,'يرفض غير https');
  assert.equal((await u('/push/subscribe','POST',{endpoint:'https://push.example/abc',keys:{p256dh:'a',auth:'b'}})).s,200);
  assert.equal((await u('/push/unsubscribe','POST',{endpoint:'https://push.example/abc'})).s,200);
  const rx=createECDH('prime256v1');rx.generateKeys();const auth=randomBytes(16);
  const msg='{"title":"اختبار"}';
  const body=encryptPayload(rx.getPublicKey().toString('base64url'),auth.toString('base64url'),msg);
  const salt=body.subarray(0,16),rs=body.readUInt32BE(16),idlen=body[20];
  const asPub=body.subarray(21,21+idlen),ct=body.subarray(21+idlen);
  assert.equal(rs,4096);assert.equal(idlen,65);
  const ikm=Buffer.from(hkdfSync('sha256',rx.computeSecret(asPub),auth,Buffer.concat([Buffer.from('WebPush: info\0'),rx.getPublicKey(),asPub]),32));
  const cek=Buffer.from(hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: aes128gcm\0'),16));
  const nonce=Buffer.from(hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: nonce\0'),12));
  const d=createDecipheriv('aes-128-gcm',cek,nonce);d.setAuthTag(ct.subarray(ct.length-16));
  const plain=Buffer.concat([d.update(ct.subarray(0,ct.length-16)),d.final()]);
  assert.equal(plain[plain.length-1],2,'محدد آخر سجل');
  assert.equal(plain.subarray(0,plain.length-1).toString(),msg,'فك التشفير يعيد الرسالة');
});

test('الأوراق الرسمية: الآيبان والشعار والمؤسسة والحذف، وحماية الرقم الضريبي',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='كهرباء').id;
const h=cl();await h('/register','POST',{name:'مؤسسة الآيبان',email:'extra1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'الرياض',account_type:'helper',helper_type:'establishment',category_ids:[cat]});
const img=(await h('/upload','POST',{data:'data:image/png;base64,'+PNGDOC})).j.id;
assert.equal((await h('/me/extra','POST',{kind:'iban',number:'SA0380000000608010167519'})).s,400,'الآيبان يحتاج صورة');
assert.equal((await h('/me/extra','POST',{kind:'iban',number:'SA12',attachment_id:img})).s,400,'الآيبان القصير مرفوض');
assert.equal((await h('/me/extra','POST',{kind:'iban',number:'sa03 8000 0000 6080 1016 7519',attachment_id:img})).s,200,'الآيبان الصحيح يُقبل مع المسافات');
assert.equal((await h('/me/extra','POST',{kind:'logo'})).s,400,'الشعار يحتاج صورة');
assert.equal((await h('/me/extra','POST',{kind:'logo',attachment_id:img})).s,200,'الشعار يُقبل');
assert.equal((await h('/me/extra','POST',{kind:'org',number:'x'})).s,400,'اسم المؤسسة القصير مرفوض');
assert.equal((await h('/me/extra','POST',{kind:'org',number:'مؤسسة الرياض للخدمات'})).s,200,'اسم المؤسسة يُقبل بلا صورة');
assert.equal((await h('/me/extra','POST',{kind:'cr',number:'1010123456',attachment_id:img})).s,400,'السجل لا يمر من هذا المسار');
let docs=(await h('/me/docs')).j;
assert.ok(docs.some(d=>d.kind==='iban'&&d.number==='SA0380000000608010167519'),'الآيبان في القائمة');
assert.ok(docs.some(d=>d.kind==='logo')&&docs.some(d=>d.kind==='org'),'الشعار والمؤسسة في القائمة');
assert.equal((await h('/me/docs/delete','POST',{kind:'vat'})).s,400,'الرقم الضريبي لا يُحذف من هنا');
assert.equal((await h('/me/docs/delete','POST',{kind:'iban'})).s,200,'حذف الآيبان');
docs=(await h('/me/docs')).j;
assert.ok(!docs.some(d=>d.kind==='iban'),'اختفى الآيبان بعد الحذف');
const me=(await h('/me')).j.user;assert.ok(!me.iban,'حُذف الآيبان من بيانات الحساب أيضًا');
});

test('إشعارات الدفع: فحص مفاتيح VAPID وتنظيفها وقراءة سبب رفض خدمة الدفع',async()=>{
  const {vapidProblem,cleanKey,pushFailure}=await import('./src/push-crypto.js');
  const {generateKeyPairSync}=await import('node:crypto');
  const mk=()=>{const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'P-256'});const j=publicKey.export({format:'jwk'}),d=privateKey.export({format:'jwk'});return{publicKey:Buffer.concat([Buffer.from([4]),Buffer.from(j.x,'base64url'),Buffer.from(j.y,'base64url')]).toString('base64url'),privateKey:d.d}};
  const A=mk(),B=mk();
  assert.equal(vapidProblem(A),'','زوج صحيح');
  assert.ok(vapidProblem({publicKey:A.publicKey,privateKey:B.privateKey}),'زوج غير متطابق');
  assert.ok(vapidProblem({publicKey:A.privateKey,privateKey:A.publicKey}),'مفتاحان مقلوبان');
  assert.ok(vapidProblem({publicKey:'',privateKey:A.privateKey}),'مفتاح عام فارغ');
  assert.equal(cleanKey(' \"'+A.publicKey+'\"\n'),A.publicKey,'يزيل الاقتباس والمسافات والأسطر');
  assert.deepEqual(await pushFailure(new Response('{\"reason\":\"VapidPkHashMismatch\"}',{status:400})),{status:400,reason:'VapidPkHashMismatch',dead:true},'اشتراك بمفتاح قديم');
  assert.equal((await pushFailure(new Response('',{status:410}))).dead,true,'منتهي');
  assert.equal((await pushFailure(new Response('{\"reason\":\"BadJwtToken\"}',{status:403}))).dead,false,'403 لا يحذف الاشتراك');
});

test('إشعارات الدفع: تفضيل مستقل عن إشعارات البريد',async()=>{
  const u=await reg('push2');
  assert.equal((await u('/me')).j.user.push_enabled,1,'مفعّلة افتراضيًا');
  assert.equal((await u('/push/pref','POST',{enabled:false})).s,200);
  assert.equal((await u('/me')).j.user.push_enabled,0,'أوقفها المستخدم');
  assert.equal((await u('/me')).j.user.notify_email,1,'إشعارات البريد لم تتغير');
  await u('/push/subscribe','POST',{endpoint:'https://push.example/z',keys:{p256dh:'a',auth:'b'}});
  assert.equal((await u('/me')).j.user.push_enabled,1,'الاشتراك يعيد التفعيل');
});

test('إصلاحات الأمان: غير المؤكد لا ينشر، ومنشورات الحساب المحذوف تختفي', async () => {
  const u = cl();
  await u('/register', 'POST', { name: 'غير مؤكد', email: 'fix1@t.sa', password: '12345678', terms: 1, age: 1, phone: ph(), city: 'جدة' });
  const blocked = await u('/feed', 'POST', { body: 'منشور قبل التأكيد' });
  assert.equal(blocked.s, 403, 'الحساب غير المؤكد لا يجب أن ينشر');

  const w = cl();
  await w('/register', 'POST', { name: 'ناشر محذوف', email: 'fix2@t.sa', password: '12345678', terms: 1, age: 1, phone: ph(), city: 'جدة' });
  await verifyEmail(w);
  await w('/profile', 'POST', { name: 'ناشر محذوف', phone: '0500009801' });
  await w('/feed', 'POST', { body: 'منشور سيُحذف' });
  assert.ok((await cl()('/feed')).j.find(p => p.body === 'منشور سيُحذف'), 'المنشور ظاهر قبل الحذف');
  const del = await w('/me/delete', 'POST', { password: '12345678', confirm: 'حذف' });
  assert.equal(del.s, 200);
  assert.ok(!(await cl()('/feed')).j.find(p => p.body === 'منشور سيُحذف'), 'المنشور مخفي بعد الحذف');
});

test('بطاقات البحث: اسم المحل كاملًا مع صورته، وأسماء المقيّمين في الملف', async () => {
  const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const cat = (await cl()('/skills')).j.categories.find(c => c.name === 'سباكة');
  const mk = async (email, name, helper) => {
    const c = cl();
    await c('/register', 'POST', { name, email, password: '12345678', terms: 1, age: 1, phone: ph(), city: 'الرياض', ...(helper ? { account_type: 'helper', helper_type: 'establishment', category_ids: [cat.id] } : {}) });
    await c('/profile', 'POST', { vat_status: 'registered', vat_number: '312345678901234', name, phone: ph() });
    await vfy(c);
    return c;
  };
  const shop1 = await mk('card1@t.sa', 'مؤسسة النور للسباكة', true);
  const shop2 = await mk('card2@t.sa', 'شركة الأمان للسباكة', true);
  const cust = await mk('card3@t.sa', 'سعد بن فهد العتيبي', false);
  const idOf = async c => (await c('/me')).j.user.id;
  const [s1, s2, cu] = [await idOf(shop1), await idOf(shop2), await idOf(cust)];

  // صورة للمحل الأول فقط
  const at = (await shop1('/upload', 'POST', { data: 'data:image/png;base64,' + PNG })).j.id;
  assert.equal((await shop1('/me/avatar', 'POST', { attachment_id: at })).s, 200);

  // اتفاقات منجزة لرفع ترتيب المحلين في نتائج البحث (الحد 10 نتائج)، وتقييمان للمحل الأول
  const d = new DatabaseSync(DBF);
  const ag = d.prepare("INSERT INTO agreements(a_id,b_id,amount,description,status) VALUES(?,?,100,'اختبار','completed')");
  for (let i = 0; i < 40; i++) { ag.run(cu, s1); ag.run(cu, s2); }
  const g1 = Number(ag.run(cu, s1).lastInsertRowid), g2 = Number(ag.run(s2, s1).lastInsertRowid);
  const rv = d.prepare('INSERT INTO ratings(agreement_id,rater_id,ratee_id,stars,comment) VALUES(?,?,?,?,?)');
  rv.run(g1, cu, s1, 5, 'ممتاز'); rv.run(g2, s2, s1, 4, 'تعامل محترف');
  d.close();

  const hit = (await cust('/assistant', 'POST', { message: 'أبي سباك يصلح تسريب' })).j;
  const p1 = hit.providers.find(x => x.id === s1), p2 = hit.providers.find(x => x.id === s2);
  assert.ok(p1 && p2, 'المحلان ضمن النتائج');
  assert.equal(p1.name, 'مؤسسة النور للسباكة', 'الاسم كاملًا وليس كلمته الأولى');
  assert.equal(p2.name, 'شركة الأمان للسباكة');
  assert.equal(p1.avatar, String(at), 'صورة المحل تصل مع النتيجة');
  assert.equal(p2.avatar, null, 'المحل بلا صورة يرجع null');

  // التقييمات: العميل بالاسم الأول فقط (خصوصية)، والمساعد (مؤسسة/شركة) باسمه كاملًا
  const prof = (await cust('/providers/' + s1)).j;
  const nameOf = txt => prof.reviews.find(r => r.comment === txt)?.name;
  assert.equal(nameOf('ممتاز'), 'سعد', 'العميل: الاسم الأول فقط');
  assert.equal(nameOf('تعامل محترف'), 'شركة الأمان للسباكة', 'المساعد: الاسم كاملًا');
});

test('الأوراق الرسمية: السجل التجاري والعنوان الوطني بصورة ورقم، للمساعدين فقط',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='كهرباء').id;
const h=cl();await h('/register','POST',{name:'مؤسسة الأوراق',email:'docs1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'الرياض',account_type:'helper',helper_type:'establishment',category_ids:[cat]});
const img=(await h('/upload','POST',{data:'data:image/png;base64,'+PNGDOC})).j.id;
assert.equal((await h('/me/docs','POST',{kind:'cr',number:'1010123456',attachment_id:img})).s,200,'سجل تجاري صحيح');
assert.equal((await h('/me/docs','POST',{kind:'cr',number:'123',attachment_id:img})).s,400,'سجل قصير مرفوض');
assert.equal((await h('/me/docs','POST',{kind:'cr',number:'1010123456'})).s,400,'الصورة مطلوبة');
assert.equal((await h('/me/docs','POST',{kind:'address',number:'abcd12',attachment_id:img})).s,400,'العنوان المختصر بصيغة خاطئة');
assert.equal((await h('/me/docs','POST',{kind:'address',number:'abcd1234',attachment_id:img})).s,200,'العنوان الوطني صحيح');
assert.equal((await h('/me/docs','POST',{kind:'vat',number:'312345678901234',attachment_id:img})).s,400,'نوع غير مسموح عبر هذا المسار');
const rows=(await h('/me/docs')).j;assert.equal(rows.length,2);assert.ok(rows.find(r=>r.kind==='address').number==='ABCD1234');
const c=cl();await c('/register','POST',{name:'عميل ورق',email:'docs2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'الرياض'});
const cimg=(await c('/upload','POST',{data:'data:image/png;base64,'+PNGDOC})).j.id;
assert.equal((await c('/me/docs','POST',{kind:'cr',number:'1010123456',attachment_id:cimg})).s,403,'العميل لا يرفع أوراق مساعد');
});

const PNGDOC='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('الإلغاء المتتالي والكاش: 5 إلغاءات متتالية تُغلق الحساب، و3 طلبات كاش غير مسددة توقف المساعد حتى السداد',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='سباكة').id;
const mk=async(email,name,phoneN)=>{const c=cl();await c('/register','POST',{name,email,password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});await verifyEmail(c);await c('/profile','POST',{name,phone:phoneN});return c};
const o=await mk('cx1@t.sa','عميل إلغاء','0500009601');const oid=(await o('/me')).j.user.id;
const o2=await mk('cx3@t.sa','عميل كاش','0500009603');
const h=cl();await h('/register','POST',{name:'مساعد إلغاء',email:'cx2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',helper_type:'establishment',category_ids:[cat]});
await verifyEmail(h);await h('/profile','POST',{name:'مساعد إلغاء',phone:'0500009602'});await h('/pledge','POST',{accept:true,name:'مساعد إلغاء'});
const hid=(await h('/me')).j.user.id;
const admin=cl();await admin('/login','POST',{email:'admin@t.sa',password:'12345678'});

for(let i=0;i<4;i++){const id=(await o(`/direct/${hid}/agreements`,'POST',{amount:100,description:'طلب '+i})).j.id;assert.equal((await o(`/agreements/${id}/cancel`,'POST')).s,200)}
assert.equal((await admin(`/admin/users/${oid}/profile`)).j.user.suspended_until,null,'أربعة إلغاءات لا تُغلق الحساب');
const last=(await o(`/direct/${hid}/agreements`,'POST',{amount:100,description:'طلب أخير'})).j.id;assert.equal((await o(`/agreements/${last}/cancel`,'POST')).s,200);
assert.ok((await admin(`/admin/users/${oid}/profile`)).j.user.suspended_until,'خمسة إلغاءات متتالية تُغلق الحساب');

const cashDeal=async(amt)=>{const id=(await o2(`/direct/${hid}/agreements`,'POST',{amount:amt,description:'كاش'})).j.id;assert.equal((await h(`/agreements/${id}/approve`,'POST')).s,200);assert.equal((await o2(`/agreements/${id}/choose-cash`,'POST')).s,200);assert.equal((await h(`/agreements/${id}/cash-received`,'POST')).s,200);return id};
await cashDeal(100);await cashDeal(100);
assert.equal((await admin(`/admin/users/${hid}/profile`)).j.user.cash_hold,0,'طلبا كاش فقط: لا إيقاف');
await cashDeal(100);
assert.equal((await admin(`/admin/users/${hid}/profile`)).j.user.cash_hold,1,'ثلاثة طلبات كاش غير مسددة توقف الحساب');

const pid=(await o2(`/direct/${hid}/agreements`,'POST',{amount:100,description:'سداد'})).j.id;
await h(`/agreements/${pid}/approve`,'POST');
const tot=(await o2(`/agreements/${pid}`)).j.total_amount;
const pay=await fetch(B+'/api/payments/hala/webhook',{method:'POST',headers:{'content-type':'application/json','x-hala-secret':'test-hala'},body:JSON.stringify({agreement_id:pid,amount:tot,reference:'SETTLE'+pid})});
assert.equal(pay.status,200);
assert.equal((await admin(`/admin/users/${hid}/profile`)).j.user.cash_hold,0,'بعد السداد يُفعَّل الحساب');
});

test('رابط الدفع: المساعد يحدد السعر النهائي فقط، فيُنشأ اتفاق معتمد، والعميل يختار كاش أو أونلاين',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='سباكة').id;
const o=cl();await o('/register','POST',{name:'عميل رابط',email:'pl1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});await verifyEmail(o);await o('/profile','POST',{name:'عميل رابط',phone:'0500009701'});
const oid=(await o('/me')).j.user.id;
const h=cl();await h('/register','POST',{name:'مساعد رابط',email:'pl2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',helper_type:'establishment',category_ids:[cat]});await verifyEmail(h);await h('/profile','POST',{name:'مساعد رابط',phone:'0500009702'});await h('/pledge','POST',{accept:true,name:'مساعد رابط'});
const hid=(await h('/me')).j.user.id;
const adm=cl();await adm('/login','POST',{email:'admin@t.sa',password:'12345678'});
assert.equal((await o(`/direct/${hid}/payment-link`,'POST',{description:'تركيب',amount:300})).s,403,'العميل لا يرسل رابط دفع');
const r=await h(`/direct/${oid}/payment-link`,'POST',{description:'تركيب مكيف',amount:300});assert.equal(r.s,200);
const g=(await o(`/agreements/${r.j.id}`)).j;assert.equal(g.status,'agreed','الرابط يُنشئ اتفاقًا معتمدًا');assert.equal((await o(`/direct/${hid}/agreements`)).j.find(x=>x.id===r.j.id).source,'link','المحادثة تعرف أنه رابط دفع');assert.equal(g.amount,300);
assert.equal((await o(`/agreements/${r.j.id}/choose-cash`,'POST')).s,200,'اختيار الكاش');
assert.equal((await h(`/agreements/${r.j.id}/cash-received`,'POST')).s,200);

// مفتاح هلا للمساعد: يُحفظ مشفّرًا، ولا يُعاد في أي استجابة
assert.equal((await h('/helper/hala','POST',{api_key:'key-abcdef1234',webhook_secret:'whsec-abcdef1234'})).s,200);
const st=await h('/helper/hala');assert.equal(st.j.configured,true);assert.equal(st.j.last4,'1234');
assert.ok(!JSON.stringify(st.j).includes('whsec'),'السر لا يُعاد');
assert.equal((await o('/helper/hala')).s,403,'العميل لا يصل لإعداد هلا');

// إشعار موقّع بسر المساعد يُقبل، والسر العام المرسل بالترويسة يُرفض لهذا الاتفاق
const r2=await h(`/direct/${oid}/payment-link`,'POST',{description:'دفع أونلاين',amount:200});
const tot=(await o(`/agreements/${r2.j.id}`)).j.total_amount;
const body=JSON.stringify({agreement_id:r2.j.id,amount:tot,reference:'HL'+r2.j.id});
const wrong=await fetch(B+'/api/payments/hala/webhook',{method:'POST',headers:{'content-type':'application/json','x-hala-secret':'test-hala'},body});
assert.equal(wrong.status,401,'السر العام لا يقبل اتفاق مساعد لديه سر خاص');
const sig=createHmac('sha256','whsec-abcdef1234').update(body).digest('hex');
const ok=await fetch(B+'/api/payments/hala/webhook',{method:'POST',headers:{'content-type':'application/json','x-hala-signature':sig},body});
assert.equal(ok.status,200,'الإشعار الموقّع بسر المساعد يُقبل');
assert.ok((await o(`/agreements/${r2.j.id}`)).j.paid_at,'الاتفاق مدفوع');

// مستحقات المنصة: تُصدر من الإدارة، وتُسوَّى عند تأكيدها
assert.equal((await adm(`/admin/helpers/${hid}/platform-invoice`,'POST')).s,400,'الدفع الأونلاين خصم المستحقات السابقة تلقائيًا');
const r3=await h(`/direct/${oid}/payment-link`,'POST',{description:'طلب كاش أخير',amount:150});
assert.equal((await o(`/agreements/${r3.j.id}/choose-cash`,'POST')).s,200);assert.equal((await h(`/agreements/${r3.j.id}/cash-received`,'POST')).s,200);
const pi=await adm(`/admin/helpers/${hid}/platform-invoice`,'POST');assert.equal(pi.s,200);assert.ok(pi.j.number.startsWith('PI-'));assert.ok(pi.j.amount>0);
assert.ok((await h('/helper/platform-invoices')).j.some(x=>x.number===pi.j.number),'المساعد يرى الفاتورة');
assert.equal((await adm(`/admin/platform-invoices/${pi.j.id}/mark-paid`,'POST',{note:'تحويل'})).s,200);
assert.equal((await adm(`/admin/platform-invoices/${pi.j.id}/mark-paid`,'POST',{})).s,400,'لا تُسدَّد مرتين');
});

test('المهمة: العميل يبدأ، والمساعد يقبل، ورابط الدفع المسدد ينهيها بنجاح',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='سباكة').id;
const o=cl();await o('/register','POST',{name:'عميل مهمة',email:'tk1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});await verifyEmail(o);await o('/profile','POST',{name:'عميل مهمة',phone:'0500009801'});
const oid=(await o('/me')).j.user.id;
const h=cl();await h('/register','POST',{name:'مساعد مهمة',email:'tk2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',helper_type:'establishment',category_ids:[cat]});await verifyEmail(h);await h('/profile','POST',{name:'مساعد مهمة',phone:'0500009802'});await h('/pledge','POST',{accept:true,name:'مساعد مهمة'});
const hid=(await h('/me')).j.user.id;
assert.equal((await o(`/direct/${hid}/task`,'POST')).s,403,'العميل لا يبدأ المهمة');
const st=await h(`/direct/${oid}/task`,'POST');assert.equal(st.s,200);
assert.equal((await h(`/direct/${oid}/task`,'POST')).s,400,'لا مهمتان مفتوحتان');
assert.equal((await h(`/direct/${oid}/task`)).j.task.status,'requested');
assert.equal((await h(`/tasks/${st.j.id}/accept`,'POST')).s,403,'القبول للعميل فقط');
assert.equal((await o(`/tasks/${st.j.id}/accept`,'POST')).s,200);
const pl=await h(`/direct/${oid}/payment-link`,'POST',{description:'تركيب',amount:200});assert.equal(pl.s,200);
const tot=(await o(`/agreements/${pl.j.id}`)).j.total_amount;
const body=JSON.stringify({agreement_id:pl.j.id,amount:tot,reference:'TK'+pl.j.id});
const pay=await fetch(B+'/api/payments/hala/webhook',{method:'POST',headers:{'content-type':'application/json','x-hala-secret':'test-hala'},body});assert.equal(pay.status,200);
assert.equal((await h(`/direct/${oid}/task`)).j.task,null,'بعد السداد لا مهمة مفتوحة');
assert.equal((await h(`/direct/${oid}/task`,'POST')).s,200,'يمكن بدء مهمة جديدة بعد النجاح');
});

test('التقييم بعد المهمة: يظهر للعميل بعد السداد، ويظهر في حساب المساعد والبطاقة',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='سباكة').id;
const o=cl();await o('/register','POST',{name:'عميل تقييم',email:'rv1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});await verifyEmail(o);await o('/profile','POST',{name:'عميل تقييم',phone:'0500009901'});
const oid=(await o('/me')).j.user.id;
const h=cl();await h('/register','POST',{name:'مساعد تقييم',email:'rv2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',helper_type:'establishment',category_ids:[cat]});await verifyEmail(h);await h('/profile','POST',{name:'مساعد تقييم',phone:'0500009902'});await h('/pledge','POST',{accept:true,name:'مساعد تقييم'});
const hid=(await h('/me')).j.user.id;
const t=await h(`/direct/${oid}/task`,'POST');assert.equal(t.s,200);
await o(`/tasks/${t.j.id}/accept`,'POST');
const pl=await h(`/direct/${oid}/payment-link`,'POST',{description:'تركيب',amount:100});
const tot=(await o(`/agreements/${pl.j.id}`)).j.total_amount;
const body=JSON.stringify({agreement_id:pl.j.id,amount:tot,reference:'RV'+pl.j.id});
assert.equal((await fetch(B+'/api/payments/hala/webhook',{method:'POST',headers:{'content-type':'application/json','x-hala-secret':'test-hala'},body})).status,200);
const tk=(await o(`/direct/${hid}/task`)).j;assert.equal(tk.task,null);assert.ok(tk.rate,'العميل يرى طلب التقييم بعد الإنجاز');
assert.equal((await o(`/tasks/${t.j.id}/rate`,'POST',{stars:9})).s,400,'التقييم بين 1 و5');
assert.equal((await h(`/tasks/${t.j.id}/rate`,'POST',{stars:5})).s,403,'التقييم للعميل فقط');
assert.equal((await o(`/tasks/${t.j.id}/rate`,'POST',{stars:4,comment:'ممتاز'})).s,200);
assert.equal((await o(`/tasks/${t.j.id}/rate`,'POST',{stars:5})).s,409,'لا تقييم مكرر');
assert.equal((await o(`/direct/${hid}/task`)).j.rate,null,'اختفى طلب التقييم');
const rv=(await h('/helper/reviews')).j;assert.equal(rv.count,1);assert.equal(rv.reviews[0].stars,4);assert.equal(rv.reviews[0].comment,'ممتاز');
const card=(await o(`/direct/${hid}/agreements`)).j.find(x=>x.id===pl.j.id);assert.equal(card.link_meta.count,1);assert.equal(card.link_meta.avg,4);
});

test('رابط الدفع بعد بدء المهمة مباشرة: المساعد يرسله قبل قبول العميل، والسداد ينهي المهمة',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='سباكة').id;
const o=cl();await o('/register','POST',{name:'عميل بدء',email:'sb1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});await verifyEmail(o);await o('/profile','POST',{name:'عميل بدء',phone:'0500010001'});
const oid=(await o('/me')).j.user.id;
const h=cl();await h('/register','POST',{name:'مساعد بدء',email:'sb2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',helper_type:'establishment',category_ids:[cat]});await verifyEmail(h);await h('/profile','POST',{name:'مساعد بدء',phone:'0500010002'});await h('/pledge','POST',{accept:true,name:'مساعد بدء'});
const hid=(await h('/me')).j.user.id;
const t=await h(`/direct/${oid}/task`,'POST');assert.equal(t.s,200);
const pl=await h(`/direct/${oid}/payment-link`,'POST',{description:'تركيب',amount:120});assert.equal(pl.s,200,'الرابط يُرسل بعد بدء المهمة مباشرة');
const tot=(await o(`/agreements/${pl.j.id}`)).j.total_amount;
const body=JSON.stringify({agreement_id:pl.j.id,amount:tot,reference:'SB'+pl.j.id});
assert.equal((await fetch(B+'/api/payments/hala/webhook',{method:'POST',headers:{'content-type':'application/json','x-hala-secret':'test-hala'},body})).status,200);
assert.equal((await h(`/direct/${oid}/task`)).j.task,null,'السداد أنهى المهمة');
});
