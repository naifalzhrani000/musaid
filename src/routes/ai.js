// مسارات مركز الذكاء: للمدير فقط (adm). الذكاء الاصطناعي نفسه لا يملك أي مسار هنا.
import {route,adm,tx,all,get,err,str} from '../core.js';
import {TOOLS,META,decide,undo,verifyChain,MODE_AR} from '../ai/kernel.js';
import {overview,setMode,setKill,setCap,jobs,setJob,runJob,runManager,buildReport,chat,RULES} from '../ai/center.js';

const parse=s=>{try{return s?JSON.parse(s):null}catch{return null}};
const shape=f=>({...f,evidence:parse(f.evidence),proposal:parse(f.proposal),manager_name:META[f.manager]?.name||f.manager,proposal_title:TOOLS[parse(f.proposal)?.tool]?.title||null,undoable:f.status==='approved'&&!!TOOLS[parse(f.proposal)?.tool]?.undo});

route('GET','/admin/ai/overview',c=>{adm(c);return overview()});
route('POST','/admin/ai/kill',c=>{const u=adm(c);setKill(!!c.b.on,u.id,String(c.b.reason||'').slice(0,200)||(c.b.on?'إيقاف طارئ':'استئناف'));return overview()});
route('POST','/admin/ai/mode',c=>{const u=adm(c);setMode(String(c.b.manager||''),String(c.b.mode||''),u.id,c.b.confirm===true);return overview()});
route('POST','/admin/ai/cap',c=>{const u=adm(c);setCap(c.b.cap,u.id);return overview()});

route('GET','/admin/ai/findings',c=>{adm(c);
  const st=c.q.status||'active',lim=Math.min(200,Math.max(1,+c.q.limit||60)),w=[],a=[];
  if(st==='active')w.push("status IN ('open','pending')");else if(st==='pending')w.push("status='pending'");else if(st==='closed')w.push("status NOT IN ('open','pending')");
  if(META[c.q.manager]){w.push('manager=?');a.push(c.q.manager)}
  if(['high','medium','low','info'].includes(c.q.severity)){w.push('severity=?');a.push(c.q.severity)}
  return all(`SELECT * FROM ai_findings ${w.length?'WHERE '+w.join(' AND '):''} ORDER BY CASE severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 ELSE 3 END,id DESC LIMIT ?`,...a,lim).map(shape)});
route('POST','/admin/ai/findings/(\\d+)/decide',c=>tx(()=>{const u=adm(c);return decide(+c.p[0],u.id,String(c.b.decision||''),c.b.note)}));
route('POST','/admin/ai/findings/(\\d+)/undo',c=>tx(()=>{const u=adm(c);return undo(+c.p[0],u.id)}));

route('GET','/admin/ai/audit',c=>{adm(c);const lim=Math.min(300,Math.max(1,+c.q.limit||100)),before=+c.q.before||1e15;return all('SELECT id,manager,action,mode,target,reason,refs,result,approved_by,at,hash FROM ai_audit WHERE id<? ORDER BY id DESC LIMIT ?',before,lim)});
route('GET','/admin/ai/audit/verify',c=>{adm(c);return verifyChain()});

route('GET','/admin/ai/jobs',c=>{adm(c);return jobs()});
route('POST','/admin/ai/jobs/update',c=>{const u=adm(c);setJob(String(c.b.job||''),c.b,u.id);return jobs()});
route('POST','/admin/ai/run',c=>{adm(c);const m=String(c.b.manager||''),j=String(c.b.job||'');
  if(j)return[{job:j,...runJob(j,'manual')}];if(!RULES[m])throw err(400,'مدير غير معروف');return runManager(m,'manual')});

route('GET','/admin/ai/reports',c=>{adm(c);return all('SELECT id,kind,period_from,period_to,summary,created_at FROM ai_reports ORDER BY id DESC LIMIT 30')});
route('GET','/admin/ai/reports/(\\d+)',c=>{adm(c);const r=get('SELECT * FROM ai_reports WHERE id=?',+c.p[0]);if(!r)throw err(404,'غير موجود');return{...r,data:parse(r.data)}});
route('POST','/admin/ai/reports',c=>{adm(c);return buildReport(c.b.kind==='weekly'?'weekly':'daily')});

route('POST','/admin/ai/chat',c=>{const u=adm(c);return chat(str(c.b.text,2,300,'الأمر'),u.id)});
