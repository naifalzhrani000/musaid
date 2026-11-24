// مدير الرقابة والحماية: اكتشاف فقط. أي إجراء على حساب يمر بالطبقة المركزية (مراقبة / موافقة / تلقائي).
import crypto from 'node:crypto';
import {normAr} from '../core.js';
import {bypassSignals,maskDigits} from './text.js';

const h12=s=>crypto.createHash('sha256').update(String(s)).digest('hex').slice(0,12);
const today=()=>new Date().toISOString().slice(0,10);
const month=()=>new Date().toISOString().slice(0,7);

export const rules={
  dup_iban:{title:'آيبان مشترك بين حسابات',interval:60,params:{},run(c){
    for(const r of c.all("SELECT number,GROUP_CONCAT(user_id) ids,COUNT(DISTINCT user_id) n FROM helper_extra WHERE kind='iban' AND number IS NOT NULL AND number!='' GROUP BY number HAVING n>1 LIMIT 50")){
      const ids=String(r.ids).split(',').map(Number).sort((a,b)=>a-b),k=h12(r.number);
      c.raise({kind:'duplicate_iban',severity:'high',subject_type:'user',subject_id:ids[0],title:'آيبان واحد مسجّل في '+ids.length+' حسابات',
        reason:'استخدام نفس الآيبان في أكثر من حساب مؤشر قوي على حسابات مكررة أو تحايل. الأقدم هو الأصل غالبًا.',evidence:{user_ids:ids,iban_last4:String(r.number).slice(-4)},dedupe:'dupiban:'+k});
      for(const id of ids.slice(1))c.act('flag_user',{user_id:id},{key:'dupiban:'+k+':'+id,reason:'آيبان مشترك مع حساب أقدم',refs:'users:'+ids.join(',')});
    }}},

  dup_accounts:{title:'حسابات مكررة محتملة',interval:360,params:{},run(c){
    const seen=new Map();
    for(const u of c.all("SELECT id,name,city FROM users WHERE role='user' ORDER BY id LIMIT 5000")){const k=normAr(u.name).replace(/\s+/g,' ')+'|'+(u.city||'');if(normAr(u.name).length<6)continue;(seen.get(k)||seen.set(k,[]).get(k)).push(u.id)}
    for(const [k,ids] of seen)if(ids.length>1)c.raise({kind:'duplicate_name',severity:'low',subject_type:'user',subject_id:ids[0],title:'اسم ومدينة متطابقان في '+ids.length+' حسابات',reason:'قد يكون تشابهًا طبيعيًا. تُراجع الحسابات يدويًا.',evidence:{user_ids:ids},dedupe:'dupname:'+h12(k)+':'+ids.length});
    for(const r of c.all("SELECT ip,ua,GROUP_CONCAT(DISTINCT user_id) ids,COUNT(DISTINCT user_id) n FROM pledges WHERE ip IS NOT NULL AND ip!='' GROUP BY ip,ua HAVING n>=3 LIMIT 50")){
      const ids=String(r.ids).split(',').map(Number);
      c.raise({kind:'shared_device',severity:'low',subject_type:'user',subject_id:ids[0],title:n3(r.n)+' حسابات من نفس الجهاز والشبكة',reason:'قد تكون شبكة مشتركة (أسرة أو مكتب). مؤشر ضعيف يُعتمد عليه مع غيره فقط.',evidence:{user_ids:ids},dedupe:'dev:'+h12(r.ip+'|'+r.ua)+':'+r.n});
    }}},

  rating_anomaly:{title:'تقييمات غير طبيعية',interval:60,params:{burst_n:5,new_acct_hours:48},run(c){
    const {burst_n,new_acct_hours}=c.params;
    for(const r of c.all("SELECT ratee_id,COUNT(*) n FROM ratings WHERE created_at>datetime('now','-1 day') AND hidden=0 GROUP BY ratee_id HAVING n>=?",burst_n))
      c.raise({kind:'rating_burst',severity:'medium',subject_type:'user',subject_id:r.ratee_id,title:r.n+' تقييمات خلال 24 ساعة لنفس المستخدم',reason:'تدفق تقييمات مفاجئ قد يدل على تقييمات مدبّرة.',evidence:{ratee_id:r.ratee_id,count:r.n},dedupe:'rburst:'+r.ratee_id+':'+today()});
    const young=c.all(`SELECT r.id,r.ratee_id FROM ratings r JOIN users u ON u.id=r.rater_id WHERE r.hidden=0 AND r.stars=5 AND r.created_at>datetime('now','-30 days') AND u.created_at>datetime(r.created_at,?) ORDER BY r.id LIMIT 500`,'-'+new_acct_hours+' hours');
    const by=new Map();for(const r of young)(by.get(r.ratee_id)||by.set(r.ratee_id,[]).get(r.ratee_id)).push(r.id);
    for(const [ratee,ids] of by)if(ids.length>=3){
      c.raise({kind:'rating_new_accounts',severity:'medium',subject_type:'user',subject_id:ratee,title:ids.length+' تقييمات 5 نجوم من حسابات حديثة جدًا',reason:'حسابات أُنشئت قبل التقييم بأقل من '+new_acct_hours+' ساعة. مؤشر على تقييمات وهمية.',evidence:{rating_ids:ids},dedupe:'rnew:'+ratee+':'+ids.length});
      for(const id of ids)c.act('hide_rating',{rating_id:id},{key:'rnew:'+id,reason:'تقييم من حساب حديث ضمن نمط مشبوه',refs:'ratee:'+ratee});
    }
    for(const r of c.all(`SELECT r.id,r.rater_id,r.ratee_id FROM ratings r JOIN pledges p1 ON p1.user_id=r.rater_id JOIN pledges p2 ON p2.user_id=r.ratee_id WHERE r.hidden=0 AND r.stars>=4 AND p1.ip IS NOT NULL AND p1.ip!='' AND p1.ip=p2.ip AND p1.ua=p2.ua AND r.created_at>datetime('now','-30 days') LIMIT 100`))
      c.raise({kind:'rating_same_device',severity:'medium',subject_type:'rating',subject_id:r.id,title:'تقييم إيجابي بين حسابين من نفس الجهاز والشبكة',reason:'المقيِّم والمقيَّم سجّلا من نفس الجهاز. قد يكون تقييمًا ذاتيًا.',evidence:{rater_id:r.rater_id,ratee_id:r.ratee_id},dedupe:'rdev:'+r.id});
  }},

  bypass_scan:{title:'محاولات تجاوز عمولة المنصة',interval:15,params:{min_score:2,batch:400},run(c){
    const {min_score,batch}=c.params;let cur=c.cursorGet('msg');
    if(!cur)cur=Math.max(0,(c.get('SELECT COALESCE(MAX(id),0) m FROM direct_messages').m)-2000);
    const rows=c.all('SELECT id,from_id,to_id,body,created_at FROM direct_messages WHERE id>? ORDER BY id LIMIT ?',cur,batch);
    const pairs=new Map();
    for(const m of rows){
      const has=!!c.get("SELECT 1 x FROM agreements WHERE ((a_id=? AND b_id=?) OR (a_id=? AND b_id=?)) AND status IN ('agreed','completion_requested','completed','disputed')",m.from_id,m.to_id,m.to_id,m.from_id);
      const s=bypassSignals(m.body,has);if(s.score<min_score)continue;
      const lo=Math.min(m.from_id,m.to_id),hi=Math.max(m.from_id,m.to_id),k=lo+'-'+hi+':'+String(m.created_at).slice(0,10);
      const p=pairs.get(k)||{lo,hi,day:String(m.created_at).slice(0,10),ids:[],why:new Set(),score:0,from:m.from_id,ex:maskDigits(m.body.slice(0,100)),has};
      p.ids.push(m.id);s.why.forEach(w=>p.why.add(w));p.score=Math.max(p.score,s.score);pairs.set(k,p);
    }
    for(const [k,p] of pairs){
      c.raise({kind:'commission_bypass',severity:p.score>=4?'high':'medium',subject_type:'user',subject_id:p.from,title:'مؤشرات تعامل خارج المنصة في محادثة',
        reason:'رُصدت: '+[...p.why].join('، ')+(p.has?'':' ولا يوجد اتفاق قائم بين الطرفين.'),evidence:{users:[p.lo,p.hi],message_ids:p.ids.slice(0,10),excerpt:p.ex,day:p.day},dedupe:'bypass:'+k});
      c.act('send_notice',{user_id:p.from,text:'تذكير: الاتفاق والدفع يتمان عبر المنصة لحمايتك وحماية حقوقك وفق شروط الاستخدام.',link:'#/terms'},{key:'bypass:'+p.lo+'-'+p.hi,cooldownDays:14,reason:'مؤشرات تعامل خارج المنصة',refs:'messages:'+p.ids.slice(0,5).join(',')});
    }
    if(rows.length)c.cursorSet('msg',rows[rows.length-1].id);
  }},

  cancel_pattern:{title:'نمط إلغاء متكرر',interval:360,params:{n30:6},run(c){
    for(const r of c.all("SELECT by_id,COUNT(*) n FROM agreement_cancellations WHERE created_at>datetime('now','-30 days') GROUP BY by_id HAVING n>=? LIMIT 100",c.params.n30))
      c.raise({kind:'cancel_pattern',severity:r.n>=10?'medium':'low',subject_type:'user',subject_id:r.by_id,title:r.n+' إلغاءات خلال 30 يومًا',reason:'تكرار الإلغاء يضر بالطرف الآخر. نظام الإغلاق التلقائي الحالي يتدخل عند 15 إلغاءً أسبوعيًا أو 5 متتالية.',evidence:{user_id:r.by_id,count:r.n},dedupe:'cancel:'+r.by_id+':'+month()});
  }}
};
const n3=n=>n;
