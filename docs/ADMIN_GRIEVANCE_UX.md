# Admin complaint management: simplified workspace

Implemented on `feature/campuspulse-2.0`. No existing database records, credentials, campus geometry, stored counts or deployment configuration were changed to populate the UI. No dependency was added. No commit, push, merge or deployment was performed.

## Interface

The Admin Live Feed uses a dedicated AdminGrievanceCard. It shows a title taken from the first line of the original description (truncated to 110 characters), priority, category, current status, verified origin department/building and one **View Complaint** button. It does not generate titles with AI or alter stored descriptions. Repeated status buttons, routing pills, relative timestamps, similar-report metadata and priority explanation toggles were removed from the main card. The existing Student GrievanceCard remains unchanged.

The complaint workspace presents:

1. **Complaint details:** full description, submission date, priority/category, status and explicit origin. Unknown/unverified origin is **Not verified**.
2. **Evidence:** immediately follows details. Available images have inline lazy previews; PDFs/videos retain controlled previews and Open file links. File name, MIME type, size, malware scan result, review state and review note are visible. Pending review / Accepted / Rejected are separate from the security verdict. Development-unscanned files explicitly say they were not scanned. Reject is disabled without a note, and the existing backend also enforces rejection reasons. Upload/remove/cancel remain; Admin upload controls are expandable. No unprocessed file is given a preview control, and all bytes still pass through the authorized access endpoint and its production scanner checks.
3. **Complaint status and review:** one status selector and one Save complaint update action, with an optional investigation/update note. Resolved status stays locked behind the existing reopening approval workflow; a note can still be added without changing resolution time or cycle.

Expandable secondary sections retain origin verification, feedback, reopening decisions, status history/investigation notes, origin verification audit, resolution routing, incident navigation and priority reasons. Pending reopening requests expand automatically. Students retain their existing upload, resolution-feedback and reopening actions; feedback/reopening sections are open for them. No status-edit control is exposed to Students.

Cards use a single-column mobile layout and a compact two-column origin layout at larger sizes. Long descriptions/origin labels wrap. Evidence media has bounded height/full available width. The existing accessible dialog, close behavior and CampusPulse colors remain. Real device/browser visual acceptance is still required; responsive classes and SSR output are not a browser acceptance claim.

## Origin integrity

The existing Grievance.department is a **resolution routing department**, not proof of where a complaint originated. User.academicDepartment also has no verification provenance suitable for silently labeling every historical complaint. Neither field, complaint text nor location/pin is used as an origin fallback.

The existing Admin origin/building verification endpoint now accepts optional `originDepartment` (1–120 trimmed characters, or null/empty to clear). Omission preserves the existing value for older clients. The Admin must explicitly verify it and supply the existing mandatory verification reason. It uses the same revision, transaction and internal assignment audit as the building association. Students cannot set it through registration, report submission or this protected endpoint. There is no automatic backfill or per-department building inference.

The shared `withVerifiedOrigins` projection resolves approved building names by saved ObjectId, in a batched lookup, and supplies a small `origin` DTO to feed, detail and authorized map responses. Unknown, withdrawn or missing building metadata yields null and the UI renders Not verified. Card, workspace and Campus Radar therefore use the same approved name, including renames on refresh. Socket origin-change events refresh the Admin feed as well as the map/detail panels. Existing anonymity and ownership checks stay in place.

In **Verify complaint origin**, Admins can identify/correct/clear the building and independently enter/clear the verified origin department. This does not alter routing, status, incident clustering, pins or report text. The Admin-only verification audit shows previous/current building names and departments, reason, time and revision; actor IDs and submitter identity are never added. Historical names resolve against current building metadata; absent records display Unavailable building.

## Notes, history and authorization

The existing `PATCH /api/grievances/[id]` accepts optional `note` (up to 2000 characters) and optional `expectedVersion`. Existing status-only clients still work. Status transitions reuse `transition`, including incident synchronization, resolution cycles and notifications. Same-status notes append history without resetting resolvedAt, changing cycle or creating another status notification. The updated workspace supplies a version to reject stale updates with 409.

Investigation notes are internal to Admin. Both Student list/detail responses strip note and actor fields from status history; idempotent submission replay responses are sanitized too. Status/date history remains available to owners. Audit reasons/history are returned only in an Admin-authorized detail response using an explicit allowlist, never in map payloads or socket events. No new note endpoint or duplicate status/review service was created. Existing evidence authorization, quarantine/access checks, range streaming, safe anonymous filenames, feedback and reopening rules remain.

Additive schema fields: Grievance.originDepartment; history.previousStatus/note; BuildingAssignment.previousDepartment/department. Existing rows remain unknown and are not updated. Existing audit revision/index and migration workflow remain; no new index or destructive migration is needed for these fields. Production operators should continue the existing reviewed additive index provisioning process before enabling the underlying building workflow.

Restart the existing development server once before testing these new schema fields (`npm run dev` after stopping that server in its own terminal). Mongoose caches compiled models in the running custom Node.js process; frontend hot reload alone may keep the older schema and omit new note/origin fields. Do not kill unrelated Node processes or alter existing database rows to work around a cached schema.

## Files

Added: src/components/AdminGrievanceCard.tsx, ComplaintDetails.tsx, ComplaintStatusReview.tsx; src/lib/complaintPresentation.ts, evidencePresentation.ts; src/services/complaintOrigin.ts; tests/admin-ux.test.cjs; this guide.

Updated: src/app/admin/page.tsx; src/components/GrievanceDetailPanel.tsx, EvidencePanel.tsx, BuildingAssociationPanel.tsx, CampusMap.tsx; src/app/api/grievances/route.ts, [id]/route.ts, [id]/building/route.ts, map/route.ts; src/models/Grievance.ts, BuildingAssignment.ts; src/lib/sanitize.ts, campusMap.ts; src/types/index.ts; src/services/lifecycle.ts; tests/integration/workflows.test.cjs; related acceptance/map documentation. Next.js regenerates next-env.d.ts during the existing type-generation command; it was not manually edited.

## Validation and remaining blockers

Automated tests cover the one-action card, full description/detail, verified-only origin labels, truthful scan/review labels, one status selector, resolved status lock, Student internal-note stripping, real persisted origin and approved name consistency across feed/detail/map, Admin-only verification audit, evidence rejection without a note, unauthorized review, accepted/rejected persistence, same-status notes, stale versions, resolution timestamp/cycle integrity, incident/status workflow, feedback/reopening, and existing Student workflows against disposable MongoDB data. No test fixture data was inserted into the configured real database.

Logs are ignored under test-results/admin-ux-*.

| Validation | Actual result |
|---|---|
| npm run typecheck | Passed; route type generation and TypeScript returned exit 0 |
| npm test | 111 passed, no failures/skips, exit 0; six new UI/presentation/privacy regression tests |
| npm run test:local-integration | Expanded real disposable MongoDB workflow passed, no skips, exit 0 |
| npm run lint | Final log has no diagnostics, but automatic approval review blocked completion for the unidentified outbound Application Insights request. Not certified as passed. |
| git diff --check | Passed |
| Production build | Not rerun through the unresolved prior telemetry rejection; blocked/unverified, not counted as a successful build |
| Real browser / desktop/mobile / evidence media acceptance | Attempted but blocked by missing browser-helper app-server and unavailable Playwright. Not performed or passed. |

Production build blocker investigation:

- Earlier builds were rejected by automatic approval review for an unidentified Visual Studio Application Insights request. Build permission is not approval for external project/environment telemetry disclosure.
- Inspected the actual installed Next.js 15.5.29 source: dist/telemetry/post-telemetry-payload.js targets https://telemetry.nextjs.org/api/v1/record. dist/telemetry/storage.js honors NEXT_TELEMETRY_DISABLED. This is a different destination from the reported Azure/Visual Studio endpoint, so changing Next.js telemetry again would not establish that emitter's identity.
- No Application Insights/Visual Studio telemetry dependency or matching project script was found in package-lock.json/server/scripts. No NODE_OPTIONS, Application Insights or instrumentation environment variable was present. The installed npm.ps1 entry point uses the standard Node/npm CLI launcher. No Code process/path was returned by the attempted narrow process inspection. Read-only network ownership inspection failed with MethodInvocationException in this environment.
- The actual emitting process/payload could not be established. The previously rejected build has **not** been retried through a wrapper/alternate tool or by weakening security. Production build remains blocked/unverified until the source is identified and optional telemetry disabled there, or a known destination/payload is explicitly approved. No global telemetry or security setting was changed.

Browser verification attempt:

- Read the installed Windows computer-use documentation and initialized its supported @oai/sky entry point. The first app inventory failed: **failed to launch codex app-server: program not found**. No browser clicks, uploads, status edits or production-data changes were performed.
- Playwright/Puppeteer were unavailable in the project; a supported runtime Playwright import also failed. No new browser automation package was installed and no private helper protocol was used.
- Therefore real-browser evidence review, Admin/Student workflow, desktop/mobile layout, PDF/video previews and accessibility focus acceptance are **not passed**. API integration and server-render tests are distinguished from these checks.

## Manual acceptance when tooling is restored

Use an isolated disposable test environment and test accounts, never real complaint data for acceptance mutations.

1. Open Admin Live Feed at desktop width and 390px mobile width. Verify each card has title, priority/category, origin values or Not verified, status and only View Complaint. Long names wrap and the action is reachable by keyboard.
2. Open View Complaint. Verify the full source description/date/details, then Evidence directly below. Expand secondary sections and close/reopen the dialog; check focus and scrolling.
3. Upload disposable PNG/PDF/MP4 through a test Student account. After the configured security processing, open/preview each as Admin. Confirm MIME and scan status. Development mode must explicitly show Not scanned; no real malware-scanner acceptance is claimed without ClamAV.
4. Confirm Reject is disabled without a note. Add a note and reject; reload and verify Rejected plus note. Accept another item and verify Accepted. Check unprocessed/blocked evidence has no usable access. Confirm unrelated Students cannot read files.
5. Save an investigation note while keeping status unchanged, then change Pending to In Progress and Resolved with notes. Check chronological history/previous status and unchanged resolution date/cycle on a later note. Try a stale second editor; expect 409. Confirm the owner sees status history but no internal note/actor IDs.
6. Expand Verify complaint origin. Explicitly verify an approved building and origin department with reason. Reload and compare feed, detail and Campus Radar names. Confirm resolution routing remains separately labeled and unchanged. Rename/withdraw a building and verify refreshed labels. Review the Admin-only origin audit; Students must not receive it.
7. Verify linked incident navigation, rating/written feedback, reopening request and Admin decision, Student uploads and logout still work. Test empty/error states, invalid sessions, denied evidence and keyboard navigation at desktop/tablet/mobile widths.
