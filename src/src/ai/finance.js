// المدير المالي: قراءة ومطابقة فقط. لا يستدعي أي أداة، ولا يكتب في جداول المال أبدًا.
// الأرقام تُحسب بقاعدة ثابتة (العمولة = السعر × نسبة المنصة)، وإشعار بوابة الدفع هو مصدر الحقيقة للدفع.
import {COMMISSION_PCT,SET} from '../core.js';

const week=()=>{const d=new Date(),j=Math.floor((d-new Date(d.getFullYear(),0,0))/864e5);return d.getFullYear()+'-W'+Math.ceil(j/7)};
export const expectedCommission=amount=>Math.round(Number(amount)*COMMISSION_PCT)/100;

export const rules={
  commission_recon:{title:'مطابقة العمولات مع الطلبات المدفوعة',interval:60,params:{},run(c){
    for(const g of c.all("SELECT g.id,g.amount FROM agreements g LEFT JOIN agreement_commissions ac ON ac.agreement_id=g.id WHERE g.paid_at IS NOT NULL AND ac.id IS NULL AND g.status!='cancelled' LIMIT 100"))
      c.raise({kind:'missing_commission',severity:'high',subject_type:'agreement',subject_id:g.id,title:`طلب مدفوع #${g.id} بلا سجل عمولة`,reason:`المتوقع ${expectedCommission(g.amount)} ريال (${COMMISSION_PCT}% من ${g.amount}).`,evidence:{agreement_id:g.id,expected:expectedCommission(g.amount)},dedupe:'miscomm:'+g.id});
    for(const r of c.all("SELECT ac.agreement_id id,ac.amount got,g.amount base,ac.status FROM agreement_commissions ac JOIN agreements g ON g.id=ac.agreement_id WHERE ac.amount>0 AND ac.status!='void' LIMIT 5000")){
      const exp=expectedCommission(r.base);
      if(Math.abs(r.got-exp)>0.011)c.raise({kind:'commission_mismatch',severity:'high',subject_type:'agreement',subject_id:r.id,title:`عمولة الطلب #${r.id} لا تطابق القاعدة`,reason:`المسجّل ${r.got} ريال والمتوقع ${exp} ريال. راجع سبب الفرق قبل أي تسوية.`,evidence:{agreement_id:r.id,recorded:r.got,expected:exp},dedupe:'commdiff:'+r.id+':'+r.got});
    }
    for(const g of c.all("SELECT id FROM agreements WHERE paid_via='hala' AND paid_at IS NOT NULL AND (payment_ref IS NULL OR payment_ref='') LIMIT 100"))
      c.raise({kind:'payment_no_ref',severity:'medium',subject_type:'agreement',subject_id:g.id,title:`دفع عبر البوابة بلا مرجع (#${g.id})`,reason:'سُجّل الدفع دون رقم مرجعي من البوابة: تحقق من إشعار البوابة.',evidence:{agreement_id:g.id},dedupe:'noref:'+g.id});
    for(const g of c.all("SELECT id,amount,total_amount FROM agreements WHERE total_amount IS NOT NULL AND total_amount<amount LIMIT 100"))
      c.raise({kind:'total_below_amount',severity:'high',subject_type:'agreement',subject_id:g.id,title:`إجمالي الطلب #${g.id} أقل من سعره`,reason:`الإجمالي ${g.total_amount} أقل من السعر ${g.amount}.`,evidence:{agreement_id:g.id},dedupe:'totlow:'+g.id});
  }},

  dues_aging:{title:'تقادم العمولات المستحقة',interval:1440,params:{days:14},run(c){
    for(const r of c.all("SELECT helper_id h,COUNT(*) n,ROUND(SUM(amount),2) s,MIN(created_at) oldest FROM agreement_commissions WHERE status='due' AND created_at<datetime('now',?) GROUP BY helper_id LIMIT 200",'-'+c.params.days+' days'))
      c.raise({kind:'dues_aging',severity:'medium',subject_type:'user',subject_id:r.h,title:`${r.n} عمولات مستحقة متأخرة (${r.s} ريال)`,reason:`أقدمها بتاريخ ${String(r.oldest).slice(0,10)}. تابع السداد أو أصدر فاتورة المنصة.`,evidence:{helper_id:r.h,count:r.n,total:r.s},dedupe:'dues:'+r.h+':'+week()+':'+r.n});
  }},

  refunds_pending:{title:'استردادات لم تُسوَّ',interval:360,params:{days:7},run(c){
    for(const r of c.all("SELECT id,agreement_id,amount FROM agreement_commissions WHERE status='refund_due' AND created_at<datetime('now',?) LIMIT 100",'-'+c.params.days+' days'))
      c.raise({kind:'refund_pending',severity:'high',subject_type:'agreement',subject_id:r.agreement_id,title:`استرداد عمولة معلّق للطلب #${r.agreement_id}`,reason:`${r.amount} ريال مستحقة للاسترداد منذ أكثر من ${c.params.days} أيام. التسوية يدوية من الإدارة.`,evidence:{commission_id:r.id},dedupe:'refund:'+r.id});
  }},

  vat_threshold:{title:'اقتراب حد التسجيل في ضريبة القيمة المضافة',interval:1440,params:{warn_pct:80},run(c){
    if(SET().platform_vat_registered==='1')return;
    const sum=c.all("SELECT amount FROM agreements WHERE paid_at IS NOT NULL AND paid_at>=datetime('now','-365 days')").reduce((s,a)=>s+expectedCommission(a.amount),0),pct=Math.round(sum/375000*1000)/10;
    if(pct>=c.params.warn_pct)c.raise({kind:'vat_threshold',severity:pct>=95?'high':'medium',title:`توريدات المنصة ${pct}% من حد التسجيل (375,000 ريال)`,reason:'عند بلوغ الحد تُفعَّل الضريبة تلقائيًا. استعد محاسبيًا.',evidence:{turnover:Math.round(sum*100)/100},dedupe:'vat:'+Math.floor(pct/5)});
  }}
};
