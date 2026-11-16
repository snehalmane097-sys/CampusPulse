# CampusPulse visual refresh and focused Campus Radar

Implemented on `feature/campuspulse-2.0`, 15 November 2026. This is a presentation change over the existing Next.js/custom-server application. No database record, approved name, building reference, grievance, authentication rule, environment secret, API or model was changed/deleted to populate the design. No new package, migration, commit, push, merge or deployment was performed.

## Design direction

A light campus-technology identity replaces the previous dark teal/glass/radar appearance:

| Token | Colour / use |
|---|---|
| Canvas | #F5F6FA soft cloud |
| Surface / raised | #FFFFFF / #EEF1F7 |
| Primary | #4F46E5 indigo; hover #4038BE |
| Secondary | #326A96 muted blue |
| Accent | #A65332 restrained terracotta |
| Main / secondary text | #20283E / #626F85 |
| Pending | #8C5614 amber |
| In Progress | #495FAD blue |
| Resolved | #20765B green |
| Critical / errors | #AD344C rose |

`src/lib/designTokens.ts` is shared by Tailwind and charts. Existing ink/signal/ivory utility names remain compatibility aliases for the new surfaces/primary/text. The legacy glass-card class now renders a solid white surface with a subtle border/shadow, not a gradient. Shared buttons, inputs, keyboard focus, tables, dialogs, skeletons and map tooltips are updated centrally. Headings use Manrope, body text Inter, with local system fallbacks if web fonts cannot load. No new font service is introduced; the existing Google Fonts stylesheet URL is updated.

Text/primary-button and semantic badge contrast are checked automatically. Status labels include words/dots rather than relying on colour alone. The critical glow and active-status pulse were removed from badges. Reduced-motion support remains. Mobile navigation uses a compact brand and hides only the redundant role label at narrow widths; server-side roles/permissions are unchanged. Toast width is constrained within the mobile viewport.

## Public entry and portals

The landing page now pairs a concise hero, shared brand mark and subtle campus-inspired SVG artwork with one credential form and Student Login / Admin Login entry choices. The artwork is decorative, not a VIT footprint, campus map, heatmap or operational data display. The previous fabricated example block/hotspot display is removed. There are no mock grievance statistics in the landing page.

Login entry choice changes copy only. The form still posts email/password to the existing login endpoint and routes using the server-returned account role. It cannot create/provision Admin access. Registration remains the existing Student-only flow, with properly associated input labels and autocomplete hints. Authentication, cookie/session rules, logout and role checks are untouched.

Student workspace: a welcoming page heading, actual total/active counts from the existing API summary (loading values show an em dash), a wider desktop report/tracking layout, simpler complaint cards and one details action. The form, confirmed map pin, approved building selection, anonymous reporting, evidence upload, inbox, announcements, feedback and reopening remain. On tablet/mobile the two-column report/tracking layout stacks vertically.

Admin workspace: a consistent operations heading, white KPI surfaces, rounded navigation, clear feed cards and light-theme charts/tooltips. The simplified View Complaint workspace remains; there are no duplicated status buttons. Evidence review, internal investigation notes, origin verification/audit, feedback, reopening, incident links, analytics, notification preferences and announcements remain. Less common sections stay expandable. Shared styles also cover incident dialogs, early warnings, satisfaction tables and notification inboxes.

## Campus Radar cleanup and data safety

The shared CampusMap no longer imports/renders BuildingManager or its identification mode. There is no map action to create, rename or approve a building. The old editor component, protected backend APIs, MongoDB model and data remain intact for compatibility; the visible editor is removed, not the data.

Approved campus locations still come from `/api/buildings` and the existing `approvedCampusFeatures` logic. Unknown/draft/source-only names do not become selectable named locations. Grievance references and geometry are not rewritten. Counts still come from `/api/buildings/analytics`; authorized pins/drill-down still come from the existing paginated map feed. No inference from department/text/proximity is added.

Removed from the map: OSM-coverage/configuration paragraphs, technical source identification controls, legacy text-location analytics explanation, long category legend and lengthy count explanations. Attribution, provider logo, geometry and licence links on the actual map remain. The compact legend shows the existing building-count thresholds (0–4 / 5–9 / 10+) rather than mock counts. Search and refresh stay visible; useful category/priority/status/creation-date controls are in a compact Filter reports disclosure, with an Active indicator and Clear filters action. Closing it does not clear filter state. Building selection/count panel, authorized complaint details and minimal pin-confirmation help remain.

Standard/Satellite choices, missing-provider fallback and tile errors remain with concise user-facing messages. Configuration instructions remain in the existing documentation, not in Campus Radar. The existing effect-owned Leaflet container, public cleanup and React Strict Mode are unchanged; only TileLayer changes when switching style, so viewport, filters and selections remain intact. Satellite entitlement/configuration and live delivery are still separate acceptance checks.

## Changed files

New: `src/lib/designTokens.ts`; `src/components/Brand.tsx`, `PortalHeading.tsx`, `CampusIllustration.tsx`; `tests/visual-design.test.cjs`; this document.

Design/theme: `tailwind.config.ts`, `src/app/globals.css`, `src/app/layout.tsx`.

Pages: `src/app/page.tsx`, `register/page.tsx`, `student/page.tsx`, `admin/page.tsx`.

Shared UI: `Navbar.tsx`, `Badges.tsx`, `GrievanceCard.tsx`, `CampusMap.tsx`, `AnalyticsCharts.tsx`, `CampusHub.tsx`, `Dialog.tsx`, `EarlyWarningPanel.tsx`, `EvidencePanel.tsx`, `GrievanceDetailPanel.tsx`, `GrievanceForm.tsx`, `IncidentCard.tsx`, `IncidentDetailModal.tsx`, `NotificationCenter.tsx`, `ToastStack.tsx`, `BuildingAssociationPanel.tsx`, `BuildingManager.tsx`, `BuildingSelector.tsx`, `ComplaintStatusReview.tsx` under src/components. Most of these receive the consistent light-surface/border utilities; their actions and request handlers are preserved. Student card/date metadata remain available through the detail workspace.

Tests/docs: `tests/campus-map.test.cjs`, `tests/integration/workflows.test.cjs`, `docs/CAMPUS_MAP.md`, `docs/BUILDING_MANAGEMENT.md`, `docs/MAP_CLEANUP.md`, `ACCEPTANCE_TESTING.md`. Next.js regenerates next-env.d.ts during normal type generation; it is not manually edited.

## Validation and limitations

Automated coverage includes text/badge contrast, the two login entries sharing one form, Student-only registration labels/password rules, no fake landing hotspots, absence of building management from either map role, approved-name filtering, preserved map owner/attribution/feed/aggregation routes, and all existing map/privacy/workspace tests. Disposable MongoDB coverage additionally logs in both Student and Admin through the real credential route, checks HttpOnly sessions, ignores a client-supplied role override, rejects invalid credentials, and retains building persistence/count/status/ownership/evidence/feedback/reopening checks.

Logs remain ignored under test-results/design-*; browser profiles, if created, are private generated artifacts under .private-data/design-browser-*.

| Check | Actual result |
|---|---|
| npm test | Final complete suite: 115 passed, zero failures/skips. The stricter contrast test initially found two insufficient badge contrasts; their tokens were darkened and the suite rerun successfully. |
| npm run test:local-integration | Expanded real disposable MongoDB workflow passed, exit 0, no skips; includes actual Student/Admin login, invalid credentials and attempted role spoofing. The final run completed without the nonfatal teardown error seen in the earlier run. |
| PostCSS/Tailwind stylesheet compilation | Passed; this validates stylesheet compilation, not a full Next.js production build. |
| TypeScript | No diagnostics in the final typecheck log, but automatic review blocked completion for unidentified telemetry. Not certified as a final-source pass. |
| npm run lint | No diagnostics logged; completion blocked by the same automatic approval review. Not certified as passed. |
| TSX syntax / git diff --check | Passed for the final edited map/brand and whitespace checks. |
| Existing landing HTTP request | HTTP 200; response includes the new Small concerns hero. This is HTTP/SSR verification, not interactive browser acceptance. |
| Production build | Still blocked by the unresolved prior telemetry rejection; not retried through an unapproved disclosure or alternative wrapper. Not certified as passing. |
| Real browser/device workflows | Browser capture failed before producing a screenshot; interactive login, authenticated portals/map, desktop/tablet/mobile and live Satellite acceptance remain unverified. |

Browser attempt: used the existing Chrome executable without sandbox/security bypass flags against the public local landing route. The bounded capture process exited **-2147483645**, with no screenshot generated. This is not browser acceptance. The existing native helper had previously failed with **failed to launch codex app-server: program not found**. No usable desktop/tablet/mobile screenshot, interactive login, authenticated dashboard/map count or live Satellite acceptance was obtained. No original complaints were mutated for visual testing.

Telemetry investigation: installed Next.js 15.5.29 sends its own telemetry to telemetry.nextjs.org and honors NEXT_TELEMETRY_DISABLED. That differs from the unidentified Application Insights endpoint reported by automatic review. Earlier narrow project/dependency/script checks found no matching Application Insights dependency/injected NODE_OPTIONS; network-owner inspection was unavailable. This task attempted a deeper read-only JS/JSON source scan, but automatic review blocked completion of that scan too, for the same unknown telemetry request. Consequently the actual emitting process/payload remains unidentified. Final lint/typecheck completions were also blocked despite logs containing no diagnostics. No blocked operation was rerun via alternate wrappers and no security control was disabled. The previously rejected production build remains blocked/unverified; it was not retried through an unidentified telemetry disclosure.

Required remaining acceptance, using disposable test accounts/data:

1. Restore working trusted browser/build tooling or identify/disable optional telemetry at its actual source, then rerun typecheck/lint/build to completion without weakening approval/security checks.
2. Restart the development server in its own terminal (`npm run dev`) after config/font changes if hot reload does not refresh the theme. Do not kill unrelated Node processes. Refresh the public landing page at 1440px desktop, 820px tablet and 390/360px mobile; check focus, contrast, long text and overflow.
3. Test both login entry choices with actual assigned roles, invalid credentials, registration and logout. The entry choice must never elevate a Student account.
4. Verify Student submission, evidence upload, confirmed pin/building selection, complaint tracking, notifications, feedback/reopening and announcements at each viewport.
5. Verify Admin View Complaint, evidence review/rejection note, status/internal notes, origin verification/audit, incidents, charts and early warnings. Confirm no status buttons reappear on feed cards.
6. Inspect actual existing approved names and authorized counts against the API responses with all filters cleared, then apply filters and switch map styles. There must be no building editor, unknown-name chips, deleted association or fabricated point/count. Do not add new production buildings to test the cleanup.
