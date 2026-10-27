"""Build regional overlay from reviewed inputs. Requires pyproj and shapely.

Set PYTHONPATH to the existing research vendor directory if needed.
Original GMR and map-only data are read-only inputs.
"""
import csv
import json
from pathlib import Path
from pyproj import Geod
from shapely.geometry import Point, shape

root = Path(__file__).resolve().parents[1] / 'assets/gmr-map'
data = json.loads((root/'regional-sites.json').read_text(encoding='utf-8'))
original = json.loads((root/'data.js').read_text(encoding='utf-8').split('=',1)[1].strip().removesuffix(';'))
geod = Geod(ellps='WGS84')
halos = [b for b in data['bases'] if b['operator']=='halo']
counties = [(f['properties'].get('NAME',f['properties'].get('name')).removesuffix(' County'),shape(f['geometry'])) for f in original['counties']['features']]
def nearest(lat,lng):
    return min((geod.inv(lng,lat,b['lng'],b['lat'])[2]/1852,b['city']) for b in halos)
max_error = 0
for b in data['bases']:
    assert any(name==b['county'] and geometry.covers(Point(b['lng'],b['lat'])) for name,geometry in counties), b['name']
    ring = []
    for bearing in range(360):
        lng,lat,_=geod.fwd(b['lng'],b['lat'],bearing,138900)
        ring.append([round(lng,8),round(lat,8)])
    ring.append(ring[0])
    b['circle']={'type':'Polygon','coordinates':[ring]}
    max_error=max(max_error,max(abs(geod.inv(b['lng'],b['lat'],lng,lat)[2]-138900) for lng,lat in ring))
    if b['operator']=='phi':
        distance,city=nearest(b['lat'],b['lng'])
        assert distance<=150
        b['nearestHalo']={'city':city,'distanceNm':round(distance,2)}
        b['locatorOffsetNm']=round(geod.inv(b['lng'],b['lat'],b['locatorOriginal']['lng'],b['locatorOriginal']['lat'])[2]/1852,2)
for p in data['phiLocatorScreening']:
    distance,city=nearest(float(p['lat']),float(p['lng']))
    p.update(nearestHalo=city,distanceNm=round(distance,2),included=distance<=150)
data['phiLocatorScreening'].sort(key=lambda p:p['distanceNm'])
assert max_error<0.002
assert len(data['bases'])==12
assert len({b['id'] for b in data['bases']})==12
data['radiusMeters']=138900
data['geometryValidation']={'ellipsoid':'WGS84','bearings':360,'maximumVertexRadiusErrorMeters':max_error,'countyContainment':'All 12 centers fall inside the stated Census county'}
(root/'regional-audit.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(root/'regional-data.js').write_text('window.GMR_REGIONAL_DATA = '+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
with (root/'regional-bases.csv').open('w',encoding='utf-8-sig',newline='') as f:
    writer=csv.DictWriter(f,fieldnames=['name','operator','city','county','address','lat','lng','mode','status','precision','note','checked'])
    writer.writeheader()
    for b in data['bases']:writer.writerow({k:b[k] for k in writer.fieldnames})
print(json.dumps({'records':len(data['bases']),'supported':sum(b['status']=='Publicly supported' for b in data['bases']),'radiusValidation':data['geometryValidation'],'phiNearestHalo':[(b['name'],b['nearestHalo']) for b in data['bases'] if b['operator']=='phi']}))
