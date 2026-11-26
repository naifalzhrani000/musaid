import {route, all, get, run, err, need, str, blocked, hitOr429} from '../core.js';

// متجر المساعد: المنتجات وإرسال بطاقة المنتج إلى الشات. لا سلة ولا فواتير ولا يمس هذا الملف الدفع أو المبالغ المستلمة.
const PRICE_MAX=100000,PRODUCTS_MAX=100;
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

const CARD_TAG='[منتج]\n';
// إرسال بطاقة منتج إلى الشات: رسالة عادية من العميل إلى المتجر، تعرضها الواجهة كبطاقة
route('POST','/shop/(\\d+)/send/(\\d+)',c=>{const u=need(c),hid=+c.p[0],pid=+c.p[1];
if(hid===u.id)throw err(400,'لا يمكنك إرسال منتج متجرك');if(!helperExists(hid))throw err(404,'المتجر غير موجود');
if(blocked(u.id,hid))throw err(403,'لا يمكن التواصل مع هذا المساعد');
const p=get('SELECT id,title,price,image_id FROM shop_products WHERE id=? AND helper_id=? AND active=1',pid,hid);
if(!p)throw err(404,'المنتج غير موجود');
hitOr429('shopcard|'+u.id,30);
run('INSERT INTO direct_messages(from_id,to_id,body) VALUES(?,?,?)',u.id,hid,CARD_TAG+JSON.stringify({t:p.title,p:money(p.price),i:p.image_id||null}));
return{ok:1}});
