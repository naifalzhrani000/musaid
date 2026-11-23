import {route, all, get, run, err, adm, audit} from '../core.js';

// أكواد الخصم: ينشئها المشرف ويحدد عددها ونسبتها. تطبيقها على السعر النهائي لم يُربط بعد.
route('GET','/admin/discounts',c=>{adm(c);return all('SELECT id,code,percent,max_uses,used,active,created_at FROM discount_codes ORDER BY id DESC')});

route('POST','/admin/discounts',c=>{const a=adm(c);const code=String(c.b.code||'').trim().toUpperCase();
if(!/^[A-Z0-9]{4,20}$/.test(code))throw err(400,'الكود من 4 إلى 20 حرفًا إنجليزيًا أو رقمًا');
const pct=Number(c.b.percent),max=Number(c.b.max_uses);
if(!Number.isInteger(pct)||pct<1||pct>100)throw err(400,'نسبة الخصم بين 1 و 100');
if(!Number.isInteger(max)||max<1||max>100000)throw err(400,'عدد مرات الاستخدام بين 1 و 100000');
if(get('SELECT 1 x FROM discount_codes WHERE code=?',code))throw err(409,'هذا الكود موجود');
run('INSERT INTO discount_codes(code,percent,max_uses) VALUES(?,?,?)',code,pct,max);
audit(a.id,'discount_create',`${code}:${pct}%:${max}`);return{ok:1}});

route('POST','/admin/discounts/(\\d+)/toggle',c=>{const a=adm(c),id=+c.p[0];const d=get('SELECT active FROM discount_codes WHERE id=?',id);
if(!d)throw err(404,'الكود غير موجود');run('UPDATE discount_codes SET active=? WHERE id=?',d.active?0:1,id);audit(a.id,'discount_toggle',String(id));return{ok:1}});
