/* Source data and geodesic rings are generated separately; UI never infers operational coverage. */
(() => {
  'use strict';
  const regional = window.GMR_REGIONAL_DATA || {bases:[],reviewItems:[],exclusions:[]};
  const data = {...window.GMR_MAP_DATA,
    bases:[...window.GMR_MAP_DATA.bases,...regional.bases],
    reviewItems:[...window.GMR_MAP_DATA.reviewItems,...regional.reviewItems],
    exclusions:[...window.GMR_MAP_DATA.exclusions,...regional.exclusions]};
  const regionalIds=new Set(regional.bases.map(b=>b.id));
  const operators = {
    airevac: {name:'Air Evac Lifeteam', color:'#b53942'},
    medtrans: {name:'Med-Trans programs', color:'#197790'},
    airmed: {name:'AirMed International', color:'#32794c'},
    guardian: {name:'Guardian Flight', color:'#8c5e9f'},
    halo: {name:'HALO-Flight', color:'#7b2cbf'},
    phi: {name:'PHI Air Medical / partners', color:'#d4aa00'},
    airmethods: {name:'Air Methods / AirLIFE TEXAS', color:'#81522e'}
  };
  const $ = id => document.getElementById(id);
  const supported = data.bases.filter(b => b.status === 'Publicly supported');
  let selected = null;
  let selectedAirport = false;
  let airportMarker = null;
  let visible = [];
  let scale = 1;
  let hoveredMarker = null;
  let previewMarker = null;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const socialPages=new Map((window.GMR_FACEBOOK_DATA?.rows||[]).map(row=>[row.id,row]));
  const socialDetail=b=>{
    if(regionalIds.has(b.id))return '';
    const page=socialPages.get(b.id);
    if(!page?.url)return '<p class="social-unavailable">Facebook: no matching base page confirmed.</p>';
    return `<div class="social-link"><a href="${escape(page.url)}" target="_blank" rel="noopener noreferrer">Facebook <span aria-hidden="true">&#8599;</span></a><span>${escape(page.scope)}</span></div>`;
  };
  let tooltipTimer,tooltipId=null;
  const keepTooltip=()=>clearTimeout(tooltipTimer);
  function hideTooltip(){keepTooltip();$('tooltip').hidden=true;tooltipId=null;}
  function scheduleTooltipHide(){keepTooltip();tooltipTimer=setTimeout(()=>{if(!$('tooltip').matches(':hover')&&!$('tooltip').contains(document.activeElement))hideTooltip();},300);}
  const links = sources => sources.map(s => `<a href="${escape(s.url)}" target="_blank" rel="noopener">${escape(s.title)}</a>`).join('');
  const phoneText = b => b.phone || (b.rosterEvidence ? 'Not listed (roster N/A)' : 'Not supplied');
  const phoneLink = b => b.phone ? `<a href="tel:+1${b.phone.replace(/\D/g,'')}">${escape(b.phone)}</a>` : escape(phoneText(b));
  const phoneDetail = b => `<div class="base-phone"><strong>Base phone</strong> ${phoneLink(b)}<small>${escape(b.phoneStatus || 'Not supplied in the screenshots')}</small></div>`;
  const nearbyBases=b=>data.bases.filter(x=>b.nearbyBaseIds?.includes(x.id)||x.nearbyBaseIds?.includes(b.id));
  const nearbyHtml=b=>nearbyBases(b).map(x=>`<p class="tip-evidence">Nearby dots are spaced apart when needed for selection. Thin lines point to mapped locations; radius centers are unchanged.</p><button class="nearby-base" data-nearby-base="${escape(x.id)}">Nearby at Garner Field: ${escape(x.name)}</button>`).join('');
  const wireNearby=container=>container.querySelectorAll('[data-nearby-base]').forEach(el=>el.onclick=()=>{hideTooltip();selectBase(data.bases.find(b=>b.id===el.dataset.nearbyBase));});
  const icons = () => window.lucide?.createIcons();
  $('total').textContent = `${supported.length} supported base sites`;
  $('regional-count').textContent = `${supported.filter(b => b.state === 'TX').length} Texas / ${supported.filter(b => b.state !== 'TX').length} border-region / ${data.bases.length-supported.length} review candidates`;
  $('candidate-count').textContent = `(${data.bases.length-supported.length})`;
  $('overview').textContent = `${supported.length} publicly supported sites across GMR and the selected regional operators. ${data.bases.filter(b => b.review && b.status==='Publicly supported').length} have open location or role questions. Guardian 72, AEL 189 and the PHI San Antonio launch site are held as review candidates. Regional review: October 27, 2026. La Grange remains excluded.`;
  $('operators').insertAdjacentHTML('beforeend', Object.entries(operators).map(([id,o]) => {const reviews=data.bases.filter(b=>b.operator===id&&b.status==='Review candidate').length;return `<label class="operator"><input type="checkbox" value="${id}" checked><span class="swatch" style="background:${o.color}"></span>${o.name}<span class="count">${supported.filter(b => b.operator===id).length}${reviews?` + ${reviews} review`:''}</span></label>`;}).join(''));
  // Census GeoJSON uses opposite polygon winding to D3's spherical geometry.
  const orientPolygon = coordinates => d3.geoArea({type:'Polygon',coordinates}) > 2 * Math.PI ? coordinates.map(ring => [...ring].reverse()) : coordinates;
  const orientFeature = feature => ({...feature,geometry:{...feature.geometry,coordinates:feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates.map(orientPolygon) : orientPolygon(feature.geometry.coordinates)}});
  const texas = data.texas.features.map(orientFeature);
  const counties = data.counties.features.map(orientFeature);
  const svg = d3.select('#map');
  // Top-down silhouettes share a nose-to-tail centerline for the mixed-aircraft glyph.
  const airplane = 'M0,-10 C1.1,-10 1.5,-8 1.5,-6 L1.5,-2 L9,2 L9,4 L1.5,2 L1.2,6 L4,8 L4,9 L0,8 L-4,9 L-4,8 L-1.2,6 L-1.5,2 L-9,4 L-9,2 L-1.5,-2 L-1.5,-6 C-1.5,-8 -1.1,-10 0,-10Z';
  const helicopter = 'M0,-8 C2.7,-8 3,-5 2.5,-2 L1.4,2 L.8,7 L3.5,8 L3.5,9 L0,8.5 L-3.5,9 L-3.5,8 L-.8,7 L-1.4,2 L-2.5,-2 C-3,-5 -2.7,-8 0,-8Z M-9,-3 L9,-3 M-6.5,-9 L6.5,3';
  svg.append('defs').html(`<clipPath id="aircraft-left"><rect x="-11" y="-12" width="11" height="24"/></clipPath><clipPath id="aircraft-right"><rect x="0" y="-12" width="11" height="24"/></clipPath><g id="aircraft-fixed"><path d="${airplane}"/></g><g id="aircraft-rotor"><path d="${helicopter}"/></g><g id="aircraft-mixed"><path d="${helicopter}" clip-path="url(#aircraft-left)"/><path d="${airplane}" clip-path="url(#aircraft-right)"/></g>`);
  const projection = d3.geoConicConformal().parallels([27.5,35]).rotate([100,0]).fitExtent([[45,45],[950,800]], {type:'FeatureCollection',features:[...texas,...data.bases.map(b=>({type:'Feature',geometry:b.circle}))]});
  const path = d3.geoPath(projection);
  const world = svg.append('g');
  world.append('g').selectAll('path').data(counties).join('path').attr('class','county').attr('d',path).append('title').text(d => `${d.properties.NAME || d.properties.name || 'Texas'} County`);
  world.append('g').selectAll('path').data(texas).join('path').attr('class','texas-outline').attr('d',path);
  const ringLayer = world.append('g');
  const stateLayer = world.append('g');
  [['TEXAS',-100,31],['NEW MEXICO',-104.5,34.8],['OKLAHOMA',-98,35.6],['LOUISIANA',-92.3,31.2],['ARKANSAS',-93.2,34.7],['KANSAS',-100.8,37.35],['MEXICO',-103,28.5]].forEach(([name,x,y]) => {
    const p=projection([x,y]);stateLayer.append('text').attr('class','state-label').attr('x',p[0]).attr('y',p[1]).attr('text-anchor','middle').text(name);
  });
  const markerLeaders = world.append('g').attr('pointer-events','none');
  const markerLayer = world.append('g');
  const airportLayer = world.append('g');
  const labelLayer = world.append('g');
  const aircraftLayer = world.append('g').attr('class','aircraft-hover-icon').attr('aria-hidden','true').style('display','none');
  aircraftLayer.append('use').attr('class','aircraft-halo');
  aircraftLayer.append('use').attr('class','aircraft-silhouette');
  aircraftLayer.append('use').attr('class','aircraft-silhouette aircraft-secondary').attr('clip-path','url(#aircraft-right)');
  function aircraftKind(b){
    const modes=(b.members || [b]).map(site=>site.mode.toLowerCase());
    const rotor=modes.some(mode=>mode.includes('rotor'));
    const fixed=modes.some(mode=>mode.includes('fixed'));
    return rotor && fixed ? 'mixed' : rotor ? 'rotor' : fixed ? 'fixed' : 'unknown';
  }
  function renderAircraftPreview(){
    const focused=document.activeElement?.classList?.contains('base-marker')?document.activeElement.__data__:null;
    const candidate=hoveredMarker || focused;
    previewMarker=candidate && aircraftKind(candidate)!=='unknown'?candidate:null;
    markerLayer.selectAll('.base-marker').classed('aircraft-preview',b=>previewMarker?.id===b.id);
    airportLayer.selectAll('.shared-marker').classed('aircraft-preview',b=>previewMarker?.id===b.id);
    aircraftLayer.style('display',previewMarker?null:'none');
    if(previewMarker){
      const kind=aircraftKind(previewMarker);
      const color=operators[previewMarker.operator || 'airevac'].color;
      aircraftLayer.attr('data-aircraft',kind);
      aircraftLayer.selectAll('use').attr('href',`#aircraft-${kind}`);
      aircraftLayer.select('.aircraft-silhouette').attr('fill',previewMarker.review?'white':color).attr('stroke',color);
      aircraftLayer.select('.aircraft-secondary').style('display',previewMarker.members?null:'none').attr('fill',operators.airmed.color).attr('stroke',operators.airmed.color);
    }
    resizeMarks();
  }
  function markerEnter(event,b){hoveredMarker=b;renderAircraftPreview();showTooltip(event,b);}
  function markerLeave(){hoveredMarker=null;scheduleTooltipHide();renderAircraftPreview();}
  const zoom = d3.zoom().scaleExtent([1,14]).translateExtent([[-100,-100],[1100,960]]).on('zoom', event => {
    scale=event.transform.k;world.attr('transform',event.transform);resizeMarks();hideTooltip();
  });
  svg.call(zoom).on('dblclick.zoom',null);
  const markerPositions = new Map();
  const markerPosition = b => markerPositions.get(b.id) || projection([b.lng,b.lat]);
  function resizeMarks(){
    markerPositions.clear();
    // Separate the two Garner Field display markers only; geographic data and rings never move.
    const pair=['ael-181','airmethods-uvalde'].map(id=>visible.find(b=>b.id===id));
    if(pair.every(Boolean)){
      const [a,b]=pair.map(site=>projection([site.lng,site.lat]));
      const cssScale=svg.node().getScreenCTM()?.a || 1;
      const gap=Math.max(28,20/cssScale)/scale;
      if(Math.hypot(b[0]-a[0],b[1]-a[1])<gap){
        const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];
        markerPositions.set(pair[0].id,[mid[0]-gap/2,mid[1]]);
        markerPositions.set(pair[1].id,[mid[0]+gap/2,mid[1]]);
      }
    }
    markerLeaders.selectAll('line').data(pair.filter(b=>b&&markerPositions.has(b.id)),b=>b.id).join('line')
      .attr('x1',b=>projection([b.lng,b.lat])[0]).attr('y1',b=>projection([b.lng,b.lat])[1])
      .attr('x2',b=>markerPosition(b)[0]).attr('y2',b=>markerPosition(b)[1])
      .attr('stroke',b=>operators[b.operator].color).attr('stroke-width',1).attr('vector-effect','non-scaling-stroke');
    markerLayer.selectAll('circle').attr('cx',b=>markerPosition(b)[0]).attr('cy',b=>markerPosition(b)[1]).attr('r',b => (previewMarker?.id===b.id?11:selected?.id===b.id?7:5)/scale).attr('stroke-width',b => (selected?.id===b.id?2.5:1.7)/scale);
    airportLayer.selectAll('.shared-marker').attr('transform',b=>`translate(${projection([b.lng,b.lat])}) scale(${1/scale})`);
    if(previewMarker) aircraftLayer.attr('transform',`translate(${markerPosition(previewMarker)}) scale(${1/scale})`);
    labelLayer.selectAll('text').attr('x',b=>markerPosition(b)[0]).attr('y',b=>markerPosition(b)[1]).attr('font-size',10/scale).style('font-size',`${10/scale}px`).attr('stroke-width',3/scale).attr('dx',8/scale).attr('dy',-7/scale);
    stateLayer.selectAll('text').style('opacity', scale > 2 ? 0.4 : 1);
  }
  new ResizeObserver(()=>resizeMarks()).observe(svg.node());
  function showTooltip(event,b){
    keepTooltip();
    const shell=document.querySelector('.map-shell').getBoundingClientRect();
    const phoneLines=(b.members || [b]).filter(site=>!regionalIds.has(site.id)).map(site=>`${b.members?(site.operator==='airevac'?'AEL 148':'AirMed International')+': ':'Base phone: '}${phoneText(site)}${site.phone?' (roster)':''}`).join('\n');
    if(tooltipId!==b.id){
      const summary=`${b.members?'San Antonio International Airport':b.name}\n${b.mode || 'Rotor + fixed-wing'}${aircraftKind(b)==='unknown'?' (aircraft type unconfirmed)':''}${b.review?' | Open question':''}\n${phoneLines}`;
      $('tooltip').innerHTML=`<button class="tip-close" type="button" aria-label="Close quick details" title="Close quick details"><i data-lucide="x"></i></button><div class="tip-summary">${escape(summary)}</div>${regionalIds.has(b.id)?`<p class="tip-evidence">${escape(b.precision)}${b.review?'<br>Open question: select the base for evidence.':''}</p>`:''}<div class="tip-social">${(b.members||[b]).map(site=>`${b.members?`<strong>${escape(site.name)}</strong>`:''}${socialDetail(site)}`).join('')}${nearbyHtml(b)}</div>`;
      $('tooltip').querySelector('.tip-close').onclick=hideTooltip;
      wireNearby($('tooltip'));
      tooltipId=b.id;icons();
    }
    $('tooltip').hidden=false;
    $('tooltip').style.maxHeight=`${shell.height-16}px`;
    $('tooltip').style.overflowY='auto';
    const w=$('tooltip').offsetWidth,h=$('tooltip').offsetHeight;
    const target=event.currentTarget.getBoundingClientRect();
    const x=Number.isFinite(event.clientX)?event.clientX:target.left+target.width/2;
    $('tooltip').style.left=`${Math.max(6,Math.min(x-shell.left+12,shell.width-w-8))}px`;
    // Keep the pop-up above or below its marker so it cannot intercept the click.
    const above=Math.max(0,target.top-shell.top-14),below=Math.max(0,shell.bottom-target.bottom-14);
    const placeBelow=below>=h || below>=above;
    const room=Math.max(40,placeBelow?below:above);
    $('tooltip').style.maxHeight=`${room}px`;
    const height=$('tooltip').offsetHeight;
    $('tooltip').style.top=`${Math.max(6,Math.min(placeBelow?target.bottom-shell.top+6:target.top-shell.top-height-6,shell.height-height-8))}px`;
  }
  function selectBase(b,focusMap=false){
    selectedAirport=false;
    selected=b;
    $('detail').innerHTML=`<div class="detail-top"><div><p class="eyebrow" style="color:${operators[b.operator].color}">${escape(operators[b.operator].name)}</p><h2>${escape(b.name)}</h2></div><button id="close-detail" aria-label="Clear selection" title="Clear selection"><i data-lucide="x"></i></button></div><p>${escape(b.address)}</p><div class="details-grid"><div><strong>Evidence status</strong>${escape(b.status)}${b.review?' / open question':''}</div><div><strong>Aircraft</strong>${escape(b.mode)}</div><div><strong>Coordinate precision</strong>${escape(b.precision)}<br>${b.lat.toFixed(5)}, ${b.lng.toFixed(5)}</div><div><strong>Distance to Texas</strong>${b.distanceToTexasNm===0?'Within Texas':`${b.distanceToTexasNm.toFixed(2)} NM`} / 75 NM circle</div></div><p class="${b.review?'question-text':'muted'}">${escape(b.note)}</p><div class="sources">${links(b.sources)}</div>`;
    if(!regionalIds.has(b.id))$('detail').insertAdjacentHTML('beforeend',phoneDetail(b));
    if(regionalIds.has(b.id))$('detail').insertAdjacentHTML('beforeend',`<p class="muted">Public sources checked ${escape(b.checked)}. County: ${escape(b.county)}.${b.nearestHalo?` Nearest HALO site: ${escape(b.nearestHalo.city)}, ${b.nearestHalo.distanceNm.toFixed(2)} NM center-to-center. Circle overlap is not a promise of service.`:''}</p>`);
    $('detail').insertAdjacentHTML('beforeend',nearbyHtml(b));wireNearby($('detail'));
    $('detail').insertAdjacentHTML('beforeend',socialDetail(b));
    if(b.rosterEvidence) $('detail').insertAdjacentHTML('beforeend',`<p class="muted">Roster evidence: image ${b.rosterEvidence.images.join(', ')}, row ${b.rosterEvidence.rows.join(', ')}; supplied October 20, 2026. Document effective date not shown.<br>Roster address: ${escape(b.rosterEvidence.addresses.join(' / '))}</p>`);
    if(b.confirmation) $('detail').insertAdjacentHTML('beforeend',`<p class="confirmed">${escape(b.confirmation)}</p>`);
    if(b.siteGroup && airportMarker){
      $('detail').insertAdjacentHTML('beforeend','<button class="airport-record" id="airport-services">Both San Antonio airport services</button>');
      $('airport-services').onclick=selectAirport;
    }
    $('close-detail').onclick=()=>{selected=null;render();$('detail').innerHTML='<h2>Research Snapshot</h2><p class="muted">Publicly supported locations are not a guarantee of current aircraft availability. Open questions and sources are recorded below.</p>';};
    icons();renderSelection();
    if(focusMap){const [x,y]=projection([b.lng,b.lat]);svg.transition().duration(400).call(zoom.transform,d3.zoomIdentity.translate(500-x*2.8,430-y*2.8).scale(2.8));}
  }
  function selectAirport(){
    if(!airportMarker) return;
    selected=null;selectedAirport=true;
    $('detail').innerHTML=`<h2>San Antonio International Airport</h2><p class="confirmed">Both services confirmed at this airport by the owner, October 12, 2026.</p><div class="airport-services">${airportMarker.members.map(b=>`<div><p class="eyebrow" style="color:${operators[b.operator].color}">${escape(operators[b.operator].name)}</p><h3>${escape(b.name)}</h3><p>${escape(b.mode)}</p><p>${escape(b.address)}</p><button class="airport-record" data-airport-base="${b.id}">Base record and sources</button></div>`).join('')}</div><p class="muted">Nearby hangars share this display marker. Each 75 NM ring remains centered on its own recorded coordinate; neither coordinate has been moved or merged.</p>`;
    $('detail').querySelectorAll('[data-airport-base]').forEach(el=>el.onclick=()=>selectBase(airportMarker.members.find(b=>b.id===el.dataset.airportBase)));
    $('detail').querySelectorAll('.airport-services > div').forEach((el,i)=>el.insertAdjacentHTML('beforeend',phoneDetail(airportMarker.members[i])+socialDetail(airportMarker.members[i])));
    renderSelection();
  }
  function renderSelection(){
    markerLayer.selectAll('circle').classed('selected',b=>selected?.id===b.id);
    airportLayer.selectAll('.shared-marker').classed('selected',selectedAirport || !!selected?.siteGroup);
    const active=b=>selected?.id===b.id || (selectedAirport && b.siteGroup==='san-antonio-international');
    ringLayer.selectAll('path').classed('active',active).style('opacity', b => (selected || selectedAirport) && !active(b) ? 0.22 : 1);
    document.querySelectorAll('.base-row').forEach(el=>el.classList.toggle('selected',el.dataset.id===selected?.id));resizeMarks();
  }
  function render(){
    hoveredMarker=null;
    hideTooltip();
    const enabled=new Set([...document.querySelectorAll('#operators input:checked')].map(x=>x.value));
    const query=$('search').value.trim().toLowerCase();
    const mode=$('aircraft').value;
    visible=data.bases.filter(b=>enabled.has(b.operator)&&($('candidates').checked||b.status==='Publicly supported')&&(`${b.name} ${operators[b.operator].name} ${b.city} ${b.state} ${b.address}`.toLowerCase().includes(query))&&(mode==='all'||(mode==='unknown'?b.mode==='Air medical':b.mode.toLowerCase().includes(mode))));
    const airportBases=visible.filter(b=>b.siteGroup==='san-antonio-international');
    // Display grouping only: retain both original geodesic centers and records.
    airportMarker=airportBases.length>1?{id:'san-antonio-international',name:'San Antonio International Airport: AEL 148 + AirMed International',status:'2 owner-confirmed airport services',lat:d3.mean(airportBases,b=>b.lat),lng:d3.mean(airportBases,b=>b.lng),members:airportBases}:null;
    const points=airportMarker?visible.filter(b=>!b.siteGroup):visible;
    if(selectedAirport && !airportMarker){selectedAirport=false;$('detail').innerHTML='<h2>Research Snapshot</h2><p class="muted">The airport selection is outside the current filters.</p>';}
    if(selected&&!visible.some(b=>b.id===selected.id)){selected=null;$('detail').innerHTML='<h2>Research Snapshot</h2><p class="muted">The previous selection is outside the current filters.</p>';}
    $('visible-count').textContent=`${visible.length} sites shown${visible.some(b=>b.status==='Review candidate')?' / includes unconfirmed candidates':''}`;
    $('list').innerHTML=visible.map(b=>`<button class="base-row" data-id="${b.id}"><span class="swatch" style="background:${b.review?'white':operators[b.operator].color};border:2px solid ${operators[b.operator].color}"></span><span><strong>${escape(b.name)}</strong><small>${escape(b.city)}, ${escape(b.state)} / ${escape(b.mode)}</small>${b.review?`<small class="question-text">${b.status==='Review candidate'?'Unconfirmed candidate':'Open location / status question'}</small>`:''}</span></button>`).join('')||'<p class="empty">No matching bases.</p>';
    $('list').querySelectorAll('button').forEach(el=>el.onclick=()=>selectBase(visible.find(b=>b.id===el.dataset.id),true));
    ringLayer.selectAll('path').data(visible,b=>b.id).join('path').attr('class',b=>`radius${b.review?' question':''}`).attr('d',b=>path(b.circle)).attr('fill',b=>operators[b.operator].color).attr('stroke',b=>operators[b.operator].color).style('display',$('rings').checked?null:'none');
    markerLayer.selectAll('circle').data(points,b=>b.id).join('circle').attr('class','base-marker').attr('data-aircraft',aircraftKind).attr('cx',b=>projection([b.lng,b.lat])[0]).attr('cy',b=>projection([b.lng,b.lat])[1]).attr('fill',b=>b.review?'#fff':operators[b.operator].color).attr('stroke',b=>b.review?operators[b.operator].color:'#fff').attr('tabindex',0).attr('role','button').attr('aria-label',b=>`${b.name}, ${b.mode}, ${b.status}${b.review?', open question':''}`).on('click',(event,b)=>{event.stopPropagation();selectBase(b);}).on('keydown',(event,b)=>{if(['Enter',' '].includes(event.key)){event.preventDefault();selectBase(b);}}).on('pointerenter',markerEnter).on('pointermove',showTooltip).on('pointerleave',markerLeave).on('focus',renderAircraftPreview).on('blur',renderAircraftPreview);
    airportLayer.selectAll('.shared-marker').data(airportMarker?[airportMarker]:[],b=>b.id).join(enter=>{
      const group=enter.append('g').attr('class','base-marker shared-marker');
      group.append('path').attr('d',d3.arc().innerRadius(0).outerRadius(9).startAngle(0).endAngle(Math.PI)()).attr('fill',operators.airevac.color);
      group.append('path').attr('d',d3.arc().innerRadius(0).outerRadius(9).startAngle(Math.PI).endAngle(2*Math.PI)()).attr('fill',operators.airmed.color);
      group.append('circle').attr('class','shared-outline').attr('r',9).attr('fill','none').attr('stroke','#fff').attr('stroke-width',2);
      group.append('text').attr('text-anchor','middle').attr('dy','0.35em').text('2');
      group.append('circle').attr('r',12).attr('fill','transparent').attr('stroke','none');
      return group;
    }).attr('data-aircraft',aircraftKind).attr('tabindex',0).attr('role','button').attr('aria-label',b=>b.name).on('click',event=>{event.stopPropagation();selectAirport();}).on('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();selectAirport();}}).on('pointerenter',markerEnter).on('pointermove',showTooltip).on('pointerleave',markerLeave).on('focus',renderAircraftPreview).on('blur',renderAircraftPreview);
    const labels=airportMarker?[...points,{...airportMarker,name:'SAT: AEL 148 + AirMed'}]:points;
    labelLayer.selectAll('text').data(labels,b=>b.id).join('text').attr('class','base-label').attr('x',b=>projection([b.lng,b.lat])[0]).attr('y',b=>projection([b.lng,b.lat])[1]).text(b=>b.name.replace('Air Evac Lifeteam ','AEL ')).style('display',$('labels').checked?null:'none');
    renderSelection();
    renderAircraftPreview();
  }
  $('search').addEventListener('input',render);
  document.querySelectorAll('input[type=checkbox],select').forEach(el=>el.addEventListener('change',render));
  $('zoom-in').onclick=()=>svg.transition().duration(200).call(zoom.scaleBy,1.6);
  $('zoom-out').onclick=()=>svg.transition().duration(200).call(zoom.scaleBy,1/1.6);
  $('reset').onclick=()=>svg.transition().duration(300).call(zoom.transform,d3.zoomIdentity);
  $('question-count').textContent=`(${data.reviewItems.length})`;
  $('questions').innerHTML=data.reviewItems.map((q,i)=>`<article class="question"><div><h4>${i+1}. ${escape(q.name)}</h4><p class="category">${escape(q.category)}</p></div><div><p>${escape(q.question)}</p><div class="sources">${links(q.sources.map((url,j)=>({url,title:`Source ${j+1}`})))}</div></div></article>`).join('');
  $('excluded').innerHTML=data.exclusions.map(e=>`<div class="exclusion"><strong>${escape(e.name)}</strong><br>${escape(e.reason)}</div>`).join('');
  if($('regional-records')){
    $('regional-records').innerHTML=regional.bases.map(b=>`<tr><td><button class="regional-record" data-regional-base="${escape(b.id)}">${escape(b.name)}</button><small>${escape(b.county)} County</small></td><td>${b.status==='Review candidate'?'Review candidate — hidden by default':b.review?'Site supported; open question':'Publicly supported'}<small>${escape(b.precision)}</small></td><td>${b.nearestHalo?`${b.nearestHalo.distanceNm.toFixed(2)} NM to ${escape(b.nearestHalo.city)}`:'—'}</td></tr>`).join('');
    document.querySelectorAll('[data-regional-base]').forEach(el=>el.onclick=()=>{const b=data.bases.find(x=>x.id===el.dataset.regionalBase);$('search').value='';$('aircraft').value='all';document.querySelector(`#operators input[value="${b.operator}"]`).checked=true;if(b.status==='Review candidate')$('candidates').checked=true;render();selectBase(b,true);$('detail').scrollIntoView({behavior:'smooth',block:'nearest'});});
  }
  $('roster-checks').innerHTML=data.rosterScreening.filter(r=>r.result!=='Existing site corroborated').map(r=>`<div class="exclusion"><strong>${escape(r.name)}, ${escape(r.state)}</strong><br>${r.distanceToTexasNm.toFixed(2)} NM from Texas at the screened coordinate; outside the 75 NM rule. Roster row ${r.row}.</div>`).join('');
  // Keyboard users receive the same phone information as pointer users.
  svg.on('focusin.phone',event=>{
    const marker=event.target.closest('.base-marker');
    if(marker) showTooltip({currentTarget:marker},marker.__data__);
  }).on('focusout.phone',scheduleTooltipHide);
  $('tooltip').addEventListener('pointerenter',keepTooltip);
  $('tooltip').addEventListener('pointerleave',scheduleTooltipHide);
  $('tooltip').addEventListener('focusin',keepTooltip);
  $('tooltip').addEventListener('focusout',scheduleTooltipHide);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')hideTooltip();});
  icons();render();
})();
