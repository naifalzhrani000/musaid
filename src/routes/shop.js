import {route, all, get, run, err, tx, need, str, notify, blocked, hitOr429} from '../core.js';

// متجر المساعد: المنتجات والسلة والفاتورة التعريفية. لا يمس هذا الملف الدفع أو المبالغ المستلمة.
const PRICE_MAX=100000,PRODUCTS_MAX=100;
const INVOICE_TAG='[فاتورة المتجر]\n';
const isHelper=u=>!!u&&u.account_type==='helper';
const helperExists=id=>!!get("SELECT 1 x FROM users WHERE id=? AND active=1 AND account_type='helper'",id);
const money=n=>Math.round(Number(n)*100)/100;

route('GET','/shop/(\\d+)',c=>{const hid=+c.p[0];if(!helperExists(hid))throw err(404,'المتجر غير موجود');
return{products:all('SELECT id,title,description,price,image_id FROM shop_products WHERE helper_id=? AND active=1 ORDER BY id DESC',hid)}});

route('POST','/shop/products',c=>{const u=need(c);if(!isHelper(u))throw err(403,'المتجر للمساعدين فقط');
if(get('SELECT COUNT(*) n FROM shop_products WHERE helper_id=? AND active=1',u.id).n>=PRODUCTS_MAX)throw err(400,`وصلت للحد الأقصى من المنتجات (${PRODUCTS_MAX})`);
const title=str(c.b.title,2,80,'اسم المنتج'),description=String(c.b.description||'').trim().slice(0,500);
const price=money(c.b.price);if(!Number.isFinite(price)||price<=0||price>PRICE_MAX)throw err(400,'أدخل سعرًا صحيحًا بين 1 و 100000 ريال');
const imageId=c.b.attachment_id?+c.b.attachment_id:null;if(imageId&&!get("SELECT 1 x FROM attachments WHERE id=? AND user_id=? AND mime LIKE 'image/%'",imageId,u.id))throw err(400,'الصورة غير صالحة');
const id=Number(run('INSERT INTO shop_products(helper_id,title,description,price,image_id) VALUES(?,?,?,?,?)',u.id,title,description,price,imageId).lastInsertRowid);
return{id}});

route('POST','/shop/products/(\\d+)/delete',c=>{const u=need(c),id=+c.p[0];const p=get('SELECT helper_id FROM shop_products WHERE id=? AND active=1',id);
if(!p)throw err(404,'المنتج غير موجود');if(p.helper_id!==u.id)throw err(403,'غير مسموح');
run('UPDATE shop_products SET active=0 WHERE id=?',id);return{ok:1}});

route('GET','/shop/(\\d+)/cart',c=>{const u=need(c),hid=+c.p[0];
return all('SELECT sc.product_id id,sc.qty,p.title,p.price FROM shop_cart sc JOIN shop_products p ON p.id=sc.product_id WHERE sc.user_id=? AND p.helper_id=? AND p.active=1 ORDER BY sc.product_id',u.id,hid)});

route('POST','/shop/(\\d+)/cart/(\\d+)',c=>{const u=need(c),hid=+c.p[0],pid=+c.p[1];
const p=get('SELECT helper_id FROM shop_products WHERE id=? AND active=1',pid);if(!p||p.helper_id!==hid)throw err(404,'المنتج غير موجود');
if(hid===u.id)throw err(400,'لا يمكنك الشراء من متجرك');if(blocked(u.id,hid))throw err(403,'لا يمكن التواصل مع هذا المساعد');
run('INSERT INTO shop_cart(user_id,product_id,qty) VALUES(?,?,1) ON CONFLICT(user_id,product_id) DO UPDATE SET qty=MIN(qty+1,99)',u.id,pid);
return{ok:1}});

route('POST','/shop/(\\d+)/cart/(\\d+)/remove',c=>{const u=need(c),pid=+c.p[1];run('DELETE FROM shop_cart WHERE user_id=? AND product_id=?',u.id,pid);return{ok:1}});

route('POST','/shop/(\\d+)/checkout',c=>tx(()=>{const u=need(c),hid=+c.p[0];
if(hid===u.id)throw err(400,'غير صالح');if(!helperExists(hid))throw err(404,'المتجر غير موجود');if(blocked(u.id,hid))throw err(403,'لا يمكن التواصل مع هذا المساعد');
hitOr429('shopco|'+u.id,20);
const items=all('SELECT p.title,p.price,sc.qty,p.image_id FROM shop_cart sc JOIN shop_products p ON p.id=sc.product_id WHERE sc.user_id=? AND p.helper_id=? AND p.active=1',u.id,hid);
if(!items.length)throw err(400,'السلة فارغة');
const total=money(items.reduce((s,i)=>s+i.price*i.qty,0));
// يعرضها الشات كرت بجدول: علامة ثم JSON من الخادم فقط (t الاسم، p السعر، q الكمية، i رقم الصورة)
const body=INVOICE_TAG+JSON.stringify({items:items.map(i=>({t:i.title,p:money(i.price),q:i.qty,i:i.image_id||null})),total});
run('INSERT INTO direct_messages(from_id,to_id,body) VALUES(?,?,?)',u.id,hid,body);
run('DELETE FROM shop_cart WHERE user_id=? AND product_id IN (SELECT id FROM shop_products WHERE helper_id=?)',u.id,hid);
notify(hid,`طلب جديد من متجرك بقيمة تقديرية ${total} ريال`,`#/direct/${u.id}`);
return{ok:1,total}}));
