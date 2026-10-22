# Texas GMR Air Medical Map

Public-source baseline: October 12, 2026. User-provided roster cross-check: October 20, 2026. This is an independent research map, not an official GMR roster or dispatch tool.

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

20 supported sites have open questions, in addition to the two candidates. A hollow marker and dashed ring mean a status, address, pad or aircraft-assignment question is open. The 25-item verification list also includes legacy records not plotted and the near-threshold Dodge City location. An open question is not evidence that a base is closed.

The owner personally visited AirMed International at San Antonio International Airport and confirmed that both AirMed and AEL 148 have nearby hangars there on October 12, 2026. This resolves the AirMed San Antonio verification item. Both records carry owner-confirmation notes. At the statewide map scale, a shared two-color airport marker opens both records; filtering to one service shows its individual marker. The display marker is the midpoint of the two recorded coordinates, not a replacement launch coordinate. Both original coordinates and all 75 NM ring vertices are unchanged.

## Source Method

The research screened 322 records from the Air Evac, Med-Trans and Guardian public directories, then cross-checked operator affiliates, hospital partners, CMS NPI location records, official announcements, government records and GMR recruitment. AirMed's official base page and hospital-partner evidence were examined separately.

- https://www.lifeteam.net/services/service-area
- https://www.med-trans.net/services/service-area
- https://www.med-trans.net/affiliates
- https://www.guardianflight.com/services/service-area
- https://airmed.com/about-us/our-bases
- https://npiregistry.cms.hhs.gov/

Each mapped base carries its specific links and evidence note. NPI status alone does not establish present operations. Recruiting alone does not establish an opening date. Directory coordinates were corrected when stronger address evidence was available, using Census or Esri address geocoding; these are not surveyed landing pads. Seven user-provided roster screenshots were received October 20; their effective date and completeness are not established. Owner confirmations cover the La Grange closure and the presence of AirMed International and AEL 148 at San Antonio International Airport. Completeness cannot be guaranteed.

## October 20 Roster Cross-Check

All 93 visible rows were reconciled: 60 rows matched 59 existing physical sites (AeroCare I/III share one site), and 33 rows were outside the uniform 75 NM rule at the screened coordinates. No clearly qualifying new site was found. The roster's 100/900 range values were not adopted. Raw screenshots were not published.

56 base records now have supplied phone numbers, shown on hover, keyboard focus and selection, with clickable `tel:` links in details. Three matched sites show roster N/A; seven map records were absent from the excerpts and show not supplied. Numbers are transcribed, not independently dial-verified or asserted to be dispatch lines. San Antonio's shared marker keeps AEL 148's phone separate from AirMed International, whose phone was not provided.

Four address points and their rings were regenerated: Big Spring (1601 W 11th Place), Laredo (5203 Maher), Crockett (1100 E Loop 304), and McAlester (1021 N Strong Boulevard). These remain approximate address points. Other coordinates and all county geometry were preserved. Roster evidence supports additional rotor-wing classifications, the Liberal operation, AEL 184 and multiple previously disputed addresses.

Clovis and Plainview retain their existing airport points with alternate roster addresses disclosed. Lubbock retains one combined rotor/fixed-wing site with a visible conflict because the roster labels both programs rotor while EagleMed still lists AeroCare III fixed-wing. Centerville uses a city-based name because the North/South designation conflicts. Plainview's supplied phone duplicates Lovington's; this is disclosed, not silently corrected. ZIP discrepancies were not used to move pins.

`base-audit.json` records screenshot image/row references, supplied addresses, phone provenance, remaining questions and all 93 screening outcomes. The private workspace build inputs preserve the transcription and geocoder results; future builds must apply the roster overlay after the earlier public-source overrides.

## Geometry

75 nautical miles is exactly 138,900 meters. Rings were calculated with PROJ/pyproj's WGS84 ellipsoidal geodesic engine, sampled at each degree of bearing. Every radius sample was checked by inverse geodesic calculation to within 0.01 meter of the target radius.

Eligibility uses the distance from the base to the Census TIGERweb ACS 2024 Texas 1:500,000 boundary in a base-centered WGS84 azimuthal equidistant projection. This is a generalized boundary and approximate base coordinates remain a material limitation. Dodge City's older operator point is about 75.04 NM away; its roster address point is about 75.52 NM away. Both are excluded pending precise-coordinate review. Kansas sites were tested by geometry even though Kansas does not share a land border with Texas.

The browser uses a conformal conic projection. Census polygon winding is normalized to D3's convention before rendering. Circles are geographic comparison areas, not helicopter range limits, flight-time estimates, guaranteed service areas, membership coverage or fixed-wing operating limits.

## Checks and Maintenance

Hovering or keyboard-focusing a known aircraft base replaces its pin with a small top-down helicopter, airplane, or nose-to-tail split hybrid. The shared San Antonio airport marker uses a red helicopter half and green airplane half. Unknown aircraft types retain their circle. The glyph stays centered on the existing display coordinate and keeps a constant size during map zoom; no base coordinates or radius geometry are changed.

With Playwright available, run `node tests/gmr-map-hover.browser.cjs` to check the aircraft states, hover exit, keyboard selection, filtering, zoom sizing, geometry preservation and responsive layouts. It uses Edge by default; set `BROWSER_CHANNEL` for another installed Chromium channel. Pass the deployed page URL as its first argument to test production.

Run `node tests/gmr-map-phones.browser.cjs` to check every record's phone or explicit missing value, keyboard tooltips, shared-airport attribution, telephone links and 390/768/1440-pixel layouts. Set `SCREENSHOT_DIR` to preserve visual checks.

Run the dependency-free dataset regression checks from the repository root:

```sh
node tests/gmr-map.test.cjs
```

Browser QA covered 390, 768 and 1440 pixel widths, visual screenshots, geographic framing, search, aircraft and operator filters, candidate visibility, selection details, labels, radius visibility and zoom. Changes to a coordinate require regenerating its geodesic ring and eligibility distance, updating all three data exports and reviewing the relevant question. Do not update only a visible pin.

D3 7.9.0 and Lucide 0.468.0 are vendored with their licenses. County and state geometry are U.S. Census public data. Publication uses the repository's existing GitHub Pages workflow and custom domain.
