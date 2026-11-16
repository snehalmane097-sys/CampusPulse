# CampusPulse 2.0 post-map stabilization

11 November 2026. Branch: `feature/campuspulse-2.0`. No push, merge, deployment, production-data write or environment-secret edit was performed.

## Outcomes

- Original `http://localhost:3000/`, `/student` and `/admin` changed from HTTP 500 to **HTTP 200 HTML**.
- A clean **default .next production build passed with NEXT_BUILD_DIR unset**. The .next-v2 workaround is no longer needed for the normal npm build.
- Genuine browser checks passed on the isolated custom server at `http://localhost:3005`: landing page, Student sign-in/workspace, Admin sign-in/dashboard, both map mounts, repeated cleanup/navigation, library search and missing-satellite fallback.
- Authenticated checks used newly seeded synthetic accounts in a newly created disposable MongoDB replica set. Existing application/production data was not used for those checks.
- React Strict Mode, the Leaflet public cleanup bridge, current-account authorization, production preflight and security headers remain enabled.

## 1. Admin Internal Server Error — exact failure

Before corrections, terminal HTTP probes returned literal `Internal Server Error`, status 500, from all three pages, not just Admin. Loading the exact generated Admin server bundle in Node reproduced this stack:

```text
Error: Cannot find module './vendor-chunks/ws.js'
Require stack:
- <workspace>\.next\server\webpack-runtime.js
- <workspace>\.next\server\app\admin\page.js
```

Evidence is in `test-results/stabilization-bundle-error.log` and `stabilization-http-before-*.txt`. This is an actual terminal reproduction from the server bundle, not an inferred map exception. The original interactive terminal's stdout could not be retrieved through the terminal-reader tool; it is not presented as a captured original server log. New custom-server stdout/stderr was captured for the controlled recovery run.

The corrupted output mixed:
- development `eval-source-map` server files;
- a webpack runtime expecting development vendor chunks that no longer existed;
- production artifacts produced by next build in the same directory.

That module-loading failure occurs before Admin's client-side session check and before the client-only map mounts. Authentication's correct 401/403 responses are distinct from this 500. The previous Leaflet ref-replay bug was not the cause of the literal server-wide error; its earlier cleanup fix was preserved and exercised in the browser.

## 2. Default build invariant — independently investigated

The historical default build reached page-data collection and failed:

```text
Invariant: no direct app page entry found for /_not-found
```

The stale `.next/server/app-paths-manifest.json` contained only `/page`, `/admin/page` and `/student/page`, while a generated `server/app/_not-found/page.js` physically existed and production compilation had processed the API routes. This is a development on-demand manifest overwriting the production manifest, not a missing application-auth route or a campus-geometry defect.

Previously both the running development server and production next build used .next. NEXT_BUILD_DIR=.next-v2 happened to avoid that collision; it was not proof that the default source routes were invalid. Next's own documented configuration is phase-aware:
https://nextjs.org/docs/app/api-reference/config/next-config-js

The repaired production manifest has **36 app entries including /_not-found/page**. The production Admin bundle now loads successfully in Node. Subsequent HTTP probes of the original port left that production manifest unchanged.

### Separate Windows filesystem failure uncovered during cleanup

After archiving the mixed output, two normal clean attempts encountered EPERM creating generated directories, at different paths:

- .next/types/app/api/notifications/delivery
- .next/server/app/api/attachments/[attachmentId]

A direct normal mkdir of the missing directory succeeded. No permissions, ACLs, endpoint protection or security controls were changed. These are separately recorded filesystem errors, not silently relabelled as the /_not-found invariant. The exact Windows/filesystem internals behind the intermittent EPERM are not certified.

The supported npm build now runs a small prebuild preparation:
1. Resolve/validate a dedicated project-local .next or .next-<suffix> output; reject .next-dev, source directories, traversal, absolute paths and linked output.
2. Remove only that regenerable production output.
3. Create the generated route directory skeleton serially using the actual src/app page/route files.
4. Run the unchanged next build command without Next deleting that freshly prepared tree again.

This is a clean build, not retention of stale chunks. The clean default build then passed on this Windows workspace. Next owns and may delete its output; never store user data inside it:
https://nextjs.org/docs/app/api-reference/config/next-config-js/distDir

## Changes

| File | Change |
|---|---|
| scripts/next-output.cjs | One phase-aware output resolver: dev=.next-dev; production build/start=.next or explicit validated NEXT_BUILD_DIR |
| next.config.js | Use Next's documented phase argument; retain Strict Mode/security headers; preserve serially prepared production directory tree |
| scripts/prepare-build.cjs; package.json | npm prebuild safely cleans only generated production output and creates route directories serially |
| server.js | Explicit project dir, root-based env loading, output-mode diagnostics, visible request-handler exception logging and HTTP 500 handling |
| .gitignore; .env.example | Ignore .next-dev; document production-only override (no real environment file edited) |
| tsconfig.json | Include development generated types; exclude ignored test-results/.private-data artifacts from source discovery |
| tests/next-output.test.cjs | Phase isolation, override consistency, unsafe path rejection, security/Strict Mode retention and preparation scope/idempotency |
| tests/campus-map.test.cjs | Existing Strict Mode assertion adapted to phase-based configuration; Leaflet regression logic retained |
| scripts/acceptance-server.cjs | Repeatable custom-server harness that owns a disposable replica set, test accounts and generated test secret; never uses the real application URI |
| docs/VALIDATION.md; docs/CAMPUS_MAP.md; docs/OPERATIONS.md; docs/POST_IMPLEMENTATION_REVIEW.md | Current results and operational corrections, retaining earlier results as history |

Only the original .next generated directory was initially moved to ignored `test-results/stale-next-before-stabilization` for evidence. Its archived TypeScript validators were then discovered by the project's broad **/*.ts include; explicitly excluding test-results and .private-data fixes that generated-archive-only type error without excluding application source.

The runtime/data, evidence, feedback and UI implementations were not replaced. No production migration or index operation was run.

## Exact commands and actual results

Commands ran from the project root in PowerShell. No NEXT_BUILD_DIR override was needed for the final build.

```powershell
git branch --show-current
npm run typecheck
npm run lint
npm test
npm run test:local-integration
Remove-Item Env:NEXT_BUILD_DIR -ErrorAction SilentlyContinue
npm run build
node --check server.js
node --check scripts/next-output.cjs
node --check scripts/prepare-build.cjs
node --check scripts/acceptance-server.cjs
git diff --check
npm run preflight
```

| Check | Actual result |
|---|---|
| Branch | feature/campuspulse-2.0 |
| Typecheck / ESLint | Passed |
| npm test | **92 passed**, zero failures/skips |
| Real disposable MongoDB integration | One workflow passed, zero skips; evidence, feedback, reopening, map persistence/scope and notifications retained |
| Default production build | **Passed**, output .next, no NEXT_BUILD_DIR override; clean preparation ran |
| Custom server syntax / helper syntax | Passed |
| Whitespace check | Passed after trailing-newline cleanup |
| Production preflight | Correct expected refusal: missing HTTPS APP_ORIGIN and real S3/ClamAV/Resend settings; framework baseline passes |
| Deployment / external service certification | Not performed |

Controlled runtime startup:

```powershell
node scripts/acceptance-server.cjs
```

It starts a local replica set with database name `campuspulse_test_runtime_<random>`, injects its URI and a newly generated test-only secret into child-process environment, creates Runtime Student/Admin synthetic identities, and launches the **actual server.js** in development on port 3005. It does not change .env.local or use the application's existing MONGODB_URI. Runtime accounts are `student.runtime@example.invalid` and `admin.runtime@example.invalid`; their development-only fixture password is defined in the harness, not taken from existing credentials.

Captured startup:
```text
Disposable runtime database: campuspulse_test_runtime_<random>; URL: http://localhost:3005
CampusPulse development output: .next-dev
CampusPulse 2.0 ready at http://localhost:3005
```

HTTP page probes used Node fetch:
```powershell
@'
(async () => {
  for (const path of ['/', '/student', '/admin']) {
    const response = await fetch('http://localhost:3000' + path);
    console.log(path, response.status, (await response.text()).startsWith('<!DOCTYPE html>'));
  }
})();
'@ | node
```

Actual original-port recovery result: all three paths **200, true**. These are HTML shell checks, not a claim of authenticated access to existing user data on port 3000.

The controlled HTTP session smoke run on port 3005 also observed:
- POST login and GET auth/me 200 for each synthetic role;
- authorized GET grievances/map 200;
- student GET analytics 403; admin GET analytics 200;
- POST logout 200.

## Genuine browser scope

The in-app browser actually loaded http://localhost:3005/ and showed the sign-in page. It then:
1. Signed in as Runtime Student and visibly loaded /student with the report form, own-grievance area and Inbox.
2. Opened the campus explorer and repeated hide/reopen **five times** with Strict Mode enabled.
3. Signed out, signed in as Runtime Admin and visibly loaded /admin with KPI cards and all dashboard tabs.
4. Repeated Overview/Campus Radar navigation **five times**; both map usages mounted.
5. Searched VIT Library, selected its sourced feature and clicked Satellite without credentials; Standard remained available with the explanatory fallback and selected library panel.
6. Captured browser error logs: empty error list after these checks.

A browser navigation-wait call timed out once while transitioning to Admin; the following fresh observation showed the fully loaded Admin page, and later map checks succeeded. This is not omitted or counted as a failed server response.

Proof images (local ignored test artifacts):
- `test-results/stabilization-student.png`
- `test-results/stabilization-admin.png`

After acceptance, only the created disposable runtime harness was interrupted. Port 3005 was confirmed closed (ECONNREFUSED); the original port 3000 still returned 200 and the production manifest remained complete. Re-run the harness command for another isolated browser session.

This is baseline browser acceptance of the listed flows only. It is not comprehensive mobile/tablet, authenticated production-data, all feature/error-path, real S3/mail/ClamAV or licensed satellite acceptance. Those remaining gates in VALIDATION.md still apply.

## Operating the corrected app

Normal local development:
```powershell
npm run dev
# In a separate terminal, when processing is needed:
npm run worker
```

The custom server uses .next-dev automatically; do not set NEXT_BUILD_DIR to .next-dev. Normal production build:
```powershell
npm run build
```

This invokes prebuild. Do not substitute direct npx next build if relying on this Windows preparation. Explicit .next-v2 production output remains supported if chosen consistently for build and production startup, but is no longer required. Stop a production server using that same production output before replacing its files. Development can stay up during build because its output is separate; simultaneous dev servers sharing .next-dev are not the intended normal operating mode.

Actual production startup remains `npm start`, with existing preflight and real integration requirements. No production-start gate was bypassed to perform local acceptance.

## Evidence files

Ignored files under test-results:
- stabilization-bundle-error.log, stabilization-http-before-*.txt
- stale-next-before-stabilization/server/app-paths-manifest.json
- stabilization-build-default.log and stabilization-build-default-retry.log (recorded EPERM attempts)
- stabilization-build-default-final.log (clean default success)
- stabilization-typecheck.log, stabilization-lint.log, stabilization-unit-final.tap
- stabilization-integration.log
- stabilization-runtime-server.log / stabilization-runtime-launch.log
- stabilization-http-runtime.json
- stabilization-original-port-after.json / stabilization-original-pages-after.json
- stabilization-preflight.log, stabilization-admin.png, stabilization-student.png

Do not publish unsanitized service logs, cookies or credentials. Only synthetic test identities appear in the supplied browser proof.
