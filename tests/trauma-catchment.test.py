"""Independently classify Texas sample points against exported zone polygons."""
import importlib.util,json
from pathlib import Path
import numpy as np
from shapely.geometry import Point,shape
from shapely.prepared import prep

root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('catchment',root/'scripts/build-trauma-catchment.py')
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
d=json.loads((root/'assets/gmr-map/trauma-catchment.json').read_text())
core=shape(d['features'][0]['geometry']);tie=shape(d['features'][1]['geometry'])
assert core.is_valid and tie.is_valid and core.intersection(tie).area<1e-10
assert len(d['targetCenters'])==2 and len(d['comparisonCenters'])==17
assert len(d['excludedPediatricOnly'])==3 and d['thresholdNm']==10
assert d['validation']['maximumRawEdgeMidpointDistanceResidualMeters']<=20
assert all(core.covers(Point(h['lng'],h['lat'])) for h in d['targetCenters'])
assert all(not core.covers(Point(h['lng'],h['lat'])) for h in d['comparisonCenters'])
old=json.loads((root/'assets/gmr-map/data.js').read_text().split('=',1)[1].strip().removesuffix(';'))
texas=prep(c.unary_union([c.make_valid(shape(f['geometry'])) for f in old['texas']['features']]))
rng=np.random.default_rng(20261110)
points=[(x,y) for x,y in zip(rng.uniform(-106.7,-93.5,45000),rng.uniform(25.8,36.6,45000)) if texas.covers(Point(x,y))]
lon,lat=np.array(points).T
delta=c.nearest(lon,lat,d['targetCenters'])-c.nearest(lon,lat,d['comparisonCenters'])
pc,pt=prep(core),prep(tie)
mismatches=[]
for (x,y),gap in zip(points,delta):
    # Allow 50 m around computed boundaries; source campus uncertainty is separate.
    if min(abs(gap),abs(gap-18520))<50:continue
    p=Point(x,y)
    if pc.covers(p)!=(gap<=0) or pt.covers(p)!=(0<gap<=18520):mismatches.append((x,y,float(gap)))
assert not mismatches,mismatches[:10]
# Named sanity checks: San Antonio / Uvalde core; Austin / McAllen not core.
for name,x,y,expected in [('San Antonio',-98.49,29.42,True),('Uvalde',-99.78,29.21,True),('Austin',-97.74,30.27,False),('McAllen',-98.23,26.2,False)]:
    assert pc.covers(Point(x,y))==expected,name
print(json.dumps({'passed':True,'independentPointChecks':len(points),'boundaryToleranceMeters':50,'disjointZones':True,'adultCenters':19}))
