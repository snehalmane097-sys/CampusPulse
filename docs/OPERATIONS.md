# CampusPulse 2.0 operations

## Release status

The application code is implemented on `feature/campuspulse-2.0`. Next.js is upgraded to 15.5.29. Deployment remains **gated** on production configuration, real storage/email/scanner verification and staging browser acceptance. Do not treat local adapter tests as external-service certification.

Registry connectivity was restored during review. A clean npm ci attempt encountered a registry timeout; a subsequent normal install repaired the tree. Disposable local replica-set tests and loopback fixtures can run. Production preflight refuses missing production settings and development drivers. See VALIDATION.md for final results.

## Runtime

- Node.js 22 or newer.
- MongoDB Atlas or a MongoDB replica set. Transactions and notification change streams require replication; a standalone MongoDB instance is insufficient.
- A persistent Node custom server, plus one or more durable workers. Start with one application instance. Multiple app instances require a shared Socket.IO adapter and appropriate load balancing before scaling.
- HTTPS reverse proxy in production. Preserve WebSocket upgrades for `/api/socket/` and strip untrusted forwarded headers.
- Separate private S3 bucket, Resend account with verified sender domain, and private ClamAV daemon for production.

## Local setup (PowerShell)

```powershell
npm ci
Copy-Item .env.example .env.local
# Edit .env.local. Never replace your existing environment file if it already exists.
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# Use the generated value as JWT_SECRET; set your replica-set MONGODB_URI.
npm run migrate
npm run migrate -- --apply
npm run dev
```

Run the worker in a second terminal:

```powershell
npm run worker
```

Open the exact configured `APP_ORIGIN`, normally `http://localhost:3000`. Do not mix `127.0.0.1` and `localhost`: cookie origin and CSRF checks are intentional. Authentication changed to HttpOnly cookies; old localStorage JWTs are invalid and users must sign in again. `cp_token` is only a UI presence marker.

Local development defaults:

- `STORAGE_DRIVER=local`: files live below `.private-data/evidence`, outside public assets. Access always goes through authorization.
- `SCANNER_DRIVER=development`: signature/container/checksum validation plus an EICAR fixture check. The UI labels the resulting files **development-unscanned**. This is not a real malware scan.
- `EMAIL_DRIVER=development`: JSON email previews are written to `.private-data/mail`. No email is sent. Verification codes are visible only in this private operator directory.

The worker is required even in development. Without it, uploads remain processing, announcements remain queued and verification emails do not appear. Private data must not be served by a web server or committed.

## Account provisioning

Public registration creates students only. Existing administrative provisioning remains:

```powershell
node scripts/create-admin.js "Administrator" admin@campus.edu "a-long-unique-password" "IT / Network"
npm run department -- student@campus.edu academic "Computer Science"
npm run department -- admin@campus.edu service "IT / Network"
```

Academic-department announcements use trusted `User.academicDepartment` values. Service-department announcements use admin `User.department`. Existing users without assignments receive campus-wide announcements. Assignments are not inferred from email or accepted from student profile requests. All admins retain the existing campus-wide grievance permission; department targeting is an announcement audience, not a new grievance access boundary.

## AWS S3

Set `STORAGE_DRIVER=s3`, `AWS_REGION`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`; set `AWS_SESSION_TOKEN` when using temporary credentials. Credentials must be refreshed by your deployment environment before expiry. The native SigV4 adapter does not implement automatic IAM role credential discovery. Prefer short-lived injected credentials and a narrowly scoped role.

Optional `S3_ENDPOINT` supports a private compatible service; verify its POST/checksum compatibility before deploying. HTTPS is mandatory in production. Bucket names/endpoints are operator-controlled.

Bucket setup:

1. Block all public access; enable default SSE-S3 encryption. No public ACLs.
2. Grant server credentials `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` only for `quarantine/*` and `clean/*` in this bucket. Avoid broad account-level storage permissions.
3. Browser CORS: exact `APP_ORIGIN`; allow POST and GET/HEAD; allow required upload headers; expose useful range headers if needed. Native browser media requests do not require cross-origin credentials.
4. Add a lifecycle rule deleting abandoned `quarantine/` objects after a short operational window (for example two days). Do not apply this to `clean/` evidence. Configure multipart abort cleanup if other clients use multipart uploads.
5. Audit access, encrypt backups and establish an institution-approved evidence retention schedule. Do not configure immutable retention rules that conflict with the application's deletion policy without updating that policy.

Uploads use five-minute signed POST policies with an exact server-generated key, MIME, size, SHA-256 and encryption fields. Files land in quarantine. The worker rechecks bytes and scans them before copying approved bytes to a different immutable clean key. Browser access is signed for 60 seconds only after rechecking report permissions. Signed links are bearer capabilities during their short lifetime; access revocation cannot invalidate an already-issued link immediately. Do not log them.

JPEG EXIF/IPTC/comment metadata and PNG/WebP identity metadata are stripped from the clean image copy. PDF/video metadata and identifying content are not anonymized automatically. Original filenames are hidden from admins on anonymous reports, but users must inspect content before uploading.

## Malware scanning

Set `SCANNER_DRIVER=clamav`, `CLAMAV_HOST`, `CLAMAV_PORT=3310`. Run a maintained ClamAV daemon with current signatures on a private network. Configure `StreamMaxLength`/scan limits to cover the application's maximum 100 MB video. The adapter uses bounded `INSTREAM` frames and a 60-second socket timeout. ClamAV's raw TCP protocol is not TLS; protect the network path and do not expose the daemon publicly.

Scanner errors/timeouts never release files. Jobs retry with backoff, then enter failed state after five attempts. Admins can retry jobs through the processing-health panel after correcting service configuration. Missing/corrupt upload bytes remain inaccessible. Standard image container limits and MP4 duration (10 minutes) are checked; this is not video transcoding or a complete media decoder. Playback depends on browser codec support. Encrypted PDFs are rejected.

## Email

Set `EMAIL_DRIVER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`. The sender domain must be verified in Resend. The adapter calls the HTTPS provider API with an idempotency key and timeout. Notification emails require a verified recipient and enabled preference. Verification emails can be delivered before verification, with rate limits. No report text or attachments are included in ordinary email notifications. Students retrieve verification codes through their own mailbox and paste them into Inbox preferences.

Provider errors are retried with backoff; in-app notifications remain persisted. Jobs skipped because of unverified/disabled/opted-out accounts are reported separately from completed jobs. Provider idempotency windows are finite: email delivery is at-least-once and rare duplicate emails remain possible after prolonged recovery; never promise exactly-once external delivery.

## Workers and recovery

`npm run worker` claims MongoDB-backed jobs using atomic leases. Each worker handles one job at a time. Heartbeats extend the lease; crashed work becomes claimable again. Notification event keys and announcement/recipient keys prevent duplicate database inbox entries. Announcement audiences are processed in batches of 100 and re-evaluated against current account assignments while fanout is running.

The custom server watches persisted notifications and emits recipient-room invalidations. Clients also poll every 30 seconds and reconcile after reconnect, so loss of the stream/socket does not lose inbox data. Existing grievance/incident events remain in place.

Abandoned uploads expire after one hour. The worker cleans quarantined and explicitly removed files; deletion retries remain possible when storage is down. Logical deletion denies new access immediately; physical deletion waits at least ten minutes and until the original upload expiry to cover grants/in-flight writes. Tracked clean-candidate keys and transactional lease fencing protect crash retries. Accepted evidence is retained until an admin explicitly removes it or an institution-configured storage retention policy takes effect. No automatic deletion date is invented for existing complaints. Monitor private mail spool and outbox growth, and archive/purge operational records under your retention policy.

## Framework upgrade and production build

Installed Next.js is 15.5.29, selected using registry versions, peer/engine metadata and the upstream security release. React/React DOM remain 18.3.1 under the declared peer range. Mongoose 8.24.8, Socket.IO 4.8.4 and PostCSS 8.5.32 retain their existing majors. A PostCSS override keeps existing 8.x consumers patched. Verify advisories again before deployment; version checks alone are not a vulnerability scanner.

```powershell
npm ci
# Use the package/lockfile versions; never force peer resolution.
npm run typecheck
npm test
npm run test:integration
npm run build
npm run preflight
npm start
```

Do not use forced dependency installation. Dynamic route params already use the awaited Next.js 15 request API. Run the upgrade/build checks before release and update the minimum baseline when newer advisories apply. The upgraded optimized build has passed locally. Staging browser acceptance with Leaflet/Recharts remains required.

`npm run preflight` checks configuration and the framework baseline; it does not contact S3, Resend or ClamAV. The custom production server also invokes this check so directly running `server.js` does not bypass it.

Development now always uses `.next-dev`; default production build/start use `.next`. This fixes the former development/build artifact collision. `npm run build` invokes prebuild to safely clean only production output and serially prepare generated route directories, addressing observed Windows worker mkdir EPERM failures. Do not substitute direct npx next build for this workflow. The default build now passes without NEXT_BUILD_DIR; an optional validated `.next-v2` production override remains supported consistently at build/start. Stop a production server before replacing its own output. Never disable security software or bypass audit controls. See [STABILIZATION.md](STABILIZATION.md) for actual logs, commands and browser results.

## Rollout and rollback

Back up MongoDB and object-storage configuration first. Run `npm run migrate` for a read-only inventory and replica check, then `npm run migrate -- --apply` for additive fields/indexes. Historical resolution dates are never guessed. New indexes are created; old indexes are not dropped. Legacy notifications retain their `read` state and become type `status`. Admin accounts are not changed.

Deploy server and worker together after staging tests. Validate student/admin sessions, anonymous evidence, review decisions, email opt-out, offline inbox recovery and reopened incident status. Monitor queue age/failures, scanner health, storage errors, authentication failures, memory and request latency. Terminate TLS at the trusted proxy; set `TRUST_PROXY=true` only if it overwrites attacker-supplied forwarding headers.

Rollback application deployment only after taking a fresh backup and stopping workers. Additive collections/fields can remain, but an old application will not understand reopening/history. Revoke sessions if rotating credentials. Never delete new evidence or feedback collections as part of a routine rollback. No deployment or push to main was performed by this implementation.
