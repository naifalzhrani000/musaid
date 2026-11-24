// نواة مركز الذكاء: الإعدادات، الصلاحيات، سجل التدقيق المقفل، الأدوات المسموحة، زر الإيقاف الطارئ.
// لا يوجد هنا أي اتصال بمزود خارجي: كل القرارات قواعد برمجية ثابتة وقابلة للاختبار، والتكلفة صفر.
import crypto from 'node:crypto';
import {db,all,get,run,err,notify,audit} from '../core.js';

db.exec(`
CREATE TABLE IF NOT EXISTS ai_config(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_by INT,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS ai_audit(id INTEGER PRIMARY KEY,manager TEXT NOT NULL,action TEXT NOT NULL,mode TEXT NOT NULL,target TEXT,reason TEXT,refs TEXT,result TEXT,approved_by INT,prev_hash TEXT NOT NULL,hash TEXT NOT NULL,at TEXT NOT NULL);
CREATE TRIGGER IF NOT EXISTS ai_audit_no_update BEFORE UPDATE ON ai_audit BEGIN SELECT RAISE(ABORT,'سجل التدقيق للقراءة فقط'); END;
CREATE TRIGGER IF NOT EXISTS ai_audit_no_delete BEFORE DELETE ON ai_audit BEGIN SELECT RAISE(ABORT,'سجل التدقيق للقراءة فقط'); END;
CREATE TABLE IF NOT EXISTS ai_findings(id INTEGER PRIMARY KEY,manager TEXT NOT NULL,kind TEXT NOT NULL,severity TEXT NOT NULL DEFAULT 'low',subject_type TEXT,subject_id INT,title TEXT NOT NULL,reason TEXT NOT NULL,evidence TEXT,proposal TEXT,status TEXT NOT NULL DEFAULT 'open',dedupe_key TEXT UNIQUE NOT NULL,decided_by INT,decided_at TEXT,decision_note TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS ix_ai_findings_status ON ai_findings(status,severity);
CREATE TABLE IF NOT EXISTS ai_runs(id INTEGER PRIMARY KEY,manager TEXT NOT NULL,job TEXT,via TEXT NOT NULL,started_at TEXT NOT NULL,finished_at TEXT,ok INT NOT NULL DEFAULT 0,new_findings INT NOT NULL DEFAULT 0,actions INT NOT NULL DEFAULT 0,error TEXT);
CREATE TABLE IF NOT EXISTS ai_jobs(job TEXT PRIMARY KEY,manager TEXT NOT NULL,title TEXT NOT NULL,interval_min INT NOT NULL,enabled INT NOT NULL DEFAULT 1,params TEXT NOT NULL DEFAULT '{}',last_run TEXT);
CREATE TABLE IF NOT EXISTS ai_reports(id INTEGER PRIMARY KEY,kind TEXT NOT NULL,period_from TEXT,period_to TEXT,summary TEXT NOT NULL,data TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS ai_sent(key TEXT PRIMARY KEY,at TEXT NOT NULL);
`);

export const MODES=['off','observe','approval','auto'];
export const MODE_AR={off:'معطّل',observe:'مراقبة فقط',approval:'بعد الموافقة',auto:'تنفيذ تلقائي'};
const rank=m=>MODES.indexOf(m);
export const META={
  guard:{name:'مدير الرقابة والحماية',desc:'يكتشف الاحتيال والحسابات المكررة والتقييمات غير الطبيعية ومحاولات تجاوز العمولة.'},
  support:{name:'مدير العملاء والشكاوى',desc:'يصنّف البلاغات والشكاوى ويجهّز ملف النزاع ويتابع اكتمال ملفات المساعدين.'},
  ops:{name:'مدير العمليات',desc:'يتابع الطلبات حتى الإغلاق ويرسل التذكيرات ويكتشف الطلبات المتعثرة.'},
  finance:{name:'المدير المالي (قراءة فقط)',desc:'يطابق العمولات والمدفوعات ويكشف الفروقات. لا ينفّذ أي حركة مالية إطلاقًا.'},
  growth:{name:'مدير التسويق والنمو',desc:'يحلل الطلب حسب المدن والتخصصات ويقترح فرص التوسع والحملات.'}
};

// ---------- الإعدادات (لا تُكتب إلا من مسارات المدير) ----------
export const cfg=(k,d=null)=>get('SELECT value FROM ai_config WHERE key=?',k)?.value??d;
export const setCfg=(k,v,by)=>run("INSERT INTO ai_config(key,value,updated_by,updated_at) VALUES(?,?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=excluded.updated_at",k,String(v),by||null);
export const envKilled=()=>process.env.AI_DISABLED==='1';
export const isOn=()=>!envKilled()&&cfg('enabled','1')==='1';
export const modeOf=m=>{const v=cfg('mode.'+m,'observe');return MODES.includes(v)?v:'observe'};
export const dailyCap=()=>Math.max(0,Math.min(1000,parseInt(cfg('auto_daily_cap','40'),10)||0));
export const pausedUntil=m=>{const v=cfg('paused.'+m);return v&&v>new Date().toISOString()?v:null};

// ---------- سجل التدقيق: سلسلة تجزئة، ولا يقبل التعديل ولا الحذف (مشغّلات SQLite) ----------
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const rowHash=(prev,e,at)=>sha(JSON.stringify([prev,e.manager,e.action,e.mode,e.target||'',e.reason||'',e.refs||'',e.result||'',e.approved_by||0,at]));
export const aiAudit=e=>{
  const prev=get('SELECT hash FROM ai_audit ORDER BY id DESC LIMIT 1')?.hash||'GENESIS',at=new Date().toISOString();
  run('INSERT INTO ai_audit(manager,action,mode,target,reason,refs,result,approved_by,prev_hash,hash,at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
    e.manager,e.action,e.mode,e.target||null,String(e.reason||'').slice(0,400),e.refs||null,String(e.result||'').slice(0,300),e.approved_by||null,prev,rowHash(prev,e,at),at);
};
export const verifyChain=()=>{
  let prev='GENESIS',n=0;
  for(const r of all('SELECT * FROM ai_audit ORDER BY id')){
    if(r.prev_hash!==prev||r.hash!==rowHash(prev,r,r.at))return{ok:false,broken_at:r.id,checked:n};
    prev=r.hash;n++;
  }
  return{ok:true,checked:n};
};

// ---------- منع التكرار (idempotency) ----------
const seen=(key,days)=>!!get("SELECT 1 x FROM ai_sent WHERE key=? AND at>datetime('now',?)",key,'-'+Math.max(0,days)+' days');
const mark=key=>run("INSERT INTO ai_sent(key,at) VALUES(?,datetime('now')) ON CONFLICT(key) DO UPDATE SET at=excluded.at",key);

// ---------- الأدوات: القائمة البيضاء الوحيدة لما يستطيع الذكاء تنفيذه ----------
// لا توجد أي أداة تلمس المال أو الدفع أو الحذف الدائم أو تغيير الصلاحيات. cap = أعلى مستوى استقلال مسموح للأداة.
const protectedUser=u=>!u||u.role==='admin'||u.role==='staff';
export const TOOLS={
  send_notice:{title:'إرسال إشعار داخل المنصة',risk:'low',cap:'auto',allow:['guard','support','ops'],
    exec:a=>{const u=get('SELECT id FROM users WHERE id=? AND active=1',a.user_id);if(!u)return 'skipped:no_user';notify(u.id,String(a.text).slice(0,300),a.link||null,{mail:false});return 'sent'}},
  flag_user:{title:'وضع الحساب قيد المراجعة',risk:'high',cap:'approval',allow:['guard','support'],
    exec:a=>{const u=get('SELECT id,role FROM users WHERE id=?',a.user_id);if(protectedUser(u))throw err(400,'لا يمكن تقييد هذا الحساب');run('UPDATE users SET flagged=1 WHERE id=?',u.id);return 'flagged'},
    undo:a=>{run('UPDATE users SET flagged=0 WHERE id=?',a.user_id);return 'unflagged'}},
  suspend_user:{title:'إيقاف الحساب مؤقتًا 7 أيام',risk:'high',cap:'approval',allow:['guard'],
    exec:a=>{const u=get('SELECT id,role FROM users WHERE id=?',a.user_id);if(protectedUser(u))throw err(400,'لا يمكن إيقاف هذا الحساب');run("UPDATE users SET suspended_until=datetime('now','+7 days') WHERE id=?",u.id);run('DELETE FROM sessions WHERE user_id=?',u.id);return 'suspended_7d'},
    undo:a=>{run('UPDATE users SET suspended_until=NULL WHERE id=?',a.user_id);return 'lifted'}},
  hide_rating:{title:'إخفاء تقييم',risk:'high',cap:'approval',allow:['guard','support'],
    exec:a=>{const r=run('UPDATE ratings SET hidden=1 WHERE id=?',a.rating_id);return r.changes?'hidden':'skipped:no_rating'},
    undo:a=>{run('UPDATE ratings SET hidden=0 WHERE id=?',a.rating_id);return 'unhidden'}}
};

const dayStart=()=>new Date().toISOString().slice(0,10);
const autoToday=()=>get("SELECT COUNT(*) n FROM ai_audit WHERE mode='auto' AND at>=?",dayStart()).n;

export const admins=()=>all("SELECT id FROM users WHERE role='admin' AND active=1");

// ---------- النتائج والتنبيهات ----------
export const raise=(manager,f)=>{
  const sev=['info','low','medium','high'].includes(f.severity)?f.severity:'low';
  const r=run('INSERT OR IGNORE INTO ai_findings(manager,kind,severity,subject_type,subject_id,title,reason,evidence,proposal,status,dedupe_key) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
    manager,f.kind,sev,f.subject_type||null,f.subject_id??null,String(f.title).slice(0,160),String(f.reason).slice(0,600),f.evidence?JSON.stringify(f.evidence).slice(0,3000):null,f.proposal?JSON.stringify(f.proposal):null,f.proposal?'pending':'open',String(f.dedupe).slice(0,200));
  if(!r.changes)return 0;
  if(sev==='high'){for(const a of admins())notify(a.id,'تنبيه ذكي: '+String(f.title).slice(0,100),'#/manage/ai',{mail:false})}
  return Number(r.lastInsertRowid);
};

// ---------- تنفيذ إجراء عبر الطبقة المركزية ----------
// المستوى الفعلي = الأدنى بين وضع المدير وسقف الأداة. في «مراقبة فقط» لا يُنفَّذ شيء، يُسجَّل فقط ما كان سيحدث.
export const act=(manager,tool,args,o={})=>{
  const T=TOOLS[tool];if(!T||!T.allow.includes(manager))throw err(403,'الأداة غير مسموحة لهذا المدير');
  if(!isOn())return{skipped:'off'};
  const mode=modeOf(manager);if(mode==='off')return{skipped:'off'};
  const eff=rank(mode)<=rank(T.cap)?mode:T.cap;
  const key=`${tool}:${o.key||JSON.stringify(args)}`,days=o.cooldownDays??7;
  const target=args.user_id?'user:'+args.user_id:args.rating_id?'rating:'+args.rating_id:null;
  if(eff==='observe'){
    if(seen(key+'|sim',days))return{skipped:'dup'};mark(key+'|sim');
    aiAudit({manager,action:tool,mode:'observe-sim',target,reason:o.reason,refs:o.refs,result:'simulated'});return{simulated:1};
  }
  if(eff==='approval'){
    const id=raise(manager,{kind:'proposal:'+tool,severity:T.risk==='high'?'medium':'low',subject_type:target?.split(':')[0],subject_id:target?+target.split(':')[1]:null,title:T.title,reason:o.reason||'',evidence:{refs:o.refs},proposal:{tool,args},dedupe:'act:'+key});
    return id?{proposed:id}:{skipped:'dup'};
  }
  if(seen(key+'|run',days))return{skipped:'dup'};
  if(autoToday()>=dailyCap()){
    raise(manager,{kind:'cap_reached',severity:'low',title:'بلغ التنفيذ التلقائي سقفه اليومي',reason:'أُوقف التنفيذ التلقائي لبقية اليوم حمايةً من الإفراط. الحد الحالي '+dailyCap()+' إجراء يوميًا.',dedupe:'cap:'+dayStart()});
    return{skipped:'cap'};
  }
  let result;
  try{result=T.exec(args)}catch(e){aiAudit({manager,action:tool,mode:'auto',target,reason:o.reason,refs:o.refs,result:'error:'+(e.message||'')});return{error:e.message}}
  mark(key+'|run');aiAudit({manager,action:tool,mode:'auto',target,reason:o.reason,refs:o.refs,result:'ok:'+result});
  return{done:1,result};
};

// ---------- قرار المدير على نتيجة ----------
export const decide=(id,adminId,decision,note)=>{
  const f=get('SELECT * FROM ai_findings WHERE id=?',id);
  if(!f)throw err(404,'غير موجود');
  if(!['open','pending'].includes(f.status))throw err(400,'سبق اتخاذ قرار في هذه الحالة');
  note=String(note||'').trim().slice(0,300);
  let status;
  if(decision==='approve'){
    if(!f.proposal)throw err(400,'لا يوجد إجراء مقترح للموافقة عليه');
    const p=JSON.parse(f.proposal),T=TOOLS[p.tool];if(!T)throw err(400,'أداة غير معروفة');
    const result=T.exec(p.args);
    aiAudit({manager:f.manager,action:p.tool,mode:'human',target:f.subject_type?f.subject_type+':'+f.subject_id:null,reason:f.reason,refs:'finding:'+id,result:'ok:'+result,approved_by:adminId});
    audit(adminId,'ai_approve',`${id}:${p.tool}`);status='approved';
  }else if(decision==='reject')status='rejected';
  else if(decision==='dismiss')status='dismissed';
  else if(decision==='resolve')status='resolved';
  else throw err(400,'قرار غير صالح');
  run("UPDATE ai_findings SET status=?,decided_by=?,decided_at=datetime('now'),decision_note=? WHERE id=?",status,adminId,note||null,id);
  if(status!=='approved')aiAudit({manager:f.manager,action:'finding_'+status,mode:'human',target:'finding:'+id,reason:note,approved_by:adminId,result:'ok'});
  return{ok:1,status};
};

export const undo=(id,adminId)=>{
  const f=get('SELECT * FROM ai_findings WHERE id=?',id);
  if(!f||f.status!=='approved'||!f.proposal)throw err(404,'لا يوجد إجراء يمكن التراجع عنه');
  const p=JSON.parse(f.proposal),T=TOOLS[p.tool];if(!T?.undo)throw err(400,'هذا الإجراء لا يمكن التراجع عنه آليًا');
  const result=T.undo(p.args);
  aiAudit({manager:f.manager,action:p.tool+':undo',mode:'human',target:'finding:'+id,reason:'تراجع',result:'ok:'+result,approved_by:adminId});
  audit(adminId,'ai_undo',`${id}:${p.tool}`);
  run("UPDATE ai_findings SET status='undone' WHERE id=?",id);
  return{ok:1};
};

// ---------- سياق المدير: كل ما يراه المدير الذكي هو هذا فقط ----------
export const makeCtx=(manager,job,params)=>{
  const c={manager,job,params,newFindings:0,actions:0,
    all,get,
    raise:f=>{const id=raise(manager,f);if(id)c.newFindings++;return id},
    act:(tool,args,o)=>{const r=act(manager,tool,args,o);if(r.done||r.simulated||r.proposed)c.actions++;return r},
    cfgGet:k=>cfg(k),
    cursorGet:k=>+cfg('cursor.'+manager+'.'+k,'0')||0,
    cursorSet:(k,v)=>setCfg('cursor.'+manager+'.'+k,v,null)};
  return c;
};
