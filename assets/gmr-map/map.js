/* Source data and geodesic rings are generated separately; UI never infers operational coverage. */
(() => {
  'use strict';
  const data = window.GMR_MAP_DATA;
  const operators = {
    airevac: {name:'Air Evac Lifeteam', color:'#b53942'},
    medtrans: {name:'Med-Trans programs', color:'#197790'},
    airmed: {name:'AirMed International', color:'#32794c'},
    guardian: {name:'Guardian Flight', color:'#8c5e9f'}
  };
  const $ = id => document.getElementById(id);
  const supported = data.bases.filter(b => b.status === 'Publicly supported');
  let selected = null;
  let selectedAirport = false;
  let airportMarker = null;
  let visible = [];
  let scale = 1;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const links = sources => sources.map(s => `<a href="${escape(s.url)}" target="_blank" rel="noopener">${escape(s.title)}</a>`).join('');
  const icons = () => window.lucide?.createIcons();
  $('total').textContent = `${supported.length} supported base sites`;
  $('regional-count').textContent = `${supported.filter(b => b.state === 'TX').length} Texas / ${supported.filter(b => b.state !== 'TX').length} border-region / ${data.bases.length-supported.length} review candidates`;
  $('candidate-count').textContent = `(${data.bases.length-supported.length})`;
  $('overview').textContent = `${supported.length} publicly supported sites across the requested operator families. ${data.bases.filter(b => b.review && b.status==='Publicly supported').length} have open location or status questions. Guardian 72 and AEL 189 are held as review candidates. La Grange remains excluded.`;
  $('operators').insertAdjacentHTML('beforeend', Object.entries(operators).map(([id,o]) => `<label class="operator"><input type="checkbox" value="${id}" checked><span class="swatch" style="background:${o.color}"></span>${o.name}<span class="count">${supported.filter(b => b.operator===id).length}${id==='guardian'?' + 1 review':''}</span></label>`).join(''));
  // Census GeoJSON uses opposite polygon winding to D3's spherical geometry.
  const orientPolygon = coordinates => d3.geoArea({type:'Polygon',coordinates}) > 2 * Math.PI ? coordinates.map(ring => [...ring].reverse()) : coordinates;
  const orientFeature = feature => ({...feature,geometry:{...feature.geometry,coordinates:feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates.map(orientPolygon) : orientPolygon(feature.geometry.coordinates)}});
  const texas = data.texas.features.map(orientFeature);
  const counties = data.counties.features.map(orientFeature);
  const svg = d3.select('#map');
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
  const markerLayer = world.append('g');
  const airportLayer = world.append('g');
  const labelLayer = world.append('g');
  const zoom = d3.zoom().scaleExtent([1,14]).translateExtent([[-100,-100],[1100,960]]).on('zoom', event => {
    scale=event.transform.k;world.attr('transform',event.transform);resizeMarks();
  });
  svg.call(zoom).on('dblclick.zoom',null);
  function resizeMarks(){
    markerLayer.selectAll('circle').attr('r',b => (selected?.id===b.id?7:5)/scale).attr('stroke-width',b => (selected?.id===b.id?2.5:1.7)/scale);
    airportLayer.selectAll('.shared-marker').attr('transform',b=>`translate(${projection([b.lng,b.lat])}) scale(${1/scale})`);
    labelLayer.selectAll('text').attr('font-size',10/scale).style('font-size',`${10/scale}px`).attr('stroke-width',3/scale).attr('dx',8/scale).attr('dy',-7/scale);
    stateLayer.selectAll('text').style('opacity', scale > 2 ? 0.4 : 1);
  }
  function showTooltip(event,b){
    const shell=document.querySelector('.map-shell').getBoundingClientRect();
    $('tooltip').textContent=`${b.name} | ${b.status}${b.review?' | Open question':''}`;
    $('tooltip').hidden=false;
    const w=$('tooltip').offsetWidth,h=$('tooltip').offsetHeight;
    $('tooltip').style.left=`${Math.max(6,Math.min(event.clientX-shell.left+12,shell.width-w-8))}px`;
    $('tooltip').style.top=`${Math.max(6,Math.min(event.clientY-shell.top+12,shell.height-h-8))}px`;
  }
  function selectBase(b,focusMap=false){
    selectedAirport=false;
    selected=b;
    $('detail').innerHTML=`<div class="detail-top"><div><p class="eyebrow" style="color:${operators[b.operator].color}">${escape(operators[b.operator].name)}</p><h2>${escape(b.name)}</h2></div><button id="close-detail" aria-label="Clear selection" title="Clear selection"><i data-lucide="x"></i></button></div><p>${escape(b.address)}</p><div class="details-grid"><div><strong>Evidence status</strong>${escape(b.status)}${b.review?' / open question':''}</div><div><strong>Aircraft</strong>${escape(b.mode)}</div><div><strong>Coordinate precision</strong>${escape(b.precision)}<br>${b.lat.toFixed(5)}, ${b.lng.toFixed(5)}</div><div><strong>Distance to Texas</strong>${b.distanceToTexasNm===0?'Within Texas':`${b.distanceToTexasNm.toFixed(2)} NM`} / 75 NM circle</div></div><p class="${b.review?'question-text':'muted'}">${escape(b.note)}</p><div class="sources">${links(b.sources)}</div>`;
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
    markerLayer.selectAll('circle').data(points,b=>b.id).join('circle').attr('class','base-marker').attr('cx',b=>projection([b.lng,b.lat])[0]).attr('cy',b=>projection([b.lng,b.lat])[1]).attr('fill',b=>b.review?'#fff':operators[b.operator].color).attr('stroke',b=>b.review?operators[b.operator].color:'#fff').attr('tabindex',0).attr('role','button').attr('aria-label',b=>`${b.name}, ${b.status}${b.review?', open question':''}`).on('click',(event,b)=>{event.stopPropagation();selectBase(b);}).on('keydown',(event,b)=>{if(['Enter',' '].includes(event.key)){event.preventDefault();selectBase(b);}}).on('pointermove',showTooltip).on('pointerleave',()=>{$('tooltip').hidden=true;});
    airportLayer.selectAll('.shared-marker').data(airportMarker?[airportMarker]:[],b=>b.id).join(enter=>{
      const group=enter.append('g').attr('class','base-marker shared-marker');
      group.append('path').attr('d',d3.arc().innerRadius(0).outerRadius(9).startAngle(0).endAngle(Math.PI)()).attr('fill',operators.airevac.color);
      group.append('path').attr('d',d3.arc().innerRadius(0).outerRadius(9).startAngle(Math.PI).endAngle(2*Math.PI)()).attr('fill',operators.airmed.color);
      group.append('circle').attr('class','shared-outline').attr('r',9).attr('fill','none').attr('stroke','#fff').attr('stroke-width',2);
      group.append('text').attr('text-anchor','middle').attr('dy','0.35em').text('2');
      return group;
    }).attr('tabindex',0).attr('role','button').attr('aria-label',b=>b.name).on('click',event=>{event.stopPropagation();selectAirport();}).on('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();selectAirport();}}).on('pointermove',showTooltip).on('pointerleave',()=>{$('tooltip').hidden=true;});
    const labels=airportMarker?[...points,{...airportMarker,name:'SAT: AEL 148 + AirMed'}]:points;
    labelLayer.selectAll('text').data(labels,b=>b.id).join('text').attr('class','base-label').attr('x',b=>projection([b.lng,b.lat])[0]).attr('y',b=>projection([b.lng,b.lat])[1]).text(b=>b.name.replace('Air Evac Lifeteam ','AEL ')).style('display',$('labels').checked?null:'none');
    renderSelection();
  }
  $('search').addEventListener('input',render);
  document.querySelectorAll('input[type=checkbox],select').forEach(el=>el.addEventListener('change',render));
  $('zoom-in').onclick=()=>svg.transition().duration(200).call(zoom.scaleBy,1.6);
  $('zoom-out').onclick=()=>svg.transition().duration(200).call(zoom.scaleBy,1/1.6);
  $('reset').onclick=()=>svg.transition().duration(300).call(zoom.transform,d3.zoomIdentity);
  $('question-count').textContent=`(${data.reviewItems.length})`;
  $('questions').innerHTML=data.reviewItems.map((q,i)=>`<article class="question"><div><h4>${i+1}. ${escape(q.name)}</h4><p class="category">${escape(q.category)}</p></div><div><p>${escape(q.question)}</p><div class="sources">${links(q.sources.map((url,j)=>({url,title:`Source ${j+1}`})))}</div></div></article>`).join('');
  $('excluded').innerHTML=data.exclusions.map(e=>`<div class="exclusion"><strong>${escape(e.name)}</strong><br>${escape(e.reason)}</div>`).join('');
  icons();render();
})();
