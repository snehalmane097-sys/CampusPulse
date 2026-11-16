# CampusPulse 2.0 validation

Branch: `feature/campuspulse-2.0`. Reviewed 10 November 2026. No main checkout, commit, push, merge or deployment was performed. Changes remain in the working tree. No production database migration or destructive live database operation was performed.

Latest update (11 November 2026): [post-map stabilization](STABILIZATION.md) passed the default .next production build, typecheck, lint, 92 unit/route/render tests and the disposable MongoDB integration. Original localhost:3000 page routes now return 200; Student/Admin browser checks passed on the isolated port-3005 custom server with synthetic accounts. Real external-service and comprehensive acceptance gates remain open.

This report supersedes the initial implementation results (which had an unavailable registry, Next.js 14.2.5 and skipped database checks). Registry access returned during review. A clean-install attempt hit an npm registry timeout and left dependencies incomplete; a subsequent normal install repaired the tree. No forced or legacy-peer installation was used.

## Scope and review fixes

Both Student and Admin evidence workflows, persistent inbox/read tracking, announcements/preferences/email jobs, resolution-cycle feedback/reopening, transaction/outbox handling, authentication/socket boundaries, migration/index behavior and dashboard integrations were reviewed.

[POST_IMPLEMENTATION_REVIEW.md](POST_IMPLEMENTATION_REVIEW.md) records the review findings, pre-fix severity/impact, affected files/functions and regression coverage. Corrections include atomic evidence deletion/expiration, worker lease fencing and durable clean-candidate recovery, fail-closed scanner handling, production scan gating, session switching/logout, stale email suppression, transactional fanout/reopening results, concurrent incident clustering, idempotency-content conflicts, missing-only migration backfill, pagination/stale responses and legacy ownerless records. Existing dashboard styling and existing classification, voice, map, priority and analytics functionality are retained.

## Review checks (10 November 2026)

| Check | Confirmed result |
|---|---|
| Branch | feature/campuspulse-2.0 |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed; real ESLint Next/core-web-vitals and React hooks rules, zero warnings |
| `npm run check:syntax` | Passed; separate TypeScript source syntax check |
| `npm test` | 76 passed, zero failed/skipped/cancelled |
| `npm run test:local-integration` | One comprehensive real MongoDB replica-set workflow passed, zero failed/skipped |
| `$env:NEXT_BUILD_DIR='.next-v2'; npm run build` | Passed; Next.js 15.5.29 optimized build, both portals and all 30 API route files |
| Node syntax checks | server.js and all scripts/*.js, *.cjs, *.mjs passed |
| `git diff --check` | Passed; Windows line-ending normalization notices only |
| `npm ls --all --json` | Passed; no invalid dependency problems |
| Package/lock declarations | Direct dependencies agree; installed tree checked |
| `npm audit --omit=dev` | Zero vulnerabilities |
| Full `npm audit` | Six moderate development-only findings; zero high/critical |
| `npm run preflight` | Correctly fails for missing production settings; framework baseline now passes |
| External S3, Resend, real ClamAV | Not tested; no external success claimed |
| Authenticated browser/responsive/staging socket acceptance | Not performed; render/code checks do not replace browser acceptance |
| Authored GitHub Actions workflow | Not executed here |

Ignored local evidence: `test-results/review-unit.tap`, `review-integration.log`, `review-build.log`, `review-preflight.log`, `review-audit.json`, `review-audit-production.json`, and `review-dependency-tree.json`.

The disposable integration runner downloads MongoDB 7.0.14 into ignored `.private-data/test-mongo-binaries`, creates its own single-node replica set, and supplies a random `campuspulse_test_*` database. The suite guards the database name, drops only that disposable database before/after, and stops the replica. It never uses the application MONGODB_URI. It passed concurrent clustering, anonymous ownership denial, resolution/duplicate feedback, conflicting reopening decisions, private local evidence upload/processing/review/deletion denial, targeted announcement deduplication/read isolation, satisfaction and session revocation. Repeated backfill preserves disabled and email-opt-out flags; matching idempotent submissions reuse an ID and changed content gets 409.

Unit/adapter tests include an actual loopback ClamAV protocol fixture and in-process failure fixtures. These exercise the transport, not a maintained ClamAV daemon. Development scanning marks records development-unscanned; it is not certified malware scanning. S3 signature/policy and email-provider doubles are not real service checks.

## Framework and dependency outcome

Installed exact runtime versions: Next.js 15.5.29, React/React DOM 18.3.1, Mongoose 8.24.8, Socket.IO/server and client 4.8.4, PostCSS 8.5.32. Selection used published registry versions/peer/engine metadata and upstream security release/support policy. React/Leaflet majors were preserved; the upgraded build passed. See the review report for sources and compatibility limits. Recheck advisories at deployment time.

The six moderate findings trace to `@typescript-eslint/typescript-estree -> minimatch 10.2.6` (GHSA-g3hv-75wg-m249: globparts amplification denial of service). The registry reports parser 8.72.2 as current; estree requires minimatch ^10.2.2. A normal `npm audit fix` left the findings unchanged. The advisory's fixed boundary is 11.0.1; overriding to it would cross the declared major range, so it was not forced. These findings affect development lint tooling; the production-only audit is clean. Recheck the upstream compatible fix, retain the tracked advisory and avoid linting untrusted generated project input until resolved.

## Remaining gates and exact next steps

1. Reproduce `npm ci` and checks in CI or an ordinary terminal with reliable registry access. The successful repair and dependency tree are verified; a successful clean CI install is not claimed.
2. Supply HTTPS APP_ORIGIN, STORAGE_DRIVER=s3, SCANNER_DRIVER=clamav, EMAIL_DRIVER=resend, AWS_REGION, S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, CLAMAV_HOST, RESEND_API_KEY and EMAIL_FROM. Existing MongoDB/secret values were not printed or replaced. Then rerun `npm run preflight`; it checks configuration, not connectivity.
3. In isolated staging verify real S3 exact-size/checksum upload, private bucket policy/CORS/lifecycle, clean publication, authorized/expired signed reads, and deferred physical deletion. Verify temporary credential refresh operationally.
4. Run a maintained real ClamAV daemon with current signatures and clean/infected/malformed/timeout fixtures. Confirm no failures release evidence and retry/recovery is observable.
5. Verify Resend sender/recipient setup, actual inbox receipt, opt-out, stale-code suppression and provider retry/idempotency behavior. Development previews send no mail.
6. Complete Student/Admin browser walkthroughs at phone/tablet/desktop sizes: keyboard/dialog access, evidence progress/cancel/retry/previews, inbox pagination/read counts, logout/account switching/reconnect, department targeting, feedback/reopening and second resolution cycles. Exercise Leaflet/Recharts after the framework upgrade.
7. Back up a staging database and storage configuration; run migration read-only inventory, then additive --apply twice and compare indexes/values. Rehearse rollback without deleting new evidence/feedback. No live migration was applied here.
8. Run the authored CI workflow, custom-server/proxy WebSocket acceptance, worker crash/recovery monitoring and operational backup/retention checks. Track the dev-only minimatch advisory for a compatible upstream fix.

## Operational limits

- MongoDB needs a replica set or sharded deployment; app and worker must both run.
- Local storage, development mail and unscanned release are refused in production.
- Already-issued signed links remain bearer capabilities until short expiry. Logical deletion blocks new access; physical cleanup is delayed to cover upload grants/in-flight writes.
- Anonymous DTOs hide ownership and image identity metadata is stripped, but content/PDF/video metadata can identify people.
- Media validation is bounded container validation, not full document decoding or codec transcoding.
- One app instance is supported until a shared Socket.IO adapter/load-balancer configuration is provided.
- Classification/warnings remain explainable rules; existing priority ageing is not continuously scheduled.
- No penetration test, external integration certification, CI success or production readiness approval is claimed.
