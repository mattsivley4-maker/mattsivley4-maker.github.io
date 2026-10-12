# Texas GMR Air Medical Map

Research snapshot: October 12, 2026. This is an independent public-source research map, not an official GMR roster or dispatch tool.

## Published Files

- `../../texas-gmr-air-medical-map.html`: separate interactive page, without Ingram pins.
- `data.js`: the map dataset, geodesic rings, Texas geometry and 254 counties.
- `base-audit.json`: base records, sources, open questions and exclusions.
- `bases.csv`: flat base list, including evidence status and coordinate precision.
- `map.js`, `map.css`: browser UI; no external runtime services or API keys required.

The original `texas-ingram-air-evac-map.html` is intentionally unchanged. AEL 47 La Grange must remain excluded based on the owner's internal confirmation, regardless of stale directory listings.

## Scope and Counting

64 publicly supported base sites: 40 Air Evac Lifeteam, 22 Med-Trans program sites and 2 AirMed International sites. Of these, 44 are in Texas and 20 are outside Texas within the geographic threshold. This counts physical program locations, not aircraft or flight availability. Co-located AeroCare I and III are combined.

Two additional records are review candidates, hidden by default: Guardian 72 at Idabel and AEL 189 at Anadarko. Guardian's relationship to AEL 184 at the same airport address remains unresolved. No separately confirmed Guardian site is asserted in the default layer.

18 supported sites have open questions, in addition to the two candidates. A hollow marker and dashed ring mean a status, address, pad or aircraft-assignment question is open. The 23-item verification list also includes legacy records not plotted and the near-threshold Dodge City location. An open question is not evidence that a base is closed.

## Source Method

The research screened 322 records from the Air Evac, Med-Trans and Guardian public directories, then cross-checked operator affiliates, hospital partners, CMS NPI location records, official announcements, government records and GMR recruitment. AirMed's official base page and hospital-partner evidence were examined separately.

- https://www.lifeteam.net/services/service-area
- https://www.med-trans.net/services/service-area
- https://www.med-trans.net/affiliates
- https://www.guardianflight.com/services/service-area
- https://airmed.com/about-us/our-bases
- https://npiregistry.cms.hhs.gov/

Each mapped base carries its specific links and evidence note. NPI status alone does not establish present operations. Recruiting alone does not establish an opening date. Directory coordinates were corrected when stronger address evidence was available, using Census or Esri address geocoding; these are not surveyed landing pads. No internal roster or direct operational confirmation was available beyond the La Grange correction. Public-source completeness cannot be guaranteed.

## Geometry

75 nautical miles is exactly 138,900 meters. Rings were calculated with PROJ/pyproj's WGS84 ellipsoidal geodesic engine, sampled at each degree of bearing. Every radius sample was checked by inverse geodesic calculation to within 0.01 meter of the target radius.

Eligibility uses the distance from the base to the Census TIGERweb ACS 2024 Texas 1:500,000 boundary in a base-centered WGS84 azimuthal equidistant projection. This is a generalized boundary and approximate base coordinates remain a material limitation. Dodge City is about 75.04 NM away and is excluded pending precise-coordinate review. Kansas sites were tested by geometry even though Kansas does not share a land border with Texas.

The browser uses a conformal conic projection. Census polygon winding is normalized to D3's convention before rendering. Circles are geographic comparison areas, not helicopter range limits, flight-time estimates, guaranteed service areas, membership coverage or fixed-wing operating limits.

## Checks and Maintenance

Run the dependency-free dataset regression checks from the repository root:

```sh
node tests/gmr-map.test.cjs
```

Browser QA covered 390, 768 and 1440 pixel widths, visual screenshots, geographic framing, search, aircraft and operator filters, candidate visibility, selection details, labels, radius visibility and zoom. Changes to a coordinate require regenerating its geodesic ring and eligibility distance, updating all three data exports and reviewing the relevant question. Do not update only a visible pin.

D3 7.9.0 and Lucide 0.468.0 are vendored with their licenses. County and state geometry are U.S. Census public data. Publication uses the repository's existing GitHub Pages workflow and custom domain.
