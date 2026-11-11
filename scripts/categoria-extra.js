/* categoria-extra.js · se carga DESPUÉS del script principal de cada categoría.
   Añade: cromos creados desde el admin, contraseña propia por categoría, barra inferior solo para el propietario. */
(function(){
const OWN=()=>document.body.classList.contains("owner");
let AUTH_EMAIL=CAT.email;try{AUTH_EMAIL=sessionStorage.getItem("em")||CAT.email}catch(e){}
if(AUTH_EMAIL===FBMAIL)document.body.classList.add("owner");
document.head.insertAdjacentHTML("beforeend","<style>body.edit:not(.owner) #adm{display:none!important}.cvf{display:inline-flex;gap:6px;align-items:center;background:#e9f0ff;border-radius:99px;padding:2px 4px 2px 12px;font-weight:600}.cvf button{padding:0 8px;border-radius:99px}</style>");

/* ---------- Login: contraseña de la categoría o contraseña del propietario ---------- */
window.fbLogin=async function(pw,em){const r=await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key="+FBKEY,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:em||AUTH_EMAIL,password:pw,returnSecureToken:true})}),d=await r.json();
 if(!d.idToken)return false;idt=d.idToken;exp=Date.now()+(d.expiresIn-120)*1000;return true};
window.unlock=async function(){const p=(prompt("Contraseña de entrenador")||"").trim();if(!p)return;
 let ok=false,own=false;
 try{ok=await fbLogin(p,CAT.email);if(!ok){ok=own=await fbLogin(p,FBMAIL)}}catch(e){return alert("Error de conexión")}
 if(!ok)return alert("Contraseña incorrecta");
 AUTH_EMAIL=own?FBMAIL:CAT.email;PW=p;
 try{sessionStorage.setItem("adm","1");sessionStorage.setItem("pw",p);sessionStorage.setItem("em",AUTH_EMAIL)}catch(e){}
 document.body.classList.add("edit");document.body.classList.toggle("owner",own);render()};
const _se=window.setEdit;
window.setEdit=function(on){if(!on){document.body.classList.remove("owner");AUTH_EMAIL=CAT.email;try{sessionStorage.removeItem("em")}catch(e){}}_se(on)};

/* ---------- Calendario que llega de la sincronización (S.cfg) ---------- */
function cfg2(){const c=S.cfg;if(!c||CAT.me)return;
 Object.keys(T).forEach(k=>{if(k<100&&k!=99)delete T[k]});Object.keys(COD).forEach(k=>delete COD[k]);
 Object.assign(T,c.T||{});Object.assign(COD,c.COD||{});J.length=0;
 (c.R||[]).forEach((s,i)=>{const[d,p]=s.split("|");J.push({n:i+1,d:d.split("-").reverse().join("-"),p:p.split(",").map(x=>x.split("-").map(Number))})});
 ME=+Object.keys(COD).find(k=>String(COD[k])===String(c.equipo||CAT.equipo))||0}

/* ---------- Cromos generados ---------- */
const POS={portero:"PORTERO",cierre:"CIERRE",ala:"ALA",pivot:"PÍVOT",entrenador:"ENTRENADOR"};
function cromoSVG(c){const x=s=>String(s??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m])),
 nm=String(c.name).toUpperCase(),fs=nm.length>10?34:nm.length>7?42:52,F='font-family="Impact,\'Arial Narrow\',Arial,sans-serif"';
 const s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 330 600"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3d8bff"/><stop offset=".55" stop-color="#1e4fd8"/><stop offset="1" stop-color="#0a1a4d"/></linearGradient><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe066"/><stop offset="1" stop-color="#d99a00"/></linearGradient></defs>
<rect width="330" height="600" rx="24" fill="#071238"/><rect x="7" y="7" width="316" height="586" rx="19" fill="url(#a)" stroke="url(#g)" stroke-width="6"/>
<path d="M7 150L323 60V170L7 262Z" fill="#ffd23f" opacity=".92"/><path d="M7 300L323 230V300L7 372Z" fill="#fff" opacity=".12"/>
<text x="165" y="42" text-anchor="middle" font-size="21" fill="#fff" letter-spacing="3" ${F}>TORREJÓN JUNCAL</text>
<path d="M62 492Q62 345 165 322Q268 345 268 492Z" fill="#ffd23f" stroke="#0a1a4d" stroke-width="4"/>
<circle cx="165" cy="262" r="54" fill="#dbe7ff" stroke="#0a1a4d" stroke-width="4"/>
${c.coach?"":`<text x="165" y="440" text-anchor="middle" font-size="90" fill="#0a1a4d" ${F}>${x(c.num)}</text>`}
<path d="M7 492H323V574Q323 593 304 593H26Q7 593 7 574Z" fill="#071238" opacity=".92"/>
<text x="165" y="544" text-anchor="middle" font-size="${fs}" fill="url(#g)" ${F}>${x(nm)}</text>
<text x="165" y="578" text-anchor="middle" font-size="19" fill="#fff" letter-spacing="4" ${F}>${x(POS[c.pos]||String(c.pos||"").toUpperCase())}</text></svg>`;
 return"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(s)}
function buildCromos(){CROMOS.length=0;
 (S.cromos||[]).forEach(c=>CROMOS.push({file:"g_"+c.id,key:"g_"+c.id,name:c.name,num:c.num||"",pos:c.pos,coach:!!c.coach,src:cromoSVG(c)}));
 CROMOS.sort((a,b)=>a.coach-b.coach||(a.pos==="portero"?0:1)-(b.pos==="portero"?0:1)||(+a.num||0)-(+b.num||0))}
window.addCromo=function(){const g=i=>document.getElementById(i).value.trim(),name=g("cn_name").replace(/[.$#\[\]\/]/g,""),num=g("cn_num"),pos=g("cn_pos"),coach=pos==="entrenador";
 if(!name||(!coach&&num===""))return alert("Pon el nombre y, si es jugador, el número");
 S.cromos=S.cromos||[];S.cromos.push({id:Date.now().toString(36),name,num:coach?"":num,pos,coach});
 if(!coach){if(!S.pl.includes(name)){S.pl.push(name);S.pl.sort((a,b)=>a.localeCompare(b))}S.dn[name]=num}
 save()};
window.delCromo=function(id){const c=(S.cromos||[]).find(x=>x.id===id);if(!c||!confirm("¿Borrar el cromo de "+c.name+"?"))return;
 S.cromos=S.cromos.filter(x=>x.id!==id);
 if(!c.coach){const i=S.pl.indexOf(c.name);if(i>-1){S.pl.splice(i,1);delete S.dn[c.name]}}save()};
function cromoForm(){const L=(S.cromos||[]).map(c=>`<span class="cvf">${esc(c.name)} ${c.coach?"· entrenador":"· "+esc(c.num)+" · "+esc(POS[c.pos]||c.pos)}<button onclick="delCromo('${c.id}')" aria-label="Borrar">✕</button></span>`).join("");
 return`<div class="card"><h2 style="font-size:1.5rem;color:#0f2a6b">Crear cromo</h2><div class="ed" style="display:flex"><input id="cn_name" placeholder="Nombre (sin apellido)"><input id="cn_num" class="g" type="number" min="0" max="99" placeholder="Nº"><select id="cn_pos"><option value="portero">Portero</option><option value="cierre">Cierre</option><option value="ala">Ala</option><option value="pivot">Pívot</option><option value="entrenador">Entrenador</option></select><button class="on" onclick="addCromo()">＋ Crear cromo</button></div><div class="cvsum">${L||'<small class="gap">Aún no hay cromos.</small>'}</div></div>`}

/* ---------- Enganche en render ---------- */
const _rn=window.render;
window.render=function(){cfg2();buildCromos();_rn();
 if(!E())return;
 if(tab=="pla")document.getElementById("app").insertAdjacentHTML("afterbegin",cromoForm());
 if(!OWN())document.getElementById("nav").insertAdjacentHTML("beforeend",'<button onclick="setEdit(false)"><span>🔓</span><span>Salir</span></button>')};
render();
})();
