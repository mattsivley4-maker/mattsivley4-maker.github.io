/* Geographic comparison layers do not change hospitals, base rings or destination protocols. */
'use strict';
window.createTraumaCatchmentLayer=({world,before,projection,svg,zoom,orientFeature})=>{
  const data=window.GMR_TRAUMA_CATCHMENT;
  if(!data)return;
  const $=id=>document.getElementById(id),path=d3.geoPath(projection);
  const features=data.features.map(orientFeature);
  const pattern=svg.select('defs').append('pattern').attr('id','bexar-near-tie-hatch').attr('patternUnits','userSpaceOnUse').attr('width',6).attr('height',6).attr('patternTransform','rotate(-35)');
  pattern.append('rect').attr('width',6).attr('height',6).attr('fill','#edaf53').attr('fill-opacity',.12);
  pattern.append('path').attr('d','M0,0V6').attr('stroke','#ad5900').attr('stroke-opacity',.65).attr('stroke-width',1);
  const layer=world.insert('g',()=>before.node()).attr('class','trauma-catchment-layer').attr('pointer-events','none').attr('aria-hidden','true');
  layer.selectAll('path').data(features).join('path').attr('class',d=>`trauma-zone ${d.properties.id}`).attr('d',path).attr('vector-effect','non-scaling-stroke');
  function render(){
    const core=$('bexar-nearest-visible').checked,tie=$('bexar-near-tie-visible').checked;
    layer.select('.bexar-nearest').style('display',core?null:'none');
    layer.select('.bexar-near-tie').style('display',tie?null:'none');
    $('catchment-status').textContent=core&&tie?'Both comparison zones shown':core?'Closest-center zone shown':tie?'Outside near-tie zone shown':'Both comparison zones hidden';
  }
  $('bexar-nearest-visible').addEventListener('change',render);
  $('bexar-near-tie-visible').addEventListener('change',render);
  $('catchment-fit').onclick=()=>{
    const shown=features.filter(f=>$(f.properties.id+'-visible').checked);
    if(!shown.length){$('catchment-status').textContent='Select a comparison zone to fit it on the map.';return;}
    const [[x0,y0],[x1,y1]]=path.bounds({type:'FeatureCollection',features:shown});
    const k=Math.min(8,850/(x1-x0),700/(y1-y0));
    svg.transition().duration(350).call(zoom.transform,d3.zoomIdentity.translate(500-k*(x0+x1)/2,430-k*(y0+y1)/2).scale(k));
  };
  const list=$('catchment-centers');
  for(const h of [...data.targetCenters,...data.comparisonCenters]){
    const li=document.createElement('li');li.textContent=`${h.name} — ${h.county} County${h.county==='Bexar'?' (Bexar target)':''}`;list.appendChild(li);
  }
  render();
};
