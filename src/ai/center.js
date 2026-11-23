// المدير العام (Orchestrator): جدولة المهام، تشغيل المدراء، التقارير، وواجهة الأوامر بالعربية.
import {db,all,get,run,err,audit,tx} from '../core.js';
import {META,MODES,MODE_AR,cfg,setCfg,isOn,envKilled,modeOf,dailyCap,pausedUntil,aiAudit,makeCtx,verifyChain} from './kernel.js';
import * as guard from './guard.js';
import * as support from './support.js';
import * as ops from './ops.js';
import * as finance from './finance.js';
import * as growth from './growth.js';

export const RULES={guard:guard.rules,support:support.rules,ops:ops.rules,finance:finance.rules,growth:growth.rules};
const REPORT_JOBS={'orchestrator.daily_report':{title:'التقرير اليومي',interval:1440,kind:'daily'},'orchestrator.weekly_report':{title:'التقرير الأسبوعي',interval:10080,kind:'weekly'}};

// ---------- المهام: تُزرَع من تعريفات المدراء، ويعدّل المدير التفعيل والتوقيت والعتبات فقط ----------
for(const [m,rules] of Object.entries(RULES))for(const [k,r] of Object.entries(rules))
  run('INSERT INTO ai_jobs(job,manager,title,interval_min,enabled) VALUES(?,?,?,?,1) ON CONFLICT(job) DO UPDATE SET title=excluded.title,manager=excluded.manager',m+'.'+k,m,r.title,r.interval);
for(const [j,r] of Object.entries(REPORT_JOBS))run("INSERT INTO ai_jobs(job,manager,title,interval_min,enabled) VALUES(?,'orchestrator',?,?,1) ON CONFLICT(job) DO UPDATE SET title=excluded.title",j,r.title,r.interval);

const ruleOf=job=>{const [m,k]=job.split('.');return RULES[m]?.[k]?{manager:m,key:k,rule:RULES[m][k]}:null};
const paramsOf=(rule,row)=>{let o={};try{o=JSON.parse(row.params||'{}')}catch{}const p={...rule.params};for(const k of Object.keys(p))if(Number.isFinite(+o[k]))p[k]=+o[k];return p};

export const setJob=(job,b,adminId)=>{
  const row=get('SELECT * FROM ai_jobs WHERE job=?',job);if(!row)throw err(404,'المهمة غير موجودة');
  if(b.enabled!=null)run('UPDATE ai_jobs SET enabled=? WHERE job=?',b.enabled?1:0,job);
  if(b.interval_min!=null){const n=Math.round(+b.interval_min);if(!(n>=5&&n<=43200))throw err(400,'الفاصل بين 5 دقائق و30 يومًا');run('UPDATE ai_jobs SET interval_min=? WHERE job=?',n,job)}
  if(b.params&&typeof b.params==='object'){const r=ruleOf(job);if(!r)throw err(400,'هذه المهمة بلا عتبات');let cur={};try{cur=JSON.parse(row.params||'{}')}catch{}
    for(const k of Object.keys(b.params)){if(!(k in r.rule.params))throw err(400,'عتبة غير معروفة: '+k);const v=+b.params[k];if(!(v>=0&&v<=100000))throw err(400,'قيمة غير صالحة: '+k);cur[k]=v}
    run('UPDATE ai_jobs SET params=? WHERE job=?',JSON.stringify(cur),job)}
  aiAudit({manager:'orchestrator',action:'job_update',mode:'human',target:job,reason:JSON.stringify(b).slice(0,200),approved_by:adminId,result:'ok'});audit(adminId,'ai_job',job);
};
export const jobs=()=>all('SELECT * FROM ai_jobs ORDER BY manager,job').map(j=>{const r=ruleOf(j.job);return{...j,params:r?paramsOf(r.rule,j):{},defaults:r?r.rule.params:{}}});

// ---------- التشغيل ----------
const FAIL_LIMIT=3;
export const runJob=(job,trigger='scheduler')=>{
  const row=get('SELECT * FROM ai_jobs WHERE job=?',job);if(!row)throw err(404,'المهمة غير موجودة');
  if(!isOn())return{skipped:'off'};
  if(REPORT_JOBS[job]){const rep=buildReport(REPORT_JOBS[job].kind);run("UPDATE ai_jobs SET last_run=datetime('now') WHERE job=?",job);return{report:rep.id}}
  const r=ruleOf(job);if(!r)throw err(404,'المهمة غير معروفة');
  const mode=modeOf(r.manager);if(mode==='off')return{skipped:'off'};
  if(pausedUntil(r.manager))return{skipped:'paused'};
  const params=paramsOf(r.rule,row);let lastErr=null,ctx=null;
  const runId=Number(run("INSERT INTO ai_runs(manager,job,via,started_at) VALUES(?,?,?,datetime('now'))",r.manager,job,trigger).lastInsertRowid);
  for(let attempt=0;attempt<2;attempt++){ // محاولة واحدة إضافية فقط، والعمليات مانعة للتكرار
    try{ctx=makeCtx(r.manager,job,params);r.rule.run(ctx);lastErr=null;break}catch(e){lastErr=e}
  }
  if(lastErr){
    run("UPDATE ai_runs SET finished_at=datetime('now'),ok=0,error=? WHERE id=?",String(lastErr.message||lastErr).slice(0,300),runId);
    const fails=(+cfg('fails.'+r.manager,'0')||0)+1;setCfg('fails.'+r.manager,fails,null);
    if(fails>=FAIL_LIMIT){setCfg('paused.'+r.manager,new Date(Date.now()+36e5).toISOString(),null);setCfg('fails.'+r.manager,0,null);
      aiAudit({manager:r.manager,action:'circuit_breaker',mode:'system',reason:'توقف ساعة بعد '+FAIL_LIMIT+' إخفاقات متتالية',result:'paused'});
      try{ctx=makeCtx(r.manager,job,{});ctx.raise({kind:'manager_paused',severity:'high',title:'أُوقف '+META[r.manager].name+' ساعة بسبب أخطاء متكررة',reason:'آخر خطأ: '+String(lastErr.message).slice(0,200),dedupe:'breaker:'+r.manager+':'+new Date().toISOString().slice(0,13)})}catch{}}
    return{error:String(lastErr.message)};
  }
  setCfg('fails.'+r.manager,0,null);
  run("UPDATE ai_runs SET finished_at=datetime('now'),ok=1,new_findings=?,actions=? WHERE id=?",ctx.newFindings,ctx.actions,runId);
  run("UPDATE ai_jobs SET last_run=datetime('now') WHERE job=?",job);
  return{ok:1,new_findings:ctx.newFindings,actions:ctx.actions};
};
export const runManager=(m,trigger='manual')=>{
  if(!RULES[m])throw err(400,'مدير غير معروف');
  const out=[];for(const j of all('SELECT job FROM ai_jobs WHERE manager=? AND enabled=1 ORDER BY job',m))out.push({job:j.job,...runJob(j.job,trigger)});
  return out;
};
let ticking=false;
export const tick=()=>{
  if(ticking||!isOn())return;ticking=true;
  try{
    for(const j of all("SELECT job FROM ai_jobs WHERE enabled=1 AND (last_run IS NULL OR datetime(last_run,'+'||interval_min||' minutes')<=datetime('now')) ORDER BY last_run LIMIT 6")){
      try{runJob(j.job,'scheduler')}catch(e){console.error('ai:',j.job,e.message)}
    }
  }finally{ticking=false}
};
export const startScheduler=()=>{
  if(process.env.AI_SCHEDULER==='0')return;
  setTimeout(tick,15000).unref();setInterval(tick,Math.max(10,+process.env.AI_TICK_SECONDS||60)*1000).unref();
};

// ---------- الأوضاع والحدود (توسيع الاستقلال يمر من هنا فقط وبتأكيد صريح) ----------
export const setMode=(m,mode,adminId,confirm)=>{
  if(!META[m])throw err(400,'مدير غير معروف');if(!MODES.includes(mode))throw err(400,'وضع غير صالح');
  if(['finance','growth'].includes(m)&&!['off','observe'].includes(mode))throw err(400,'هذا المدير للمراقبة والتحليل فقط');
  if(mode==='auto'){
    if(confirm!==true)throw err(400,'التنفيذ التلقائي يتطلب تأكيدًا صريحًا');
    const ok=get('SELECT COUNT(*) n FROM ai_runs WHERE manager=? AND ok=1',m).n;
    if(ok<3)throw err(400,'يلزم نجاح 3 دورات مراقبة على الأقل قبل التنفيذ التلقائي (الناجحة حاليًا: '+ok+')');
  }
  const prev=modeOf(m);setCfg('mode.'+m,mode,adminId);
  aiAudit({manager:m,action:'set_mode',mode:'human',reason:`${MODE_AR[prev]} ← ${MODE_AR[mode]}`,approved_by:adminId,result:'ok'});audit(adminId,'ai_mode',m+':'+mode);
};
export const setKill=(on,adminId,why,via='human')=>{
  if(envKilled()&&!on)throw err(400,'الإيقاف مفروض من متغير البيئة AI_DISABLED على الخادم');
  setCfg('enabled',on?'0':'1',adminId);
  aiAudit({manager:'orchestrator',action:on?'emergency_stop':'resume',mode:via,reason:why,approved_by:adminId,result:'ok'});audit(adminId,on?'ai_stop':'ai_resume',String(why||'').slice(0,100));
};
export const setCap=(n,adminId)=>{n=Math.round(+n);if(!(n>=0&&n<=1000))throw err(400,'الحد بين 0 و1000');setCfg('auto_daily_cap',n,adminId);aiAudit({manager:'orchestrator',action:'set_cap',mode:'human',reason:String(n),approved_by:adminId,result:'ok'})};

// ---------- نظرة عامة ----------
export const overview=()=>{
  const managers=Object.entries(META).map(([k,m])=>{
    const st=get("SELECT COALESCE(SUM(ok=1),0) ok,COALESCE(SUM(ok=0 AND finished_at IS NOT NULL),0) fail,MAX(finished_at) last FROM ai_runs WHERE manager=?",k);
    const f=get("SELECT COALESCE(SUM(status IN ('open','pending')),0) open,COALESCE(SUM(status='pending'),0) pending FROM ai_findings WHERE manager=?",k);
    return{key:k,name:m.name,desc:m.desc,mode:modeOf(k),mode_ar:MODE_AR[modeOf(k)],paused_until:pausedUntil(k),runs_ok:st.ok,runs_fail:st.fail,last_run:st.last,open:f.open,pending:f.pending,max_mode:['finance','growth'].includes(k)?'observe':'auto'};
  });
  const cnt=s=>get(s).n;
  return{enabled:isOn(),env_disabled:envKilled(),auto_daily_cap:dailyCap(),auto_today:cnt("SELECT COUNT(*) n FROM ai_audit WHERE mode='auto' AND at>='"+new Date().toISOString().slice(0,10)+"'"),
    pending_approvals:cnt("SELECT COUNT(*) n FROM ai_findings WHERE status='pending'"),open_findings:cnt("SELECT COUNT(*) n FROM ai_findings WHERE status IN ('open','pending')"),
    high_open:cnt("SELECT COUNT(*) n FROM ai_findings WHERE status IN ('open','pending') AND severity='high'"),managers,
    cost:{provider:'لا يوجد (قواعد برمجية داخل الخادم)',tokens:0,sar:0}};
};

// ---------- التقارير ----------
const iso=days=>new Date(Date.now()-days*864e5).toISOString();
export const buildReport=kind=>{
  const days=kind==='weekly'?7:1,from=iso(days),sq=`datetime('now','-${days} days')`;
  const n=(s,...a)=>get(s,...a).n;
  const d={
    period_days:days,
    auto_actions:n("SELECT COUNT(*) n FROM ai_audit WHERE mode='auto' AND result LIKE 'ok:%' AND at>=?",from),
    simulated:n("SELECT COUNT(*) n FROM ai_audit WHERE mode='observe-sim' AND at>=?",from),
    human_actions:n("SELECT COUNT(*) n FROM ai_audit WHERE mode='human' AND at>=?",from),
    findings_new:all(`SELECT manager,severity,COUNT(*) n FROM ai_findings WHERE created_at>=${sq} GROUP BY manager,severity`),
    pending_now:n("SELECT COUNT(*) n FROM ai_findings WHERE status='pending'"),open_now:n("SELECT COUNT(*) n FROM ai_findings WHERE status IN ('open','pending')"),
    decisions:all(`SELECT status,COUNT(*) n FROM ai_findings WHERE decided_at>=${sq} GROUP BY status`),
    avg_decision_hours:get(`SELECT ROUND(AVG((julianday(decided_at)-julianday(created_at))*24),1) h FROM ai_findings WHERE decided_at>=${sq}`).h,
    runs:all(`SELECT manager,COUNT(*) total,SUM(ok=1) ok FROM ai_runs WHERE started_at>=${sq} GROUP BY manager`),
    platform:{orders_new:n(`SELECT COUNT(*) n FROM agreements WHERE created_at>=${sq}`),orders_completed:n(`SELECT COUNT(*) n FROM agreements WHERE completed_at>=${sq}`),disputes_new:n(`SELECT COUNT(*) n FROM agreements WHERE disputed_at>=${sq}`),
      reports_new:n(`SELECT COUNT(*) n FROM reports WHERE created_at>=${sq}`),reports_open:n("SELECT COUNT(*) n FROM reports WHERE status='open'"),
      avg_days_to_complete_30d:get("SELECT ROUND(AVG(julianday(completed_at)-julianday(created_at)),1) d FROM agreements WHERE status='completed' AND completed_at>datetime('now','-30 days')").d,
      avg_days_dispute_first_decision:get("SELECT ROUND(AVG(julianday(dispute_decided_at)-julianday(disputed_at)),1) d FROM agreements WHERE dispute_decided_at>datetime('now','-90 days')").d},
    cost:{tokens:0,sar:0}
  };
  const totRuns=d.runs.reduce((s,r)=>s+r.total,0),okRuns=d.runs.reduce((s,r)=>s+(r.ok||0),0);d.automation_success_pct=totRuns?Math.round(okRuns/totRuns*100):null;
  const sev=s=>d.findings_new.filter(x=>x.severity===s).reduce((a,x)=>a+x.n,0);
  const lines=[`تقرير ${kind==='weekly'?'أسبوعي':'يومي'} للذكاء الاصطناعي`,
    `الإجراءات المنفّذة تلقائيًا: ${d.auto_actions} · المحاكاة (مراقبة): ${d.simulated} · قرارات الإدارة: ${d.human_actions}`,
    `حالات جديدة: ${sev('high')} عالية، ${sev('medium')} متوسطة، ${sev('low')+sev('info')} منخفضة/معلومات`,
    `بانتظار موافقتك: ${d.pending_now} · مفتوحة إجمالًا: ${d.open_now}`+(d.avg_decision_hours!=null?` · متوسط زمن القرار ${d.avg_decision_hours} ساعة`:''),
    `نجاح تشغيل المهام: ${d.automation_success_pct==null?'لا توجد دورات':d.automation_success_pct+'%'}`,
    `المنصة: ${d.platform.orders_new} طلبات جديدة، ${d.platform.orders_completed} مكتملة، ${d.platform.disputes_new} نزاعات جديدة، ${d.platform.reports_open} بلاغات مفتوحة`,
    `التكلفة التشغيلية للذكاء: 0 ريال (لا رموز ولا مزود خارجي)`];
  const id=Number(run('INSERT INTO ai_reports(kind,period_from,period_to,summary,data) VALUES(?,?,?,?,?)',kind,from,new Date().toISOString(),lines.join('\n'),JSON.stringify(d)).lastInsertRowid);
  if(kind==='daily'){run("DELETE FROM ai_runs WHERE started_at<datetime('now','-60 days')")}
  return{id,summary:lines.join('\n'),data:d};
};

// ---------- واجهة الأوامر بالعربية (للقراءة والتشغيل والإيقاف فقط؛ لا توسّع الصلاحيات) ----------
const norm=s=>String(s||'').normalize('NFKC').replace(/[ً-ٟـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').toLowerCase();
const MGR_WORDS={guard:['الرقابه','الحمايه','الاحتيال'],support:['الشكاوي','العملاء','الدعم'],ops:['العمليات','الطلبات'],finance:['الماليه','المالي','الماليه'],growth:['النمو','التسويق']};
export const chat=(text,adminId)=>{
  const t=norm(text);if(!t.trim())throw err(400,'اكتب أمرًا');
  const has=(...w)=>w.some(x=>t.includes(x));
  const mgrIn=Object.entries(MGR_WORDS).find(([,ws])=>ws.some(w=>t.includes(w)))?.[0];
  if(has('غير ','غيّر','عدل','بدل','ارفع','خفض','صلاحي')&&has('تلقائي','موافقه','مراقبه','صلاحي','وضع')){return{reply:'لا أغيّر الصلاحيات من المحادثة حمايةً من الأخطاء. افتح تبويب الإعدادات في مركز الذكاء لتغيير وضع أي مدير، وسيُطلب منك تأكيد صريح.'}}
  if(has('ايقاف طارئ','اوقف الذكاء','وقف الذكاء','اوقف كل','ايقاف الذكاء')){setKill(true,adminId,'أمر محادثة','command');return{reply:'تم الإيقاف الطارئ: لن يُنفَّذ أي إجراء آلي حتى تستأنف التشغيل. وظائف المنصة الأساسية لم تتأثر.'}}
  if(has('استئناف','شغل الذكاء','تشغيل الذكاء','فعل الذكاء')){setKill(false,adminId,'أمر محادثة','command');return{reply:'استُؤنف تشغيل الذكاء. الأوضاع الحالية للمدراء كما هي دون تغيير.'}}
  if(has('تشغيل','شغل','افحص','فحص','نفذ')&&mgrIn&&!has('الذكاء')){const r=runManager(mgrIn,'command');return{reply:`شُغّل ${META[mgrIn].name}: ${r.length} مهمة. حالات جديدة: ${r.reduce((s,x)=>s+(x.new_findings||0),0)}.`,data:r}}
  if(has('الموافقات','المعلقه','ينتظر','بانتظار')){const rows=all("SELECT id,title,severity FROM ai_findings WHERE status='pending' ORDER BY id DESC LIMIT 5");return{reply:rows.length?`بانتظار موافقتك ${get("SELECT COUNT(*) n FROM ai_findings WHERE status='pending'").n} حالة. أحدثها:\n`+rows.map(r=>`#${r.id} ${r.title}`).join('\n'):'لا توجد حالات بانتظار موافقتك.',data:rows}}
  if(has('المتعثره','متعثر','المتاخره','متاخر','عالقه')){const rows=all("SELECT id,title FROM ai_findings WHERE kind IN ('stuck_order','stuck_escalation') AND status IN ('open','pending') ORDER BY id DESC LIMIT 8");return{reply:rows.length?`الطلبات المتعثرة المرصودة:\n`+rows.map(r=>`#${r.id} ${r.title}`).join('\n'):'لا توجد طلبات متعثرة مرصودة حاليًا.',data:rows}}
  if(has('نزاع','النزاعات')){const rows=all("SELECT id,title,severity FROM ai_findings WHERE kind IN ('dispute_brief','dispute_sla') AND status IN ('open','pending') ORDER BY id DESC LIMIT 8");return{reply:rows.length?'النزاعات المفتوحة:\n'+rows.map(r=>`#${r.id} ${r.title}`).join('\n'):'لا توجد نزاعات مفتوحة.',data:rows}}
  if(has('خطر','عاليه','حرجه','عاجل')){const rows=all("SELECT id,title FROM ai_findings WHERE severity='high' AND status IN ('open','pending') ORDER BY id DESC LIMIT 8");return{reply:rows.length?'الحالات عالية الخطورة:\n'+rows.map(r=>`#${r.id} ${r.title}`).join('\n'):'لا توجد حالات عالية الخطورة مفتوحة.',data:rows}}
  if(has('تقرير','ملخص','حاله','كيف')){const r=buildReport('daily');return{reply:r.summary,data:{report_id:r.id}}}
  if(has('تكلفه','ميزانيه','رموز')){return{reply:'تكلفة الذكاء الاصطناعي 0 ريال: لا يوجد مزود خارجي ولا رموز مستهلكة، وكل التحليل يعمل داخل خادمك.'}}
  return{reply:'يمكنني: «ملخص اليوم»، «الموافقات المعلقة»، «الطلبات المتعثرة»، «النزاعات»، «الحالات العالية الخطورة»، «شغّل مدير الرقابة/العمليات/…»، «إيقاف طارئ»، «استئناف التشغيل». لتغيير صلاحيات المدراء استخدم تبويب الإعدادات.'};
};

export {verifyChain,MODES,MODE_AR};
