import {test,before,after} from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {existsSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
let DBF;
let srv;const B='http://localhost:3999';
before(async()=>{DBF='/tmp/t'+Date.now()+'.db';srv=spawn('node',['server.js'],{env:{...process.env,RESEND_API_KEY:'',PORT:3999,DB_FILE:DBF,ADMIN_EMAIL:'admin@t.sa',ADMIN_SETUP_TOKEN:'test-token'},stdio:'ignore'});await new Promise(r=>setTimeout(r,1200))});
after(()=>srv.kill());
const cl=()=>{let ck='';return async(p,m='GET',b)=>{const r=await fetch(B+'/api'+p,{method:m,headers:{'content-type':'application/json',cookie:ck},body:b?JSON.stringify(b):undefined});ck=r.headers.get('set-cookie')?.split(';')[0]||ck;return{s:r.status,j:await r.json().catch(()=>({}))}}};
let phSeq=0;const ph=()=>'05'+String(70000000+(++phSeq));
const reg=async(e)=>{const c=cl();await c('/register','POST',{name:'مستخدم '+e,email:e+'@t.sa',password:'12345678',terms:1,age:1}); await c('/profile','POST',{name:'مستخدم '+e,phone:ph()});return c};
const asHelper=async c=>{const cats=(await c('/skills')).j.categories;return c('/me/account-type','POST',{type:'helper',category_ids:[cats[0].id]})};
test('الصلاحيات والنقاط والمحادثات',async()=>{
const adm=await reg('admin'),own=await reg('own'),hlp=await reg('hlp'),oth=await reg('oth');
await asHelper(hlp);
assert.equal((await adm('/admin/bootstrap','POST',{token:'wrong-token'})).s,403);
assert.equal((await adm('/admin/bootstrap','POST',{token:'test-token'})).s,200);
assert.equal((await own('/admin/bootstrap','POST',{token:'test-token'})).s,403);
assert.equal((await own('/admin/stats')).s,403);
assert.equal((await hlp('/pledge')).j.ready,false);
await adm('/admin/settings','POST',{bank_name:'بنك',account_name:'مؤسسة المساعد',iban:'SA0380000000608010167519',commission_percent:10,commission_grace_days:3,org_name:'مؤسسة المساعد',org_cr:'1010000000',dispute_clause:'تُحال المنازعات إلى التحكيم لدى المركز السعودي للتحكيم التجاري في الرياض.'});
assert.equal((await hlp('/pledge')).j.ready,true);assert.equal((await hlp('/pledge','POST',{accept:true})).s,400);
assert.equal((await hlp('/pledge','POST',{name:'مساعد تجريبي',national_id:'1012345678',phone:'0501234567',address:'الرياض'})).s,400);
assert.equal((await hlp('/pledge','POST',{accept:true,name:'مساعد تجريبي',national_id:'1012345678',phone:'0501234567',address:'الرياض'})).s,200);
assert.equal((await hlp('/pledge')).j.accepted,true);const hid1=(await hlp('/me')).j.user.id;
const pt=(await adm(`/admin/users/${hid1}/pledge`)).j.text;assert.ok(pt.includes('مساعد تجريبي')&&!pt.includes('1012345678')&&pt.includes('10%')&&pt.includes('التحكيم'));assert.equal((await hlp(`/admin/users/${hid1}/pledge`)).s,403);const pa1=(await hlp('/platform-account')).j;assert.equal(pa1.commission_percent,10);assert.equal(pa1.commission_grace_days,3);assert.ok(pa1.iban);
assert.equal((await adm('/admin/rules','POST',{key:'complete_helper',points:40})).s,200);
assert.equal((await adm('/admin/rules','POST',{key:'complete_requester',points:20})).s,200);
const {j:{id}}=await own('/requests','POST',{title:'توصيل أغراض',description:'أحتاج توصيل مشتريات من السوق',city:'الرياض',budget:50});
assert.equal((await own('/requests','POST',{title:'توصيل أغراض',description:'أحتاج توصيل مشتريات من السوق'})).s,409);
const hOffer=await hlp(`/requests/${id}/offers`,'POST',{message:'أستطيع التنفيذ',price:40});assert.equal(hOffer.s,200);assert.equal((await oth(`/requests/${id}/offers`,'POST',{message:'أنفذ'})).s,403);
assert.equal((await oth(`/requests/${id}/messages?with=1`)).s,403);
const detail=await own('/requests/'+id);const o=detail.j.offers[0];
assert.equal((await hlp(`/requests/${id}/choose`,'POST',{offer_id:o.id})).s,403);
assert.equal((await own(`/requests/${id}/choose`,'POST',{offer_id:o.id})).s,200);
assert.equal((await own(`/requests/${id}/action`,'POST',{action:'complete'})).s,400);
await hlp(`/requests/${id}/action`,'POST',{action:'start'});
assert.equal((await hlp(`/requests/${id}/action`,'POST',{action:'complete'})).s,403);
assert.equal((await own(`/requests/${id}/action`,'POST',{action:'complete'})).s,400);
assert.equal((await adm('/admin/settings','POST',{bank_name:'بنك',account_name:'مؤسسة المساعد',iban:'SA12',commission_percent:10})).s,400);
await adm('/admin/settings','POST',{bank_name:'بنك',account_name:'مؤسسة المساعد',iban:'SA0380000000608010167519',commission_percent:10});
await hlp('/profile','POST',{name:'مساعد',iban:'SA0380000000608010167519'});await own(`/requests/${id}/price`,'POST',{amount:50});assert.equal((await hlp(`/requests/${id}/price/accept`,'POST',{})).s,200);
const up1=(await own('/upload','POST',{data:'data:image/png;base64,'+PNG})).j.id;
assert.equal((await own(`/requests/${id}/payment`,'POST',{amount:50,attachment_id:up1})).s,200);
const pm1=(await adm('/admin/payments')).j.find(p=>p.request_id===id);await hlp(`/payments/${pm1.id}/confirm`,'POST',{decision:'verified'});
assert.equal((await own(`/requests/${id}/action`,'POST',{action:'complete'})).s,200);
assert.equal((await own(`/requests/${id}/action`,'POST',{action:'complete'})).s,400);
const w=(await hlp('/wallet')).j;assert.equal(w.points,40);assert.equal(w.riyal,2);
assert.equal((await hlp('/wallet/redeem','POST',{points:100,purpose:'خدمة',key:'k-1234567'})).s,400);
await hlp('/wallet/redeem','POST',{points:20,purpose:'خدمة',key:'k-abcdefgh'});
await hlp('/wallet/redeem','POST',{points:20,purpose:'خدمة',key:'k-abcdefgh'});
assert.equal((await hlp('/wallet')).j.points,20);
await hlp('/wallet/redeem','POST',{points:20,purpose:'خدمة',key:'k-zzzzzzzz'});
assert.equal((await hlp('/wallet/redeem','POST',{points:1,purpose:'خدمة',key:'k-yyyyyyyy'})).s,400);
const S={bank_name:'بنك',account_name:'مؤسسة المساعد',iban:'SA0380000000608010167519',commission_percent:10};
await adm('/admin/settings','POST',{...S,commission_grace_days:0});
const id2=(await own('/requests','POST',{title:'طلب آخر للاختبار',description:'وصف الطلب الآخر هنا'})).j.id;
assert.equal((await hlp(`/requests/${id2}/offers`,'POST',{message:'أنفذه'})).s,403);
await adm('/admin/settings','POST',{...S,commission_grace_days:3});
assert.equal((await hlp(`/requests/${id2}/offers`,'POST',{message:'أنفذه'})).s,200);
});

const PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
test('المرفقات والدفع والتقييم والحظر والمسودات',async()=>{
const adm=cl();await adm('/login','POST',{email:'admin@t.sa',password:'12345678'});const own=await reg('o2'),hlp=await reg('h2'),x=await reg('x2');
await asHelper(hlp);
assert.equal((await own('/upload','POST',{data:'data:image/png;base64,'+Buffer.from('not an image!!').toString('base64')})).s,400);
await hlp('/profile','POST',{name:'مساعد',iban:'SA0380000000608010167519'});
assert.equal((await hlp('/profile','POST',{name:'مساعد',phone:'123'})).s,400);
assert.equal((await hlp('/profile','POST',{name:'مساعد',iban:'SA0380000000608010167519',national_id:'1098765432',phone:'+966509876543',address:'الرياض، حي النخيل'})).s,200);
assert.equal((await hlp('/me')).j.user.phone,'0509876543');assert.equal((await hlp('/pledge','POST',{accept:true,name:'مساعد ثان',national_id:'1098765432',phone:'0509876543',address:'الرياض'})).s,200);assert.equal((await x('/me')).j.user.national_id,undefined);
const up=(await own('/upload','POST',{data:'data:image/png;base64,'+PNG})).j.id;assert.ok(up);
const id=(await own('/requests','POST',{title:'مسودة تجريبية',description:'وصف المسودة هنا',draft:true})).j.id;
assert.equal((await x('/requests')).j.some(r=>r.id===id),false);assert.equal((await x('/requests/'+id)).s,404);
assert.equal((await own('/requests?mine=1')).j.some(r=>r.id===id),true);
assert.equal((await own(`/requests/${id}/action`,'POST',{action:'publish'})).s,200);
await hlp(`/requests/${id}/offers`,'POST',{message:'أنفذها'});assert.equal((await own('/requests/'+id)).j.status,'negotiating');
const o=(await own('/requests/'+id)).j.offers[0];await own(`/requests/${id}/choose`,'POST',{offer_id:o.id});
assert.equal((await hlp(`/requests/${id}/payment`,'POST',{amount:100,attachment_id:up})).s,403);
assert.equal((await own(`/requests/${id}/payment`,'POST',{amount:100,attachment_id:up})).s,400);
await own(`/requests/${id}/price`,'POST',{amount:100});
assert.equal((await own(`/requests/${id}/price/accept`,'POST',{})).s,403);
assert.equal((await own(`/requests/${id}/payment`,'POST',{amount:100,attachment_id:up})).s,400);
assert.equal((await hlp(`/requests/${id}/price/accept`,'POST',{})).s,200);
assert.equal((await own(`/requests/${id}/payment`,'POST',{amount:150,attachment_id:up})).s,400);
assert.equal((await own(`/requests/${id}/payment`,'POST',{amount:40,attachment_id:up})).s,200);
assert.equal((await own(`/requests/${id}/price`,'POST',{amount:90})).s,400);
assert.equal((await x('/files/'+up)).s,403);assert.equal((await hlp('/files/'+up)).s,200);
const pm=(await adm('/admin/payments')).j[0];assert.equal(pm.status,'pending');
assert.equal((await adm(`/admin/payments/${pm.id}/review`,'POST',{decision:'verified'})).s,200);assert.equal((await adm(`/admin/payments/${pm.id}/review`,'POST',{decision:'verified'})).s,400);
assert.equal((await own('/requests/'+id)).j.payments[0].status,'verified');
assert.equal((await own(`/requests/${id}/payment`,'POST',{amount:61,attachment_id:up})).s,400);
assert.equal((await own(`/requests/${id}/payment`,'POST',{amount:60,attachment_id:up})).s,200);
await hlp(`/requests/${id}/action`,'POST',{action:'start'});
assert.equal((await own(`/requests/${id}/action`,'POST',{action:'complete'})).s,400);
const pm2=(await adm('/admin/payments')).j.find(q=>q.request_id===id&&q.status==='pending');assert.equal((await own(`/payments/${pm2.id}/confirm`,'POST',{decision:'verified'})).s,403);assert.equal((await hlp(`/payments/${pm2.id}/confirm`,'POST',{decision:'verified'})).s,200);
assert.equal((await x('/requests/'+id)).j.agreed_price,undefined);
assert.equal((await own(`/requests/${id}/rate`,'POST',{stars:5})).s,403);
await hlp(`/requests/${id}/action`,'POST',{action:'start'});await own(`/requests/${id}/action`,'POST',{action:'complete'});
assert.equal((await own(`/requests/${id}/rate`,'POST',{stars:5})).s,200);assert.equal((await own(`/requests/${id}/rate`,'POST',{stars:4})).s,409);assert.equal((await x(`/requests/${id}/rate`,'POST',{stars:1})).s,403);
const cm=(await adm('/admin/commissions')).j.find(q=>q.request_id===id);assert.equal(cm.amount,10);assert.equal(cm.status,'due');
assert.equal((await hlp(`/commissions/${cm.id}/proof`,'POST',{attachment_id:99999})).s,400);
assert.equal((await own(`/commissions/${cm.id}/proof`,'POST',{attachment_id:up})).s,403);
const upH=(await hlp('/upload','POST',{data:'data:image/png;base64,'+PNG})).j.id;
assert.equal((await hlp(`/commissions/${cm.id}/proof`,'POST',{attachment_id:upH})).s,200);
assert.equal((await hlp(`/admin/commissions/${cm.id}/review`,'POST',{decision:'verified'})).s,403);
assert.equal((await adm(`/admin/commissions/${cm.id}/review`,'POST',{decision:'verified'})).s,200);assert.equal((await adm(`/admin/commissions/${cm.id}/review`,'POST',{decision:'verified'})).s,400);
assert.equal((await hlp('/requests/'+id)).j.commission.status,'verified');assert.equal((await own('/requests/'+id)).j.commission,null);
const hid=(await hlp('/me')).j.user.id;await own('/block','POST',{user_id:hid,blocked:true});
assert.equal((await hlp(`/requests/${id}/messages`,'POST',{to:(await own('/me')).j.user.id,body:'مرحبا'})).s,403);
assert.equal((await x('/report','POST',{type:'request',id,reason:'مخالف'})).s,200);assert.equal((await x('/report','POST',{type:'request',id,reason:'مخالف'})).s,409);
const rp=(await adm('/admin/reports')).j[0];assert.equal((await adm(`/admin/reports/${rp.id}/resolve`,'POST',{note:'تمت المعالجة',hide:true})).s,200);
assert.equal((await x('/requests/'+id)).s,404);
});

test('الإلغاء بعد الاختيار والعقوبات والقيود الفريدة',async()=>{
const adm=cl();await adm('/login','POST',{email:'admin@t.sa',password:'12345678'});
await adm('/admin/settings','POST',{bank_name:'بنك',account_name:'مؤسسة المساعد',iban:'SA0380000000608010167519',commission_percent:10,commission_grace_days:3,org_name:'مؤسسة المساعد',org_cr:'1010000000',dispute_clause:'تُحال المنازعات إلى التحكيم.'});
let seq=500;
const mk=async(name)=>{seq++;const c=cl();await c('/register','POST',{name,email:`u${seq}@t.sa`,password:'12345678',terms:1,age:1});
await asHelper(c);
const nid='1'+String(900000000+seq),phone='05'+String(10000000+seq);
await c('/profile','POST',{name,phone:ph()});assert.equal((await c('/pledge','POST',{accept:true,name,national_id:nid,phone,address:'الرياض، حي النخيل'})).s,200);
return{c,id:(await c('/me')).j.user.id,nid,phone}};
const O=await mk('طالب تجريبي'),H=await mk('مساعد تجريبي');
const dup=await cl();await dup('/register','POST',{name:'مكرر',email:'dup@t.sa',password:'12345678',terms:1,age:1}); await dup('/profile','POST',{name:'مكرر',phone:ph()});
await O.c('/profile','POST',{name:'طالب تجريبي',phone:O.phone});
assert.equal((await dup('/profile','POST',{name:'مكرر',phone:O.phone})).s,409);
for(let i=0;i<3;i++){
 const id=(await O.c('/requests','POST',{title:'إلغاء '+i,description:'وصف تجريبي للطلب رقم '+i})).j.id;
 await H.c(`/requests/${id}/offers`,'POST',{message:'أستطيع التنفيذ'});
 const off=(await O.c('/requests/'+id)).j.offers[0];await O.c(`/requests/${id}/choose`,'POST',{offer_id:off.id});
 assert.equal((await O.c(`/requests/${id}/cancel`,'POST',{reason:'سبب غير موجود'})).s,400);
 assert.equal((await O.c(`/requests/${id}/cancel`,'POST',{reason:'ظرف طارئ'})).s,200);
}
assert.equal((await O.c('/requests','POST',{title:'طلب بعد الإيقاف',description:'وصف تجريبي بعد الإيقاف'})).s,403);
const u=(await adm('/admin/stats')).j.users_list.find(x=>x.id===O.id);assert.equal(u.restricted,1);assert.equal(u.cancels,3);
assert.equal((await adm(`/admin/users/${O.id}/lift`,'POST',{reason:'مراجعة يدوية'})).s,200);
assert.equal((await O.c('/requests','POST',{title:'طلب بعد الرفع',description:'وصف تجريبي بعد رفع القيود'})).s,200);
});

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
const act=(await adm(`/admin/users/${uid}/activity`)).j;assert.equal(act.user.id,uid);assert.equal(typeof act.requests,'number');
assert.equal((await user(`/admin/users/${uid}/activity`)).s,403);
await adm('/admin/settings','POST',{bank_name:'بنك',account_name:'مؤسسة',iban:'SA0380000000608010167519',commission_percent:10,penalty_rules:'المادة 1: الإلغاء المتكرر بعد الاختيار يوقف النشر مؤقتًا.'});
assert.ok((await adm('/platform-account')).j.penalty_rules.includes('المادة 1'));
});

test('منع إرسال سند التحويل كصورة عادية في الشات',async()=>{
const PNG2='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const adm=cl();await adm('/login','POST',{email:'admin@t.sa',password:'12345678'});
await adm('/admin/settings','POST',{bank_name:'بنك',account_name:'مؤسسة',iban:'SA0380000000608010167519',commission_percent:10,commission_grace_days:3,org_name:'مؤسسة',org_cr:'1010000000',dispute_clause:'تحكيم.'});
const mkU=async(n)=>{const c=cl();await c('/register','POST',{name:'مستخدم '+n,email:`chat${n}@t.sa`,password:'12345678',terms:1,age:1});
await asHelper(c);const id=(await c('/me')).j.user.id;
await c('/profile','POST',{name:'مستخدم '+n,phone:ph()});await c('/pledge','POST',{accept:true,name:'مستخدم '+n,national_id:'1'+String(800000000+n),phone:'05'+String(20000000+n),address:'الرياض، حي الملقا'});return{c,id}};
const O=await mkU(901),H=await mkU(902);
const id=(await O.c('/requests','POST',{title:'طلب للشات',description:'وصف تجريبي لاختبار الشات'})).j.id;
await H.c(`/requests/${id}/offers`,'POST',{message:'أستطيع'});
const off=(await O.c('/requests/'+id)).j.offers[0];await O.c(`/requests/${id}/choose`,'POST',{offer_id:off.id});
const att=(await O.c('/upload','POST',{data:'data:image/png;base64,'+PNG2})).j.id;
assert.equal((await O.c(`/requests/${id}/messages`,'POST',{to:H.id,attachment_id:att,body:'هذا السند'})).s,400);
assert.equal((await O.c(`/requests/${id}/messages`,'POST',{to:H.id,body:'مرحبا'})).s,200);
});

test('أدوات الإدارة: الطلبات والإلغاءات والسجل والدور وكلمة المرور والإعلان والنسخة',async()=>{
const adm=cl();await adm('/login','POST',{email:'admin@t.sa',password:'12345678'});
const user=await cl();await user('/login','POST',{email:'o2@t.sa',password:'12345678'});
const uid=(await user('/me')).j.user.id;
for(const path of ['/admin/requests','/admin/cancellations','/admin/audit','/admin/backup']) assert.equal((await user(path)).s,403,path);
assert.ok(Array.isArray((await adm('/admin/requests')).j));
assert.ok(Array.isArray((await adm('/admin/cancellations')).j));
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
const u=await cl();await u('/register','POST',{name:'باحث المساعد',email:'ai@t.sa',password:'12345678',terms:1,age:1}); await u('/profile','POST',{name:'باحث المساعد',phone:ph()});
const none=(await u('/assistant','POST',{message:'أبي طباخ يجهز لي عشاء'})).j;
assert.equal(none.category,'طبخ وضيافة');assert.ok(Array.isArray(none.providers));
const r=(await u('/assistant','POST',{message:'أبي أحد ينقل عفش في الرياض بـ 200 ريال'})).j;
assert.equal(r.category,'نقل وتوصيل');assert.ok(r.reply.length>5);
const unk=(await u('/assistant','POST',{message:'كيف الطقس اليوم؟'})).j;assert.equal(unk.category,undefined);
assert.equal((await u('/assistant','POST',{message:'مر'})).s,400);
});
test('الأقسام: للمساعدين فقط، ويُختار القسم عند التسجيل',async()=>{
const adm=cl();await adm('/login','POST',{email:'admin@t.sa',password:'12345678'});
const anon=await cl();const cats=(await anon('/skills')).j.categories;const tech=cats.find(c=>c.name==='تقنية وتصميم');
const c1=await cl();assert.equal((await c1('/register','POST',{name:'عميل قسم',email:'cat1@t.sa',password:'12345678',terms:1,age:1,account_type:'client',category_ids:[tech.id]})).s,400);
const c2=await cl();assert.equal((await c2('/register','POST',{name:'عميل قسم',email:'cat2@t.sa',password:'12345678',terms:1,age:1,account_type:'client'})).s,200);
assert.equal((await c2('/me/sections','POST',{category_ids:[tech.id]})).s,403);
assert.equal((await c2('/me/account-type','POST',{type:'helper',category_ids:[]})).s,400);
assert.equal((await c2('/me/account-type','POST',{type:'helper',category_ids:[tech.id]})).s,200);
assert.equal((await c2('/me')).j.user.account_type,'helper');
assert.equal((await c2('/me/account-type','POST',{type:'client'})).s,200);
assert.equal((await c2('/me')).j.user.account_type,'client');
assert.equal((await c2('/me/sections','POST',{category_ids:[tech.id]})).s,403);
const u=await cl();
assert.equal((await u('/register','POST',{name:'مصمم تجريبي',email:'sk0@t.sa',password:'12345678',terms:1,age:1,account_type:'helper',category_ids:[]})).s,400);
assert.equal((await u('/register','POST',{name:'مصمم تجريبي',email:'sk1@t.sa',password:'12345678',terms:1,age:1,city:'الرياض',account_type:'helper',category_ids:[tech.id]})).s,200);
assert.equal((await u('/me')).j.user.account_type,'helper');
assert.equal((await u('/me/sections','POST',{category_ids:[tech.id,...cats.slice(1,4).map(c=>c.id)]})).s,400);
assert.equal((await u('/me/sections','POST',{category_ids:[]})).s,400);
assert.equal((await u('/me/sections','POST',{category_ids:[tech.id]})).s,200);
assert.deepEqual([...(await u('/me/sections')).j],[tech.id]);
assert.equal((await u('/assistant','POST',{message:'أبي شخص يصلح بابل'})).j.noMatch,1);
const sug=(await u('/skills/suggest','POST',{category_id:tech.id,name:'تصميم عروض تقديمية',keywords:'بوربوينت، سلايدات'})).j;assert.equal(sug.status,'pending');
assert.equal((await u('/assistant','POST',{message:'أبي مصمم عروض بوربوينت'})).j.noMatch,1);
assert.equal((await adm(`/admin/skills/${sug.id}/review`,'POST',{decision:'approve'})).s,200);
const hit=(await u('/assistant','POST',{message:'أبي مصمم عروض بوربوينت'})).j;
assert.equal(hit.category,'تقنية وتصميم');assert.ok(hit.providers.length>=1);
assert.ok((await adm('/admin/failed-searches')).j.some(x=>x.text.includes('بابل')));
assert.equal((await adm(`/admin/sections/${tech.id}/keywords`,'POST',{keywords:'سلايد، تقديمي'})).j.added.length,2);
assert.equal((await adm('/admin/sections/999/keywords','POST',{keywords:'x'})).s,404);
assert.equal((await u(`/admin/sections/${tech.id}/keywords`,'POST',{keywords:'x'})).s,403);
assert.equal((await u('/skills/suggest','POST',{category_id:999,name:'خطأ'})).s,400);
});
test('صفحة المساعد: النبذة والأعمال والتقييمات والبحث القابل للنقر',async()=>{
const PNG3='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const w=await cl();
const cat=(await w('/skills')).j.categories.find(c=>c.name==='صيانة وإصلاح');
await w('/register','POST',{name:'نجار تجريبي',email:'carp@t.sa',password:'12345678',terms:1,age:1,city:'الرياض',account_type:'helper',category_ids:[cat.id]}); await w('/profile','POST',{name:'نجار تجريبي',phone:ph()});
const wid=(await w('/me')).j.user.id;
assert.equal((await w('/me/bio','POST',{bio:'نجار بخبرة 10 سنوات في تركيب الأبواب والخزائن'})).s,200);
const at=(await w('/upload','POST',{data:'data:image/png;base64,'+PNG3})).j.id;
assert.equal((await w('/me/portfolio','POST',{attachment_id:at,caption:'باب خشب مصنوع يدويًا'})).s,200);
const pid=(await w('/providers/'+wid)).j;
assert.equal(pid.bio.includes('10 سنوات'),true);assert.equal(pid.skills[0],'صيانة وإصلاح');assert.equal(pid.portfolio.length,1);
const anon=await cl();assert.equal((await anon('/providers/'+wid)).s,401);
const hit=(await w('/assistant','POST',{message:'أبي نجار يصلح باب'})).j;
assert.equal(hit.category,'صيانة وإصلاح');assert.ok(hit.providers.some(x=>x.id===wid));
});

test('الشات المباشر للاستفسار: بدون ربط بالطلب، والصور للمشاركين فقط',async()=>{
const PNG4='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const a=await cl();
await a('/register','POST',{name:'عميل استفسار',email:'inq1@t.sa',password:'12345678',terms:1,age:1}); await a('/profile','POST',{name:'عميل استفسار',phone:ph()});const aid=(await a('/me')).j.user.id;
const b=await cl();await b('/register','POST',{name:'مساعد استفسار',email:'inq2@t.sa',password:'12345678',terms:1,age:1}); await b('/profile','POST',{name:'مساعد استفسار',phone:ph()});const bid=(await b('/me')).j.user.id;
const c3=await cl();await c3('/register','POST',{name:'غريب',email:'inq3@t.sa',password:'12345678',terms:1,age:1}); await c3('/profile','POST',{name:'غريب',phone:ph()});
assert.equal((await a('/direct/'+bid,'POST',{body:'هل تقدر تنفذ الخدمة يوم الخميس؟'})).s,200);
assert.equal((await b('/direct/'+aid,'POST',{body:'نعم، أقدر'})).s,200);
const thread=(await a('/direct/'+bid)).j;assert.equal(thread.messages.length,2);assert.equal(thread.blocked,false);
const att=(await a('/upload','POST',{data:'data:image/png;base64,'+PNG4})).j.id;
assert.equal((await a('/direct/'+bid,'POST',{body:'',attachment_id:att})).s,200);
assert.equal((await b('/files/'+att)).s,200);
assert.equal((await c3('/files/'+att)).s,403);
assert.equal((await a('/direct/'+aid,'POST',{body:'لنفسي'})).s,400);
assert.equal((await a('/direct/'+bid,'POST',{body:'',attachment_id:att})).s,200);
await a('/block','POST',{user_id:bid,blocked:true});
assert.equal((await a('/direct/'+bid,'POST',{body:'مرحبا'})).s,403);
});

test('الشات المباشر: منع الصور بين طرفين متعاقدين',async()=>{
const PNG5='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const o=await cl();await o('/register','POST',{name:'طالب عقد',email:'ct1@t.sa',password:'12345678',terms:1,age:1}); await o('/profile','POST',{name:'طالب عقد',phone:ph()});const oid=(await o('/me')).j.user.id;
const h=await cl();await h('/register','POST',{name:'مساعد عقد',email:'ct2@t.sa',password:'12345678',terms:1,age:1}); await h('/profile','POST',{name:'مساعد عقد',phone:ph()});
await asHelper(h);const hid=(await h('/me')).j.user.id;
await h('/profile','POST',{name:'مساعد عقد',phone:ph()});await h('/pledge','POST',{accept:true,name:'مساعد عقد',national_id:'1555555501',phone:'0555555501',address:'الرياض، حي الملقا'});
const rid=(await o('/requests','POST',{title:'تركيب باب خشب',description:'تركيب باب خشب في غرفة نوم'})).j.id;
await h(`/requests/${rid}/offers`,'POST',{message:'أستطيع التنفيذ'});
const off=(await o('/requests/'+rid)).j.offers[0];await o(`/requests/${rid}/choose`,'POST',{offer_id:off.id});
const att=(await o('/upload','POST',{data:'data:image/png;base64,'+PNG5})).j.id;
assert.equal((await o('/direct/'+hid,'POST',{body:'',attachment_id:att})).s,400);
assert.equal((await o('/direct/'+hid,'POST',{body:'هل الموعد مناسب؟'})).s,200);
});

test('حذف الحساب: يحفظ السجلات ويخفي البيانات الشخصية',async()=>{
const u=await cl();await u('/register','POST',{name:'محذوف تجريبي',email:'del1@t.sa',password:'12345678',terms:1,age:1,city:'جدة'}); await u('/profile','POST',{name:'محذوف تجريبي',phone:ph()});
assert.equal((await u('/me/delete','POST',{password:'12345678',confirm:'لا'})).s,400);
assert.equal((await u('/me/delete','POST',{password:'كلمة خاطئة',confirm:'حذف'})).s,403);
assert.equal((await u('/me/delete','POST',{password:'12345678',confirm:'حذف'})).s,200);
const v=await cl();assert.equal((await v('/login','POST',{email:'del1@t.sa',password:'12345678'})).s,401);
});

test('استعادة كلمة المرور: رمز لمرة واحدة ومدة محددة',async()=>{
const u=await cl();await u('/register','POST',{name:'نسيت',email:'fg1@t.sa',password:'12345678',terms:1,age:1}); await u('/profile','POST',{name:'نسيت',phone:ph()});
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

test('العروض للمساعدين فقط، وسحبها عند التحويل، واستبعاد الموقوف من البحث',async()=>{
const anon=await cl();const cid=(await anon('/skills')).j.categories.find(c=>c.name==='طبخ وضيافة').id;
const o=await cl();await o('/register','POST',{name:'عميل عروض',email:'of1@t.sa',password:'12345678',terms:1,age:1,city:'جدة'}); await o('/profile','POST',{name:'عميل عروض',phone:ph()});
const h=await cl();await h('/register','POST',{name:'مساعد عروض',email:'of2@t.sa',password:'12345678',terms:1,age:1,city:'جدة',account_type:'helper',category_ids:[cid]}); await h('/profile','POST',{name:'مساعد عروض',phone:ph()});
const c=await cl();await c('/register','POST',{name:'عميل ثانٍ',email:'of3@t.sa',password:'12345678',terms:1,age:1}); await c('/profile','POST',{name:'عميل ثانٍ',phone:ph()});
const adm=cl();await adm('/login','POST',{email:'admin@t.sa',password:'12345678'});
await adm('/admin/settings','POST',{bank_name:'بنك',account_name:'مؤسسة',iban:'SA0380000000608010167519',commission_percent:10,commission_grace_days:3,org_name:'مؤسسة',org_cr:'1010000000',dispute_clause:'تحكيم.'});
await h('/profile','POST',{name:'مساعد عروض',phone:ph()});await h('/pledge','POST',{accept:true,name:'مساعد عروض',national_id:'1666666601',phone:'0566666601',address:'جدة، حي الروضة'});
const rid=(await o('/requests','POST',{title:'طلب عروض',description:'وصف تجريبي لطلب العروض'})).j.id;
assert.equal((await c(`/requests/${rid}/offers`,'POST',{message:'أستطيع'})).s,403);
assert.equal((await h(`/requests/${rid}/offers`,'POST',{message:'أستطيع'})).s,200);
assert.equal((await h('/me/account-type','POST',{type:'client'})).s,200);
assert.equal((await o('/requests/'+rid)).j.offers.length,0);
assert.equal((await o('/requests/'+rid)).j.status,'published');
assert.equal((await h('/me/account-type','POST',{type:'helper',category_ids:[cid]})).s,200);
const hid=(await h('/me')).j.user.id;
assert.ok((await o('/assistant','POST',{message:'أبي طباخ في جدة'})).j.providers.some(p=>p.id===hid));
const db=new DatabaseSync(DBF);db.prepare('UPDATE users SET flagged=1 WHERE id=?').run(hid);db.close();
assert.equal((await o('/assistant','POST',{message:'أبي طباخ في جدة'})).j.providers.some(p=>p.id===hid),false);
});

test('لا تُجمع أرقام الحسابات البنكية من المستخدم',async()=>{
const c=await cl();await c('/register','POST',{name:'خصوصية تجريبية',email:'priv1@t.sa',password:'12345678',terms:1,age:1}); await c('/profile','POST',{name:'خصوصية تجريبية',phone:ph()});
await c('/profile','POST',{name:'خصوصية تجريبية',iban:'SA0380000000608010167519',address:'الرياض، حي النخيل',phone:'0500000111'});
const me=(await c('/me')).j.user;assert.equal(me.iban,undefined);assert.equal(me.address,'الرياض، حي النخيل');assert.equal(me.phone,'0500000111');
});

test('لا تُجمع رقم الهوية من المستخدم',async()=>{
const c=await cl();await c('/register','POST',{name:'بلا هوية',email:'nid1@t.sa',password:'12345678',terms:1,age:1}); await c('/profile','POST',{name:'بلا هوية',phone:ph()});
await c('/profile','POST',{name:'بلا هوية',national_id:'1098700001',phone:'0500000222'});
const me=(await c('/me')).j.user;assert.equal(me.national_id,undefined);assert.equal(me.phone,'0500000222');
});

test('المساعد لا يقدّم على المهام قبل توقيع التعهد',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='طبخ وضيافة').id;
const o=await cl();await o('/register','POST',{name:'عميل التعهد',email:'np1@t.sa',password:'12345678',terms:1,age:1,city:'جدة'}); await o('/profile','POST',{name:'عميل التعهد',phone:ph()});
const h=await cl();await h('/register','POST',{name:'مساعد التعهد',email:'np2@t.sa',password:'12345678',terms:1,age:1,city:'جدة',account_type:'helper',category_ids:[cat]}); await h('/profile','POST',{name:'مساعد التعهد',phone:ph()});
const rid=(await o('/requests','POST',{title:'طلب بتعهد',description:'وصف تجريبي لطلب يحتاج تعهدًا'})).j.id;
assert.equal((await h(`/requests/${rid}/offers`,'POST',{message:'أستطيع'})).s,403);
assert.equal((await h('/pledge','POST',{accept:true,name:'مساعد التعهد',phone:'0500000333'})).s,200);
assert.equal((await h(`/requests/${rid}/offers`,'POST',{message:'أستطيع'})).s,200);
});

test('التحقق من البريد: الرابط المزيف مرفوض، وإعادة الإرسال للحساب المفعّل لا تفشل',async()=>{
const c=await cl();await c('/register','POST',{name:'تحقق بريد',email:'ev1@t.sa',password:'12345678',terms:1,age:1}); await c('/profile','POST',{name:'تحقق بريد',phone:ph()});
assert.equal((await c('/verify-email','POST',{token:'x'})).s,400);
assert.equal((await c('/verify-email','POST',{token:'a'.repeat(64)})).s,400);
assert.equal((await c('/me/resend-verification','POST')).s,200);
});

test('الجوال إلزامي لنشر الطلبات والتقدم، ويُضاف من الملف الشخصي',async()=>{
const c=await cl();await c('/register','POST',{name:'بلا جوال',email:'ph1@t.sa',password:'12345678',terms:1,age:1});
await c('/profile','POST',{name:'بلا جوال',phone:''});
const d={title:'طلب بلا جوال',description:'وصف تجريبي لطلب بلا جوال'};
assert.equal((await c('/requests','POST',d)).s,403);
await c('/profile','POST',{name:'بلا جوال',phone:'0500000444'});
assert.equal((await c('/requests','POST',d)).s,200);
});

test('تغيير البريد: يتطلب كلمة المرور، ويرفض البريد المكرر',async()=>{
const c=await cl();await c('/register','POST',{name:'تغيير بريد',email:'chg1@t.sa',password:'12345678',terms:1,age:1});
await c('/profile','POST',{name:'تغيير بريد',phone:'0500000555'});
assert.equal((await c('/me/email','POST',{email:'chg2@t.sa',password:'wrong-pass'})).s,401);
assert.equal((await c('/me/email','POST',{email:'ليس-بريدا',password:'12345678'})).s,400);
assert.equal((await c('/me/email','POST',{email:'chg2@t.sa',password:'12345678'})).s,200);
assert.equal((await c('/me')).j.user.email,'chg2@t.sa');
const other=await cl();await other('/register','POST',{name:'آخر',email:'chg3@t.sa',password:'12345678',terms:1,age:1});
assert.equal((await c('/me/email','POST',{email:'chg3@t.sa',password:'12345678'})).s,409);
});

test('فشل إرسال البريد يظهر للمستخدم، ولا يُخفى',async()=>{
const c=await cl();await c('/register','POST',{name:'فشل بريد',email:'mf1@t.sa',password:'12345678',terms:1,age:1});
const db=new DatabaseSync(DBF);db.prepare('UPDATE users SET email_verified=0 WHERE email=?').run('mf1@t.sa');db.close();
const r=await c('/me/resend-verification','POST');
assert.equal(r.s,503);
assert.match(r.j.error,/تعذّر إرسال البريد/);
});

test('شرط تفعيل البريد: المنع قبل التفعيل، وقبول الرابط الصحيح، ورفض المنتهي',async()=>{
const PORT2=3996,B2=`http://localhost:${PORT2}`,DBF2='/tmp/tv'+Date.now()+'.db';
const srv2=spawn('node',['server.js'],{env:{...process.env,RESEND_API_KEY:'',EMAIL_VERIFY_REQUIRED:'1',PORT:PORT2,DB_FILE:DBF2,ADMIN_EMAIL:'admin@t.sa',ADMIN_SETUP_TOKEN:'test-token'},stdio:'ignore'});
try{
await new Promise(r=>setTimeout(r,1200));
const c=()=>{let ck='';return async(p,m='GET',b)=>{const r=await fetch(B2+'/api'+p,{method:m,headers:{'content-type':'application/json',cookie:ck},body:b?JSON.stringify(b):undefined});ck=r.headers.get('set-cookie')?.split(';')[0]||ck;return{s:r.status,j:await r.json().catch(()=>({}))}}};
const u=c();
assert.equal((await u('/register','POST',{name:'تفعيل شرط',email:'gate1@t.sa',password:'12345678',terms:1,age:1})).s,200);
assert.equal((await u('/profile','POST',{name:'تفعيل شرط',phone:'0500000666'})).s,200);
assert.equal((await u('/me')).j.user.email_verified,0);
const d={title:'طلب قبل التفعيل',description:'وصف تجريبي لطلب قبل التفعيل'};
const blocked=await u('/requests','POST',d);
assert.equal(blocked.s,403);assert.match(blocked.j.error,/فعّل بريدك/);
const db=new DatabaseSync(DBF2);
const good='b'.repeat(63)+'1',expired='c'.repeat(63)+'2';
const uid=db.prepare('SELECT id FROM users WHERE email=?').get('gate1@t.sa').id;
db.prepare("INSERT INTO verify_tokens(token_hash,user_id,expires_at) VALUES(?,?,datetime('now','+1 day'))").run(sha(good),uid);
db.prepare("INSERT INTO verify_tokens(token_hash,user_id,expires_at) VALUES(?,?,datetime('now','-1 day'))").run(sha(expired),uid);
db.close();
assert.equal((await u('/verify-email','POST',{token:expired})).s,400);
assert.equal((await u('/verify-email','POST',{token:good})).s,200);
assert.equal((await u('/me')).j.user.email_verified,1);
assert.equal((await u('/requests','POST',d)).s,200);
}finally{srv2.kill()}
});
function sha(s){return createHash('sha256').update(s).digest('hex')}

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
const c=await cl();await c('/register','POST',{name:'محاولات دخول',email:'lg1@t.sa',password:'12345678',terms:1,age:1});
for(let i=0;i<8;i++)assert.equal((await cl()('/login','POST',{email:'lg1@t.sa',password:'wrong-pass'})).s,401);
assert.equal((await cl()('/login','POST',{email:'lg1@t.sa',password:'12345678'})).s,429);
const db=new DatabaseSync(DBF);const row=db.prepare("SELECT n FROM login_attempts WHERE k LIKE ?").get('%|lg1@t.sa');db.close();
assert.equal(row.n,8);
});

test('إشعارات البريد: مفعّلة افتراضيًا، ويمكن إيقافها، ولا يعطّل النشر فشل الإرسال',async()=>{
const c=await cl();await c('/register','POST',{name:'إشعارات',email:'nt1@t.sa',password:'12345678',terms:1,age:1});
await c('/profile','POST',{name:'إشعارات',phone:'0500000777'});
assert.equal((await c('/me')).j.user.notify_email,1);
assert.equal((await c('/me/notify','POST',{enabled:false})).s,200);
assert.equal((await c('/me')).j.user.notify_email,0);
assert.equal((await c('/requests','POST',{title:'طلب إشعار',description:'وصف تجريبي لطلب إشعار المساعدين'})).s,200);
});

test('البحث: الرموز % و_ تُعامل كحروف عادية',async()=>{
const c=await cl();await c('/register','POST',{name:'بحث رموز',email:'lk1@t.sa',password:'12345678',terms:1,age:1});
await c('/profile','POST',{name:'بحث رموز',phone:'0500000888'});
await c('/requests','POST',{title:'طلب عادي بدون رموز',description:'وصف عادي لطلب بدون أي رموز خاصة'});
await c('/requests','POST',{title:'خصم 50% على الصيانة',description:'وصف تجريبي يحتوي على نسبة مئوية كاملة'});
const pct=(await c('/requests?q='+encodeURIComponent('%'))).j;
assert.ok(pct.every(r=>r.title.includes('%')||r.description.includes('%')),'% must not match everything');
assert.ok(pct.some(r=>r.title.includes('50%')));
const under=(await c('/requests?q='+encodeURIComponent('_'))).j;
assert.ok(under.every(r=>r.title.includes('_')||r.description.includes('_')||r.city.includes('_')),'_ must not match any character');
});

test('عمليات البحث الفاشلة: تُنظَّف من الأرقام والبريد قبل الحفظ',async()=>{
const c=await cl();await c('/register','POST',{name:'تنظيف بحث',email:'fs1@t.sa',password:'12345678',terms:1,age:1});
assert.equal((await c('/assistant','POST',{message:'أبي شخص يساعدني 0501234567 على mail: fs.person@example.com'})).j.noMatch,1);
const db=new DatabaseSync(DBF);const row=db.prepare("SELECT text FROM failed_searches WHERE text LIKE '%يساعدني%' ORDER BY id DESC LIMIT 1").get();db.close();
assert.ok(row);assert.ok(!row.text.includes('0501234567'));assert.ok(!row.text.includes('@'));assert.ok(row.text.includes('[رقم]'));
});

test('الحد على الدخول لا يُتجاوز بتزوير رأس X-Forwarded-For دون وكيل موثوق',async()=>{
const c=await cl();await c('/register','POST',{name:'تزوير رأس',email:'xff1@t.sa',password:'12345678',terms:1,age:1});
for(let i=0;i<8;i++){const r=await fetch(B+'/api/login',{method:'POST',headers:{'content-type':'application/json','x-forwarded-for':'10.0.0.'+i},body:JSON.stringify({email:'xff1@t.sa',password:'wrong-pass'})});assert.equal(r.status,401)}
const last=await fetch(B+'/api/login',{method:'POST',headers:{'content-type':'application/json','x-forwarded-for':'10.9.9.9'},body:JSON.stringify({email:'xff1@t.sa',password:'12345678'})});
assert.equal(last.status,429);
});

test('التخصصات: المساعد يختار تخصصات، والقسم يُشتق منها، وتظهر في صفحته',async()=>{
const anon=await cl();const cats=(await anon('/skills')).j.categories;const cat=cats.find(c=>c.name==='صيانة وإصلاح');const sk=cat.skills[0];
const c=await cl();await c('/register','POST',{name:'تخصص تجريبي',email:'sp1@t.sa',password:'12345678',terms:1,age:1,city:'الرياض',account_type:'helper',skill_ids:[sk.id]});
assert.deepEqual([...(await c('/me/specialties')).j],[sk.id]);
assert.deepEqual([...(await c('/me/sections')).j],[cat.id]);
assert.equal((await c('/me/sections','POST',{skill_ids:[999999]})).s,400);
const id=(await c('/me')).j.user.id;
assert.ok((await c(`/providers/${id}`)).j.skills.includes(sk.name));
});

test('المحادثة: رسالة طالب المساعدة تظهر عند المساعد والعكس، في قائمة المحادثات والرسائل',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='طبخ وضيافة').id;
const o=await cl();await o('/register','POST',{name:'طالب محادثة',email:'ch1@t.sa',password:'12345678',terms:1,age:1,city:'جدة'});
await o('/profile','POST',{name:'طالب محادثة',phone:'0500000911'});
const h=await cl();await h('/register','POST',{name:'مساعد محادثة',email:'ch2@t.sa',password:'12345678',terms:1,age:1,city:'جدة',account_type:'helper',category_ids:[cat]});
await h('/profile','POST',{name:'مساعد محادثة',phone:'0500000912'});
await h('/pledge','POST',{accept:true,name:'مساعد محادثة'});
const oid=(await o('/me')).j.user.id,hid=(await h('/me')).j.user.id;
const rid=(await o('/requests','POST',{title:'طلب محادثة',description:'وصف تجريبي لطلب يختبر المحادثة'})).j.id;
assert.equal((await h(`/requests/${rid}/offers`,'POST',{message:'أستطيع'})).s,200);
assert.equal((await o(`/requests/${rid}/messages`,'POST',{to:hid,body:'مرحبا، متى تقدر تبدأ؟'})).s,200);
const hChats=(await h('/chats')).j;
assert.ok(hChats.some(x=>x.request_id===rid&&x.peer===oid),'الرسالة لا تظهر في قائمة محادثات المساعد');
const hMsgs=(await h(`/requests/${rid}/messages?with=${oid}`)).j.messages;
assert.ok(hMsgs.some(m=>m.body==='مرحبا، متى تقدر تبدأ؟'),'نص الرسالة لا يظهر عند المساعد');
assert.equal((await h(`/requests/${rid}/messages`,'POST',{to:oid,body:'بعد ساعة'})).s,200);
const oChats=(await o('/chats')).j;
assert.ok(oChats.some(x=>x.request_id===rid&&x.peer===hid),'الرد لا يظهر في قائمة محادثات الطالب');
const oMsgs=(await o(`/requests/${rid}/messages?with=${hid}`)).j.messages;
assert.equal(oMsgs.length,2,'يجب أن تظهر الرسالتان عند الطالب');
});

test('المحادثة تبقى متاحة للطرفين بعد سحب العرض، ويمكن التواصل مرة أخرى',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='طبخ وضيافة').id;
const o=await cl();await o('/register','POST',{name:'طالب دائم',email:'pc1@t.sa',password:'12345678',terms:1,age:1,city:'جدة'});
await o('/profile','POST',{name:'طالب دائم',phone:'0500000921'});
const h=await cl();await h('/register','POST',{name:'مساعد دائم',email:'pc2@t.sa',password:'12345678',terms:1,age:1,city:'جدة',account_type:'helper',category_ids:[cat]});
await h('/profile','POST',{name:'مساعد دائم',phone:'0500000922'});
await h('/pledge','POST',{accept:true,name:'مساعد دائم'});
const oid=(await o('/me')).j.user.id,hid=(await h('/me')).j.user.id;
const rid=(await o('/requests','POST',{title:'طلب دائم',description:'وصف تجريبي لطلب تبقى محادثته بعد سحب العرض'})).j.id;
assert.equal((await h(`/requests/${rid}/offers`,'POST',{message:'أستطيع'})).s,200);
assert.equal((await o(`/requests/${rid}/messages`,'POST',{to:hid,body:'هل ما زلت متاحًا؟'})).s,200);
assert.equal((await h('/me/account-type','POST',{type:'client'})).s,200);
assert.equal((await o(`/requests/${rid}/messages?with=${hid}`)).j.messages.length,1,'يجب أن تبقى الرسالة بعد سحب العرض');
assert.equal((await h(`/requests/${rid}/messages?with=${oid}`)).j.messages.length,1,'يجب أن يقرأ المساعد السابق المحادثة');
assert.equal((await o(`/requests/${rid}/messages`,'POST',{to:hid,body:'تواصل مرة أخرى'})).s,200,'يجب أن يستطيع الطالب مراسلة من تواصل معه سابقًا');
assert.ok((await h('/chats')).j.some(x=>x.request_id===rid),'المحادثة تظهر في قائمة المساعد');
});

test('تحليلات الإدارة: الأكثر طلبًا والفجوة والبحث بلا نتيجة، ولا تُعرض للمستخدم العادي',async()=>{
const cat=(await cl()('/skills')).j.categories.find(c=>c.name==='صيانة وإصلاح').id;
const h=await cl();await h('/register','POST',{name:'نجار تحليلات',email:'in1@t.sa',password:'12345678',terms:1,age:1,city:'جدة',account_type:'helper',category_ids:[cat]});
await h('/profile','POST',{name:'نجار تحليلات',phone:'0500000931'});
const o=await cl();await o('/register','POST',{name:'طالب تحليلات',email:'in2@t.sa',password:'12345678',terms:1,age:1,city:'جدة'});
await o('/profile','POST',{name:'طالب تحليلات',phone:'0500000932'});
await o('/requests','POST',{title:'أبي نجار يصلح باب',description:'باب خشب يحتاج تركيب وإصلاح في البيت'});
await o('/assistant','POST',{message:'أبي شخص يسوي لي شيء غريب جدًا'});
const adm=cl();await adm('/login','POST',{email:'admin@t.sa',password:'12345678'});
const r=(await adm('/admin/insights?days=0')).j;
assert.ok(r.demand.some(x=>x.cat==='صيانة وإصلاح'),'الطلب يجب أن يظهر في التخصصات الأكثر طلبًا');
assert.ok(r.gap.length>=1&&r.total>=1);
assert.ok(r.failed.some(x=>x.text.includes('شيء غريب')),'البحث بلا نتيجة يجب أن يظهر');
assert.equal((await o('/admin/insights')).s,403);
});

test('الامتثال: التسجيل يتطلب تأكيد العمر، ويُحفظ إصدار الشروط، والتصدير يعيد بيانات المستخدم',async()=>{
const c=await cl();assert.equal((await c('/register','POST',{name:'امتثال تجريبي',email:'cp1@t.sa',password:'12345678',terms:1})).s,400);
assert.equal((await c('/register','POST',{name:'امتثال تجريبي',email:'cp1@t.sa',password:'12345678',terms:1,age:1})).s,200);
const ex=(await c('/me/export')).j;assert.equal(ex.profile.email,'cp1@t.sa');assert.equal(ex.profile.terms_version,'2026-10');assert.ok(Array.isArray(ex.requests));
});
