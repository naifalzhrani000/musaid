// مدير العملاء والشكاوى: تصنيف البلاغات، تجهيز ملف النزاع، ومتابعة اكتمال ملفات المساعدين.
// لا يحسم نزاعًا ولا يرفض مستندًا؛ يعرض الحقائق ويقترح، والقرار للإدارة.
import crypto from 'node:crypto';
import {helperOf,clientOf} from '../core.js';
import {classify,PRIORITY_SEV,REPLY,maskDigits} from './text.js';

const h12=s=>crypto.createHash('sha256').update(String(s)).digest('hex').slice(0,12);
const daysSince=ts=>ts?Math.floor((Date.now()-new Date(String(ts).replace(' ','T')+'Z').getTime())/864e5):0;

export const rules={
  report_triage:{title:'تصنيف البلاغات وتأكيد الاستلام',interval:10,params:{},run(c){
    for(const r of c.all("SELECT * FROM reports WHERE status='open' ORDER BY id LIMIT 100")){
      const cls=classify(r.reason);
      let target=null,proposal=null;
      if(r.type==='user')target=r.target_id;
      else if(r.type==='rating')target=c.get('SELECT ratee_id x FROM ratings WHERE id=?',r.target_id)?.x;
      else if(r.type==='message')target=c.get('SELECT from_id x FROM direct_messages WHERE id=?',r.target_id)?.x;
      const distinct=target?c.get("SELECT COUNT(DISTINCT reporter_id) n FROM reports WHERE created_at>datetime('now','-30 days') AND ((type='user' AND target_id=?) OR (type='rating' AND target_id IN (SELECT id FROM ratings WHERE ratee_id=?)) OR (type='message' AND target_id IN (SELECT id FROM direct_messages WHERE from_id=?)))",target,target,target).n:1;
      let sev=PRIORITY_SEV[cls.priority];if(distinct>=3)sev='high';
      if(sev==='high'&&target&&r.type!=='rating')proposal={tool:'flag_user',args:{user_id:target}};
      if(r.type==='rating'&&['abuse','fraud','spam'].includes(cls.cat))proposal={tool:'hide_rating',args:{rating_id:r.target_id}};
      c.raise({kind:'report_triage',severity:sev,subject_type:'report',subject_id:r.id,title:`بلاغ #${r.id}: ${cls.label}`+(distinct>=3?` (${distinct} مُبلِّغين مختلفين)`:''),
        reason:'التصنيف آلي بالكلمات المفتاحية ويحتاج مراجعتك.'+(distinct>=3?' تكرر البلاغ على الحساب نفسه من '+distinct+' مُبلِّغين خلال 30 يومًا.':''),evidence:{report_id:r.id,type:r.type,category:cls.cat,distinct_reporters:distinct,suggested_reply:REPLY[cls.cat]},proposal,dedupe:'report:'+r.id});
      c.act('send_notice',{user_id:r.reporter_id,text:`استلمنا بلاغك رقم ${r.id} وسيراجعه فريق الإدارة. شكرًا لمساعدتك في إبقاء المنصة آمنة.`,link:null},{key:'ack:'+r.id,cooldownDays:3650,reason:'تأكيد استلام بلاغ',refs:'report:'+r.id});
    }}},

  contact_triage:{title:'تصنيف رسائل «اتصل بنا»',interval:30,params:{},run(c){
    const cur=c.cursorGet('contact');let last=cur;
    for(const m of c.all('SELECT id,body FROM contact_messages WHERE id>? ORDER BY id LIMIT 100',cur)){
      const cls=classify(m.body);last=m.id;
      c.raise({kind:'contact_triage',severity:PRIORITY_SEV[cls.priority]==='high'?'medium':'low',subject_type:'contact',subject_id:m.id,title:`رسالة تواصل #${m.id}: ${cls.label}`,reason:'رد مقترح: '+REPLY[cls.cat],evidence:{excerpt:maskDigits(m.body.slice(0,120)),category:cls.cat},dedupe:'contact:'+m.id});
    }
    if(last!==cur)c.cursorSet('contact',last);
  }},

  dispute_briefs:{title:'ملف النزاع والمهل',interval:60,params:{warn_days:4},run(c){
    for(const g of c.all("SELECT * FROM agreements WHERE status='disputed' ORDER BY id LIMIT 100")){
      const helper=helperOf(g),client=clientOf(g),since=g.created_at;
      const msgs=c.get('SELECT COUNT(*) n,COALESCE(SUM(attachment_id IS NOT NULL),0) a FROM direct_messages WHERE ((from_id=? AND to_id=?) OR (from_id=? AND to_id=?)) AND created_at>=?',helper,client,client,helper,since);
      const prevDisputes=who=>c.get("SELECT COUNT(*) n FROM agreements WHERE disputed_at IS NOT NULL AND id!=? AND (a_id=? OR b_id=?)",g.id,who,who).n;
      const hist=c.get("SELECT COUNT(*) n FROM agreements WHERE status='completed' AND (a_id=? OR b_id=?)",helper,helper).n;
      const rating=c.get('SELECT ROUND(AVG(stars),1) a,COUNT(*) n FROM ratings WHERE ratee_id=? AND hidden=0',helper);
      const facts=[`المبلغ ${g.amount} ريال`,g.paid_at?`مدفوع عبر ${g.paid_via==='cash'?'الكاش':'بوابة الدفع'}`:'غير مدفوع بعد',g.completion_requested_at?`طلب المساعد تأكيد الإنجاز منذ ${daysSince(g.completion_requested_at)} يوم`:'لم يطلب المساعد تأكيد الإنجاز',
        `${msgs.n} رسالة بين الطرفين و${msgs.a} مرفق منذ الاتفاق`,`المساعد: ${hist} طلب مكتمل${rating.n?`، تقييم ${rating.a} من ${rating.n}`:''}`,`نزاعات سابقة: العميل ${prevDisputes(client)}، المساعد ${prevDisputes(helper)}`];
      const hint=!g.completion_requested_at?'اتجاه مبدئي: الإنجاز لم يُطلب قبل الاعتراض، فيميل الميزان إلى «لم يثبت الإنجاز» ما لم يظهر دليل آخر.':msgs.a>0?'اتجاه مبدئي: توجد مرفقات بعد الاتفاق، راجعها كأدلة قبل الحسم.':'لا يوجد اتجاه مبدئي: الأدلة غير كافية، اطلب من الطرفين إثباتات.';
      c.raise({kind:'dispute_brief',severity:'medium',subject_type:'agreement',subject_id:g.id,title:`ملخص نزاع الطلب #${g.id}`,reason:hint+' القرار النهائي لمسؤولَين اثنين وفق سياسة النزاعات.',evidence:{facts,disputed_at:g.disputed_at},dedupe:'dispbrief:'+g.id+':'+g.disputed_at});
      if(msgs.a===0)for(const u of [client,helper])c.act('send_notice',{user_id:u,text:`الإدارة تراجع الاعتراض على الطلب رقم ${g.id}. يرجى إرفاق ما لديك من صور أو أدلة داخل المحادثة لنتمكن من البت.`,link:'#/direct/'+(u===client?helper:client)},{key:'disp-info:'+g.id+':'+u,cooldownDays:3,reason:'طلب أدلة ناقصة',refs:'agreement:'+g.id});
      const d=daysSince(g.disputed_at);
      if(!g.dispute_decision&&d>=c.params.warn_days)c.raise({kind:'dispute_sla',severity:'high',subject_type:'agreement',subject_id:g.id,title:`نزاع #${g.id} يقترب من مهلة البت (${d} أيام)`,reason:'مهلة القرار الأولي 6 أيام عمل. بادر بالحسم لتجنب التأخير.',evidence:{days:d},dedupe:'dispsla:'+g.id+':'+g.disputed_at});
    }}},

  profile_nudge:{title:'تذكير المساعدين بإكمال ملفاتهم',interval:1440,params:{max_per_run:25,min_age_days:2},run(c){
    const rows=c.all(`SELECT u.id,u.bio,u.email_verified,
      EXISTS(SELECT 1 FROM user_sections s WHERE s.user_id=u.id) has_sec,
      EXISTS(SELECT 1 FROM helper_extra e WHERE e.user_id=u.id AND e.kind='iban') has_iban
      FROM users u WHERE u.account_type='helper' AND u.active=1 AND u.created_at<datetime('now',?) ORDER BY u.id LIMIT 500`,'-'+c.params.min_age_days+' days');
    let n=0;
    for(const u of rows){
      const miss=[];if(!u.email_verified)miss.push('تفعيل البريد');if(!u.has_sec)miss.push('اختيار قسم الخدمة');if(!String(u.bio||'').trim())miss.push('نبذة عنك');if(!u.has_iban)miss.push('الآيبان');
      if(!miss.length)continue;if(n>=c.params.max_per_run)break;
      const r=c.act('send_notice',{user_id:u.id,text:'أكمل ملفك لتظهر أمام طالبي المساعدة: '+miss.join('، '),link:'#/profile'},{key:'profile:'+u.id,cooldownDays:7,reason:'ملف ناقص: '+miss.join('، '),refs:'user:'+u.id});
      if(r.done||r.simulated||r.proposed)n++;
    }}},

  doc_format:{title:'فحص صيغة المستندات والأرقام',interval:360,params:{},run(c){
    const bad=(kind,v)=>{v=String(v||'').replace(/\s/g,'');return kind==='vat'?!/^3\d{13}3$/.test(v):kind==='cr'?!/^\d{10}$/.test(v):false};
    for(const d of c.all("SELECT user_id,kind,number FROM helper_docs WHERE kind IN ('vat','cr') LIMIT 1000"))if(bad(d.kind,d.number))
      c.raise({kind:'doc_format',severity:'low',subject_type:'user',subject_id:d.user_id,title:d.kind==='vat'?'صيغة الرقم الضريبي غير مطابقة':'صيغة السجل التجاري غير مطابقة',reason:d.kind==='vat'?'الرقم الضريبي السعودي 15 رقمًا يبدأ بـ3 وينتهي بـ3.':'السجل التجاري 10 أرقام.',evidence:{user_id:d.user_id,kind:d.kind},dedupe:'doc:'+d.user_id+':'+d.kind+':'+h12(d.number)});
    for(const u of c.all("SELECT id,vat_number FROM users WHERE vat_status='registered' AND vat_number IS NOT NULL AND vat_number!='' LIMIT 1000"))if(bad('vat',u.vat_number))
      c.raise({kind:'doc_format',severity:'low',subject_type:'user',subject_id:u.id,title:'صيغة الرقم الضريبي المُدخل غير مطابقة',reason:'الرقم الضريبي السعودي 15 رقمًا يبدأ بـ3 وينتهي بـ3.',evidence:{user_id:u.id},dedupe:'vatnum:'+u.id+':'+h12(u.vat_number)});
  }}
};
