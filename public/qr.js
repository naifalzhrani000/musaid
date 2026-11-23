// مولّد QR بلا أي مكتبات خارجية: وضع البايت، مستوى تصحيح M، الإصدارات 1 إلى 6 (تكفي لأي رابط).
// الناتج SVG أو مصفوفة منطقية. يُستخدم كدالة عامة: window.QR.svg(text)
(function(root){
'use strict';

// [إجمالي الكلمات، كلمات التصحيح لكل كتلة، مجموعات الكتل [عدد، كلمات بيانات لكل كتلة]، مواضع النمط المحاذي]
const VERSIONS=[
  null,
  {total:26,ecc:10,groups:[[1,16]],align:[]},
  {total:44,ecc:16,groups:[[1,28]],align:[6,18]},
  {total:70,ecc:26,groups:[[1,44]],align:[6,22]},
  {total:100,ecc:18,groups:[[2,32]],align:[6,26]},
  {total:134,ecc:24,groups:[[2,43]],align:[6,30]},
  {total:172,ecc:16,groups:[[4,27]],align:[6,34]}
];

// حساب GF(256) بمولّد 0x11D
function gfMul(x,y){let z=0;for(let i=7;i>=0;i--){z=(z<<1)^((z>>>7)*0x11D);z^=((y>>>i)&1)*x}return z}

function rsDivisor(degree){
  const r=new Array(degree).fill(0);r[degree-1]=1;let root=1;
  for(let i=0;i<degree;i++){
    for(let j=0;j<degree;j++){r[j]=gfMul(r[j],root);if(j+1<degree)r[j]^=r[j+1]}
    root=gfMul(root,0x02);
  }
  return r;
}

function rsRemainder(data,divisor){
  const deg=divisor.length,res=new Array(deg).fill(0);
  for(const b of data){
    const factor=b^res.shift();res.push(0);
    for(let i=0;i<deg;i++)res[i]^=gfMul(divisor[i],factor);
  }
  return res;
}

// بت BCH لمعلومات الصيغة (مستوى M = 00)
function formatBits(mask){
  const data=(0b00<<3)|mask;let v=data<<10;
  for(let i=14;i>=10;i--)if((v>>>i)&1)v^=0x537<<(i-10);
  return ((data<<10)|v)^0x5412;
}

function pickVersion(bytes){
  for(let v=1;v<=6;v++){
    const info=VERSIONS[v],dataCw=info.groups.reduce((s,[n,d])=>s+n*d,0);
    if(bytes.length<=Math.floor((dataCw*8-12)/8))return v;
  }
  throw new Error('النص أطول من أن يُرمَّز في QR هنا');
}

function encodeData(bytes,v){
  const info=VERSIONS[v],dataCw=info.groups.reduce((s,[n,d])=>s+n*d,0);
  const bits=[];
  const push=(val,n)=>{for(let i=n-1;i>=0;i--)bits.push((val>>>i)&1)};
  push(0b0100,4);push(bytes.length,8);
  for(const b of bytes)push(b,8);
  const cap=dataCw*8;
  push(0,Math.min(4,cap-bits.length));
  while(bits.length%8)bits.push(0);
  for(let p=0xEC;bits.length<cap;p=p===0xEC?0x11:0xEC)push(p,8);
  const cw=[];for(let i=0;i<bits.length;i+=8){let b=0;for(let j=0;j<8;j++)b=(b<<1)|bits[i+j];cw.push(b)}
  // تقسيم الكتل وحساب التصحيح
  const blocks=[];let pos=0;const div=rsDivisor(info.ecc);
  for(const [n,d] of info.groups)for(let k=0;k<n;k++){
    const dat=cw.slice(pos,pos+d);pos+=d;
    blocks.push({dat,ecc:rsRemainder(dat,div)});
  }
  // تداخل الكلمات: البيانات ثم التصحيح
  const out=[];const maxD=Math.max(...blocks.map(b=>b.dat.length));
  for(let i=0;i<maxD;i++)for(const b of blocks)if(i<b.dat.length)out.push(b.dat[i]);
  for(let i=0;i<info.ecc;i++)for(const b of blocks)out.push(b.ecc[i]);
  return out;
}

function buildMatrix(v,codewords,mask){
  const size=17+4*v,mod=[],fn=[];
  for(let i=0;i<size;i++){mod.push(new Array(size).fill(false));fn.push(new Array(size).fill(false))}
  // F(x,y): x عمود، y صف
  const F=(x,y,dark)=>{if(x<0||y<0||x>=size||y>=size)return;mod[y][x]=dark;fn[y][x]=true};
  // نمط التوقيت
  for(let i=0;i<size;i++){F(6,i,i%2===0);F(i,6,i%2===0)}
  // أنماط البحث الثلاثة
  const finder=(x,y)=>{for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const d=Math.max(Math.abs(dx),Math.abs(dy));F(x+dx,y+dy,d!==2&&d!==4)}};
  finder(3,3);finder(size-4,3);finder(3,size-4);
  // أنماط المحاذاة
  const al=VERSIONS[v].align,last=size-7;
  for(const y of al)for(const x of al){
    if((x===6&&y===6)||(x===6&&y===last)||(x===last&&y===6))continue;
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)F(x+dx,y+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
  }
  // مناطق الصيغة (تُحجز ثم تُكتب لاحقًا) والمربع الداكن
  const drawFormat=m=>{
    const b=formatBits(m),bit=i=>((b>>>i)&1)===1;
    for(let i=0;i<=5;i++)F(8,i,bit(i));
    F(8,7,bit(6));F(8,8,bit(7));F(7,8,bit(8));
    for(let i=9;i<15;i++)F(14-i,8,bit(i));
    for(let i=0;i<8;i++)F(size-1-i,8,bit(i));
    for(let i=8;i<15;i++)F(8,size-15+i,bit(i));
    F(8,size-8,true);
  };
  drawFormat(0);
  // وضع البيانات بالتعرج من اليمين
  let idx=0;const total=codewords.length*8;
  for(let right=size-1;right>=1;right-=2){
    if(right===6)right=5;
    for(let vert=0;vert<size;vert++)for(let j=0;j<2;j++){
      const x=right-j,upward=((right+1)&2)===0,y=upward?size-1-vert:vert;
      if(!fn[y][x]&&idx<total){mod[y][x]=((codewords[idx>>>3]>>>(7-(idx&7)))&1)===1;idx++}
    }
  }
  // تطبيق القناع
  const maskOf=(x,y)=>{switch(mask){
    case 0:return (x+y)%2===0;case 1:return y%2===0;case 2:return x%3===0;case 3:return (x+y)%3===0;
    case 4:return (Math.floor(x/3)+Math.floor(y/2))%2===0;case 5:return (x*y)%2+(x*y)%3===0;
    case 6:return ((x*y)%2+(x*y)%3)%2===0;default:return (((x+y)%2)+(x*y)%3)%2===0}};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(!fn[y][x]&&maskOf(x,y))mod[y][x]=!mod[y][x];
  drawFormat(mask);
  return mod;
}

function penalty(mod){
  const n=mod.length;let score=0;
  const lines=[];for(let i=0;i<n;i++){lines.push(mod[i]);lines.push(mod[i].map((_,j)=>mod[j][i]))}
  // N1: تشغيلات متتالية بنفس اللون
  for(const L of lines){let run=1;for(let i=1;i<=n;i++){if(i<n&&L[i]===L[i-1])run++;else{if(run>=5)score+=3+(run-5);run=1}}}
  // N2: مربعات 2x2 بنفس اللون
  for(let y=0;y<n-1;y++)for(let x=0;x<n-1;x++){const c=mod[y][x];if(c===mod[y][x+1]&&c===mod[y+1][x]&&c===mod[y+1][x+1])score+=3}
  // N3: أنماط تشبه أنماط البحث
  const A=[1,0,1,1,1,0,1,0,0,0,0],B=[0,0,0,0,1,0,1,1,1,0,1];
  const m=(L,i,P)=>P.every((p,k)=>(L[i+k]?1:0)===p);
  for(const L of lines)for(let i=0;i+11<=n;i++)if(m(L,i,A)||m(L,i,B))score+=40;
  // N4: نسبة الداكن
  let dark=0;for(const r of mod)for(const c of r)if(c)dark++;
  score+=10*Math.floor(Math.abs(dark*100/(n*n)-50)/5);
  return score;
}

function encodeMatrix(text){
  const bytes=[...new TextEncoder().encode(String(text))];
  const v=pickVersion(bytes),cw=encodeData(bytes,v);
  let best=null,bestScore=Infinity;
  for(let m=0;m<8;m++){const mod=buildMatrix(v,cw,m),s=penalty(mod);if(s<bestScore){bestScore=s;best=mod}}
  return best;
}

function svg(text,opts){
  const o=Object.assign({margin:4,dark:'#120c2e',light:'#ffffff',label:'QR code'},opts||{});
  const mod=encodeMatrix(text),n=mod.length,N=n+o.margin*2;
  let d='';
  for(let y=0;y<n;y++){let x=0;while(x<n){if(mod[y][x]){let s=x;while(x<n&&mod[y][x])x++;d+=`M${s+o.margin} ${y+o.margin}h${x-s}v1h-${x-s}z`}else x++}}
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" role="img" aria-label="${o.label}" shape-rendering="crispEdges"><rect width="${N}" height="${N}" fill="${o.light}"/><path d="${d}" fill="${o.dark}"/></svg>`;
}

// تخطيط نقطي: نقاط دائرية + أنماط بحث مدوّرة + فراغ في الوسط للشعار (logo = نسبة عرض الفراغ من عرض الرمز).
// مستوى التصحيح M يتحمل هذا الفراغ الصغير. يُستخدم لرسم SVG ولرسم canvas بنفس الشكل.
function layout(text,opts){
  const o=Object.assign({logo:0.18},opts||{});
  const mod=encodeMatrix(text),n=mod.length;
  let L=o.logo>0?Math.round(n*o.logo):0;
  if(L&&(L%2)!==(n%2))L++;
  const s=(n-L)/2,e=s+L,dots=[];
  const fin=(x,y)=>(x<7&&y<7)||(x>=n-7&&y<7)||(x<7&&y>=n-7);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(mod[y][x]&&!fin(x,y)&&!(L&&x>=s&&x<e&&y>=s&&y<e))dots.push([x,y]);
  return {n,dots,finders:[[0,0],[n-7,0],[0,n-7]],box:{x:s,y:s,size:L}};
}

function rr(x,y,w,h,r){
  return `M${x+r} ${y}h${w-2*r}a${r} ${r} 0 0 1 ${r} ${r}v${h-2*r}a${r} ${r} 0 0 1 -${r} ${r}h-${w-2*r}a${r} ${r} 0 0 1 -${r} -${r}v-${h-2*r}a${r} ${r} 0 0 1 ${r} -${r}z`;
}

// مسارات SVG جاهزة (نقاط + أنماط البحث) تُستعمل في SVG وفي Path2D لرسم الصورة المنزَّلة بنفس الشكل
function paths(text,opts){
  const l=layout(text,opts),r=0.44;
  let dots='';
  for(const [x,y] of l.dots)dots+=`M${x+0.5-r} ${y+0.5}a${r} ${r} 0 1 0 ${2*r} 0a${r} ${r} 0 1 0 -${2*r} 0`;
  let finders='';
  for(const [x,y] of l.finders)finders+=rr(x,y,7,7,1)+rr(x+1,y+1,5,5,0.6)+rr(x+2,y+2,3,3,0.7);
  return {n:l.n,dots,finders,box:l.box};
}

// SVG نقطي بلا خلفية؛ الشعار (صورة) يوضع في الفراغ الوسطي إن مُرِّر logoHref
function dotsSvg(text,opts){
  const o=Object.assign({dark:'#5331b6',label:'QR code',logo:0.18,logoHref:'',logoView:'0 0 1 1'},opts||{});
  const p=paths(text,{logo:o.logoHref?o.logo:0}),b=p.box,pad=0.5;
  const img=o.logoHref&&b.size?`<svg x="${b.x+pad}" y="${b.y+pad}" width="${b.size-2*pad}" height="${b.size-2*pad}" viewBox="${o.logoView}" preserveAspectRatio="xMidYMid meet"><image href="${o.logoHref}" width="468" height="512"/></svg>`:'';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${p.n} ${p.n}" role="img" aria-label="${o.label}"><path d="${p.dots}" fill="${o.dark}"/><path d="${p.finders}" fill="${o.dark}" fill-rule="evenodd"/>${img}</svg>`;
}

const QR={matrix:encodeMatrix,svg,layout,paths,dotsSvg};
if(typeof module!=='undefined'&&module.exports)module.exports=QR;
else root.QR=QR;
})(typeof window!=='undefined'?window:globalThis);
