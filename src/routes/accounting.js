import {route, all, get, err, can} from '../core.js';

const VAT_RATE=0.15;
const monthOk=m=>/^\d{4}-\d{2}$/.test(m||'');
const needMonth=c=>{const m=String(c.q?.month||'');if(!monthOk(m))throw err(400,'الشهر غير صالح (YYYY-MM)');return m};
const vatRegistered=()=>{const r=get("SELECT value FROM settings WHERE key='platform_vat_registered'");return !!(r&&r.value==='1')};

// قيود اليومية للشهر: عمولات مدفوعة (وارد) ومصروفات (صادر)
const journal=m=>[
  ...all(`SELECT COALESCE(paid_at,created_at) at,'وارد' type,'عمولة مؤكدة - اتفاق #'||agreement_id ref,'عمولة' description,amount,status
          FROM agreement_commissions WHERE status='paid' AND substr(COALESCE(paid_at,created_at),1,7)=?`,m),
  ...all(`SELECT created_at at,'صادر' type,'مصروف #'||id ref,title||COALESCE(' - '||category,'') description,amount,'paid' status
          FROM expenses WHERE substr(created_at,1,7)=?`,m),
].sort((a,b)=>String(a.at).localeCompare(String(b.at)));

const summary=m=>{
  const income=get(`SELECT COALESCE(SUM(amount),0) s FROM agreement_commissions WHERE status='paid' AND substr(COALESCE(paid_at,created_at),1,7)=?`,m).s;
  const expenses=get(`SELECT COALESCE(SUM(amount),0) s FROM expenses WHERE substr(created_at,1,7)=?`,m).s;
  const inv=get(`SELECT COUNT(*) n,COALESCE(SUM(total),0) t FROM invoices WHERE substr(issued_at,1,7)=?`,m);
  const payables=get(`SELECT COALESCE(SUM(amount),0) s FROM agreement_commissions WHERE status='due'`).s;
  return{income,expenses,invoices:inv.n,invoices_total:inv.t,payables};
};

route('GET','/admin/accounting',c=>{
  can(c,'accounting');
  const m=needMonth(c), s=summary(m), rows=journal(m);
  const jIncome=rows.filter(r=>r.type==='وارد').reduce((a,r)=>a+Number(r.amount),0);
  const jExp=rows.filter(r=>r.type==='صادر').reduce((a,r)=>a+Number(r.amount),0);
  const reconciled=Math.abs(jIncome-s.income)<0.005&&Math.abs(jExp-s.expenses)<0.005;
  const reg=vatRegistered();
  return{month:m,income:s.income,expenses:s.expenses,profit:s.income-s.expenses,
    vat:reg?s.income*VAT_RATE:0,
    vat_note:reg?'تقدير: 15% من العمولة المدفوعة، وتُحصّل من العميل فوق السعر':'المنصة غير مسجلة في ضريبة القيمة المضافة',
    invoices:s.invoices,invoices_total:s.invoices_total,payables:s.payables,
    entries:rows.length,reconciled};
});

const csvCell=v=>{const t=v===null||v===undefined?'':String(v);return /[",\n]/.test(t)?`"${t.replace(/"/g,'""')}"`:t};
const toCsv=(head,rows)=>'\ufeff'+[head,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n');

route('GET','/admin/accounting/export',c=>{
  can(c,'accounting');
  const m=needMonth(c), type=String(c.q?.type||'');
  let csv;
  if(type==='journal'){
    csv=toCsv(['التاريخ','النوع','المرجع','البيان','المبلغ (ريال)','الحالة'],
      journal(m).map(r=>[r.at,r.type,r.ref,r.description,r.amount,r.status]));
  }else if(type==='invoices'){
    csv=toCsv(['رقم الفاتورة','النوع','المرجع','اسم المشتري','الرقم الضريبي للمشتري','المجموع قبل الضريبة','نسبة الضريبة','مبلغ الضريبة','الإجمالي','تاريخ الإصدار','الحالة'],
      all(`SELECT seq,kind,ref,buyer_name,buyer_vat,subtotal,vat_rate,vat_amount,total,issued_at,status FROM invoices WHERE substr(issued_at,1,7)=? ORDER BY seq`,m)
        .map(r=>[r.seq,r.kind,r.ref,r.buyer_name,r.buyer_vat,r.subtotal,r.vat_rate,r.vat_amount,r.total,r.issued_at,r.status]));
  }else if(type==='commissions'){
    csv=toCsv(['رقم القيد','رقم الاتفاق','المساعد','المبلغ (ريال)','الحالة','تاريخ الإنشاء','تاريخ السداد'],
      all(`SELECT ac.id,ac.agreement_id,u.name helper,ac.amount,ac.status,ac.created_at,ac.paid_at
           FROM agreement_commissions ac JOIN users u ON u.id=ac.helper_id
           WHERE substr(COALESCE(ac.paid_at,ac.created_at),1,7)=? ORDER BY ac.id`,m)
        .map(r=>[r.id,r.agreement_id,r.helper,r.amount,r.status,r.created_at,r.paid_at]));
  }else throw err(400,'نوع التصدير غير صالح');
  return{raw:Buffer.from(csv,'utf8'),mime:'text/csv; charset=utf-8'};
});
