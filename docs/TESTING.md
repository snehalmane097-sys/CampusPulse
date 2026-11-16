# Testing CampusPulse 2.0

## Commands

```powershell
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run build
npm run preflight
```

`lint` runs ESLint with Next.js/core-web-vitals and React hooks rules; zero warnings are permitted. `npm run check:syntax` separately parses source with TypeScript. Tests use Node's built-in runner, the TypeScript loader, and mongodb-memory-server for the optional disposable replica set.

## Automated coverage

- Existing keyword classification/routing and duplicate rules.
- Anonymous DTOs, ownership, current-account role enforcement, revoked sessions and cross-origin writes.
- Request shapes/bounds; file format/size/checksum policy and container limits.
- Private local storage, traversal protection, immutable writes and production rejection of development drivers.
- S3 signed URL and bounded POST policy structure; no live S3 claims.
- ClamAV INSTREAM framing with an in-process socket double; optional loopback protocol transport.
- Mocked email-provider error propagation/idempotency; no real delivery.
- Notification owner scope/read tracking, feedback status/rating validation, uniqueness indexes.
- Server-rendered components for both portal roles, media controls, inbox labels and admin management visibility. These are render checks, not real-browser interaction tests.

## Real MongoDB integration suite

Run `npm run test:local-integration` to download/cache MongoDB in the ignored `.private-data/test-mongo-binaries` directory and start an isolated single-node replica set. The first run needs the MongoDB download host. The runner stops its replica on completion and never infers a test connection from MONGODB_URI.

Alternatively, use a disposable replica set with a database named `campuspulse_test_<suffix>`. The suite refuses other names and never infers a test URI from your real application connection. It drops only the explicitly named disposable test database before/after the run.

```powershell
$env:TEST_MONGODB_URI='mongodb://localhost:27017/campuspulse_test_local?replicaSet=rs0'
npm run test:integration
```

The suite seeds distinct students/admin, creates an anonymous report, checks cross-user denial, resolves it, records/duplicates feedback, races reopening decisions, uploads/processes/reviews private evidence, publishes a targeted announcement twice, checks recipient/read isolation, retrieves satisfaction and revokes a session. It also checks simultaneous clustering, idempotent submission/content conflicts, repeated backfill preserving disabled/opt-out flags, and reviewed-evidence deletion denial. All local integration drivers are explicitly development-only. A missing test URI is reported as SKIP, never PASS.

The GitHub Actions workflow provisions a local MongoDB replica set and runs these tests. It has been authored but not executed in this session. No CI success is claimed.

## Browser and external acceptance before release

Use an isolated staging deployment and institution-approved test accounts:

1. Student register/login; admin login; keyboard-accessible inbox/dialogs; phone/tablet/desktop widths.
2. Text and voice reports; anonymous ownership; existing category/priority/clustering/radar/warnings.
3. Initial and subsequent evidence uploads, progress/cancel/retry, all formats, oversized/fake/infected/encrypted cases, scanner outage, deletion and signed-link expiry.
4. Admin evidence acceptance/rejection, anonymous identity masking in HTTP/socket payloads and filenames.
5. Student offline status changes, reconnect inbox recovery, multiple tabs, read-all/read-one; logout/account switching and expired/revoked sessions.
6. Campus and department audiences, draft edit/publish/archive, no duplicate recipient notifications.
7. Verified/opted-out email, provider failure/retry, verification-code expiry; inspect actual mailbox receipt with no sensitive content.
8. Five-star and written feedback, duplicate/conflicting submissions, pending reopening, approved/rejected decisions, second resolution cycle and incident synchronization.
9. Department average/distribution/response-rate date cohorts, historical toggle and exclusion of unknown legacy resolution dates.
10. Backups, migration/rollback rehearsal, production startup, proxy WebSocket support and processing-health monitoring.

Disposable MongoDB replica-set tests are exercised locally; see VALIDATION.md for the final result. Real S3, Resend, actual ClamAV and a full authenticated browser walkthrough remain unverified. See VALIDATION.md for the precise local results and release blockers.
