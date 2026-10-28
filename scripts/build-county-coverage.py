"""Precompute county contact on WGS84 from the map-only dataset.

Requires pyproj and shapely (PYTHONPATH may point to research vendor/).
County edges are short WGS84 geodesic segments between the existing vertices.
For each outside base, minimize geodesic distance along every potentially
nearest edge, including endpoints. No circle-polygon vertex test or centroid
test is used. Inclusion uses unrounded distance; 1 mm is numerical tolerance.
County geometry remains limited to the resolution of the source map data.
"""
import hashlib
import json
import math
from pathlib import Path
from pyproj import Geod
from shapely.geometry import Point, Polygon, MultiPolygon

GEOD = Geod(ellps='WGS84')
RADIUS = 138900
TOLERANCE = .001
ROOT = Path(__file__).resolve().parents[1]


def prepare(geometry):
    polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
    edges, shapes = [], []
    for polygon in polygons:
        rings = []
        for ring in polygon:
            dense = []
            for a, b in zip(ring, ring[1:]):
                az, _, length = GEOD.inv(*a, *b)
                if length == 0:
                    continue
                edges.append((a, b, az, length))
                dense.append(a)
                n = math.ceil(length / 250) - 1
                if n > 0:
                    dense.extend(GEOD.npts(*a, *b, n))
            dense.append(ring[-1])
            rings.append(dense)
        shapes.append(Polygon(rings[0], rings[1:]))
    return edges, MultiPolygon(shapes)


def edge_distance(point, edge):
    a, b, az, length = edge
    def distance(t):
        q = GEOD.fwd(*a, az, t)
        return GEOD.inv(*point, q[0], q[1])[2]
    # Distance is unimodal on these short county segments; keep endpoints.
    lo, hi = 0., length
    ratio = (math.sqrt(5) - 1) / 2
    x, y = hi-ratio*(hi-lo), lo+ratio*(hi-lo)
    dx, dy = distance(x), distance(y)
    while hi-lo > .0005:
        if dx < dy:
            hi, y, dy = y, x, dx
            x = hi-ratio*(hi-lo)
            dx = distance(x)
        else:
            lo, x, dx = x, y, dy
            y = lo+ratio*(hi-lo)
            dy = distance(y)
    return min(dx, dy, distance(0), distance(length))


def nearest(point, prepared):
    edges, polygon = prepared
    if polygon.covers(Point(point)):
        return 0.
    n = len(edges)
    da = GEOD.inv([point[0]]*n, [point[1]]*n, [e[0][0] for e in edges], [e[0][1] for e in edges])[2]
    db = GEOD.inv([point[0]]*n, [point[1]]*n, [e[1][0] for e in edges], [e[1][1] for e in edges])[2]
    best = min(min(da), min(db))
    # Triangle inequality bounds every point on a segment. This only prunes
    # edges that cannot beat the current best distance, never contact edges.
    candidates = sorted(((max(0, (a+b-edge[3])/2), edge) for a,b,edge in zip(da,db,edges)), key=lambda x:x[0])
    for lower, edge in candidates:
        if lower > best:
            break
        best = min(best, edge_distance(point, edge))
    return best


def build():
    source = (ROOT/'assets/gmr-map/map-only-data.js').read_text(encoding='utf-8').encode('utf-8')
    data = json.loads(source.decode('utf-8').split('=',1)[1].strip().removesuffix(';'))
    rows, margins = [], []
    for feature in data['counties']['features']:
        props = feature['properties']
        name = props.get('NAME', props.get('name')).removesuffix(' County')
        prepared = prepare(feature['geometry'])
        matches = []
        for b in data['bases']:
            distance = nearest((b['lng'], b['lat']), prepared)
            margins.append((abs(distance-RADIUS), name, b['id'], distance))
            if distance <= RADIUS + TOLERANCE:
                matches.append({'id':b['id'], 'distanceMeters':round(distance,3)})
        matches.sort(key=lambda m:(m['distanceMeters'], next(b['name'] for b in data['bases'] if b['id']==m['id'])))
        rows.append({'name':name, 'matches':matches})
    result = {'sourceSha256':hashlib.sha256(source).hexdigest(), 'radiusMeters':RADIUS,
              'method':'Minimum WGS84 geodesic distance to county area; interior = 0; edge contact included.',
              'numericalToleranceMeters':TOLERANCE, 'counties':rows}
    (ROOT/'assets/gmr-map/county-coverage.js').write_text('window.GMR_COUNTY_COVERAGE = '+json.dumps(result,separators=(',',':'))+';\n',encoding='utf-8')
    print(json.dumps({'counties':len(rows),'bases':len(data['bases']),'matches':sum(len(r['matches']) for r in rows),'closestThresholdCases':sorted(margins)[:5]}),flush=True)


if __name__ == '__main__':
    build()
