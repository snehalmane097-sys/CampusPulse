**Latest visual update:** [DESIGN_REFRESH.md](DESIGN_REFRESH.md) supersedes the older map-editor instructions below. Campus Radar now displays approved existing locations without any building-management/identification UI. Records, associations, geometry, APIs and model are preserved.

**Admin workspace update:** See [ADMIN_GRIEVANCE_UX.md](ADMIN_GRIEVANCE_UX.md) for the simplified cards/workspace, optional verified origin department, Admin-only audit display and internal investigation notes. The origin-save action is now **Save verified origin**.

# Approved map locations and existing-report associations

## Facility list root cause and cleanup

The previous map search used `admin || searchableFeature(...)`, so every OSM feature was eligible in Admin mode. Selecting a feature also opened the entire result list. The label helper fell back to original OSM names or "Awaiting campus identification". Draft building count circles were also visible to Admin outside the identification controls.

The public selector now uses `approvedCampusFeatures`: only persisted, approved, nonempty custom display names referencing existing OSM geometry qualify. Original source-only names and drafts are excluded for both roles. Search uses approved display name, code and custom category. Approved names remain selectable; no names are invented. Public tooltips and building indicators use approved names only.

All OSM features and attribution remain. Open **Manage campus buildings & facilities (Admin)** to enable the separate identification mode: its source dropdown and footprint tooltips still identify unnamed geometry by OSM ID so an Admin can configure it. Closing management hides those source-only interactions again. Student free pin selection remains independent and can still use an unidentified area without assigning a building.

## AIML investigation: confirmed code behavior and live-data limit

The attempted native MongoDB inspection disabled autoCreate/autoIndex, projected only category/department/location/building/pin/status/priority/date, and attempted no writes. Automatic approval review blocked completion because of an unidentified Visual Studio Application Insights telemetry request. No current AIML record fields/counts or current browser-selected filters were verified. Do not interpret this as proof that all current AIML records lack building IDs.

Confirmed from source:

- `department` is service routing inferred from grievance category, not an authoritative physical building. A department label, complaint mention or laboratory name is not a building association.
- The legacy classifier's location list contains Block A–D, Lab 1–4 and other legacy text locations; there is no AIML building identity mapping. It cannot establish physical identity from an AIML mention.
- `/api/buildings/analytics` matches actual `Grievance.building` ObjectIds against configured building records. An absent/null, dangling or differently linked reference does not contribute to the intended building. A pin or its OSM feature ID alone does not establish association.
- Students see only their own reports and approved metadata/counts. The main visible map now hides unapproved building labels and indicators for both roles.
- Category, final priority label, status and inclusive UTC report-creation date filters further narrow counts. Default filters are empty/all; current browser filter values were not inspected.
- Individual pin markers also require valid stored coordinates or an existing exact verified OSM text-location match. The absence of a pin and absence of a building association are distinct conditions.

This explains the possible exclusion paths without guessing which applies to the inaccessible live records. The Admin map now displays the actual number of matching loaded reports without a building reference. To diagnose a particular AIML report: clear map filters, open its existing grievance workspace, review its stored description/routing/location and association, verify the real physical building, then assign explicitly. No automatic department/text/coordinate reassignment was added and no existing database record was assigned by this task.

## Admin association workflow

1. Identify and approve the real physical building through Building Management first. Do not approve a footprint merely because its department name is AIML.
2. Open the existing grievance from Admin grievance management, or an authorized map popup when that report has a pin. Use the existing **Grievance workspace**.
3. In **Verified building association (Admin)**, search/select an approved building and enter a verification reason. Review the physical location yourself.
4. Click **Save verified building association**. An unassociated legacy report can now contribute to that building's filtered totals even without a pin. Refresh/reconnect/polling also updates the existing map.
5. To correct an association, choose another approved building and document why. To remove an unverified association, select **No verified building selected**, enter a reason, then **Clear building association**.
6. Concurrent edits return 409; reload/reopen the workspace before deciding again. A stale editor cannot silently overwrite another Admin's association.

`PATCH /api/grievances/[id]/building` requires an Admin session, existing cookie same-origin/CSRF checks and rate limits. JSON fields: `buildingId` (approved MongoDB ID or explicit null to clear), `expectedRevision` (nonnegative integer), and `reason` (3–1000 characters). Invalid/nonexistent/draft targets are rejected. The change, revision increment and internal audit record are committed in the existing MongoDB transaction. A same-target request is a no-op, not a duplicate audit entry. No bulk assignment endpoint or mass migration exists.

Database additions: optional/default-zero `Grievance.buildingRevision` and internal `BuildingAssignment` records with grievance, previous/new building, actor, reason, timestamp and unique grievance/revision index. Raw audit records are never populated into map or Student responses. Admin detail responses expose only a curated reason/time/origin-change history without actor or submitter identifiers. Status, department, category, incident linkage, resolution cycle, anonymous owner tracking, pin and original location remain unchanged. The existing additive migration includes the audit index; provision it through the reviewed operator migration process, not by production writes from this task.

After commit, `grievance:buildingChanged` emits only the grievance ID to Admin-room and the owning student's room. Map and detail-panel listeners refresh their authorized data. No identity, private evidence, reason or report text is added to the socket payload.

## Files and regression coverage

Added: `src/models/BuildingAssignment.ts`, `src/app/api/grievances/[id]/building/route.ts`, `src/components/BuildingAssociationPanel.tsx`, and this guide.

Updated: `src/lib/buildings.ts`, `src/components/CampusMap.tsx`, `src/components/BuildingManager.tsx`, `src/components/BuildingSelector.tsx`, `src/components/GrievanceDetailPanel.tsx`, `src/models/Grievance.ts`, `src/types/index.ts`, `scripts/migrate-v2.ts`, `tests/buildings.test.cjs`, `tests/integration/workflows.test.cjs`, `docs/BUILDING_MANAGEMENT.md`, `docs/CAMPUS_MAP.md`. The building metadata PATCH signature was also corrected to Next.js 15's Promise-only route params after generated route checks exposed the old union type.

Tests use guarded disposable MongoDB data only. Coverage includes source-only names/drafts excluded from the public selector, approved-name search, unidentified geometry retained, AIML text/department/pin without association excluded, Admin assignment causing the expected actual count increase, reassignment/clearing, legacy revision handling, stale/concurrent requests, no-op audit idempotency, rejected draft/missing IDs, role/CSRF checks, socket payload allowlisting, anonymous privacy and preservation of routing/status/location/pin. Existing map lifecycle/tile/pin and grievance workflow tests remain.

Browser acceptance and exact live AIML diagnostics remain unverified. The known unresolved telemetry source must be identified/disabled or its disclosure explicitly reviewed before retrying any operation blocked for that request. Do not retry through alternative wrappers or silently approve unknown payloads.

Validation results for this cleanup:

| Command/check | Result |
|---|---|
| npm run typecheck | Passed, confirmed exit 0, including generated dev/production route checks after correcting metadata PATCH params |
| npm run lint | Passed, confirmed exit 0 |
| npm test | 105 passed, zero failures/skips, confirmed exit 0 |
| npm run test:local-integration | Expanded real MongoDB workflow passed, confirmed exit 0; a nonfatal memory-server teardown ECONNRESET followed the passing TAP result and is retained in the log |
| git diff --check | Passed |
| Existing database read-only inspection | Completion blocked by automatic review for unidentified Application Insights telemetry; no live AIML findings certified |
| Production build/browser acceptance | Not rerun in this cleanup; the prior production-build telemetry blocker is unresolved, and no current browser acceptance is claimed |

Ignored logs: test-results/map-cleanup-typecheck-final.log, map-cleanup-lint.log, map-cleanup-unit.tap and map-cleanup-integration.log. No environment secret was changed, no original database record was assigned, and no commit, push, merge or branch switch was performed.
