# Analytics and satellite investigation

Work performed on `feature/campuspulse-2.0`. No commit, push, merge, deployment, existing database writes or environment-secret edits were performed. Earlier project changes remain in the working tree.

## Blank charts: cause and fix

Recharts 2.12.7 resolved an old `react-is` detector that did not recognize Next.js App Router's React 19 elements or fragments. Although package.json declares React 18, Next 15.5.29 bundles React `19.2.0-canary-0bdb9206-20250818` for App Router. Direct runtime probes reproduced both failed detections. ResponsiveContainer checks its chart child with that detector before cloning it with measured width/height; the incompatible detector prevented dimension injection. This is an executable rendering compatibility defect, not evidence that the API returned empty data.

Pinned Recharts 2.15.4 (published peers include React 19) with a scoped `recharts -> react-is: 19.2.0` override. Installed runtime probes now recognize both elements and fragments. No forced dependencies, React upgrade or Leaflet lifecycle replacement. Recharts 2.x is deprecated upstream; a future 3.x migration remains separate work.

### Data flow

1. Admin load/refresh fetches authenticated `/api/analytics` alongside the grievance/incident feeds and sets the analytics state.
2. That route requires an admin session and reads `Grievance.find({})`. Distribution counts use JavaScript loops, not a Mongo aggregation pipeline, and have no date filter.
3. Model `category` becomes `{category,count}`; `priorityLabel` becomes `{priority,count}`. These include resolved records. Chart data keys already match these response fields.
4. The same response supplies the KPI total and both distributions. Each distribution must sum to total; active plus resolved must equal total. Critical-now excludes resolved grievances, whereas the priority pie includes them, so these two Critical metrics need not match.

Both chart types, colors and 220px height are preserved. Grid/ResponsiveContainer minimum widths are explicit. API-derived count summaries, truthful missing-label names, genuine empty states, invalid-data states and distribution/KPI mismatch warnings were added. Trend/location share the compatibility fix and empty/invalid states. No fallback counts or fabricated records are inserted into application charts.

The existing database read-only probe failed with `ETIMEOUT`; automatic collection/index creation was disabled and no writes were made. The reported 45-record population therefore has **not** been independently verified. A cached browser showed 15 reports; that is not treated as a current API response or acceptance proof.

The real route was tested against disposable MongoDB records: total 4, active 3, resolved 1, criticalActive 0; categories Electrical 2 / Network 1 / Plumbing 1; priorities Medium 2 / High 2. Both distributions summed to the same database/KPI total, 4. An initially empty database returned zero and empty distributions. These fixtures exist only inside the isolated integration runner.

## Satellite: configuration and behavior

The loaded local environment had none of `NEXT_PUBLIC_MAPTILER_KEY`, `NEXT_PUBLIC_SATELLITE_TILE_URL`, `NEXT_PUBLIC_SATELLITE_ATTRIBUTION`. The visible message was the intended missing-configuration fallback. No credentials were fabricated or changed, and live satellite delivery remains untested.

Privately add an authorized **browser-visible** MapTiler key to ignored `.env.local`:

```dotenv
NEXT_PUBLIC_MAPTILER_KEY=<your-authorized-MapTiler-browser-key>
```

Do not use private/server credentials or commit the value. Restrict the key to the actual development/deployment HTTP origins in MapTiler and verify Satellite entitlement/quota. Restart `npm run dev` after configuration. Production requires `npm run build` with the variable present, followed by the normal configured custom-server restart: public variables are embedded at build time, so changing only the running process environment does not update an existing client bundle.

The implementation constructs:

```text
https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=<URL-encoded-key>
```

Whitespace-only keys are now missing configuration. The existing MapTiler attribution/logo and OpenStreetMap attribution remain. Standard still uses `https://tile.openstreetmap.org/{z}/{x}/{y}.png` with OSM attribution.

Alternatively, the existing licensed custom-provider support requires **both** `NEXT_PUBLIC_SATELLITE_TILE_URL` (HTTPS Web Mercator XYZ containing `{z}`, `{x}`, `{y}`) and `NEXT_PUBLIC_SATELLITE_ATTRIBUTION`. Valid custom settings take precedence. Observe provider licensing/branding and required CSP origins; do not use unauthorized Google tile URLs.

Switching replaces only TileLayer, preserving map instance, viewport, building/report selection and filters. Missing configuration keeps Standard; tile errors return to Standard with an explicit message. Geometry, authorized markers, privacy checks, Strict Mode and effect-owned Leaflet cleanup remain unchanged. The missing-key message now gives Admin configuration/restart guidance and students administrator-contact guidance.

References: [MapTiler satellite raster tiles](https://docs.maptiler.com/schema-raster/satellite/), [Leaflet attribution/branding](https://docs.maptiler.com/leaflet/).

## Files changed for this investigation

| File | Purpose |
|---|---|
| package.json; package-lock.json | Compatible Recharts update and scoped detector override |
| src/lib/chartData.ts | Validation, labels, sums and population mismatch detection |
| src/components/AnalyticsCharts.tsx | Sizing, count summaries and empty/error states |
| src/app/admin/page.tsx | Pass KPI total; allow grid children to shrink |
| src/lib/mapTiles.ts | Trim optional key |
| src/components/CampusMap.tsx | Actionable missing-configuration guidance |
| tests/analytics-charts.test.cjs | Runtime detector regression, states, counts and tile URL construction |
| tests/integration/workflows.test.cjs | Real database/route distribution and KPI consistency |
| docs/ANALYTICS_AND_SATELLITE.md; docs/CAMPUS_MAP.md | Findings, setup and acceptance limits |

## Validation and limitations

- `npm run typecheck`: passed on final source.
- `npm run lint`: passed, zero warnings.
- `npm test`: 98 passed, zero failures/skips, including six new tests.
- `npm run test:local-integration`: one real disposable MongoDB workflow passed, zero skips, exit 0. Memory-server teardown emitted a nonfatal `MongoNetworkError: read ECONNRESET` after passing TAP output; retained in the log.
- `npm run build`: an earlier default `.next` build passed after the dependency/chart changes. The rerun after the final KPI-mismatch guard was blocked during compilation by automatic approval review because of an Azure Application Insights request. Retrying with `NEXT_TELEMETRY_DISABLED=1` was also blocked for the same stated reason. Consequently the **final-source production build is not verified**. Logs: `test-results/chart-fix-build-final.log`, `chart-fix-build-no-telemetry.log`. No telemetry approval or workaround was used.
- `npm run check:syntax`: passed.
- Production-only dependency audit: zero vulnerabilities at check time.

Ignored evidence under `test-results/`: `chart-runtime-compatibility.json`, `chart-existing-readonly-result.json`, `chart-integration-analytics.json`, `chart-fix-unit-final.tap`, integration/typecheck/lint/build logs and dependency/audit output.

The user stopped browser interaction with the physical Escape key. No post-fix browser chart, measured layout/console, Standard tile or satellite delivery acceptance is claimed. Server-render and detector tests do not establish SVG rendering in an actual measured browser container. Live licensed satellite delivery also requires credentials.

Remaining acceptance, with authorized accounts and disposable data:

1. Restart the application, open Admin Analytics, verify visible bars/pie sectors and no console/hydration errors. Compare summaries to that response's KPI total, including the reported 45-record population if still applicable.
2. Resize desktop/tablet/mobile and navigate away/back. Exercise genuine empty, malformed and mismatched responses without modifying production data.
3. Verify Standard tiles, configure an entitled origin-restricted key, restart/rebuild, and inspect successful Satellite tile responses and visible attribution/logo. Switch back while preserving view, filters and selections.
4. Deny satellite tile requests or use an invalid test key and verify explicit Standard fallback. Remove optional configuration, restart/rebuild and verify useful missing-key guidance. Do not commit credentials.
5. Resolve the build-time telemetry source or approve its disclosure after inspecting the payload, then rerun the final production build. Next.js telemetry disable alone did not prevent the request detected by automatic review; its actual emitting source/payload has not been established.
