// مدير العمليات: متابعة دورة الطلب (اتفاق ← إنجاز ← إغلاق) بالتذكير ثم التصعيد، وفحص سلامة الحالات.
// التذكيرات إشعارات داخل المنصة فقط (بلا بريد، فلا تكلفة). لا يغيّر حالة أي طلب.
import {helperOf,clientOf} from '../core.js';

const ageDays=ts=>ts?(Date.now()-new Date(String(ts).replace(' ','T')+'Z').getTime())/864e5:0;
const remindersSent=(c,refs)=>c.get("SELECT COUNT(*) n FROM ai_audit WHERE refs=? AND mode='auto' AND result LIKE 'ok:%'",refs).n;

export const rules={
  unanswered_chats:{title:'تذكير بالرسائل التي لم تُرد عليها',interval:60,params:{hours:24,gap_days:2},run(c){
    const P=c.params;
    for(const m of c.all("SELECT l.id mid,l.to_id who,l.from_id peer FROM direct_messages l WHERE l.id=(SELECT MAX(x.id) FROM direct_messages x WHERE (x.from_id=l.from_id AND x.to_id=l.to_id) OR (x.from_id=l.to_id AND x.to_id=l.from_id)) AND l.created_at<datetime('now',?) AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=l.from_id AND b.blocked_id=l.to_id) OR (b.blocker_id=l.to_id AND b.blocked_id=l.from_id)) ORDER BY l.id LIMIT 200",'-'+P.hours+' hours')){
      c.act('send_notice',{user_id:m.who,text:`لديك رسالة لم تُرد عليها منذ ${P.hours} ساعة. افتح المحادثة للرد.`,link:'#/direct/'+m.peer},{key:'chatrem:'+m.mid,cooldownDays:P.gap_days,reason:'رسالة بلا رد',refs:'dm:'+m.mid});
    }}},
  stuck_orders:{title:'متابعة الطلبات المتأخرة والتذكير',interval:60,params:{pending_days:3,completion_days:2,agreed_days:14,max_reminders:2,gap_days:2},run(c){
    const P=c.params;
    const stage=(g,st,who,days,text,sevWord)=>{
      const refs='agr:'+g.id+':'+st,sent=remindersSent(c,refs),peer=who===g.a_id?g.b_id:g.a_id;
      c.raise({kind:'stuck_order',severity:days>=P[st==='pending'?'pending_days':st==='completion'?'completion_days':'agreed_days']*3?'medium':'low',subject_type:'agreement',subject_id:g.id,title:`الطلب #${g.id} ${sevWord} منذ ${Math.floor(days)} يومًا`,reason:'مرحلة: '+sevWord+'. تذكيرات مُرسلة: '+sent+'.',evidence:{agreement_id:g.id,stage:st,days:Math.floor(days),reminders:sent},dedupe:'stuck:'+g.id+':'+st});
      if(sent>=P.max_reminders){c.raise({kind:'stuck_escalation',severity:'medium',subject_type:'agreement',subject_id:g.id,title:`الطلب #${g.id} لم يتحرك بعد ${sent} تذكيرات`,reason:'تدخّل الإدارة مطلوب: تواصل مع الطرفين أو أغلق الطلب.',evidence:{agreement_id:g.id,stage:st},dedupe:'stuckesc:'+g.id+':'+st});return}
      c.act('send_notice',{user_id:who,text,link:'#/direct/'+peer},{key:'rem:'+g.id+':'+st,cooldownDays:P.gap_days,reason:sevWord,refs});
    };
    for(const g of c.all("SELECT * FROM agreements WHERE status='pending' AND created_at<datetime('now',?) ORDER BY id LIMIT 200",'-'+P.pending_days+' days'))
      stage(g,'pending',g.b_id,ageDays(g.created_at),`لديك اتفاق بمبلغ ${g.amount} ريال بانتظار موافقتك (الطلب #${g.id}). وافق عليه أو تجاهله إن لم يعد مناسبًا.`,'بانتظار موافقة الطرف الآخر');
    for(const g of c.all("SELECT * FROM agreements WHERE status='completion_requested' AND COALESCE(completion_requested_at,updated_at)<datetime('now',?) ORDER BY id LIMIT 200",'-'+P.completion_days+' days'))
      stage(g,'completion',clientOf(g),ageDays(g.completion_requested_at||g.updated_at),`طلب المساعد تأكيد إنجاز الطلب #${g.id}. يرجى التأكيد إن اكتمل العمل أو الاعتراض إن كان لديك ملاحظة.`,'بانتظار تأكيد الإنجاز');
    for(const g of c.all("SELECT * FROM agreements WHERE status='agreed' AND updated_at<datetime('now',?) ORDER BY id LIMIT 200",'-'+P.agreed_days+' days'))
      stage(g,'agreed',helperOf(g),ageDays(g.updated_at),`الطلب #${g.id} قيد التنفيذ منذ فترة. إن أنجزته فاطلب تأكيد الإنجاز من العميل، وإن تعذّر فتواصل معه.`,'قيد التنفيذ طويلًا');
  }},

  stuck_tasks:{title:'متابعة المهام المعلقة',interval:360,params:{requested_days:2,accepted_days:10},run(c){
    for(const t of c.all("SELECT * FROM tasks WHERE status='requested' AND updated_at<datetime('now',?) LIMIT 200",'-'+c.params.requested_days+' days'))
      c.act('send_notice',{user_id:t.client_id,text:'لديك مهمة بانتظار قبولك. افتح المحادثة لقبولها.',link:'#/direct/'+t.helper_id},{key:'task-req:'+t.id,cooldownDays:3,reason:'مهمة بانتظار القبول',refs:'task:'+t.id});
    for(const t of c.all("SELECT * FROM tasks WHERE status='accepted' AND updated_at<datetime('now',?) LIMIT 200",'-'+c.params.accepted_days+' days'))
      c.raise({kind:'stuck_task',severity:'low',subject_type:'task',subject_id:t.id,title:`مهمة #${t.id} مقبولة منذ أكثر من ${c.params.accepted_days} أيام دون إنهاء`,reason:'قد تحتاج متابعة من الإدارة.',evidence:{task_id:t.id},dedupe:'stucktask:'+t.id});
  }},

  lifecycle_integrity:{title:'فحص سلامة دورة الطلب',interval:360,params:{},run(c){
    const bad=(sql,kind,title,reason,sev='medium')=>{for(const g of c.all(sql))c.raise({kind,severity:sev,subject_type:'agreement',subject_id:g.id,title:title+' (#'+g.id+')',reason,evidence:{agreement_id:g.id,status:g.status},dedupe:kind+':'+g.id+':'+g.status})};
    bad("SELECT id,status FROM agreements WHERE status='completed' AND completed_at IS NULL LIMIT 100",'lc_no_completed_at','طلب مكتمل بلا تاريخ إنجاز','حالة مكتمل دون completed_at: قد تتأثر الإحصاءات والمحاسبة.');
    bad("SELECT id,status FROM agreements WHERE paid_at IS NOT NULL AND status IN ('pending','cancelled') LIMIT 100",'lc_paid_inactive','طلب مدفوع لكنه غير فعّال','دُفع الطلب وحالته معلقة أو ملغاة: راجع الاسترداد أو الحالة.','high');
    bad("SELECT id,status FROM agreements WHERE status='completion_requested' AND completion_requested_at IS NULL LIMIT 100",'lc_no_request_ts','طلب إنجاز بلا تاريخ','حالة بانتظار التأكيد بلا تاريخ الطلب.','low');
    bad("SELECT g.id,g.status FROM agreements g WHERE g.a_id=g.b_id LIMIT 100",'lc_self','اتفاق بين الحساب ونفسه','اتفاق طرفاه حساب واحد.','high');
  }},

  cash_dues_warning:{title:'تنبيه المساعدين قبل إيقاف حساب الكاش',interval:1440,params:{warn_at:2},run(c){
    for(const r of c.all("SELECT ac.helper_id h,COUNT(*) n,SUM(ac.amount) s FROM agreement_commissions ac JOIN agreements a ON a.id=ac.agreement_id WHERE ac.status='due' AND a.paid_via='cash' GROUP BY ac.helper_id HAVING n>=? LIMIT 200",c.params.warn_at))
      c.act('send_notice',{user_id:r.h,text:`لديك ${r.n} طلبات كاش لم تُسدَّد عمولاتها (${Math.round(r.s*100)/100} ريال). عند 3 طلبات يُوقف الحساب مؤقتًا حتى السداد.`,link:'#/profile'},{key:'cashwarn:'+r.h+':'+r.n,cooldownDays:7,reason:'عمولات كاش مستحقة',refs:'helper:'+r.h});
  }}
};
