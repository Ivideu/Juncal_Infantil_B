/* infantilb-extra.js · se carga DESPUÉS del script principal de InfantilB.html.
   Da a Infantil B los mismos cromos-camiseta (20 aniversario) y el mismo selector de goleador que el resto de categorías.
   NO escribe en S ni en Firebase: no toca clasificación, goleadores, convocatoria, entrenos ni ningún otro dato.
   Solo cambia cómo se DIBUJAN los cromos de jugadores; los entrenadores (Javier, Ivan) conservan su cromo PNG. */
(function(){
const BLANK="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
/* ---------- Cromo = camiseta con nombre y dorsal ---------- */
const BI={img:null};let memo={};
const refresca=()=>{memo={};render()};
(function(){const r=[BASE+"Cromos/camiseta-base.jpg",BASE+"Images/camiseta-base.jpg"];let n=0;const i=new Image();
 i.onload=()=>{BI.img=i;refresca()};i.onerror=()=>{if(++n<r.length)i.src=r[n]};i.src=r[0]})();
/* Tipografías (Google Fonts): nombre = Knewave, dorsal = Fredoka. Se re-dibuja cuando cargan */
(function(){const l=document.createElement("link");l.rel="stylesheet";l.href="https://fonts.googleapis.com/css2?family=Knewave&family=Russo+One&family=Fredoka:wght@700&display=swap";
 l.onload=()=>Promise.all([document.fonts.load('60px "Knewave"',"ABCÑÓ"),document.fonts.load('700 360px "Fredoka"',"0123456789")]).then(refresca).catch(()=>{});
 document.head.appendChild(l)})();
/* Texto distinto del nombre en la camiseta (opcional): CAM_TXT["Alex"]="A.GARCIA" */
const CAM_TXT=window.CAM_TXT||(window.CAM_TXT={});
/* Posiciones sobre la imagen original de 992x1072 */
const CAM={out:640,
 nom:{font:'"Knewave","Permanent Marker","Impact",sans-serif',cx:492,base:326,cap:66,maxW:400,sx:.92,skew:0},
 num:{font:'700 {s}px "Fredoka","Russo One","Barlow Condensed","Impact",sans-serif',cx:497,base:622,size:360,maxW:340,skew:-.06,navy:"#14308f"}};
function draw(c){
 const key=JSON.stringify([c.key,c.name,c.num,CAM_TXT[c.name]||""]);
 if(memo[key])return memo[key];
 const k=CAM.out/992,cv=document.createElement("canvas");cv.width=CAM.out;cv.height=Math.round(1072*k);
 const g=cv.getContext("2d");g.scale(k,k);g.drawImage(BI.img,0,0,992,1072);
 g.textAlign="center";g.textBaseline="alphabetic";g.lineJoin="round";
 const t=String(CAM_TXT[c.name]||c.name||"").toUpperCase();
 if(t){const n=CAM.nom;let s=n.cap/.74;g.font=s+"px "+n.font;const w=g.measureText(t).width*n.sx;if(w>n.maxW){s*=n.maxW/w;g.font=s+"px "+n.font}
  g.save();g.translate(n.cx,n.base);g.transform(n.sx,0,n.skew*n.sx,1,0,0);
  g.fillStyle="#fff";g.shadowColor="rgba(8,20,70,.6)";g.shadowBlur=5;g.shadowOffsetY=3;g.fillText(t,0,0);g.restore()}
 const d=String(c.num||"").trim();
 if(d){const n=CAM.num;let s=n.size;g.font=n.font.replace("{s}",s);const w=g.measureText(d).width;if(w>n.maxW){s*=n.maxW/w;g.font=n.font.replace("{s}",s)}
  g.save();g.translate(n.cx,n.base);g.transform(1,0,n.skew,1,0,0);g.lineJoin="round";
  g.fillStyle=n.navy;g.strokeStyle=n.navy;g.lineWidth=s*.06;g.fillText(d,14,14);g.strokeText(d,14,14);
  g.strokeStyle="#fff";g.lineWidth=s*.075;g.strokeText(d,0,0);
  g.strokeStyle=n.navy;g.lineWidth=s*.04;g.strokeText(d,0,0);
  g.fillStyle="#fff";g.fillText(d,0,0);g.restore()}
 return memo[key]=cv.toDataURL("image/jpeg",.9)}
/* Entrenadores: su PNG de siempre. Jugadores (con cromo de archivo o añadidos en Plantilla): camiseta */
const camSrc=c=>c.coach?CROMOS_DIR+encodeURIComponent(c.file):(BI.img?draw(c):BLANK);
window.camSrc=camSrc;

/* ---------- Estilos ---------- */
document.head.insertAdjacentHTML("beforeend","<style>.cvc img{aspect-ratio:auto;max-width:170px}.cvph{aspect-ratio:992/1072;max-width:170px}"+
"#pickOv .pk-t{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;width:auto;height:auto;padding:0;background:none;border:0;border-radius:14px;box-shadow:none;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .12s}#pickOv .pk-t:active{transform:scale(.95)}#pickOv .pk-t .pk-i{flex:none;display:block;width:auto;height:auto;object-fit:contain;border-radius:12px;box-shadow:0 6px 18px #0009}#pickOv .pk-ball{display:grid;place-items:center;background:linear-gradient(160deg,#1d3a8a,#0a1a4d);border:2px solid #7aa9ff;font-size:5em;line-height:1;color:#fff}#pickOv .pk-b{display:flex;align-items:center;justify-content:center;gap:.4em;max-width:100%;padding:.18em .5em;background:#fff;border:3px solid #ffd23f;border-radius:.7em;box-shadow:0 .12em 0 #b8860b;color:#0a1a4d;overflow:hidden}#pickOv .pk-n{flex:none;display:grid;place-items:center;min-width:1.7em;height:1.7em;padding:0 .3em;border-radius:99px;background:#0f2a6b;color:#ffd23f;font:700 .8em/1 Fredoka,'Barlow Condensed',sans-serif}#pickOv .pk-m{min-width:0;font:800 1em/1.1 'Barlow Condensed',sans-serif;text-transform:uppercase;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#pickOv .pk-o .pk-b{background:#e6eaf5;border-color:#9aa5c4;box-shadow:0 .12em 0 #6b7392}#pickOv .pk-o .pk-m{font-size:.7em;white-space:normal;text-align:center}</style>");

/* ---------- Selector de goleador: camisetas con casilla de número y nombre ---------- */
window.pickGol=function(j,h){
 closePick();
 const jug=jugList().filter(c=>cEst(c)==="convocado");
 const ov=document.createElement("div");ov.id="pickOv";
 if(FS&&innerHeight>innerWidth)ov.classList.add("rot");
 const tile=c=>`<button class="pk-c pk-t" ${c.extra?`data-p="${esc(c.pl)}"`:`data-f="${esc(c.file)}"`} aria-label="${esc(c.name)}"><img class="pk-i" src="${camSrc(c)}" alt=""><div class="pk-b">${c.num?`<b class="pk-n">${esc(c.num)}</b>`:""}<span class="pk-m">${esc(c.name)}</span></div></button>`;
 ov.innerHTML=`<div class="pk-h">¿QUIÉN HA MARCADO?</div><div class="pk-g">${jug.map(tile).join("")}<button class="pk-c pk-t pk-o" data-o="1"><div class="pk-i pk-ball">⚽</div><div class="pk-b"><span class="pk-m">En propia puerta del rival</span></div></button></div><button class="pk-x">Cancelar</button>`;
 ov.onclick=e=>{const b=e.target.closest("button");
  if(b&&b.dataset.f)goalBy(j,h,b.dataset.f);
  else if(b&&b.dataset.p!==undefined)goalBy(j,h,"",b.dataset.p);
  else if(b&&b.dataset.o)goalBy(j,h,"");
  else if((b&&b.classList.contains("pk-x"))||e.target===ov)closePick()};
 document.body.appendChild(ov);fitPick();ov.querySelectorAll("img").forEach(i=>{if(!i.complete)i.onload=fitPick})};
window.fitPick=function(){const ov=document.getElementById("pickOv");if(!ov)return;ov.classList.toggle("rot",FS&&innerHeight>innerWidth);
 const g=ov.querySelector(".pk-g"),t=[...g.children],n=t.length,W=g.clientWidth,H=g.clientHeight,gap=Math.max(8,Math.min(W,H)*.02),ar=992/1072;
 const L=Math.max(5,...t.filter(b=>!b.classList.contains("pk-o")).map(b=>b.querySelector(".pk-m").textContent.length));
 const emW=.9+1.4+.4+L*.5;let best=null;
 for(let c=1;c<=n;c++){const r=Math.ceil(n/c),w=(W-gap*(c-1))/c,h=(H-gap*(r-1))/r,f=Math.min(w/emW,h*.17),ih=h-f*1.9-12;if(ih<=0)continue;
  const iw=Math.min(w,ih*ar),sc=f*iw;if(!best||sc>best.sc)best={c,w,h,f,iw,sc}}
 if(!best)best={c:n,w:W/n,h:H,f:12,iw:W/n,sc:0};
 g.style.gap=gap+"px";g.style.gridTemplateColumns=`repeat(${best.c},${Math.floor(best.w)}px)`;g.style.gridAutoRows=Math.floor(best.h)+"px";
 t.forEach(b=>{b.style.width=Math.floor(best.w)+"px";b.style.height=Math.floor(best.h)+"px";
  const i=b.querySelector(".pk-i");i.style.width=Math.floor(best.iw)+"px";i.style.height=Math.floor(best.iw/ar)+"px";
  if(i.classList.contains("pk-ball"))i.style.fontSize=Math.floor(best.iw*.4)+"px";
  b.querySelector(".pk-b").style.fontSize=Math.floor(best.f)+"px"})};

/* ---------- Pestaña Jugadores, miniaturas, cromo ampliado y celebración: misma lógica de siempre, con la camiseta ---------- */
window.renderJug=function(){
 const ed=E(),jug=jugList(),tec=CROMOS.filter(c=>c.coach),nx=nextM(),nm_=nx?M(nx.r.n,nx.h):{};
 const tit=nx?`Jugadores convocados para ${lab(nx.r)}`:"Jugadores convocados",
  sub=nx?`📅 ${fmt(nm_.d||nx.r.d)}${nm_.t?" · "+esc(nm_.t)+" h":""}<br>⚽ ${esc(nm(nx.h))} vs ${esc(nm(nx.a))}`:"Temporada 2026/27";
 const tile=c=>{const st=cEst(c)==="convocado",k=esc(c.key),
  lab=[c.num?"#"+c.num:"",POSN[c.pos]||c.pos||""].filter(Boolean).map(esc).join(" · "),
  sw=ed?`<div class="cvb"><button class="s" aria-pressed="${st}" aria-label="${esc(c.name)} convocado" data-k="${k}" onclick="setCon(this.dataset.k,'convocado')">SÍ</button><button class="n" aria-pressed="${!st}" aria-label="${esc(c.name)} no convocado" data-k="${k}" onclick="setCon(this.dataset.k,'descartado')">NO</button></div>`
   :`<div class="cvst ${st?"s":"n"}" role="img" aria-label="${esc(c.name)}: ${st?"convocado":"no convocado"}">${st?"SÍ CONVOCADO":"NO CONVOCADO"}</div>`,
  im=`<img src="${camSrc(c)}" alt="Cromo de ${esc(c.name)}" loading="lazy" ${c.extra?"":`onclick="openCromo('${esc(c.file)}')"`}>`;
  return`<div class="cvc ${st?"si":"no"}">${im}<div class="cvname"><b>${esc(c.name)}</b><span class="gap">${lab}</span></div>${ed?`<div class="cvl">CONVOCADO</div>`:""}${sw}</div>`};
 const sec=(t,l)=>{const n=l.filter(c=>cEst(c)==="convocado").length;return`<div class="cvhd"><h2>${t}</h2><span class="cvs">✓ ${n}</span><span class="cvs x">✕ ${l.length-n}</span></div><div class="cvg">${l.map(tile).join("")}</div>`};
 return`<div class="card"><h2 style="font-size:1.6rem;color:#0f2a6b;line-height:1.1">${tit}</h2><div class="cvsub">${sub}</div>${ed?'<small class="gap">Pulsa SÍ o NO en cada persona para cambiar la convocatoria.</small>':""}</div>`
  +sec("Jugadores",jug)+sec("Cuerpo técnico",tec)};
window.openCromo=function(f){
 const c=CROMOS.find(x=>x.file===f);if(!c)return;
 closeCromo();
 const ov=document.createElement("div");ov.id="cromoOv";
 ov.style.cssText="position:fixed;inset:0;z-index:9999;background:rgba(2,8,23,.93);display:flex;align-items:center;justify-content:center;padding:16px";
 ov.innerHTML=`<div style="position:relative;line-height:0"><div class="cromo mod"><img src="${camSrc(c)}" alt="Cromo de ${esc(c.name)}" style="display:block;max-height:86vh;max-width:90vw;width:auto;height:auto;border-radius:20px"></div><button aria-label="Cerrar" style="position:absolute;top:-12px;right:-12px;width:42px;height:42px;padding:0;border-radius:50%;font-size:1.4rem;line-height:1;background:#fff;color:#10234b;border:2px solid #dbeafe;cursor:pointer">×</button></div>`;
 ov.onclick=e=>{if(e.target===ov||e.target.tagName==="BUTTON")closeCromo()};
 document.body.appendChild(ov);document.body.style.overflow="hidden"};
window.gMini=function(n){const c=cromoFor(n);
 return c?`<img class="gmini" src="${camSrc(c)}" alt="Cromo de ${esc(c.name)}" loading="lazy" onclick="openCromo('${esc(c.file)}')">`:`<span class="gmini no">${shirt(pn(n).num,"#2f7bff")}</span>`};
window.goalWatch=function(){
 const lv=liveM();if(!lv){GW=null;return}
 const m=M(lv.r.n,lv.h),k=lv.r.n+"_"+lv.h,g=Object.assign({},m.g||{});
 if(!GW||GW.k!==k){GW={k,g};return}
 let n=null;for(const q in g)if((g[q]||0)>(GW.g[q]||0))n=q;
 GW={k,g};if(n)celebrate(n,m,lv)};
window.celebrate=function(n,m,lv){
 closeGol();
 const own=String(n).startsWith("Propia"),c=cromoFor(n),p=pn(n),mins=(m.gm&&m.gm[n])||[],mi=mins.length?Math.max(...mins):0;
 const ov=document.createElement("div");ov.id="golOv";
 if(FS&&innerHeight>innerWidth)ov.classList.add("rot");
 const face=c?`<img src="${camSrc(c)}" alt="Cromo de ${esc(c.name)}">`:own?`<span style="font-size:20vmin;line-height:1;position:relative">⚽</span>`:shirt(p.num,"#2f7bff");
 const nom=own?"¡Gol en propia puerta del rival!":esc(p.name)+(p.num?" · "+esc(p.num):"");
 ov.innerHTML=`<div class="go-t">¡GOL!</div><div class="go-c">${face}</div><div class="go-n">${nom}</div><div class="go-s">${mi?"Minuto "+mi+"' · ":""}${esc(nm(lv.h))} ${m.h||0} - ${m.a||0} ${esc(nm(lv.a))}</div>`;
 const E_=["⚽","🎉","⭐","🥅","✨"],cols=["#ffd23f","#2f7bff","#22c55e","#fff","#f472b6"];
 for(let i=0;i<46;i++){const e=document.createElement("span");e.className="go-k";const em=Math.random()<.4;
  e.textContent=em?E_[i%E_.length]:"";
  e.style.cssText=`left:${Math.random()*100}%;animation-duration:${2.6+Math.random()*3}s;animation-delay:-${Math.random()*4}s;`+(em?`font-size:${18+Math.random()*22}px`:`width:${7+Math.random()*7}px;height:${12+Math.random()*10}px;background:${cols[i%cols.length]};border-radius:2px`);
  ov.appendChild(e)}
 ov.onclick=closeGol;document.body.appendChild(ov);
 try{if(navigator.vibrate)navigator.vibrate([120,60,120])}catch(e){}
 clearTimeout(celebrate.t);celebrate.t=setTimeout(closeGol,6500)};
render();
})();