import {route, all, get, need, err} from '../core.js';

// قسم «متابعة» للمساعد: أداؤه وعملاؤه وفواتيره الصادرة والواردة ومستحقات المنصة.
// للقراءة فقط، ولا يعدّل شيئًا. يرى المساعد بياناته هو فقط.
route('GET','/helper/follow',c=>{
  const u=need(c);
  const me=get('SELECT account_type FROM users WHERE id=?',u.id);
  if(me?.account_type!=='helper')throw err(403,'هذا القسم للمساعدين فقط');
  const id=u.id;

  // الفواتير السارية التي أصدرها المساعد: القيمة قبل الضريبة
  const gross=get("SELECT COALESCE(SUM(amount),0) s FROM chat_invoices WHERE helper_id=? AND status='active'",id).s;
  // عمولة المنصة على الاتفاقات التي لها فواتير سارية
  const commOnInv=get(`SELECT COALESCE(SUM(ac.amount),0) s FROM agreement_commissions ac
    WHERE ac.helper_id=? AND ac.status IN ('due','paid')
    AND ac.agreement_id IN (SELECT agreement_id FROM chat_invoices WHERE helper_id=? AND status='active')`,id,id).s;
  // مستحقات المنصة التي لم يسددها المساعد
  const debt=get("SELECT COALESCE(SUM(amount),0) s FROM agreement_commissions WHERE helper_id=? AND status='due'",id).s;
  const paid=get("SELECT COALESCE(SUM(amount),0) s FROM agreement_commissions WHERE helper_id=? AND status='paid'",id).s;

  const stats=get(`SELECT
      COUNT(*) orders,
      COALESCE(SUM(status='completed'),0) completed,
      COALESCE(SUM(status='cancelled'),0) cancelled
    FROM agreements WHERE a_id=? OR b_id=?`,id,id);
  const rate=get('SELECT ROUND(AVG(stars),2) avg,COUNT(*) n FROM ratings WHERE ratee_id=? AND hidden=0',id);

  const clients=all(`SELECT p.id,p.name,COUNT(*) orders,COALESCE(SUM(g.status='completed'),0) completed,MAX(g.created_at) last_at
    FROM (SELECT created_at,status,CASE WHEN a_id=? THEN b_id ELSE a_id END peer FROM agreements WHERE a_id=? OR b_id=?) g
    JOIN users p ON p.id=g.peer
    GROUP BY p.id ORDER BY last_at DESC LIMIT 200`,id,id,id);

  const issued=all(`SELECT ci.id,ci.number,ci.service,ci.amount,ci.total,ci.status,ci.created_at,c.name other_name
    FROM chat_invoices ci JOIN users c ON c.id=ci.client_id WHERE ci.helper_id=? ORDER BY ci.id DESC LIMIT 100`,id);
  const received=all(`SELECT ci.id,ci.number,ci.service,ci.amount,ci.total,ci.status,ci.created_at,h.name other_name
    FROM chat_invoices ci JOIN users h ON h.id=ci.helper_id WHERE ci.client_id=? ORDER BY ci.id DESC LIMIT 100`,id);

  return{
    summary:{
      gross_invoiced:gross,
      commissions_on_invoices:commOnInv,
      net_earned:Math.max(0,gross-commOnInv),
      debt,
      commissions_paid:paid,
      orders:stats.orders,completed:stats.completed,cancelled:stats.cancelled,
      rating:rate.n?rate.avg:null,rating_count:rate.n
    },
    clients,issued,received
  };
});
