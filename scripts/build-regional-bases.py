"""Build regional overlay from reviewed inputs. Requires pyproj and shapely.

Set PYTHONPATH to the existing research vendor directory if needed.
Original GMR and map-only data are read-only inputs.
"""
import csv
import json
from pathlib import Path
from pyproj import Geod, CRS, Transformer
from shapely.geometry import Point, shape
from shapely.ops import unary_union, transform
from shapely import make_valid

root = Path(__file__).resolve().parents[1] / 'assets/gmr-map'
data = json.loads((root/'regional-sites.json').read_text(encoding='utf-8'))
original = json.loads((root/'data.js').read_text(encoding='utf-8').split('=',1)[1].strip().removesuffix(';'))
geod = Geod(ellps='WGS84')
halos = [b for b in data['bases'] if b['operator']=='halo']
counties = [(f['properties'].get('NAME',f['properties'].get('name')).removesuffix(' County'),shape(f['geometry'])) for f in original['counties']['features']]
texas = unary_union([make_valid(geometry) for _,geometry in counties])
def nearest(lat,lng):
    return min((geod.inv(lng,lat,b['lng'],b['lat'])[2]/1852,b['city']) for b in halos)
max_error = 0
for b in data['bases']:
    if b['state']=='TX':
        assert any(name==b['county'] and geometry.covers(Point(b['lng'],b['lat'])) for name,geometry in counties), b['name']
        b['distanceToTexasNm']=0
    else:
        local=CRS.from_proj4(f"+proj=aeqd +lat_0={b['lat']} +lon_0={b['lng']} +datum=WGS84 +units=m")
        project=Transformer.from_crs('EPSG:4326',local,always_xy=True).transform
        b['distanceToTexasNm']=round(transform(project,texas).distance(Point(0,0))/1852,3)
        assert b['distanceToTexasNm']<=75, b['name']
    ring = []
    for bearing in range(360):
        lng,lat,_=geod.fwd(b['lng'],b['lat'],bearing,138900)
        ring.append([round(lng,8),round(lat,8)])
    ring.append(ring[0])
    b['circle']={'type':'Polygon','coordinates':[ring]}
    max_error=max(max_error,max(abs(geod.inv(b['lng'],b['lat'],lng,lat)[2]-138900) for lng,lat in ring))
    if b['operator']=='phi':
        distance,city=nearest(b['lat'],b['lng'])
        b['nearestHalo']={'city':city,'distanceNm':round(distance,2)}
        if 'locatorOriginal' in b:
            b['locatorOffsetNm']=round(geod.inv(b['lng'],b['lat'],b['locatorOriginal']['lng'],b['locatorOriginal']['lat'])[2]/1852,2)
for p in data['phiLocatorScreening']:
    distance,city=nearest(float(p['lat']),float(p['lng']))
    p.update(nearestHalo=city,distanceNm=round(distance,2),included=True,haloCircleOverlap=distance<=150)
data['phiLocatorScreening'].sort(key=lambda p:p['distanceNm'])
assert max_error<0.002
assert len({b['id'] for b in data['bases']})==len(data['bases'])
data['radiusMeters']=138900
data['geometryValidation']={'ellipsoid':'WGS84','bearings':360,'maximumVertexRadiusErrorMeters':max_error,'countyContainment':'Every Texas center lies within its stated Census county; non-Texas sites separately pass the 75 NM border-distance rule.','texasCenters':sum(b['state']=='TX' for b in data['bases']),'borderCenters':sum(b['state']!='TX' for b in data['bases'])}
(root/'regional-audit.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(root/'regional-data.js').write_text('window.GMR_REGIONAL_DATA = '+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
with (root/'regional-bases.csv').open('w',encoding='utf-8-sig',newline='') as f:
    writer=csv.DictWriter(f,fieldnames=['name','operator','city','state','county','address','lat','lng','mode','status','precision','note','checked'])
    writer.writeheader()
    for b in data['bases']:writer.writerow({k:b[k] for k in writer.fieldnames})
print(json.dumps({'records':len(data['bases']),'supported':sum(b['status']=='Publicly supported' for b in data['bases']),'radiusValidation':data['geometryValidation']}))
