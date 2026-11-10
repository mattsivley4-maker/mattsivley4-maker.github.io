"""WGS84 nearest-adult-Level-I comparison; not a clinical destination model.

Requires numpy, pyproj and shapely. Uses existing public hospital coordinates.
For each Bexar center and bearing, solve distance-to-Bexar minus distance-to-
nearest-other-center = 0 (core) or 18,520 m (outer limit). Union the two Bexar
regions. The near-tie band is only OUTSIDE the core. Clip both to Texas land.
"""
import json
from pathlib import Path
import numpy as np
from pyproj import Geod, Transformer
from shapely.geometry import Polygon, Point, shape, mapping
from shapely.ops import unary_union, transform
from shapely import make_valid

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'assets/gmr-map'
GEOD=Geod(ellps='WGS84')
PROJ='+proj=aeqd +lat_0=29.5 +lon_0=-98.5 +datum=WGS84 +units=m'
FORWARD=Transformer.from_crs('EPSG:4326',PROJ,always_xy=True).transform
INVERSE=Transformer.from_crs(PROJ,'EPSG:4326',always_xy=True).transform
PEDIATRIC_ONLY={'hospital-tx-3c43a3fc60f0','hospital-tx-3b5e8a903af6','hospital-tx-f0115d7485db'}

def nearest(lon,lat,centers):
    lon=np.asarray(lon,dtype=float);lat=np.asarray(lat,dtype=float)
    result=np.full(lon.shape,np.inf)
    for h in centers:
        _,_,d=GEOD.inv(lon,lat,np.full(lon.shape,h['lng']),np.full(lat.shape,h['lat']))
        result=np.minimum(result,d)
    return result

def root_ring(h,others,offset,step):
    def solve(angles):
        lons=np.full(angles.shape,h['lng']);lats=np.full(angles.shape,h['lat'])
        lo=np.zeros(angles.shape);hi=np.full(angles.shape,2_000_000.)
        x,y,_=GEOD.fwd(lons,lats,angles,hi)
        assert np.all(hi-nearest(x,y,others)>offset),'Comparison boundary is not enclosed within the search extent'
        for _ in range(32):
            mid=(lo+hi)/2
            x,y,_=GEOD.fwd(lons,lats,angles,mid)
            inside=mid-nearest(x,y,others)<=offset
            lo=np.where(inside,mid,lo);hi=np.where(inside,hi,mid)
        x,y,_=GEOD.fwd(lons,lats,angles,(lo+hi)/2)
        return np.column_stack(FORWARD(x,y))
    angles=np.arange(0,360,step);xy=solve(angles)
    # Refine only corners needing it, rather than oversampling every bearing.
    for _ in range(16):
        halfway=(xy+np.roll(xy,-1,axis=0))/2
        mx,my=INVERSE(halfway[:,0],halfway[:,1])
        residual=np.abs(nearest(mx,my,[h])-nearest(mx,my,others)-offset)
        bad=residual>20
        if not bad.any():return Polygon(xy),float(residual.max())
        next_angles=np.r_[angles[1:],360.]
        extra=(angles[bad]+next_angles[bad])/2
        combined=np.r_[angles,extra];coords=np.vstack([xy,solve(extra)])
        order=np.argsort(combined);angles=combined[order];xy=coords[order]
    raise AssertionError('Boundary corner refinement did not converge')

def build():
    hospital=json.loads((ASSETS/'hospital-audit.json').read_text(encoding='utf-8'))
    level1=[h for h in hospital['hospitals'] if h['level']==1]
    eligible=[h for h in level1 if h['id'] not in PEDIATRIC_ONLY]
    bexar=[h for h in eligible if h['county']=='Bexar']
    others=[h for h in eligible if h['county']!='Bexar']
    assert len(bexar)==2 and len(eligible)==19
    old=json.loads((ASSETS/'data.js').read_text(encoding='utf-8').split('=',1)[1].strip().removesuffix(';'))
    texas=transform(FORWARD,unary_union([make_valid(shape(f['geometry'])) for f in old['texas']['features']]))
    regions=[];max_error=0;steps=[]
    for offset in [0,18520]:
        rings=[]
        for h in bexar:
            step=.1
            ring,error=root_ring(h,others,offset,step)
            print(h['name'],offset,'step',step,'edge residual',round(error,3),flush=True)
            rings.append(ring);max_error=max(max_error,error);steps.append(step)
        regions.append(unary_union(rings))
    core=make_valid(regions[0].intersection(texas))
    tie=make_valid(regions[1].difference(regions[0]).intersection(texas))
    assert core.is_valid and tie.is_valid and not core.is_empty and not tie.is_empty
    assert core.intersection(tie).area<1
    def feature(geom,id,label):
        # Do not smooth away narrow parts of the near-tie band.
        return dict(type='Feature',properties=dict(id=id,label=label),geometry=mapping(transform(INVERSE,geom)))
    def center(h):
        return {k:h[k] for k in ['id','name','county','city','lat','lng','address','designationStatus']}
    result=dict(checked='2026-11-10',designationAsOf='2026-10-28',population='Adult Level I',
      scope='Texas only; nearest of University Hospital and Brooke Army Medical Center compared with 17 other Texas adult-capable Level I campuses. Pediatric-only centers are excluded.',
      thresholdNm=10,radiusCapNm=None,metric='Shortest WGS84 ellipsoidal distance from origin to hospital campus; not a flown route or travel-time estimate',
      formulas={'core':'min(distance to Bexar Level I) <= min(distance to other Texas adult Level I)',
      'nearTieOutside':'0 < min(distance to Bexar Level I) - min(distance to other Texas adult Level I) <= 10 nautical miles'},
      limitations=['Distance advantage is not clinical destination suitability, dispatch preference or a probability of transport.',
      'No bed availability, acceptance, diversions, specialties, patient condition, flight restrictions, weather, wind, aircraft speed or ground transfer time is modeled.',
      'The comparison begins at the patient origin; it does not include a responding aircraft base-to-scene leg.',
      'Other states and Mexico are not included. Texas borders and coastline clip the display; they are not equal-distance boundaries.',
      'All eligible hospitals remain in the calculation even when hospital flags or provider layers are hidden.',
      'Hospital campus coordinates are approximate; geometry precision does not improve source location accuracy.',
      'The 10 NM threshold was selected by the map owner, not established as a clinical or regulatory standard.',
      'The layer is not capped at the air-base 75 NM radii. These are separate comparisons.'],
      sources=[{'title':'Texas DSHS Level I designation list (October 28, 2026), checked November 10','url':'https://www.dshs.texas.gov/dshs-ems-trauma-systems/trauma-system-development/texas-trauma-facilities'},
      {'title':'University Hospital adult and pediatric Level I trauma services','url':'https://www.universityhealth.com/services/trauma'},
      {'title':'BAMC Level I trauma service for military and civilian patients','url':'https://bamc.tricare.mil/About-Us/SAU'},
      {'title':'Hospital campus coordinate provenance','url':'hospital-audit.json'}],
      targetCenters=[center(h) for h in bexar],comparisonCenters=[center(h) for h in others],
      excludedPediatricOnly=[center(h) for h in level1 if h['id'] in PEDIATRIC_ONLY],
      validation={'method':'Radial WGS84 root solving for each Bexar campus, then polygon union/difference in a local azimuthal-equidistant projection. Clipped to existing Census Texas boundary.',
      'maxRootBracketMeters':2_000_000/2**32,'maximumRawEdgeMidpointDistanceResidualMeters':max_error,'initialBearingStepsDegrees':steps,'adaptiveCornerRefinement':True,
      'coreAreaSquareKm':core.area/1e6,'outsideTieAreaSquareKm':tie.area/1e6},
      features=[feature(core,'bexar-nearest','Bexar is the closest adult Level I'),feature(tie,'bexar-near-tie','Outside near-tie: Bexar adds up to 10 NM')])
    (ASSETS/'trauma-catchment.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    (ASSETS/'trauma-catchment-data.js').write_text('window.GMR_TRAUMA_CATCHMENT = '+json.dumps(result,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    print(json.dumps(result['validation']))

if __name__=='__main__':build()
