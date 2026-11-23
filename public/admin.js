async function manage(initial){if(!me.user||!['admin','staff'].includes(me.user.role)){location.hash='#/profile';return}
const isAdmin=me.user.role==='admin',perms=(me.user.perms||'').split(',');const canA=a=>isAdmin||perms.includes(a);
let curUser=((initial&&/^user\/(\d+)$/.exec(initial))||[])[1]||null;let curChat=((initial&&/^chat\/(\d+)$/.exec(initial))||[])[1]||null;
let tab=curUser?'users':curChat?'chat':['home','users','orders','cats','fin','acc','ads','audit','rate','pts','rpt','rep','chat','disp','supply','verify','staff','ai','sys'].includes(initial)?initial:'home',homeDays=30;
app.innerHTML=`<style>
#mgBody,#mgNav,.mg-tabs{font-family:'IBM Plex Sans Arabic',Tahoma,system-ui,sans-serif;color:#1f1b2c}
.mg-shell{display:grid;grid-template-columns:164px minmax(0,1fr);grid-template-rows:82px minmax(0,1fr);min-height:100vh;background:#f4f2fa}
.mg-tabs{display:flex;flex-direction:column;gap:4px;background:#241560;color:#fff;padding:18px 12px;position:sticky;top:0;height:calc(100vh - 82px);overflow-y:auto;scrollbar-width:thin}
.mg-main{grid-column:2;grid-row:2;padding:22px 24px;min-width:0}
.mg-burger{display:none;align-items:center;justify-content:center;width:40px;height:40px;border:1px solid #c1bbd3;background:#fff;border-radius:10px;font-size:18px;cursor:pointer;margin:10px 14px 0 auto}
.mg-tab{border:0;background:none;padding:10px 12px;font:inherit;font-size:14px;color:#ddd5fb;cursor:pointer;text-align:start;border-radius:10px;white-space:nowrap}
.mg-tab:hover{background:rgba(255,255,255,.08);color:#fff}
.mg-tab.on{background:#fff;color:#241560;font-weight:600}
@media (max-width:900px){.mg-shell{grid-template-columns:1fr}.mg-burger{display:inline-flex}.mg-tabs{position:fixed;top:0;bottom:0;inset-inline-start:0;width:264px;height:100vh;transform:translateX(105%);transition:transform .2s ease;z-index:60;box-shadow:0 0 24px rgba(0,0,0,.25)}.mg-tabs.open{transform:none}.mg-main{padding:14px}}
.mg-tab:focus-visible{outline:2px solid #5331b6;outline-offset:-2px;border-radius:4px}
.mg-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));background:#fff;border:1px solid #cac0e5;border-radius:8px;overflow:hidden;margin-bottom:22px}
.mg-stat{padding:14px 18px;border-inline-start:1px solid #ebe8df}
.mg-stat:first-child{border-inline-start:0}
.mg-stat small{display:block;color:#625a76;font-size:12.5px;margin-bottom:4px}
.mg-stat b{display:block;font-size:24px;font-weight:600;color:#5331b6;font-variant-numeric:tabular-nums;line-height:1.2}
.mg-h{font-size:15px;font-weight:600;color:#5331b6;margin:26px 0 8px;padding-bottom:8px;border-bottom:1px solid #cac0e5}
.mg-row{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:12px 2px;border-bottom:1px solid #ebe8df;background:transparent;font-size:14px}
.mg-row:hover{background:#fbfaff}
.mg-row b{font-variant-numeric:tabular-nums}
.mg-row small{color:#625a76;font-size:12.5px}
.mg-chip{display:inline-flex;align-items:center;gap:6px;background:#ede8f9;color:#5331b6;border-radius:4px;padding:3px 8px;margin:3px;font-size:13px}
.mg-chip button{border:0;background:none;color:#8a2b2b;cursor:pointer;font-size:14px;padding:0}
#mgBody .btn{border-radius:6px;font-size:14px;padding:7px 14px;font-weight:500;background:#5331b6;color:#fff;border:1px solid #5331b6}
#mgBody .btn.alt{background:#fff;color:#5331b6;border:1px solid #5331b6}
#mgBody .btn:hover{filter:brightness(1.08)}
#mgBody .btn:focus-visible,#mgBody input:focus-visible,#mgBody select:focus-visible,#mgBody textarea:focus-visible{outline:2px solid #c98a1b;outline-offset:2px}
#mgBody input,#mgBody select,#mgBody textarea{border:1px solid #c1bbd3;border-radius:6px;padding:7px 10px;background:#fff;font:inherit;color:#1f1b2c}
#mgBody .warn{color:#8a5a00}
@media (max-width:520px){.mg-stats{grid-template-columns:1fr 1fr}.mg-stat b{font-size:20px}}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style>

<div class=mg-shell><div class=mg-topbar><div class=mg-brand><img loading=lazy decoding=async src="/admin-logo.png" alt="" width=34 height=34><b>المساعد</b></div><div class=mg-tb-end><button class=mg-theme id=mgTheme type=button aria-pressed=false>🌙 داكن</button><span class=mg-bell aria-hidden=true>🔔</span><span class=mg-avatar aria-hidden=true>A</span><button class=mg-burger id=mgBurger type=button aria-label="فتح القائمة">☰</button></div></div><nav class=mg-tabs id=mgNav aria-label="أقسام الإدارة"></nav><main class=mg-main><header class=mg-page-head id=mgHead></header><div id=mgBody></div></main></div>`;
const body=()=>$('#mgBody');
const TABS=[['home','المتابعة','admin'],['users','المستخدمون','support'],['orders','الطلبات','support'],['cats','الأقسام والكلمات','admin'],['fin','المالية','finance'],['acc','المحاسبة','accounting'],['ads','الإعلانات','admin'],['audit','سجل العمليات','admin'],['admins','المشرفون','admin'],['perf','أداء المساعدين','support'],['rep','الشكاوى','support'],['chat','المحادثات','support'],['rate','التقييمات','support'],['pts','النقاط','finance'],['rpt','التقارير','admin'],['insights','تحليل الطلب','admin'],['disp','النزاعات','support'],['supply','التوريدات','admin'],['verify','التوثيق','admin'],['staff','الموظفون','admin'],['ai','الذكاء الاصطناعي','admin'],['sys','النظام','admin']];
const shown=TABS.filter(t=>canA(t[2]));if(!shown.length){body().innerHTML='<small>لا توجد أقسام متاحة لصلاحياتك.</small>';return}
const NAV_ICON={ai:'chart',home:'home',users:'users',orders:'orders',rpt:'alert',cats:'grid',fin:'card',sys:'gear',insights:'chart'};const PRIMARY=['home','users','orders','rpt','cats','fin','ai','sys'];const navBtn=([k,l])=>`<button class=mg-tab data-t=${k} type=button${k===tab?' aria-current="page"':''}>${NAV_ICON[k]?svgI(NAV_ICON[k],18):''}<span>${l}</span></button>`;
$('#mgNav').innerHTML=`<div class=mg-brand-side><img loading=lazy decoding=async src="/admin-logo.png" alt="" width=40 height=40><b>المساعد</b></div>`+shown.filter(x=>PRIMARY.includes(x[0])).map(navBtn).join('')+(shown.some(x=>!PRIMARY.includes(x[0]))?`<div class=mg-sep>أقسام أخرى</div>`+shown.filter(x=>!PRIMARY.includes(x[0])).map(navBtn).join(''):'')+`<a class=mg-tab href="#" data-act="logout" style="margin-top:auto">${svgI('out',18)}<span>تسجيل الخروج</span></a>`;const mgNavEl=()=>$('#mgNav'),mgBtn=()=>$('#mgBurger');const mgSetMenu=o=>{mgNavEl().classList.toggle('open',o);mgBtn().setAttribute('aria-expanded',String(o));mgBtn().setAttribute('aria-label',o?'إغلاق القائمة':'فتح القائمة')};mgBtn().onclick=()=>mgSetMenu(!mgNavEl().classList.contains('open'));mgNavEl().addEventListener('click',e=>{if(e.target.closest('.mg-tab'))mgSetMenu(false)});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&mgNavEl().classList.contains('open')){mgSetMenu(false);mgBtn().focus()}});$('#mgBody').addEventListener('click',()=>{if(mgNavEl().classList.contains('open'))mgSetMenu(false)});$('#mgTheme').onclick=()=>{const d=!document.querySelector('.mg-shell').classList.contains('mg-dark');try{localStorage.setItem('mgTheme',d?'dark':'light')}catch{}applyMgTheme(d)};applyMgTheme(localStorage.getItem('mgTheme')==='dark');
if(!shown.some(t=>t[0]===tab))tab=shown[0][0];
const drawAcc=async()=>{const mo=window.__accMonth||new Date().toISOString().slice(0,7);const d=await api('/admin/accounting?month='+mo);const f=n=>Number(n||0).toLocaleString('en-GB',{maximumFractionDigits:2});body().innerHTML=`<h3 class=mg-h>المحاسبة</h3><div class=mg-row style="gap:8px;align-items:center;flex-wrap:wrap"><input type=month id=accM value="${mo}" style="padding:8px;border:1px solid #d9d5e8;border-radius:8px"><button class="btn alt sm" id=accGo>عرض</button></div><div class=mg-row><div><b>إيراد العمولات المدفوعة</b></div><b>${f(d.income)} ريال</b></div><div class=mg-row><div><b>المصروفات</b></div><b>${f(d.expenses)} ريال</b></div><div class=mg-row><div><b>صافي الربح</b></div><b>${f(d.profit)} ريال</b></div><div class=mg-row><div><b>ضريبة تقديرية على العمولة</b><br><small>${esc(d.vat_note)}</small></div><b>${f(d.vat)} ريال</b></div><div class=mg-row><div><b>الفواتير الصادرة</b></div><b>${d.invoices} (${f(d.invoices_total)} ريال)</b></div><div class=mg-row><div><b>مستحقات المساعدين غير المدفوعة</b></div><b>${f(d.payables)} ريال</b></div><div class=mg-row><div><b>تطابق القيود</b><br><small>${d.reconciled?'مطابق: مجموع القيود يساوي الملخص':'غير مطابق: راجع البيانات قبل التدقيق'}</small></div></div><h4 class=mg-h>تصدير للمراجعة</h4><div class=mg-row style="gap:8px;flex-wrap:wrap"><button class="btn sm" data-exp=journal>قيود اليومية (CSV)</button><button class="btn sm" data-exp=invoices>سجل الفواتير (CSV)</button><button class="btn sm" data-exp=commissions>سجل العمولات (CSV)</button></div>`;
 $('#accGo').onclick=()=>{window.__accMonth=$('#accM').value;drawAcc()};
 body().insertAdjacentHTML('beforeend',`<h3 class=mg-h>تسجيل مصروف</h3><form id=exf class=form><label>البند<input name=title required minlength=3 maxlength=120></label><label>المبلغ (ريال)<input name=amount type=number min=1 step=0.01 required></label><label>التصنيف<input name=category maxlength=60></label><button class=btn>تسجيل المصروف</button></form>`);
$('#exf').onsubmit=sub(async b=>{await api('/admin/expenses','POST',b);toast('تم تسجيل المصروف');drawAcc()});
body().querySelectorAll('[data-exp]').forEach(b=>b.onclick=async()=>{try{const r=await fetch(`/api/admin/accounting/export?month=${mo}&type=${b.dataset.exp}`,{credentials:'same-origin'});if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.error||'تعذّر التصدير')}const blob=await r.blob();const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${b.dataset.exp}-${mo}.csv`;a.click()}catch(x){toast(x.message,1)}})};
const drawCoverage=async()=>{const rows=await api('/admin/city-coverage');const box=document.createElement('div');box.innerHTML=`<h3 class=mg-h>تغطية المدن (فتح الخدمات الحضورية)</h3><small>تُفتح المدينة عند وجود مساعد نشط واحد على الأقل في 80% من التخصصات الحضورية.</small>`+recTable(['المدينة','الحالة','التغطية','الناقص','الإجراء'],rows.map(r=>`<tr><td><b>${esc(r.city)}</b></td><td><span class="${r.open?'pill':'pill-warn'}">${r.open?'مفتوحة':'قيد التجهيز'}</span></td><td style="min-width:140px"><div style="height:6px;background:#e9e6f6;border-radius:4px"><div style="height:6px;width:${Math.min(100,r.pct)}%;background:${r.open?'#5331b6':'#d97706'};border-radius:4px"></div></div><small>${r.pct}% (${r.covered}/${r.total})</small></td><td><small>${r.missing.length?r.missing.map(x=>esc(x)).join('، '):'مكتملة'}</small></td><td>${r.open?'—':`<button class="btn alt sm" data-open="${esc(r.city)}">فتح يدويًا</button>`}</td></tr>`),'لا توجد مدن بعد.');box.querySelectorAll('[data-open]').forEach(bt=>bt.onclick=async()=>{if(!(await askBox({title:'فتح المدينة يدويًا',text:'فتح '+bt.dataset.open+' يدويًا؟',ok:'فتح'})))return;try{await api('/admin/cities/open','POST',{city:bt.dataset.open});toast('تم الفتح');await drawSupply();await drawCoverage()}catch(x){toast(x.message,1)}});body().appendChild(box)};

// ===== مركز الذكاء الاصطناعي =====
const AI_SEV={high:['عالية','pill-warn'],medium:['متوسطة','pill-warn'],low:['منخفضة','pill'],info:['معلومة','pill']};
const AI_ST={open:'مفتوحة',pending:'بانتظار قرارك',approved:'اعتُمدت',rejected:'رُفضت',dismissed:'تُجوهلت',resolved:'أُنجزت',undone:'تُراجع عنها'};
const AI_MODES=[['off','معطّل'],['observe','مراقبة فقط'],['approval','بعد الموافقة'],['auto','تنفيذ تلقائي']];
const AI_MODE_AR=Object.fromEntries(AI_MODES),AI_MODE_LOG={'observe-sim':'محاكاة','auto':'تلقائي','human':'بقرار إنسان','system':'النظام','command':'أمر محادثة'};
const AI_MGR={guard:'الرقابة',support:'العملاء والشكاوى',ops:'العمليات',finance:'المالي',growth:'النمو',orchestrator:'المدير العام'};
let aiSub='home';
const aiT=s=>{if(!s)return '—';const d=new Date(/Z|T/.test(s)?s:String(s).replace(' ','T')+'Z');return isNaN(d)?esc(s):d.toLocaleString('ar-SA',{dateStyle:'short',timeStyle:'short'})};
const aiSubj=f=>{const id=f.subject_id;if(id==null)return '';const L={user:`#/manage/user/${id}`,agreement:'#/manage/orders',report:'#/manage/rep',rating:'#/manage/rate'}[f.subject_type];const N={user:'المستخدم',agreement:'الطلب',report:'البلاغ',rating:'التقييم',task:'المهمة',contact:'الرسالة'}[f.subject_type]||'';return L?`<a class=lnk href="${L}">${N} #${id}</a>`:`<small>${N} #${id}</small>`};
const aiEv=ev=>{if(!ev)return '';if(Array.isArray(ev.facts))return '<ul style="margin:6px 0;padding-inline-start:18px">'+ev.facts.map(x=>`<li>${esc(x)}</li>`).join('')+'</ul>';
  return '<small>'+Object.entries(ev).filter(([k,v])=>v!=null&&k!=='suggested_reply').map(([k,v])=>`${esc(k)}: <b dir=auto>${esc(typeof v==='object'?JSON.stringify(v):v)}</b>`).join(' · ')+'</small>'+(ev.suggested_reply?`<div style="margin-top:6px;padding:8px;background:#f4f2fa;border-radius:8px"><small>رد مقترح (لا يُرسل تلقائيًا):</small><div>${esc(ev.suggested_reply)}</div></div>`:'')};
const aiCard=(f,acts)=>{const [sl,sc]=AI_SEV[f.severity]||AI_SEV.low;return `<div class=mg-row style="display:block"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center"><div><span class="${sc}">${sl}</span> <b>${esc(f.title)}</b></div><small>${esc(f.manager_name)} · ${aiT(f.created_at)} · ${AI_ST[f.status]||f.status}</small></div>
<div style="margin:6px 0">${esc(f.reason)}</div>${aiEv(f.evidence)}${f.proposal?`<div style="margin-top:8px;padding:8px;border:1px dashed #c98a1b;border-radius:8px"><b>الإجراء المقترح:</b> ${esc(f.proposal_title||f.proposal.tool)} <small>${esc(f.proposal.args.user_id?'المستخدم #'+f.proposal.args.user_id:f.proposal.args.rating_id?'التقييم #'+f.proposal.args.rating_id:'')}</small></div>`:''}
<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">${aiSubj(f)}${acts}${f.decision_note?`<small>ملاحظة: ${esc(f.decision_note)}</small>`:''}</div></div>`};
const aiBtns=f=>f.status==='pending'?`<button class=btn data-ap="${f.id}" type=button>اعتماد الإجراء</button><button class="btn alt" data-rj="${f.id}" type=button>رفض</button><button class="btn alt" data-ds="${f.id}" type=button>تجاهل</button>`
  :f.status==='open'?`<button class="btn alt" data-rs="${f.id}" type=button>تمت المعالجة</button><button class="btn alt" data-ds="${f.id}" type=button>تجاهل</button>`
  :f.undoable?`<button class="btn alt" data-un="${f.id}" type=button>تراجع عن الإجراء</button>`:'';
const aiBind=(root,reload)=>{
  const go=async(url,b,msg)=>{try{await api(url,'POST',b);toast(msg);reload()}catch(x){toast(x.message,1)}};
  root.querySelectorAll('[data-ap]').forEach(b=>b.onclick=()=>{if(confirm('تأكيد تنفيذ الإجراء المقترح؟ سيُسجَّل باسمك ويمكنك التراجع عنه لاحقًا.'))go('/admin/ai/findings/'+b.dataset.ap+'/decide',{decision:'approve'},'نُفّذ الإجراء وسُجّل')});
  root.querySelectorAll('[data-rj]').forEach(b=>b.onclick=()=>go('/admin/ai/findings/'+b.dataset.rj+'/decide',{decision:'reject'},'رُفض الاقتراح'));
  root.querySelectorAll('[data-ds]').forEach(b=>b.onclick=()=>go('/admin/ai/findings/'+b.dataset.ds+'/decide',{decision:'dismiss'},'تم التجاهل'));
  root.querySelectorAll('[data-rs]').forEach(b=>b.onclick=()=>go('/admin/ai/findings/'+b.dataset.rs+'/decide',{decision:'resolve'},'سُجّلت المعالجة'));
  root.querySelectorAll('[data-un]').forEach(b=>b.onclick=()=>{if(confirm('التراجع عن الإجراء المعتمد؟'))go('/admin/ai/findings/'+b.dataset.un+'/undo',{},'تم التراجع')});
};
const drawAi=async()=>{
  const ov=await api('/admin/ai/overview');
  const SUBS=[['home','نظرة عامة'],['appr','الموافقات'+(ov.pending_approvals?` (${ov.pending_approvals})`:'')],['find','الحالات'],['mgr','المدراء والإعدادات'],['jobs','المهام'],['rep','التقارير'],['audit','سجل العمليات'],['chat','المحادثة']];
  body().innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><small>قواعد وتحليل داخل خادمك بلا تكلفة خارجية</small>${ov.enabled?'<button class="btn" id=aiKill type=button style="background:#8a1c1c;border-color:#8a1c1c">⛔ إيقاف طارئ</button>':'<button class=btn id=aiResume type=button>▶ استئناف التشغيل</button>'}</div>
  ${ov.enabled?'':'<div class=mg-row style="background:#fdecec;color:#8a1c1c"><b>الذكاء متوقف بالكامل.</b> لا يُنفَّذ أي إجراء آلي. وظائف المنصة الأساسية تعمل طبيعيًا.'+(ov.env_disabled?' (الإيقاف مفروض من إعدادات الخادم)':'')+'</div>'}
  <div class=ord-chips style="margin:12px 0">${SUBS.map(([k,l])=>`<button class="chip-btn ${aiSub===k?'on':''}" data-ais="${k}" type=button>${l}</button>`).join('')}</div><div id=aiBody>${skel(4)}</div>`;
  const kill=$('#aiKill'),res=$('#aiResume');
  if(kill)kill.onclick=async()=>{const r=await askBox({title:'إيقاف طارئ للذكاء',text:'يتوقف تنفيذ أي إجراء آلي فورًا. المنصة تعمل كالمعتاد.',field:true,label:'السبب',danger:true,ok:'إيقاف'});if(!r)return;try{await api('/admin/ai/kill','POST',{on:true,reason:r});toast('أُوقف الذكاء');drawAi()}catch(x){toast(x.message,1)}};
  if(res)res.onclick=async()=>{try{await api('/admin/ai/kill','POST',{on:false});toast('استؤنف التشغيل');drawAi()}catch(x){toast(x.message,1)}};
  body().querySelectorAll('[data-ais]').forEach(b=>b.onclick=()=>{aiSub=b.dataset.ais;drawAi()});
  const box=$('#aiBody'),reload=()=>drawAi();
  if(aiSub==='home'){
    box.innerHTML=`<div class=mg-stats><div class=mg-stat><small>بانتظار قرارك</small><b>${ov.pending_approvals}</b></div><div class=mg-stat><small>حالات مفتوحة</small><b>${ov.open_findings}</b></div><div class=mg-stat><small>عالية الخطورة</small><b>${ov.high_open}</b></div><div class=mg-stat><small>تنفيذ تلقائي اليوم</small><b>${ov.auto_today}/${ov.auto_daily_cap}</b></div><div class=mg-stat><small>تكلفة الذكاء</small><b>0 ر.س</b></div></div>
    <small>الذكاء هنا قواعد وتحليل يعمل داخل خادمك بلا مزود خارجي، فلا رموز ولا اشتراكات. كل المدراء في وضع «مراقبة فقط» افتراضيًا إلى أن ترفع أنت الصلاحية.</small>
    <h3 class=mg-h>المدراء</h3>`+recTable(['المدير','الوضع','آخر تشغيل','الدورات','مفتوحة',''],ov.managers.map(m=>`<tr><td><b>${esc(m.name)}</b><br><small>${esc(m.desc)}</small></td><td><span class="${m.mode==='off'?'pill-warn':'pill'}">${esc(m.mode_ar)}</span>${m.paused_until?'<span class=pill-warn>متوقف مؤقتًا</span>':''}</td><td><small>${aiT(m.last_run)}</small></td><td><small>${m.runs_ok} ناجحة${m.runs_fail?' · '+m.runs_fail+' فاشلة':''}</small></td><td>${m.open}</td><td><button class="btn alt sm" data-run="${m.key}" type=button>تشغيل الآن</button></td></tr>`));
    box.querySelectorAll('[data-run]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const r=await api('/admin/ai/run','POST',{manager:b.dataset.run});toast('تم: '+r.reduce((s,x)=>s+(x.new_findings||0),0)+' حالة جديدة');drawAi()}catch(x){toast(x.message,1);b.disabled=false}});
  }else if(aiSub==='appr'){
    const l=await api('/admin/ai/findings?status=pending');
    box.innerHTML=l.length?`<small>هذه إجراءات اقترحها الذكاء ولا تُنفَّذ إلا بموافقتك. كل اعتماد يُسجَّل باسمك في سجل العمليات.</small>`+l.map(f=>aiCard(f,aiBtns(f))).join(''):'<div class=empty>لا توجد قرارات بانتظارك.</div>';aiBind(box,reload);
  }else if(aiSub==='find'){
    const q=window.__aiq||{status:'active',manager:'',severity:''};
    const mk=(k,opts)=>`<select data-q="${k}">${opts.map(([v,l])=>`<option value="${v}"${q[k]===v?' selected':''}>${l}</option>`).join('')}</select>`;
    box.innerHTML=`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">${mk('status',[['active','المفتوحة'],['pending','بانتظار القرار'],['closed','المغلقة']])}${mk('manager',[['','كل المدراء'],...Object.entries(AI_MGR).filter(([k])=>k!=='orchestrator')])}${mk('severity',[['','كل المستويات'],['high','عالية'],['medium','متوسطة'],['low','منخفضة'],['info','معلومات']])}</div><div id=aiF>${skel(3)}</div>`;
    box.querySelectorAll('[data-q]').forEach(s=>s.onchange=()=>{window.__aiq={...q,[s.dataset.q]:s.value};drawAi()});
    const l=await api(`/admin/ai/findings?status=${q.status}&manager=${q.manager}&severity=${q.severity}`);
    $('#aiF').innerHTML=l.length?l.map(f=>aiCard(f,aiBtns(f))).join(''):'<div class=empty>لا توجد حالات.</div>';aiBind($('#aiF'),reload);
  }else if(aiSub==='mgr'){
    box.innerHTML=`<small>«مراقبة فقط»: يحلل ويقترح دون تنفيذ. «بعد الموافقة»: ينتظر اعتمادك. «تنفيذ تلقائي»: للإجراءات الروتينية المسموحة فقط (إرسال إشعارات). الإجراءات الحساسة (تقييد حساب، إيقاف، إخفاء تقييم) لا تُنفَّذ إلا بموافقتك مهما كان الوضع. لا يوجد أي إجراء مالي إطلاقًا.</small>`
    +ov.managers.map(m=>`<div class=mg-row style="display:block"><b>${esc(m.name)}</b><br><small>${esc(m.desc)}</small><div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center"><select data-m="${m.key}">${AI_MODES.filter(([v])=>m.max_mode==='auto'||['off','observe'].includes(v)).map(([v,l])=>`<option value="${v}"${m.mode===v?' selected':''}>${l}</option>`).join('')}</select><button class="btn sm" data-sm="${m.key}" type=button>حفظ</button><small>دورات ناجحة: ${m.runs_ok}${m.max_mode==='auto'&&m.runs_ok<3?' (يلزم 3 للتنفيذ التلقائي)':''}</small></div></div>`).join('')
    +`<h3 class=mg-h>سقف التنفيذ التلقائي اليومي</h3><div style="display:flex;gap:8px;align-items:center"><input id=aiCap type=number min=0 max=1000 value="${ov.auto_daily_cap}" style="width:100px"><button class="btn sm" id=aiCapGo type=button>حفظ</button><small>عند بلوغه يتوقف التنفيذ التلقائي بقية اليوم.</small></div>`;
    box.querySelectorAll('[data-sm]').forEach(b=>b.onclick=async()=>{const mode=box.querySelector(`[data-m="${b.dataset.sm}"]`).value;let confirmed=false;if(mode==='auto'){if(!confirm('تفعيل التنفيذ التلقائي لهذا المدير؟ سيرسل إشعارات للمستخدمين دون موافقة مسبقة ضمن السقف اليومي.'))return;confirmed=true}try{await api('/admin/ai/mode','POST',{manager:b.dataset.sm,mode,confirm:confirmed});toast('حُفظ');drawAi()}catch(x){toast(x.message,1)}});
    $('#aiCapGo').onclick=async()=>{try{await api('/admin/ai/cap','POST',{cap:+$('#aiCap').value});toast('حُفظ');drawAi()}catch(x){toast(x.message,1)}};
  }else if(aiSub==='jobs'){
    const j=await api('/admin/ai/jobs');
    box.innerHTML=`<small>المهام الآلية: فعّل أو عطّل كل مهمة، وغيّر توقيتها وعتباتها. الحدود الدنيا والقصوى مفروضة من الخادم.</small>`+recTable(['المهمة','المدير','كل (دقيقة)','العتبات','مفعّلة','آخر تشغيل',''],j.map(x=>`<tr><td>${esc(x.title)}<br><small dir=ltr>${esc(x.job)}</small></td><td>${esc(AI_MGR[x.manager]||x.manager)}</td><td><input type=number min=5 max=43200 value="${x.interval_min}" data-iv="${esc(x.job)}" style="width:80px"></td><td>${Object.entries(x.params).map(([k,v])=>`<label style="display:block"><small dir=ltr>${esc(k)}</small> <input type=number min=0 value="${v}" data-pk="${esc(x.job)}|${esc(k)}" style="width:64px"></label>`).join('')||'—'}</td><td><input type=checkbox ${x.enabled?'checked':''} data-en="${esc(x.job)}"></td><td><small>${aiT(x.last_run)}</small></td><td><button class="btn sm" data-sj="${esc(x.job)}" type=button>حفظ</button> <button class="btn alt sm" data-rj="${esc(x.job)}" type=button>تشغيل</button></td></tr>`));
    box.querySelectorAll('[data-sj]').forEach(b=>b.onclick=async()=>{const job=b.dataset.sj,params={};box.querySelectorAll(`[data-pk^="${job}|"]`).forEach(i=>params[i.dataset.pk.split('|')[1]]=+i.value);try{await api('/admin/ai/jobs/update','POST',{job,interval_min:+box.querySelector(`[data-iv="${job}"]`).value,enabled:box.querySelector(`[data-en="${job}"]`).checked,params});toast('حُفظ')}catch(x){toast(x.message,1)}});
    box.querySelectorAll('button[data-rj]').forEach(b=>b.onclick=async()=>{try{const r=await api('/admin/ai/run','POST',{job:b.dataset.rj});toast(r[0].error?'فشل: '+r[0].error:r[0].skipped?'تخطّي: '+r[0].skipped:'تم')}catch(x){toast(x.message,1)}});
  }else if(aiSub==='rep'){
    const r=await api('/admin/ai/reports');
    box.innerHTML=`<div style="display:flex;gap:8px;margin-bottom:10px"><button class=btn id=rD type=button>إنشاء تقرير يومي الآن</button><button class="btn alt" id=rW type=button>تقرير أسبوعي</button></div>`+(r.length?r.map(x=>`<div class=mg-row style="display:block"><b>${x.kind==='weekly'?'أسبوعي':'يومي'}</b> <small>${aiT(x.created_at)}</small><pre style="white-space:pre-wrap;font:inherit;margin:6px 0 0">${esc(x.summary)}</pre></div>`).join(''):'<div class=empty>لا توجد تقارير بعد. تُنشأ تلقائيًا يوميًا وأسبوعيًا.</div>');
    $('#rD').onclick=async()=>{await api('/admin/ai/reports','POST',{kind:'daily'});drawAi()};$('#rW').onclick=async()=>{await api('/admin/ai/reports','POST',{kind:'weekly'});drawAi()};
  }else if(aiSub==='audit'){
    const [l,v]=await Promise.all([api('/admin/ai/audit?limit=100'),api('/admin/ai/audit/verify')]);
    box.innerHTML=`<div class=mg-row><div>سجل لا يقبل التعديل أو الحذف. سلامة السلسلة: <b>${v.ok?'سليمة ✓ ('+v.checked+' سجل)':'⚠ مكسورة عند السجل #'+v.broken_at}</b></div></div>`+recTable(['الوقت','المدير','الإجراء','الطريقة','الهدف','النتيجة','المعتمد'],l.map(x=>`<tr><td><small>${aiT(x.at)}</small></td><td>${esc(AI_MGR[x.manager]||x.manager)}</td><td><small dir=ltr>${esc(x.action)}</small><br><small>${esc(x.reason||'')}</small></td><td>${esc(AI_MODE_LOG[x.mode]||x.mode)}</td><td><small>${esc(x.target||'')}</small></td><td><small>${esc(x.result||'')}</small></td><td>${x.approved_by?'#'+x.approved_by:'—'}</td></tr>`),'لا توجد سجلات بعد.');
  }else if(aiSub==='chat'){
    box.innerHTML=`<small>اكتب أمرًا بالعربية: «ملخص اليوم»، «الموافقات المعلقة»، «الطلبات المتعثرة»، «النزاعات»، «الحالات العالية الخطورة»، «شغّل مدير الرقابة»، «إيقاف طارئ». لا يغيّر الصلاحيات.</small><div id=aiLog style="min-height:160px;max-height:50vh;overflow:auto;margin:10px 0">${(window.__aiLog||[]).map(m=>`<div class=mg-row style="display:block"><small>${m.me?'أنت':'الذكاء'}</small><div style="white-space:pre-wrap">${esc(m.t)}</div></div>`).join('')}</div><form id=aiForm style="display:flex;gap:8px"><input id=aiIn maxlength=300 required style="flex:1" placeholder="اكتب أمرك هنا" aria-label="الأمر"><button class=btn>إرسال</button></form>`;
    $('#aiForm').onsubmit=async e=>{e.preventDefault();const t=$('#aiIn').value.trim();if(!t)return;window.__aiLog=[...(window.__aiLog||[]),{me:1,t}];try{const r=await api('/admin/ai/chat','POST',{text:t});window.__aiLog.push({t:r.reply})}catch(x){window.__aiLog.push({t:'تعذّر: '+x.message})}drawAi()};
  }
};

const USER_FILTERS=[['all','الكل'],['helpers','المساعدون'],['clients','طالبو المساعدة'],['suspended','الموقوفون'],['flagged','للمراجعة']];
let usrFilter='all';
const drawUserProfile=async id=>{
  const d=await api('/admin/users/'+id+'/profile');const u=d.user;const isAdmin=me.user&&me.user.role==='admin';
  const kind=u.role==='admin'?'مدير':u.account_type==='helper'?'مساعد':'عميل';
  const vat=u.account_type==='helper'?(u.vat_status==='registered'?`مسجل · ${u.vat_verified===1?'موثّق':u.vat_verified===2?'مرفوض':'بانتظار التوثيق'}`:'غير مسجل'):'—';
  body().innerHTML=`<a href="#/manage/users" class=lnk>← العودة إلى المستخدمين</a>
  <div class=dash-head style="margin-top:8px"><div><h2 style="margin:0 0 4px;font-size:20px;color:#241560">${esc(u.name)}</h2><small dir=ltr>${esc(u.email)}</small></div><div>${isAdmin&&u.account_type==='helper'?'<button class="btn alt" id=pSettle type=button>تسجيل سداد العمولات</button> ':''}${isAdmin&&u.id!==me.user.id?`<button class="btn ${u.active?'alt':''}" id=pAct type=button>${u.active?'إيقاف الحساب':'تفعيل الحساب'}</button>`:''}</div></div>
  <div class=kpis><div class=kpi><small>النوع</small><b style="font-size:18px">${kind}</b></div><div class=kpi><small>الحالة</small><b style="font-size:18px">${u.active?'مفعل':'موقوف'}</b>${u.flagged?'<span>للمراجعة</span>':''}</div><div class=kpi><small>التقييم</small><b style="font-size:18px">${d.rating.count?d.rating.avg+' ★':'—'}</b><span>${d.rating.count} تقييم</span></div><div class=kpi><small>الطلبات</small><b>${d.stats.orders}</b><span>مكتملة ${d.stats.completed} · ملغاة ${d.stats.cancelled}</span></div></div>
  <h3 class=mg-h>البيانات</h3>
  <div class=mg-row><div><small>المدينة</small><br><b>${esc(u.city||'—')}</b></div><div><small>الجوال</small><br><b dir=ltr>${esc(u.phone||'—')}</b></div></div>
  <div class=mg-row><div><small>الرقم الضريبي للمساعد</small><br><b>${esc(vat)}</b></div><div><small>تاريخ التسجيل</small><br><b>${esc(String(u.created_at||'').slice(0,10))}</b></div></div>
  <h3 class=mg-h>الأقسام</h3><div>${d.sections.map(s=>`<span class=mg-chip>${esc(s)}</span>`).join('')||'<small>لا توجد أقسام.</small>'}</div>
  <h3 class=mg-h>الطلبات</h3>${d.orders.length?`<div class=tbl-wrap><table class=tbl><thead><tr><th>#</th><th>الوصف</th><th>الطرفان</th><th>المبلغ</th><th>الحالة</th></tr></thead><tbody>${d.orders.map(o=>`<tr><td>${o.id}</td><td>${esc(o.description)}</td><td><small>${esc(o.a_name)} ← ${esc(o.b_name)}</small></td><td>${o.amount} ر.س</td><td><span class=pill>${ORD_ST[o.status]||o.status}</span></td></tr>`).join('')}</tbody></table></div>`:'<div class=empty>لا توجد طلبات.</div>'}
  <h3 class=mg-h>التقييمات المستلمة</h3>${d.reviews.length?d.reviews.map(r=>`<div class=mg-row style="display:block"><b>${'★'.repeat(r.stars)}${'☆'.repeat(5-r.stars)}</b> · <small>${esc(r.rater)}</small>${r.hidden?' <span class=pill-warn>مخفي</span>':''}<div>${esc(r.comment||'')}</div></div>`).join(''):'<div class=empty>لا توجد تقييمات.</div>'}`;
  const ps=$('#pSettle');if(ps)ps.onclick=async()=>{if(!confirm('تأكيد أنك استلمت تحويل المساعد للعمولات المستحقة؟ ستُصفَّر مستحقاته.'))return;try{const r=await api('/admin/helpers/'+u.id+'/settle-dues','POST');toast('تم تسجيل سداد '+r.settled+' عمولة');drawUserProfile(id)}catch(x){toast(x.message,1)}};const pa=$('#pAct');if(pa)pa.onclick=async()=>{const act=u.active?0:1;let reason='إعادة التفعيل';if(!act){reason=await askBox({title:'إيقاف الحساب',text:'سيتوقف الحساب عن العمل حتى يُعاد تفعيله.',field:true,label:'سبب الإيقاف (يُسجَّل)',danger:true,ok:'إيقاف الحساب'});if(!reason)return}try{await api('/admin/users/'+u.id+'/active','POST',{active:act,reason});toast('تم');drawUserProfile(id)}catch(x){toast(x.message,1)}};
};
const drawUsersPage=async()=>{
  body().innerHTML=`<h3 class=mg-h>المستخدمون</h3><div class=ord-bar><div class=ord-chips>${USER_FILTERS.map(([k,l])=>`<button class="chip-btn ${usrFilter===k?'on':''}" data-uf="${k}" type=button>${l}</button>`).join('')}</div><div class=ord-tools><input id=mgq type=search placeholder="ابحث بالاسم أو البريد" aria-label="بحث المستخدمين"><button class="btn alt sm" id=usrExp type=button>تصدير CSV</button></div></div><div id=mgl></div>`;

  const load=async()=>{const q=$('#mgq').value.trim();$('#mgl').innerHTML=skel(5);let l=await api('/admin/users?q='+encodeURIComponent(q));
    if(usrFilter==='helpers')l=l.filter(u=>u.account_type==='helper');else if(usrFilter==='clients')l=l.filter(u=>u.account_type!=='helper'&&u.role!=='admin');else if(usrFilter==='suspended')l=l.filter(u=>!u.active);else if(usrFilter==='flagged')l=l.filter(u=>u.flagged);
    $('#mgl').innerHTML=l.length?`<div class=tbl-wrap><table class=tbl><thead><tr><th>الاسم</th><th>البريد</th><th>النوع</th><th>الحالة</th><th></th></tr></thead><tbody>${l.map(u=>`<tr><td><a href="#/manage/user/${u.id}"><b>${esc(u.name)}</b></a>${u.flagged?' <span class=pill-warn>للمراجعة</span>':''}</td><td><small dir=ltr>${esc(u.email)}</small></td><td>${u.role==='admin'?'مدير':u.account_type==='helper'?'مساعد':'عميل'}</td><td>${u.active?'<span class=pill>مفعل</span>':'<span class=pill-warn>موقوف</span>'}</td><td>${isAdmin&&u.id!==me.user.id?`<button class="btn ${u.active?'alt':''} sm" data-id="${u.id}" data-act="${u.active?0:1}" type=button>${u.active?'إيقاف':'تفعيل'}</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:'<div class=empty>لا توجد نتائج تطابق هذا التصنيف.</div>';
    $('#mgl').querySelectorAll('[data-id]').forEach(bt=>bt.onclick=async()=>{const act=+bt.dataset.act;let reason='إعادة التفعيل';if(!act){reason=await askBox({title:'إيقاف الحساب',text:'سيتوقف الحساب عن العمل حتى يُعاد تفعيله.',field:true,label:'سبب الإيقاف (يُسجَّل)',danger:true,ok:'إيقاف الحساب'});if(!reason)return}try{await api('/admin/users/'+bt.dataset.id+'/active','POST',{active:act,reason});toast('تم');load()}catch(x){toast(x.message,1)}})};
  body().querySelectorAll('[data-uf]').forEach(b=>b.onclick=()=>{usrFilter=b.dataset.uf;drawUsersPage()});
  $('#usrExp').onclick=()=>window.open('/api/admin/export?type=users','_blank');
  let tm;$('#mgq').oninput=()=>{clearTimeout(tm);tm=setTimeout(load,300)};await load();
};
const drawCats=async()=>{const l=await api('/admin/categories');body().innerHTML=l.map(c=>`<div class=mg-row style="display:block"><b>${esc(c.name)}</b><div style="margin-top:6px">${c.words.map(w=>`<span class=mg-chip>${esc(w)}<button data-cat="${c.id}" data-w="${esc(w)}" aria-label="حذف">×</button></span>`).join('')}</div><form data-add="${c.id}" style="display:flex;gap:6px;margin-top:8px"><input name=word placeholder="كلمة جديدة" maxlength=60 style="flex:1;padding:8px;border:1px solid #d9d5e8;border-radius:10px"><button class="btn alt sm">إضافة</button></form></div>`).join('');
body().querySelectorAll('[data-cat]').forEach(bt=>bt.onclick=async()=>{try{await api('/admin/sections/'+bt.dataset.cat+'/keywords/remove','POST',{word:bt.dataset.w});toast('تم الحذف');drawCats()}catch(x){toast(x.message,1)}});
body().querySelectorAll('[data-add]').forEach(f=>f.onsubmit=async e=>{e.preventDefault();const w=f.elements.word.value.trim();if(!w)return;try{await api('/admin/sections/'+f.dataset.add+'/keywords','POST',{keywords:w});toast('تمت الإضافة');drawCats()}catch(x){toast(x.message,1)}})};
const drawFinance=async()=>{const ac=await api('/admin/agreement-commissions');
const sec=(t,html)=>`<h3 class=mg-h>${t}</h3>${html||'<small>لا يوجد.</small>'}`;
body().innerHTML=''
+sec('عمولات الاتفاقات المستحقة',recTable(['المبلغ','المساعد','الوصف'],ac.filter(x=>x.status==='due').map(x=>`<tr><td><b>${x.amount} ريال</b></td><td>${esc(x.helper)}</td><td><small>${esc(x.description)}</small></td></tr>`),'لا توجد عمولات مستحقة.'))
body().insertAdjacentHTML('beforeend',sec('عمولات تحتاج استردادًا يدويًا عبر هلا',recTable(['المبلغ','المساعد','الوصف','الإجراء'],ac.filter(x=>x.status==='refund_due').map(x=>`<tr><td><b>${x.amount} ريال</b></td><td>${esc(x.helper)}</td><td><small>${esc(x.description)}</small></td><td><button class="btn sm" data-rf="${x.id}">تم الاسترداد</button></td></tr>`),'لا توجد عمليات استرداد معلّقة.')));
body().querySelectorAll('[data-rf]').forEach(bt=>bt.onclick=async()=>{try{await api('/admin/agreement-commissions/'+bt.dataset.rf+'/refunded','POST');toast('تم تسجيل الاسترداد');drawFinance()}catch(x){toast(x.message,1)}});
};
const drawReports=async()=>{const l=await api('/admin/reports');body().innerHTML=recTable(['النوع','المبلِّغ','التفاصيل','الحالة','الإجراء'],l.map(r=>`<tr><td><b>${esc(r.type)}</b></td><td>${esc(r.reporter)}</td><td><small>${esc(r.info||'')}</small>${r.reason?`<br><small>${esc(r.reason)}</small>`:''}</td><td>${r.status==='open'?'<span class=pill-warn>مفتوح</span>':`<span class=pill>${esc(r.status)}</span>`}</td><td>${r.status==='open'?`<div class=row style="gap:6px;flex-wrap:wrap"><button class="btn sm" data-rs="${r.id}" data-h="0">حل البلاغ</button>${(r.type==='request'||r.type==='rating')?`<button class="btn alt sm" data-rs="${r.id}" data-h="1">حل وإخفاء المحتوى</button>`:''}</div>`:''}</td></tr>`),'لا توجد بلاغات.');
body().querySelectorAll('[data-rs]').forEach(bt=>bt.onclick=async()=>{const note=await askBox({title:'قرار الإدارة',text:'تُسجَّل الملاحظة مع القرار.',field:true,label:'ملاحظة القرار',ok:'تسجيل القرار'});if(!note)return;try{await api('/admin/reports/'+bt.dataset.rs+'/resolve','POST',{note,hide:bt.dataset.h==='1'});toast('تم');drawReports()}catch(x){toast(x.message,1)}})};

const drawChatPage=async id=>{
  const [r,d]=await Promise.all([api('/admin/reports/'+id),api('/admin/reports/'+id+'/conversation')]);
  const p=r.parties;const open=r.status==='open';
  body().innerHTML=`<a href="#/manage/chat" class=lnk>← العودة إلى المحادثات المبلغ عنها</a>
  <div class=kpis style="margin-top:10px"><div class=kpi><small>المبلِّغ</small><b style="font-size:17px">${esc(r.reporter)}</b></div><div class=kpi><small>الطرفان</small><b style="font-size:15px">${p?esc(p.from_name)+' ↔ '+esc(p.to_name):'—'}</b></div><div class=kpi><small>السبب</small><b style="font-size:15px">${esc(r.reason||'—')}</b></div><div class=kpi><small>الحالة</small><b style="font-size:17px">${open?'<span class=pill-warn>مفتوح</span>':esc(r.status)}</b></div></div>
  ${r.note?`<div class=mg-row style="display:block"><small>قرار سابق</small><div>${esc(r.note)}</div></div>`:''}
  <h3 class=mg-h>نص المحادثة (${d.messages.length} رسالة)</h3>
  <div class=chat-thread>${d.messages.map(m=>`<div class=\"bubble ${p&&m.from_id===p.from_id?'a':'b'}\"><small><b>${esc(m.sender)}</b> · ${esc(String(m.created_at).slice(0,16).replace('T',' '))}</small><div style=\"white-space:pre-wrap\">${esc(m.body)}</div></div>`).join('')||'<div class=empty>لا توجد رسائل.</div>'}</div>
  ${open?`<div class=row style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class=btn id=chR type=button>تسجيل القرار وإغلاق البلاغ</button></div>`:''}`;
  const b=$('#chR');if(b)b.onclick=async()=>{const note=await askBox({title:'قرار البلاغ',text:'يُسجَّل القرار ويُغلق البلاغ.',field:true,label:'ملاحظة القرار',ok:'تسجيل القرار'});if(!note)return;try{await api('/admin/reports/'+id+'/resolve','POST',{note,hide:false});toast('تم تسجيل القرار');drawChatPage(id)}catch(x){toast(x.message,1)}};
};
const drawChats=async()=>{const l=(await api('/admin/reports')).filter(r=>r.type==='message');
  const rows=l.map(r=>`<tr><td><b>${esc(r.reporter)}</b></td><td><small>${esc(r.info||'')}</small></td><td><small>${esc(r.reason||'')}</small></td><td>${r.status==='open'?'<span class=pill-warn>مفتوح</span>':`<span class=pill>${esc(r.status)}</span>`}</td><td><a class="btn alt sm" href="#/manage/chat/${r.id}">فتح البلاغ</a></td></tr>`);
  body().innerHTML=`<small>تعرض المحادثات المبلَّغ عنها فقط. كل فتح للمحادثة يُسجَّل في سجل العمليات.</small>`+recTable(['المبلِّغ','التفاصيل','السبب','الحالة','الإجراء'],rows,'لا توجد بلاغات عن محادثات.');
  
};

const drawRatings=async()=>{const l=await api('/admin/ratings');body().innerHTML=recTable(['التقييم','من','إلى','التعليق','الحالة',''],l.map(r=>`<tr><td><b>${'★'.repeat(r.stars)}${'☆'.repeat(5-r.stars)}</b></td><td>${esc(r.rater)}</td><td>${esc(r.rated||'—')}</td><td><small>${esc(r.comment||'بدون تعليق')}</small></td><td>${r.hidden?'<span class=pill-warn>مخفي</span>':'<span class=pill>ظاهر</span>'}</td><td><button class="btn ${r.hidden?'':'alt'} sm" data-rh="${r.id}" data-v="${r.hidden?0:1}">${r.hidden?'إظهار':'إخفاء'}</button></td></tr>`),'لا توجد تقييمات.');
body().querySelectorAll('[data-rh]').forEach(bt=>bt.onclick=async()=>{try{await api('/admin/ratings/'+bt.dataset.rh+'/hidden','POST',{hidden:bt.dataset.v==='1'});toast('تم');drawRatings()}catch(x){toast(x.message,1)}})};
const drawPoints=async()=>{const rules=isAdmin?(await api('/admin/stats')).rules:[];const users=await api('/admin/points');
body().innerHTML=(rules.length?`<h3 class=mg-h>قيم المكافآت</h3>`:'')+rules.map(r=>`<div class=mg-row><div><b>${esc(r.key)}</b></div><div style="display:flex;gap:6px;align-items:center"><input type=number min=0 value="${r.points}" data-rule="${esc(r.key)}" style="width:90px;padding:6px;border:1px solid #d9d5e8;border-radius:10px"><button class="btn alt sm" data-save="${esc(r.key)}">حفظ</button></div></div>`).join('')+`<h3 class=mg-h>أرصدة المستخدمين</h3><input id=ptq placeholder="ابحث بالاسم أو البريد" style="width:100%;padding:10px;border:1px solid #d9d5e8;border-radius:12px;font:inherit;margin-bottom:8px"><div id=ptl></div>`;
const listUsers=l=>{$('#ptl').innerHTML=recTable(['المستخدم','الرصيد','الإجراء'],l.map(u=>`<tr><td><b>${esc(u.name)}</b><br><small dir=ltr>${esc(u.email)}</small></td><td><b>${u.balance} نقطة</b></td><td><button class="btn alt sm" data-adj="${u.id}">تعديل</button></td></tr>`),'لا توجد نتائج.');
$('#ptl').querySelectorAll('[data-adj]').forEach(bt=>bt.onclick=async()=>{const raw=await askBox({title:'تعديل النقاط',text:'اكتب عددًا موجبًا للإضافة أو سالبًا للخصم.',field:true,label:'عدد النقاط',min:1,ok:'متابعة'});if(raw===null)return;const d=Number(raw);if(!Number.isInteger(d)||d===0){toast('أدخل عددًا صحيحًا غير صفري',1);return}const reason=await askBox({title:'سبب التعديل',text:'يُسجَّل السبب مع العملية.',field:true,label:'السبب',ok:'تعديل النقاط'});if(!reason)return;try{await api('/admin/users/'+bt.dataset.adj+'/points','POST',{delta:d,reason});toast('تم');drawPoints()}catch(x){toast(x.message,1)}})};
body().querySelectorAll('[data-save]').forEach(bt=>bt.onclick=async()=>{const v=body().querySelector('[data-rule="'+bt.dataset.save+'"]').value;try{await api('/admin/rules','POST',{key:bt.dataset.save,points:Number(v)});toast('تم الحفظ')}catch(x){toast(x.message,1)}});
let tm;$('#ptq').oninput=()=>{clearTimeout(tm);tm=setTimeout(async()=>listUsers(await api('/admin/points?q='+encodeURIComponent($('#ptq').value.trim()))),300)};listUsers(users)};
const drawGrowth=async()=>{const [g,s]=await Promise.all([api('/admin/growth'),api('/admin/stats')]);
const row=(l,v)=>`<tr><td><b>${esc(l)}</b></td><td>${v}</td></tr>`;const tableOf=h=>`<div class=tbl-wrap><table class=tbl><tbody>${h}</tbody></table></div>`;
body().innerHTML=`<div class=mg-stats><div class=mg-stat><small>المستخدمون</small><b>${s.users}</b></div></div>
<h3 class=mg-h>آخر 30 يومًا</h3>${tableOf(row('مستخدمون جدد',g.users.reduce((a,x)=>a+x.n,0)))}
`};
const drawStaff=async()=>{const l=await api('/admin/staff');const P={finance:'المالية',support:'الدعم',accounting:'المحاسبة'};
body().innerHTML=`<h3 class=mg-h>الموظفون وصلاحياتهم</h3>`+recTable(['الاسم','البريد','الصلاحيات',''],l.map(s=>`<tr><td><b>${esc(s.name)}</b></td><td><small dir=ltr>${esc(s.email)}</small></td><td>${(s.perms||'').split(',').filter(Boolean).map(p=>`<span class=mg-chip>${P[p]||p}</span>`).join('')}</td><td><button class="btn alt sm" data-rm="${esc(s.email)}">إزالة</button></td></tr>`),'لا يوجد موظفون.')+`<h3 class=mg-h>إضافة أو تعديل صلاحيات</h3><form id=stf style="display:flex;flex-direction:column;gap:8px"><input name=email type=email dir=ltr required placeholder="بريد الحساب المسجَّل" style="padding:10px;border:1px solid #d9d5e8;border-radius:10px;font:inherit"><label><input type=checkbox name=p value=finance> المالية (العمولات والمدفوعات والنقاط)</label><label><input type=checkbox name=p value=support> الدعم (الشكاوى والمحادثات والتقييمات والرسائل)</label><label><input type=checkbox name=p value=accounting> المحاسبة (القيود والفواتير والتصدير للمراجعة)</label><button class=btn>حفظ الصلاحيات</button></form><small>الصلاحيات الأخرى (الطلبات والأقسام والإحصاءات والإعدادات) للمدير وحده.</small>`;
const save=async(email,perms)=>{try{await api('/admin/staff','POST',{email,perms});toast('تم الحفظ');drawStaff()}catch(x){toast(x.message,1)}};
$('#stf').onsubmit=async e=>{e.preventDefault();const f=e.target;await save(f.email.value.trim(),[...f.querySelectorAll('input[name=p]:checked')].map(x=>x.value))};
body().querySelectorAll('[data-rm]').forEach(bt=>bt.onclick=async()=>{if(await askBox({title:'إزالة الصلاحيات',text:'سيفقد هذا الموظف كل صلاحياته.',danger:true,ok:'إزالة'}))save(bt.dataset.rm,[])})};
const drawSystem=async()=>{const v=await api('/admin/settings');const f=(n,l,type='text',extra='')=>`<label>${l}<input name=${n} type=${type} value="${esc(v[n]??'')}" ${extra}></label>`;
  body().innerHTML=`<h3 class=mg-h>النسخ الاحتياطي</h3><div class=mg-row style="display:block"><small>ينزّل نسخة كاملة من قاعدة البيانات. احفظها خارج الاستضافة.</small><div style="margin-top:8px"><button class="btn" id=sysBk type=button>تنزيل نسخة احتياطية</button></div></div>
  <h3 class=mg-h>حساب المنصة والعمولة</h3><form id=setF class=form>${f('bank_name','اسم البنك')}${f('account_name','اسم الحساب')}${f('iban','الآيبان (SA متبوعة بـ 22 رقمًا)','text','dir=ltr')}${f('commission_grace_days','أيام السماح للعمولة','number','min=0')}
  <h3 class=mg-h>بيانات المؤسسة والدعم</h3>${f('org_name','اسم المؤسسة')}${f('org_cr','رقم السجل التجاري')}${f('support_email','بريد الدعم','email','dir=ltr')}${f('support_phone','جوال الدعم','text','dir=ltr')}${f('support_address','عنوان الدعم')}
  <label>شرط التحكيم<textarea name=dispute_clause rows=2>${esc(v.dispute_clause||'')}</textarea></label><label>قواعد الإلغاء والمخالفات<textarea name=penalty_rules rows=3>${esc(v.penalty_rules||'')}</textarea></label>
  <button class=btn>حفظ الإعدادات</button></form>
  <h3 class=mg-h>الفوترة وتسجيل الضريبة</h3><form id=invF class=form><label style="display:flex;gap:8px;align-items:center"><input type=checkbox name=platform_vat_registered ${v.platform_vat_registered==='1'?'checked':''}> المنصة مسجلة في ضريبة القيمة المضافة</label>${f('platform_vat_number','الرقم الضريبي للمنصة (15 رقمًا يبدأ بـ 3)','text','dir=ltr')}<button class=btn>حفظ الفوترة</button></form>`;
  $('#sysBk').onclick=async()=>{try{const r=await fetch('/api/admin/backup',{credentials:'same-origin'});if(!r.ok)throw new Error('تعذّر التنزيل');const blob=await r.blob();const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download='almusaed-backup.db';a.click();URL.revokeObjectURL(u)}catch(x){toast(x.message,1)}};
  $('#setF').onsubmit=sub(async b=>{await api('/admin/settings','POST',b);toast('تم حفظ الإعدادات')});
  $('#invF').onsubmit=sub(async b=>{await api('/admin/invoicing','POST',{platform_vat_registered:!!b.platform_vat_registered,platform_vat_number:b.platform_vat_number||''});toast('تم حفظ الفوترة')});
};

const drawDisputes=async()=>{const l=await api('/admin/disputes');
const st=x=>(x.dispute_final?'مغلق':x.dispute_decision?'بانتظار المراجعة الثانية':'بانتظار القرار الأولي')+' · '+x.wd_elapsed+' من '+x.deadline_working_days+' يوم عمل'+(x.overdue?' · متأخر':'');
const late=l.filter(x=>x.overdue).length;
body().innerHTML=(late?`<div style="background:#fdecec;border:1px solid #f5b5b5;color:#8a1c1c;border-radius:12px;padding:10px;margin-bottom:8px">تنبيه: ${late} نزاع تجاوز المهلة المقترحة.</div>`:'')+`<small>لا يفصل أحد طرفي الاتفاق. القرار إداري داخل المنصة، ولا يحسم الحقوق المالية بين الطرفين. يُراجَع القرار من مسؤول آخر.</small>`+recTable(['المبلغ','الاتفاق','المرحلة','التعليل الأولي','الإجراء'],l.map(x=>`<tr><td><b>${x.amount} ريال</b></td><td><small>${esc(x.description||'')}</small></td><td><small>${st(x)}</small></td><td><small>${x.dispute_note?esc(x.dispute_note):'—'}</small></td><td><div class=row style="gap:6px;flex-wrap:wrap">${!x.dispute_decision?`<button class="btn sm" data-dd="${x.id}" data-v="completed">ثبت الإنجاز</button><button class="btn alt sm" data-dd="${x.id}" data-v="not_proven">لم يثبت</button>`:(!x.dispute_final?`<button class="btn sm" data-dr="${x.id}" data-v="completed">مراجعة: ثبت الإنجاز</button><button class="btn alt sm" data-dr="${x.id}" data-v="not_proven">مراجعة: لم يثبت</button>`:'')}</div></td></tr>`),'لا توجد نزاعات مفتوحة.');
const note=()=>askBox({title:'تعليل القرار',text:'يُسجَّل التعليل مع قرار النزاع.',field:true,label:'التعليل',ok:'تسجيل'});
body().querySelectorAll('[data-dd]').forEach(bt=>bt.onclick=async()=>{const n=await note();if(!n)return;try{await api('/admin/disputes/'+bt.dataset.dd+'/decide','POST',{decision:bt.dataset.v,note:n});toast('تم');drawDisputes()}catch(x){toast(x.message,1)}});
body().querySelectorAll('[data-dr]').forEach(bt=>bt.onclick=async()=>{try{await api('/admin/disputes/'+bt.dataset.dr+'/review','POST',{decision:bt.dataset.v});toast('تمت المراجعة');drawDisputes()}catch(x){toast(x.message,1)}})};
const drawSupply=async()=>{const r=await api('/admin/supply-report');const S={below:'دون الحد',near:'قريب من الحد',exceeded:'متجاوز الحد',expected_to_exceed:'متوقع تجاوزه',not_set:'لم يُحدَّد الحد بعد'};
const col=r.status==='exceeded'||r.status==='expected_to_exceed'?'#8a1c1c':r.status==='near'?'#8a5a00':'#5331b6';
body().innerHTML=`<form id=thrf class=form style="margin:8px 0"><label>حد التسجيل (ريال، يحدده المحاسب)<input name=value type=number min=0 step=1 value="${r.threshold||''}"></label><small>وفق الرأي الكتابي المعتمد: قيمة المهمة كاملة تُحسب ضمن توريدات المنصة للمساعد غير المسجل، ولا يمكن إيقاف ذلك.</small><button class=btn>حفظ</button></form>
<h3 class=mg-h>الأشهر الاثنا عشر</h3>${recTable(['الشهر','عمولة المنصة','التوريد الخاضع للحد','قيمة المهام (لا تستلمها المنصة)','إعفاء','إلغاء','نزاع'],r.rows.map(x=>`<tr><td><b>${x.month}</b></td><td>${x.platform_commission} ريال</td><td>${x.platform_supply} ريال</td><td>${x.task_value} ريال</td><td>${x.free_month_completions}</td><td>${x.cancelled}</td><td>${x.disputes}</td></tr>`),'لا توجد بيانات.')}<small>${esc(r.note)}</small>`;
$('#thrf').onsubmit=async e=>{e.preventDefault();try{await api('/admin/supply-threshold','POST',{value:Number(e.target.value.value)});toast('تم الحفظ');drawSupply()}catch(x){toast(x.message,1)}}};

const drawVerify=async()=>{const v=await api('/admin/verifications');const HT={individual:'فرد',establishment:'مؤسسة',company:'شركة'};
body().innerHTML=`<h3 class=mg-h>أرقام ضريبية بانتظار التحقق</h3><small>تحقق من الرقم في منصة زاتكا، ثم وافق أو ارفض.</small>`+recTable(['المساعد','النوع','البريد','الرقم الضريبي','الإجراء'],v.vat.map(x=>`<tr><td><b>${esc(x.name)}</b></td><td>${HT[x.helper_type]||'—'}</td><td><small dir=ltr>${esc(x.email)}</small></td><td><small dir=ltr>${esc(x.vat_number||'')}</small></td><td><div class=row style="gap:6px"><button class="btn sm" data-vf="${x.id}" data-v="approve">تم التحقق</button><button class="btn alt sm" data-vf="${x.id}" data-v="reject">رفض</button></div></td></tr>`),'لا توجد أرقام بانتظار التحقق.')+`<h3 class=mg-h>طلبات تغيير النوع</h3>`+recTable(['المساعد','من','إلى','الإجراء'],v.type_requests.map(x=>`<tr><td><b>${esc(x.name)}</b></td><td>${HT[x.helper_type]||'—'}</td><td>${HT[x.helper_type_request]||'—'}</td><td><div class=row style="gap:6px"><button class="btn sm" data-ht="${x.id}" data-v="approve">موافقة</button><button class="btn alt sm" data-ht="${x.id}" data-v="reject">رفض</button></div></td></tr>`),'لا توجد طلبات.');
body().querySelectorAll('[data-vf]').forEach(bt=>bt.onclick=async()=>{try{await api('/admin/vat/'+bt.dataset.vf+'/verify','POST',{decision:bt.dataset.v});toast('تم');drawVerify()}catch(x){toast(x.message,1)}});
body().querySelectorAll('[data-ht]').forEach(bt=>bt.onclick=async()=>{try{await api('/admin/helper-type/'+bt.dataset.ht+'/decide','POST',{decision:bt.dataset.v});toast('تم');drawVerify()}catch(x){toast(x.message,1)}})};
function relTime(iso){const t=Date.parse(String(iso||'').replace(' ','T')+(String(iso||'').includes('Z')?'':'Z'));if(!t)return'';const m=Math.max(1,Math.round((Date.now()-t)/60000));if(m<60)return`منذ ${m} دقيقة`;const h=Math.round(m/60);if(h<24)return`منذ ${h} ساعة`;return`منذ ${Math.round(h/24)} يوم`}

function ICON(name){return ({home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.6c2 .9 3.2 2.7 3.5 5.4"/>',orders:'<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',alert:'<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17h.01"/>',grid:'<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',card:'<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h4"/>',gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',out:'<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 8l-4 4 4 4M6 12h10"/>',chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',bolt:'<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',more:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>'})[name]||'';}
function svgI(name,size=20){return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON(name)}</svg>`;}
const areaChart=(vals,labels)=>{const W=640,H=230,PL=40,PR=18,PT=18,PB=34;const max=Math.max(3,...vals);const n=vals.length;const x=i=>PL+(n>1?i*(W-PL-PR)/(n-1):0);const y=v=>PT+(H-PT-PB)*(1-v/max);
const pts=vals.map((v,i)=>[x(i),y(v)]);
let d='';pts.forEach((p,i)=>{if(!i){d+=`M${p[0].toFixed(1)} ${p[1].toFixed(1)}`;return}const q=pts[i-1];const cx=(q[0]+p[0])/2;d+=` C${cx.toFixed(1)} ${q[1].toFixed(1)} ${cx.toFixed(1)} ${p[1].toFixed(1)} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`});
const area=d+` L${pts[n-1][0].toFixed(1)} ${H-PB} L${pts[0][0].toFixed(1)} ${H-PB} Z`;
const grid=[0,1,2,3].map(g=>{const yy=y(max*g/3),tick=Number(max*g/3).toLocaleString('en-GB',{maximumFractionDigits:1});return `<line x1="${PL}" x2="${W-PR}" y1="${yy}" y2="${yy}" stroke="#e2dbf5" stroke-dasharray="4 5"/><text x="${W-PR+6}" y="${yy+4}" font-size="12" fill="#8a81a3">${tick}</text>`}).join('');
const xl=[0,Math.floor((n-1)/2),n-1].map(i=>`<text x="${x(i)}" y="${H-8}" font-size="12" fill="#8a81a3" text-anchor="${i===0?'start':i===n-1?'end':'middle'}">${esc(labels[i]?String(labels[i]).slice(5).replace('-','/'):'')}</text>`).join('');
const last=pts[n-1];
return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="إحصائيات المنصة" style="width:100%;height:auto;display:block"><defs><linearGradient id="gA" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#7a5ae0" stop-opacity=".28"/><stop offset="1" stop-color="#7a5ae0" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${area}" fill="url(#gA)"/><path d="${d}" fill="none" stroke="#5331b6" stroke-width="2.6" stroke-linecap="round"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="5" fill="#5331b6" stroke="#fff" stroke-width="2"/>${xl}</svg>`};
const monHtml=(m)=>{
  if(!m)return '<div class=empty>تعذّر تحميل بيانات المتابعة</div>';
  const A=m.alerts,S=m.system,P=m.platform,F=m.performance||{},AC=m.activity||{},N=m.notifications||{};
  const f=n=>Number(n||0).toLocaleString('en-GB',{maximumFractionDigits:1});
  const ST={ok:['ok','كل شيء يعمل بشكل طبيعي'],warn:['warn','هناك أمور تحتاج انتباهك'],critical:['crit','يوجد خلل يحتاج تدخلًا عاجلًا']}[m.status]||['ok',''];
  const order={critical:0,warn:1,info:2},LV={critical:'عاجل',warn:'تنبيه',info:'للعلم'};
  const al=(m.alerts_list||[]).slice().sort((a,b)=>order[a.level]-order[b.level]);
  const alRows=al.length?al.map(x=>{const t=`<span class=mon-lv>${LV[x.level]}</span><span class=mon-tx>${esc(x.text)}</span>`;return x.link&&x.link!=='home'?`<a class="mon-al lv-${x.level}" href="#/manage/${x.link}">${t}<i>‹</i></a>`:`<div class="mon-al lv-${x.level}">${t}</div>`}).join(''):'<div class=empty>لا توجد تنبيهات الآن</div>';
  const kp=(label,val,tone,sub)=>`<div class="mon-k ${tone||''}"><small>${label}</small><b>${val}</b>${sub?`<em>${sub}</em>`:''}</div>`;
  const up=S.uptime_seconds>=86400?Math.floor(S.uptime_seconds/86400)+' يوم':Math.floor(S.uptime_seconds/3600)+' ساعة';
  const mb=(S.db_size_bytes/1048576).toFixed(1)+' م.ب';
  const bk=S.last_backup?new Date(S.last_backup.at).toLocaleString('en-GB'):'لا توجد نسخة بعد';
  const pm=F.per_minute||[],mx=Math.max(1,...pm.map(x=>x.req));
  const bars=pm.map((x,i)=>{const h=Math.round(x.req/mx*56),e=x.err?Math.max(2,Math.round(x.err/mx*56)):0;return `<g><rect x="${i*10+2}" y="${60-h}" width="7" height="${h}" rx="2" fill="#7a5ae0" opacity=".85"/>${e?`<rect x="${i*10+2}" y="${60-e}" width="7" height="${e}" rx="2" fill="#d64545"/>`:''}</g>`}).join('');
  const chart=`<svg viewBox="0 0 302 64" role="img" aria-label="الطلبات في آخر 30 دقيقة" style="width:100%;height:auto;display:block">${bars}</svg>`;
  const rt=(rows,col)=>rows&&rows.length?`<div class=mon-rt>${rows.map(r=>`<div class=mon-rr><code dir=ltr>${esc(r.route)}</code><b>${col==='e'?f(r.errors)+' خطأ':f(r.avg_ms)+' م.ث'}</b></div>`).join('')}</div>`:'<div class=empty>لا بيانات كافية بعد</div>';
  const ico={user:'👤',report:'🚩',dispute:'⚖️',order:'📦',broadcast:'📣'};
  const evs=(m.events||[]).length?m.events.map(e=>`<a class=mon-ev href="#/manage/${e.link}"><span>${esc(e.text)}</span><small>${relTime(e.at)}</small></a>`).join(''):'<div class=empty>لا توجد أحداث بعد</div>';
  const lb=(ok,label,val)=>'<div class=mg-row><span>'+label+'</span><b class="'+(ok?'pill':'pill-warn')+'">'+val+'</b></div>';
  return `<div class="mon-banner b-${ST[0]}"><span class=mon-dot></span><div><b>${ST[1]}</b><small>آخر تحديث ${new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'})} · يتجدد تلقائيًا كل 30 ثانية</small></div></div>
  <div class=hm-grid style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px">
    <section class=panel><div class=sec-h><h3>التنبيهات (${al.length})</h3></div>${alRows}</section>
    <section class=panel><div class=sec-h><h3>أداء الموقع</h3><small>منذ آخر تشغيل للخادم</small></div>
      <div class=mon-ks>
        ${kp('الطلبات',f(F.requests),'', 'أخطاء العميل: <span dir=ltr>'+Number(F.errors_4xx||0)+'</span>')}
        ${kp('متوسط الاستجابة',f(F.avg_ms)+' م.ث',F.avg_ms>800?'warn':'')}
        ${kp('أبطأ 5% من الطلبات',f(F.p95_ms)+' م.ث',F.p95_ms>1500?'warn':'')}
        ${kp('نسبة أخطاء الخادم',f(F.error_rate)+'%',F.error_rate>=5?'crit':F.error_rate>0?'warn':'',f(F.errors_5xx)+' خطأ')}
        ${kp('الذاكرة',f((F.memory||{}).heap_pct)+'%',(F.memory||{}).heap_pct>=90?'warn':'',((F.memory||{}).rss/1048576).toFixed(0)+' م.ب')}
        ${kp('تأخر المعالجة',f(F.loop_lag_p99_ms)+' م.ث',F.loop_lag_p99_ms>200?'warn':'')}
      </div>
      <div class=mon-ch><small>الطلبات في آخر 30 دقيقة <span class=mon-lg>الأحمر = أخطاء خادم</span></small>${chart}</div>
    </section>
    <section class=panel><div class=sec-h><h3>أبطأ المسارات</h3></div>${rt(F.slow_routes)}<div class=sec-h style="margin-top:14px"><h3>مسارات فيها أخطاء</h3></div>${rt(F.error_routes,'e')}</section>
    <section class=panel><div class=sec-h><h3>النشاط خلال 24 ساعة</h3></div>
      <div class=mon-ks>
        ${kp('جلسات نشطة الآن',f(AC.sessions_now))}
        ${kp('مستخدمون جدد',f(AC.new_users_24h))}
        ${kp('طلبات جديدة',f(AC.agreements_24h))}
        ${kp('رسائل',f(AC.messages_24h))}
        ${kp('منشورات وريلز',f(AC.posts_24h))}
        ${kp('دخول محظور مؤقتًا',f(AC.login_blocked),AC.login_blocked?'warn':'')}
      </div>
      <div class=mon-ks style="margin-top:10px">
        ${kp('المستخدمون النشطون',f(P.active_users))}
        ${kp('المساعدون النشطون',f(P.active_helpers))}
        ${kp('اتفاقات مفتوحة',f(P.open_agreements))}
      </div>
    </section>
    <section class=panel><div class=sec-h><h3>الإشعارات</h3><a class=pill-btn href="#/manage/ads">إرسال إشعار عام</a></div>
      <div class=mon-ks>
        ${kp('أُرسلت خلال 24 ساعة',f(N.sent_24h))}
        ${kp('غير مقروءة',f(N.unread_total))}
        ${kp('إشعارات عامة (7 أيام)',f(N.broadcasts_week))}
      </div>
      <div class=sec-h style="margin-top:14px"><h3>آخر الأحداث</h3></div>${evs}
    </section>
    <section class=panel><div class=sec-h><h3>حالة النظام</h3></div>
      ${lb(S.database==='ok','قاعدة البيانات',S.database==='ok'?'تعمل':'خطأ')}
      ${lb(!!S.last_backup,'آخر نسخة احتياطية',bk)}
      ${lb(S.mail,'البريد الإلكتروني',S.mail?'مفعّل':'غير مفعّل')}
      ${lb(S.push,'إشعارات الدفع',S.push?'مفعّلة':'غير مفعّلة')}
      ${lb(S.payments,'بوابة الدفع',S.payments?'مفعّلة':'غير مفعّلة')}
      <div class=mg-row><span>مدة التشغيل</span><b>${up}</b></div>
      <div class=mg-row><span>حجم القاعدة</span><b>${mb}</b></div>
    </section>
  </div>`;
};
const drawHome=async()=>{
  const [d,mon]=await Promise.all([api('/admin/dashboard?days='+homeDays),api('/admin/monitor').catch(()=>null)]);const t=d.totals;
  const f=n=>Number(n||0).toLocaleString('en-GB',{maximumFractionDigits:2});
  const stat=(cls,icon,label,val)=>`<div class="stat ${cls}"><div class="stat-ic">${svgI(icon,22)}</div><div><small>${label}</small><b>${val}</b></div></div>`;
  let chartKey='requests';const seriesName={users:'المستخدمون',requests:'الطلبات',profit:'العمولات',helpers:'نشاط المساعدين'};
  const chartMarkup=()=>{const vals=d.series[chartKey]||[],last=vals.length?vals[vals.length-1]:0;return `${areaChart(vals,d.labels)}${last?`<div class=chart-tip>${f(last)} ${seriesName[chartKey]}</div>`:''}`};
  const acts=[['users','المستخدمون','إدارة المستخدمين والمساعدين','users'],['orders','الطلبات','متابعة الطلبات وإدارتها','orders'],['rpt','المخالفات','مراجعة البلاغات واتخاذ الإجراء','alert'],['cats','المهارات والتخصصات','إدارة التخصصات والمهارات','grid'],['sys','الإعدادات','تخصيص إعدادات المنصة','gear'],['fin','المدفوعات','متابعة المدفوعات والتحويلات','card']];
  body().innerHTML=`
  <div class=welcome-row><div><h2>المتابعة الشاملة للمنصة</h2><p>أداء الموقع والتنبيهات والإشعارات في مكان واحد</p></div><select id=hDays aria-label="الفترة الزمنية" class=pill-select><option value=7 ${homeDays===7?'selected':''}>آخر 7 أيام</option><option value=30 ${homeDays===30?'selected':''}>آخر 30 يومًا</option><option value=90 ${homeDays===90?'selected':''}>آخر 90 يومًا</option></select></div>
  <div id=monBox>${monHtml(mon)}</div>
  <div class="hm-grid">
    <div class=hm-stats>
      ${stat('s-red','alert','المخالفات',f(t.open_reports))}
      ${stat('s-blue','card','التحويلات المعلقة',f(t.commissions_due_count))}
      ${stat('s-violet','users','المساعدون',f(t.helpers))}
      ${stat('s-lilac','users','المستخدمون',f(t.users))}
    </div>
    <details class=dash-extra><summary>مؤشرات إضافية</summary><div class=extra-stats>
      <div><small>إجمالي الطلبات</small><b>${f(t.requests)}</b></div><div><small>الطلبات النشطة</small><b>${f(t.active_requests)}</b></div><div><small>الطلبات المكتملة</small><b>${f(t.completed_requests)}</b></div><div><small>عمولات المنصة</small><b>${f(t.commissions_total)} ر.س</b></div><div><small>مبالغ معلقة</small><b>${f(t.commissions_due)} ر.س</b></div><div><small>مستخدمون جدد خلال الفترة</small><b>${f(t.new_users_period)}</b></div><div><small>طلبات جديدة خلال الفترة</small><b>${f(t.new_requests_period)}</b></div>
    </div></details>
    <section class="card chart-card2">
      <div class=ch-head><h3 id=hChartTitle>${svgI('chart',18)} إحصائيات ${seriesName[chartKey]}</h3><select id=hSeries class=pill-select aria-label="مقياس الرسم البياني">${Object.entries(seriesName).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
      <div class=ch-wrap id=hChart>${chartMarkup()}</div>
    </section>
    <section class="card acts-card">
      <div class=ch-head><h3>${svgI('grid',18)} إدارة المنصة</h3></div>
      <div class=acts>${acts.map(([k,l,sub,ic])=>`<a class=act href="#/manage/${k}"><span class="act-ic">${svgI(ic,22)}</span><span class=act-t><b>${l}</b><small>${sub}</small></span><span class=act-go>‹</span></a>`).join('')}</div>
    </section>
    <section class="card feed-card">
      <div class=ch-head><h3>${svgI('bolt',18)} أحدث الأنشطة</h3><a class=pill-btn href="#/manage/audit">عرض الكل</a></div>
      ${d.activity.length?d.activity.slice(0,5).map(a=>`<div class=feed-row><span class=feed-ic>${svgI('bolt',16)}</span><span class=feed-t>${esc(a.action)}${a.detail?`<small>${esc(a.detail)}</small>`:''}</span><small class=feed-time>${relTime(a.at)}</small></div>`).join(''):'<div class=empty>لا توجد نشاطات بعد.</div>'}
    </section>
  </div>`;
  $('#hDays').onchange=e=>{homeDays=+e.target.value;draw()};
  clearInterval(window.__monT);window.__monT=setInterval(async()=>{const bx=document.getElementById('monBox');if(!bx){clearInterval(window.__monT);return}try{bx.innerHTML=monHtml(await api('/admin/monitor'))}catch{}},30000);
  $('#hSeries').onchange=e=>{chartKey=e.target.value;$('#hChartTitle').innerHTML=`${svgI('chart',18)} إحصائيات ${seriesName[chartKey]}`;$('#hChart').innerHTML=chartMarkup()};
};
const ORD_ST={pending:'بانتظار القبول',agreed:'جارٍ التنفيذ',completion_requested:'بانتظار تأكيد الإنجاز',completed:'مكتمل',cancelled:'ملغي',disputed:'متنازع عليه',closed_disputed:'مغلق بعد المراجعة'};
const ORD_GROUPS=[['all','الكل'],['open','مفتوحة'],['active','نشطة'],['stuck','متعثرة'],['completed','مكتملة'],['cancelled','ملغاة'],['disputed','نزاعات']];
let ordGroup='all',ordQ='',ordPage=0;
const drawOrders=async()=>{
  const [sm,rows]=await Promise.all([api('/admin/orders/summary'),api(`/admin/orders?group=${ordGroup}&q=${encodeURIComponent(ordQ)}&page=${ordPage}`)]);
  const card=(l,v,cls)=>`<div class="kpi ${cls||''}"><small>${l}</small><b>${v}</b></div>`;
  body().innerHTML=`<h3 class=mg-h>إدارة الطلبات</h3>
  <div class=kpis>${card('الكل',sm.all)}${card('مفتوحة',sm.open)}${card('نشطة',sm.active)}${card('مكتملة',sm.completed)}${card('متعثرة',sm.stuck,sm.stuck?'warn':'')}${card('نزاعات',sm.disputed,sm.disputed?'warn':'')}</div>
  <div class=ord-bar><div class=ord-chips>${ORD_GROUPS.map(([k,l])=>`<button class="chip-btn ${ordGroup===k?'on':''}" data-og="${k}">${l}</button>`).join('')}</div>
  <div class=ord-tools><input id=ordQ type=search placeholder="ابحث برقم الطلب أو الاسم أو الوصف" value="${esc(ordQ)}" aria-label="بحث الطلبات"><button class="btn alt sm" id=ordExp type=button>تصدير CSV</button></div></div>
  ${rows.length?`<div class=tbl-wrap><table class=tbl><thead><tr><th>#</th><th>الوصف</th><th>طالب المساعدة</th><th>المساعد</th><th>المبلغ</th><th>العمولة</th><th>الحالة</th><th>آخر تحديث</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr class="${r.stuck?'stuck':''}"><td>${r.id}</td><td>${esc(r.description)}</td><td>${esc(r.a_name)}</td><td>${esc(r.b_name)}</td><td>${r.amount} ر.س</td><td>${r.commission==null?'—':r.commission+' ر.س'}</td><td><span class=pill>${ORD_ST[r.status]||r.status}</span>${r.stuck?` <span class=pill-warn>متعثر · ${r.days_idle} يومًا</span>`:''}</td><td><small>${esc(String(r.updated_at||'').slice(0,16))}</small></td><td>${r.stuck?`<button class="btn alt sm" data-nudge="${r.id}" type=button>تذكير الطرفين</button>`:''}</td></tr>`).join('')}</tbody></table></div>
  <div class=pager><button class="btn alt sm" data-op="-1" ${ordPage?'':'disabled'} type=button>السابق</button><small>الصفحة ${ordPage+1}</small><button class="btn alt sm" data-op="1" ${rows.length===50?'':'disabled'} type=button>التالي</button></div>`:'<div class=empty>لا توجد طلبات تطابق هذا التصنيف.</div>'}`;
  body().querySelectorAll('[data-og]').forEach(b=>b.onclick=()=>{ordGroup=b.dataset.og;ordPage=0;drawOrders()});
  $('#ordQ').onchange=e=>{ordQ=e.target.value.trim();ordPage=0;drawOrders()};
  $('#ordExp').onclick=()=>window.open('/api/admin/export?type=orders','_blank');
  body().querySelectorAll('[data-op]').forEach(b=>b.onclick=()=>{ordPage=Math.max(0,ordPage+Number(b.dataset.op));drawOrders()});
  body().querySelectorAll('[data-nudge]').forEach(b=>b.onclick=async()=>{const why=await askBox({title:'تذكير الطرفين',text:'يصل التذكير لطالب المساعدة والمساعد، دون تغيير الطلب أو المال.',field:true,label:'نص التذكير',ok:'إرسال التذكير'});if(!why)return;try{await api(`/admin/orders/${b.dataset.nudge}/nudge`,'POST',{reason:why});toast('أُرسل التذكير للطرفين')}catch(x){toast(x.message,1)}});
};
const drawAds=async()=>{
  const list=await api('/admin/broadcasts');const AUD={all:'الجميع',helpers:'المساعدون فقط',clients:'طالبو المساعدة فقط'};
  body().innerHTML=`<h3 class=mg-h>الإعلانات والتنبيهات</h3>
  <section class=panel><form id=bc class=form><label>الجمهور<select name=audience><option value=all>جميع المستخدمين النشطين</option><option value=helpers>المساعدون فقط</option><option value=clients>طالبو المساعدة فقط</option></select></label><label>نص الإعلان<textarea name=text rows=3 required minlength=5 maxlength=500></textarea></label><label>رابط التوجيه (اختياري)<input name=link value="#/" dir=ltr></label><button class=btn>إرسال الإعلان</button></form></section>
  <h3 class=mg-h>سجل الإعلانات السابقة</h3>${list.length?list.map(x=>`<div class=mg-row style="display:block"><div class=row style="justify-content:space-between"><b>${AUD[x.audience]||esc(x.audience)}</b><small>${x.sent} مستلم · ${esc(String(x.at||'').slice(0,16).replace('T',' '))}</small></div><div>${esc(x.text)}</div><small>بواسطة ${esc(x.admin||'النظام')}</small></div>`).join(''):'<div class=empty>لم تُرسل إعلانات بعد.</div>'}`;
  $('#bc').onsubmit=sub(async b=>{if(!(await askBox({title:'إرسال الإعلان',text:'سيصل هذا الإعلان للجمهور المختار. متابعة؟',ok:'إرسال'})))return;const r=await api('/admin/broadcast','POST',b);toast(`أُرسل الإعلان إلى ${r.sent} مستخدم`);drawAds()});
};
const AUDIT_LABEL={settings:'تحديث إعدادات المنصة',expense:'تسجيل مصروف',lift:'رفع القيود',post_hide:'إخفاء منشور',comment_delete:'حذف تعليق',order_nudge:'تذكير طرفي طلب',broadcast:'إعلان',vat_threshold:'حد التسجيل',invoicing:'إعدادات الفوترة'};
const drawAudit=async()=>{const list=await api('/admin/audit');body().innerHTML=`<h3 class=mg-h>سجل العمليات الإدارية</h3>${list.length?`<div class=tbl-wrap><table class=tbl><thead><tr><th>الوقت</th><th>المدير</th><th>العملية</th><th>التفاصيل</th></tr></thead><tbody>${list.map(a=>`<tr><td><small>${esc(String(a.at||'').slice(0,16).replace('T',' '))}</small></td><td>${esc(a.admin||'النظام')}</td><td>${esc(AUDIT_LABEL[a.action]||a.action)}</td><td><small>${esc(a.detail||'')}</small></td></tr>`).join('')}</tbody></table></div>`:'<div class=empty>لا توجد عمليات مسجلة.</div>'}`};


const drawAdmins=async()=>{
  const l=await api('/admin/admins');
  body().innerHTML=`<h3 class=mg-h>المشرفون</h3><small>المشرف له كل الصلاحيات. لتعديل صلاحيات الموظفين استخدم تبويب الموظفين.</small>
  <div class=tbl-wrap style="margin-top:10px"><table class=tbl><thead><tr><th>الاسم</th><th>البريد</th><th>الحالة</th><th>منذ</th></tr></thead><tbody>${l.map(a=>`<tr><td><a href="#/manage/user/${a.id}"><b>${esc(a.name)}</b></a></td><td><small dir=ltr>${esc(a.email)}</small></td><td>${a.active?'<span class=pill>مفعل</span>':'<span class=pill-warn>موقوف</span>'}</td><td><small>${esc(String(a.created_at||'').slice(0,10))}</small></td></tr>`).join('')}</tbody></table></div>`;
};

// نافذة منبثقة مخصصة بدل prompt/confirm: ترجع القيمة أو null عند الإلغاء
const askBox=({title,text='',field=false,label='السبب',min=3,danger=false,ok='تأكيد'})=>new Promise(res=>{
  const o=document.createElement('div');o.className='ov';o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');
  o.innerHTML=`<div class=mo style="max-width:440px;text-align:start"><h3 style="margin:0 0 6px;color:#241560">${esc(title)}</h3>${text?`<p style="margin:0 0 10px;color:#4b4361">${esc(text)}</p>`:''}${field?`<label style="display:block">${esc(label)}<textarea id=abx rows=3 style="width:100%;margin-top:6px" maxlength=300></textarea></label><small id=abe style="color:#8a1c1c"></small>`:''}<div class=row style="justify-content:flex-end;gap:8px;margin-top:14px"><button class="btn alt" id=abc type=button>إلغاء</button><button class="btn" id=aba type=button ${danger?'style="background:#8a1c1c;border-color:#8a1c1c"':''}>${esc(ok)}</button></div></div>`;
  document.body.appendChild(o);const close=v=>{o.remove();res(v)};
  o.querySelector('#abc').onclick=()=>close(null);
  o.querySelector('#aba').onclick=()=>{if(field){const v=o.querySelector('#abx').value.trim();if(v.length<min){o.querySelector('#abe').textContent=`الحد الأدنى ${min} أحرف`;return}close(v)}else close(true)};
  o.onkeydown=e=>{if(e.key==='Escape')close(null)};
  (field?o.querySelector('#abx'):o.querySelector('#aba')).focus();
});
const skel=(rows=4)=>`<div class=skel-wrap aria-busy=true aria-label="جاري التحميل">${Array.from({length:rows}).map(()=>'<div class=skel></div>').join('')}</div>`;
const drawCatsWithTest=async()=>{await drawCats();body().insertAdjacentHTML('afterbegin',await drawMatchTest());const f=$('#mtF');f.onsubmit=async e=>{e.preventDefault();const text=f.elements.text.value.trim();const out=$('#mtR');out.innerHTML=skel(1);try{const r=await api('/admin/match-test','POST',{text});out.innerHTML=r.matched?`<div class=mg-row style="display:block"><small>الأقسام المطابقة (الأعلى أولًا):</small><div style="margin-top:6px">${r.hits.map(h=>`<span class=mg-chip>${esc(h.name)} · ${h.score}</span>`).join('')}</div></div>`:`<div class=empty>لا يطابق هذه العبارة أي قسم، وستُسجَّل كبحث لم يجد قسمًا.</div>`}catch(x){out.innerHTML=`<small>${esc(x.message)}</small>`}}};
const drawMatchTest=async()=>{
  const box=`<section class=panel style="margin-bottom:14px"><h4 style="margin:0 0 6px">اختبار محرك المطابقة</h4><small>اكتب عبارة كما يكتبها طالب المساعدة، لترى الأقسام التي تطابقها. لا يُحفظ شيء.</small><form id=mtF class=form style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><input name=text required minlength=2 maxlength=200 placeholder="مثال: تسريب مياه في الحمام" style="flex:1;min-width:220px"><button class=btn>اختبار</button></form><div id=mtR></div></section>`;
  return box;
};

let perfDays=90;
const drawPerf=async()=>{
  const rows=await api('/admin/helper-performance?days='+perfDays);
  const f=n=>Number(n||0).toLocaleString('en-GB',{maximumFractionDigits:2});
  body().innerHTML=`<h3 class=mg-h>أداء المساعدين</h3><div class=ord-bar><div class=ord-chips>${[30,90,365].map(d=>`<button class="chip-btn ${perfDays===d?'on':''}" data-pd="${d}" type=button>${d===365?'سنة':'آخر '+d+' يومًا'}</button>`).join('')}</div><small>مرتّب حسب الطلبات المكتملة</small></div>
  ${rows.length?`<div class=tbl-wrap><table class=tbl><thead><tr><th>المساعد</th><th>المدينة</th><th>التقييم</th><th>الطلبات</th><th>المكتملة</th><th>الملغاة</th><th>بلاغات</th><th>عمولات مدفوعة</th><th>الحالة</th></tr></thead><tbody>${rows.map(r=>`<tr class="${r.reports>0||r.cancelled>r.completed&&r.cancelled>2?'stuck':''}"><td><a href="#/manage/user/${r.id}"><b>${esc(r.name)}</b></a></td><td>${esc(r.city||'—')}</td><td>${r.rating_count?f(r.rating)+' ★ <small>('+r.rating_count+')</small>':'—'}</td><td>${r.orders}</td><td>${r.completed}</td><td>${r.cancelled}</td><td>${r.reports?`<span class=pill-warn>${r.reports}</span>`:'0'}</td><td>${f(r.commissions_paid)} ر.س</td><td>${r.active?'<span class=pill>مفعل</span>':'<span class=pill-warn>موقوف</span>'}</td></tr>`).join('')}</tbody></table></div>`:'<div class=empty>لا يوجد مساعدون بعد.</div>'}`;
  body().querySelectorAll('[data-pd]').forEach(b=>b.onclick=()=>{perfDays=+b.dataset.pd;drawPerf()});
};
function applyMgTheme(dark){const sh=document.querySelector('.mg-shell');if(sh)sh.classList.toggle('mg-dark',dark);const b=$('#mgTheme');if(b){b.textContent=dark?'☀ فاتح':'🌙 داكن';b.setAttribute('aria-pressed',dark?'true':'false')}}

const recTable=(heads,rowsHtml,empty)=>rowsHtml.length?`<div class=tbl-wrap><table class=tbl><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rowsHtml.join('')}</tbody></table></div>`:`<div class=empty>${empty}</div>`;
const PAGE_SUB={home:'متابعة شاملة لأداء الموقع والتنبيهات والإشعارات',users:'الحسابات والبحث والتصنيف والملفات',orders:'متابعة الطلبات والمتعثرة والتذكير',cats:'الأقسام والكلمات المفتاحية واختبار المطابقة',fin:'التحويلات والمستحقات والعمولات',acc:'الإيرادات والمصروفات والفوترة',ads:'إرسال الإعلانات وسجلها',audit:'كل العمليات الإدارية المسجلة',admins:'حسابات المشرفين الكاملة الصلاحيات',perf:'تقييم المساعدين وطلباتهم وبلاغاتهم',rate:'التقييمات والمراجعات المبلغ عنها',pts:'النقاط والمكافآت',rpt:'البلاغات والمخالفات',chat:'المحادثات المبلغ عنها',disp:'النزاعات والاعتراضات',supply:'توريدات المنصة وحد التسجيل',verify:'توثيق الحسابات والسجلات',staff:'الموظفون وصلاحياتهم',sys:'إعدادات المنصة والنسخ الاحتياطي'};
const setPageHead=()=>{const h=$('#mgHead');if(!h)return;if(tab==='home'){h.innerHTML='';return}const t=TABS.find(x=>x[0]===tab);h.innerHTML=`<div><h2>${esc(t?t[1]:'')}</h2><small>${esc(PAGE_SUB[tab]||'')}</small></div>`};
const draw=async()=>{document.querySelectorAll('.mg-tab').forEach(x=>x.classList.toggle('on',x.dataset.t===tab));$('#mgNav').classList.remove('open');{const bb=$('#mgBurger');if(bb){bb.setAttribute('aria-expanded','false');bb.setAttribute('aria-label','فتح القائمة')}}setPageHead();body().innerHTML='<small>جاري التحميل…</small>';
try{body().innerHTML=skel(4);if(tab==='home')await drawHome();
else if(tab==='chat'&&curChat)await drawChatPage(curChat);else if(tab==='users'&&curUser)await drawUserProfile(curUser);else if(tab==='users')await drawUsersPage();else if(tab==='orders')await drawOrders();else if(tab==='ads')await drawAds();else if(tab==='audit')await drawAudit();else if(tab==='admins')await drawAdmins();else if(tab==='perf')await drawPerf();else if(tab==='rate')await drawRatings();else if(tab==='fin')await drawFinance();else if(tab==='acc')await drawAcc();else if(tab==='rep')await drawReports();else if(tab==='chat')await drawChats();else if(tab==='pts')await drawPoints();else if(tab==='rpt')await drawGrowth();else if(tab==='insights')await drawInsights();else if(tab==='disp')await drawDisputes();else if(tab==='supply'){await drawSupply();await drawCoverage()}else if(tab==='verify')await drawVerify();else if(tab==='staff')await drawStaff();else if(tab==='ai')await drawAi();else if(tab==='sys')await drawSystem();else await drawCatsWithTest();
}catch(x){body().innerHTML=`<small>${esc(x.message)}</small>`}};
document.querySelectorAll('.mg-tab[data-t]').forEach(x=>x.onclick=()=>{tab=x.dataset.t;curUser=null;curChat=null;history.replaceState(null,'','#/manage/'+tab);draw()});
await draw()}
