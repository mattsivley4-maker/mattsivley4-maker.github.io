/* Hospital flags use the existing map projection. They never change base coordinates or rings. */
'use strict';
window.createHospitalLayer = ({world, before, projection, svg, zoom, getScale, hideBaseTooltip}) => {
  const data=window.GMR_HOSPITAL_DATA, hospitals=data.hospitals;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key=h=>String(h.level||'none'), level=h=>data.levels[key(h)];
  const layer=world.insert('g',()=>before.node()).attr('class','hospital-layer');
  let visible=[],selected=null,timer;
  const tooltip=$('hospital-tooltip'), detail=$('hospital-detail');
  const hideTooltip=()=>{clearTimeout(timer);tooltip.hidden=true;};
  const scheduleHide=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(!tooltip.matches(':hover')&&!tooltip.contains(document.activeElement))hideTooltip();},300);};
  const badge=h=>`<span class="hospital-badge" style="--flag:${level(h).color}">${esc(level(h).label)}</span>`;
  const status=h=>h.level&&h.designationStatus!=='Designated'?` · ${esc(h.designationStatus)}`:'';
  const button=h=>`<button class="hospital-record" data-hospital="${esc(h.id)}">${esc(h.name)}</button>`;
  const wire=container=>container.querySelectorAll('[data-hospital]').forEach(b=>b.onclick=()=>select(hospitals.find(h=>h.id===b.dataset.hospital),true));
  $('hospital-levels').innerHTML=Object.entries(data.levels).map(([k,v])=>`<label><input type="checkbox" value="${k}" checked><span class="flag-key" style="--flag:${v.color}" aria-hidden="true"></span>${esc(v.label)} <small>(${hospitals.filter(h=>key(h)===k).length})</small></label>`).join('');
  $('hospital-scope').textContent=data.scope.counties.join(', ')+'.';
  $('hospital-records').innerHTML=hospitals.map(h=>`<tr><td>${button(h)}<small>${esc(h.county)} County · ${h.highlightedCounty?'Highlighted':'Neighboring'}<br>${esc(h.type)}</small></td><td>${badge(h)}${status(h)}</td><td>${esc(h.address)}<small>${esc(h.city)}, TX ${esc(h.zip)}</small></td></tr>`).join('');
  wire($('hospital-records'));
  function select(h,focusMap=false){
    selected=h;hideTooltip();hideBaseTooltip();
    // A directory selection also restores that hospital if its filter was disabled.
    $('hospitals-visible').checked=true;
    $(`hospital-levels`).querySelector(`input[value="${key(h)}"]`).checked=true;
    $('hospital-search').value='';render();
    const peers=hospitals.filter(x=>h.sharedCoordinateIds.includes(x.id));
    detail.hidden=false;
    detail.innerHTML=`<div class="detail-top"><div><p class="eyebrow">HOSPITAL · ${esc(h.county)} COUNTY</p><h2>${esc(h.name)}</h2></div><button class="hospital-close" aria-label="Close hospital details">×</button></div>${badge(h)}${status(h)}<p>${esc(h.address)}, ${esc(h.city)}, TX ${esc(h.zip)}</p><div class="details-grid"><div><strong>Facility type</strong>${esc(h.type)}${h.services?`<br>${esc(h.services)}`:''}</div><div><strong>Listed hospital phone</strong><a href="tel:+1${h.phone.replace(/\D/g,'')}">${esc(h.phone.replace(/^(\d{3})(\d{3})(\d{4})$/,'($1) $2-$3'))}</a></div><div><strong>Trauma review</strong>DSHS list: October 28, 2026${h.designationExpiration?`<br>Listed expiration: ${esc(h.designationExpiration)}`:''}</div><div><strong>Map position</strong>${h.lat.toFixed(5)}, ${h.lng.toFixed(5)}<br>${esc(h.coordinateMethod)}</div></div><p>${esc(h.note)}</p>${h.aliases?`<p>${h.aliases.map(esc).join('<br>')}</p>`:''}${peers.length?`<div class="hospital-peers"><strong>Other hospitals at this address point</strong>${peers.map(button).join('')}</div>`:''}<div class="sources">${h.sources.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>`).join('')}</div><p class="muted">Source review: October 31, 2026. Gray means no current DSHS trauma designation was found; it does not mean an emergency department is available. Inpatient specialty, rehabilitation and psychiatric hospitals are included.</p>`;
    detail.querySelector('.hospital-close').onclick=()=>{detail.hidden=true;selected=null;resize();};wire(detail);
    if(focusMap){const [x,y]=projection([h.lng,h.lat]);const k=12;svg.transition().duration(350).call(zoom.transform,d3.zoomIdentity.translate(500-x*k,430-y*k).scale(k));}
    detail.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  function showTooltip(event,h){
    clearTimeout(timer);hideBaseTooltip();
    const p=projection([h.lng,h.lat]),k=getScale();
    const nearby=visible.filter(x=>{const q=projection([x.lng,x.lat]);return Math.hypot(p[0]-q[0],p[1]-q[1])*k<16;});
    tooltip.innerHTML=`<button class="hospital-tip-close" aria-label="Close hospital quick details">×</button><strong>${esc(h.name)}</strong><p>${badge(h)}${status(h)}<br>${esc(h.type)}<br>${esc(h.address)}, ${esc(h.city)}<br>${esc(h.county)} County</p><button class="hospital-record" data-hospital="${esc(h.id)}">Hospital details and sources</button>${nearby.length>1?`<div class="hospital-peers"><strong>Nearby / overlapping flags (${nearby.length})</strong>${nearby.filter(x=>x.id!==h.id).map(button).join('')}</div>`:''}`;
    wire(tooltip);tooltip.querySelector('.hospital-tip-close').onclick=hideTooltip;tooltip.hidden=false;
    const shell=document.querySelector('.map-shell').getBoundingClientRect(),box=event.currentTarget.getBoundingClientRect();
    tooltip.style.maxHeight=`${Math.max(90,shell.height-24)}px`;
    const width=tooltip.offsetWidth,height=tooltip.offsetHeight;
    tooltip.style.left=`${Math.max(6,Math.min(box.right-shell.left+10,shell.width-width-8))}px`;
    tooltip.style.top=`${Math.max(6,Math.min(box.top-shell.top-height-8,shell.height-height-8))}px`;
  }
  function resize(){
    layer.selectAll('.hospital-flag').attr('transform',h=>`translate(${projection([h.lng,h.lat])}) scale(${1/getScale()})`).classed('selected',h=>h.id===selected?.id);
    if(selected)layer.selectAll('.hospital-flag').filter(h=>h.id===selected.id).raise();
  }
  function render(){
    hideTooltip();
    const enabled=new Set([...$('hospital-levels').querySelectorAll('input:checked')].map(x=>x.value));
    const q=$('hospital-search').value.trim().toLowerCase();
    const matches=hospitals.filter(h=>enabled.has(key(h))&&`${h.name} ${h.city} ${h.county} ${h.address} ${h.type} ${(h.aliases||[]).join(' ')}`.toLowerCase().includes(q));
    visible=$('hospitals-visible').checked?matches:[];
    $('hospital-count').textContent=`${visible.length} hospital flags shown · ${matches.length} matching records`;
    $('hospital-results').innerHTML=matches.map(h=>`<div class="hospital-result">${button(h)}<small>${esc(h.county)} County · ${esc(level(h).label)}${status(h)}</small></div>`).join('')||'<p>No matching hospitals.</p>';
    wire($('hospital-results'));
    layer.selectAll('.hospital-flag').data(visible,h=>h.id).join(enter=>{
      const g=enter.append('g').attr('class','hospital-flag');
      g.append('path').attr('class','flag-stem').attr('d','M0,0V-15');
      g.append('rect').attr('class','flag-square').attr('x',0).attr('y',-15).attr('width',7).attr('height',7);
      g.append('rect').attr('class','flag-hit').attr('x',-3).attr('y',-18).attr('width',13).attr('height',20);
      return g;
    }).attr('data-id',h=>h.id).attr('data-level',key).attr('tabindex',0).attr('role','button').attr('aria-label',h=>`${h.name}, ${level(h).label}, ${h.county} County`).on('pointerenter',showTooltip).on('pointerleave',scheduleHide).on('focus',showTooltip).on('blur',scheduleHide).on('click',(e,h)=>{e.stopPropagation();select(h);}).on('keydown',(e,h)=>{if(['Enter',' '].includes(e.key)){e.preventDefault();select(h);}}).select('.flag-square').attr('fill',h=>level(h).color);
    resize();
  }
  $('hospitals-visible').addEventListener('change',render);
  $('hospital-levels').addEventListener('change',render);
  $('hospital-search').addEventListener('input',render);
  $('hospital-fit').onclick=()=>{const points=hospitals.map(h=>projection([h.lng,h.lat]));const x=d3.extent(points,p=>p[0]),y=d3.extent(points,p=>p[1]);const k=Math.min(8,820/(x[1]-x[0]),690/(y[1]-y[0]));svg.transition().duration(350).call(zoom.transform,d3.zoomIdentity.translate(500-k*(x[0]+x[1])/2,430-k*(y[0]+y[1])/2).scale(k));};
  tooltip.addEventListener('pointerenter',()=>clearTimeout(timer));tooltip.addEventListener('pointerleave',scheduleHide);tooltip.addEventListener('focusin',()=>clearTimeout(timer));tooltip.addEventListener('focusout',scheduleHide);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')hideTooltip();});
  render();return {resize,hideTooltip};
};
