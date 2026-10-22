(function(){
'use strict';
const $=s=>document.querySelector(s);
const fmt=n=>n==null?'—':'$'+Math.round(n).toLocaleString('en-US');
const fmtK=n=>n==null?'—':(n>=1e6?'$'+(n/1e6).toFixed(2).replace(/\.?0+$/,'')+'M':'$'+Math.round(n/1000)+'K');
const num=n=>n==null?'—':(Number.isInteger(n)?n:+n.toFixed(1));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const median=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2};
const NOTES={active:'Homes for sale now that meet every filter.',sold:'Homes that sold in the past 12 months and met every filter. Useful for what prices are realistic.',
  near:'Homes just over the 45-minute limit (45–48 min to one of the towns). Condition and garage were not checked for these.'};
const ELEV=[[1000,'#5b2a86','1,000 ft+'],[800,'#1f6fb2','800–999 ft'],[650,'#2e9c6a','650–799 ft'],[0,'#e0a526','500–649 ft']];
const BUD={in:['#2e7d32','In budget'],stretch:['#b26a00','Stretch'],over:['#9e2b25','Over']};
let D=null,tab='active',colorBy='elev',map,layer,markers={},defaults={};

function badge(b){const t={in:'In budget',stretch:'Stretch',over:'Over'}[b]||'';return `<span class="badge b-${b}">${t}</span>`}
function pinColor(r){if(colorBy==='budget')return (BUD[r.b]||BUD.over)[0];for(const [min,c] of ELEV) if((r.e||0)>=min) return c;return '#999'}
function note(n){if(!n||n.startsWith('OK'))return '';return n}

function readF(){const v=id=>{const x=$('#'+id).value;return x===''?null:+x};
  return {pmin:v('pmin'),pmax:v('pmax'),emin:v('emin'),dr:v('drmax'),dm:v('dmmax'),town:$('#town').value,sort:$('#sort').value,hide:$('#hideflag').checked}}
function filtered(){
  const f=readF();
  let L=D[tab].filter(r=>(f.pmin==null||(r.p||0)>=f.pmin)&&(f.pmax==null||(r.p||0)<=f.pmax)&&(f.emin==null||(r.e||0)>=f.emin)
    &&(f.dr==null||(r.dr||0)<=f.dr)&&(f.dm==null||(r.dm||0)<=f.dm)&&(!f.town||r.t===f.town)&&(!f.hide||!r.fl));
  const dt=r=>r.sd||r.ld||'';
  const S={elev:(a,b)=>(b.e||0)-(a.e||0),price:(a,b)=>(a.p||0)-(b.p||0),price_d:(a,b)=>(b.p||0)-(a.p||0),
    new:(a,b)=>dt(b).localeCompare(dt(a))||(b.e||0)-(a.e||0),drive:(a,b)=>Math.max(a.dr,a.dm)-Math.max(b.dr,b.dm)};
  return L.sort(S[f.sort]||S.elev);
}
function card(r,i){
  const id='c'+i, sold=r.s==='sold';
  const img=r.ph?`<img src="${esc(r.ph)}" alt="Photo of ${esc(r.a)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove();this.parentNode.insertAdjacentHTML('beforeend','<div class=noimg>No photo available</div>')">`:'<div class="noimg">No photo available</div>';
  const st=r.s&&r.s!=='active'&&!sold?`<span class="st">${esc(r.s)}</span>`:(sold?'<span class="st">Sold</span>':'');
  const facts=[`${num(r.bd)} bd`,`${num(r.ba)} ba`,r.sf?`${r.sf.toLocaleString()} sqft`:null,r.g!=null?`${r.g}-car garage`:'garage ?',r.yb?`built ${r.yb}`:null,r.lot!=null&&typeof r.lot==='number'?`${r.lot} ac`:null].filter(Boolean);
  let soldLine='';
  if(sold){const parts=[];if(r.sd)parts.push('Sold '+esc(String(r.sd).split(' ')[0]));if(r.lp)parts.push('list '+fmt(r.lp)+(r.p&&r.lp?` (${r.p>=r.lp?'+':''}${Math.round((r.p-r.lp)/r.lp*100)}%)`:''));soldLine=`<div class="sold">${parts.join(' · ')}</div>`}
  else if(r.ld) soldLine=`<div class="sold">Listed ${esc(r.ld)}</div>`;
  const n=note(r.n);
  return `<article class="card" id="${id}" data-i="${i}">
    <a class="ph" href="${esc(r.u)}" target="_blank" rel="noopener">${img}<span class="elev">${r.e!=null?r.e.toLocaleString():'?'} ft</span>${st}</a>
    <div class="body">
      <div class="price">${fmt(r.p)} ${badge(r.b)}</div>
      <div class="addr">${esc(r.a)}, <span class="town">${esc(r.t)} ${esc(r.z||'')}</span></div>
      <div class="facts">${facts.map(x=>`<span>${esc(x)}</span>`).join('')}</div>
      <div class="drive">Drive: <b>${num(r.dr)} min</b> to Richmond · <b>${num(r.dm)} min</b> to Milton</div>
      ${soldLine}
      ${n?`<div class="note"><span class="flag">⚑ ${esc(n)}</span></div>`:''}
      <div class="lnk"><a href="${esc(r.u)}" target="_blank" rel="noopener">View on Redfin →</a><button type="button" data-map="${i}">Show on map</button></div>
    </div></article>`;
}
function render(){
  const L=filtered();
  ['active','sold','near'].forEach(k=>$('#n-'+k).textContent=`(${D[k].length})`);
  $('#tabnote').textContent=NOTES[tab];
  const ps=L.map(r=>r.p).filter(Boolean),es=L.map(r=>r.e).filter(Boolean);
  const nb=L.filter(r=>r.b==='in').length,ns=L.filter(r=>r.b==='stretch').length;
  $('#stats').innerHTML=[[L.length,`${tab==='sold'?'sold':'homes'} shown of ${D[tab].length}`],[ps.length?fmtK(median(ps)):'—',tab==='sold'?'median sale price':'median price'],
    [es.length?`${Math.min(...es).toLocaleString()}–${Math.max(...es).toLocaleString()}`:'—','elevation range (ft)'],[`${nb} / ${ns}`,'in budget / stretch'],[L.filter(r=>r.fl).length,'flagged to verify']]
    .map(([b,s])=>`<div class="stat"><b>${b}</b><span>${s}</span></div>`).join('');
  $('#cards').innerHTML=L.length?L.map((r,i)=>card(r,i)).join(''):'<div class="empty">No homes match these filters. Try widening the price or drive limits, or hit Reset.</div>';
  drawPins(L);
}
function drawPins(L){
  if(!map)return; layer.clearLayers(); markers={}; const pts=[];
  L.forEach((r,i)=>{if(r.la==null)return;
    const m=L_.circleMarker([r.la,r.lo],{radius:8,color:'#fff',weight:2,fillColor:pinColor(r),fillOpacity:.95});
    m.bindPopup(`<b>${esc(r.a)}, ${esc(r.t)}</b><br>${fmt(r.p)} · ${r.e} ft<br>${num(r.dr)} min Richmond · ${num(r.dm)} min Milton<br><a href="#c${i}" data-go="${i}">See card ↓</a>`);
    m.on('click',()=>focusCard(i,false)); m.addTo(layer); markers[i]=m; pts.push([r.la,r.lo]);});
  Object.values(D.towns).forEach(t=>pts.push(t));
  if(pts.length){map.invalidateSize();map.fitBounds(pts,{padding:[30,30],maxZoom:12});}
}
function focusCard(i,openPin){
  document.querySelectorAll('.card.hl').forEach(c=>c.classList.remove('hl'));
  const c=document.getElementById('c'+i); if(c){c.classList.add('hl');c.scrollIntoView({behavior:'smooth',block:'center'})}
  if(openPin&&markers[i]){map.setView(markers[i].getLatLng(),Math.max(map.getZoom(),12));markers[i].openPopup();
    if(window.innerWidth<=860) document.getElementById('map').scrollIntoView({behavior:'smooth'});}
}
let L_;
function initMap(){
  if(!window.L){document.getElementById('map').innerHTML='<div class="empty">Map failed to load.</div>';return}
  L_=window.L; map=L_.map('map',{scrollWheelZoom:true});
  L_.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
  layer=L_.layerGroup().addTo(map);
  Object.entries(D.towns).forEach(([n,ll])=>L_.marker(ll,{icon:L_.divIcon({className:'',html:`<div class="townpin">★ ${n}</div>`,iconSize:null,iconAnchor:[10,10]}),zIndexOffset:1000}).addTo(map).bindTooltip(n+' village (drive-time origin)'));
  const lg=L_.control({position:'bottomright'});
  lg.onAdd=()=>{const d=L_.DomUtil.create('div','legend');L_.DomEvent.disableClickPropagation(d);d.innerHTML=legendHTML();return d};lg.addTo(map);
}
function legendHTML(){
  const rows=colorBy==='elev'?ELEV.map(([,c,t])=>`<i style="background:${c}"></i>${t}`):Object.values(BUD).map(([c,t])=>`<i style="background:${c}"></i>${t}`);
  return `<div><b>Pin color:</b> <select id="colorby"><option value="elev"${colorBy==='elev'?' selected':''}>Elevation</option><option value="budget"${colorBy==='budget'?' selected':''}>Budget</option></select></div>`+rows.join('<br>');
}
function setDefaults(){
  $('#pmin').value='';$('#pmax').value=D.max_price||650000;$('#emin').value='';$('#drmax').value='';$('#dmmax').value='';$('#town').value='';$('#sort').value='elev';$('#hideflag').checked=false;
}
function towns(){const s=new Set();['active','sold','near'].forEach(k=>D[k].forEach(r=>s.add(r.t)));
  $('#town').innerHTML='<option value="">All towns</option>'+[...s].sort().map(t=>`<option>${esc(t)}</option>`).join('')}
function bind(){
  document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab;document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x===b));
    $('#sort').value=tab==='active'?$('#sort').value:$('#sort').value;render()}));
  ['pmin','pmax','emin','drmax','dmmax'].forEach(id=>$('#'+id).addEventListener('input',render));
  ['town','sort','hideflag'].forEach(id=>$('#'+id).addEventListener('change',render));
  $('#reset').addEventListener('click',()=>{setDefaults();render()});
  document.addEventListener('click',e=>{const m=e.target.closest('[data-map]');if(m){focusCard(+m.dataset.map,true);return}
    const g=e.target.closest('[data-go]');if(g){e.preventDefault();focusCard(+g.dataset.go,false)}});
  document.addEventListener('change',e=>{if(e.target.id==='colorby'){colorBy=e.target.value;document.querySelector('.legend').innerHTML=legendHTML();render()}});
}
fetch('data.json?v='+Date.now(),{cache:'no-store'}).then(r=>r.json()).then(d=>{
  D=d;$('#updated').textContent=new Date(d.updated+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
  if(window.innerWidth<=860)$('.filters').removeAttribute('open');
  towns();setDefaults();bind();initMap();render();
  window.addEventListener('load',()=>{if(map){map.invalidateSize();render()}});
}).catch(e=>{$('#cards').innerHTML='<div class="empty">Could not load listing data ('+esc(e.message)+').</div>'});
})();
