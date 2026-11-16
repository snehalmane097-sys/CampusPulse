# Light/dark themes and Campus Radar data integration

## Diagnosis and behavior

The submission API previously saved classification routing (`department`) and an optional explicit `building`, but never saved `originDepartment`. The origin field was populated only by the separate Admin verification workflow. Radar had a building aggregate, but no department aggregate or department UI. Consequently, newly submitted reports could not contribute to origin-department reporting even when a student's account had a provisioned academic department. Routing and complaint text are not verified origin.

New student submissions now snapshot the authenticated account's provisioned `academicDepartment` into the existing `originDepartment` field. A request-body override is ignored. Accounts without that provisioned field remain unverified. Existing records are not backfilled. Admins can correct or clear report origins using the existing verified association workspace and audit workflow. No schema changes or production-data writes were made.

`GET /api/grievances/departments` groups all authorized matching grievance documents by their saved `originDepartment`, including a blank group displayed as **Not verified**. It returns total, Pending, In Progress, Resolved and High/Critical counts only. It does not group by incidents, routing, text, map coordinates, or the currently loaded page. Department choices retain all departments matching category/priority/status/date filters when one department is selected.

The shared filter parser now accepts an exact `originDepartment` filter. Both `/api/grievances/map` and `/api/buildings/analytics` use it. Building totals continue to use explicit building references. Department selection filters pins, building counts and authorized report drill-down together; it never creates building associations or pins. Approved names and geometry are preserved. Admin aggregate responses retain withdrawn building records for audit, while visible map markers remain approved only.

Radar loads every cursor page, deduplicates grievance IDs, rejects repeated cursors and ignores obsolete requests. It refreshes on new reports, status changes, association changes, socket reconnect, window focus, manual refresh and a 30-second polling fallback. Submission already increments the embedded map's refresh key. Old report/summary data is cleared when filters change, so a failed filter request cannot display the prior filter's totals. Errors remain visible.

Students are scoped to their own records on the server. Department responses contain aggregate fields only; map reports preserve the existing allowlist without student identifiers, evidence keys or private history. No association is inferred for legacy AIML text or location fields. A read-only live metadata audit was attempted using the MongoDB driver without model/index initialization; it timed out with `ETIMEOUT`. No live record counts or specific AIML records were verified.

## Themes

Light/dark RGB tokens live in `globals.css` and are consumed by Tailwind and runtime chart/map colors. Cards, inputs, dialogs, notifications, navigation and Leaflet controls/popups inherit the active tokens. Basemap imagery stays in its supplied style, preserving geographic legibility and attribution. The campus illustration is decorative artwork.

The toggle is on the landing and registration pages and the shared Student/Admin header. `cp_theme` stores an explicit choice; absent/invalid choices follow the OS preference and its subsequent changes. Other tabs synchronize via storage events. A small inline initialization script applies the theme before body rendering using the existing CSP; no security policy was relaxed. Storage failures fall back safely. Native color scheme and focus styles follow the theme.

## Affected files in this continuation

- `src/lib/theme.ts`, `src/components/ThemeToggle.tsx`: preference resolution, initialization, storage and OS synchronization.
- `src/lib/designTokens.ts`, `tailwind.config.ts`, `src/app/globals.css`: shared theme tokens and Leaflet styling.
- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/register/page.tsx`, `src/components/Navbar.tsx`, `src/components/Brand.tsx`: initialization and visible controls/surfaces.
- `src/components/AnalyticsCharts.tsx`, `src/components/CampusHub.tsx`, `src/components/CampusMap.tsx`: runtime colors, origin summaries/filtering and focus refresh.
- `src/app/api/grievances/route.ts`: authenticated profile origin snapshot for new student reports.
- `src/app/api/grievances/departments/route.ts`, `src/lib/buildings.ts`: aggregate API and shared exact-origin filter.
- `tests/theme-radar.test.cjs`, `tests/integration/workflows.test.cjs`: theme initialization, API scoping/allowlist and disposable end-to-end department/association regression cases.

## Validation and limitations

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: 118 discovered; **117 passed, 1 skipped, 0 failed**. The three new targeted theme/radar tests also passed when run separately.
- `npm run build`: **passed on the final source**, including production compilation, lint/type validation and all route generation.
- `git diff --check` and integration-test JavaScript syntax check: passed.
- `npm run test:local-integration`: **failed during disposable replica-set setup**, before tests ran: `connect EACCES 127.0.0.1:<ephemeral port>`. No real database fallback was attempted. The expanded integration assertions remain unverified here.
- Read-only live database metadata audit: unavailable (`ETIMEOUT`); no report content, identities or credentials were printed.
- Chrome headless exited with code `2147483651` and produced no DOM or usable browser output. Authenticated UI, evidence, map counts and desktop/tablet/mobile visual acceptance remain unverified.
- Application Insights investigation: no matching SDK/exporter or destination in application source/scripts; package-lock has an optional Next.js OpenTelemetry API peer, not an Application Insights exporter. No injected Node/OTEL/Application Insights environment variable names were found. The previous rejection did not reproduce in successful typecheck/lint/build commands. Its original emitter/payload remains unidentified; no security/approval settings were changed.

## Local acceptance

Run `npm run dev`, sign in with existing accounts, and toggle both themes on the landing page and each portal. Refresh, navigate, open a second tab and change OS preference with no saved `cp_theme`. Confirm readable forms, dialogs, charts, evidence controls, map popups and keyboard focus at desktop/tablet/mobile widths.

For a campus-authorized account that has a provisioned academic department, submit a report and confirm that department increases without inventing a building or pin. Accounts lacking that field should remain **Not verified**. Use the existing account department provisioning procedure when authorized; this change does not provision or alter any account itself.

Using disposable data, verify Admin assignment, reassignment and clearing change both affected building totals; verify Pending/In Progress/Resolved and priority/date filters, more than one report-feed page, and socket disconnect/poll/focus recovery. Cross-check each count against documents with the same filters. Confirm another student's session cannot view the report and anonymous responses contain no identity. Run `npm run test:local-integration` where loopback access is permitted to execute the expanded database assertions.

No commits, staging, pushes, branch changes, merges or deployments were performed.
