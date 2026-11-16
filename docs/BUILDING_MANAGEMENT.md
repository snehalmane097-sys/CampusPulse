**Latest visual update:** [DESIGN_REFRESH.md](DESIGN_REFRESH.md) supersedes the older map-editor instructions below. Campus Radar now displays approved existing locations without any building-management/identification UI. Records, associations, geometry, APIs and model are preserved.

# Campus building names and grievance indicators

Implemented on `feature/campuspulse-2.0`, 15 November 2026. No production data, environment values, OSM geometry or source tags were changed. No names, mappings or grievance associations were seeded into the existing database. Test fixture names exist only in disposable tests.

## Design and database changes

`CampusBuilding` stores a MongoDB ID, immutable `featureId` referencing an existing OSM feature, unique display name, normalized unique name key, optional code/description, category, approval state and an optimistic edit revision. Geometry and OSM source attribution stay in the existing GeoJSON snapshot. Only non-campus features in that snapshot can be configured; this also supports mapped entrances, paths and facilities without inventing new geometry. Names are unique after trim, Unicode NFKC normalization and case folding. Codes are optional, not unique identifiers.

Grievance adds an optional `building` ObjectId reference. Submission accepts `buildingId`, validates it against an approved persisted building inside the existing grievance transaction, and includes it in the idempotency fingerprint. The pin is independent. No proximity, text classification, OSM feature pin, centroid or existing location string creates an association. Renaming/withdrawing approval preserves the MongoDB ID, OSM ID and historical associations. There is no destructive delete endpoint or automatic legacy backfill.

Additive indexes: unique featureId, unique normalized name, approval/name listing, and grievance building/creation-date/status/priority. The existing additive migration includes CampusBuilding; it does not seed names or associate existing records. Production disables automatic index creation, so the operator must provision these indexes through the existing reviewed migration process before enabling writes. No migration was applied by this task.

## Admin setup and workflow

1. Use the existing Node.js 22+ / MongoDB replica-set setup and environment configuration from OPERATIONS.md. No new package, external credential or environment variable is needed for building management. Existing Satellite configuration is unchanged.
2. On an isolated test environment, provision indexes using the existing migration process. Review/back up before applying any migration in a real environment. For a read-only inspection, set `MIGRATION_READ_ONLY=true` before `npm run migrate`; the apply step remains an operator action, not performed here.
3. Start the app with `npm run dev`, sign in as Admin and open Campus Radar (or the existing Overview map).
4. Open **Manage campus buildings & facilities (Admin)** below the map. Choose a source feature from the list or click its footprint on the map. Selecting from the list centers the existing map on that geometry. Source IDs are intentionally visible in this Admin identification workflow.
5. Verify the footprint yourself against the real campus. Enter a unique display name, optional code and description, and category (Academic, Laboratory, Administration, Canteen, Library, Sports, Other).
6. Leave approval unchecked to save a draft, or check **Approve for student selection and custom map labels** after identification. Click **Add building name**. Reload the page to verify persistence.
7. Select a configured feature to rename/edit it. Click **Save building changes**. Concurrent stale saves return 409; refresh map data to load the current revision. Polling unchanged records does not erase an unsaved edit.
8. Uncheck approval and save to withdraw the custom name/list entry from students. Existing records remain associated for Admin reporting. Students still retain access to their own grievances; no other student's counts become visible.

The public facility selector and map labels now include only approved custom names, for both roles. No source-only names or unidentified-feature chips are shown. Underlying geometry is retained. Unnamed source IDs remain selectable only through the separate Admin identification workflow. See [MAP_CLEANUP.md](MAP_CLEANUP.md) for the cleanup, live AIML diagnostic limits and the Admin workflow for associating existing reports.

## Student submission

The existing **Report an issue** form now includes **Campus building / facility (optional)**. Search by approved name, code or category, then select the identified facility. Keep the existing map pin workflow if desired: place/move and confirm the pin separately. Submit through the existing grievance/evidence flow, including anonymous reports. Leaving the building blank preserves legacy behavior. An unapproved/missing ID is rejected, without silently choosing a nearby building. If no buildings have been approved, the form explains this and still permits normal submission and optional pins.

## Counts and privacy

- `/api/buildings`: authenticated GET returns approved metadata to students and all metadata to Admin. Admin-only POST creates a record. Names/IDs/geometry are validated and duplicate names or footprints return 409.
- `/api/buildings/[id]`: Admin-only PATCH with revision; immutable source/geometry edits are rejected. Existing cookie sessions, CSRF/same-origin enforcement, rate limits and safe error responses are reused.
- `/api/buildings/analytics`: authenticated server-side MongoDB aggregation. Admin sees authorized campus counts; students see only their own reports for approved buildings. The response contains building IDs and counts/category breakdown only, with no report text, student identity, contact, evidence, attachment metadata or actor history. Responses are private/no-store.
- `/api/grievances/map`: existing paginated allowlisted feed, now with optional building ID and category/priority/status/from/to filters. Student ownership scope cannot be overridden by query parameters. Grievance detail navigation continues through existing authorization. Anonymous submitter identity is never added to map responses.

The map uses the same filters for summaries and report drill-down. Dates are inclusive UTC calendar days applied to report creation time, not resolution time. Bad values or reversed ranges return 400. All statuses include resolved reports; the existing **Open (not resolved)** filter includes Pending and In Progress. In the detail panel, **Open** means Pending, **In progress** is separate, **High / critical** includes High and Critical regardless of status. Category counts sum to the filtered total. Counts update on grievance socket events, reconnect, manual refresh and 30-second polling. Metadata edits trigger an immediate local reload and reach other mounted clients by polling. Counts/feed are separate read requests, so concurrent submissions can briefly change their populations between requests; refresh reconciles them.

Indicators use representative points derived from the existing geometry only for display, never association. Green means 0–4 matching reports, amber 5–9, red 10+; circle size increases with the count. Zero-count markers appear at close zoom; names appear at zoom 18+. Clicking a footprint or indicator opens the name/metadata and total, Pending, In Progress, Resolved, High/Critical and category counts. **View associated grievances** shows only authorized matching reports. Student counts are explicitly labeled as their own. Individual category-colored pin clusters remain alongside these building indicators. This is a count visualization, not a coordinate density estimate.

The effect-owned Leaflet container, Strict Mode, Standard/Satellite switcher, attribution/logo, saved pins, marker privacy, search and existing grievance workflows remain. Switching tile style does not remount the map or clear the new date filters/selected building. No extra packages were installed.

## Footprints needing actual identification

These existing unnamed polygons require your real names/mappings; no academic identity is assumed:

| Source ID | Existing source category | Source |
|---|---|---|
| way/223964767 | building | https://www.openstreetmap.org/way/223964767 |
| way/223964769 | building | https://www.openstreetmap.org/way/223964769 |
| way/223964770 | building | https://www.openstreetmap.org/way/223964770 |
| way/223964773 | building | https://www.openstreetmap.org/way/223964773 |
| way/223964768 | other mapped polygon; identity unknown | https://www.openstreetmap.org/way/223964768 |

Other unnamed mapped features may be identified if useful: node/2328024918 (path), node/11166456994 (entrance), and paths way/223964771, way/223964774, way/223964775, way/223964777, way/1117770840, way/1117770841, way/1371960983, way/1371963697, way/1371963803, way/1371963804, way/1372283734. These are not assumed to be buildings.

Already named OSM features include VIT Library (node/11832252014), VIT Play Ground (way/223964778), VIT Canteen (way/1371963261) and VIT Fruit Canteen (way/1371963468). Names come from the existing snapshot, not this implementation. The existing canteen description warns about disused source tagging; verify current identity/status before approving it. No new footprint or boundary was fetched or fabricated. The campus outline remains community data, not an official surveyed boundary.

## Regression validation and manual acceptance

Files added: `src/models/CampusBuilding.ts`, `src/lib/buildings.ts`, `src/app/api/buildings/route.ts`, `src/app/api/buildings/[id]/route.ts`, `src/app/api/buildings/analytics/route.ts`, `src/components/BuildingManager.tsx`, `src/components/BuildingSelector.tsx`, `tests/buildings.test.cjs`, and this document.

Files updated: `src/models/Grievance.ts`, `src/types/index.ts`, `src/lib/campusMap.ts`, `src/app/api/grievances/route.ts`, `src/app/api/grievances/map/route.ts`, `src/components/GrievanceForm.tsx`, `src/components/CampusMap.tsx`, `scripts/migrate-v2.ts`, `tests/integration/workflows.test.cjs`, `docs/CAMPUS_MAP.md`. Next.js also regenerates its existing `next-env.d.ts` during type generation; no manual declaration changes were made. CampusHub and Admin dashboard need no direct edits because both existing Admin map placements use the enhanced shared component.

Tests cover source ID/input validation, neutral/searchable labels, draft approval, date/filter validation, unauthenticated and non-admin access, persisted rename, unique names/footprints, optimistic concurrency, immutable geometry, anonymous explicit building submission, rejected missing/draft IDs, idempotency content changes, no automatic pin association, aggregation totals versus MongoDB, role scope, filtered totals, status changes, private map projections and withdrawal without deletion. Existing lifecycle, Strict Mode, tile switching/configuration, pin validation and submission tests remain in the full suite.

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:local-integration`, `npm run build`. Integration fixtures run only in a guarded disposable `campuspulse_test_*` MongoDB replica set, never the configured real database. Logs are ignored under test-results/buildings-*.

Validation results:

| Check | Actual result |
|---|---|
| npm run typecheck | Passed, including Next.js 15.5.29 route type generation |
| npm run lint | No diagnostics in the log, but completion was blocked by automatic approval review for an unidentified outbound Application Insights request. Final exit status is not verified; not counted as a pass. |
| npm test | 103 passed, zero failures/skips (five new building regression tests) |
| npm run test:local-integration | Expanded real MongoDB replica-set workflow passed, zero skips, exit 0 |
| npm run build with NEXT_TELEMETRY_DISABLED=1 | Blocked during compilation by automatic approval review: outbound Application Insights request to an unverified endpoint with unidentified payload; build authorization does not authorize possible project/environment metadata disclosure. No workaround or further telemetry retry used. Final production build is not verified. |

The earlier integration run emitted a nonfatal MongoMemoryServer teardown ECONNRESET after passing TAP results. The final integration log contains the passing workflow without that teardown error. Build logs retain the compilation attempt; automatic-review rejections are recorded here because they are tool-level blocks rather than compiler/linter diagnostics. Typecheck, the final 103-test suite and final integration workflow all returned confirmed exit code 0. Resolving the emitting source/payload or an explicit reviewed disclosure approval is required before another lint/build attempt. No retry through an alternate tool, command wrapper or telemetry workaround was made after rejection.

Manual acceptance still required in a real browser: configure a disposable real mapping, reload, search as Student, submit with both pin and building, inspect count and status transitions, pan/zoom and switch tile styles, and resize desktop/tablet/mobile. No browser acceptance or live Satellite delivery is claimed by unit/integration tests. Satellite still requires an authorized configured provider key.

Limitations: actual identities need your verification; no indoor/floor geometry or invented areas; reports without explicit associations are excluded from building totals until an authorized Admin verifies/assigns them through the grievance workspace; no bulk automatic reassignment or destructive building deletion; current map still loads the full authorized paginated feed for drill-down, so large datasets may require a dedicated server-paginated panel later. Withdrawing approval hides public custom labels/indicators but preserves historical associations and student access to their own reports. Metadata refresh is polling-backed; report association changes also emit a privacy-scoped socket refresh event.
