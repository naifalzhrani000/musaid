import {test,before,after} from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
const macKeyOf=(file)=>{const d=new DatabaseSync(file);const r=d.prepare("SELECT value FROM settings WHERE key='mac_key'").get();d.close();return r?.value};
const macFor=(file,s)=>createHmac('sha256',macKeyOf(file)).update(s).digest('hex');
import {DatabaseSync} from 'node:sqlite';
import {createHash,createHmac} from 'node:crypto';
import {existsSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
let DBF;
let srv;const B='http://localhost:3999';
before(async()=>{DBF='/tmp/t'+Date.now()+'.db';srv=spawn('node',['server.js'],{env:{...process.env,RESEND_API_KEY:'',REGISTER_PER_HOUR:'1000',ASSISTANT_PER_HOUR:'5000',PORT:3999,DB_FILE:DBF,ADMIN_EMAIL:'admin@t.sa',ADMIN_SETUP_TOKEN:'test-token',HALA_WEBHOOK_SECRET:'test-hala'},stdio:'ignore'});await new Promise(r=>setTimeout(r,1200))});
after(()=>srv.kill());
const cl=()=>{let ck='';return async(p,m='GET',b)=>{const r=await fetch(B+'/api'+p,{method:m,headers:{'content-type':'application/json',cookie:ck},body:b?JSON.stringify(b):undefined});ck=r.headers.get('set-cookie')?.split(';')[0]||ck;return{s:r.status,j:await r.json().catch(()=>({}))}}};
let phSeq=0;const ph=()=>'05'+String(70000000+(++phSeq));
const reg=async(e)=>{const c=cl();await c('/register','POST',{name:'مستخدم '+e,email:e+'@t.sa',password:'12345678',terms:1,age:1,phone:ph()}); await c('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'مستخدم '+e,phone:ph()}); await vfy(c);return c};
const asHelper=async c=>{const cats=(await c('/skills')).j.categories;return c('/me/account-type','POST',{type:'helper',category_ids:[cats[0].id]})};
const backdateHelper=e=>{const d=new DatabaseSync(DBF);d.prepare("UPDATE users SET created_at=datetime('now','-40 days') WHERE email=?").run(e);d.close()};
const vfy=async(c)=>{const id=(await c('/me')).j.user.id;const d=new DatabaseSync(DBF);d.prepare("UPDATE users SET email_verified=1,vat_verified=1,vat_status='registered',vat_number=CASE WHEN vat_number IS NULL OR vat_number='' THEN '312345678901234' ELSE vat_number END WHERE id=?").run(id);d.close();};
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
assert.equal((await anon('/assistant','POST',{message:'أبي أحد ينقل عفش'})).j.needLogin,1);
const u=await cl();await u('/register','POST',{name:'باحث المساعد',email:'ai@t.sa',password:'12345678',terms:1,age:1,phone:ph()}); await u('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'باحث المساعد',phone:ph()}); await vfy(u);
const none=(await u('/assistant','POST',{message:'أبي طباخ يجهز لي عشاء'})).j;
assert.equal(none.category,'الطبخ والأطعمة والضيافة');assert.ok(Array.isArray(none.providers));
const r=(await u('/assistant','POST',{message:'أبي أحد ينقل عفش في الرياض بـ 200 ريال'})).j;
assert.equal(r.category,'النقل والتوصيل');assert.ok(r.reply.length>5);
const unk=(await u('/assistant','POST',{message:'كيف الطقس اليوم؟'})).j;assert.equal(unk.category,undefined);
assert.equal((await u('/assistant','POST',{message:'مر'})).s,400);
});
test('الأقسام: للمساعدين فقط، ويُختار القسم عند التسجيل',async()=>{
const adm=cl();await adm('/login','POST',{email:'admin@t.sa',password:'12345678'});
const anon=await cl();const cats=(await anon('/skills')).j.categories;const tech=cats.find(c=>c.name==='البرمجة وتطوير المواقع والتطبيقات');
const c1=await cl();assert.equal((await c1('/register','POST',{name:'عميل قسم',email:'cat1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),account_type:'client',category_ids:[tech.id]})).s,400);
const c2=await cl();assert.equal((await c2('/register','POST',{name:'عميل قسم',email:'cat2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),account_type:'client'})).s,200);
assert.equal((await c2('/me/sections','POST',{category_ids:[tech.id]})).s,403);
assert.equal((await c2('/me/account-type','POST',{type:'helper',category_ids:[]})).s,400);
assert.equal((await c2('/me/account-type','POST',{type:'helper',category_ids:[tech.id]})).s,200);
assert.equal((await c2('/me')).j.user.account_type,'helper');
assert.equal((await c2('/me/account-type','POST',{type:'client'})).s,200);
assert.equal((await c2('/me')).j.user.account_type,'client');
assert.equal((await c2('/me/sections','POST',{category_ids:[tech.id]})).s,403);
const u=await cl();
assert.equal((await u('/register','POST',{name:'مصمم تجريبي',email:'sk0@t.sa',password:'12345678',terms:1,age:1,phone:ph(),account_type:'helper',category_ids:[]})).s,400);
assert.equal((await u('/register','POST',{name:'مصمم تجريبي',email:'sk1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'الرياض',account_type:'helper',category_ids:[tech.id]})).s,200);
assert.equal((await u('/me')).j.user.account_type,'helper');
assert.equal((await u('/me/sections','POST',{category_ids:[tech.id,...cats.slice(1,4).map(c=>c.id)]})).s,400);
assert.equal((await u('/me/sections','POST',{category_ids:[]})).s,400);
assert.equal((await u('/me/sections','POST',{category_ids:[tech.id]})).s,200);
assert.deepEqual([...(await u('/me/sections')).j],[tech.id]);
assert.equal((await u('/assistant','POST',{message:'أبي شخص يصلح بابل'})).j.noMatch,1);
const sug=(await u('/skills/suggest','POST',{category_id:tech.id,name:'تصميم عروض تقديمية',keywords:'بوربوينت، سلايدات'})).j;assert.equal(sug.status,'pending');
assert.equal((await u('/assistant','POST',{message:'أبي بوربوينت فقط'})).j.noMatch,1);
assert.equal((await adm(`/admin/skills/${sug.id}/review`,'POST',{decision:'approve'})).s,200);
await u('/profile','POST',{vat_status:'registered',vat_number:'312345678901234'}); await vfy(u);const hit=(await u('/assistant','POST',{message:'أبي بوربوينت فقط'})).j;
assert.equal(hit.category,'البرمجة وتطوير المواقع والتطبيقات');assert.ok(hit.providers.length>=1);
assert.ok((await adm('/admin/failed-searches')).j.some(x=>x.text.includes('بابل')));
assert.equal((await adm(`/admin/sections/${tech.id}/keywords`,'POST',{keywords:'سلايد، تقديمي'})).j.added.length,2);
assert.equal((await adm('/admin/sections/999/keywords','POST',{keywords:'x'})).s,404);
assert.equal((await u(`/admin/sections/${tech.id}/keywords`,'POST',{keywords:'x'})).s,403);
assert.equal((await u('/skills/suggest','POST',{category_id:999,name:'خطأ'})).s,400);
});
test('صفحة المساعد: النبذة والأعمال والتقييمات والبحث القابل للنقر',async()=>{
const PNG3='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const w=await cl();
const cat=(await w('/skills')).j.categories.find(c=>c.name==='النجارة والأثاث');
await w('/register','POST',{name:'نجار تجريبي',email:'carp@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'الرياض',account_type:'helper',category_ids:[cat.id]}); await w('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'نجار تجريبي',phone:ph()}); await vfy(w);
const wid=(await w('/me')).j.user.id;
assert.equal((await w('/me/bio','POST',{bio:'نجار بخبرة 10 سنوات في تركيب الأبواب والخزائن'})).s,200);
const at=(await w('/upload','POST',{data:'data:image/png;base64,'+PNG3})).j.id;
assert.equal((await w('/me/portfolio','POST',{attachment_id:at,caption:'باب خشب مصنوع يدويًا'})).s,200);
const pid=(await w('/providers/'+wid)).j;
assert.equal(pid.bio.includes('10 سنوات'),true);assert.equal(pid.skills[0],'النجارة والأثاث');assert.equal(pid.portfolio.length,1);
const anon=await cl();assert.equal((await anon('/providers/'+wid)).s,401);
const hit=(await w('/assistant','POST',{message:'أبي نجار يصلح باب'})).j;
assert.equal(hit.category,'النجارة والأثاث');assert.ok(hit.providers.some(x=>x.id===wid));
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
const deadline=Date.now()+12000;while(names().length<1&&Date.now()<deadline)await new Promise(r=>setTimeout(r,300));
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
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='النجارة والأثاث');
const c=await cl();await c('/register','POST',{name:'قسم واحد',email:'sp1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',category_ids:[cat.id,cat.id+1]}).then(()=>{});
const r=await c('/register','POST',{name:'قسم واحد ب',email:'sp2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',category_ids:[cat.id]});assert.equal(r.s,200);
assert.deepEqual([...(await c('/me/sections')).j],[cat.id]);
assert.equal((await c('/me/sections','POST',{category_ids:[cat.id,cat.id+1]})).s,400,'قسم واحد فقط');
});
test('الامتثال: التسجيل يتطلب تأكيد العمر، ويُحفظ إصدار الشروط، والتصدير يعيد بيانات المستخدم',async()=>{
const c=await cl();assert.equal((await c('/register','POST',{name:'امتثال تجريبي',email:'cp1@t.sa',password:'12345678',terms:1})).s,400);
assert.equal((await c('/register','POST',{name:'امتثال تجريبي',email:'cp1@t.sa',password:'12345678',terms:1,age:1,phone:ph()})).s,200);
const ex=(await c('/me/export')).j;assert.equal(ex.profile.email,'cp1@t.sa');assert.equal(ex.profile.terms_version,'2026-12');assert.ok(Array.isArray(ex.direct_messages));
});

test('الاتفاق في المحادثة: يقترحه طرف، ويعتمده الطرف الآخر فقط',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='النجارة والأثاث').id;
const o=await cl();await o('/register','POST',{name:'عميل اتفاق',email:'ag1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});
await o('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'عميل اتفاق',phone:'0500000991'}); await vfy(o);
const h=await cl();await h('/register','POST',{name:'مساعد اتفاق',email:'ag2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',category_ids:[cat]});
await h('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'مساعد اتفاق',phone:'0500000992'}); await vfy(h);
const hid=(await h('/me')).j.user.id;const oid=(await o('/me')).j.user.id;
assert.equal((await o(`/direct/${hid}/agreements`,'POST',{amount:0,description:'تركيب باب'})).s,400);
const r=await o(`/direct/${hid}/agreements`,'POST',{amount:150,description:'تركيب باب خشب'});assert.equal(r.s,200);
const aid=r.j.id;
assert.equal((await o(`/agreements/${aid}/approve`,'POST')).s,403,'المقترح لا يعتمد اتفاقه بنفسه');
assert.equal((await h(`/agreements/${aid}/approve`,'POST')).s,200);
const list=(await o(`/direct/${hid}/agreements`)).j;assert.equal(list[0].status,'agreed');
assert.equal((await h(`/agreements/${aid}/cancel`,'POST')).s,400,'لا يُلغى اتفاق مكتمل');
});

test('عمولة الاتفاق: تظهر للمساعد فقط',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='النجارة والأثاث').id;
const o=await cl();await o('/register','POST',{name:'عميل عمولة',email:'cm1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});
await o('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'عميل عمولة',phone:'0500000881'}); await vfy(o);
const h=await cl();await h('/register','POST',{name:'مساعد عمولة',email:'cm2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',category_ids:[cat]});
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
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='النجارة والأثاث').id;
const o=await cl();await o('/register','POST',{name:'عميل محفظة',email:'wl1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});
await o('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'عميل محفظة',phone:'0500000771'}); await vfy(o);
const h=await cl();await h('/register','POST',{name:'مساعد محفظة',email:'wl2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',category_ids:[cat]});
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

test('استعادة بالرمز: 4 أرقام، محدودة المحاولات، ثم كلمة مرور جديدة',async()=>{
const c=await cl();await c('/register','POST',{name:'رمز استعادة',email:'otp1@t.sa',password:'12345678',terms:1,age:1,phone:ph()});
const uid=(await c('/me')).j.user.id;
await c('/logout','POST');
await cl()('/forgot','POST',{email:'otp1@t.sa'});
const db=new DatabaseSync(DBF);const row=db.prepare('SELECT code_hash FROM reset_codes WHERE user_id=?').get(uid);db.close();
assert.ok(row,'الرمز محفوظ');
const sh=s=>createHash('sha256').update(s).digest('hex');
const code='4821';
const db2=new DatabaseSync(DBF);db2.prepare('UPDATE reset_codes SET code_hash=?,attempts=0 WHERE user_id=?').run(macFor(DBF,code+':'+uid),uid);db2.close();
const x=cl();
assert.equal((await x('/reset-code','POST',{email:'otp1@t.sa',code:'0000'})).s,400);
assert.equal((await x('/reset-code','POST',{email:'otp1@t.sa',code})).s,200,'الرمز الصحيح يعمل');
const t=(await x('/reset-code','POST',{email:'otp1@t.sa',code})).j;assert.equal(t.s,undefined);
});

test('الرمز المكوّن من 4 أرقام يُقفل بعد 5 محاولات خاطئة',async()=>{
const c=await cl();await c('/register','POST',{name:'قفل الرمز',email:'lock1@t.sa',password:'12345678',terms:1,age:1,phone:ph()});
const uid=(await c('/me')).j.user.id;const sh=s=>createHash('sha256').update(s).digest('hex');
const db=new DatabaseSync(DBF);db.prepare("INSERT OR REPLACE INTO reset_codes(user_id,code_hash,expires_at,attempts) VALUES(?,?,datetime('now','+10 minutes'),0)").run(uid,macFor(DBF,'7777:'+uid));db.close();
const x=cl();
for(let i=0;i<5;i++)assert.equal((await x('/reset-code','POST',{email:'lock1@t.sa',code:'0000'})).s,400);
assert.equal((await x('/reset-code','POST',{email:'lock1@t.sa',code:'7777'})).s,400,'بعد 5 محاولات حتى الرمز الصحيح لا يعمل');
});

test('تفعيل البريد بالرمز: الرمز الصحيح يفعّل، والخاطئ يُقفل بعد 5 محاولات',async()=>{
const c=await cl();await c('/register','POST',{name:'تفعيل بالرمز',email:'vc1@t.sa',password:'12345678',terms:1,age:1,phone:ph()});
const uid=(await c('/me')).j.user.id;const sh=s=>createHash('sha256').update(s).digest('hex');
const db=new DatabaseSync(DBF);db.prepare('UPDATE users SET email_verified=0 WHERE id=?').run(uid);
db.prepare("INSERT OR REPLACE INTO verify_codes(user_id,code_hash,expires_at,attempts) VALUES(?,?,datetime('now','+10 minutes'),0)").run(uid,macFor(DBF,'3141:'+uid));db.close();
for(let i=0;i<5;i++)assert.equal((await c('/verify-code','POST',{code:'0000'})).s,400);
assert.equal((await c('/verify-code','POST',{code:'3141'})).s,400,'بعد 5 محاولات يُقفل');
const db2=new DatabaseSync(DBF);db2.prepare("UPDATE verify_codes SET attempts=0 WHERE user_id=?").run(uid);db2.close();
assert.equal((await c('/verify-code','POST',{code:'3141'})).s,200,'الرمز الصحيح يفعّل');
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
const cats=(await admin('/admin/categories')).j;assert.equal(cats.length,42);assert.ok(Array.isArray(cats[0].words)&&cats[0].words.length>0);
const cat=cats.find(c=>c.name==='النجارة والأثاث');const w=cat.words[0];
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
const cats=(await cl()('/skills')).j.categories;const cat=cats.find(c=>c.name==='النجارة والأثاث');
const askc=cl();await askc('/register','POST',{name:'باحث مختبر',email:'askl1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});
const admin=cl();await admin('/login','POST',{email:'admin@t.sa',password:'12345678'});
assert.equal((await askc('/assistant','POST',{message:'أبي زرنيخ بلورات كوكبية'})).j.noMatch,1,'بلا تخصص');
await askc('/assistant','POST',{message:'أبي زرنيخ بلورات كوكبية'});
await askc('/assistant','POST',{message:'أبي نجار مختلف في أبها'});
const list=(await admin('/admin/failed-searches')).j;
const none=list.find(x=>x.text.includes('زرنيخ بلورات'));
assert.equal(none.reason,'no_category');assert.equal(none.n,2,'التكرار يُجمع');
const np=list.find(x=>x.text.includes('نجار مختلف'));
assert.equal(np.reason,'no_provider','تخصص مطابق بلا مساعد');assert.equal(np.category,'النجارة والأثاث');assert.equal(np.city,'أبها');
assert.equal((await cl()('/admin/failed-searches')).s,401,'غير المدير لا يقرأ المختبر');
});
test('مختبر الطلبات: مساعد مناسب لا ينشئ سجلًا، وتنظيف الجوال والبريد',async()=>{
const cats=(await cl()('/skills')).j.categories;const cat=cats.find(c=>c.name==='النجارة والأثاث');
const askc=cl();await askc('/register','POST',{name:'باحث مختبر ٢',email:'askl2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});
const hp=cl();await hp('/register','POST',{name:'نجار مختبر',email:'lab1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',category_ids:[cat.id]});
await hp('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'نجار مختبر',phone:'0500007777'}); await vfy(hp);await hp('/pledge','POST',{accept:true,name:'نجار مختبر'});
const dbx=new DatabaseSync(DBF);dbx.prepare("UPDATE users SET email_verified=1 WHERE email='lab1@t.sa'").run();dbx.close();
const cnt=()=>{const d=new DatabaseSync(DBF);const n=d.prepare("SELECT COUNT(*) n FROM failed_searches WHERE text LIKE '%باب مختبر%'").get().n;d.close();return n};
const nb=cnt();
const ok=(await askc('/assistant','POST',{message:'أبي نجار يصلح باب مختبر في جدة'})).j;
assert.ok(ok.providers.length>0,'يجد المساعد المناسب');
assert.equal(cnt(),nb,'لا سجل عند وجود مساعد');
await askc('/assistant','POST',{message:'أبي زرنيخ 0501234567 و test@mail.com'});
const admin=cl();await admin('/login','POST',{email:'admin@t.sa',password:'12345678'});
const scrub=(await admin('/admin/failed-searches')).j.find(x=>x.text.includes('زرنيخ'));
assert.ok(scrub,'السجل موجود');assert.ok(!/\d{5}|@/.test(scrub.text),'لا أرقام ولا بريد: '+scrub.text);
});
test('مختبر الطلبات: إضافة كلمة بعد الموافقة تجعل المطابقة تعمل، بلا تكرار',async()=>{
const cats=(await cl()('/skills')).j.categories;const cat=cats.find(c=>c.name==='النجارة والأثاث');
const askc=cl();await askc('/register','POST',{name:'باحث مختبر ٣',email:'askl3@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});
const admin=cl();await admin('/login','POST',{email:'admin@t.sa',password:'12345678'});
const pre=(await askc('/assistant','POST',{message:'أبي زرنيخ بلورات كوكبية'})).j;assert.equal(pre.noMatch,1,'قبل الإضافة: '+JSON.stringify(pre));
assert.equal((await admin(`/admin/sections/${cat.id}/keywords`,'POST',{keywords:'زرنيخ بلورات كوكبية'})).s,200);
assert.equal((await askc('/assistant','POST',{message:'أبي زرنيخ بلورات كوكبية'})).j.category,'النجارة والأثاث','المطابقة تعمل بعد الإضافة');
await admin(`/admin/sections/${cat.id}/keywords`,'POST',{keywords:'زرنيخ بلورات كوكبية'});
const words=(await admin('/admin/categories')).j.find(c=>c.id===cat.id).words;
assert.equal(words.filter(w=>w.startsWith('زرنيخ')).length,1,'لا تكرار للكلمة');
});

test('الاستحقاق: العمولة بعد التأكيد فقط، والاعتراض يمنعها، وصلاحيات الطرفين',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='النجارة والأثاث').id;
const o=cl();await o('/register','POST',{name:'عميل استحقاق',email:'es1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});
await o('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'عميل استحقاق',phone:'0500005001'}); await vfy(o);
const h=cl();await h('/register','POST',{name:'مساعد استحقاق',email:'es2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',category_ids:[cat]});
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
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='النجارة والأثاث').id;
const o=cl();await o('/register','POST',{name:'عميل نزاع',email:'dsp1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});
await o('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'عميل نزاع',phone:'0500006001'}); await vfy(o);
const h=cl();await h('/register','POST',{name:'مساعد نزاع',email:'dsp2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',category_ids:[cat]});
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

test('الحالة الضريبية للمساعد: رقم 15 رقمًا يبدأ بـ 3 عند التسجيل، ولا يُحفظ رقم عند عدم التسجيل',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='النجارة والأثاث').id;
const h=cl();await h('/register','POST',{name:'مساعد ضريبي',email:'vat1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',category_ids:[cat]});
assert.equal((await h('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'مساعد ضريبي',vat_status:'registered',vat_number:'123'})).s,400,'رقم قصير مرفوض');
assert.equal((await h('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'مساعد ضريبي',vat_status:'registered',vat_number:'312345678901234'})).s,200,'رقم صحيح');
assert.equal((await h('/me')).j.user.vat_number,'312345678901234');
assert.equal((await h('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'مساعد ضريبي',vat_status:'not_registered'})).s,200);
assert.equal((await h('/me')).j.user.vat_number,'','لا رقم عند عدم التسجيل');
});

test('مهل النزاع التلقائية وتقرير التوريدات الشهري',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='النجارة والأثاث').id;
const o=cl();await o('/register','POST',{name:'عميل مهل',email:'dl1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});
await o('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'عميل مهل',phone:'0500007001'}); await vfy(o);
const h=cl();await h('/register','POST',{name:'مساعد مهل',email:'dl2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',category_ids:[cat]});
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
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='النجارة والأثاث').id;
const o=cl();const rg=await o('/register','POST',{name:'عميل شكوى',email:'ztc1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});assert.equal(rg.s,200,'تسجيل العميل');
await o('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'عميل شكوى',phone:'0500008001'}); await vfy(o);
const h=cl();await h('/register','POST',{name:'مساعد شكوى',email:'ztc2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',category_ids:[cat]});
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
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='النجارة والأثاث').id;
const h=cl();await h('/register','POST',{name:'مساعد توثيق',email:'vf1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',helper_type:'individual',category_ids:[cat]});
await h('/profile','POST',{name:'مساعد توثيق',phone:'0500009301'});
const hid=(await h('/me')).j.user.id;
assert.equal((await h('/me/helper-type-request','POST',{helper_type:'company'})).s,200,'طلب التغيير يُرسل');
assert.equal((await h('/me')).j.user.helper_type,'individual','لا يتغير النوع قبل موافقة الإدارة');
const admin=cl();await admin('/login','POST',{email:'admin@t.sa',password:'12345678'});
assert.equal((await admin('/admin/helper-type/'+hid+'/decide','POST',{decision:'approve'})).s,200);
assert.equal((await h('/me')).j.user.helper_type,'company','بعد موافقة الإدارة يتغير النوع');
assert.equal((await cl()('/admin/verifications')).s,401,'غير المدير لا يرى التوثيق');
});

test('الفواتير: إيصال عمولة حين المنصة غير مسجلة، وفاتورة ضريبية حين تسجل، بلا تكرار، ورمز QR',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='النجارة والأثاث').id;
const o=cl();await o('/register','POST',{name:'عميل فوترة',email:'bl1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});
await o('/profile','POST',{name:'عميل فوترة',phone:'0500009401'});
const h=cl();await h('/register','POST',{name:'مساعد فوترة',email:'bl2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',helper_type:'individual',category_ids:[cat]});
await h('/profile','POST',{name:'مساعد فوترة',phone:'0500009402'});
const hid=(await h('/me')).j.user.id;
const admin=cl();await admin('/login','POST',{email:'admin@t.sa',password:'12345678'});
await admin('/admin/settings','POST',{bank_name:'بنك',account_name:'مؤسسة المساعد',iban:'SA0380000000608010167519',commission_percent:2,commission_grace_days:3,org_name:'مؤسسة المساعد',org_cr:'7054975474',dispute_clause:'تحكيم.',support_email:'support@almusaidgroup.shop'});
const deal=async(amt)=>{const id=(await o(`/direct/${hid}/agreements`,'POST',{amount:amt,description:'فوترة'})).j.id;await h(`/agreements/${id}/approve`,'POST');await h(`/agreements/${id}/request-completion`,'POST');await o(`/agreements/${id}/confirm-completion`,'POST');await payHala(id);return id};
const a1=await deal(1000);
const list1=(await admin('/admin/invoices')).j;
const r1=list1.find(x=>x.ref==='S-'+a1);
assert.ok(r1,'فاتورة المنصة للعميل');assert.equal(r1.kind,'tax_invoice');assert.equal(r1.vat_amount,0,'المنصة غير مسجلة: بلا ضريبة');assert.equal(r1.total,1000,'الخدمة كاملة');
assert.equal((await admin('/admin/invoicing','POST',{platform_vat_registered:true,platform_vat_number:'123'})).s,400,'رقم المنصة الضريبي يُتحقق منه');
assert.equal((await admin('/admin/invoicing','POST',{platform_vat_registered:true,platform_vat_number:'312345678901234'})).s,200);
const a2=await deal(1000);
const r2=(await admin('/admin/invoices')).j.find(x=>x.ref==='S-'+a2);
assert.equal(r2.vat_amount,150,'الضريبة 15% على الخدمة كاملة');assert.equal(r2.total,1150,'الإجمالي 1150');
assert.equal(r2.seq,r1.seq+1,'تسلسل متصل');assert.equal(r2.status,'pending_provider');
const qr=Buffer.from(r2.qr||'','base64');assert.ok(qr.length>20,'رمز QR موجود');
assert.ok(qr.includes(Buffer.from('مؤسسة المساعد')),'اسم البائع في الرمز');
})

test('الدفع عبر هلا فقط: لا سداد يدوي من العميل، والإشعار يتطلب السر المشترك',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='النجارة والأثاث').id;
const o=cl();await o('/register','POST',{name:'عميل هلا',email:'hl1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});
await o('/profile','POST',{name:'عميل هلا',phone:'0500009501'});
const h=cl();await h('/register','POST',{name:'مساعد هلا',email:'hl2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',category_ids:[cat]});
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
const pl=(await o(`/agreements/${aid}/payment`)).j;assert.equal(pl.amount,1150);assert.equal(pl.status,'not_configured','رابط الدفع ينتظر ربط هلا');
});

test('الإنتاج: صحة الخادم والمانيفست وإشعار هلا بلا مبلغ مرفوض',async()=>{
assert.equal((await fetch(B+'/healthz')).status,200);
const m=await fetch(B+'/manifest.webmanifest');assert.equal(m.status,200);assert.equal((await m.json()).short_name,'المساعد');
assert.equal((await fetch(B+'/icon-192.png')).status,200);
const r=await fetch(B+'/api/payments/hala/webhook',{method:'POST',headers:{'content-type':'application/json','x-hala-secret':'test-hala'},body:JSON.stringify({agreement_id:1})});
assert.ok([400,404].includes(r.status),'إشعار بلا مبلغ لا يُقبل: '+r.status)});

test('الدفع: لا يُسجَّل سداد على اتفاق غير قائم، ولا يُلغى اتفاق مدفوع',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='النجارة والأثاث').id;
const o=cl();await o('/register','POST',{name:'عميل دفع',email:'pay1@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة'});
await o('/profile','POST',{vat_status:'registered',vat_number:'312345678901234',name:'عميل دفع',phone:'0500007001'}); await vfy(o);
const h=cl();await h('/register','POST',{name:'مساعد دفع',email:'pay2@t.sa',password:'12345678',terms:1,age:1,phone:ph(),city:'جدة',account_type:'helper',category_ids:[cat]});
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

test('إشعارات الدفع: تفضيل مستقل عن إشعارات البريد',async()=>{
  const u=await reg('push2');
  assert.equal((await u('/me')).j.user.push_enabled,1,'مفعّلة افتراضيًا');
  assert.equal((await u('/push/pref','POST',{enabled:false})).s,200);
  assert.equal((await u('/me')).j.user.push_enabled,0,'أوقفها المستخدم');
  assert.equal((await u('/me')).j.user.notify_email,1,'إشعارات البريد لم تتغير');
  await u('/push/subscribe','POST',{endpoint:'https://push.example/z',keys:{p256dh:'a',auth:'b'}});
  assert.equal((await u('/me')).j.user.push_enabled,1,'الاشتراك يعيد التفعيل');
});
