(function(){const s=document.getElementById('splash');if(!s)return;let seen=false;try{seen=sessionStorage.getItem('splashSeen')==='1'}catch(e){}
if(seen){s.remove();return}
try{sessionStorage.setItem('splashSeen','1')}catch(e){}
const reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const hold=reduce?300:1200;
const close=()=>{s.classList.add('hide');setTimeout(()=>s.remove(),600)};
setTimeout(close,hold);setTimeout(close,4000);
})();
