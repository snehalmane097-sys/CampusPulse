# VIT Bibwewadi interactive campus map

**Analytics/satellite follow-up:** [ANALYTICS_AND_SATELLITE.md](ANALYTICS_AND_SATELLITE.md) records the missing local MapTiler configuration, exact setup/rebuild instructions, URL/attribution checks and current acceptance limits. A key must be an authorized browser-visible MapTiler key restricted to the application's HTTP origins; never commit it. The latest browser interaction was stopped by the user, so earlier browser results do not establish post-chart-fix acceptance.

Implemented 10 November 2026 on `feature/campuspulse-2.0`. No push, merge, deployment or production database operation was performed. Geometry is a checked-in, attributed OSM snapshot, separate from grievance records.

**Stabilization update (11 November 2026):** The earlier default-build and browser blockers below are historical. [STABILIZATION.md](STABILIZATION.md) records a clean default .next build, original-port HTTP recovery, real Student/Admin browser checks, repeated map mounts and missing-satellite fallback. Full device/external-provider acceptance is still pending.

## Initialization error: investigation and correction

The previous `CampusMap.tsx` rendered React Leaflet 4.2.1's `MapContainer`. In the installed `node_modules/react-leaflet/lib/MapContainer.js`, its ref callback has empty dependencies and closes over the initial `context === null`. It allocates `new LeafletMap(node, options)` inside that callback, then schedules context state. Replaying the callback against the same DOM element before that state is committed attempts a second Leaflet map and throws **Map container is already initialized**. Cleanup lived in a later context-dependent effect, so it did not own this ref allocation synchronously.

The installed Next.js 15.5.29 App Router runtime reports bundled React **19.2.0-canary-0bdb9206-20250818**, despite the application's declared React/React DOM 18.3.1. React Leaflet 4.2.1 declares React 18 peers; the upstream React-19 issue and v5 changelog corroborate the lifecycle incompatibility. This is not resolved by looking at package.json's React version alone.

Inspection found:
- Two old usages in Admin Overview and Campus Radar, in mutually exclusive tab branches. They did not share an element ID or intentionally render simultaneously.
- No previous Student CampusMap usage. The student integration added here is inside the existing report form, client-only.
- No existing manual L.map/new LeafletMap calls outside the library; no private Leaflet field manipulation.
- Dynamic imports already used ssr:false and were retained.
- Strict Mode stays enabled. No arbitrary timeout, random map key, forced DOM replacement or private _leaflet_id deletion was added.

Only container ownership is replaced by `LeafletViewport.tsx`: allocate through a React effect, create the existing React Leaflet core context, render its layers through `LeafletProvider`, and release with public `map.remove()` in that effect's cleanup. `ownMap` makes cleanup idempotent and also cleans up a failed setup. Strict effect setup-cleanup-setup owns a fresh map each time. React Leaflet still provides GeoJSON, tiles, markers, events, popups and tooltips; this is a focused container bridge, not a new map stack.

The already-installed @react-leaflet/core 2.1.0 is now declared directly because the bridge imports it. No new package was downloaded and React/Leaflet majors were not forced. This bridge targets the observed initializer failure; it does not claim that upstream v4 officially supports every React 19 behavior. Real-browser acceptance remains required.

Primary references:
- https://nextjs.org/docs/app/getting-started/installation
- https://nextjs.org/blog/next-15-1
- https://github.com/PaulLeCam/react-leaflet/issues/1133
- https://github.com/PaulLeCam/react-leaflet/blob/master/CHANGELOG.md

## Campus identity and geometry provenance

Official address checked against https://www.vit.edu/contact/ : **666, Upper Indira Nagar, Bibwewadi, Pune, Maharashtra 411037**. The initial center is **18.464, 73.868**. It is a navigation center, not a surveyed boundary.

A bounded OSM API extract was actually retrieved on 10 November 2026:
https://api.openstreetmap.org/api/0.6/map?bbox=73.865,18.461,73.871,18.467

Raw download SHA-256: `06D527C6E57A950A34D1CC3983DAC82F5339F75F64C9419BD3B3654753CBB084`.
The first Overpass endpoint attempt returned HTTP 406; the OSM API fallback succeeded. No runtime Overpass calls are required.

`src/data/vit-bibwewadi.geojson.json` contains 23 features with source IDs, source URLs, source element versions/timestamps and original relevant tags:
- One OSM college outline, way/213874316, named Vishwakarma Institute of Technology (VIT).
- Four unnamed building footprints; they are labelled by their OSM IDs, never assigned academic block numbers.
- One named library point, two named canteen footprints, one unnamed gate.
- Twelve path/service/steps/crossing features, one unnamed park and the named playground.

| Named/entrance feature | OSM source | What is actually known |
|---|---|---|
| VIT Library | https://www.openstreetmap.org/node/11832252014 | Library point with campus address; no opening hours supplied |
| VIT Fruit Canteen | https://www.openstreetmap.org/way/1371963468 | Mapped fast_food/cafeteria and building=cafe; operation not independently surveyed |
| VIT Canteen | https://www.openstreetmap.org/way/1371963261 | OSM includes disused:amenity=cafe and check_date=2026-10-12; UI explicitly warns that current operation is unverified |
| VIT Play Ground | https://www.openstreetmap.org/way/223964778 | Named recreation_ground polygon |
| Unnamed OSM entrance | https://www.openstreetmap.org/node/11166456994 | barrier=gate, access=private; not asserted to be the main/public entrance |

The outline is labelled **OSM college outline, not an official surveyed boundary**. Features were selected when at least one vertex fell inside that outline; crossing ways are retained whole, not clipped or represented as entirely internal. The larger coordinate-selection window (18.458–18.470, 73.862–73.875) is a pragmatic navigation/input constraint, explicitly **not a campus boundary**. This avoids pretending that community geometry establishes a legal/perimeter limit.

OSM data is distributed under ODbL-1.0 with source/licence metadata and visible OpenStreetMap contributor attribution. Retain that attribution and licence/provenance when correcting or redistributing the derived geometry: https://www.openstreetmap.org/copyright .

### Missing/unverified data

No verified academic building names/numbers, laboratory locations, administrative office coordinates, washroom locations, parking labels, official gate names, opening hours, indoor geometry, accessible routing or official surveyed perimeter were available in this extract. They were not fabricated. The unnamed building footprints cannot be called Academic Block A/B/C/D without independent confirmation.

The old fictional Block A-D/Lab/Hostel coordinates around 18.5246,73.8786 were removed. Unknown/Unspecified names no longer fall back to a campus-center marker. Existing text reports remain unchanged, counted and listed; a visible unmapped count explains why they have no marker. Only an exact named OSM match (e.g. VIT Library) or a valid saved user pin is mapped.

Future corrections: edit/replace the GeoJSON FeatureCollection using verified source geometry; retain stable IDs/provenance/category/name-null semantics. Keep descriptive/opening fields absent unless sourced. Verify newly mapped names and disused tags with campus staff. Rebuild the app after changes; there is no live geometry editor or automatic production import.

## Tiles, attribution and failure handling

### Standard

URL: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`. Visible OpenStreetMap attribution and a Report a map issue link are included. No bulk download, prefetch, offline tile pack, forced no-cache headers or proxy scraping was introduced. Tile images explicitly use `strict-origin-when-cross-origin` referrer policy, so the app's general no-referrer policy does not suppress the origin required by the tile service. Signed evidence URLs retain their own privacy policy.

Follow https://operations.osmfoundation.org/policies/tiles/ . Standard tile availability is best effort; an institution-scale deployment must assess the public tile policy/capacity and arrange an appropriate service if necessary.

### Satellite

No unauthorized Google URLs or unlicensed default Esri endpoint are used. Configured default is **MapTiler satellite-v2 JPG XYZ**, verified from provider documentation:
- https://docs.maptiler.com/schema-raster/satellite/
- https://docs.maptiler.com/leaflet/
- https://docs.maptiler.com/guides/map-design/attribution/add-attribution/
- https://www.maptiler.com/terms/

Supply a browser-visible, origin-restricted `NEXT_PUBLIC_MAPTILER_KEY` under a suitable provider account/plan. The app requests:
`https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=<public-key>`.
MapTiler copyright link and logo are shown while its imagery is active; OSM attribution remains for the campus overlays. Review current plan, quotas and imagery attribution at deployment. No account entitlement or live satellite request has been verified here.

Alternatively supply both:
- `NEXT_PUBLIC_SATELLITE_TILE_URL`: licensed HTTPS XYZ template containing {z}, {x}, {y}.
- `NEXT_PUBLIC_SATELLITE_ATTRIBUTION`: provider-required attribution HTML from a trusted operator, not end-user content.

Credentials embedded in NEXT_PUBLIC variables are public; never use an AWS/Resend/private service secret here. Custom HTTPS origin is added to image CSP at build time. Credentials in URL userinfo, incomplete templates and Google hostname patterns are rejected by configuration handling. Custom providers must match Web Mercator XYZ semantics and the displayed zoom behavior; the adapter does not implement arbitrary WMTS projections, subdomain expansion or TMS inversion. Supply any additional provider branding required by your licence before enabling it.

All these public values are build-time client configuration. Rebuild/restart the test app after changing them. Missing satellite configuration leaves Standard operational with an explanatory message. Satellite tile errors return to Standard and retain the map instance/view/filters/selections. Standard errors display a warning and Retry tiles while local geometry/controls remain. No URL/key is logged to explain tile failures.

## Student and Admin workflows

Student:
1. Open **Explore campus / choose issue location (optional)** in the existing Report an issue form.
2. Search available mapped names/categories, select a feature and inspect its source/status in the compact panel.
3. Click the map, drag the pin, use Move pin to map center, or Place pin at this feature.
4. Click **Confirm selected location**. A moved/unconfirmed draft blocks submission until confirmed or cleared.
5. Submit using the existing Submit grievance action. Text-only submission remains valid; map data is optional. Category/department routing still follows the description; geometry does not relabel or reroute a report.
6. The same explorer shows only the student's own authorized reports and opens the existing grievance workspace.

Admin:
- Overview and Campus Radar use the same component. All authorized reports are loaded through a paginated map feed, independently of the Live Feed's opened page count.
- Category colors, priority outlines (Critical red, High amber), Pending/In progress/Resolved and Open-not-resolved filters.
- Zoom-dependent 48-pixel Web Mercator grid groups nearby/overlapping saved points. Popup lists the actual authorized records; group position is a derived mean, not an asserted building coordinate.
- Popup/selected panel includes category, priority, status, date, bounded report summary and anonymous label; View grievance opens existing management. View linked incident uses the existing admin incident-detail/API workflow.
- Search geometry and grievance filters are separate. Geometry/selected building, selected grievance, view and zoom survive style changes because only TileLayer changes; the viewport is never keyed by style.
- ResizeObserver invalidates Leaflet's size after container resize and disconnects on unmount. Search/filter/style/pin controls are labelled buttons/inputs; keyboard users can pan/zoom and use the center-pin action. CSS adapts controls and attribution to narrow screens.

No synthetic heatmap was added. Accurate markers and overlap groups derive from actual saved/verified coordinates. New pins do not rewrite historical text locations or alter existing incident similarity rules.

## Backend, validation and privacy

`Grievance.mapLocation` is additive and optional:
```json
{"lat":18.464,"lng":73.868,"source":"user-selected"}
```
A known featureId may be added for a feature-derived representative point. The server determines source rather than trusting a submitted source label. Feature coordinates must match the representative point derived from that geometry within 0.000001 degrees; arbitrary clicks remain user-selected. Polygon/line representative points are bounding-box centers for navigation, not surveyed entrances/interior points.

POST /api/grievances accepts mapLocation alongside existing fields. It rejects non-finite/string/out-of-window coordinates and unknown/mismatched feature IDs before inserting a grievance. Map payload participates in new idempotency hashes; submissions without a map keep the legacy hash shape. Existing records are not backfilled or moved.

New **GET /api/grievances/map?limit=200&cursor=<id>**:
- Same cookie/session/current-account authentication as existing APIs.
- Student filter is always student=actor.userId; admin has existing campus-wide access.
- Explicit output allowlist: ID, bounded 500-character report summary, category, text location, priority, status, timestamp, anonymous flag, incident ID and optional saved point.
- No submitter name/user ID, history actor, attachments, filenames, evidence keys, signed URLs or private evidence metadata.
- Cursor pagination and private/no-store response. The client iterates pages, deduplicates and refreshes on socket status/new-report/reconnect or 30-second polling.
- Errors retain a useful warning instead of fabricating an empty successful feed. Student does not call the admin analytics API.
- Existing analytics hotspot counts remain; lat/lng are now null for unverified text locations. Other analytics fields and grievance/incident APIs remain intact.

Anonymous description content can still identify people; the map does not solve forensic anonymization. Tile providers see ordinary viewport/IP/origin information, not submitted report JSON. Do not put private data in tile URLs or attribution.

No migration/production writes were performed. The real database validation used only the guarded disposable replica-set runner and its temporary data.

## Files changed for this task

| Files | Purpose |
|---|---|
| src/components/CampusMap.tsx | Shared interactive explorer/radar, layers, filters, search, picker, popup navigation, tile fallback |
| src/components/LeafletViewport.tsx; src/lib/mapLifecycle.ts | Public effect-owned Leaflet container and testable cleanup |
| src/lib/campusMap.ts | Geometry helpers, finite/window validation, exact-name matching, filtering and screen clustering |
| src/data/vit-bibwewadi.geojson.json | Attributed 23-feature OSM snapshot with provenance |
| src/lib/mapTiles.ts; .env.example; next.config.js | Standard/satellite configuration, branding/CSP origins, optional failure behavior |
| src/components/GrievanceForm.tsx; src/app/student/page.tsx | Optional confirmed pin inside existing submission/workspace workflow |
| src/app/admin/page.tsx | Preserve both map usages and existing grievance/incident navigation |
| src/models/Grievance.ts; src/types/index.ts | Optional mapLocation and truthful nullable unverified analytics coordinates |
| src/app/api/grievances/route.ts; src/app/api/grievances/map/route.ts | Validated save, backward-compatible idempotency shape, authorized map projection |
| src/app/api/analytics/route.ts | Preserve counts without invented fallback coordinates |
| src/app/globals.css | Narrow-screen attribution and pin presentation |
| package.json; package-lock.json | Declare already-installed @react-leaflet/core directly, no forced major upgrades |
| tests/campus-map.test.cjs; tests/integration/workflows.test.cjs | Lifecycle, role rendering, geometry, filters, optional tiles, API scope/privacy, invalid pins and real disposable persistence |
| docs/CAMPUS_MAP.md | This report |

## Validation and remaining acceptance

Final results are recorded below. Unit lifecycle replay and stubbed component renders are not real React/DOM browser acceptance. A read-only inspection of the existing Chrome localhost:3000/admin tab found Internal Server Error before a map could be exercised. No form, account, server process or database was changed during that inspection. Authenticated map navigation, mobile/touch gestures, live OSM tile-failure simulation and licensed satellite delivery remain blocked/unverified. Use an isolated configured test app and restart its custom development server before manual acceptance; do not share a build output directory with a running development server.

| Check | Result |
|---|---|
| npm run typecheck | Passed on final source |
| npm run lint | Passed, zero warnings |
| npm test | 87 passed, zero failures/skips; 11 map-specific tests added |
| npm run test:local-integration | One real disposable MongoDB replica-set workflow passed, including saved pin persistence and unrelated-student/admin map scope |
| npm run build (default .next) | Compiled, then failed: Invariant: no direct app page entry found for /_not-found |
| NEXT_BUILD_DIR=.next-v2; npm run build | Final rerun passed; both portals and new /api/grievances/map route compiled |
| git diff --check / next.config.js syntax | Passed |
| Dependency tree | npm ls --depth=0 passed; existing core package declared directly |
| Browser map acceptance | Blocked: existing Chrome localhost:3000/admin shows Internal Server Error before map interaction |
| Live licensed satellite delivery / mobile devices | Not performed |

Logs are ignored local artifacts: test-results/campus-map-unit-final.tap, campus-map-integration.log, campus-map-build.log (default failure), campus-map-build-final.log (successful final build), and campus-map-dependencies.log. The successful build uses the existing documented Windows output-directory workaround; it does not prove the pre-existing running browser/server session is healthy.

The map-specific tests cover effect ownership replay/repeated cleanup, an executable reproduction of the old ref closure, OSM provenance/missing coordinates, coordinate/feature consistency validation, filtering/grouping, optional/invalid satellite configuration, role-aware map feed/privacy, unauthorized access, malformed pin submission, stable viewport ownership/Strict Mode configuration, and Student/Admin component rendering with Leaflet adapters stubbed. These are deliberately distinguished from real DOM/device acceptance.

Manual acceptance still required on an isolated test deployment:
1. Repeatedly open/close Student map and navigate Admin Overview/Campus Radar 20 times with Strict Mode enabled; navigate between signed-in portals and check console for initialization/unmounted-map errors.
2. Pick/drag/confirm/clear pins; submit a disposable report and verify coordinates after refresh. Move a confirmed pin and verify submission blocks until reconfirmation.
3. Search VIT Library, inspect unnamed building IDs and disused canteen warning; do not assume missing facilities exist.
4. Toggle all category/priority/status filters, inspect an overlap group and navigate to authorized grievance/incident.
5. Pan/zoom, select a building and report, switch styles and verify unchanged view/selections/filter values. Validate with an entitled MapTiler key; exercise missing, invalid and network-denied credentials.
6. Test 1440px desktop, 768px tablet, 390/360px mobile, keyboard/escape/dialog navigation, attribution/logo visibility and viewport resizing.
7. Deny street tiles in DevTools, verify geometry and controls remain with error/retry; restore access without remounting the map.
8. Use unrelated student/anonymous fixtures to confirm no cross-user or identity/evidence payload leakage. Legacy unmapped locations must never appear at a fallback center.

Limitations: incomplete community geometry; no indoor routing/geocoding/authoritative perimeter; per-mounted-map state survives style changes but is not saved across full route reloads; full authorized feed refresh cost scales with record count; screen grid is overlap grouping, not a statistical heatmap; satellite entitlement/terms and real browser/device acceptance remain external gates.
