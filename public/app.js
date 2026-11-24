document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-act]');if(!t)return;e.preventDefault();const f={logout:()=>logout(),exportData:()=>exportData(),installApp:()=>installApp(),toggleAllNotify:()=>toggleAllNotify(),testPush:()=>testPush()}[t.dataset.act];if(f)f()});
const $=s=>document.querySelector(s),app=$('#app');let me={user:null};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=async(p,m='GET',b)=>{const r=await fetch('/api'+p,{method:m,headers:{'content-type':'application/json'},body:b?JSON.stringify(b):undefined});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'حدث خطأ');return j};
const toast=(m,e)=>{const t=document.createElement('div');t.className='toast'+(e?' err':'');t.textContent=m;document.body.append(t);setTimeout(()=>t.remove(),3500)};
const sub=f=>async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target));e.target.querySelectorAll('[type=checkbox]').forEach(c=>b[c.name]=c.checked);try{await f(b,e.target)}catch(x){toast(x.message,1)}};
const ST={draft:'مسودة',published:'منشور',negotiating:'جارٍ الاتفاق',helper_chosen:'تم اختيار مساعد',in_progress:'قيد التنفيذ',completed:'مكتمل',cancelled:'ملغي',disputed:'متنازع عليه'};
const stat=s=>`<span class="pill s-${s}">${ST[s]||s}</span>`;
const price=r=>r.budget!=null&&r.budget!==''?r.budget+' ر.س'+(r.negotiable?' (قابل للتفاوض)':''):'السعر بالاتفاق';
const ic=(p,c='')=>`<svg class="ic ${c}" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const I={chev:'<path d="M9 6l6 6-6 6"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',filter:'<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',pin:'<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',clip:'<path d="M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/>',menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',more:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>'};
const CATS={'أخرى':'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'};
const pr=r=>r.budget!=null&&r.budget!==''?r.budget+' ريال':'بالاتفاق';
const card=r=>`<article class=card><div class=thumb>${r.image_id?`<img loading=lazy decoding=async src=/api/files/${r.image_id} alt="">`:`<span class=thumb-ic>${ic(CATS[r.category]||CATS['أخرى'],'big')}</span>`}${r.category?`<span class=tag>${esc(r.category)}</span>`:''}</div><div class=cb><div class=row>${stat(r.status)}<small>${new Date(r.created_at.replace(' ','T')+'Z').toLocaleDateString('ar-SA-u-ca-gregory')}</small></div><h3>${esc(r.title)}</h3><p>${esc(r.description)}</p><div class=meta-l>${r.city?`<span>${ic(I.pin)} ${esc(r.city)}</span>`:''}<span>${r.offers} عروض</span></div><div class=cf><span class=who><i class=av>${esc([...r.owner][0])}</i>${esc(r.owner)}</span><span class=price>${pr(r)}</span></div><a class="btn full" href="#/r/${r.id}">عرض التفاصيل</a></div></article>`;
function renderBottom(){const bn=$('#bn');if(bn)bn.innerHTML=''}
async function exportData(){try{const d=await api('/me/export');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:'application/json'}));a.download='my-data.json';document.body.append(a);a.click();a.remove();toast('تم تجهيز ملف بياناتك')}catch(x){toast(x.message,1)}}
function menuBtns(o){document.querySelectorAll('#mb,#hmb,#hav,#pfMenu').forEach(b=>b.setAttribute('aria-expanded',String(o)))}
function toggleMenu(){const m=$('#menu');m.hidden=!m.hidden;menuBtns(!m.hidden)}
function closeMenu(){const m=$('#menu');if(m){m.hidden=true;menuBtns(false)}}
document.addEventListener('click',e=>{const pt=e.target.closest&&e.target.closest('[data-ptab]');if(pt){const k=pt.dataset.ptab;document.querySelectorAll('.pv-tabs [data-ptab]').forEach(b=>b.classList.toggle('on',b.dataset.ptab===k));document.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==k);return}if(e.target.closest('#mb,#hmb,#hav,#pfMenu')){toggleMenu();return}if(e.target.closest('#menu a')||!e.target.closest('#menu'))closeMenu()});

function nav(){const u=me.user,h=location.hash||'#/',a=(l,t)=>`<a href="${l}" class="${h===l?'on':''}">${t}</a>`;const isHome=h==='#/'||h==='#'||h==='';
$('#nav').innerHTML=`<a class=logo href="#/"><span class=mark><img loading=lazy decoding=async src=/hand.png alt=""></span>المساعد</a>${isHome?(u?`<a class=home-av id=hav-profile href="#/profile" aria-label="ملفي الشخصي">${esc((me.user.name||'؟').trim().charAt(0))}</a>`:`<button class=home-av id=hav type=button aria-label="القائمة">؟</button>`):''}<div class=hact>${u?`<a class=bell href="#/notifs" aria-label="الإشعارات">${ic(I.bell)}${me.unread?`<i class=cnt>${me.unread>99?'99+':me.unread}</i>`:''}</a>`:'<a class=hlogin href="#/login">تسجيل الدخول</a>'}<button id=mb aria-label="القائمة">${ic(I.menu)}</button></div>`;
$('#nav').prepend($('#mb'));
$('#menu').innerHTML=a('#/','المساعد الذكي')+(u?a('#/profile/data','بيانات الحساب'):'')+(isStandalone()?'':'<a href="#" data-act=installApp>تثبيت التطبيق</a>')+(u&&u.account_type==='helper'?a('#/follow','متابعة'):'')+(u?a('#/chats','محادثاتي')+a(u&&u.account_type==='helper'?'#/profile':'#/profile/data',u&&u.account_type==='helper'?'متجري':'بيانات الحساب')+`<a href="#" data-act=toggleAllNotify>${allNotifyOn()?'إيقاف كل الإشعارات':'تفعيل كل الإشعارات'}</a>`+(['admin','staff'].includes(u.role)?a('#/manage','الإدارة'):''):'')+(u?'<a href="#/settings">الإعدادات</a>'+''+'<a href="#" data-act="logout">تسجيل الخروج</a>':'')+'<div class=menu-legal>'+(u&&u.account_type==='helper'?a('#/profile/bio','النبذة'):'')+a('#/faq','الأسئلة الشائعة')+a('#/complaints','سياسة الشكاوى')+a('#/about','من نحن')+a('#/contact','تواصل معنا')+a('#/terms','الشروط والأحكام')+a('#/privacy','سياسة الخصوصية')+'</div>';
try{if(me.user&&navigator.setAppBadge){me.unread?navigator.setAppBadge(me.unread):navigator.clearAppBadge()}}catch{}
renderBottom(h);$('#menu').onclick=e=>{if(e.target.tagName==='A')closeMenu()}}
async function insights(){location.hash='#/manage/insights'}
async function drawInsights(){$('#mgBody').innerHTML=`<section class=panel><div class=sec-h><h3>تحليل الطلب</h3></div><div class=seg id=idays><button data-d=7>7 أيام</button><button data-d=30>30 يومًا</button><button data-d=0>الكل</button></div><div class=seg id=itabs><button data-t=demand>الأكثر طلبًا</button><button data-t=gap>الفجوة</button><button data-t=failed>بحث بلا نتيجة</button></div><div id=ibody></div></section>`;
const st={d:30,t:'demand'};const tbl=(h,rows)=>`<div class=tbl-wrap><table class=tbl><tr>${h.map(x=>`<th>${esc(x)}</th>`).join('')}</tr>${rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')||`<tr><td colspan=${h.length}>لا توجد بيانات في هذه الفترة.</td></tr>`}</table></div>`;
const paint=async()=>{document.querySelectorAll('#idays button').forEach(b=>b.classList.toggle('on',+b.dataset.d===st.d));document.querySelectorAll('#itabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===st.t));
try{const r=await api('/admin/insights?days='+st.d);const note=r.total<10?`<div class=notice>عدد الطلبات في هذه الفترة ${r.total} فقط، والأرقام لا تكفي لاستنتاج واضح.</div>`:'';
let body='';if(st.t==='demand')body=tbl(['التخصص','القسم','عدد الطلبات'],r.demand.map(x=>[x.name,x.cat,x.n]));
else if(st.t==='gap')body=tbl(['التخصص','القسم','الطلبات','المساعدون المسجلون','ملاحظة'],r.gap.map(x=>[x.name,x.cat,x.n,x.helpers,x.n>=3&&x.helpers<=1?'فجوة: طلب كثير ومساعدون قليلون':'']));
else body=tbl(['العبارة','التكرار','آخر مرة'],r.failed.map(x=>[x.text,x.n,String(x.last).slice(0,10)]));
$('#ibody').innerHTML=note+body}catch(x){$('#ibody').innerHTML=`<div class=empty>${esc(x.message)}</div>`}};
document.querySelectorAll('#idays button').forEach(b=>b.onclick=()=>{st.d=+b.dataset.d;paint()});
document.querySelectorAll('#itabs button').forEach(b=>b.onclick=()=>{st.t=b.dataset.t;paint()});paint()}

async function home(){const bell=me.user?`<a class=hbtn href="#/notifs" aria-label="الإشعارات">${ic(I.bell)}${me.unread?`<i class=cnt>${me.unread>99?'99+':me.unread}</i>`:''}</a>`:'<span class=hbtn></span>',avatar=`<button class=hbtn id=hmb type=button aria-label="القائمة">${ic(I.menu)}</button>`;
app.innerHTML=`<section class=chat-wrap><div class=chat-top><div class=ctitle><img loading=lazy decoding=async class=ctl-logo src=/hand.png alt=""><div><b>منصة المساعد</b><small>خدمتك تبدأ من هنا</small></div></div><div class=ctl-actions>${bell}${avatar}</div></div><div id=hero class=home-hero><span class=hero-mark role=img aria-label="المساعد"></span><h1>من تحتاج اليوم؟</h1><p>اكتب طلبك وسنجد لك مساعدًا مسجلًا في المنصة</p><div class=chips><div class=chips-row><button type=button class=chip data-ask="أبي سباك يصلح تسريب مياه"><span class=chip-ic>🔧</span><span>أبي سباك يصلح تسريب مياه</span></button><button type=button class=chip data-ask="أبي تركيب سخان مياه"><span class=chip-ic>🚿</span><span>أبي تركيب سخان مياه</span></button></div><div class=chips-row><button type=button class=chip data-ask="أبي كهربائي يصلح قاطع"><span class=chip-ic>⚡</span><span>أبي كهربائي يصلح قاطع</span></button><button type=button class=chip data-ask="أبي تمديد إنارة"><span class=chip-ic>💡</span><span>أبي تمديد إنارة</span></button></div></div></div><div id=msgs class=chat-msgs aria-live=polite></div><form id=cf class=chat-in><input name=m maxlength=500 required placeholder="ماذا تحتاج؟" aria-label="اكتب رسالتك"><button class=send aria-label="إرسال"><svg class=ic viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg></button></form></section>`;
const msgs=$('#msgs'),now=()=>new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
const bot=(html)=>{const r=document.createElement('div');r.className='brow';r.innerHTML=`<img loading=lazy decoding=async class=bav src=/hand.png alt=""><div class=bcol><div class="bub b">${html}</div><small class=btime>${now()}</small></div>`;msgs.append(r);msgs.scrollTop=msgs.scrollHeight;return r};
const user=(text)=>{const r=document.createElement('div');r.className='urow';r.innerHTML=`<div class=bcol><div class="bub u">${esc(text)}</div><small class=btime>${now()}</small></div>`;msgs.append(r);msgs.scrollTop=msgs.scrollHeight};

const ask=async text=>{document.querySelectorAll('.svc-pick,.trust-pts,#hero').forEach(x=>x.style.display='none');user(text);const w=bot('<span class=wait>جاري البحث عن المتاحين في المنصة</span><span class=typing><span></span><span></span><span></span></span>');
try{const r=await api('/assistant','POST',{message:text});w.remove();
bot(esc(r.reply)+(r.needLogin?'<div class=row style="margin-top:8px"><a class=btn href="#/login">سجّل دخولك</a></div>':''));
if(r.providers&&r.providers.length){const card=document.createElement('div');card.className='urow';card.innerHTML=`<div class=sumcard><div class=grow><b>لقد وجدت لك ${r.providers.length} مساعدًا مسجلًا في المنصة</b><small>يمكنك مراجعة ملفاتهم والتواصل معهم عبر طلب، أو العودة للمحادثة لمزيد من التفاصيل.</small></div>${ic(I.user)}</div>`;msgs.append(card);
r.providers.forEach(p=>bot(`<div class=pwrap><a class=pcard href="#/p/${p.id}"><span class=pcard-av aria-hidden=true>${avHtml(p.avatar,p.name)}</span><div class=grow><b>${esc(p.name)}</b><small>${esc(p.city||'')}${p.done?` · أنجز ${p.done} مهمة`:' · جديد'}</small><div class=pstats><span class=pstat>${p.rcount?`★ ${esc(p.avg)} <em>(${p.rcount} تقييم)</em>`:'<em>لا توجد تقييمات بعد</em>'}</span>${p.likes?`<span class=pstat>♥ ${p.likes} إعجاب</span>`:''}</div></div>${ic(I.chev)}</a><a class="btn alt" href="#/direct/${p.id}">محادثة</a></div>`))}
if(r.noMatch){if(r.sections&&r.sections.length){const b=bot('<div>لم نجد الخدمة بالضبط، اختر التخصص الأقرب لطلبك:</div><form class=sec-pick style="display:grid;gap:8px;margin-top:8px"><select name=sec required style="padding:10px;border-radius:10px;border:1px solid #d9d5e8;font:inherit"><option value="">اختر التخصص</option>'+r.sections.map(x=>`<option value="${esc(x.name)}">${esc(x.name)}</option>`).join('')+'</select><button class=btn>بحث</button></form>');const f=b.querySelector('.sec-pick');f.onsubmit=e=>{e.preventDefault();const v=f.sec.value;if(!v)return;f.remove();ask(v)}}bot('<a class=btn href="#/profile">اقترح قسمًا لخدمتك</a>')}

msgs.scrollTop=msgs.scrollHeight}
catch(x){w.remove();bot(`<span style="color:#8a2b1c">${esc(x.message||'حدث خطأ، حاول مرة أخرى.')}</span>`)}};
$('#cf').onsubmit=e=>{e.preventDefault();const v=e.target.m.value.trim();if(v.length<3){toast('اكتب طلبك في جملة واضحة',1);return}e.target.m.value='';ask(v)};
document.querySelectorAll('.sug').forEach(b=>b.onclick=()=>ask(b.textContent));document.querySelectorAll('.svc,.chip').forEach(b=>b.onclick=()=>ask(b.dataset.ask));}
const CAT_ICO=['🚿','⚡','❄️','🪑','🔩','🎨','🧹','🪳','🚚','💻','🖌️','📣','📷','🧾','🗂️','🖊️','🎓','🏠','🌿','🚗','🛞','🎉','🍽️','🧵','💅','🏋️','🏢','⚖️','📱','🛡️','👶','🧓','📦','🖨️','☀️','💧','✈️','🐾','⚓','🚨','🛒','🏛️'];
const specBoxes=(cats,sel=[])=>`<input class=cat-q type=search placeholder="ابحث عن قسم..." aria-label="ابحث عن قسم">`+cats.map((c,i)=>`<label class=cat-card data-n="${esc(c.name)}"><input type=checkbox name=cat value=${c.id}${sel.includes(c.id)?' checked':''}><span class=cat-ic aria-hidden=true>${CAT_ICO[i]||'🔹'}</span><b>${esc(c.name)}</b><span class=cat-dot aria-hidden=true></span></label>`).join('');
const specLimit=e=>{const box=e.currentTarget;if(box.querySelectorAll('input[name=cat]:checked').length>2){e.target.checked=false;toast('يمكن اختيار قسمين كحد أقصى',1)}};
function auth(reg){const CITIES=['الرياض','جدة','مكة','المدينة','الدمام','الخبر','الطائف','تبوك','أبها','بريدة','حائل','القصيم','الجبيل','ينبع'];
const head=`<div class=auth-head><span class=mark-lg><img loading=lazy decoding=async src=/hand.png alt=""></span><h1>${reg?'إنشاء حساب جديد':'أهلًا بعودتك'}</h1><p>${reg?'اطلب خدمة سباكة أو كهرباء، أو سجّل محلك لتستقبل الطلبات.':'سجّل دخولك لمتابعة طلباتك ومحادثاتك.'}</p></div>`;
const regFields=`<label>اسم المستخدم<input name=name required minlength=2 autocomplete=username placeholder="اسم المستخدم"></label><label>رقم الجوال<input name=phone type=tel dir=ltr inputmode=tel required placeholder="05XXXXXXXX"></label>`;


const pwField=`<label>كلمة المرور<span class=pw-wrap><input name=password type=password minlength=8 required autocomplete=${reg?'new-password':'current-password'} dir=ltr${reg?' placeholder="8 أحرف على الأقل"':''}><button type=button class=pw-eye id=pwe aria-label="إظهار كلمة المرور">عرض</button></span></label>`;
const app2=`<section class=auth>${head}<form id=a class=auth-form>${reg?regFields:''}<label>البريد الإلكتروني<input name=email type=email required autocomplete=email dir=ltr placeholder="name@example.com"></label>${pwField}${reg?'<label>تأكيد كلمة المرور<input name=confirm type=password minlength=8 required autocomplete=new-password dir=ltr></label>':''}${reg?'<label class=check><input type=checkbox name=age required><span>عمري 18 سنة فأكثر</span></label>':''}${reg?'<label class="check multi"><input type=checkbox name=terms required><span>أوافق على <a href="#/terms">الشروط</a> و<a href="#/privacy">سياسة الخصوصية</a>، وأقر بأن المنصة وسيط تقني فقط ولا تتحمل مسؤولية الاتفاقات بين الأطراف</span></label>':''}<button class=btn>${reg?'التالي':'دخول'}</button></form><p class=auth-alt>${reg?'لديك حساب؟ <a href="#/login">سجّل دخولك</a>':'ليس لديك حساب؟ <a href="#/register">أنشئ حسابًا</a>'}</p>${reg?'':'<p class=auth-alt><a href="#/forgot">نسيت كلمة المرور؟</a></p>'}</section>`;
app.innerHTML=app2;
if(!reg&&location.hash==='#/admin-login'){const ab=document.createElement('button');ab.type='button';ab.className='btn alt sm';ab.id='admB';ab.style.marginTop='12px';ab.textContent='دخول الإدارة';ab.onclick=()=>{const f=$('#a');window.__postLogin='#/manage';if(!f.reportValidity()){window.__postLogin=null;return}f.requestSubmit()};$('.auth-form').insertAdjacentElement('afterend',ab)}
$('#pwe').onclick=()=>{const p=$('#a input[name=password]');const show=p.type==='password';p.type=show?'text':'password';$('#pwe').textContent=show?'إخفاء':'عرض'};


$('#a').onsubmit=sub(async b=>{if(reg){if(b.password!==b.confirm)throw new Error('كلمتا المرور غير متطابقتين');delete b.confirm;const rf=shopRef();if(rf)b.ref=rf;await api('/register','POST',b);clearShopRef();await boot();location.hash='#/verify-email';return}await api('/login','POST',b);await boot();const nx=window.__postLogin||'#/';window.__postLogin=null;location.hash=nx})}
async function dcOpenDrawer(){
const o=document.createElement('div');o.className='dc-ov';
o.innerHTML=`<aside class=dc-drawer role=dialog aria-modal=true aria-label="المحادثات السابقة"><div class=dc-dh><b>المحادثات السابقة</b><button type=button class=dc-ico data-x aria-label="إغلاق">✕</button></div><div class=dc-dl>جارٍ التحميل…</div></aside>`;
document.body.append(o);
o.onclick=e=>{if(e.target===o||e.target.closest('[data-x],a'))o.remove()};
try{const l=await api('/chats');const list=o.querySelector('.dc-dl');
list.innerHTML=l.map(c=>{const href=c.request_id?`#/chat/${esc(c.request_id)}/${esc(c.peer)}`:`#/direct/${esc(c.peer)}`;const sub=`${esc(c.title||'')}${c.body?' · '+esc(c.body.slice(0,50)):''}`;return `<a class=dc-item href="${href}"><i>${esc((c.peer_name||'؟')[0])}</i><span><b>${esc(c.peer_name)}</b><small>${sub}</small></span></a>`}).join('')||'<div class=empty>لا توجد محادثات بعد.</div>'}
catch(x){o.querySelector('.dc-dl').textContent=x.message}
}
const SV=p=>`<svg viewBox="0 0 24 24" class=dcs aria-hidden="true">${p}</svg>`;
const TOPIC_P='<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M9 8h6M9 12h6M9 16h4"/>',CARD_P='<rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M2.5 10h19"/>',DOTS_P='<circle cx="5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="19" cy="12" r="1.8" fill="currentColor"/>',PERSON_P='<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',RECEIPT_P='<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',MONEY_P='<rect x="2.5" y="6.5" width="19" height="11" rx="2"/><circle cx="12" cy="12" r="2.5"/>',LINK_P='<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',CHECK_P='<path d="M5 12.5l4.5 4.5L19 7.5"/>';
const SEND_SVG='<svg viewBox="0 0 24 24" class=dcs-fill aria-hidden="true"><path d="M3.4 11.1 20.6 3.3c.8-.4 1.6.4 1.2 1.2l-7.8 17.2c-.4.8-1.5.8-1.8 0l-2.2-6.7-6.7-2.2c-.8-.3-.8-1.4 0-1.6z"/></svg>';
function DCHAT_MARKUP(){return `<section id=dchat><div id=dagr class=agr></div><div id=dmsgs class=dmsgs></div></section><form id=dform autocomplete=off><button type=button class=dc-attach id=dpic aria-label="إرفاق صورة">${SV(I.clip)}</button><input name=body maxlength=1000 placeholder="اكتب رسالتك..." aria-label="اكتب رسالتك"><button type=button class=dc-task id=dtask hidden></button><button class=dc-send aria-label="إرسال">${SEND_SVG}</button></form>`}
async function directChat(id){if(!me.user){window.__postLogin=location.hash;location.hash='#/login';return}const peer=await api('/users/'+id).catch(()=>null);const name=(peer&&peer.name)||'المستخدم';document.body.classList.add('dchat-mode');app.innerHTML=`<div class=dc-top><span class=dc-logo><img src=/hand.png alt=""></span><div class=dc-title><b>${esc(name)}</b></div>${me.user.account_type==='helper'?`<div class=dc-plus-wrap><button type=button class=dc-plus id=plusBtn aria-haspopup=true aria-expanded=false aria-label="إضافة">+</button><div class=plus-menu id=plusMenu hidden><button type=button data-p=paylink id=plusPay hidden>رابط دفع${SV(CARD_P)}</button></div></div>`:''}<button type=button class=dc-dots id=dcMenu aria-label="المحادثات السابقة">${SV(DOTS_P)}</button></div>`+DCHAT_MARKUP();$('#dcMenu').onclick=dcOpenDrawer;dchatInit(id)}
async function chats(){const l=await api('/chats');app.innerHTML=`<h2 style="margin:8px 0">صندوق الوارد</h2><div class=panel style="padding:0">${l.map(c=>{const href=c.request_id?`#/chat/${esc(c.request_id)}/${esc(c.peer)}`:`#/direct/${esc(c.peer)}`;const t=String(c.created_at||'');return `<a href="${href}" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid #ece8f8;text-decoration:none;color:inherit"><i style="width:52px;height:52px;border-radius:50%;background:#6445cc;color:#fff;display:grid;place-items:center;font-style:normal;font-weight:700;flex:0 0 auto">${esc((c.peer_name||'؟')[0])}</i><span style="flex:1;min-width:0"><b>${esc(c.peer_name)}</b><small style="display:block;color:#625a76;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.title||'')}${c.body?' · '+esc(c.body.slice(0,50)):''}</small></span><small style="color:#9c94a8;flex:0 0 auto">${esc(t.slice(11,16))}</small></a>`}).join('')||'<div class=empty style="padding:20px">لا توجد محادثات بعد. تبدأ المحادثة من صفحة المساعد.</div>'}</div>`}
const askKind=()=>new Promise(ok=>{const o=document.createElement('div');o.style.cssText='position:fixed;inset:0;background:#0008;z-index:50;display:grid;place-items:end center';o.innerHTML='<div style="background:#fff;width:100%;max-width:480px;border-radius:20px 20px 0 0;padding:18px;display:grid;gap:10px;direction:rtl"><b>أين تريد نشر هذا المقطع؟</b><button class=btn type=button data-k=reel>ريلز (يظهر للجميع)</button><button class="btn alt" type=button data-k=post>منشور (يظهر للجميع)</button></div>';o.onclick=e=>{const k=e.target.dataset&&e.target.dataset.k;if(k||e.target===o){o.remove();ok(k||null)}};document.body.append(o)});
const accTabs=(pics,ro)=>{const posts=pics.filter(x=>x.kind!=='reel'),reels=pics.filter(x=>x.kind==='reel'),tl=a=>a.map(x=>`<figure>${mediaTag(x)}${x.caption?`<figcaption>${esc(x.caption)}</figcaption>`:''}</figure>`).join('');return `<div class=acc-tabs><nav><button type=button class=on data-tab=posts>المنشورات</button><button type=button data-tab=reels>ريلز</button></nav><div class=acc-grid id=tg-posts>${tl(posts)}${ro?'':'<button class=acc-add id=addWork type=button aria-label="إضافة صورة أو فيديو">+</button>'}${posts.length?'':`<div class=acc-empty>${ro?'لا توجد أعمال بعد.':'لم تضف أعمالًا بعد. ابدأ بإضافة صورة لعملك.'}</div>`}</div><div class=acc-grid id=tg-reels hidden>${tl(reels)}${ro?'':'<button class=acc-add id=addWork2 type=button aria-label="إضافة ريلز">+</button>'}${reels.length?'':`<div class=acc-empty>${ro?'لا توجد ريلز بعد.':'لا توجد ريلز بعد. ارفع فيديو واختر «ريلز».'}</div>`}</div></div>`};
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-tab]');if(!b)return;document.querySelectorAll('.acc-tabs nav [data-tab]').forEach(x=>x.classList.toggle('on',x===b));const r=b.dataset.tab==='reels';const g1=document.getElementById('tg-posts'),g2=document.getElementById('tg-reels');if(g1)g1.hidden=r;if(g2)g2.hidden=!r});
const pickMedia=()=>new Promise((ok,no)=>{const i=document.createElement('input');i.type='file';i.accept='image/*,video/mp4,video/quicktime,video/webm';i.onchange=()=>{const f=i.files[0];if(!f)return no(new Error('لم تختر ملفًا'));pickMedia.last=f.type||(/\.(mov|mp4|webm)$/i.test(f.name)?'video/x':'');if(f.type.startsWith('video/')){(async()=>{try{const mime=f.type||(/\.mov$/i.test(f.name)?'video/quicktime':'video/mp4');const r0=await api('/upload-video/init','POST',{mime,size:f.size});if(r0.mode==='disk'){if(f.size>30e6)throw new Error('حجم الفيديو يجب ألا يتجاوز 50 ميجابايت');const rr=await fetch('/api/upload-raw',{method:'POST',headers:{'content-type':'application/octet-stream','x-video-mime':mime},body:f});const j=await rr.json().catch(()=>({}));if(!rr.ok)throw new Error(j.error||'تعذّر رفع الفيديو');return ok(j.id)}
if(r0.mode==='external'){const put=await fetch(r0.url,{method:'PUT',headers:{'content-type':mime},body:f});if(!put.ok)throw new Error('تعذّر رفع الفيديو، حاول مرة أخرى');const c=await api('/upload-video/complete','POST',{key:r0.key,mime});return ok(c.id)}if(f.size>8e6)throw new Error('حجم الفيديو يجب ألا يتجاوز 8 ميجابايت');const data=await new Promise((res,rej)=>{const rd=new FileReader();rd.onload=()=>res(rd.result);rd.onerror=()=>rej(new Error('تعذّر قراءة الفيديو'));rd.readAsDataURL(f)});const x=await api('/upload-video','POST',{data});ok(x.id)}catch(e){no(e)}})();return}const im=new Image();im.onload=()=>{const k=Math.min(1,1280/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=im.width*k;c.height=im.height*k;c.getContext('2d').drawImage(im,0,0,c.width,c.height);api('/upload','POST',{data:c.toDataURL('image/jpeg',.8)}).then(r=>ok(r.id),no)};im.onerror=()=>no(new Error('الملف ليس صورة'));im.src=URL.createObjectURL(f)};i.click()});
const pick=()=>new Promise((ok,no)=>{const i=document.createElement('input');i.type='file';i.accept='image/jpeg,image/png,image/webp,image/*';i.style.cssText='position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0';document.body.appendChild(i);const done=()=>setTimeout(()=>i.remove(),0);
i.onchange=async()=>{const f=i.files&&i.files[0];done();if(!f)return no(new Error('لم تختر صورة'));
try{if(/heic|heif/i.test(f.type)||/\.(heic|heif)$/i.test(f.name))throw new Error('صيغة HEIC غير مدعومة، التقط الصورة بصيغة JPEG أو خذ لقطة شاشة لها');if(f.type&&!/^image\//.test(f.type))throw new Error('اختر صورة (JPG أو PNG)، ولا يُقبل PDF هنا');
let src,w,h,rel=()=>{};
if(window.createImageBitmap){try{src=await createImageBitmap(f,{imageOrientation:'from-image'});w=src.width;h=src.height;rel=()=>src.close&&src.close()}catch{src=null}}
if(!src){const u=URL.createObjectURL(f);rel=()=>URL.revokeObjectURL(u);src=await new Promise((r,j)=>{const im=new Image();im.onload=()=>r(im);im.onerror=()=>j(new Error('تعذّر قراءة الصورة، جرّب صورة JPG أو PNG'));im.src=u});w=src.naturalWidth||src.width;h=src.naturalHeight||src.height}
if(!w||!h){rel();throw new Error('الصورة تالفة أو غير مدعومة')}
let side=Math.min(1,1600/Math.max(w,h)),q=.85,data='';
for(let t=0;t<6;t++){const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w*side));c.height=Math.max(1,Math.round(h*side));const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(src,0,0,c.width,c.height);data=c.toDataURL('image/jpeg',q);if(!data.startsWith('data:image/jpeg'))break;if(data.length*0.75<1.6e6)break;q=Math.max(.5,q-.1);side*=.8}
rel();if(!data.startsWith('data:image/jpeg'))throw new Error('تعذّر تجهيز الصورة، جرّب صورة أخرى');
if(data.length*0.75>1.95e6)throw new Error('الصورة كبيرة جدًا، اختر صورة أصغر');
const r=await api('/upload','POST',{data});ok(r.id)}catch(e){no(e)}};
i.addEventListener('cancel',()=>{done();no(new Error('لم تختر صورة'))});i.click()});
document.addEventListener('click',async e=>{const t=e.target.closest&&e.target.closest('#addWork,#addWork2,#addPh,#avEdit,#avEdit2,#avDel,#covEdit');if(!t)return;e.preventDefault();try{if(t.id==='avDel'){if(!confirm('حذف الصورة الشخصية؟'))return;await api('/me/avatar/delete','POST');toast('تم حذف الصورة الشخصية')}else if(t.id==='covEdit'){const id=await pick();await api('/me/cover','POST',{attachment_id:id});toast('تم تحديث صورة الغلاف')}else if(t.id==='avEdit'||t.id==='avEdit2'){const id=await pick();await api('/me/avatar','POST',{attachment_id:id});toast('تم تحديث الصورة الشخصية')}else{const id=await pickMedia();let kind='post';if(/^video\//.test(pickMedia.last||'')){kind=await askKind();if(!kind)return}const caption=prompt('وصف قصير للعمل (اختياري):')||'';await api('/me/portfolio','POST',{attachment_id:id,caption,kind});toast(kind==='reel'?'أُضيف إلى الريلز وسيظهر للجميع':'تم النشر وسيظهر للجميع في المنشورات')}await route()}catch(x){if(!/^لم تختر/.test(x.message))toast(x.message,1)}});
const report=async(type,id)=>{const reason=prompt('سبب البلاغ:');if(!reason)return;try{await api('/report','POST',{type,id,reason});toast('تم إرسال البلاغ')}catch(x){toast(x.message,1)}};
const star=n=>'★'.repeat(n)+'☆'.repeat(5-n);
async function profileSub(k){await profile();const isH=me.user.account_type==='helper';const map={password:['pw-wrap'],data:['pf-wrap'],city:['pf-wrap'],specs:['skf-wrap','conv-wrap'],gallery:['gal-wrap'],email:['emf-wrap'],points:['pts'],ledger:['ledger'],notify:['ntf'],type:['toHelper','toClient'],danger:['delF'],faq:['faq-wrap'],bio:['bioF']}
const titles={password:'تغيير كلمة المرور',data:'بيانات الحساب',city:'المدينة وموقع الخدمة',specs:'قسم خدماتك',gallery:'معرض أعمالي',email:'تغيير البريد الإلكتروني',points:'استخدام الرصيد',ledger:'سجل النقاط',notify:'إشعارات البريد',type:'نوع الحساب',danger:'حذف الحساب',admin:'تفعيل صلاحية المدير',faq:'الأسئلة الشائعة',bio:'النبذة'};
const ids=map[k];if(!ids){location.hash='#/profile';return}
const targets=ids.map(id=>document.getElementById(id)).filter(Boolean).map(el=>el.closest('section,.pf-list,.pf-danger')||el);
if(!targets.length){location.hash='#/profile';return}
targets.forEach(t=>{t.hidden=false});
for(const c of [...app.children]){if(!targets.some(t=>c===t||c.contains(t)))c.style.display='none'}
const TAB={data:'البيانات الشخصية',specs:'قسم خدماتك',};
if(isH&&TAB[k]){app.insertAdjacentHTML('afterbegin',`<div class=dt-tabs role=navigation aria-label="بيانات الحساب">${Object.keys(TAB).map(x=>`<a href="#/profile/${x}"${x===k?' class=on aria-current=page':''}>${TAB[x]}</a>`).join('')}</div>`);const h=document.querySelector('#skf-wrap>.sec-h');if(k==='specs'&&h)h.style.display='none'}
else if(k==='data'){}
else if(k==='specs'&&!isH)app.insertAdjacentHTML('afterbegin','<h2 style="margin:6px 0 10px;color:#0d0a2c">التحويل إلى مساعد</h2>')
else app.insertAdjacentHTML('afterbegin',`<h2 style="margin:6px 0 10px;color:#0d0a2c">${titles[k]||''}</h2>`)}
async function profileAccount(viewId){
// الملف العام متاح للزائر بلا تسجيل دخول؛ ملفك أنت يتطلب الدخول
if(!me.user&&!viewId){location.hash='#/login';return}
const own=!!me.user&&(!viewId||+viewId===me.user.id);
const p=await api('/providers/'+(own?me.user.id:viewId)),isH=own?me.user.account_type==='helper':!!p.is_helper;
const shop=isH?await api('/shop/'+p.id).catch(()=>({products:[]})):{products:[]};
const pics=p.portfolio||[],bio=(p.bio||'').trim(),isVid=x=>/^video\//.test(x.mime||'');
const cv=p.cover||(pics.find(x=>!isVid(x))||{}).attachment_id;
const name=esc(own?(p.name&&!/@/.test(p.name)?p.name:(me.user.name||'حسابي')):(p.name||''));
const hasAvg=Number(p.avg)>0,avg=hasAvg?Number(p.avg).toFixed(1):'—',done=p.done||0,cl=p.clients||0,sk=p.skills||[];
const kfmt=n=>n>=1000?(n/1000).toFixed(1).replace(/\.0$/,'')+'K':String(n);
const REG={'الرياض':'منطقة الرياض','جدة':'منطقة مكة المكرمة','مكة':'منطقة مكة المكرمة','مكة المكرمة':'منطقة مكة المكرمة','الطائف':'منطقة مكة المكرمة','المدينة':'منطقة المدينة المنورة','المدينة المنورة':'منطقة المدينة المنورة','ينبع':'منطقة المدينة المنورة','الدمام':'المنطقة الشرقية','الخبر':'المنطقة الشرقية','الظهران':'المنطقة الشرقية','الأحساء':'المنطقة الشرقية','الهفوف':'المنطقة الشرقية','القطيف':'المنطقة الشرقية','الجبيل':'المنطقة الشرقية','بريدة':'منطقة القصيم','عنيزة':'منطقة القصيم','أبها':'منطقة عسير','خميس مشيط':'منطقة عسير','تبوك':'منطقة تبوك','حائل':'منطقة حائل','جازان':'منطقة جازان','نجران':'منطقة نجران','الباحة':'منطقة الباحة','سكاكا':'منطقة الجوف','عرعر':'منطقة الحدود الشمالية'};
const city=String(p.city||'').trim(),loc=city?(REG[city]?city+' - '+REG[city]:city):'لم تُحدَّد المدينة';
const g=(d,w=20,x='')=>`<svg class="pf2i ${x}" viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC={back:'<path d="M4 12h16M14 6l6 6-6 6"/>',menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3M5.300 5.300l2.100 2.100M16.600 16.600l2.100 2.100M5.300 18.700l2.100-2.100M16.600 7.400l2.100-2.100"/><circle cx="12" cy="12" r="7.200"/>',share:'<path d="M12 15V3.500M7.500 8 12 3.500 16.500 8M5 12.500v7h14v-7"/>',qr:'<rect x="3.500" y="3.500" width="6.500" height="6.500" rx="1.200"/><rect x="14" y="3.500" width="6.500" height="6.500" rx="1.200"/><rect x="3.500" y="14" width="6.500" height="6.500" rx="1.200"/><path d="M14 14h2.500v2.500H14zM19.500 14H21M14 19.500V21M17.500 17.500H21V21h-3.500z"/>',pen:'<path d="M4 20h4L19 9a2.800 2.800 0 0 0-4-4L4 16z" fill="currentColor"/>',pin:'<path d="M12 21s-7-6.200-7-11a7 7 0 0 1 14 0c0 4.800-7 11-7 11z" fill="currentColor"/><circle cx="12" cy="10" r="2.500" fill="#fff" stroke="none"/>',star:'<path d="M12 3.500l2.600 5.400 5.900.8-4.300 4.100 1 5.800L12 16.800 6.800 19.600l1-5.800L3.500 9.700l5.900-.8z" fill="currentColor"/>',check:'<rect x="5" y="4" width="14" height="17" rx="2.500"/><path d="M9 4V3h6v1M9 13l2.200 2.200L15.500 11"/>',bag:'<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M9 7V5.500A1.500 1.500 0 0 1 10.500 4h3A1.500 1.500 0 0 1 15 5.500V7M3 13h18"/>',img:'<rect x="3" y="4.500" width="18" height="15" rx="3"/><circle cx="9" cy="10" r="1.800"/><path d="m21 16-5-5-8 8.500"/>',shield:'<path d="M12 2.500l8 3v6c0 4.800-3.200 8.500-8 10.500-4.800-2-8-5.700-8-10.500v-6z" fill="currentColor"/><path d="M8.500 12l2.600 2.600L16 9.500" stroke="#fff" stroke-width="2.200"/>',doc:'<path d="M7 3h7l4 4v14H7z" fill="currentColor"/><path d="M10 12h5M10 16h5" stroke="#fff" stroke-width="1.800"/>',phone:'<path d="M22 16.900v3a2 2 0 0 1-2.200 2 19.800 19.800 0 0 1-8.600-3.100 19.500 19.500 0 0 1-6-6A19.800 19.800 0 0 1 2.100 4.200 2 2 0 0 1 4.100 2h3a2 2 0 0 1 2 1.700c.1 1 .4 1.900.7 2.800a2 2 0 0 1-.5 2.100L8 9.900a16 16 0 0 0 6 6l1.300-1.300a2 2 0 0 1 2.100-.4c.9.3 1.800.6 2.800.7a2 2 0 0 1 1.700 2z" fill="currentColor"/>',cam:'<path d="M4 8h3l1.500-2.500h7L17 8h3v11H4z"/><circle cx="12" cy="13.500" r="3.500"/><path d="M19 2.500v4M17 4.500h4"/>',chat:'<path d="M21 12a8 8 0 0 1-11.600 7.100L4 20l1-4.600A8 8 0 1 1 21 12z"/>',chev:'<path d="M15 5l-7 7 7 7"/>',tick:'<path d="M5 12.500l4.500 4.500L19 7.500"/>'};
const showBadge=own?me.user.email_verified!==0:isH;
const showQrBtn=isH&&(own||['admin','staff'].includes(me.user.role))?`<button type=button class=pf2-ib id=pfQr aria-label="بطاقة QR للمحل">${g(IC.qr,24)}</button>`:'';
const verified=showBadge?`<span class=pf2-ver aria-label="حساب موثّق">${g(IC.tick,14,'pf2-vt')}</span>`:'';
const avatar=own?`<button class=pf2-av id=avEdit type=button aria-label="تغيير الصورة الشخصية">${avHtml(p.avatar,p.name)}</button>`:`<div class=pf2-av>${avHtml(p.avatar,p.name)}</div>`;
const tabs=own?[...(isH?[['svc',isH?'منتجاتي':'خدماتي',IC.bag]]:[]),['chats','محادثاتي',IC.chat],['set','الإعدادات',IC.gear]]:[['svc',isH?'المنتجات':'الخدمات',IC.bag],['wk','الأعمال',IC.img],['rev','التقييمات',IC.star]];
const sub=sk.length?sk.slice(0,3).map(esc).join(' • '):(isH?'مساعد':'عميل');
const phone=own?(me.user.phone?esc(me.user.phone):'—'):'';
const addr=esc(city||(own?'—':''));
const works=Array.from({length:4},(_,i)=>pics[i]?`<div class=pf2-w>${mediaTag(pics[i])}</div>`:(own?`<div class="pf2-w pf2-w0">${g(IC.img,22)}</div>`:'')).join('');
const revs=(p.reviews||[]).length?p.reviews.map(x=>`<div class=pf2-rv><div><b>${esc(x.name)}</b><span class=pf2-st>${'★'.repeat(+x.stars||0)}</span></div>${x.comment?`<p>${esc(x.comment)}</p>`:''}</div>`).join(''):'<div class=pf2-empty>لا توجد تقييمات بعد.</div>';
const shopCards=(shop.products||[]).map(x=>`<article class=shop-card>${x.image_id?`<img class=shop-img loading=lazy decoding=async src="/api/files/${+x.image_id}" alt="">`:''}<div class=shop-body><h4>${esc(x.title)}</h4>${x.description?`<p>${esc(x.description)}</p>`:''}</div><div class=shop-foot><b class=shop-price>${Number(x.price).toLocaleString('en-US')} <small>ريال</small></b>${own?`<button type=button class="shop-btn shop-del" data-del="${+x.id}">حذف</button>`:`<button type=button class=shop-btn data-buy="${+x.id}">أضف للسلة</button>`}</div></article>`).join('');
const storeBlock=`<section class=shop-sec><div class=pf2-sechead><h3><span class=pf2-hi2>${g(IC.bag,18)}</span>${own?'منتجات متجري':'المنتجات'}</h3></div>${shopCards?`<div class=shop-grid>${shopCards}</div>`:`<div class=pf2-empty>${own?'لم تضف منتجات بعد.':'لا توجد منتجات بعد.'}</div>`}${own?'<button type=button class=shop-add id=addProd>+ إضافة منتج</button>':'<button type=button class=shop-cart-btn id=openCart>سلتي</button>'}</section>`;
const heroBg=cv?` style="background-image:url('/api/files/${+cv}')"`:'';
app.innerHTML=`<div class=pf2>
<div class=pf2-top><h1>${own&&isH?'متجري':own?'حسابي':'الملف الشخصي'}</h1><span class=pf2-sp></span>${showQrBtn}<button type=button class=pf2-ib id=pfShare aria-label="مشاركة">${g(IC.share,24)}</button><button type=button class=pf2-ib id=pfMenu aria-expanded=false aria-label="القائمة">${g(IC.menu,24)}</button></div>
<section class=pf2-hero${heroBg}>${own?'<button type=button class=pf2-cov id=covEdit aria-label="تغيير صورة الغلاف"></button>':''}
<div class=pf2-fade></div>
${isH?'<span class=pf2-avail><i></i>متاح لاستقبال الطلبات</span>':''}
<div class=pf2-avwrap>${avatar}${verified}</div>
<div class=pf2-txt><h2>${name}</h2><p class=pf2-sub>${sub}</p><p class=pf2-rate><span class=pf2-cl><b>${kfmt(cl)}</b><small>عميل</small></span><i></i><span class=pf2-rt><b>${avg}</b>${g(IC.star,17,'pf2-gold')}</span></p><p class=pf2-loc>${g(IC.pin,16)}<span>${esc(loc)}</span></p></div>
${own?`<a class=pf2-edit href="#/profile/data">${g(IC.pen,16)}<span>تعديل الملف</span></a>`:`<a class=pf2-edit href="#/direct/${+p.id}">${g(IC.chat,16)}<span>محادثة</span></a>`}
</section>
${isH?`<section class=pf2-stats><div><span class="pf2-si pf2-c1">${g(IC.bag,19)}</span><b>${sk.length}</b><small>خدمات</small></div><div><span class="pf2-si pf2-c2">${g(IC.check,19)}</span><b>${done}</b><small>طلب مكتمل</small></div><div><span class="pf2-si pf2-gold">${g(IC.star,19)}</span><b>${avg}</b><small>تقييم العملاء</small></div></section>`:''}
<nav class=pf2-tabs role=tablist>${tabs.map(([k,t,d],i)=>`<button type=button role=tab class="${(i||(own&&!isH))?'':'on'}" data-pt="${k}">${g(d,18)}<span>${t}</span></button>`).join('')}</nav>
${own&&!isH?'':`
<div class=pf2-panel data-pp=svc>
<section class=pf2-card><h3><span class=pf2-hi>${g(IC.doc,15)}</span>${own&&me.user.helper_type==='individual'?'نبذة عني':'نبذة عن المحل'}</h3><p class=pf2-bio>${bio?esc(bio):(own?'لم تكتب نبذة بعد. <a href="#/profile/bio">أضفها من هنا ←</a>':'لم يكتب نبذة بعد.')}</p><div class=pf2-info>${own&&me.user.phone?`<a class=pf2-row href="tel:${esc(String(me.user.phone).replace(/\s/g,''))}" aria-label="اتصل بالجوال"><span class="pf2-hi pf2-hc">${g(IC.phone,16)}</span><div><small>الجوال · اضغط للاتصال</small><b dir=ltr>${phone}</b></div></a>`:own?`<div class=pf2-row><span class="pf2-hi pf2-hc">${g(IC.phone,16)}</span><div><small>الجوال</small><b>—</b></div></div>`:''}${p.map_url?`<a class=pf2-row href="${esc(p.map_url)}" target=_blank rel=noopener aria-label="فتح الموقع في الخرائط"><span class="pf2-hi pf2-hc">${g(IC.pin,16)}</span><div><small>العنوان · اضغط لفتح الموقع</small><b>${addr||'—'}</b></div></a>`:`<div class=pf2-row><span class="pf2-hi pf2-hc">${g(IC.pin,16)}</span><div><small>العنوان</small><b>${addr||'—'}</b></div></div>`}</div></section>
${isH?storeBlock:''}${isH?'':`<div class=pf2-sechead><h3><span class=pf2-hi2>${g(IC.img,18)}</span>${own?'أعمالنا السابقة':'الأعمال السابقة'}</h3><button type=button class=pf2-all data-pt="wk">${g(IC.chev,14)}<span>عرض الكل</span></button></div>
${works.trim()?`<div class=pf2-works>${works}</div>`:'<div class=pf2-empty>لا توجد أعمال بعد.</div>'}`}
</div>`}
<div class=pf2-panel data-pp=wk hidden>${pics.length?`<div class=pf2-grid>${pics.map(x=>`<figure>${mediaTag(x)}${x.caption?`<figcaption>${esc(x.caption)}</figcaption>`:''}</figure>`).join('')}</div>`:`<div class=pf2-empty>${own?'لم تضف أعمالًا بعد.':'لا توجد أعمال بعد.'}</div>`}</div>
${!own?`<div class=pf2-panel data-pp=rev hidden>${revs}</div>`:''}

</div>`;
const root=app.querySelector('.pf2');
root.addEventListener('click',e=>{const b=e.target.closest('[data-pt]');if(!b)return;const k=b.dataset.pt;if(k==='set'){location.hash='#/settings';return}if(k==='chats'){location.hash='#/chats';return}root.querySelectorAll('.pf2-tabs [data-pt]').forEach(x=>x.classList.toggle('on',x.dataset.pt===k));root.querySelectorAll('[data-pp]').forEach(x=>x.hidden=x.dataset.pp!==k)});
{const qb=$('#pfQr');if(qb)qb.onclick=()=>openShopCard(p)}
root.addEventListener('click',async e=>{const buy=e.target.closest('[data-buy]'),del=e.target.closest('[data-del]'),add=e.target.closest('#addProd'),cart=e.target.closest('#openCart');if(!buy&&!del&&!add&&!cart)return;e.preventDefault();
if(!me.user){location.hash='#/login';return}
try{
if(buy){await api('/shop/'+p.id+'/cart/'+(+buy.dataset.buy),'POST');toast('أُضيف المنتج للسلة');return}
if(del){if(!confirm('حذف المنتج من المتجر؟'))return;await api('/shop/products/'+(+del.dataset.del)+'/delete','POST');toast('تم حذف المنتج');return profileAccount(viewId)}
if(add){let imgId=null;const m=openModal('منتج جديد',"<label>اسم المنتج<input name=title maxlength=80 required></label><label>الوصف<textarea name=description maxlength=500 rows=3></textarea></label><label>السعر (ريال)<input name=price type=number min=1 step=0.01 required></label><button type=button class=btn alt data-pic>إرفاق صورة المنتج</button><small data-picmsg></small>",async b=>{await api('/shop/products','POST',{title:b.title,description:b.description,price:Number(b.price),attachment_id:imgId});toast('تمت إضافة المنتج');await profileAccount(viewId)});const pm=m.querySelector('[data-pic]');pm.onclick=async()=>{try{const id=await pickMedia();if(!/^image\//.test(pickMedia.last||'')){toast('اختر صورة فقط',1);return}imgId=id;m.querySelector('[data-picmsg]').textContent='تم إرفاق الصورة'}catch(x){if(!/^لم تختر/.test(x.message))toast(x.message,1)}};return}
if(cart){const items=await api('/shop/'+p.id+'/cart');if(!items.length){toast('السلة فارغة');return}
const rows=items.map(i=>`<div class=shop-cart-row><span>${esc(i.title)} × ${i.qty}</span></div>`).join('');
openModal('سلتي',rows+'<small>يُرسل ملخص السلة للمساعد في المحادثة، والسعر النهائي يحدده رابط الدفع الذي يصدره.</small>',async()=>{await api('/shop/'+p.id+'/checkout','POST');toast('أُرسلت الفاتورة للمساعد');location.hash='#/direct/'+p.id})}
}catch(x){toast(x.message,1)}});
$('#pfShare').onclick=()=>openProfileShare(p,shopUrl(p.id,isH))}
const SETTINGS_ITEMS=[['الإشعارات والتواصل','notify'],['الأمان','password'],['حذف الحساب','danger']];
async function settingsPage(){if(!me.user){location.hash='#/login';return}const isH=me.user.account_type==='helper';const items=SETTINGS_ITEMS.filter(([,k])=>!['points','ledger'].includes(k)&&(isH||!['specs','bio','gallery'].includes(k)));app.innerHTML=`<h2 style="margin:8px 0 12px">الإعدادات</h2><div class=panel style="padding:0">${items.map(([t,k],i)=>`<a href="${k==='wallet'?'#/wallet':'#/profile/'+k}" style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid #ece8f8;text-decoration:none;color:inherit"><span>${i+1}- ${t}</span><span style="color:#9c94a8">‹</span></a>`).join('')}</div>`}
async function walletPage(){if(!me.user){location.hash='#/login';return}const w=await api('/wallet');
app.innerHTML=`<h2 style="margin:6px 0 10px;color:#0d0a2c">النقاط والمحفظة</h2><section class=panel><div class=row><b>الرصيد الحالي</b><b dir=ltr>${w.points} نقطة</b></div><small>تُضاف النقاط عند اكتمال مهمة مؤهلة.</small></section><section class=panel style="display:grid;gap:4px"><a class=lnk href="#/profile/points">استخدام الرصيد ‹</a><a class=lnk href="#/profile/ledger">سجل النقاط ‹</a></section>`}
const ACC_CSS = `<style>
.acc{max-width:560px;margin:0 auto}
.acc-top{display:flex;justify-content:space-between;align-items:center;padding:4px 0 12px}
.acc-top h1{margin:0;font-size:22px;color:var(--g)}
.acc-top .acc-icons{display:flex;gap:4px}
.acc-ic{width:44px;height:44px;display:grid;place-items:center;color:var(--g);text-decoration:none;font-size:20px;border-radius:50%}
.acc-head{display:flex;align-items:center;gap:14px}
.acc-av{width:96px;height:96px;border-radius:50%;background:radial-gradient(circle at 30% 20%,#6445cc,var(--g));color:#fff;display:grid;place-items:center;font-size:38px;font-weight:700;flex:0 0 auto;box-shadow:0 6px 18px #2a1a7233}
.acc-stats{flex:1;display:grid;grid-template-columns:repeat(3,1fr);text-align:center}
.acc-stats div+div{border-inline-start:1px solid var(--b)}
.acc-stats b{display:block;font-size:22px;color:var(--t);line-height:1.3}
.acc-stats small{font-size:13px}
.acc-name{margin-top:12px;text-align:start}
.acc-name h2{margin:0;font-size:20px;color:var(--t)}
.acc-name small{color:var(--mu)}
.acc-bio{color:var(--mu);font-size:14px;margin:8px 0 14px}
.acc-bio a{color:var(--g)}
.acc-btns{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.acc-btns .btn{text-align:center;border-radius:12px;padding:12px 8px;font-weight:600}
.acc-btns .btn.gray{background:#ece8f6;color:var(--t);border:0}
.acc-tabs{margin:18px -16px 0;background:#fff;border-radius:26px 26px 0 0;padding:14px 12px 0;min-height:320px}
.acc-tabs nav{display:flex;justify-content:space-around;border-bottom:1px solid var(--b)}
.acc-tabs nav a{padding:10px 8px;color:var(--mu);text-decoration:none;font-weight:600;position:relative}
.acc-tabs nav a.on{color:var(--g)}
.acc-tabs nav a.on::after{content:"";position:absolute;inset-inline:10%;bottom:-1px;height:3px;background:var(--g);border-radius:3px}
.acc-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:6px 0 16px}
.acc-grid figure,.acc-grid a{margin:0;aspect-ratio:1;position:relative;overflow:hidden;border-radius:10px;background:var(--bg)}
.acc-grid img{width:100%;height:100%;object-fit:cover;display:block}
.acc-grid figcaption{position:absolute;inset-inline-start:6px;bottom:6px;background:#000a;color:#fff;font-size:12px;border-radius:8px;padding:2px 8px;max-width:90%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.acc-add{display:grid;place-items:center;color:var(--g);text-decoration:none;font-size:34px;border:1px dashed var(--b)}
button.acc-add{aspect-ratio:1;width:100%;background:none;cursor:pointer;padding:0;font-family:inherit;border-radius:10px}
.acc-grid video{width:100%;height:100%;object-fit:cover;display:block;background:#000}
.acc-av{border:0;padding:0;cursor:pointer;overflow:hidden;font-family:inherit}
.acc-av img{width:100%;height:100%;object-fit:cover;border-radius:50%;display:block}
.acc-btns .btn:only-child{grid-column:1/-1}
.acc-empty{grid-column:1/-1;text-align:center;color:var(--mu);padding:30px 0}
.acc-done{margin-top:12px;display:flex;justify-content:space-between;align-items:center;background:var(--ml);border-radius:14px;padding:10px 14px;font-size:14px;color:var(--g)}
</style>`;

// حرف الصورة الرمزية: نتخطى «مؤسسة/شركة» و«ال» التعريف حتى لا تبدأ كل المحلات بالحرف نفسه
function initialOf(name){let w=String(name||'').trim().split(/\s+/);if(w.length>1&&/^(مؤسس[ةه]|شرك[ةه])$/.test(w[0]))w=w.slice(1);let s=w[0]||'';if(/^ال.{2,}/u.test(s))s=s.slice(2);return [...s][0]||'؟'}
function avHtml(av,name){return av?`<img loading=lazy decoding=async src="/api/files/${+av}" alt="">`:esc(initialOf(name))}
function mediaTag(x){return /^video\//.test(x.mime||'')?`<video src="/api/files/${x.attachment_id}" controls playsinline preload="metadata"></video>`:`<img src="/api/files/${x.attachment_id}" alt="" loading="lazy">`}
/* u: المستخدم، pv: الملف العام (bio, portfolio, reviews)، avg/done: أرقام محسوبة، pl: التعهد */
function accountView(u, pv, avg, done, isH, pl) {
  const pics = pv.portfolio || [];
  const bio = (pv.bio || '').trim();
  const tiles = pics.map(x => `
    <figure>
      ${mediaTag(x)}
      ${x.caption ? `<figcaption>${esc(x.caption)}</figcaption>` : ''}
    </figure>`).join('');
  const addTile = `<button class=acc-add id=addWork type=button aria-label="إضافة صورة أو فيديو">+</button>`;

  return `${ACC_CSS}
<div class=acc>
  <div class=acc-top>
    <h1>حسابي</h1>
    <div class=acc-icons>
      
      <button type=button class=acc-ic id=pfMenu aria-expanded=false aria-label="القائمة" style="border:0;background:none;padding:0;cursor:pointer">${ic(I.more)}</button>
    </div>
  </div>

  <div class=acc-head>
    <button class=acc-av id=avEdit type=button aria-label="تغيير الصورة الشخصية">${avHtml(pv.avatar,u.name)}</button>
    ${isH?`<div class=acc-stats>
      <div><b>${pics.length||'—'}</b><small>أعمال</small></div>
      <div><b>${done||'—'}</b><small>مهمة مكتملة</small></div>
      <div><b>${avg}</b><small>التقييم</small></div>
    </div>`:''}
  </div>

  <div class=acc-name>
    <h2>${esc(u.name)}</h2>
    ${pv.avatar ? '<button class=lnk id=avDel type=button>حذف الصورة الشخصية</button>' : ''}
    <small>${isH ? 'مساعد' : 'عميل'}${u.city ? ' · ' + ic(I.pin) + ' ' + esc(u.city) : ''}${u.active ? '' : ' · الحساب معطّل'}</small>
  </div>

  <p class=acc-bio>${bio
    ? esc(bio)
    : 'لم تكتب نبذة بعد. <a href="#/profile/gallery">أضفها من الإعدادات ←</a>'}</p>

  <div class=acc-btns>
    <a class=btn href="#/chats">محادثاتي</a>${u.account_type==='helper'?'<a class="btn gray" href="#/hala">حساب هلا</a><a class="btn gray" href="#/platform-dues">مستحقات المنصة</a>':''}
    
  </div>

  ${u.account_type === 'helper' ? '' : `<div class=acc-done><span>${pl && pl.accepted ? 'التعهد موقّع' : 'التعهد غير موقّع'}</span></div>`}

  ${accTabs(pics)}
</div>`;
}

const DOC_LABEL={cr:'السجل التجاري',iban:'الآيبان',vat:'الشهادة الضريبية',address:'العنوان الوطني',logo:'شعار المساعد',org:'اسم المؤسسة أو الشركة'};
const DOC_LOGO={vat:'/vat-logo.png',cr:'/business-logo.png'};
const DOC_ICON='<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="#5331b6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/></svg>';
const DT={user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.500 8-6.500s8 2.500 8 6.500"/>',city:'<path d="M3 21h18M5 21V8l6-3v16M11 21V10h8v11M8 11h0M8 14h0M8 17h0M14 13h2M14 17h2"/>',phone:'<path d="M5 4h4l2 5-2.500 1.500a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',pin:'<path d="M12 21s7-6.200 7-11a7 7 0 10-14 0c0 4.800 7 11 7 11z"/><circle cx="12" cy="10" r="2.500"/>',code:'<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',bank:'<path d="M3 9l9-5 9 5H3zM5 9v9M9.500 9v9M14.500 9v9M19 9v9M3 21h18"/>',link:'<path d="M10 14a4 4 0 005.700 0l3-3a4 4 0 00-5.700-5.700l-1 1M14 10a4 4 0 00-5.700 0l-3 3a4 4 0 005.700 5.700l1-1"/>',cam:'<path d="M4 8h3l1.500-2h7L17 8h3v11H4zM12 17a3.500 3.500 0 100-7 3.500 3.500 0 000 7z"/>',right:'<path d="M4 12h16M14 6l6 6-6 6"/>',left:'<path d="M20 12H4M10 6l-6 6 6 6"/>'};
const dtI=(k,w=24)=>`<svg class=dt-i viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${DT[k]}</svg>`;
const HT_LABEL={individual:'فرد',establishment:'مؤسسة',company:'شركة'};
function dtCard(u,pv,isH){
const typeName=isH?(HT_LABEL[u.helper_type]||'غير محدد'):'عميل';
const notes=isH?`${u.vat_status==='registered'&&u.vat_verified===2?`<div class="dt-note dt-red"><b>رقمك الضريبي غير مُعتمد، وحسابك موقوف عن استقبال الطلبات والاتفاقات الجديدة.</b><br><small>تواصل مع الدعم لتصحيح الرقم الضريبي، وستتم مراجعته من جديد.</small></div>`:''}${(u.helper_type==='establishment'||u.helper_type==='company')&&u.vat_status!=='registered'?`<div class="dt-note dt-amb"><b>التسجيل الضريبي شرط لاستقبال الطلبات والاتفاقات الجديدة.</b><br><small>سجّل في ضريبة القيمة المضافة عبر منصة فاتورة/هيئة الزكاة والضريبة والجمارك، ثم أدخل الرقم الضريبي من تبويب «التوثيق والمستندات». ما لم تسجّل لن تظهر في البحث.</small></div>`:''}`:'';
const f=(ic,label,inner)=>`<label class=dt-f>${dtI(ic,26)}<span class=dt-fb><span class=dt-l>${label}</span>${inner}</span></label>`;
const av=pv.avatar?`<img src="/api/files/${+pv.avatar}" alt="">`:dtI('user',30);
const req=isH?`<details class=dt-req><summary>طلب تغيير نوع الحساب</summary><div class=dt-reqb><select id=htReq aria-label="النوع الجديد"><option value=establishment>مؤسسة</option><option value=company>شركة</option></select><button type=button class="btn alt sm" id=htSend>إرسال الطلب</button></div><small>تتم مراجعة طلب تغيير النوع من الإدارة قبل اعتماده.</small></details>`:'';
const go=isH?`<button type=button class=dt-go id=toClient><span class=dt-gh>${dtI('right',24)}<b>التحويل إلى عميل</b>${dtI('left',22)}</span><small>اختر النوع الجديد وأرسل الطلب، وتتم مراجعته من الإدارة.</small></button>`:`<a class=dt-go href="#/profile/specs"><span class=dt-gh>${dtI('right',24)}<b>التحويل إلى مساعد</b>${dtI('left',22)}</span><small>اختر قسم خدماتك وأكمل التسجيل لتقديم خدماتك كمساعد.</small></a>`;
return `<section class=dt id=pf-wrap hidden>${notes}<div class=dt-card>
<div class=dt-id><button type=button class=dt-av id=avEdit2 aria-label="تغيير الصورة الشخصية">${av}<i class=dt-cam>${dtI('cam',12)}</i></button><b class=dt-nm>${esc(u.name)}</b><div class=dt-mode><span>وضع المساعد</span><label class=switch><input type=checkbox id=modeT aria-label="وضع المساعد" ${isH?'checked':''}><span class=slider></span></label></div></div>
<div class=dt-type>${dtI('bank',26)}<span>نوع الحساب: ${typeName}</span></div>${req}
<form id=pf class=dt-form>${f('user','الاسم',`<input name=name value="${esc(u.name)}" placeholder="الاسم" autocomplete=name required>`)}${f('city','المدينة',`<input name=city value="${esc(u.city||'')}" placeholder="المدينة">`)}${f('phone','الجوال',`<input name=phone type=tel inputmode=tel dir=ltr value="${esc(u.phone||'')}" placeholder="05XXXXXXXX" autocomplete=tel>`)}${f('pin','العنوان',`<input name=address value="${esc(u.address||'')}" placeholder="العنوان">`)}${f('link','رابط الموقع (خرائط قوقل، اختياري)',`<input name=map_url dir=ltr maxlength=500 inputmode=url placeholder="https://maps.app.goo.gl/..." value="${esc(pv.map_url||'')}">`)}${f('code','العنوان المختصر',`<input name=short_address dir=ltr maxlength=8 pattern="[A-Za-z]{4}[0-9]{4}" placeholder="ABCD1234" value="${esc(pv.short_address||u.short_address||'')}">`)}<button class="btn dt-save">حفظ التغييرات</button></form></div>
<div class=dt-card2>${go}</div></section>`}
async function profile(){const[w,pl,sk,mine,pv,ch]=await Promise.all([api('/wallet'),api('/pledge'),api('/skills'),api('/me/sections'),api('/providers/'+me.user.id),api('/chats')]),u=me.user,RS={complete_requester:'إتمام طلب',complete_helper:'إتمام مهمة'};
const isH=u.account_type==='helper',done=w.ledger.filter(l=>l.reason==='complete_requester'||l.reason==='complete_helper').length;
const rv=pv.reviews||[],avg=rv.length?(rv.reduce((a,r)=>a+(+r.stars||0),0)/rv.length).toFixed(1):'0.0';
const parts=[u.name,u.city,u.phone,pv.bio,isH?(mine.length?1:''):1,isH?(pv.portfolio.length?1:''):1].filter(Boolean).length,pct=Math.round(parts/6*100);
const item=(key,label,hint)=>`<a class=pf-item href="#/profile/${key}"><span><b>${label}</b>${hint?`<small>${esc(hint)}</small>`:''}</span><i>‹</i></a>`;
const stylesheet=`<style>.pf-hero{display:flex;align-items:center;gap:14px;background:linear-gradient(135deg,#ece8fc,#f6f3fe);border-radius:18px;padding:18px;margin-bottom:12px}.pf-av{width:64px;height:64px;border-radius:50%;background:#6445cc;color:#fff;display:grid;place-items:center;font-size:26px;font-weight:700;flex:0 0 auto}.pf-card,.pf-wallet{border-radius:18px;padding:16px;margin-bottom:12px}.pf-card{background:#fff;border:1px solid #e9e6f6}.pf-row{display:flex;justify-content:space-between;align-items:center}.pf-pct{color:#6445cc;font-weight:700}.pf-bar{height:8px;background:#e9e6f6;border-radius:8px;margin:10px 0;overflow:hidden}.pf-bar i{display:block;height:100%;background:#6445cc;border-radius:8px}.pf-wallet{background:linear-gradient(135deg,#5331b6,#6445cc);color:#fff;display:flex;justify-content:space-between;align-items:center;gap:10px}.pf-wallet .big{font-size:26px;font-weight:700}.pf-tag{display:inline-block;background:rgba(255,255,255,.18);border-radius:999px;padding:3px 10px;font-size:12px}.pf-wallet .btn{background:#fff;color:#5331b6;border-color:#fff}.pf-wallet small,.pf-wallet .big,.pf-wallet .big small{color:#fff}.pf-hero h2{font-size:20px;line-height:1.3}.pf-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px}.pf-stats div{background:#fff;border:1px solid #e9e6f6;border-radius:14px;padding:12px;text-align:center}.pf-stats b{display:block;font-size:20px;color:#5331b6}.pf-group{margin:18px 0 8px;color:#5331b6;font-size:16px}.pf-list{background:#fff;border:1px solid #e9e6f6;border-radius:16px;overflow:hidden;margin-bottom:12px}.pf-item{width:100%;display:flex;justify-content:space-between;align-items:center;gap:10px;background:none;border:0;border-bottom:1px solid #ede8f9;padding:14px 16px;text-align:right;font:inherit;cursor:pointer}.pf-item:last-child{border-bottom:0}.pf-item span{display:flex;flex-direction:column;gap:2px}.pf-item small{color:#625a76}.pf-item i{font-style:normal;color:#9c94a8;font-size:20px}.pf-item.off{cursor:default;opacity:.7}.pf-switch{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px}.pf-types{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}.pf-type{border:2px solid #e9e6f6;border-radius:14px;padding:14px;background:#fff;text-align:center}.pf-type.on{border-color:#6445cc;background:#ece8fc;color:#5331b6;font-weight:700}details.cat{border:1px solid #e9e6f6;border-radius:14px;padding:10px 12px;margin:8px 0;background:#fff}details.cat summary{font-weight:700;color:#5331b6;cursor:pointer}details.cat label.check{display:inline-flex;align-items:center;gap:6px;border:1px solid #d9d5e8;border-radius:999px;padding:6px 12px;margin:4px 4px 0 0}details.cat label.check:has(input:checked){background:#6445cc;color:#fff;border-color:#6445cc}details.cat input[type=checkbox]{accent-color:#6445cc}.pf-foot{text-align:center;color:#625a76;font-size:13px;margin:18px 0}.pf-danger{border:1px solid #fecaca;background:#fff5f5;border-radius:16px;padding:14px;margin-top:12px}.pf-danger .btn{background:#dc2626;border-color:#dc2626;color:#fff}</style>`;
const html=`${stylesheet}${accountView(u,pv,avg,done,isH,pl)}
<section class=pf-card><div class=pf-row><b>اكمل ملفك الشخصي</b><span class=pf-pct>${pct}%</span></div><div class=pf-bar><i style="width:${pct}%"></i></div><small>أضف الجوال والمدينة والنبذة${isH?'، ومعرض أعمالك':''} لزيادة فرص ظهورك.</small></section>
<section class=pf-wallet><div><small>رصيد النقاط</small><div class=big>${w.points} <small>نقطة</small></div><span class=pf-tag>20 نقطة = ${w.riyal} ريال</span>${w.agr_due>0?`<div class=pf-due>الرصيد المالي: -${w.agr_due} ريال (عمولة اتفاق مستحقة)</div>`:''}</div><a class=btn href="#pts">تفاصيل الرصيد</a></section>
<div class=pf-group>ملفي الشخصي</div><div class=pf-list>${item('data','البيانات الشخصية','الاسم والجوال والعنوان')}${isH?item('gallery','معرض أعمالي',pv.portfolio.length?pv.portfolio.length+' صورة':'أضف صور أعمالك'):''}${me.user&&(me.user.role==='admin'||me.user.role==='staff')?'<a class=pf-item href="#/manage"><span><b>إدارة الموقع</b><small>لوحة الإدارة</small></span><i>‹</i></a>':''}</div>
<div class=pf-group>النقاط والمحفظة</div><div class=pf-list>${item('points','استخدام الرصيد')}${item('ledger','سجل النقاط')}<details class=pf-item style="display:block"><summary style="cursor:pointer">شروط النقاط</summary><p style="margin:8px 0 0;color:#625a76">الرصيد داخلي، لا يُحوَّل بين المستخدمين ولا يُسحب نقدًا، ولا يُعد دفعًا لقيمة المهمة.</p></details></div>
<div class=pf-group>الإشعارات والتواصل</div><div class=pf-list><form id=ntf class="pf-switch"><span><b>إشعارات البريد</b><small>عند وصول رسالة جديدة في محادثاتك</small></span><label class=switch><input type=checkbox name=enabled ${u.notify_email!==0?'checked':''}><span class=slider></span></label><button class=btn style="display:none" type=submit>حفظ</button></form><form id=pushf class="pf-switch"><span><b>إشعارات الدفع</b><small>تصلك الإشعارات على جهازك حتى والمنصة مغلقة</small></span><label class=switch><input type=checkbox name=enabled ${u.push_enabled!==0?'checked':''}><span class=slider></span></label></form><a class=pf-item href="#" data-act="testPush"><span><b>إرسال إشعار تجريبي</b><small>للتأكد أن الإشعارات تصل لجوالك</small></span><i>‹</i></a>${item('email','تغيير البريد الإلكتروني',u.email)}</div>

${dtCard(u,pv,isH)}\n${!isH?`<section class=panel id=conv-wrap hidden><form id=toHelper class=form><fieldset class=acct><legend>نوع الحساب</legend><label class=check style="display:flex;gap:8px;align-items:center;margin:6px 0"><input type=radio name=helper_type value=establishment checked> مؤسسة</label><label class=check style="display:flex;gap:8px;align-items:center;margin:6px 0"><input type=radio name=helper_type value=company> شركة</label><small>التسجيل متاح للمؤسسات والشركات فقط، ويلزم رقمها الضريبي لاستقبال الطلبات.</small></fieldset><label id=vatWrap hidden>الرقم الضريبي (15 رقمًا يبدأ بـ 3)<input name=vat_number inputmode=numeric maxlength=15 dir=ltr pattern="3[0-9]{14}" placeholder="3XXXXXXXXXXXXXX" autocomplete=off></label><small>اختر قسمًا أو قسمين من خدماتك (مثل السباكة والكهرباء).</small><div class=secs>${specBoxes(sk.categories)}</div><button class=btn>التحويل إلى مساعد</button></form></section>`:''}
${isH?`<section class=panel id=skf-wrap hidden><div class=sec-h><h3>قسم خدماتك</h3></div><small>اختر قسمًا أو قسمين (مثل السباكة والكهرباء). يظهر اسمك في البحث، وتتواصل معك الطلبات عبر المحادثات.</small><form id=skf class=form><div class=spec-choice role=group aria-label="اختيار التخصص"><button type=button class=sc data-set="كهرباء">⚡ كهرباء</button><button type=button class=sc data-set="سباكة">🚿 سباكة</button><button type=button class=sc data-set="both">⚡🚿 معًا</button></div><div class=secs>${specBoxes(sk.categories,mine)}</div><button class=btn type=button id=skbtn>حفظ قسم خدماتك</button></form><details><summary>اقترح تخصصًا جديدًا</summary><form id=sugf class=form><label>القسم<select name=category_id>${sk.categories.map(c=>`<option value=${c.id}>${esc(c.name)}</option>`).join('')}</select></label><label>اسم التخصص<input name=name required minlength=2 maxlength=60></label><label>كلمات تساعد البحث (اختياري، افصل بفاصلة)<input name=keywords maxlength=300></label><button class=btn>إرسال للمراجعة</button><small>يظهر للعملاء بعد اعتماد الإدارة.</small></form></details></section>`:''}
<section class=panel id=pw-wrap hidden><div class=sec-h><h3>تغيير كلمة المرور</h3></div><form id=pwF class=form><label>كلمة المرور الحالية<input name=current type=password required autocomplete=current-password></label><label>كلمة المرور الجديدة (8 أحرف على الأقل)<input name=password type=password minlength=8 required autocomplete=new-password></label><button class=btn>حفظ كلمة المرور</button></form></section>
<section class=panel id=emf-wrap hidden><div class=sec-h><h3>تغيير البريد الإلكتروني</h3></div><small>البريد الحالي: ${esc(u.email)}</small><form id=emf class=form><label>البريد الجديد<input name=email type=email dir=ltr required></label><label>كلمة المرور للتأكيد<input name=password type=password required></label><button class=btn>تغيير البريد</button></form></section>
<section class=panel id=pts><div class=sec-h><h3>استخدام الرصيد</h3></div><form id=rf class=form><label>عدد النقاط<input name=points type=number min=1 max=${w.points} required></label><label>الخدمة أو الرسم<input name=purpose required></label><button class=btn>استخدام الرصيد</button></form></section>
<section class=panel id=ledger><div class=sec-h><h3>سجل النقاط</h3></div>${w.ledger.map(l=>`<div class=row><span>${esc(RS[l.reason]||l.reason)}</span><b dir=ltr>${l.delta>0?'+':''}${l.delta}</b><small>${l.created_at.slice(0,10)}</small></div>`).join('')||'<div class=empty>لا توجد عمليات بعد. تُضاف النقاط عند اكتمال مهمة مؤهلة.</div>'}</section>
<section class=panel id=gal-wrap><div class=sec-h><h3>معرض أعمالي</h3></div><form id=bioF class=form><label>نبذة عنك (تظهر لمن يبحث عنك)<textarea name=bio rows=3 maxlength=500>${esc(pv.bio)}</textarea></label><button class=btn>حفظ النبذة</button></form><div class=gal style="margin-top:10px">${pv.portfolio.map(x=>`<figure>${mediaTag(x)}<figcaption>${esc(x.caption||'')}</figcaption><button class=lnk data-pdel=${x.id}>حذف</button></figure>`).join('')||'<small>لم تضف صورًا لأعمالك بعد.</small>'}</div><button class="btn alt" id=addPh style="margin-top:10px">إضافة صورة أو فيديو</button></section>

<div class=pf-group>الأمان</div><div class=pf-list><a class=pf-item href="#/profile/password"><span><b>تغيير كلمة المرور</b></span><i>‹</i></a><a class=pf-item href="#" data-act="logout"><span><b>تسجيل الخروج</b></span><i>‹</i></a></div>
<div class=pf-danger><h3 style="margin:0;color:#b91c1c">حذف الحساب</h3><small>تُحذف بياناتك الشخصية، ويبقى سجل العمليات المالية محفوظًا كما يتطلب النظام. لا يمكن التراجع.</small><form id=delF class=form><label>كلمة المرور<input name=password type=password required autocomplete=current-password></label><label>اكتب «حذف» للتأكيد<input name=confirm required></label><button class="btn">حذف حسابي نهائيًا</button></form></div>
<div class=pf-foot>الشروط والأحكام · سياسة الخصوصية · تواصل معنا</div>`;
app.innerHTML=html;

document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{const t=document.getElementById(b.dataset.go);if(!t)return;if(t.id==='pf-wrap'||t.id==='emf-wrap')t.hidden=false;t.scrollIntoView({behavior:'smooth',block:'start'})});

const key=crypto.randomUUID();
if($('#ntf'))$('#ntf input[name=enabled]').onchange=()=>$('#ntf').requestSubmit();
$('#rf').onsubmit=sub(async b=>{const p=+b.points;if(!confirm(`سيُخصم ${p} نقطة (${p/20} ريال) ويتبقى ${w.points-p} نقطة. متابعة؟`))return;await api('/wallet/redeem','POST',{...b,key});toast('تم استخدام الرصيد');profile()});
$('#pf').onsubmit=sub(async b=>{await api('/profile','POST',b);await boot();toast('تم الحفظ');await route()});
if($('#modeT'))$('#modeT').onchange=async e=>{if(e.target.checked){location.hash='#/profile/specs';toast('أكمل تسجيلك كمساعد من هنا');return}if(!confirm('سيتم إخفاء أقسامك من البحث. متابعة؟')){e.target.checked=true;return}try{await api('/me/account-type','POST',{type:'client'});await boot();toast('تم التحويل إلى عميل');profile()}catch(x){e.target.checked=true;toast(x.message,1)}};
if($('#toClient'))$('#toClient').onclick=async()=>{if(!confirm('سيتم إخفاء أقسامك من البحث. متابعة؟'))return;try{await api('/me/account-type','POST',{type:'client'});await boot();toast('تم التحويل إلى عميل');profile()}catch(x){toast(x.message,1)}};
if($('#toHelper')){const vatSync=()=>{const t=(document.querySelector('#toHelper input[name=helper_type]:checked')||{}).value;const need=t==='establishment'||t==='company';const w=$('#vatWrap'),i=$('#toHelper input[name=vat_number]');w.hidden=!need;i.required=need;if(!need)i.value='';};document.querySelectorAll('#toHelper input[name=helper_type]').forEach(r=>r.addEventListener('change',vatSync));vatSync()}
if($('#toHelper'))$('#toHelper').onchange=specLimit;if($('#toHelper'))$('#toHelper').onsubmit=sub(async b=>{const ids=[...document.querySelectorAll('#toHelper input[name=cat]:checked')].map(x=>+x.value);const ht=(document.querySelector('#toHelper input[name=helper_type]:checked')||{}).value;const vn=(document.querySelector('#toHelper input[name=vat_number]')||{}).value||'';await api('/me/account-type','POST',{type:'helper',category_ids:ids,helper_type:ht,vat_number:vn});await boot();toast('تم التحويل إلى مساعد');profile()});
if($('#pushf'))pushActive().then(a=>{const i=$('#pushf input');if(i&&!a)i.checked=false});
if($('#pushf'))$('#pushf input').onchange=async e=>{if(e.target.checked){if(!(await enablePush())){e.target.checked=false;return}me.user.push_enabled=1}else{try{await api('/push/pref','POST',{enabled:false});me.user.push_enabled=0;toast('أُوقفت إشعارات الدفع')}catch(x){toast(x.message,1);e.target.checked=true}}};
if($('#ntf'))$('#ntf').onsubmit=sub(async()=>{await api('/me/notify','POST',{enabled:$('#ntf input[name=enabled]').checked});await boot();toast('تم حفظ إعدادات الإشعارات');location.hash='#/profile'});
if($('#pwF'))$('#pwF').onsubmit=sub(async b=>{await api('/me/password','POST',{current:b.current,password:b.password});toast('تم تغيير كلمة المرور');location.hash='#/profile'});
if($('#emf'))$('#emf').onsubmit=sub(async b=>{const r=await api('/me/email','POST',b);await boot();toast(r.mailed===false?'تم تغيير البريد، لكن تعذّر إرسال رمز التفعيل، استخدم زر إعادة الإرسال لاحقًا':'تم تغيير البريد');profile()});
if($('#skf'))$('#skf').onchange=specLimit;
if($('#skbtn'))$('#skbtn').onclick=async()=>{try{const ids=[...document.querySelectorAll('#skf input[name=cat]:checked')].map(x=>+x.value);await api('/me/sections','POST',{category_ids:ids});toast('تم حفظ قسم خدماتك');location.hash='#/profile'}catch(x){toast(x.message,1)}};
const specSync=()=>{const sel=[...document.querySelectorAll('#skf input[name=cat]:checked')].map(x=>x.closest('.cat-card').dataset.n);document.querySelectorAll('.sc').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.set==='both'?sel.length>1:sel.length===1&&sel[0]===x.dataset.set)))};
if($('#skf'))$('#skf').addEventListener('change',specSync);
document.querySelectorAll('.sc').forEach(b=>b.onclick=()=>{document.querySelectorAll('#skf input[name=cat]').forEach(x=>{x.checked=b.dataset.set==='both'||x.closest('.cat-card').dataset.n===b.dataset.set});specSync()});specSync();

if($('#sugf'))$('#sugf').onsubmit=sub(async b=>{await api('/skills/suggest','POST',b);toast('أُرسلت المهارة للمراجعة');profile()});
$('#bioF').onsubmit=sub(async b=>{await api('/me/bio','POST',b);toast('تم حفظ النبذة');location.hash='#/profile'});
$('#delF').onsubmit=sub(async b=>{if(!confirm('سيُحذف حسابك نهائيًا. هل أنت متأكد؟'))return;try{await api('/me/delete','POST',b);await dropPush();await api('/logout','POST');toast('تم حذف حسابك');await boot();location.hash='#/'}catch(x){toast(x.message,1)}});

document.querySelectorAll('[data-pdel]').forEach(b=>b.onclick=async()=>{try{await api(`/me/portfolio/${b.dataset.pdel}/delete`,'POST');profile()}catch(x){toast(x.message,1)}})}
async function notifs(){const l=await api('/notifications');app.innerHTML=`<h2>الإشعارات</h2><div class=panel>${l.map(n=>`<a class=row href="${esc(n.link||'#/notifs')}"><span>${esc(n.text)}${n.read?'':' •'}</span><small>${n.created_at.slice(0,16)}</small></a>`).join('')||'<div class=empty>لا توجد إشعارات.</div>'}</div>`;me.unread=0;nav()}

async function dropPush(){try{const reg=await navigator.serviceWorker?.getRegistration('/sw.js');const sub=await reg?.pushManager.getSubscription();if(sub){await api('/push/unsubscribe','POST',{endpoint:sub.endpoint});await sub.unsubscribe()}}catch{}}
async function logout(){await dropPush();await api('/logout','POST');await boot();location.hash='#/'}
const LG_ART={terms:'<svg viewBox="0 0 120 120" width="96" height="96" fill="none" stroke="#5331b6" stroke-width="3" stroke-linejoin="round"><path d="M30 16h42l18 18v70H30z" fill="#fff"/><path d="M72 16v18h18"/><path d="M42 56h36M42 68h36M42 80h24"/><circle cx="90" cy="94" r="14" fill="#8a6cff" stroke="none"/><path d="M84 94l4 4 8-8" stroke="#fff" stroke-width="3"/></svg>',privacy:'<svg viewBox="0 0 120 120" width="96" height="96" fill="none" stroke="#5331b6" stroke-width="3" stroke-linejoin="round"><path d="M60 12l38 14v30c0 26-16 44-38 52-22-8-38-26-38-52V26z" fill="#fff"/><rect x="46" y="56" width="28" height="24" rx="4"/><path d="M51 56v-7a9 9 0 0118 0v7"/><circle cx="60" cy="68" r="3" fill="#8a6cff" stroke="none"/></svg>'};
async function agreementPage(id){let g;try{g=await api('/agreements/'+id)}catch(x){app.innerHTML='<section class=panel><p>'+esc(x.message)+'</p></section>';return}
const S={pending:'بانتظار الموافقة',agreed:'متفق عليه',completion_requested:'بانتظار تأكيد العميل',completed:'مكتمل',disputed:'نزاع قيد المراجعة',closed_disputed:'مغلق بعد المراجعة',cancelled:'ملغى'};
const money=n=>Number(n||0).toFixed(2)+' ريال';
const pr=p=>p?`${esc(p.name||'')}${p.city?' · '+esc(p.city):''}${p.phone?'<br><small>الجوال: '+esc(p.phone)+'</small>':''}${p.email?'<br><small>البريد: '+esc(p.email)+'</small>':''}`:'';
const tl=(g.timeline||[]).map(x=>`<li>${esc(String(x.at).slice(0,16).replace('T',' '))} · ${esc(x.event)}</li>`).join('');
app.innerHTML=`<section class="panel agr-doc" id=agrdoc><div class=sec-h><h3>سجل الاتفاق رقم ${g.id}</h3></div>
<p><b>الحالة:</b> ${esc(S[g.status]||g.status)}</p>
<p><b>وصف الخدمة:</b> ${esc(g.description||'')}</p>
<p><b>المبلغ المتفق عليه:</b> ${money(g.amount)}</p>
<p><small>${esc(g.vat_note||'')}</small></p>${notesBox(g)}
<p><b>مقدم الخدمة:</b><br>${pr(g.helper)}</p>
<p><b>طالب الخدمة:</b><br>${pr(g.client)}</p>
<p><b>عمولة المنصة:</b> ${g.commission_pct}% من المبلغ المتفق عليه = ${money(g.commission_amount)}${g.commission_status?' · الحالة: '+esc(g.commission_status):''}</p>
<h4>الخط الزمني</h4><ul>${tl}</ul>
<p><small>${esc(g.platform_note||'')}</small></p>
<div class="no-print" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class=btn id=prB>حفظ أو طباعة السجل</button><a class="btn alt" href="#/chats">رجوع</a></div></section>`;
if(g.status==='completed'&&me.user&&[g.helper&&g.helper.id,g.client&&g.client.id].includes(me.user.id)){$('#agrdoc').insertAdjacentHTML('beforeend',`<form class=panel id=rtf><h4>قيّم الطرف الآخر</h4><select name=stars required><option value=5>5 نجوم</option><option value=4>4 نجوم</option><option value=3>3 نجوم</option><option value=2>2 نجمتان</option><option value=1>نجمة واحدة</option></select><textarea name=comment maxlength=500 placeholder="تعليق (اختياري)"></textarea><button class=btn>إرسال التقييم</button></form>`);$('#rtf').onsubmit=sub(async b=>{await api('/agreements/'+g.id+'/rate','POST',{stars:+b.stars,comment:b.comment});toast('شكرًا لتقييمك');agreementPage(g.id)})}
$('#prB').onclick=()=>window.print()};
const LEGAL={terms:[["1. تعريف المنصة ودورها","«المساعد» منصة إلكترونية تشغّلها مؤسسة المساعد، وهي كيان تجاري مقيد في السجل التجاري برقم 7054975474، ومقرها الدمام، وسيلة التواصل: 0508952943، والبريد الرسمي للدعم: support@almusaidgroup.shop. تتيح المنصة للعميل طلب خدمة، وللمساعد عرض خدماته، وتسهّل التواصل بينهما وتسجيل الاتفاق. المنصة وسيط تقني، ولا تقدّم الخدمة بنفسها، ولا تحدد سعرها النهائي، ولا تضمن نتيجة أي مهمة أو أداء أي من الطرفين."],["2. الاتفاقات بين الطرفين","يتفق العميل والمساعد على نطاق الخدمة وسعرها داخل المنصة. يُعتمد الاتفاق بموافقة الطرف الآخر، ولا يُعد اعتماد الاتفاق وحده إنشاءً لأي عمولة. الاتفاق بين الطرفين يُلزم كليهما، والمساعد مقدم خدمة مستقل يقبل المهام ويسعّرها ويحدد طريقة تنفيذها."],["3. الطلبات والمهام والإنجاز","يحق للمساعد طلب تأكيد إنجاز المهمة من داخل الاتفاق، ولا يُسجَّل الإنجاز إلا بتأكيد العميل. تنشأ العمولة عند تأكيد العميل، ولا تنشأ بمجرد الصمت. وإذا لم يؤكد العميل ولم يعترض، تُرسل للعميل تذكيرات، ويجوز للمنصة إغلاق الاتفاق إداريًا دون عمولة، مع بقاء حق الشكوى."],["4. السعر والدفع","يدفع العميل قيمة الخدمة أونلاين عبر بوابة الدفع لدى شركة هلا، وتتولى هلا تحصيل المبلغ وتوزيعه وفق التعليمات المضبوطة من المنصة: نسبة المنصة (العمولة) إلى حسابها، والباقي إلى المساعد. المنصة لا تحتفظ بالأموال ولا تديرها بنفسها. يُضاف على سعر الخدمة ضريبة القيمة المضافة 15% عند تسجيل المنصة أو المساعد في الضريبة. إذا كان المساعد مسجلًا في الضريبة فهو من يُصدر فاتورة الخدمة للعميل، وإذا لم يكن مسجلًا فتعامل المنصة كمورّد مفترض وتُصدر الفاتورة للعميل عن كامل المبلغ."],["5. عمولة المنصة","تحصل المنصة عمولة وساطة قدرها 5% من قيمة الخدمة المتفق عليها، وتُخصم عند التوزيع قبل تحويل الباقي للمساعد. وإذا كان المساعد مسجلًا في الضريبة، تُضاف ضريبة 15% على عمولة المنصة وتُصدر بها المنصة فاتورة للمساعد. ويُحسب الاستحقاق كالآتي:\n- لا تُستحق العمولة عند اعتماد الاتفاق وحده.\n- تُستحق العمولة عند تأكيد العميل إتمام المهمة في المنصة.\n- لا تُستحق عن المهمة الملغاة، أو المعترض عليها، أو المنفذة جزئيًا.\n- يصل المساعد الصافي (قيمة الخدمة بعد خصم العمولة) بصرف النظر عن حالة تسجيله في الضريبة.\n- يبدأ المساعد المسجل في ضريبة القيمة المضافة العمل فور إدخال رقمه الضريبي، وتتحقق المنصة من الرقم لاحقًا، فإن تبيّن خطؤه أُوقف استقبال الطلبات والاتفاقات الجديدة حتى يُصحَّح الرقم."],["6. الدفع","يتم الدفع أونلاين عبر بوابة هلا، وتُخصم العمولة وتُوزَّع النسب تلقائيًا عند نجاح الدفع، دون أي تحويل يدوي."],["7. الإلغاء والعقوبات","يحق للطرفين إلغاء الاتفاق قبل اعتماده دون عقوبة. وبعد الاعتماد وقبل الإنجاز، يجوز إلغاؤه بالتراضي، ويُحدد في الإلغاء ما يُرد وما يُستحق. ويحق للمستهلك، في الحالات التي تنطبق عليها أحكام نظام التجارة الإلكترونية إذا لم يستخدم الخدمة أو ينتفع بها، فسخ العقد خلال سبعة أيام من التعاقد دون أن يتحمل تكاليف الفسخ إلا إذا اتفق الطرفان على غير ذلك خلال سبعة أيام من التعاقد إذا لم ينتفع بالخدمة، وفق الاستثناءات النظامية. ويحق للمستهلك فسخ العقد واسترداد ما دفعه والتكاليف الناتجة عن التأخير إذا تأخر المساعد أكثر من خمسة عشر يومًا من إبرام العقد أو عن الموعد المتفق عليه، ما لم يكن التأخير بسبب قوة قاهرة. ولا تُستحق العمولة عن الاتفاق الملغى."],["8. الشكاوى وفض النزاعات","لكل طرف تقديم شكوى عبر المنصة، وتُعالج وفق سياسة الشكاوى وفض النزاعات المنشورة. تقديم الشكوى بعد تأكيد الإنجاز يوقف العمولة مؤقتًا. ولا تحل المنصة محل المحكمة في الحقوق المالية أو التعويضات بين الطرفين."],["9. المحتوى والبلاغات","يلتزم المستخدمون بعدم نشر محتوى مخالف للأنظمة، أو مسيء، أو تمييزي، أو يتضمن بيانات أشخاص آخرين دون إذن. يمكن الإبلاغ عن أي محتوى، وللمنصة إخفاء المحتوى أو حذفه عند المخالفة مع توثيق القرار."],["10. الترخيص للمهن المنظمة","إذا كانت الخدمة تتطلب ترخيصًا أو تصريحًا نظاميًا، يلتزم المساعد بتقديمه وبيان الجهة المانحة ورقمه وتاريخ انتهائه، ولا يجوز عرض الخدمة قبل ذلك."],["11. حدود المسؤولية","لا تضمن المنصة نتيجة المهام أو أداء أي من الطرفين، ولا تتحمل الخسائر الناتجة عن تصرفات الطرفين أو اتفاقاتهما أو عن أسباب خارجة عن سيطرتها، وذلك في الحدود التي تسمح بها الأنظمة السعودية. ولا يُخل هذا بمسؤوليتها عن التزاماتها النظامية كمنصة وعن حماية بيانات المستخدمين. ولا يسري أي استبعاد للمسؤولية على الغش أو الخطأ الجسيم أو ما لا يجوز استبعاده نظامًا."],["12. الإيقاف وإنهاء الحساب","للمنصة تعليق الحساب أو تقييده عند وجود سبب محدد، كالاشتباه الجدي بالاحتيال، أو خطر على المستخدمين، أو مخالفة الأنظمة أو الشروط، أو تكرار الإلغاء. في الحالات العاجلة يجوز التعليق فورًا مع توثيق السبب ومراجعته. وفي غيرها يُشعَر المستخدم بالسبب كتابةً، ويُمنح مهلة للرد والاعتراض، ويراجع الاعتراض شخص لم يتخذ القرار الأول. يحق للمستخدم إغلاق حسابه من ملفه الشخصي."],["13. الملكية الفكرية","محتوى المنصة وشعارها وتصميمها مملوك للمشغّل. لا يجوز نسخه أو إعادة استخدامه دون إذن كتابي."],["14. تعديل الشروط","يحق للمنصة تعديل هذه الشروط. تُشعَر المستخدمين المسجلين بالتعديلات الجوهرية قبل تطبيقها بأسبوع على الأقل، ويُعلن عنها داخل الموقع. ولا يسري التعديل على الاتفاقات السابقة إلا وفق ما يتفق عليه الطرفان أو ما تنص عليه الأنظمة."],["15. القانون الواجب التطبيق والاختصاص","تخضع هذه الشروط لأنظمة المملكة العربية السعودية. تُحال المنازعات الناشئة عنها إلى المحاكم المختصة في المملكة، بعد محاولة تسويتها ودّيًا وفق سياسة الشكاوى وفض النزاعات."],["16. المنشورات العامة","يُنشر المحتوى العام للمسجلين فقط، ويظهر لجميع الزوار مع اسم الناشر. يلتزم الناشر بعدم نشر ما يخالف الأنظمة أو يسيء أو يميّز أو ينتهك حقوق الغير أو خصوصيتهم. للمستخدم حذف منشوره في أي وقت. يحق للمنصة إخفاء أي منشور عند تكرار البلاغ عنه أو مخالفته، وتراجعه الإدارة. ولا تتحمل المنصة محتوى ما ينشره المستخدمون، وتتعامل معه وفق سياسة البلاغ والإخفاء."]],privacy:[["1. هوية جهة التحكم","الجهة المسؤولة عن معالجة بياناتك هي مؤسسة المساعد، كيان تجاري مقيد برقم سجل 7054975474، مقره الدمام، وسيلة التواصل: 0508952943، والبريد الرسمي: support@almusaidgroup.shop."],["2. البيانات التي نجمعها والغرض منها","- بيانات الحساب (الاسم، البريد، الجوال، المدينة، العنوان الاختياري): لإنشاء الحساب وإدارته والتواصل معك. تقديم الاسم والبريد والمدينة إلزامي، والعنوان والجوال اختياريان إلا عند الحاجة إليهما في تأكيد الاتفاق أو الدفع.\n- بيانات المساعد (القسم، والحالة الضريبية، والرقم الضريبي إن وُجد): لتصنيف الخدمة والالتزام بالأنظمة الضريبية. الرقم الضريبي يُطلب فقط عند التسجيل.\n- الطلبات والعروض والمحادثات والاتفاقات والمرفقات: لتنفيذ الخدمة وتسجيل الاتفاق وحل النزاعات.\n- إثباتات التحويل: لتسجيل ما يقرره الطرفان. المنصة لا تستلم قيمة المهمة.\n- رسائل التواصل والبلاغات: للرد عليها ومعالجتها.\n- بيانات تقنية (عنوان الشبكة، ونوع المتصفح، ووقت الموافقة على الشروط): لحماية الحساب ومنع الإساءة، وإثبات الموافقة."],["3. مع من تُشارك بياناتك","لا نبيع بياناتك. يظهر للطرف الآخر في الاتفاق: الاسم، والمدينة، ومعلومات المهمة والمرفقات المتعلقة بها، ووسيلة التواصل (الجوال والبريد) بعد اعتماد الاتفاق. ويصل إلى البيانات فريق الإدارة والدعم بحسب الصلاحيات المحددة وعند الحاجة فقط."],["4. جهة معالجة ونقل البيانات","تُعالج بيانات الدفع لدى شركة هلا بصفتها جهة معالجة وتحصيل. تُستضاف المنصة وقاعدة بياناتها لدى Render في منطقة أوهايو (Ohio, US East) بالولايات المتحدة الأمريكية، وتُرسل رسائل البريد عبر Resend، ويُدار نطاق الموقع والبريد الرسمي للدعم لدى Hostinger International Ltd. (لارنكا، قبرص). نقتصر على الحد الأدنى من البيانات اللازم لكل مزود، ونتحقق من ضمانات الحماية لديهم."],["5. مدد الاحتفاظ","- بيانات العقود والاتفاقات والمعاملات المبرمة عبر المنصة: 3 سنوات على الأقل من تاريخ إبرام العقد، وفق الأنظمة.\n- المحادثات والمرفقات: تُحفظ مع الاتفاق المرتبط بها، وتُتلف بعد انقضاء مدة الاحتفاظ بالعقود إلا إذا كانت مرتبطة بنزاع قائم.\n- بيانات الحساب: طوال مدة الحساب، ويُتلف ما انتهت الحاجة إليه بعد إغلاق الحساب، مع الاحتفاظ بما يلزم نظامًا.\n- البلاغات وسجلات الإدارة: للمدة اللازمة لمعالجتها وحماية الحقوق.\n- السجلات المالية والضريبية: وفق المدد النظامية المقررة لها.\n- النسخ الاحتياطية: تُحذف وفق دورتها المعلنة."],["6. حقوقك","لك الحق في: العلم بمعالجة بياناتك، والوصول إليها، والحصول على نسخة منها (من ملفك الشخصي أو بطلب)، وطلب تصحيحها، وطلب إتلاف ما انتهت الحاجة إليه، مع مراعاة الاستثناءات النظامية (كالسجلات الواجب حفظها). لممارسة حقوقك تواصل معنا عبر البريد الرسمي للدعم، وسنتحقق من هويتك قبل الاستجابة، ونرد في المدة النظامية."],["7. إغلاق الحساب وحذف البيانات","يمكنك إغلاق حسابك من ملفك الشخصي. يُعطَّل الحساب، وتُخفى معلوماته الشخصية الظاهرة، وتبقى السجلات التي يلزم حفظها نظامًا أو لارتباطها بعقود أو نزاعات قائمة. ويمكنك طلب إتلاف البيانات الأخرى عبر الدعم."],["8. الأمان","تُجزّأ كلمات المرور بخوارزمية آمنة، ولا تُحفظ بصيغتها الأصلية. تُحمى الجلسات بملفات ارتباط لا يمكن قراءتها من الصفحات. نطبق صلاحيات مختلفة لكل دور، ونسجّل العمليات الإدارية الحساسة."],["9. ملفات الارتباط والتتبع","تستخدم المنصة ملف جلسة واحدًا لتسجيل الدخول فقط. لا نستخدم أدوات تتبع إعلانية من أطراف ثالثة، ولا نحمّل خطوطًا أو مكتبات من خدمات خارجية."],["10. حوادث البيانات","إذا تعرضت بياناتك لاختراق أو وصول غير مشروع، تُبلّغ المنصة الوزارة المختصة والمتأثرين خلال ثلاثة أيام من علمها بالاختراق، مع بيان نطاقه وآثاره والتدابير المتخذة، ومراعاة إشعارات نظام حماية البيانات الشخصية في الحالات التي يحددها."],["11. الإفصاح للجهات الرسمية","قد نفصح عن بيانات محددة للجهات العامة عند وجود سند نظامي، كالمصلحة العامة أو الأمن أو تنفيذ نظام أو استيفاء متطلبات قضائية، ولا نفصح إلا بالقدر اللازم، ونوثّق كل إفصاح."],["12. التعديل","قد نحدّث هذه السياسة، وتُشعَر بالتعديلات الجوهرية قبل تطبيقها بأسبوع على الأقل."],["13. التواصل","لأي استفسار أو طلب بخصوص بياناتك: الدعم عبر البريد الرسمي المعلن في صفحة تواصل معنا، أو الاتصال على 0508952943."],["14. المنشورات العامة","تُعرض المنشورات والصور والفيديوهات التي تنشرها للجميع مع اسمك الكامل وصفتك (عميل أو مساعد) وتاريخ النشر. لا تُعرض معلومات التواصل الخاصة بك (الجوال والبريد) في المنشور. يمكنك حذف منشورك في أي وقت، ويُخفى فورًا عن الزوار."]],complaints:[["1. نطاق الشكوى","تشمل الشكوى جودة الخدمة، أو تأخرها، أو عدم تنفيذها، أو سلوك أحد الطرفين، أو الخلاف على الإنجاز أو السعر."],["2. طريقة تقديم الشكوى","تُقدَّم الشكوى من داخل الاتفاق بعد الإنجاز أو الاعتراض عليه، أو عبر البريد الرسمي للدعم support@almusaidgroup.shop. تُسجَّل الشكوى مع تاريخها ومقدمها والاتفاق المرتبط بها."],["3. الأدلة","لكل طرف أن يقدم الأدلة: الاتفاق والسعر، والمحادثات داخل المنصة، والصور أو الملفات، وإثبات التنفيذ أو الملاحظات عليه. تُمنح للطرفين فرصة متساوية لتقديم ردودهما."],["4. المراجعة الأولية والتسوية الودية","يُعيَّن مسؤول لفض النزاع لا يكون طرفًا في الاتفاق ولم يشارك في أي قرار سابق بشأنه. يحاول المسؤول التوصل إلى تسوية ودية. لا تفرض المنصة على أي طرف قبول تسوية أو رد مبلغ، لأن التحويل يتم مباشرة بين العميل والمساعد."],["5. القرار الأولي","إذا لم تتم التسوية، يصدر المسؤول قرارًا إداريًا معللًا بإحدى الحالات: ثبت الإنجاز، أو لم يثبت الإنجاز، أو تنفيذ جزئي، أو تعذّر الحسم بالأدلة المتاحة. لا يُعد سكوت العميل وحده قبولًا، ولا يُعد ادعاء أحد الطرفين وحده دليلًا كافيًا."],["6. المراجعة الثانية والاعتراض","يراجع القرار الأولي مسؤول آخر لم يشارك في القرار الأول، ويكون قراره نهائيًا داخل المنصة."],["7. أثر الشكوى على العمولة","تتوقف العمولة مؤقتًا أثناء الشكوى. إذا ثبت الإنجاز تُستحق العمولة، وإذا لم يثبت أو أُلغي الاتفاق لا تُستحق، وتُعكس العمولة التي سبق تسجيلها."],["8. المهل المقترحة","إجراءات تشغيلية داخلية وليست مدداً نظامية: تقديم الردود والأدلة خلال يومي عمل، ومحاولة التسوية خلال 3 أيام عمل بعد اكتمال الردود، والقرار الأولي خلال 3 أيام عمل بعد انتهاء التسوية، وتقديم الاعتراض خلال يومي عمل، والبت فيه خلال يومي عمل. ويجوز تمديد واحد لا يتجاوز 5 أيام عمل بعد إشعار الطرفين."],["9. ما لا تحسمه المنصة","القرار الإداري داخل المنصة فقط. لا يحسم الحقوق المالية أو التعويضات بين العميل والمساعد، ولا يحل محل حكم المحكمة. ولكل طرف الحق في اللجوء إلى المحكمة المختصة في المملكة العربية السعودية."],["10. التواصل","للشكاوى والاستفسارات: support@almusaidgroup.shop أو الاتصال على 0508952943."]]};
const orgInfo=async()=>{try{return await api('/org')}catch{return{}}};
async function renderFooter(){$('#ft').hidden=true;return;const o=await orgInfo(),ph=o.support_phone?`<a href="tel:${esc(o.support_phone.replace(/\s/g,''))}" dir=ltr>${esc(o.support_phone)}</a>`:'',em=o.support_email?`<a href="mailto:${esc(o.support_email)}" dir=ltr>${esc(o.support_email)}</a>`:'';
$('#ft').innerHTML=`<div class=ft-grid><div><b class=ft-logo>المساعد</b><p>منصة تربط طالب المساعدة بالمساعد بعقد واضح وسعر متفق عليه قبل البدء.</p></div><div><h4>المنصة</h4><a href="#/">الرئيسية</a><a href="#/about">من نحن</a><a href="#/contact">تواصل معنا</a></div><div><h4>قانوني</h4><a href="#/terms">الشروط والأحكام</a><a href="#/privacy">سياسة الخصوصية</a></div><div><h4>تواصل معنا</h4>${em||'<span>البريد قريبًا</span>'}${ph}${o.support_address?`<p>${esc(o.support_address)}</p>`:''}</div></div><div class=ft-bot><span>© ${new Date().getFullYear()} ${esc(o.org_name||'المساعد')}</span>${o.org_cr?`<span>سجل تجاري ${esc(o.org_cr)}</span>`:''}</div>`}
async function about(){const o=await orgInfo(),name=esc(o.org_name||'المساعد');
const ico={doc:'<svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="#5331b6" stroke-width="3" stroke-linejoin="round"><path d="M16 8h26l10 10v38H16z"/><path d="M24 30h18M24 38h18M24 46h10"/></svg>',shield:'<svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="#5331b6" stroke-width="3" stroke-linejoin="round"><path d="M32 6l22 8v16c0 14-10 24-22 28-12-4-22-14-22-28V14z"/><rect x="24" y="30" width="16" height="14" rx="2"/><path d="M27 30v-4a5 5 0 0110 0v4"/></svg>',star:'<svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="#5331b6" stroke-width="3" stroke-linejoin="round"><circle cx="32" cy="24" r="12"/><path d="M32 16l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill="#8a6cff" stroke="none"/><path d="M22 44l-4 14 14-6 14 6-4-14"/></svg>'};
const card=(n,icon,t,d)=>`<div class=ab-card><div class=ab-num>${n}</div><div class=ab-ic>${icon}</div><h3>${t}</h3><p>${d}</p></div>`;
const step=(n,t,d)=>`<div class=ab-step><div class=ab-num>${n}</div><div><h3>${t}</h3><p>${d}</p></div></div>`;
app.innerHTML=`<style>.ab-hero{background:#fff;border:1px solid #e3dcf8;border-radius:22px;padding:22px;margin:6px 0 16px;background:linear-gradient(#f6f3ff,#fff)}.ab-hero h1{margin:0 0 10px;font-size:26px;color:#5331b6}.ab-hero p{margin:0;line-height:1.9;color:#3a3454}.ab-card{position:relative;background:#fff;border:1px solid #e9e6f6;border-radius:20px;padding:18px;margin-bottom:14px;box-shadow:0 6px 18px rgba(0,0,0,.05)}.ab-card .ab-num{position:absolute;top:8px;left:16px;font-size:58px;font-weight:800;color:#cfc4f7;line-height:1}.ab-card .ab-ic{margin:4px 0 6px}.ab-card h3{margin:0 0 6px;font-size:19px;color:#0d0a2c}.ab-card p{margin:0;color:#4d4666;line-height:1.8}.ab-sec{background:#fff;border-radius:22px;padding:18px;margin:16px 0;box-shadow:0 6px 18px rgba(0,0,0,.05)}.ab-sec>h2{margin:0 0 14px;font-size:22px;color:#0d0a2c}.ab-step{position:relative;display:flex;gap:12px;align-items:flex-start;background:#fff;border:1px solid #ede8f9;border-radius:16px;padding:16px;margin-bottom:10px}.ab-step .ab-num{position:static;font-size:44px;font-weight:800;color:#cfc4f7;line-height:1;min-width:34px}.ab-step h3{margin:0 0 4px;font-size:18px;color:#0d0a2c}.ab-step p{margin:0;color:#4d4666;line-height:1.7}.ab-val{background:#fff;border:1px solid #e9e6f6;border-radius:18px;padding:18px;margin:16px 0}.ab-val h2{margin:0 0 6px;font-size:22px}.ab-val h3{margin:12px 0 8px;font-size:18px;color:#5331b6}.ab-val p{margin:0;line-height:1.9;color:#3a3454}.ab-cta{display:grid;grid-template-columns:1.4fr 1fr;gap:10px;margin:18px 0}.ab-cta a{text-align:center}</style>
<section class=ab-hero><h1>من نحن</h1><p>${name} منصة سعودية متكاملة تربط بين الأفراد الذين يحتاجون للمساعدة في مهامهم اليومية وبين المتخصصين ذوي المهارات العالية. نحن نسهّل الوصول إلى مساعدين مؤهلين، ونوفر أدوات للاتفاق والتواصل والتقييم بشفافية، دون أن نضمن نتيجة أي مهمة أو أداء أي طرف.</p></section>
${card(1,ico.doc,'طلب وعرض','اطلب مهمة بوضوح واحصل على عروض فورية من مقدمي الخدمة المؤهلين. اختر العرض الذي يناسبك بناءً على الميزانية والتقييمات.')}
${card(2,ico.shield,'أمان وشفافية','اتفاقات إلكترونية داخل المنصة، وسجل محادثات واتفاقات، ومسار واضح للشكاوى وتسوية المنازعات.')}
${card(3,ico.star,'سمعة مبنية على التقييم','نظام تقييمات دقيق ومتبادل، تعرف على جودة عمل وموثوقية الطرف الآخر قبل البدء.')}
<section class=ab-sec><h2>كيف تعمل المنصة</h2>${step(1,'ابحث عن مساعدك','اكتب الخدمة التي تحتاجها ومدينتك، واختر من يناسبك من المساعدين المتاحين.')}${step(2,'تواصل واتفق','راسل المساعد مباشرة، واتفقا على المهمة والسعر النهائي داخل المحادثة، ثم يعتمد الطرفان الاتفاق.')}${step(3,'أنجز وقيّم','أنجز المهمة وادفع المبلغ المتفق عليه أونلاين عبر المنصة، ثم قيّم التجربة بعد الإنجاز.')}</section>
<section class=ab-val><h2>مبادئنا</h2><h3>قيمنا الجوهرية</h3><p>الوضوح التام في الاتفاقات، والاحترام المتبادل بين الأطراف، والمسؤولية الكاملة عن كل ما يُنشر ويُتفق عليه عبر المنصة.</p></section>
<div class=ab-cta><a class=btn href="#/">احصل على المساعدة الآن</a><a class="btn alt" href="#/contact">تواصل معنا</a></div>`}

async function contact(){const o=await orgInfo();const mail=o.support_email||'';const phone=(o.support_phone||'').replace(/\s/g,'');const wa=phone?'https://wa.me/'+(phone.startsWith('0')?'966'+phone.slice(1):phone.replace(/^\+/,'')):'';
const card=(href,ico,t,s,bg)=>`<a class=ct-card href="${href}" ${href.startsWith('http')?'target=_blank rel=noopener':''}><span class=ct-ico style="background:${bg}">${ico}</span><span class=ct-tx><b>${t}</b><small>${s}</small></span><i class=ct-ar>›</i></a>`;
const mailIco='<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>';
const waIco='<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#fff" stroke-width="2"><path d="M4 20l1.3-4.1A8 8 0 1 1 8.2 19z"/><path d="M9 9.5c0 2.5 2.5 5 5 5l1-1.2-1.8-1-.8.6c-.9-.4-1.9-1.4-2.3-2.3l.6-.8-1-1.8z" fill="#fff" stroke="none"/></svg>';
const head=`<style>.ct-hero{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 4px 4px}.ct-hero h1{margin:0 0 6px;font-size:30px;color:#5331b6}.ct-hero p{margin:0;color:#625a76;font-size:15px}.ct-cards{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0}.ct-card{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #e9e6f6;border-radius:18px;padding:12px;text-decoration:none;color:#0d0a2c;box-shadow:0 4px 12px rgba(0,0,0,.04);min-width:0}.ct-ico{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;flex:0 0 auto}.ct-tx{display:flex;flex-direction:column;flex:1;min-width:0}.ct-tx b{font-size:15px}.ct-tx small{color:#625a76;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ct-ar{font-style:normal;color:#6445cc;font-size:22px}.ct-form{background:#fff;border:1px solid #e9e6f6;border-radius:22px;padding:16px;box-shadow:0 6px 18px rgba(0,0,0,.05);display:flex;flex-direction:column;gap:12px}.ct-form h3{margin:0;font-size:18px;color:#0d0a2c}.ct-form label{display:flex;flex-direction:column;gap:6px;font-weight:600;color:#0d0a2c}.ct-form input,.ct-form textarea{border:1px solid #d9d5e8;border-radius:14px;padding:12px;font:inherit;background:#faf9ff}.ct-form textarea{min-height:120px;resize:vertical}.ct-sky{height:90px;margin-top:20px;background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 90' preserveAspectRatio='xMidYMax slice'><g fill='%230f6b4f' opacity='.12'><rect x='20' y='40' width='22' height='50'/><rect x='48' y='22' width='16' height='68'/><path d='M150 90V30l10-14 10 14v60z'/><rect x='180' y='50' width='26' height='40'/><rect x='250' y='10' width='12' height='80'/><circle cx='256' cy='6' r='6'/><rect x='320' y='40' width='24' height='50'/></g></svg>") center bottom/100% auto no-repeat}</style>`;
const hero=`<section class=ct-hero><div><h1>تواصل معنا</h1><p>نحن هنا دائمًا لخدمتكم</p></div><div aria-hidden=true style="font-size:64px;line-height:1">🎧</div></section>`;
const cards=`<div class=ct-cards>${mail?card('mailto:'+mail,mailIco,'البريد الإلكتروني','أرسل لنا رسالة','#6445cc'):''}${wa?card(wa,waIco,'واتساب','تواصل معنا مباشرة','#6a48d0'):''}</div>`;
const form=`<form id=ctf class=ct-form><h3>أو اترك لنا رسالة</h3><label>الاسم<input name=name required minlength=2 maxlength=60 autocomplete=name placeholder="اسمك"></label><label>البريد الإلكتروني<input name=email type=email required dir=ltr autocomplete=email placeholder="name@example.com"></label><label>الرسالة<textarea name=body required minlength=10 maxlength=2000 placeholder="اكتب رسالتك"></textarea></label><button class=btn>إرسال الرسالة</button></form>`;
app.innerHTML=head+hero+cards+form+`<div class=ct-sky></div>`;
$('#ctf').onsubmit=sub(async(b,t)=>{await api('/contact','POST',b);toast('تم إرسال رسالتك، سنرد عليك قريبًا');t.reset()})}

let fgEmail='';
function forgot(){app.innerHTML=`<section class=auth><div class=auth-head><span class=mark-lg><img loading=lazy decoding=async src=/hand.png alt=""></span><h1>استعادة كلمة المرور</h1><p id=fgp>أدخل بريدك الإلكتروني، وسنرسل لك رمزًا من 6 أرقام.</p></div><form id=fg class=auth-form><label>البريد الإلكتروني<input name=email type=email required autocomplete=email dir=ltr value="${esc(fgEmail)}"></label><button class=btn>إرسال الرمز</button></form><form id=fc class=auth-form hidden><label>الرمز المكوّن من 6 أرقام<input name=code inputmode=numeric pattern="[0-9]{6}" maxlength=6 required autocomplete=one-time-code dir=ltr style="letter-spacing:8px;text-align:center;font-size:22px"></label><button class=btn>تأكيد الرمز</button> <button class="btn alt" type=button id=fgr>إعادة الإرسال</button></form><p class=auth-alt id=fgm></p></section>`;
$('#fg').onsubmit=sub(async b=>{fgEmail=b.email;await api('/forgot','POST',{email:fgEmail});$('#fgp').textContent='أدخل الرمز الذي وصل إلى بريدك (صالح 10 دقائق).';$('#fg').hidden=true;$('#fc').hidden=false;$('#fgm').textContent='إذا كان البريد مسجلًا لدينا، ستصلك الرسالة خلال دقائق. تحقق من مجلد غير المرغوب فيها.'});
$('#fc').onsubmit=sub(async b=>{const r=await api('/reset-code','POST',{email:fgEmail,code:b.code});location.hash='#/reset/'+r.token});
$('#fgr').onclick=async()=>{try{await api('/forgot','POST',{email:fgEmail});toast('أرسلنا رمزًا جديدًا إن كان البريد مسجلًا')}catch(x){toast(x.message,1)}}}
function resetPage(token){app.innerHTML=`<section class=auth><div class=auth-head><span class=mark-lg><img loading=lazy decoding=async src=/hand.png alt=""></span><h1>كلمة مرور جديدة</h1><p>اكتب كلمة مرور جديدة، وستنتهي كل الجلسات القديمة.</p></div><form id=rp class=auth-form><label>كلمة المرور الجديدة<input name=password type=password minlength=8 required autocomplete=new-password dir=ltr placeholder="8 أحرف على الأقل"></label><button class=btn>حفظ كلمة المرور</button></form></section>`;
$('#rp').onsubmit=sub(async b=>{await api('/reset','POST',{token,password:b.password});toast('تم تغيير كلمة المرور، سجّل دخولك');location.hash='#/login'})}
async function dchatInit(id){taskUi(id);const rb=$('#dmsgs');rb.addEventListener('submit',async e=>{const fm=e.target.closest&&e.target.closest('form[data-rate]');if(!fm)return;e.preventDefault();const fd=new FormData(fm);const stars=Number(fd.get('stars'));if(!stars){toast('اختر عدد النجوم',1);return}try{await api('/tasks/'+fm.dataset.rate+'/rate','POST',{stars,comment:String(fd.get('comment')||'')});toast('شكرًا لتقييمك');pendingRate=null;window.__dchatReload&&window.__dchatReload()}catch(x){toast(x.message,1)}});window.__dchatReload=()=>load(true);const box=$('#dmsgs'),form=$('#dform'),agr=$('#dagr'),scroller=$('#dchat');const proposeAgr=()=>openModal('اقتراح اتفاق','<small>اقترح اتفاقًا على الخدمة والمبلغ، ولا يُعد الاتفاق نافذًا حتى يوافق الطرف الآخر.</small><label>وصف الخدمة<input name=description maxlength=300 required placeholder="مثال: تركيب باب"></label><label>المبلغ بالريال<input name=amount type=number min=1 max=100000 required></label>',async b=>{await api('/direct/'+id+'/agreements','POST',{amount:b.amount,description:b.description});await loadAgr();await load(true)});
const BANNER_HTML='<div style="background:#fff7e6;border:1px solid #f5d28a;border-radius:12px;padding:10px;margin-bottom:8px"><b>لديك اتفاق بانتظار ردك:</b> وافق عليه، أو ارفضه، أو اقترح مبلغًا آخر.</div>';
const paintBanner=list=>{if(!agr)return;const html=list.some(g=>g.status==='pending'&&g.a_id!==me.user.id)?BANNER_HTML:'';if(agr.innerHTML!==html)agr.innerHTML=html};
const loadAgr=async()=>{if(!agr)return;paintBanner(await api('/direct/'+id+'/agreements'))};
box.addEventListener('click',async e=>{const b=e.target.closest('[data-req],[data-cf],[data-dp],[data-cp],[data-pay],[data-cr]');if(!b)return;if(b.dataset.cr){try{await api('/agreements/'+b.dataset.cr+'/cash-received','POST');toast('تم تسجيل استلام المبلغ كاش');await load(true)}catch(x){toast(x.message,1)}return}if(b.dataset.pay){try{const r=await api('/agreements/'+b.dataset.pay+'/payment');if(r.url){window.open(r.url,'_blank')}else{toast('بوابة الدفع قيد الربط')}}catch(x){toast(x.message,1)}return}const pd=undefined;const path=b.dataset.req?'/agreements/'+b.dataset.req+'/request-completion':b.dataset.cf?'/agreements/'+b.dataset.cf+'/confirm-completion':b.dataset.cp?'/agreements/'+b.dataset.cp+'/complaint':'/agreements/'+b.dataset.dp+'/dispute';try{await api(path,'POST',pd);toast('تم');await load(true)}catch(x){toast(x.message,1)}});
box.addEventListener('click',async e=>{const b=e.target.closest('[data-ok],[data-cx],[data-counter]');if(!b)return;if(b.dataset.counter){proposeAgr();return}try{if(b.dataset.ok){await api('/agreements/'+b.dataset.ok+'/approve','POST')}else{await api('/agreements/'+b.dataset.cx+'/cancel','POST',b.dataset.agreed?{reason:prompt('سبب الإلغاء (3 أحرف على الأقل)')||''}:{})}await load(true)}catch(x){toast(x.message,1)}});
let lastSig='';const load=async(force)=>{taskUi(id);const d=await api('/direct/'+id);form.hidden=d.blocked;if(d.blocked){box.innerHTML='<div class=empty>لا يمكن التواصل مع هذا المستخدم.</div>';return}const agrs=await api('/direct/'+id+'/agreements').catch(()=>[]);paintBanner(agrs);const last=d.messages.length?d.messages[d.messages.length-1].id:0;const sig=last+':'+d.messages.length+':'+agrs.map(g=>g.id+g.status+(g.paid_at||'')).join(',')+(pendingRate?':r'+pendingRate.id:'');if(!force&&sig===lastSig)return;const nearBottom=scroller.scrollHeight-scroller.scrollTop-scroller.clientHeight<150;const first=!lastSig;const gap=scroller.scrollHeight-scroller.scrollTop;lastSig=sig;box.innerHTML=renderStream(d.messages,agrs);if(force||first||nearBottom)scroller.scrollTop=scroller.scrollHeight;else scroller.scrollTop=Math.max(0,scroller.scrollHeight-gap)};const startPoll=()=>{let n=0;const tick=async()=>{if(document.hidden)return;n++;try{if(n%3===0)await loadAgr();await load(false)}catch{}};const t=setInterval(tick,4000);const stop=()=>{clearInterval(t);window.removeEventListener('hashchange',stop);document.removeEventListener('visibilitychange',vis)};const vis=()=>{if(!document.hidden)tick()};window.addEventListener('hashchange',stop);document.addEventListener('visibilitychange',vis)};
try{await load(true)}catch(x){toast(x.message,1)}
box.addEventListener('click',e=>{const s=e.target.closest('[data-sug]');if(s&&form){form.elements.body.value=s.dataset.sug;form.elements.body.focus()}});
box.addEventListener('click',async e=>{const b=e.target.closest('[data-cash]');if(!b)return;try{await api('/agreements/'+b.dataset.cashAgr+'/choose-cash','POST');toast('تم إبلاغ المساعد باختيارك الدفع كاش');await load(true)}catch(x){toast(x.message,1)}});
form.onsubmit=sub(async(b,t)=>{try{await api('/direct/'+id,'POST',{body:b.body});t.elements.body.value='';await load(true)}catch(x){toast(x.message,1)}});
$('#dpic').onclick=async()=>{try{const attachment_id=await pick();await api('/direct/'+id,'POST',{body:'',attachment_id});await load(true)}catch(x){toast(x.message,1)}};plusSetup(id,load,proposeAgr);startPoll()}
const money=n=>Number(n||0).toFixed(2)+' ريال';
const TOPIC_TAG='[موضوع الطلب]\n';
const fmt12=s=>{const x=String(s||'');const h=+x.slice(11,13),m=x.slice(14,16);if(isNaN(h)||!m)return '';return `${h%12||12}:${m} ${h<12?'ص':'م'}`};
const bubHtml=m=>{const mine=m.from_id===me.user.id;let body;if(String(m.body).startsWith(TOPIC_TAG)){const[t1,...rest]=String(m.body).slice(TOPIC_TAG.length).split('\n');body=`<div class=topic-card><small>موضوع الطلب</small><b>${esc(t1)}</b>${rest.length?`<p>${esc(rest.join('\n'))}</p>`:''}</div>`}else body=esc(m.body);
const pic=m.attachment_id?`<img loading=lazy decoding=async class=pic src=/api/files/${m.attachment_id} alt="">`:'';
const av=mine?`<span class=dc-av-me>${SV(PERSON_P)}</span>`:`<span class=dc-av><img src=/hand.png alt=""></span>`;
const col=`<div class=dc-col><div class=dc-bub>${pic}${body}</div><small class=dc-time>${fmt12(m.created_at)}${mine?'<i class=dc-ticks>✓✓</i>':''}</small></div>`;
return `<div class="dc-row ${mine?'me':'them'}">${mine?av+col:col+av}</div>`};
const linkCard=g=>{const isH=g.helper_id===me.user.id;const lm=g.link_meta||{};const name=lm.org||(g.helper_info&&g.helper_info.name)||'المساعد';const logo=lm.logo?`<img class="lc-logo" src="/api/files/${+lm.logo}" alt="">`:`<span class="lc-logo lc-ph">${esc(String(name).charAt(0))}</span>`;const rate=lm.count?`★ ${lm.avg} (${lm.count})`:'بدون تقييم بعد';const amt=Number(g.total_amount||g.amount||0).toLocaleString('en-US');const work=Number(g.amount||0).toLocaleString('en-US');const vatN=Number(g.vat_amount||0);const matN=Number(g.materials||0);const matRow=matN>0?`<div class="dc-kv"><span>القطع</span><b>${matN.toLocaleString('en-US')} ريال</b></div>`:'';const vatRow=vatN>0?`<div class="dc-kv"><span>ضريبة القيمة المضافة</span><b>${vatN.toLocaleString('en-US')} ريال</b></div>`:'';const cash=!isH?`<button type=button class="dc-cash" data-cash="1" data-cash-agr="${+g.id}">الدفع كاش</button>`:'';const pay=!isH?`<button type=button class="dc-pay" data-pay="${+g.id}">ادفع أونلاين</button>`:'';const rcv=isH?`<button type=button class="dc-cash" data-cr="${+g.id}">تم استلام المبلغ كاش</button>`:'';return `<div class="dc-linkcard"><div class="lc-head">${logo}<div><b>${esc(name)}</b><small class="lc-rate">${esc(rate)}</small></div></div><div class="dc-kv"><span>شغل اليد</span><b>${work} ريال</b></div>${matRow}${vatRow}<div class="dc-link-amt"><small>الإجمالي</small> ${amt} ريال</div><div class="dc-acts">${cash}${pay}${rcv}</div></div>`};
const agrCard=g=>{if(g.source!=='link'||g.paid_at||g.status!=='agreed')return '';return linkCard(g)};
const dcEmpty=()=>`<div class=dc-empty><b>كيف أقدر أساعدك؟</b><div class=dc-sugs>${['أبي أعرف السعر قبل الطلب','متى تقدر تبدأ؟','وش المواد المطلوبة؟','أبي أحجز موعد للزيارة'].map(x=>`<button type=button class=dc-sug data-sug="${esc(x)}">${esc(x)}</button>`).join('')}</div></div>`;
const renderStream=(msgs,agrs=[])=>{const items=[...msgs.map(m=>({t:String(m.created_at),h:bubHtml(m)})),...agrs.map(g=>({t:String(g.created_at),h:agrCard(g)})),...(pendingRate?[{t:'9999',h:rateCard(pendingRate)}]:[])].sort((a,b)=>a.t.localeCompare(b.t));return items.map(x=>x.h).join('')||dcEmpty()};
const openModal=(title,fields,onSubmit)=>{const o=document.createElement('div');o.className='mo-ov';o.innerHTML=`<form class=mo-box role=dialog aria-modal=true aria-label="${esc(title)}"><h3 style="margin:0 0 8px">${esc(title)}</h3>${fields}<div class=mo-act><button class=btn type=submit>إرسال</button> <button class="btn alt" type=button data-x>إلغاء</button></div></form>`;document.body.append(o);o.querySelector('[data-x]').onclick=()=>o.remove();o.querySelector('form').onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target));try{await onSubmit(b);o.remove()}catch(x){toast(x.message,1)}};o.querySelector('input,textarea')?.focus();return o};
function plusSetup(id,reload,proposeAgr){const btn=$('#plusBtn'),menu=$('#plusMenu'),box=$('#dmsgs');if(!btn)return;
  
  const payBtn=$('#plusPay');if(payBtn)payBtn.hidden=me.user.account_type!=='helper';
  const close=()=>{menu.hidden=true;btn.setAttribute('aria-expanded','false')};
  btn.onclick=e=>{e.stopPropagation();menu.hidden=!menu.hidden;btn.setAttribute('aria-expanded',String(!menu.hidden));if(!menu.hidden)document.addEventListener('click',close,{once:true})};
  menu.onclick=async e=>{const b=e.target.closest('[data-p]');if(!b)return;close();
    if(b.dataset.p==='paylink'){api('/me/payment-config').then(cfg=>openModal('رابط دفع',`<small>اكتب شغل اليد والقطع، والإجمالي يُحسب تلقائياً (مع الضريبة إن استحقت). العمولة 5% من شغل اليد تُخصم من حصتك، ويصل العميل الإجمالي فقط.</small><label>شغل اليد (ريال)<input name=amount type=number min=1 step=0.01 required></label><label>القطع (ريال)<input name=materials type=number min=0 step=0.01 value=0></label><label>كود الخصم (اختياري)<input name=discount_code maxlength=20 dir=ltr autocomplete=off></label><label>الإجمالي (ريال)<input name=total type=number readonly tabindex=-1></label><input type=hidden name=vat value="${cfg.vat?0.15:0}">`,async b=>{await api('/direct/'+id+'/payment-link','POST',{amount:Number(b.amount),materials:Number(b.materials||0),discount_code:b.discount_code||''});toast('تم إرسال رابط الدفع للعميل');await reload()}))}};
  }
const legal=kind=>{const t=kind==='terms'?'الشروط والأحكام':kind==='complaints'?'سياسة الشكاوى وفض النزاعات':'سياسة الخصوصية';app.innerHTML=`<section class=legal><div class=lg-art>${LG_ART[kind]||''}</div><h1>${t}</h1><p class=draft>مسودة: هذا النص لم يُعتمد بعد، ويجب مراجعته من محامٍ مختص قبل نشره رسميًا.</p><div id=lgs>${LEGAL[kind].map(([h,b])=>`<h2>${esc(h)}</h2><p>${esc(b).replace(/\n/g,'<br>')}</p>`).join('')}</div><p class=meta-l id=lo></p></section>`;
orgInfo().then(o=>{const txt=kind==='complaints'?null:o[kind==='terms'?'terms_text':'privacy_text'];if(txt)$('#lgs').innerHTML=txt.split(/\n\s*\n/).map(x=>`<p>${esc(x.trim())}</p>`).join('');$('#lo').innerHTML=`المنشأة المالكة للمنصة: ${o.org_name?esc(o.org_name)+(o.org_cr?'، سجل تجاري رقم '+esc(o.org_cr):''):'[اسم المؤسسة ورقم السجل التجاري]'}`})};
const routes=[[/^#\/hala$/,halaPage],[/^#\/platform-dues$/,platformDuesPage],[/^#\/(mine|new|r\/\d+|chat\/\d+\/\d+)$/,()=>{location.hash='#/'}],[/^#\/settings$/,settingsPage],[/^#\/wallet$/,walletPage],[/^#\/follow$/,followPage],[/^#\/direct\/(\d+)$/,directChat],[/^#\/verify\/([0-9a-f]{64})$/,verifyPage],[/^#\/profile\/(\w+)$/,profileSub],[/^#\/insights$/,insights],[/^#\/manage(?:\/([\w/]+))?$/,t=>loadAdmin().then(()=>manage(t))],[/^#\/chats$/,chats],[/^#\/profile$/,profileWithRevs],[/^#\/notifs$/,notifs],[/^#\/login$/,()=>auth(false)],[/^#\/admin-login$/,()=>auth(false)],[/^#\/register$/,()=>auth(true)],[/^#\/complaints$/,()=>legal('complaints')],[/^#\/faq$/,faqPage],[/^#\/agreement\/(\d+)$/,agreementPage],[/^#\/about$/,about],[/^#\/contact$/,contact],[/^#\/forgot$/,forgot],[/^#\/reset\/([0-9a-f]{64})$/,resetPage],[/^#\/p\/(\d+)$/,id=>profileAccount(+id)],[/^#\/verify-email$/,verifyEmailPage],[/^#\/terms$/,()=>legal('terms')],[/^#\/privacy$/,()=>legal('privacy')],[/^#\/admin$/,()=>{location.hash='#/manage'}]];
function addBack(h){document.querySelectorAll('.pg-back').forEach(n=>n.remove());return;if(document.body.classList.contains('dchat-mode')||h==='#/'||h==='#'||h===''||!app.firstChild||app.querySelector('.pv-cover,.pf2'))return;app.insertAdjacentHTML('afterbegin',`<div class=pg-back><button type=button class=pg-back-btn data-back aria-label="رجوع"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg><span>رجوع</span></button></div>`)}
document.addEventListener('input',e=>{const f=e.target.form;if(!f||!f.elements.total||!['amount','materials'].includes(e.target.name))return;const w=Number(f.elements.amount.value)||0,m=Number(f.elements.materials.value)||0,v=Number(f.elements.vat.value)||0;f.elements.total.value=(Math.round((w+m)*(1+v)*100)/100).toFixed(2)});
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-back]');if(!b)return;e.preventDefault();if(history.length>1)history.back();else location.hash='#/'});
async function route(){const h=location.hash||'#/';if(h==='#/logout'){history.replaceState(null,'','#/');logout();return}closeMenu();document.body.classList.remove('dchat-mode');nav();$('#ft').hidden=true;document.body.classList.toggle('home',h==='#/'||h==='#'||h==='');document.body.classList.toggle('acct',/^#\/(profile|p\/\d+)$/.test(h));{const tc=document.querySelector('meta[name=theme-color]');if(tc){tc.dataset.o=tc.dataset.o||tc.content;tc.content=(/^#\/feed(\/\d+)?$/.test(h)||h==='#/profile'||/^#\/p\/\d+$/.test(h)||h==='#/'||h==='#'||h==='')?'#ffffff':tc.dataset.o}}if(/#\/(new|profile|notifs|admin(?!-login)|mine|chats|chat)/.test(h)&&!me.user)return location.hash='#/login';
for(const[re,f]of routes){const m=re.exec(h);if(m){try{await f(m[1],m[2]);addBack(h)}catch(e){app.innerHTML=`<div class=empty>${esc(e.message)}</div>`}return}}
if(h==='#list'||h==='#/'||h==='#')return home();home()}
const modal=(t,x)=>{const o=document.createElement('div');o.className='ov';o.innerHTML=`<div class=mo><h3 style="margin:0">${esc(t)}</h3><div class=pre>${esc(x)}</div><button class=btn>إغلاق</button></div>`;o.querySelector('button').onclick=()=>o.remove();document.body.append(o)};

function verifyBanner(){if(!me.user||$('#vb'))return;const noMail=me.user.email_verified===0,noPhone=!me.user.phone;if(!noMail&&!noPhone)return;const d=document.createElement('div');d.id='vb';d.className='ov';d.innerHTML='<div class=mo style="text-align:center">'+(noPhone?'<p>أضف رقم جوالك في الملف الشخصي، فهو مطلوب لنشر الطلبات والتقدم للمهام.</p><button class=btn type=button id=vbp>إضافة الجوال</button> ':'')+(noMail?'<p>أدخل الرمز المكوّن من 6 أرقام الذي أرسلناه إلى بريدك:</p><form id=vcf class=auth-form><input name=code inputmode=numeric pattern="[0-9]{6}" maxlength=6 required dir=ltr style="letter-spacing:8px;text-align:center;font-size:20px"><button class=btn>تفعيل البريد</button></form><button class="btn alt" type=button id=vbr>إعادة إرسال الرمز</button> ':'')+'<button class="btn alt" type=button id=vbx>لاحقًا</button></div>';document.body.append(d);$('#vbx').onclick=()=>d.remove();if($('#vcf'))$('#vcf').onsubmit=sub(async b=>{await api('/verify-code','POST',{code:b.code});d.remove();toast('تم تفعيل بريدك');await boot()});if($('#vbp'))$('#vbp').onclick=()=>{d.remove();location.hash='#/profile'};if($('#vbr'))$('#vbr').onclick=async()=>{try{await api('/me/resend-verification','POST');toast('أرسلنا رمز التفعيل إلى بريدك')}catch(x){toast(x.message,1)}}}
async function verifyEmailPage(){if(!me.user){location.hash='#/login';return}if(me.user.email_verified){location.hash='#/';return}app.innerHTML=`<section class=auth><div class=auth-head><span class=mark-lg><img loading=lazy decoding=async src=/hand.png alt=""></span><h1>تأكيد البريد الإلكتروني</h1><p>أرسلنا رمزًا مكوّنًا من 6 أرقام إلى <b dir=ltr>${esc(me.user.email)}</b>. أدخله لتفعيل حسابك.</p></div><form id=vef class=auth-form><label>رمز التحقق<input name=code inputmode=numeric pattern="[0-9]{6}" maxlength=6 required dir=ltr style="letter-spacing:8px;text-align:center;font-size:20px"></label><button class=btn>تفعيل الحساب</button></form><button class="btn alt" type=button id=ver>إعادة إرسال الرمز</button></section>`;$('#vef').onsubmit=sub(async b=>{await api('/verify-code','POST',{code:b.code});toast('تم تفعيل حسابك');await boot();location.hash='#/'});$('#ver').onclick=async()=>{try{await api('/me/resend-verification','POST');toast('أرسلنا رمز التفعيل إلى بريدك')}catch(x){toast(x.message,1)}}}
async function verifyPage(tok){app.innerHTML=`<section class=auth><h1>تفعيل البريد الإلكتروني</h1><p id=vmsg>جاري التفعيل…</p></section>`;try{await api('/verify-email','POST',{token:tok});$('#vmsg').textContent='تم تفعيل بريدك بنجاح.';const d=document.getElementById('vb');if(d)d.remove()}catch(x){$('#vmsg').textContent=x.message}}
function notifyBanner(){if(!me.user||me.user.notify_email!==0||$('#nb'))return;try{if(sessionStorage.getItem('nbx'))return}catch{}
const d=document.createElement('div');d.id='nb';d.setAttribute('style','position:fixed;top:64px;left:12px;right:12px;z-index:15;background:#fff7ed;border:1px solid #fdba74;border-radius:12px;padding:10px 12px;display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;box-shadow:0 4px 12px rgba(0,0,0,.08)');
d.innerHTML='<span style="flex:1;min-width:180px;font-size:14px">إشعارات البريد متوقفة. فعّلها حتى تصلك رسائل المحادثات والعروض والاتفاقات ولا تفوتك أي فرصة.</span><span style="display:flex;gap:6px"><button class=btn id=nbo type=button>تفعيل الإشعارات</button><button class="btn alt" id=nbx type=button>لاحقًا</button></span>';
document.body.append(d);
$('#nbx').onclick=()=>{try{sessionStorage.setItem('nbx','1')}catch{}d.remove()};
$('#nbo').onclick=async()=>{try{await api('/me/notify','POST',{enabled:true});me.user.notify_email=1;toast('تم تفعيل إشعارات البريد');d.remove()}catch(x){toast(x.message,1)}}}
// إحالة المحلات: رابط بطاقة المحل يحمل ?ref=<رقم المحل>، ويُحفظ هنا حتى يُرسل مع التسجيل
const SHOP_REF_KEY='musaed_shop_ref';
// يُسجَّل المسح مرة واحدة لكل تبويب (sessionStorage) حتى لا يتضخم الإحصاء بالتحديث
function captureShopRef(){try{const r=new URLSearchParams(location.search).get('ref');if(r&&/^\d{1,9}$/.test(r)){localStorage.setItem(SHOP_REF_KEY,r);const k='shop_scan_'+r;if(!sessionStorage.getItem(k)){sessionStorage.setItem(k,'1');fetch('/api/shops/'+r+'/scan',{method:'POST',headers:{'content-type':'application/json'},body:'{}',keepalive:true}).catch(()=>{})}}}catch{}}
const shopRef=()=>{try{return localStorage.getItem(SHOP_REF_KEY)||''}catch{return ''}};
const clearShopRef=()=>{try{localStorage.removeItem(SHOP_REF_KEY)}catch{}};
// رابط المشاركة: محل (مؤسسة/شركة) يحمل رقمه في ?ref ليُنسب إليه كل تسجيل قادم منه
const shopUrl=(id,shop)=>location.origin+'/'+(shop?'?ref='+id:'')+'#/p/'+id;
// بطاقة QR احترافية للمحل: تُعرض وتُطبع، ويُغلق بالزر أو بمفتاح Esc أو بالنقر خارجها
function openShopCard(p){
  const name=p.name||'المحل',url=shopUrl(p.id,true),skills=(p.skills||[]).slice(0,2).join(' • ');
  const sub=[skills,p.city].filter(Boolean).join(' · ')||'مؤسسة / شركة';
  const qr=QR.svg(url,{margin:1,label:'رمز QR لصفحة '+name});
  const ov=document.createElement('div');
  ov.className='qrc-ov';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-label','بطاقة QR للمحل');
  ov.innerHTML=`<div class=qrc-wrap><article class=qrc-card>
    <header class=qrc-top><span class=qrc-brand><img src="/logo.png?v=3" alt="">المساعد</span><span class=qrc-tag>بطاقة محل</span></header>
    <div class=qrc-id><span class=qrc-av>${avHtml(p.avatar,p.name)}</span><div><h2>${esc(name)}</h2><p>${esc(sub)}</p></div></div>
    <div class=qrc-qr>${qr}</div>
    <p class=qrc-cta>امسح الرمز لفتح ملف ${esc(name)} والتواصل معه عبر منصة المساعد</p>
    <p class=qrc-url dir=ltr>${esc(location.host+'/#/p/'+p.id)}</p>
  </article>
  <div class=qrc-acts><button type=button class=btn id=qrcPrint>طباعة البطاقة</button><button type=button class="btn gray" id=qrcShare>مشاركة الرابط</button><button type=button class="btn gray" id=qrcClose>إغلاق</button></div></div>`;
  const onKey=e=>{if(e.key==='Escape')close()};
  const close=()=>{document.removeEventListener('keydown',onKey);ov.remove()};
  document.addEventListener('keydown',onKey);
  ov.addEventListener('click',e=>{if(e.target===ov)close()});
  ov.querySelector('#qrcClose').onclick=close;
  ov.querySelector('#qrcPrint').onclick=()=>window.print();
  ov.querySelector('#qrcShare').onclick=async()=>{try{if(navigator.share)await navigator.share({title:name,text:'امسح الرمز أو افتح الرابط للتواصل مع '+name,url});else{await navigator.clipboard.writeText(url);toast('تم نسخ رابط المحل')}}catch(x){if(x&&x.name!=='AbortError')toast('تعذّرت المشاركة',1)}};
  document.body.append(ov);
}
// صفحة مشاركة الملف الشخصي (على نمط مشاركة الانستقرام): رمز QR بشعار المساعد + مشاركة / نسخ الرابط / تنزيل
const SHARE_LOGO_VIEW='37 131 393 249'; // حدود اليد داخل logo-new.png بلا الهوامش البيضاء
const SHARE_STYLES=['شعار','ألوان'];
async function copyText(t){
  try{await navigator.clipboard.writeText(t);return true}catch{
    const a=document.createElement('textarea');a.value=t;a.setAttribute('readonly','');a.style.cssText='position:fixed;opacity:0';
    document.body.append(a);a.select();let ok=false;try{ok=document.execCommand('copy')}catch{}a.remove();return ok;
  }
}
// صورة PNG للبطاقة (نفس شكل الصفحة) للتنزيل
async function shareImage(url,name,style){
  const W=1080,H=1350,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  const logo=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>no(new Error('logo'));i.src='/logo-new.png'});
  try{await document.fonts.load("700 56px 'IBM Plex Sans Arabic'")}catch{}
  const F="'IBM Plex Sans Arabic',Tahoma,sans-serif",PURPLE='#5331b6';
  if(style===0){
    x.fillStyle='#ece8fc';x.fillRect(0,0,W,H);
    x.globalCompositeOperation='multiply';x.globalAlpha=.55;
    const cell=190,sw=132,sh=sw*512/468;
    for(let r=0;r*cell<H+cell;r++)for(let q=-1;q*cell<W+cell;q++){
      x.save();x.translate(q*cell+(r%2?cell/2:0)+sw/2,r*cell+sh/2);x.rotate(((r+q)%2?1:-1)*.24);x.drawImage(logo,-sw/2,-sh/2,sw,sh);x.restore();
    }
    x.globalAlpha=1;x.globalCompositeOperation='source-over';
  }else{
    const g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,PURPLE);g.addColorStop(1,'#8a6cff');x.fillStyle=g;x.fillRect(0,0,W,H);
  }
  const cw=800,ch=900,cx=(W-cw)/2,cy=(H-ch)/2-30;
  x.save();x.shadowColor='rgba(13,10,44,.22)';x.shadowBlur=60;x.shadowOffsetY=18;x.fillStyle='#fff';
  x.beginPath();if(x.roundRect)x.roundRect(cx,cy,cw,ch,64);else x.rect(cx,cy,cw,ch);x.fill();x.restore();
  const q=QR.paths(url,{logo:.18}),qs=640,u=qs/q.n,qx=cx+(cw-qs)/2,qy=cy+70;
  x.save();x.translate(qx,qy);x.scale(u,u);x.fillStyle=PURPLE;
  x.fill(new Path2D(q.dots));x.fill(new Path2D(q.finders),'evenodd');x.restore();
  if(q.box.size){
    const pad=.5,bs=(q.box.size-2*pad)*u,lw=bs,lh=bs*250/390,lx=qx+(q.box.x+pad)*u,ly=qy+q.box.y*u+(q.box.size*u-lh)/2;
    x.drawImage(logo,37,131,393,249,lx,ly,lw,lh);
  }
  x.textAlign='center';x.textBaseline='middle';x.direction='rtl';x.fillStyle=PURPLE;
  let fs=64;x.font=`700 ${fs}px ${F}`;
  while(x.measureText(name).width>cw-120&&fs>28){fs-=2;x.font=`700 ${fs}px ${F}`}
  x.fillText(name,W/2,cy+70+qs+(ch-70-qs)/2);
  x.font=`600 40px ${F}`;
  if(style===0){const tw=x.measureText('منصة المساعد').width+90;x.fillStyle='#ece8fc';x.beginPath();if(x.roundRect)x.roundRect(W/2-tw/2,H-160,tw,100,50);else x.rect(W/2-tw/2,H-160,tw,100);x.fill()}
  x.fillStyle=style===0?PURPLE:'#fff';x.fillText('منصة المساعد',W/2,H-110);
  return new Promise(ok=>c.toBlob(ok,'image/png'));
}
function openProfileShare(p,url){
  const name=String(p.name||'المساعد');
  let qr;
  try{qr=QR.dotsSvg(url,{logoHref:'/logo-new.png',logoView:SHARE_LOGO_VIEW,label:'رمز QR لملف '+name})}
  catch{copyText(url).then(ok=>toast(ok?'تم نسخ رابط الملف':'تعذّرت المشاركة',!ok));return}
  const opener=document.activeElement;
  const ic=d=>`<svg viewBox="0 0 24 24" width=24 height=24 fill=none stroke=currentColor stroke-width=1.8 stroke-linecap=round stroke-linejoin=round aria-hidden=true>${d}</svg>`;
  const ICX='<path d="M6 6l12 12M18 6 6 18"/>',ICS='<path d="M12 15V3.500M7.500 8 12 3.500 16.500 8M5 12.500v7h14v-7"/>',
    ICL='<path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1"/>',
    ICD='<path d="M12 4v11M7.500 10.500 12 15l4.500-4.500M5 19.500h14"/>';
  const ov=document.createElement('div');
  ov.className='shr';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-label','مشاركة الملف الشخصي');
  const cell=74,cols=Math.min(Math.ceil(innerWidth/cell)+1,24),rows=Math.min(Math.ceil(innerHeight/cell)+1,16);
  let pat='';for(let r=0;r<rows;r++)for(let k=0;k<cols;k++)pat+=`<img src="/logo-new.png" alt="" class="${r%2?'o':''}${(r+k)%2?' a':''}">`;
  ov.innerHTML=`<div class=shr-pat aria-hidden=true style="grid-template-columns:repeat(${cols},${cell}px)">${pat}</div>
  <div class=shr-top><button type=button class=shr-x id=shrX aria-label="إغلاق">${ic(ICX)}</button><button type=button class=shr-pill id=shrSt aria-live=polite aria-label="تغيير شكل الخلفية">${SHARE_STYLES[0]}</button><span class=shr-sp></span></div>
  <div class=shr-body><div class=shr-card><div class=shr-qr>${qr}</div><p class=shr-name>${esc(name)}</p></div>
  <div class=shr-acts><button type=button class=shr-act id=shrSh>${ic(ICS)}<span>مشاركة الملف</span></button><button type=button class=shr-act id=shrCp>${ic(ICL)}<span>نسخ الرابط</span></button><button type=button class=shr-act id=shrDl>${ic(ICD)}<span>تنزيل</span></button></div></div>`;
  let st=0;
  const onKey=e=>{if(e.key==='Escape')close()};
  const close=()=>{document.removeEventListener('keydown',onKey);removeEventListener('hashchange',close);ov.remove();if(opener&&opener.focus)opener.focus()};
  document.addEventListener('keydown',onKey);addEventListener('hashchange',close);
  ov.querySelector('#shrX').onclick=close;
  const pill=ov.querySelector('#shrSt');
  pill.onclick=()=>{st=(st+1)%SHARE_STYLES.length;ov.classList.toggle('shr-c',st===1);pill.textContent=SHARE_STYLES[st]};
  ov.querySelector('#shrSh').onclick=async()=>{
    try{if(navigator.share)await navigator.share({title:'منصة المساعد',text:name,url});else toast((await copyText(url))?'تم نسخ الرابط':'تعذّر النسخ',0)}
    catch(x){if(x&&x.name!=='AbortError')toast('تعذّرت المشاركة',1)}
  };
  ov.querySelector('#shrCp').onclick=async()=>{const ok=await copyText(url);toast(ok?'تم نسخ الرابط':'تعذّر النسخ',!ok)};
  const dl=ov.querySelector('#shrDl');
  dl.onclick=async()=>{
    dl.disabled=true;
    try{
      const blob=await shareImage(url,name,st);if(!blob)throw new Error('png');
      const file=new File([blob],'musaed-qr-'+p.id+'.png',{type:'image/png'});
      // على الجوال تظهر قائمة المشاركة التي فيها «حفظ الصورة»؛ وعلى الحاسب يُنزَّل الملف مباشرة
      if(matchMedia('(pointer:coarse)').matches&&navigator.canShare&&navigator.canShare({files:[file]}))await navigator.share({files:[file]});
      else{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);toast('تم تنزيل الصورة')}
    }catch(x){if(!(x&&x.name==='AbortError'))toast('تعذّر تنزيل الصورة',1)}
    dl.disabled=false;
  };
  ov.tabIndex=-1;document.body.append(ov);ov.focus({preventScroll:true});
}
async function boot(){captureShopRef();me=await api('/me');route();verifyBanner();notifyBanner();renderFooter();syncPush();pushBanner()}
addEventListener('hashchange',route);boot().catch(()=>{app.innerHTML='<section class=panel style="text-align:center"><h3>تعذّر الاتصال بالخادم</h3><small>تأكد من اتصالك بالإنترنت ثم أعد المحاولة.</small><p><button class=btn type=button onclick="location.reload()">إعادة المحاولة</button></p></section>'});

function loadAdmin(){return window.__adminReady?Promise.resolve():new Promise((ok,no)=>{const s=document.createElement("script");s.src="/admin.js";s.onload=()=>{window.__adminReady=1;ok()};s.onerror=()=>no(new Error("تعذّر تحميل لوحة الإدارة"));document.head.appendChild(s)})}
document.addEventListener('input',e=>{if(!e.target.classList||!e.target.classList.contains('cat-q'))return;const q=e.target.value.trim();(e.target.parentElement||document).querySelectorAll('.cat-card').forEach(c=>c.classList.toggle('hide',!!q&&!c.dataset.n.includes(q)))});
document.addEventListener('change',e=>{if(e.target&&e.target.name==='account_type'){const h=document.getElementById('htype');if(h)h.hidden=e.target.value!=='helper';}});
document.addEventListener('click',async e=>{if(e.target&&e.target.id==='htSend'){const v=document.getElementById('htReq').value;try{await api('/me/helper-type-request','POST',{helper_type:v});toast('أُرسل الطلب للإدارة')}catch(x){toast(x.message,1)}}});

const b64uBytes=s=>{const p='='.repeat((4-s.length%4)%4),b=atob((s+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(b,c=>c.charCodeAt(0))};
// هل اشتراك الجهاز أُنشئ بمفتاح VAPID العام الحالي للخادم؟ (إن لم يُكشف المفتاح من الاشتراك نعتمد على علامة محفوظة محليًا)
const keyOk=(s,k)=>{try{const c=s.options&&s.options.applicationServerKey;if(c){const a=new Uint8Array(c),b=b64uBytes(k);return a.length===b.length&&a.every((v,i)=>v===b[i])}}catch{}try{return localStorage.getItem('vapidKey')===k}catch{return true}};
// يربط الجهاز بالخادم؛ يعيد إنشاء الاشتراك إن كان مرتبطًا بمفتاح قديم أو عند force (مثل تفعيل المستخدم الصريح)
async function linkPush(k,force){const reg=await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();if(sub&&(force||!keyOk(sub,k))){try{await api('/push/unsubscribe','POST',{endpoint:sub.endpoint})}catch{}try{await sub.unsubscribe()}catch{}sub=null}if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64uBytes(k)});const j=sub.toJSON();await api('/push/subscribe','POST',{endpoint:j.endpoint,keys:j.keys});try{localStorage.setItem('vapidKey',k)}catch{}}
async function pushActive(){try{if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)||Notification.permission!=='granted')return false;const reg=await navigator.serviceWorker.getRegistration('/sw.js');return !!(reg&&await reg.pushManager.getSubscription())}catch{return false}}
async function syncPush(){try{if(!me.user||!me.user.push_enabled||!('Notification' in window)||!('PushManager' in window)||Notification.permission!=='granted')return;const k=(await api('/push/key')).key;if(!k)return;await linkPush(k)}catch{}}
async function testPush(){try{if(!(await pushActive())){toast('فعّل إشعارات الدفع على هذا الجهاز أولًا',1);return}const r=await api('/push/test','POST');if(r.sent){toast('أُرسل إشعار تجريبي، ينبغي أن يظهر خلال ثوانٍ');return}let fixed=false;if(r.stale){try{const k=(await api('/push/key')).key;if(k){await linkPush(k,true);fixed=true}}catch{}}toast(r.stale&&!fixed?'تعذر إعادة ربط الجهاز. أوقف إشعارات الدفع ثم فعّلها من جديد':(r.reason||'تعذر الإرسال'),!(r.stale&&fixed))}catch(x){toast(x.message,1)}}
async function pushBanner(){if(!me.user||me.user.push_enabled===0||$('#pb'))return;try{if(sessionStorage.getItem('pbx'))return}catch{}
const ios=/iphone|ipad|ipod/i.test(navigator.userAgent),canPush='serviceWorker' in navigator&&'PushManager' in window;
if(!canPush&&!(ios&&!isStandalone()))return;
if(canPush){let k=null;try{k=(await api('/push/key')).key}catch{}if(!k||await pushActive()||(window.Notification&&Notification.permission==='denied'))return}
const d=document.createElement('div');d.id='pb';d.setAttribute('style','position:fixed;bottom:12px;left:12px;right:12px;z-index:15;background:#f1eefd;border:1px solid #b09df4;border-radius:12px;padding:10px 12px;display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;box-shadow:0 4px 12px rgba(0,0,0,.08)');
d.innerHTML=canPush?'<span style=\"flex:1;min-width:180px;font-size:14px\">فعّل إشعارات الجوال لتصلك الرسائل والطلبات على الشاشة مع رقم أحمر على أيقونة التطبيق.</span><span style=\"display:flex;gap:6px\"><button class=btn id=pbo type=button>تفعيل</button><button class=\"btn alt\" id=pbx type=button>لاحقًا</button></span>':'<span style=\"flex:1;min-width:180px;font-size:14px\">لتصلك إشعارات الجوال على آيفون: من Safari اضغط مشاركة ثم «إضافة إلى الشاشة الرئيسية»، وافتح التطبيق من الأيقونة وفعّل الإشعارات.</span><button class=\"btn alt\" id=pbx type=button>حسنًا</button>';
document.body.append(d);$('#pbx').onclick=()=>{try{sessionStorage.setItem('pbx','1')}catch{}d.remove()};
if($('#pbo'))$('#pbo').onclick=async()=>{if(await enablePush())d.remove()}}
async function enablePush(){try{if(!('serviceWorker' in navigator)||!('PushManager' in window)){toast('متصفحك لا يدعم إشعارات الدفع',1);return false}let p=Notification.permission;if(p==='default')p=await Notification.requestPermission();if(p!=='granted'){toast('لم تُمنح صلاحية الإشعارات',1);return false}const k=(await api('/push/key')).key;if(!k){toast('إشعارات الدفع غير مفعّلة على الخادم',1);return false}await linkPush(k,true);toast('تم تفعيل إشعارات الدفع على هذا الجهاز');return true}catch(x){toast(x.message||'تعذر التفعيل',1);return false}}

/* ---- تثبيت التطبيق على الجوال (PWA) ---- */
function isStandalone(){return (window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true}
let deferredInstall=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e});
window.addEventListener('appinstalled',()=>{deferredInstall=null;try{nav()}catch{}});
async function installApp(){
  if(deferredInstall){const p=deferredInstall;deferredInstall=null;p.prompt();try{await p.userChoice}catch{}return}
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const steps=ios?'<li>افتح الموقع في متصفح <b>Safari</b>.</li><li>اضغط زر المشاركة <b>⬆︎</b> في أسفل الشاشة.</li><li>اختر <b>إضافة إلى الشاشة الرئيسية</b>.</li><li>اضغط <b>إضافة</b>.</li>':'<li>افتح قائمة المتصفح <b>⋮</b> في الأعلى.</li><li>اختر <b>تثبيت التطبيق</b> أو <b>إضافة إلى الشاشة الرئيسية</b>.</li><li>أكّد بالضغط على <b>تثبيت</b>.</li>';
  const o=document.createElement('div');o.style.cssText='position:fixed;inset:0;background:#0008;z-index:50;display:grid;place-items:end center';
  o.innerHTML='<div style="background:#fff;width:100%;max-width:480px;border-radius:20px 20px 0 0;padding:18px;display:grid;gap:10px;direction:rtl"><b>تثبيت المساعد على جوالك</b><ol style="margin:0;padding-inline-start:20px;line-height:2">'+steps+'</ol><button class=btn type=button data-close=1>تم</button></div>';
  o.onclick=e=>{if(e.target===o||(e.target.dataset&&e.target.dataset.close))o.remove()};document.body.append(o)
}
if('serviceWorker' in navigator)window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{})});

/* ---- زر واحد لتفعيل/إيقاف كل الإشعارات (دفع + طلبات/رسائل عبر البريد) ---- */
function allNotifyOn(){return !!(me.user&&me.user.push_enabled&&me.user.notify_email)}
async function toggleAllNotify(){
  if(!me.user)return;
  const turnOn=!allNotifyOn();
  try{
    if(turnOn){
      if(!(await enablePush()))return;
      await api('/me/notify','POST',{enabled:true});
      me.user.notify_email=1;me.user.push_enabled=1;
      toast('تم تفعيل الإشعارات: الدفع والطلبات والرسائل');
    }else{
      await api('/push/pref','POST',{enabled:false});
      await api('/me/notify','POST',{enabled:false});
      me.user.push_enabled=0;me.user.notify_email=0;
      toast('أُوقفت كل الإشعارات');
    }
  }catch(x){toast(x.message||'تعذّر التغيير',1)}
  nav();
}

/* تحديث عداد الإشعارات كل دقيقة (يظهر على أيقونة التطبيق وعلى الجرس) */
setInterval(async()=>{if(!me.user)return;try{const m=await api('/me');const n=m.unread||0;if(n!==(me.unread||0)){me.unread=n;nav()}}catch{}},60000);

/* قسم «متابعة» للمساعد: أداؤه وعملاؤه وفواتيره ومستحقات المنصة (للقراءة فقط) */
async function followPage(){
  if(!me.user){location.hash='#/login';return}
  if(me.user.account_type!=='helper'){app.innerHTML='<div class=empty>هذا القسم للمساعدين فقط.</div>';return}
  let d,w;
  try{[d,w]=await Promise.all([api('/helper/follow'),api('/wallet')])}catch(x){app.innerHTML=`<div class=empty>${esc(x.message)}</div>`;return}
  const fm=n=>Number(n||0).toLocaleString('ar-SA',{maximumFractionDigits:2})+' ر.س';
  const day=s=>esc(String(s||'').slice(0,10));
  const S=d.summary;
  const ST={active:'سارية',cancelled:'ملغاة'};
  const invRows=(rows,label)=>rows.length?`<div class=tbl-wrap><table class=tbl><thead><tr><th>الرقم</th><th>${label}</th><th>الخدمة</th><th>المبلغ</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>${rows.map(r=>`<tr><td><bdi dir=ltr>${esc(r.number)}</bdi></td><td>${esc(r.other_name)}</td><td>${esc(r.service)}</td><td>${fm(r.total)}</td><td><span class=pill>${esc(ST[r.status]||r.status)}</span></td><td>${day(r.created_at)}</td></tr>`).join('')}</tbody></table></div>`:'<div class=empty>لا توجد فواتير بعد.</div>';
  const cliRows=d.clients.length?`<div class=tbl-wrap><table class=tbl><thead><tr><th>العميل</th><th>الطلبات</th><th>المنجزة</th><th>آخر تعامل</th></tr></thead><tbody>${d.clients.map(c=>`<tr><td>${esc(c.name)}</td><td>${c.orders}</td><td>${c.completed}</td><td>${day(c.last_at)}</td></tr>`).join('')}</tbody></table></div>`:'<div class=empty>لا يوجد عملاء بعد.</div>';

  app.innerHTML=`<h2 style="margin:8px 0">متابعة</h2>
  <div class=kpis>
    <div class=kpi><small>الأرباح بعد عمولة المنصة</small><b>${fm(S.net_earned)}</b><span>من فواتيرك السارية</span></div>
    <div class="kpi ${S.debt>0?'warn':''}"><small>مديونيتك للمنصة</small><b>${fm(S.debt)}</b><span>عمولات لم تُسدَّد</span></div>
    <div class=kpi><small>الطلبات المنجزة</small><b>${S.completed}</b><span>من أصل ${S.orders} طلب</span></div>
    <div class=kpi><small>التقييم</small><b>${S.rating===null?'—':S.rating}</b><span>${S.rating_count} تقييم</span></div>
  </div>
  <div class=tabs role=tablist>
    <button type=button class="tab on" data-ft=clients>العملاء</button>
    <button type=button class=tab data-ft=issued>الفواتير الصادرة</button>
    <button type=button class=tab data-ft=received>الفواتير الواردة</button>
    <button type=button class=tab data-ft=wallet>النقاط والمحفظة</button>
  </div>
  <div id=ftBody>${cliRows}</div>
  <section class=panel style="margin-top:14px"><div class=row><div><b>تصدير بياناتي</b><br><small>ملف JSON يضم بيانات حسابك ونشاطك على المنصة.</small></div><button class="btn alt sm" type=button data-act=exportData>تصدير</button></div></section>`;

  const led=w.ledger.length?w.ledger.map(l=>`<div class=row><span>${l.delta>0?'إضافة':'خصم'}</span><b dir=ltr>${l.delta>0?'+':''}${l.delta}</b><small>${esc(String(l.created_at||'').slice(0,10))}</small></div>`).join(''):'<div class=empty>لا توجد حركات بعد.</div>';
  const walletHtml=`<div class=panel><div class=row><b>الرصيد الحالي</b><b dir=ltr>${w.points} نقطة</b></div><small>20 نقطة = ${w.riyal} ريال، وتُضاف النقاط عند اكتمال مهمة مؤهلة.</small>${w.agr_due>0?`<small>مستحقات المنصة: ${fm(w.agr_due)}</small>`:''}<a class=btn href="#/profile/points">استخدام الرصيد</a></div><div class=panel><h3 style="margin:0">سجل النقاط</h3>${led}</div>`;
  const bodies={clients:cliRows,issued:invRows(d.issued,'العميل'),received:invRows(d.received,'المساعد'),wallet:walletHtml};
  app.querySelectorAll('[data-ft]').forEach(b=>b.onclick=()=>{
    app.querySelectorAll('[data-ft]').forEach(x=>x.classList.toggle('on',x===b));
    $('#ftBody').innerHTML=bodies[b.dataset.ft];
  });
}

const FAQ_HTML=`<section class=panel id=faq-wrap style="margin-top:14px"><h3 style="margin:0 0 10px;color:#5331b6">الأسئلة الشائعة</h3><details class=faq-d><summary>كيف أجد مساعدًا؟</summary><p>اكتب الخدمة التي تحتاجها ومدينتك في الصفحة الرئيسية، ثم اختر المساعد المناسب وتواصل معه مباشرة.</p></details><details class=faq-d><summary>كيف يتم الدفع؟</summary><p>يتفق الطرفان على السعر داخل المحادثة، ثم يدفع طالب المساعدة المبلغ أونلاين عبر بوابة الدفع. تُخصم عمولة المنصة تلقائيًا ويصل الباقي إلى المساعد.</p></details><details class=faq-d><summary>ما هي عمولة المنصة؟</summary><p>يسدد المساعد عمولة المنصة وفق النسبة المعلنة، وتفاصيلها في التعهد الذي يوقّعه.</p></details><details class=faq-d><summary>نسيت كلمة المرور، ماذا أفعل؟</summary><p>من صفحة الدخول اضغط «نسيت كلمة المرور»، وأدخل بريدك، ثم الرمز المكوّن من 6 أرقام الذي سيصلك.</p></details></section>`;
function faqPage(){app.innerHTML=`<h2 style="margin:6px 0 10px;color:#0d0a2c">الأسئلة الشائعة</h2>`+FAQ_HTML}

/* معلومات وقطع الصيانة: يكتبها المساعد وتظهر في الفاتورة */
function notesBox(g){if(!me.user||!g.helper||g.helper.id!==me.user.id||['completed','cancelled','closed_disputed'].includes(g.status))return '';return `<section class=panel><b>معلومات وقطع الصيانة</b><small style="display:block;margin:4px 0 8px">تظهر ضمن تفاصيل الاتفاق.</small><textarea id=notesTa rows=5 maxlength=2000 style="width:100%">${esc(g.notes||'')}</textarea><button class=btn id=notesSave type=button style="margin-top:8px">حفظ التفاصيل</button></section>`}
document.addEventListener('click',async e=>{const b=e.target.closest&&e.target.closest('#notesSave');if(!b)return;const agr=(location.hash.match(/#\/agreement\/(\d+)/)||[])[1];if(!agr)return;try{await api('/agreements/'+agr+'/notes','POST',{notes:$('#notesTa').value});toast('تم حفظ التفاصيل')}catch(x){toast(x.message,1)}});

/* العرض المميز للمساعد في حسابه: 3 صور ومقطع فيديو واحد */
function showcaseBlock(p,ro){const sh=p.showcase||[];const isVid=x=>/^video\//.test(x.mime||'');const ph=sh.filter(x=>!isVid(x)),vd=sh.filter(isVid);const cell=(x,kind)=>x?`<div class=sh-cell>${isVid(x)?`<video src="/api/files/${+x.attachment_id}" muted playsinline controls preload=metadata></video>`:`<img loading=lazy decoding=async src="/api/files/${+x.attachment_id}" alt="">`}${ro?'':`<button class=lnk type=button data-shdel="${+x.attachment_id}">حذف</button>`}</div>`:(ro?'':`<button class=sh-cell type=button data-shadd="${kind}">+ ${kind==='photo'?'صورة':'فيديو'}</button>`);
const cells=[0,1,2].map(i=>cell(ph[i],'photo')).join('')+cell(vd[0],'video');
if(ro&&!sh.length)return'';return `<section class=sh-wrap><div class=sec-h><h3>${ro?'عرضه المميز':'عرضك المميز'}</h3></div>${ro?'':'<small>3 صور ومقطع فيديو واحد تظهر في أعلى ملفك.</small>'}<div class=sh-grid>${cells}</div></section>`}
document.addEventListener('click',async e=>{const add=e.target.closest&&e.target.closest('[data-shadd]');const del=e.target.closest&&e.target.closest('[data-shdel]');if(!add&&!del)return;e.preventDefault();try{if(del){await api('/me/showcase/delete','POST',{attachment_id:+del.dataset.shdel})}else{const id=await pickMedia();await api('/me/showcase','POST',{attachment_id:id})}await route()}catch(x){if(!/^لم تختر/.test(x.message))toast(x.message,1)}});


async function halaPage(){const st=await api('/helper/hala');app.innerHTML=`<h2>حساب هلا</h2><div class=panel><small>${st.configured?'مفتاح API محفوظ (ينتهي بـ '+esc(st.last4)+')':'لم يُربط حساب هلا بعد'}</small><form id=halaF class=form><label>مفتاح API<input name=api_key required autocomplete=off></label><label>سر الإشعارات (Webhook)<input name=webhook_secret required autocomplete=off></label><button class=btn type=submit>حفظ</button></form><small>تُخزَّن المفاتيح مشفرة، ولا تُعرض بعد الحفظ.</small></div>`;$('#halaF').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await api('/helper/hala','POST',{api_key:f.get('api_key'),webhook_secret:f.get('webhook_secret')});toast('تم الحفظ');halaPage()}catch(x){toast(x.message,1)}}}
async function platformDuesPage(){const l=await api('/helper/platform-invoices');app.innerHTML=`<h2>مستحقات المنصة</h2><div class=panel>${l.length?l.map(x=>`<div class=row><span>${esc(x.number)}<br><small>${esc(x.issued_at||'')}</small>${x.vat_amount>0?`<br><small>شامل ضريبة ${Number(x.vat_amount).toLocaleString('en-US')} ريال · صافي العمولة ${(Math.round((x.amount-x.vat_amount)*100)/100).toLocaleString('en-US')} ريال</small>`:''}</span><b>${Number(x.amount).toLocaleString('en-US')} ريال</b><small>${x.status==='paid'?'مسددة':'غير مسددة'}</small></div>`).join(''):'<div class=empty>لا توجد فواتير مستحقات.</div>'}</div>`}

let pendingRate=null;
async function taskUi(id){const b=$('#dtask');if(!b||!me.user)return;let t=null,rt=null,cs=true;try{const r=await api('/direct/'+id+'/task');t=r.task;rt=r.rate;cs=r.can_start!==false}catch{}
const isH=me.user.account_type==='helper';
const nextRate=rt&&!isH?rt:null;const changed=String(nextRate&&nextRate.id)!==String(pendingRate&&pendingRate.id);pendingRate=nextRate;if(changed&&window.__dchatReload)window.__dchatReload();
b.hidden=true;b.onclick=null;
if(nextRate)return;
if(!t&&isH&&cs){b.hidden=false;b.textContent='بدء المهمة';b.onclick=async()=>{try{await api('/direct/'+id+'/task','POST');toast('تم بدء المهمة');await taskUi(id)}catch(x){toast(x.message,1)}}}
else if(t&&t.status==='requested'&&!isH){b.hidden=false;b.textContent='قبول المهمة';b.onclick=async()=>{try{await api('/tasks/'+t.id+'/accept','POST');toast('تم قبول المهمة');await taskUi(id)}catch(x){toast(x.message,1)}}}}
function rateCard(r){return `<form class="rate-card" data-rate="${+r.id}"><b>قيّم المساعد</b><div class="rc-stars">${[5,4,3,2,1].map(n=>`<label><input type=radio name=stars value=${n}><span>${n} ★</span></label>`).join('')}</div><textarea name=comment maxlength=500 rows=2 placeholder="أضف تعليقًا (اختياري)"></textarea><button class=btn type=submit>إرسال التقييم</button></form>`}
async function profileWithRevs(){if(me.user&&me.user.account_type!=='helper'){location.hash='#/profile/data';return}await profileAccount()}

