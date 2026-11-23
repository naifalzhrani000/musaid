// مدير التسويق والنمو: تحليل الطلب والفجوات واقتراحات الحملات. اقتراحات فقط، لا ينفّذ شيئًا.
import {ASSIST_CITIES} from '../../data.js';
import {cityCoverage,cityOpen,SET} from '../core.js';

const week=()=>{const d=new Date(),j=Math.floor((d-new Date(d.getFullYear(),0,0))/864e5);return d.getFullYear()+'-W'+Math.ceil(j/7)};

export const rules={
  demand_gaps:{title:'الطلب غير الملبّى حسب المدينة والتخصص',interval:1440,params:{min:3,days:14},run(c){
    const rows=c.all(`SELECT f.reason,f.city,f.category_id,sc.name cat,COUNT(*) n FROM failed_searches f LEFT JOIN skill_categories sc ON sc.id=f.category_id WHERE f.at>datetime('now',?) GROUP BY f.reason,f.city,f.category_id HAVING n>=? ORDER BY n DESC LIMIT 10`,'-'+c.params.days+' days',c.params.min);
    for(const r of rows){
      if(r.reason==='no_category'||!r.category_id){
        const top=c.all("SELECT text,COUNT(*) n FROM failed_searches WHERE (reason='no_category' OR category_id IS NULL) AND at>datetime('now',?) GROUP BY text ORDER BY n DESC LIMIT 5",'-'+c.params.days+' days');
        c.raise({kind:'insight_unmapped_demand',severity:'info',title:`${r.n} عمليات بحث لا تطابق أي قسم`,reason:'أضف كلمات مفتاحية أو قسمًا جديدًا يغطي هذه الطلبات. الأكثر تكرارًا: '+top.map(t=>`«${t.text}» (${t.n})`).join('، '),evidence:{top},dedupe:'gap-unmapped:'+week()});
      }else c.raise({kind:'insight_supply_gap',severity:'info',title:`طلب على «${r.cat}»${r.city?' في '+r.city:''} بلا مساعد متاح (${r.n} مرة)`,reason:`اقتراح حملة: استقطاب مساعدي «${r.cat}»${r.city?' في '+r.city:''} عبر الإعلانات والرسائل.`,evidence:{category:r.cat,city:r.city,count:r.n},dedupe:`gap:${r.category_id}:${r.city||''}:${week()}`});
    }}},

  city_gaps:{title:'جاهزية المدن للافتتاح',interval:1440,params:{from_pct:40},run(c){
    let opened=[];try{opened=JSON.parse(SET().opened_cities||'[]')}catch{}
    for(const city of ASSIST_CITIES){
      if(opened.includes(city))continue;const cv=cityCoverage(city),pct=Math.round(cv.pct*100);if(cv.open||pct<c.params.from_pct)continue;
      const missing=c.all(`SELECT name FROM skill_categories WHERE mode!='online' AND id NOT IN (SELECT us.category_id FROM user_sections us JOIN users u ON u.id=us.user_id WHERE u.city=? AND u.account_type='helper' AND u.active=1 AND u.email_verified=1 AND u.flagged=0) ORDER BY sort LIMIT 6`,city).map(x=>x.name);
      c.raise({kind:'insight_city_close',severity:'info',title:`${city} على بعد خطوات من الافتتاح (${pct}% من 80%)`,reason:'الأقسام الناقصة: '+missing.join('، ')+'. استقطاب مساعدين فيها يفتح المدينة.',evidence:{city,pct,missing},dedupe:'citygap:'+city+':'+Math.floor(pct/10)});
    }}},

  retention:{title:'الاحتفاظ بالعملاء وأفضل المساعدين',interval:1440,params:{inactive_days:45},run(c){
    const lapsed=c.get(`SELECT COUNT(*) n FROM (SELECT CASE WHEN h.id IS NOT NULL THEN a.b_id ELSE a.a_id END client,MAX(a.completed_at) last FROM agreements a LEFT JOIN users h ON h.id=a.a_id AND h.account_type='helper' WHERE a.status='completed' GROUP BY client HAVING last<datetime('now',?))`,'-'+c.params.inactive_days+' days').n;
    if(lapsed)c.raise({kind:'insight_retention',severity:'info',title:`${lapsed} عملاء أنجزوا طلبات ثم انقطعوا ${c.params.inactive_days} يومًا`,reason:'اقتراح: رسالة عودة بعرض أو تذكير بالخدمات الأكثر طلبًا.',evidence:{lapsed},dedupe:'retention:'+week()});
    const top=c.all(`SELECT u.id,u.name,COUNT(*) n,ROUND((SELECT AVG(stars) FROM ratings r WHERE r.ratee_id=u.id AND r.hidden=0),1) rate FROM agreements a JOIN users u ON u.id IN (a.a_id,a.b_id) AND u.account_type='helper' WHERE a.status='completed' AND a.completed_at>datetime('now','-30 days') GROUP BY u.id ORDER BY n DESC LIMIT 5`);
    if(top.length)c.raise({kind:'insight_top_helpers',severity:'info',title:'أكثر المساعدين إنجازًا خلال 30 يومًا',reason:top.map(t=>`${t.name}: ${t.n} طلبات${t.rate?` (تقييم ${t.rate})`:''}`).join('، ')+'. فكّر في تكريمهم أو إبرازهم.',evidence:{top:top.map(t=>({id:t.id,n:t.n}))},dedupe:'tophelpers:'+week()});
  }}
};
