"""Geodesic edge cases plus independent projected-distance check of all pairs."""
import importlib.util
import hashlib
import json
import math
from pathlib import Path
from shapely.geometry import Point
from shapely.ops import transform

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('coverage', root/'scripts/build-county-coverage.py')
coverage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(coverage)
geod = coverage.GEOD

for offset in [-.1, 0, .1]:
    lng, _, _ = geod.fwd(0, 0, 90, coverage.RADIUS+offset)
    polygon = {'type':'Polygon','coordinates':[[[lng,-.5],[lng+.1,-.5],[lng+.1,.5],[lng,.5],[lng,-.5]]]}
    prepared = coverage.prepare(polygon)
    distance = coverage.nearest((0,0), prepared)
    assert abs(distance-coverage.RADIUS-offset)<.001, distance
    assert (distance<=coverage.RADIUS+coverage.TOLERANCE)==(offset<=0)
    # All corners are outside: the segment interior alone makes contact.
    assert min(geod.inv(0,0,*q)[2] for q in polygon['coordinates'][0])>coverage.RADIUS

outer=[[-2,-2],[2,-2],[2,2],[-2,2],[-2,-2]]
hole=[[-.1,-.1],[-.1,.1],[.1,.1],[.1,-.1],[-.1,-.1]]
assert coverage.nearest((0,0),coverage.prepare({'type':'Polygon','coordinates':[outer]}))==0
assert coverage.nearest((0,0),coverage.prepare({'type':'Polygon','coordinates':[outer,hole]}))>10000
multi={'type':'MultiPolygon','coordinates':[[outer,hole],[[[3,3],[4,3],[4,4],[3,4],[3,3]]]]}
assert coverage.nearest((3.5,3.5),coverage.prepare(multi))==0

source=(root/'assets/gmr-map/map-only-data.js').read_text(encoding='utf-8')
data=json.loads(source.split('=',1)[1].strip().removesuffix(';'))
result=json.loads((root/'assets/gmr-map/county-coverage.js').read_text().split('=',1)[1].strip().removesuffix(';'))
assert hashlib.sha256(source.encode()).hexdigest()==result['sourceSha256'], 'Rebuild coverage after changing map data'
assert len(result['counties'])==254
lookup={c['name']:c for c in result['counties']}
polygons=[(f['properties'].get('NAME',f['properties'].get('name')).removesuffix(' County'),coverage.prepare(f['geometry'])[1]) for f in data['counties']['features']]
max_error=0
for base in data['bases']:
    # Independent nearest-point calculation in a base-centered azimuthal
    # equidistant plane. Dense boundary chords approximate the true edges.
    def project(lons,lats):
        az,_,dist=geod.inv([base['lng']]*len(lons),[base['lat']]*len(lats),lons,lats)
        return ([math.sin(math.radians(a))*d for a,d in zip(az,dist)],
                [math.cos(math.radians(a))*d for a,d in zip(az,dist)])
    for name,polygon in polygons:
        distance=transform(project,polygon).distance(Point(0,0))
        match=next((m for m in lookup[name]['matches'] if m['id']==base['id']),None)
        assert (match is not None)==(distance<=coverage.RADIUS+coverage.TOLERANCE),(name,base['name'],distance)
        if match:
            error=abs(distance-match['distanceMeters'])
            max_error=max(max_error,error)
            assert error<.1,(name,base['name'],error)
for county in result['counties']:
    distances=[m['distanceMeters'] for m in county['matches']]
    assert distances==sorted(distances)
print(json.dumps({'passed':True,'pairsChecked':254*63,'independentDistanceMaxDifferenceMeters':max_error,'tangentAndGrazingEdges':True,'holesAndMultipolygons':True}))
