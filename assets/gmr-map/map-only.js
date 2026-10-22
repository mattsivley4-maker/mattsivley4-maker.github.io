(() => {
  'use strict';
  const data=window.GMR_MAP_ONLY_DATA;
  const $=id=>document.getElementById(id);
  const operators={airevac:{name:'Air Evac Lifeteam',color:'#b53942'},medtrans:{name:'Med-Trans',color:'#197790'},airmed:{name:'AirMed International',color:'#32794c'}};
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const modeText=b=>b.mode==='Air medical'?'Aircraft type not established':b.mode;
  const members=b=>b.members || [b];
  const kind=b=>{
    const modes=members(b).map(x=>x.mode.toLowerCase());
    const rotor=modes.some(x=>x.includes('rotor')),fixed=modes.some(x=>x.includes('fixed'));
    return rotor&&fixed?'mixed':rotor?'rotor':fixed?'fixed':'unknown';
  };
  let scale=1,selected=null,hovered=null,visible=[],points=[],width=1000,height=860;
  const orient=coordinates=>d3.geoArea({type:'Polygon',coordinates})>2*Math.PI?coordinates.map(r=>[...r].reverse()):coordinates;
  const feature=f=>({...f,geometry:{...f.geometry,coordinates:f.geometry.type==='MultiPolygon'?f.geometry.coordinates.map(orient):orient(f.geometry.coordinates)}});
  const counties=data.counties.features.map(feature),texas=data.texas.features.map(feature);
  const extent={type:'FeatureCollection',features:[...texas,...data.bases.map(b=>({type:'Feature',geometry:b.circle}))]};
  const projection=d3.geoConicConformal().parallels([27.5,35]).rotate([100,0]);
  const path=d3.geoPath(projection),svg=d3.select('#map');
  const airplane='M0,-10 C1.1,-10 1.5,-8 1.5,-6 L1.5,-2 L9,2 L9,4 L1.5,2 L1.2,6 L4,8 L4,9 L0,8 L-4,9 L-4,8 L-1.2,6 L-1.5,2 L-9,4 L-9,2 L-1.5,-2 L-1.5,-6 C-1.5,-8 -1.1,-10 0,-10Z';
  const helicopter='M0,-8 C2.7,-8 3,-5 2.5,-2 L1.4,2 L.8,7 L3.5,8 L3.5,9 L0,8.5 L-3.5,9 L-3.5,8 L-.8,7 L-1.4,2 L-2.5,-2 C-3,-5 -2.7,-8 0,-8Z M-9,-3 L9,-3 M-6.5,-9 L6.5,3';
  svg.append('defs').html(`<clipPath id="glyph-left"><rect x="-11" y="-12" width="11" height="24"/></clipPath><clipPath id="glyph-right"><rect x="0" y="-12" width="11" height="24"/></clipPath><g id="glyph-fixed"><path d="${airplane}"/></g><g id="glyph-rotor"><path d="${helicopter}"/></g><g id="glyph-mixed"><path d="${helicopter}" clip-path="url(#glyph-left)"/><path d="${airplane}" clip-path="url(#glyph-right)"/></g>`);
  const world=svg.append('g');
  const countyLayer=world.append('g').selectAll('path').data(counties).join('path').attr('class','county');
  countyLayer.append('title').text(f=>`${f.properties.NAME || f.properties.name} County`);
  const boundary=world.append('g').selectAll('path').data(texas).join('path').attr('class','texas-outline');
  const rings=world.append('g');
  const states=world.append('g').selectAll('text').data([['TEXAS',-100,31],['NEW MEXICO',-104.5,34.8],['OKLAHOMA',-98,35.6],['LOUISIANA',-92.3,31.2],['ARKANSAS',-93.2,34.7],['KANSAS',-100.8,37.35]]).join('text').attr('class','state-label').attr('text-anchor','middle').text(d=>d[0]);
  const markers=world.append('g'),labels=world.append('g');
  const zoom=d3.zoom().scaleExtent([1,14]).on('zoom',event=>{
    scale=event.transform.k;
    world.attr('transform',event.transform);
    positionMarks();
    $('tooltip').hidden=true;
  });
  svg.call(zoom).on('dblclick.zoom',null).on('click',()=>clearSelection());

  function positionMarks(){
    markers.selectAll('.base-marker').attr('transform',b=>`translate(${projection([b.lng,b.lat])}) scale(${1/scale})`);
    labels.selectAll('text').attr('x',b=>projection([b.lng,b.lat])[0]).attr('y',b=>projection([b.lng,b.lat])[1]).attr('dx',9/scale).attr('dy',-8/scale).style('font-size',`${11/scale}px`).style('stroke-width',`${3/scale}px`);
    states.style('font-size',`${12/scale}px`).style('opacity',scale>2?.35:1);
  }
  function preview(){
    markers.selectAll('.base-marker').classed('preview',function(b){return kind(b)!=='unknown'&&(hovered===b.id||this===document.activeElement);});
  }
  function showTooltip(event,b){
    const box=$('map').getBoundingClientRect(),target=event.currentTarget.getBoundingClientRect();
    $('tooltip').textContent=members(b).map(x=>`${x.name}\n${modeText(x)}`).join('\n\n')+'\nBase identified in public sources.';
    $('tooltip').hidden=false;
    const tip=$('tooltip'),x=Number.isFinite(event.clientX)?event.clientX:target.left+target.width/2,y=Number.isFinite(event.clientY)?event.clientY:target.top+target.height/2;
    tip.style.left=`${Math.max(8,Math.min(x-box.left+12,box.width-tip.offsetWidth-8))}px`;
    tip.style.top=`${Math.max(8,Math.min(y-box.top+12,box.height-tip.offsetHeight-8))}px`;
  }
  function selectionStyle(){
    const ids=new Set(selected?members(selected).map(b=>b.id):[]);
    markers.selectAll('.base-marker').classed('selected',b=>b.id===selected?.id);
    rings.selectAll('path').classed('active',b=>ids.has(b.id)).style('opacity',b=>selected&&!ids.has(b.id)?.22:1);
  }
  function clearSelection(){selected=null;$('selection').hidden=true;$('tooltip').hidden=true;selectionStyle();}
  function select(b,focus=false){
    selected=b;
    $('selection-content').innerHTML=members(b).map(x=>`<div class="member"><h2>${escape(x.name)}</h2><p>${escape(modeText(x))}</p></div>`).join('')+'<p class="provenance">Base identified in public sources.</p>';
    $('selection').hidden=false;
    $('tooltip').hidden=true;
    selectionStyle();
    if(focus){const [x,y]=projection([b.lng,b.lat]);svg.transition().duration(250).call(zoom.transform,d3.zoomIdentity.translate(width/2-x*2.8,height/2-y*2.8).scale(2.8));}
  }
  function render(){
    hovered=null;$('tooltip').hidden=true;
    const enabled=new Set([...document.querySelectorAll('#operators input:checked')].map(x=>x.value));
    const query=$('search').value.trim().toLowerCase(),mode=$('aircraft').value;
    visible=data.bases.filter(b=>enabled.has(b.operator)&&`${b.name} ${b.city} ${b.state}`.toLowerCase().includes(query)&&(mode==='all'||(mode==='unknown'?kind(b)==='unknown':b.mode.toLowerCase().includes(mode))));
    const sat=visible.filter(b=>b.siteGroup==='san-antonio-international');
    const shared=sat.length===2?{id:'sat-shared',name:'San Antonio: AEL 148 + AirMed International',operator:'airevac',lat:d3.mean(sat,b=>b.lat),lng:d3.mean(sat,b=>b.lng),members:sat}:null;
    points=shared?[...visible.filter(b=>!b.siteGroup),shared]:visible;
    if(selected&&!points.some(b=>b.id===selected.id))clearSelection();
    $('visible-count').textContent=`${visible.length} identified base sites`;
    $('results').innerHTML=visible.map(b=>`<button class="base-row" data-id="${escape(b.id)}">${escape(b.name)}<small>${escape(modeText(b))}</small></button>`).join('')||'<p class="empty">No matching bases</p>';
    $('results').querySelectorAll('button').forEach(el=>el.onclick=()=>{const b=visible.find(x=>x.id===el.dataset.id);closeFilters();select(points.find(x=>x.id===b.id)||shared,true);});
    rings.selectAll('path').data(visible,b=>b.id).join('path').attr('class','radius').attr('d',b=>path(b.circle)).attr('fill',b=>operators[b.operator].color).attr('stroke',b=>operators[b.operator].color).style('display',$('rings').checked?null:'none');
    const nodes=markers.selectAll('.base-marker').data(points,b=>b.id).join(enter=>{
      const g=enter.append('g').attr('class','base-marker');
      g.append('circle').attr('class','pin').attr('r',b=>b.members?8:5).attr('stroke','white').attr('stroke-width',1.7).attr('fill',b=>operators[b.operator].color);
      g.filter(b=>!!b.members).append('path').attr('class','pin').attr('d',d3.arc().innerRadius(0).outerRadius(8).startAngle(Math.PI).endAngle(2*Math.PI)()).attr('fill',operators.airmed.color);
      const aircraft=g.append('g').attr('class','aircraft');
      aircraft.append('use').attr('class','aircraft-halo').attr('href',b=>`#glyph-${kind(b)}`);
      aircraft.append('use').attr('class','aircraft-shape').attr('href',b=>`#glyph-${kind(b)}`).attr('fill',b=>operators[b.operator].color).attr('stroke',b=>operators[b.operator].color);
      aircraft.filter(b=>!!b.members).append('use').attr('class','aircraft-shape').attr('href','#glyph-mixed').attr('clip-path','url(#glyph-right)').attr('fill',operators.airmed.color).attr('stroke',operators.airmed.color);
      g.append('circle').attr('r',12).attr('fill','transparent');
      return g;
    }).attr('tabindex',0).attr('role','button').attr('data-id',b=>b.id).attr('data-aircraft',kind).attr('aria-label',b=>members(b).map(x=>`${x.name}, ${modeText(x)}`).join('; '));
    nodes.on('pointerenter',(event,b)=>{hovered=b.id;preview();showTooltip(event,b);}).on('pointermove',showTooltip).on('pointerleave',()=>{hovered=null;preview();$('tooltip').hidden=true;})
      .on('focus',(event,b)=>{preview();showTooltip(event,b);}).on('blur',()=>{preview();$('tooltip').hidden=true;})
      .on('click',(event,b)=>{event.stopPropagation();select(b);}).on('keydown',(event,b)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select(b);}});
    labels.selectAll('text').data(points,b=>b.id).join('text').attr('class','base-label').text(b=>b.members?'SAT: AEL 148 + AirMed':b.name.replace('Air Evac Lifeteam ','AEL ')).style('display',$('labels').checked?null:'none');
    positionMarks();selectionStyle();preview();
  }
  function resize(){
    const box=$('map').getBoundingClientRect();width=box.width;height=box.height;
    if(width<80||height<80)return;
    svg.attr('viewBox',`0 0 ${width} ${height}`);
    projection.fitExtent([[24,25],[width-24,height-42]],extent);
    countyLayer.attr('d',path);boundary.attr('d',path);
    states.attr('x',d=>projection([d[1],d[2]])[0]).attr('y',d=>projection([d[1],d[2]])[1]);
    svg.call(zoom.extent([[0,0],[width,height]]).translateExtent([[-width,-height],[width*2,height*2]]));
    svg.call(zoom.transform,d3.zoomIdentity);render();
  }
  function closeFilters(){ $('filters').hidden=true;$('filter-toggle').setAttribute('aria-expanded','false'); }
  $('filter-toggle').onclick=()=>{const open=$('filters').hidden;$('filters').hidden=!open;$('filter-toggle').setAttribute('aria-expanded',String(open));if(open){$('selection').hidden=true;$('close-filters').focus();}};
  $('close-filters').onclick=()=>{closeFilters();$('filter-toggle').focus();};
  $('close-selection').onclick=clearSelection;
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeFilters();clearSelection();}});
  $('operators').insertAdjacentHTML('beforeend',Object.entries(operators).map(([id,o])=>`<label class="operator"><input type="checkbox" value="${id}" checked><span class="swatch" style="background:${o.color}"></span>${o.name}<span class="count">${data.bases.filter(b=>b.operator===id).length}</span></label>`).join(''));
  $('search').addEventListener('input',render);
  document.querySelectorAll('input[type=checkbox],select').forEach(el=>el.addEventListener('change',render));
  $('zoom-in').onclick=()=>svg.transition().duration(200).call(zoom.scaleBy,1.6);
  $('zoom-out').onclick=()=>svg.transition().duration(200).call(zoom.scaleBy,1/1.6);
  $('reset').onclick=()=>{clearSelection();svg.transition().duration(250).call(zoom.transform,d3.zoomIdentity);};
  window.lucide?.createIcons();
  new ResizeObserver(resize).observe(document.querySelector('.map-shell'));
  resize();
})();
