// اختبارات مركز الذكاء: الصلاحيات، وضع المراقبة، الموافقة، التنفيذ التلقائي، زر الطوارئ، سجل التدقيق، والحدود المالية.
import {test,before,after} from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';import {readFileSync,readdirSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
const PORT=3980,B='http://localhost:'+PORT;let DBF,srv;
before(async()=>{DBF=join(tmpdir(),'ai'+Date.now()+'.db');srv=spawn('node',['server.js'],{env:{...process.env,AI_SCHEDULER:'0',SECRETS_KEY:Buffer.alloc(32,7).toString('base64'),RESEND_API_KEY:'',REGISTER_PER_HOUR:'1000',PORT,DB_FILE:DBF,ADMIN_EMAIL:'admin@t.sa',ADMIN_SETUP_TOKEN:'x'},stdio:'ignore'});await new Promise(r=>setTimeout(r,1500))});
after(()=>srv.kill());
const cl=()=>{let ck='';return async(p,m='GET',b)=>{const r=await fetch(B+'/api'+p,{method:m,headers:{'content-type':'application/json',cookie:ck},body:b?JSON.stringify(b):undefined});ck=r.headers.get('set-cookie')?.split(';')[0]||ck;return{s:r.status,j:await r.json().catch(()=>({}))}}};
let ph=0;const phone=()=>'05'+String(60000000+(++ph));
const db=f=>{const d=new DatabaseSync(DBF);try{return f(d)}finally{d.close()}};
const reg=async e=>{const c=cl();await c('/register','POST',{name:'مستخدم '+e+' اختبار',email:e+'@t.sa',password:'12345678',terms:1,age:1,phone:phone()});const id=(await c('/me')).j.user.id;db(d=>d.prepare('UPDATE users SET email_verified=1 WHERE id=?').run(id));c.id=id;return c};
const agr=(a,b,amount,status,extra={})=>db(d=>{const r=d.prepare("INSERT INTO agreements(a_id,b_id,amount,description,status,created_at,updated_at) VALUES(?,?,?,?,?,datetime('now',?),datetime('now',?))").run(a,b,amount,'اتفاق اختبار',status,extra.created||'-0 days',extra.updated||extra.created||'-0 days');return Number(r.lastInsertRowid)});
const nots=uid=>db(d=>d.prepare('SELECT text FROM notifications WHERE user_id=?').all(uid));
const audits=(where='1=1')=>db(d=>d.prepare('SELECT * FROM ai_audit WHERE '+where).all());
let adm,u1,u2,u3,u4;

test('تجهيز: مدير وأربعة مستخدمين',async()=>{
  adm=await reg('admin');assert.equal((await adm('/admin/stats')).s,200);
  [u1,u2,u3,u4]=[await reg('u1'),await reg('u2'),await reg('u3'),await reg('u4')];
});

test('الصلاحيات: المسارات للمدير فقط',async()=>{
  const anon=cl();assert.equal((await anon('/admin/ai/overview')).s,401);
  assert.equal((await u1('/admin/ai/overview')).s,403);assert.equal((await u1('/admin/ai/kill','POST',{on:true})).s,403);
  assert.equal((await u1('/admin/ai/chat','POST',{text:'ملخص'})).s,403);
  const r=await adm('/admin/ai/overview');assert.equal(r.s,200);
  assert.equal(r.j.enabled,true);assert.deepEqual(r.j.managers.map(m=>m.mode),['observe','observe','observe','observe','observe']);
  assert.equal(r.j.cost.sar,0);assert.equal(r.j.cost.tokens,0);
});

test('الأوضاع: قيود التصعيد',async()=>{
  assert.equal((await adm('/admin/ai/mode','POST',{manager:'finance',mode:'auto',confirm:true})).s,400);
  assert.equal((await adm('/admin/ai/mode','POST',{manager:'guard',mode:'auto'})).s,400);
  assert.equal((await adm('/admin/ai/mode','POST',{manager:'guard',mode:'auto',confirm:true})).s,400); // لم تنجح 3 دورات بعد
  assert.equal((await adm('/admin/ai/mode','POST',{manager:'guard',mode:'xyz'})).s,400);
  assert.equal((await adm('/admin/ai/mode','POST',{manager:'nobody',mode:'observe'})).s,400);
});

test('الرقابة (مراقبة فقط): تكتشف ولا تنفّذ',async()=>{
  const iban='SA0380000000608010167519';
  db(d=>{for(const u of [u1.id,u2.id])d.prepare("INSERT INTO helper_extra(user_id,kind,number) VALUES(?,'iban',?)").run(u,iban)});
  const r=await adm('/admin/ai/run','POST',{manager:'guard'});assert.equal(r.s,200);assert.ok(r.j.every(x=>x.ok||x.skipped));
  const f=(await adm('/admin/ai/findings')).j;const dup=f.find(x=>x.kind==='duplicate_iban');
  assert.ok(dup,'يجب كشف الآيبان المكرر');assert.equal(dup.severity,'high');
  assert.ok(!JSON.stringify(dup).includes(iban),'لا يُخزَّن الآيبان كاملًا');
  assert.equal(db(d=>d.prepare('SELECT flagged FROM users WHERE id=?').get(u2.id)).flagged,0,'لم يُنفَّذ شيء في وضع المراقبة');
  assert.ok(audits("mode='observe-sim' AND action='flag_user'").length>=1);
  const again=await adm('/admin/ai/run','POST',{manager:'guard'});assert.equal(again.s,200);
  assert.equal((await adm('/admin/ai/findings')).j.filter(x=>x.kind==='duplicate_iban').length,1,'لا تكرار للنتيجة نفسها');
  assert.equal((await adm('/admin/ai/audit/verify')).j.ok,true);
});

test('الموافقة: اقتراح ثم اعتماد ثم تراجع، وتسجيل هوية المعتمد',async()=>{
  assert.equal((await adm('/admin/ai/mode','POST',{manager:'guard',mode:'approval'})).s,200);
  await adm('/admin/ai/run','POST',{manager:'guard'});
  const p=(await adm('/admin/ai/findings?status=pending')).j.find(x=>x.proposal?.tool==='flag_user'&&x.proposal.args.user_id===u2.id);
  assert.ok(p,'اقتراح تقييد الحساب الأحدث');
  assert.equal((await u1('/admin/ai/findings/'+p.id+'/decide','POST',{decision:'approve'})).s,403);
  assert.equal((await adm('/admin/ai/findings/'+p.id+'/decide','POST',{decision:'approve',note:'تأكدت'})).s,200);
  assert.equal(db(d=>d.prepare('SELECT flagged FROM users WHERE id=?').get(u2.id)).flagged,1);
  const a=audits("mode='human' AND action='flag_user'").at(-1);assert.equal(a.approved_by,adm.id);
  assert.equal((await adm('/admin/ai/findings/'+p.id+'/decide','POST',{decision:'approve'})).s,400,'لا قرار مزدوج');
  assert.equal((await adm('/admin/ai/findings/'+p.id+'/undo','POST')).s,200);
  assert.equal(db(d=>d.prepare('SELECT flagged FROM users WHERE id=?').get(u2.id)).flagged,0);
  await adm('/admin/ai/mode','POST',{manager:'guard',mode:'observe'});
});

test('لا يقيّد الذكاء حساب المدير ولا الموظف',async()=>{
  db(d=>d.prepare("INSERT INTO ai_findings(manager,kind,severity,title,reason,proposal,status,dedupe_key) VALUES('guard','x','high','t','r',?,'pending','forced1')").run(JSON.stringify({tool:'flag_user',args:{user_id:adm.id}})));
  const f=(await adm('/admin/ai/findings?status=pending')).j.find(x=>x.dedupe_key==='forced1');
  assert.equal((await adm('/admin/ai/findings/'+f.id+'/decide','POST',{decision:'approve'})).s,400);
  assert.equal(db(d=>d.prepare('SELECT flagged FROM users WHERE id=?').get(adm.id)).flagged,0);
});

test('العمليات: تذكير تلقائي مرة واحدة ثم تصعيد، ولا تكرار',async()=>{
  const id=agr(u3.id,u4.id,300,'pending',{created:'-6 days'});
  await adm('/admin/ai/run','POST',{manager:'ops'}); // مراقبة: نتيجة + محاكاة بلا إشعار
  assert.equal(nots(u4.id).length,0);
  assert.ok((await adm('/admin/ai/findings')).j.some(x=>x.kind==='stuck_order'&&x.subject_id===id));
  assert.equal((await adm('/admin/ai/mode','POST',{manager:'ops',mode:'auto',confirm:true})).s,200); // نجحت دورات كافية
  await adm('/admin/ai/run','POST',{manager:'ops'});
  const n1=nots(u4.id).length;assert.equal(n1,1,'تذكير واحد للطرف المعني');
  await adm('/admin/ai/run','POST',{manager:'ops'});assert.equal(nots(u4.id).length,1,'فترة تهدئة: لا تكرار');
  assert.ok(audits("mode='auto' AND action='send_notice'").length>=1);
  assert.equal(db(d=>d.prepare('SELECT status FROM agreements WHERE id=?').get(id)).status,'pending','لا يغيّر حالة الطلب');
});

test('سقف التنفيذ التلقائي اليومي',async()=>{
  assert.equal((await adm('/admin/ai/cap','POST',{cap:-1})).s,400);
  const used=(await adm('/admin/ai/overview')).j.auto_today;assert.equal((await adm('/admin/ai/cap','POST',{cap:used})).s,200);
  const id=agr(u1.id,u3.id,200,'pending',{created:'-9 days'});
  await adm('/admin/ai/run','POST',{manager:'ops'});
  assert.equal(nots(u3.id).length,0,'السقف يمنع أي تنفيذ جديد');
  assert.ok((await adm('/admin/ai/findings')).j.some(x=>x.kind==='cap_reached'));
  await adm('/admin/ai/cap','POST',{cap:40});
});

test('زر الإيقاف الطارئ: يوقف الآلي ويبقي قرارات الإنسان',async()=>{
  const before=audits().length;
  assert.equal((await adm('/admin/ai/kill','POST',{on:true,reason:'اختبار'})).j.enabled,false);
  const r=await adm('/admin/ai/run','POST',{manager:'ops'});assert.ok(r.j.every(x=>x.skipped==='off'));
  assert.equal(audits().length,before+1,'سجّل الإيقاف فقط');
  assert.equal((await adm('/admin/ai/kill','POST',{on:false})).j.enabled,true);
});

test('سجل التدقيق: لا يقبل التعديل ولا الحذف، وكشف العبث',async()=>{
  assert.throws(()=>db(d=>d.prepare("UPDATE ai_audit SET result='x' WHERE id=1").run()),/للقراءة فقط/);
  assert.throws(()=>db(d=>d.prepare('DELETE FROM ai_audit WHERE id=1').run()),/للقراءة فقط/);
  db(d=>{d.exec('DROP TRIGGER ai_audit_no_update');d.prepare("UPDATE ai_audit SET result='tampered' WHERE id=2").run()});
  const v=(await adm('/admin/ai/audit/verify')).j;assert.equal(v.ok,false);assert.equal(v.broken_at,2);
});

test('المالي: يكشف الفروقات ولا يلمس الأرقام المالية',async()=>{
  const g1=agr(u3.id,u4.id,1000,'completed');db(d=>{d.prepare("UPDATE agreements SET paid_at=datetime('now'),paid_via='hala',payment_ref='R1',completed_at=datetime('now') WHERE id=?").run(g1)});
  const g2=agr(u3.id,u4.id,2000,'completed');db(d=>{d.prepare("UPDATE agreements SET paid_at=datetime('now'),paid_via='hala',payment_ref='R2',completed_at=datetime('now') WHERE id=?").run(g2);d.prepare("INSERT INTO agreement_commissions(agreement_id,helper_id,amount,status) VALUES(?,?,?,'paid')").run(g2,u4.id,77)});
  const snap=()=>db(d=>JSON.stringify([d.prepare('SELECT * FROM agreements ORDER BY id').all(),d.prepare('SELECT * FROM agreement_commissions ORDER BY id').all(),d.prepare('SELECT * FROM platform_invoices').all()]));
  const before=snap();
  await adm('/admin/ai/run','POST',{manager:'finance'});
  const f=(await adm('/admin/ai/findings')).j;
  assert.ok(f.some(x=>x.kind==='missing_commission'&&x.subject_id===g1));
  assert.ok(f.some(x=>x.kind==='commission_mismatch'&&x.subject_id===g2&&x.evidence.expected===100));
  assert.equal(snap(),before,'لم تتغير أي بيانات مالية');
});

test('الرقابة: كشف التعامل خارج المنصة وإخفاء الأرقام من الأدلة',async()=>{
  db(d=>d.prepare('INSERT INTO direct_messages(from_id,to_id,body) VALUES(?,?,?)').run(u3.id,u1.id,'تعال نتفق خارج المنصة بدون عمولة وكلمني واتساب 0555123456'));
  await adm('/admin/ai/run','POST',{manager:'guard'});
  const f=(await adm('/admin/ai/findings')).j.find(x=>x.kind==='commission_bypass');
  assert.ok(f);assert.ok(['medium','high'].includes(f.severity));assert.ok(!JSON.stringify(f).includes('0555123456'),'الرقم لا يُخزَّن');
});

test('الشكاوى: تصنيف البلاغ واقتراح إجراء بموافقة',async()=>{
  const rid=db(d=>Number(d.prepare("INSERT INTO reports(reporter_id,type,target_id,reason) VALUES(?,?,?,?)").run(u1.id,'user',u4.id,'هذا الشخص نصاب وسرق فلوسي واحتال علي').lastInsertRowid));
  await adm('/admin/ai/run','POST',{manager:'support'});
  const f=(await adm('/admin/ai/findings')).j.find(x=>x.kind==='report_triage'&&x.subject_id===rid);
  assert.ok(f);assert.equal(f.severity,'high');assert.equal(f.evidence.category,'fraud');assert.equal(f.proposal.tool,'flag_user');
  assert.equal(db(d=>d.prepare('SELECT status FROM reports WHERE id=?').get(rid)).status,'open','لا يغلق البلاغ');
});

test('النزاع: ملخص حقائق دون حسم',async()=>{
  const g=agr(u1.id,u3.id,500,'disputed');db(d=>d.prepare("UPDATE agreements SET disputed_at=datetime('now','-5 days') WHERE id=?").run(g));
  await adm('/admin/ai/run','POST',{manager:'support'});
  const f=(await adm('/admin/ai/findings')).j;
  assert.ok(f.some(x=>x.kind==='dispute_brief'&&x.subject_id===g&&x.evidence.facts.length>=5));
  assert.ok(f.some(x=>x.kind==='dispute_sla'&&x.subject_id===g&&x.severity==='high'));
  assert.equal(db(d=>d.prepare('SELECT status,dispute_decision FROM agreements WHERE id=?').get(g)).dispute_decision,null);
});

test('مركز المهام: تعديل العتبات والتوقيت بحدود',async()=>{
  const j=(await adm('/admin/ai/jobs')).j;assert.ok(j.length>=15);const s=j.find(x=>x.job==='ops.stuck_orders');assert.equal(s.params.pending_days,3);
  assert.equal((await adm('/admin/ai/jobs/update','POST',{job:'ops.stuck_orders',interval_min:1})).s,400);
  assert.equal((await adm('/admin/ai/jobs/update','POST',{job:'ops.stuck_orders',params:{hack:1}})).s,400);
  assert.equal((await adm('/admin/ai/jobs/update','POST',{job:'ops.stuck_orders',interval_min:30,params:{pending_days:5}})).s,200);
  assert.equal((await adm('/admin/ai/jobs')).j.find(x=>x.job==='ops.stuck_orders').params.pending_days,5);
  assert.equal((await adm('/admin/ai/jobs/update','POST',{job:'guard.bypass_scan',enabled:false})).s,200);
});

test('التقارير والتحليل والأوامر بالعربية',async()=>{
  const r=(await adm('/admin/ai/reports','POST',{kind:'daily'})).j;assert.ok(r.summary.includes('0 ريال'));assert.equal(r.data.cost.sar,0);
  assert.equal((await adm('/admin/ai/reports')).j.length,1);
  const c1=(await adm('/admin/ai/chat','POST',{text:'ما هي الموافقات المعلقة؟'})).j;assert.ok(c1.reply.length>5);
  const c2=(await adm('/admin/ai/chat','POST',{text:'غيّر وضع مدير الرقابة إلى تلقائي'})).j;assert.ok(c2.reply.includes('تبويب الإعدادات'));
  assert.equal((await adm('/admin/ai/overview')).j.managers.find(m=>m.key==='guard').mode,'observe','الأوامر لا توسّع الصلاحيات');
  const c3=(await adm('/admin/ai/chat','POST',{text:'إيقاف طارئ'})).j;assert.ok(c3.reply.includes('الإيقاف'));
  assert.equal((await adm('/admin/ai/overview')).j.enabled,false);
  assert.equal((await adm('/admin/ai/chat','POST',{text:'استئناف التشغيل'})).s,200);assert.equal((await adm('/admin/ai/overview')).j.enabled,true);
});

test('حدود ثابتة في الكود: لا أداة مالية ولا كتابة على جداول المال',()=>{
  const dir='src/ai',files=readdirSync(dir).filter(f=>f.endsWith('.js'));
  const k=readFileSync(join(dir,'kernel.js'),'utf8'),tools=[...k.matchAll(/^  (\w+):\{title:/gm)].map(m=>m[1]);
  assert.deepEqual(tools.sort(),['flag_user','hide_rating','send_notice','suspend_user']);
  for(const f of files){const s=readFileSync(join(dir,f),'utf8');
    assert.ok(!/(INSERT\s+(OR\s+\w+\s+)?INTO|UPDATE|DELETE\s+FROM)\s+(agreements|agreement_commissions|platform_invoices|points_ledger|expenses|helper_hala|helper_extra)\b/i.test(s),f+': كتابة على جدول مالي');
    assert.ok(!/\bfetch\(|https?:\/\/api\./.test(s),f+': اتصال خارجي غير مسموح');}
});
