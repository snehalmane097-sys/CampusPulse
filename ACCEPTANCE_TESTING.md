# CampusPulse 2.0 manual acceptance-testing guide

Prepared from the actual working tree on **10 November 2026**, branch **feature/campuspulse-2.0**.

This is an execution worksheet, not a claim that these manual tests have passed. **Actual result and Pass/Fail are intentionally blank in every case.** Guide preparation only read project files and wrote this document; no application source, database, configuration, branch, remote or deployment was changed.

## Scope, evidence and execution record

Sources checked: [post-implementation review](docs/POST_IMPLEMENTATION_REVIEW.md), [validation](docs/VALIDATION.md), [operations](docs/OPERATIONS.md), [security](docs/SECURITY.md), [API contract](docs/API.md), [automated tests](docs/TESTING.md), [.env.example](.env.example), package/config/custom server, API route files, models, and the Student/Admin components. Exact behavior is primarily implemented by `src/services/v2.ts`, `lifecycle.ts`, `worker.ts`, `evidenceLifecycle.ts`, `session.ts`, `src/lib/api.ts`, and the route/component files cited in the route map.

| Run field | Value |
|---|---|
| Tester / reviewer | |
| Date and run marker RUN | |
| Branch and commit/worktree snapshot | |
| Base URL / isolated database name (no credentials) | |
| Browser / version / OS / viewport | |
| Storage / scanner / email driver | |
| Worker process / service versions | |
| Fixture ledger / issue tracker / evidence folder | |
| Summary: passed / failed / blocked / not run | |

For each case fill the two blank fields after execution. Use **Pass** or **Fail** only after observing results. If unavailable, write **Blocked** or **Not run** in Actual result, state why, and leave Pass/Fail blank. Partial execution is not a pass. Capture sanitized request status, record ID, time and screenshot/provider reference in Actual result; never capture cookies, passwords, JWT_SECRET, verification codes, API keys, report personal data or signed URL query strings.

## Safety rules

1. Use only institution-approved test identities, synthetic descriptions and disposable files. Do not use real student grievances, personal photos or real malware.
2. Operator must first confirm that app **and worker** point to a disposable replica-set database and private test storage/mailbox. Label every fixture with RUN; do not use a production MongoDB URI, bucket prefix or recipients.
3. Separate browser profiles/private sessions for S1, S2 and A1 avoid shared-cookie mistakes; ordinary tabs share identity and are used only for explicit multi-tab cases.
4. The following setup/provisioning and UI steps are instructions for a later authorized test run, **not commands executed while writing this guide**. They create disposable test data. If database writes are prohibited during the test run, prepare fixtures beforehand and mark mutation cases Blocked.
5. Never drop a database, bulk-delete records, edit timestamps/roles directly, rotate live secrets, or run migration --apply against existing/live data. No cleanup/destructive commands are supplied. Dispose of the whole dedicated test environment later through its owner's approved process.
6. Admin provisioning can promote an existing email; use a unique test email and confirm it does not belong to a real account. Do not use --reset-password.
7. Outage, worker-kill, quota, replay and rate-limit cases run only in a dedicated sandbox. Restore sandbox connectivity/configuration afterwards. Never interrupt a shared app/worker/scanner or disable security software.
8. Treat the existing automated integration suite separately: it drops its guarded test database before/after. **Do not point TEST_MONGODB_URI at the manual acceptance fixture database.** The automatic local integration runner uses its own random disposable DB; it does not start the interactive app or preserve manual fixtures.
9. Use read-only DB/object inspection only where specified; omit that portion if operator access is unavailable and record Blocked. A successful HTTP call cannot substitute for verifying the resulting UI, recipient or private storage behavior.

## Required runtime, environment and external services

Use Node **22+**, installed dependencies from package-lock, one custom Node app server, at least one worker and **MongoDB replica set or sharded MongoDB**. Standalone MongoDB cannot support these transactional workflows/change streams. Current reviewed dependencies include Next.js 15.5.29, React 18.3.1 and Mongoose 8.24.8.

| Variable | Local acceptance value / requirement | External/production-style acceptance |
|---|---|---|
| MONGODB_URI | Dedicated replica-set URI, e.g. mongodb://127.0.0.1:37017/campuspulse_acceptance_RUN?replicaSet=rs0 | Dedicated Atlas/replica set; no live database |
| JWT_SECRET | Generated random secret, >=32 characters; example change-this/replace-this prefixes are rejected | Private generated secret; never share |
| PORT | 3000, or a free chosen port | Match approved staging app |
| APP_ORIGIN | http://localhost:3000, matching actual port/browser origin | Exact HTTPS origin |
| TRUST_PROXY | false without trusted reverse proxy | true only if proxy overwrites untrusted forwarding headers |
| STORAGE_DRIVER | local | s3 |
| PRIVATE_DATA_DIR | Private isolated directory, e.g. .private-data/acceptance-RUN, outside public | Private spool path; never publicly served |
| SCANNER_DRIVER | development (not a malware scan) | clamav |
| EMAIL_DRIVER | development (private JSON previews, no mail sent) | resend |
| AWS_REGION | Only needed for S3, e.g. us-east-1 | Real test bucket's region |
| S3_BUCKET | Not needed for local files | Private test bucket, public access blocked |
| AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY | Not needed locally | Narrowly scoped test credentials for quarantine/* and clean/* |
| AWS_SESSION_TOKEN | Optional | Required for temporary AWS credentials; refresh operationally |
| S3_ENDPOINT | Leave unset for AWS default | Optional compatible HTTPS endpoint; verify actual POST/checksum support |
| CLAMAV_HOST / CLAMAV_PORT | Ignored by development driver | Private maintained daemon; port defaults to 3310 |
| RESEND_API_KEY / EMAIL_FROM | Not needed for previews | Valid test credentials and verified sender/domain |
| TEST_MONGODB_URI | Not needed for manual UI tests | Automated suite only; explicitly disposable campuspulse_test_* DB |
| NEXT_BUILD_DIR | Optional .next-v2 for documented Windows output workaround | Same value at build and startup if used |
| NODE_ENV | Let npm run dev select development | Production invokes preflight and rejects local/development drivers |

**Services and tags:** [LOCAL] works with local storage, development scanner and private mail preview. [S3] needs private S3, valid credentials, exact-origin CORS, encryption/IAM/lifecycle configuration and network access. [MAIL] needs Resend plus access to an authorized recipient's real inbox. [SCAN] needs a maintained ClamAV daemon/signatures and an approved benign scanner fixture. Browser speech recognition, microphone permission, map tiles and web fonts have separate browser/network requirements; no credentials are invented for them.

Production preflight requires HTTPS origin, s3/clamav/resend drivers and their required configuration. Its success is **not** a connectivity test. Do not weaken it to run local drivers in production.

## Local setup for the future tester (PowerShell)

Use a dedicated sandbox copy of the same feature branch with all reviewed working-tree changes present. Do not switch the current checkout to main, push, merge or deploy.

1. Confirm the branch, runtime and dependency installation:

```powershell
git branch --show-current
node --version
npm ci
```

Expected branch is feature/campuspulse-2.0. If install fails due to registry connectivity, record the actual error, repair connectivity and retry normally; do not force/legacy-peer dependencies or guess versions.

2. Ask the operator for a disposable MongoDB replica set. If Docker is available and ports/name are unused, the operator may provision this **new isolated** one; these commands are optional, not actions performed for this document:

```powershell
docker run -d --name campuspulse-acceptance-mongo -p 127.0.0.1:37017:37017 mongo:7 --replSet rs0 --bind_ip_all --port 37017
docker exec campuspulse-acceptance-mongo mongosh --port 37017 --quiet --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:37017"}]})'
docker exec campuspulse-acceptance-mongo mongosh --port 37017 --quiet --eval 'db.hello().isWritablePrimary'
```

Wait until isWritablePrimary is true. Use a unique database name for each run, such as campuspulse_acceptance_20261110_a. No existing container/data is removed. Atlas with a dedicated disposable database is also suitable.

3. In the **sandbox copy only**, create .env.local from .env.example **only if it does not already exist**. Preserve an existing environment file; have the operator set the table's local values, the dedicated URI, and a unique private data directory. Generate a secret locally:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Use the result privately as JWT_SECRET. Both terminal processes must read the same sandbox configuration. Never publish the secret or overwrite the original project's live environment.

4. On the confirmed disposable database, operator runs inventory first. Apply is optional for an already prepared environment, otherwise needed to ensure additive fields/indexes are installed:

```powershell
npm run migrate
# ONLY after confirming this URI is the new disposable acceptance database:
npm run migrate -- --apply
npm run dev
```

Do not execute --apply if the instruction for your run forbids DB changes. Never substitute an existing/live URI. Read-only migration mode inventories counts and replication; --apply is additive, creates indexes and backfills missing fields.

5. In a second sandbox terminal run:

```powershell
npm run worker
```

Open the exact APP_ORIGIN (normally http://localhost:3000). Do not mix localhost and 127.0.0.1 for the app origin; using 127.0.0.1 for the database is independent. Use npm run dev / custom server; **next dev alone does not supply this Socket.IO server**. Without worker, security checks, fanout and mail stay queued.

6. Operator provisions only unique disposable admin identities (password is a placeholder to replace privately; terminal/history may contain it). Register students via AUTH-01, then assign trusted departments using existing commands:

```powershell
node scripts/create-admin.js "Acceptance Admin A1" a1-RUN@example.invalid "UNIQUE_TEST_PASSWORD_10PLUS" "IT / Network"
node scripts/create-admin.js "Acceptance Admin A2" a2-RUN@example.invalid "ANOTHER_UNIQUE_TEST_PASSWORD" "Facilities"
npm run department -- s1-RUN@example.invalid academic "Computer Science"
npm run department -- s2-RUN@example.invalid academic "Mechanical"
```

Use lowercase unique actual test addresses when replacing RUN. example.invalid is safe for local previews only; real-mail cases require explicitly authorized real mailboxes. No department/self-service admin editor exists.

7. Optional verification commands (not a substitute for this worksheet): npm run typecheck, npm run lint, npm run check:syntax, npm test and npm run build. Production startup/preflight needs all real-service settings; this guide does not authorize deployment. If using NEXT_BUILD_DIR=.next-v2, retain that setting for the matching build and start.

## Fixture ledger and execution order

| Alias | Fixture |
|---|---|
| RUN | Unique short run marker; prepend to benign descriptions/titles |
| S1 | Student owner; Computer Science; local preview mailbox or authorized real inbox |
| S2 | Unrelated student; Mechanical; separate browser profile |
| S3 | Unassigned, initially unverified student |
| A1 / A2 | Admins, IT / Network and Facilities; separate profiles |
| G1 / GA / G2 | S1 normal report / S1 anonymous report / evidence test report |
| PNG1 / PDF1 / MP41 | Actual attachment IDs collected from Network response |
| R1, R2, R3 / N1 / AN1 | Actual reopening, notification and announcement IDs |

Prepare small intact JPEG, PNG, WebP, PDF and standard MP4 fixtures (prefer broadly supported H.264/AAC; no transcoding is implemented). Limits use **MiB = 1,048,576 bytes** despite UI MB labels: images 10 MiB, PDF 20 MiB, MP4 100 MiB; 10 active files/200 MiB per grievance. Images must satisfy dimension bounds <=16,384 per side and <=40 million pixels. MP4 duration metadata must be verifiable and <=600 seconds; PDFs containing encryption are rejected. Prepare separate safe boundary/invalid fixtures. Do not use huge files in routine smoke tests.

Run auth -> reports -> evidence -> notifications/admin -> announcements/email -> feedback -> reopening -> analytics -> socket/responsive/error cases. Each case specifies extra fixtures; fork a new disposable report if the original has already been resolved/rated/deleted. Generate pagination fixtures through normal UI/API actions with pacing; do not seed live DB records or assume only one page exists. Cases are repeatable by choosing a new RUN/record, not by deleting history.

## API inspection recipe (for cases requiring requests)

From DevTools Console **on the configured app origin**, while signed in as the case's role, define this helper. It uses the browser's HttpOnly cookie automatically; do not extract or paste the cookie. Browser supplies Origin for same-origin fetch mutations.

```javascript
async function cp(method, path, data, extraHeaders = {}) {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: { ...(data === undefined ? {} : { "Content-Type": "application/json" }), ...extraHeaders },
    ...(data === undefined ? {} : { body: JSON.stringify(data) })
  });
  const type = response.headers.get("content-type") || "";
  const payload = type.includes("application/json") ? await response.json() : "[non-JSON body]";
  console.log(response.status, payload); // Inspect only sandbox data; do not export sensitive logs.
  return { response, payload };
}
await cp("GET", "/api/auth/me");
await cp("PATCH", "/api/grievances/REPLACE_G1", { status: "In Progress" });
await cp("POST", "/api/grievances/REPLACE_G1/feedback", { rating: 5, comment: "RUN test feedback" });
```

Replace IDs such as REPLACE_G1 with **actual 24-hex IDs**, never the alias itself. For same-key report replay use `{ "Idempotency-Key": crypto.randomUUID() }` once, retain that same value privately, and call POST /api/grievances with identical JSON twice. A new key intentionally creates a new submission. For malformed JSON use a direct fetch with literal body, not this JSON-stringifying helper. For forged/missing Origin use a controlled HTTP client with a sandbox session privately imported, since browsers forbid scripting arbitrary Origin headers; CORS-blocked reads alone do not establish the API's status.

Attachment intent example: POST /api/grievances/{G2}/attachments with `{name:"test.png",mime:"image/png",size:ACTUAL_BYTES,checksum:SHA256_HEX}`. Compute SHA-256 from the actual local fixture with Get-FileHash -Algorithm SHA256. Local intent returns uploadUrl: send **raw file bytes with PUT**, not JSON, then POST /api/attachments/{id}/complete with {}. S3 intent instead returns uploadUrl/uploadFields: POST multipart fields exactly as returned, file field last. Normal UI handles this flow; do not invent a direct public upload route.

## Route and UI map

| Implemented UI/action | Exact route/method |
|---|---|
| Sign in / Create account / Sign out / current identity | POST /api/auth/login, POST /api/auth/register, POST /api/auth/logout, GET /api/auth/me |
| Student workspace / Admin dashboard | /student, /admin (there are no standalone evidence/inbox/feedback pages) |
| Report list/create / detail/status | GET, POST /api/grievances; GET, PATCH /api/grievances/{id} |
| Evidence list/intent / local bytes / complete | GET, POST /api/grievances/{id}/attachments; PUT /api/attachments/{attachmentId}/upload; POST /api/attachments/{attachmentId}/complete |
| Evidence open / remove / admin review | GET /api/attachments/{attachmentId}/access; DELETE /api/attachments/{attachmentId}; PATCH /api/attachments/{attachmentId}/review |
| Header Inbox / count / read actions | GET /api/notifications; GET /api/notifications/unread-count; PATCH /api/notifications/{id}/read; PATCH /api/notifications/read-all |
| Email preferences / verify code | GET, PATCH /api/notifications/preferences; POST /api/auth/email-verification |
| Campus announcements / edit/archive / publish | GET, POST /api/announcements; PATCH, DELETE /api/announcements/{id}; POST /api/announcements/{id}/publish |
| Feedback / own reopening list/create | GET, POST /api/grievances/{id}/feedback; GET, POST /api/grievances/{id}/reopen-requests |
| Admin pending queue / decision | GET /api/reopen-requests; POST /api/reopen-requests/{id}/decision |
| Department satisfaction / job health/retry | GET /api/analytics/satisfaction; GET, POST /api/notifications/delivery |
| Existing analytics / incidents | GET /api/analytics; GET /api/incidents; GET /api/incidents/{id} |
| Socket.IO transport | /api/socket (Engine.IO may show trailing slash/query; not a Next API route file) |

Student: report form, own cards -> **Evidence, feedback & details**, Campus announcements below the report list, header **Inbox**. Admin tabs: **Overview, Live Feed, Incidents, Campus Radar, Analytics, Early Warnings, Campus 2.0**. Live Feed -> **Evidence & resolution**. Incident details -> **Evidence & details**. Campus 2.0 contains announcements, reopening queue, satisfaction and processing health. Feedback/reopening live inside **Grievance workspace**, not separate tabs.

### Targeted inbox expectation for ANN-02

| Audience | S1 CS | S2 Mechanical | S3 Unassigned | A1 IT / Network | A2 Facilities |
|---|---|---|---|---|---|
| Entire campus | Yes | Yes | Yes | Yes | Yes |
| All students | Yes | Yes | Yes | No | No |
| All administrators | No | No | No | Yes | Yes |
| Student department: Computer Science | Yes | No | No | No | No |
| Service department: IT / Network | No | No | No | Yes | No |

These are **recipient inbox** expectations, not the admin management list (which intentionally lists all announcement audiences/states). Targeting checks current trusted assignments while fanout runs; creating an account after fanout completed does not promise historical inbox backfill.

## Detailed test cases

### 1. Student registration, login and logout

#### AUTH-01

- **Test ID:** AUTH-01
- **User role:** Student
- **Preconditions:** Fresh S1 mailbox and password; no S1 account exists.

**Exact steps**

1. Open / and click Create an account.
2. On /register enter Full name, Email and a 10+ character password (at most 72 UTF-8 bytes).
3. Submit Create account; inspect POST /api/auth/register and then refresh /student.

**Expected result:** Registration succeeds, role is student, /student opens automatically, and GET /api/auth/me retains that account after refresh. cp_session is HttpOnly, SameSite=Strict, Path=/; production also sets Secure. Response/localStorage marker is cookie-session, not a reusable JWT.

**Actual result:**

**Pass/Fail:**

#### AUTH-02

- **Test ID:** AUTH-02
- **User role:** Student
- **Preconditions:** S1 registered; a separate fresh address is available.

**Exact steps**

1. Sign out; open /register.
2. Try blank name, malformed email and a password shorter than 10 characters.
3. Then submit valid fields using S1's existing email.

**Expected result:** Browser or API validation blocks invalid fields; duplicate registration returns 409 with an account-exists message. No duplicate account is created. There is no public role or department selector.

**Actual result:**

**Pass/Fail:**

#### AUTH-03

- **Test ID:** AUTH-03
- **User role:** Student / Admin
- **Preconditions:** S1 and A1 credentials provisioned; use separate browser profiles.

**Exact steps**

1. At / enter S1 Email and Password and click Sign in.
2. Refresh /student, then sign out.
3. In the admin profile sign in as A1.

**Expected result:** POST /api/auth/login succeeds; students go to /student and admins to /admin. Refresh obtains current identity from /api/auth/me; working portal UI appears without relying on a browser-stored JWT.

**Actual result:**

**Pass/Fail:**

#### AUTH-04

- **Test ID:** AUTH-04
- **User role:** Student
- **Preconditions:** S1 exists; signed out.

**Exact steps**

1. At / enter S1's email and a wrong password, then try an unregistered test email.
2. Observe errors; correct the fields and sign in.

**Expected result:** Both rejected attempts return 401 Invalid email or password, without revealing a password hash or stack trace. Correct login works and clears the previous error.

**Actual result:**

**Pass/Fail:**

#### AUTH-05

- **Test ID:** AUTH-05
- **User role:** Student / Admin
- **Preconditions:** Signed-in S1 or A1; Network panel open.

**Exact steps**

1. Click Sign out in the header.
2. Inspect POST /api/auth/logout, then GET /api/auth/me using the API recipe below.
3. Reload the former portal URL and try a protected API.

**Expected result:** Logout succeeds, cookie expires and local UI markers clear; navigation returns to /. Protected APIs return 401. A previously rendered page is not proof of authorization; fresh protected reads must fail.

**Actual result:**

**Pass/Fail:**

#### AUTH-06

- **Test ID:** AUTH-06
- **User role:** Student
- **Preconditions:** S1 signed in; no other tester shares this local server.

**Exact steps**

1. Use DevTools request blocking for */api/auth/logout only.
2. Click Sign out and observe the header.
3. Remove the block and click Sign out again.

**Expected result:** First attempt visibly says Sign out failed. Your session is still active. Please retry; it does not pretend success. Retry succeeds and returns to /. Unblock the endpoint even if the case fails.

**Actual result:**

**Pass/Fail:**

### 2. Grievance submission and anonymous grievances

#### GRV-01

- **Test ID:** GRV-01
- **User role:** Student
- **Preconditions:** S1 signed in; record run marker RUN and time.

**Exact steps**

1. In Report an issue enter RUN: WiFi not working in Block C.
2. Choose High under Your sense of severity; leave Submit anonymously clear.
3. Click Submit grievance; record the grievance ID G1 from POST /api/grievances.
4. Refresh and open Evidence, feedback & details.

**Expected result:** 201 creates one Pending grievance owned by S1. Success shows detected Network, Block C and IT / Network routing plus computed priority. Final priority is rule-derived and need not equal the selected severity. G1 persists in S1's list/workspace.

**Actual result:**

**Pass/Fail:**

#### GRV-02

- **Test ID:** GRV-02
- **User role:** Student / Admin
- **Preconditions:** Separate S1, S2 and A1 profiles.

**Exact steps**

1. S1 submits RUN: WiFi not working in Block C with Submit anonymously checked; call it GA.
2. A1 opens Live Feed then Evidence & resolution for GA; inspect grievance/incident JSON and socket frames.
3. S1 reopens GA after refresh; S2 requests GET /api/grievances/GA.

**Expected result:** S1 retains tracking and ownership. Admin display marks anonymity; admin DTOs omit student and history actor identifiers. S2 receives 403. Anonymity does not remove the internal owner, nor sanitize identifying words typed into the description.

**Actual result:**

**Pass/Fail:**

#### GRV-03

- **Test ID:** GRV-03
- **User role:** Student
- **Preconditions:** S1 signed in.

**Exact steps**

1. Try submitting fewer than five non-whitespace characters.
2. Enter a valid report and double-click submit while the network is throttled.
3. Inspect the request Idempotency-Key; with the API recipe replay the identical POST and key, then reuse that key with changed rawText.

**Expected result:** Short text is rejected. UI disables submission while pending. Matching replay returns the original ID (200) rather than a second report; changed-content reuse returns 409. Do not count legitimate separate keys as duplicates.

**Actual result:**

**Pass/Fail:**

#### GRV-04

- **Test ID:** GRV-04
- **User role:** Student / Admin
- **Preconditions:** S1 and S2 logged in; both reports within 72 hours, same known location; A1 watching.

**Exact steps**

1. S1 and S2 submit near-simultaneously the same RUN: Electrical power failure in Block D description.
2. Record both report IDs and incident references through the API.
3. A1 opens Incidents and that incident.

**Expected result:** Both reports succeed and share the matching incident; the incident contains both without duplicate membership. Priority/affected counts update. This clustering is rules/similarity based; unrelated content or Unspecified locations are not guaranteed to cluster.

**Actual result:**

**Pass/Fail:**

#### GRV-05

- **Test ID:** GRV-05
- **User role:** Student
- **Preconditions:** Browser supports the existing speech-recognition feature, microphone allowed; otherwise record Blocked in notes.

**Exact steps**

1. In Report an issue use the VoiceInput microphone control, dictate a short benign issue and finish recording.
2. Inspect recognized text, edit it if needed, and submit.
3. Repeat with microphone permission denied.

**Expected result:** Supported recognition fills the description and submission works; editing switches submittedVia back to text. Permission/unsupported-browser errors must be visible or recoverable and typed submission remains usable. No cloud transcription integration is implied.

**Actual result:**

**Pass/Fail:**

### 3. Evidence uploads, previews, additional evidence and authorization

#### EVD-01

- **Test ID:** EVD-01
- **User role:** Student
- **Preconditions:** S1 signed in; clean valid PNG/JPEG/WebP, ordinary PDF and short standard MP4 fixtures; worker running.

**Exact steps**

1. Attach a small PNG and PDF using Attach evidence (optional) while creating a new grievance G2.
2. Submit; open Evidence, feedback & details.
3. Observe security state, then in Add evidence select a second image and click Upload evidence.

**Expected result:** Grievance creates first; each upload reserves an attachment, uploads bytes and POSTs /api/attachments/{id}/complete (202). Worker changes processing to clean for valid files. Additional uploads appear without a second grievance. Development files explicitly state malware scanning has not been performed.

**Actual result:**

**Pass/Fail:**

#### EVD-02

- **Test ID:** EVD-02
- **User role:** Student / Admin
- **Preconditions:** Clean attachments on G2, recorded as PNG1, PDF1, MP41; MP4 no longer than 10 minutes.

**Exact steps**

1. S1 clicks Preview on the image, then Preview again.
2. Preview PDF and MP4; use MP4 playback/seek controls.
3. Click Open file for each; repeat as A1 via Evidence & resolution.

**Expected result:** Image preview toggles; supported MP4 plays with controls, and local range requests can return 206. Open file uses /api/attachments/{id}/access. PDF iframe is sandboxed; record browser-specific PDF limitations separately and verify Open file fallback. An HTTP success alone is not proof of usable rendering.

**Actual result:**

**Pass/Fail:**

#### EVD-03

- **Test ID:** EVD-03
- **User role:** Student
- **Preconditions:** G2 exists; throttled network and a valid larger MP4 under 100 MiB.

**Exact steps**

1. Select the MP4 in Add evidence, click Upload evidence and observe Upload progress.
2. While active click Cancel; wait for the list refresh.
3. Restore normal networking and upload a valid small file.

**Expected result:** Progress/busy controls appear. Cancel aborts and attempts logical removal of the reserved upload; no cancelled file becomes newly accessible. A fresh upload can succeed. Observe server outcome if cancellation raced completion; document it rather than assuming bytes never arrived.

**Actual result:**

**Pass/Fail:**

#### EVD-04

- **Test ID:** EVD-04
- **User role:** Student
- **Preconditions:** Separate profiles S1 owner, S2 unrelated; attachment ID on G2 recorded.

**Exact steps**

1. In S2's same-origin console GET /api/grievances/G2/attachments and /api/attachments/PNG1/access.
2. Try POST /api/grievances/G2/attachments with a valid metadata payload.
3. Repeat the access GET signed out; repeat as S1 and A1.

**Expected result:** S2 is denied with 403; signed-out access returns 401. Owner and admin can list authorized evidence; only released evidence can be read. DTOs do not reveal storage keys/uploader. Knowing an ID is not authorization.

**Actual result:**

**Pass/Fail:**

#### EVD-05

- **Test ID:** EVD-05
- **User role:** Student / Admin
- **Preconditions:** GA is anonymous; S1 uploads a clean image named with a fictitious person identifier.

**Exact steps**

1. Compare the evidence list as owner and as A1.
2. Inspect GET /api/grievances/GA/attachments and the admin access response headers.
3. For a JPEG/PNG/WebP fixture containing known test identity metadata, inspect the released image using a trusted offline metadata viewer.

**Expected result:** Owner sees own filename; admin sees Evidence <suffix>.<format>, no original name/uploader/quarantine or clean key. Released image strips the implemented EXIF/text/XMP identity metadata. PDF/video content/metadata is not anonymized; do not expect it to be. Never use a real person's details.

**Actual result:**

**Pass/Fail:**

#### EVD-06

- **Test ID:** EVD-06
- **User role:** Student / Admin
- **Preconditions:** Two unreviewed clean attachments on G2; one has not been removed.

**Exact steps**

1. S1 clicks Remove and cancels the confirmation; confirm the item remains.
2. Remove and confirm for one attachment; retry its access URL.
3. After A1 accepts the other attachment, S1 attempts Remove; A1 then removes that reviewed test attachment.

**Expected result:** Cancelled confirmation has no effect. Confirmed permitted removal hides the item and fresh access returns 404. S1's reviewed-evidence removal returns 409; admin can remove it. Logical deletion is immediate; bytes are not promised to disappear immediately.

**Actual result:**

**Pass/Fail:**

#### EVD-07

- **Test ID:** EVD-07
- **User role:** Student / Admin / Operator
- **Preconditions:** [S3] Private test bucket, valid credentials/CORS; clean test evidence; read-only bucket inspection permitted.

**Exact steps**

1. Upload through UI and inspect the signed POST policy fields without copying credentials or URLs into reports.
2. Confirm upload lands in quarantine and only checked bytes get a distinct clean key.
3. Observe 307 on access; use its Location in a separate tab within 60 seconds and retry the same signed URL after expiry.
4. Try unsigned bucket/object access.

**Expected result:** POST policy fixes generated key, MIME, exact byte length, SHA-256 and encryption; bucket remains private. Short signed GET works then expires. App access endpoint reauthorizes each new request; an already-issued URL is a bearer capability until expiry. Mark Blocked if S3 is not configured.

**Actual result:**

**Pass/Fail:**

#### EVD-08

- **Test ID:** EVD-08
- **User role:** Operator / Student
- **Preconditions:** Dedicated sandbox only; one disposable attachment logically removed; original expiresAt/key recorded privately before removal via authorized read-only DB access.

**Exact steps**

1. Keep the worker running after removal.
2. Observe object existence before the later of original upload expiry and removal plus ten minutes.
3. After the deadline and cleanup pass, inspect the test object and attachment metadata read-only.

**Expected result:** No fresh application access after logical deletion. Physical cleanup is deferred until the safety deadline, and eventually removes tracked bytes; completed uploads may retain the original one-hour deadline. Cleanup runs roughly once per minute. Do not change timestamps, delete objects manually or assume ten minutes is always sufficient.

**Actual result:**

**Pass/Fail:**

#### EVD-09

- **Test ID:** EVD-09
- **User role:** Student
- **Preconditions:** G2 exists; simulator/request-blocking available.

**Exact steps**

1. Block only /api/attachments/*/complete, or simulate loss of the completion response after it reached the server.
2. Upload one valid fixture; observe error and inspect Network for DELETE.
3. Unblock; reopen workspace and inspect server state before retrying.

**Expected result:** Unacknowledged completion does not trigger speculative DELETE unless the user explicitly cancelled. If the server committed, the evidence can still become clean; otherwise it remains pending and inaccessible until retry/expiry. UI gives an error; tester must inspect state and avoid duplicate grievance submission.

**Actual result:**

**Pass/Fail:**

#### EVD-10

- **Test ID:** EVD-10
- **User role:** Student / Operator
- **Preconditions:** Disposable grievance; controlled API fixture client; one small PNG with known SHA-256; optional [S3].

**Exact steps**

1. Create an intent using the API recipe and a 64-hex checksum deliberately different from that PNG; upload the declared number of bytes and POST complete.
2. Observe processing and try access after worker runs.
3. For S3, save one test POST grant privately, wait over five minutes, then attempt its first upload; for local storage, reserve an intent, wait over one hour and try PUT upload/POST complete without changing timestamps.

**Expected result:** Checksum mismatch is never released (S3 may reject upload itself; local worker rejects bytes). Expired S3 POST is refused by S3; local expired pending upload/complete is 409, or 404 if cleanup already tombstoned it. Pending/processing access is 409. Do not confuse five-minute S3 grant expiry, one-hour intent expiry and 60-second read URL expiry.

**Actual result:**

**Pass/Fail:**

### 4. Student inbox, unread count and preferences

#### NTF-01

- **Test ID:** NTF-01
- **User role:** Student / Admin
- **Preconditions:** S1 owns an active report; A1 in another profile.

**Exact steps**

1. S1 opens header Inbox (bell icon at narrow widths), records unread badge, then closes it.
2. A1 changes that report to In Progress.
3. S1 opens Notification center, clicks Mark read on the status notification, then refreshes.

**Expected result:** Persisted notification appears with readable message/date and unread styling. Badge/count from /api/notifications/unread-count updates; read state persists after refresh. Badge displays 99+ above 99, while endpoint retains exact count.

**Actual result:**

**Pass/Fail:**

#### NTF-02

- **Test ID:** NTF-02
- **User role:** Student
- **Preconditions:** S1 has several read and unread notifications.

**Exact steps**

1. Open Inbox and select Unread only.
2. Mark one item read, then click Mark all read.
3. Clear Unread only; open View grievance on a report-linked item.

**Expected result:** Read item disappears from unread view; own unread count becomes zero; read items remain in full view. View grievance closes inbox and opens the correct Grievance workspace. Announcements without a grievance need not have this action.

**Actual result:**

**Pass/Fail:**

#### NTF-03

- **Test ID:** NTF-03
- **User role:** Student / Admin
- **Preconditions:** More than 20 notifications available through ordinary test actions, paced to avoid rate limits.

**Exact steps**

1. Open Inbox and click Load older notifications; record IDs and an older visible item.
2. Generate a new status notification in the other profile; wait for socket/poll refresh.
3. Repeat Unread only toggle and load older again.

**Expected result:** Cursor pagination appends/reloads the opened window without duplicated IDs. Refresh retains opened page count; new items can naturally push the oldest item beyond that window. Filter changes reset pagination and stale responses must not overwrite the current filter.

**Actual result:**

**Pass/Fail:**

#### NTF-04

- **Test ID:** NTF-04
- **User role:** Student / Admin
- **Preconditions:** S1 and A1 signed in; trusted departments provisioned.

**Exact steps**

1. Open Inbox > Email preferences and note Department.
2. Toggle Email me about updates off, close/reopen and refresh; toggle on again.
3. Repeat in A1's profile.

**Expected result:** Boolean preference persists through PATCH /api/notifications/preferences. Student sees academicDepartment; admin sees service department; unassigned accounts show Unassigned. This UI has no department editor. In-app notification delivery is independent of the email opt-out.

**Actual result:**

**Pass/Fail:**

#### NTF-05

- **Test ID:** NTF-05
- **User role:** Student
- **Preconditions:** S1/S2 each have a notification; record S1 notification ID N1.

**Exact steps**

1. As S2 inspect GET /api/notifications and unread-count.
2. PATCH /api/notifications/N1/read using the recipe.
3. Return to S1 and check N1.

**Expected result:** S2's list/count contain only S2 data. Cross-user read request can return success (200) but updates nothing; N1 remains unread for S1. Do not require 403 for this deliberately scoped no-op endpoint.

**Actual result:**

**Pass/Fail:**

### 5. Admin grievance management and evidence review

#### ADM-01

- **Test ID:** ADM-01
- **User role:** Admin
- **Preconditions:** A1 signed in; G1 Pending.

**Exact steps**

1. Open Live Feed; inspect category/location/department and click the priority badge titled Why this priority?.
2. Click In Progress for G1, then Resolved.
3. Open Evidence & resolution and inspect Status history and API resolutionCycle.

**Expected result:** Status changes persist and notify the owner. Priority reasons expand where available. First transition into Resolved advances resolutionCycle to 1 and records resolution time/department/history. Matching current-status button is disabled; all status buttons on a resolved report prevent direct changes.

**Actual result:**

**Pass/Fail:**

#### ADM-02

- **Test ID:** ADM-02
- **User role:** Admin
- **Preconditions:** More than 20 reports exist; record an older report ID.

**Exact steps**

1. In Live Feed click Load older grievances.
2. Trigger a fresh report from S2; wait for the live refresh.
3. Open Evidence & resolution for an older report, close it, then open a different report quickly under throttling.

**Expected result:** Loaded-page window remains expanded without duplicate IDs; newer rows may push older boundary rows out naturally. Correct selected report is displayed after loading; stale response must not display the previous report in the new workspace.

**Actual result:**

**Pass/Fail:**

#### ADM-03

- **Test ID:** ADM-03
- **User role:** Admin / Student
- **Preconditions:** G2 has two clean unreviewed attachments; S1 owner.

**Exact steps**

1. A1 opens Evidence & resolution and previews first attachment.
2. Enter a review note and click Accept; observe S1 after the five-second evidence refresh.
3. On the second attachment click Reject with no note, then enter a reason and click Reject.

**Expected result:** Acceptance persists as review=accepted with note. Empty rejection returns 400 A rejection reason is required; valid rejection persists and notifies S1. Review rejection is not malware rejection/deletion: state remains clean and owner/uploader and admin can still access the retained file.

**Actual result:**

**Pass/Fail:**

#### ADM-04

- **Test ID:** ADM-04
- **User role:** Admin / Student
- **Preconditions:** S1 has a report; S2 cannot access it; A1 valid.

**Exact steps**

1. As S1 attempt PATCH /api/attachments/{id}/review and GET /api/reopen-requests, /api/notifications/delivery and /api/analytics/satisfaction.
2. As A1 open the same report via an incident's Evidence & details button and via Live Feed.

**Expected result:** Admin-only operations return 403 for a student. A1 can review campus-wide regardless of service-department assignment. Both admin entry points open the intended grievance workspace; department announcement targeting is not a grievance permission boundary.

**Actual result:**

**Pass/Fail:**

#### ADM-05

- **Test ID:** ADM-05
- **User role:** Admin
- **Preconditions:** Dedicated sandbox, incidents/test reports available; network-blocking tools.

**Exact steps**

1. Block PATCH /api/grievances/{G1} for an active disposable report; click a different status.
2. Block GET /api/incidents/{id} and click an incident.
3. Unblock and retry each.

**Expected result:** Failures display warning/error feedback without falsely reporting a committed change; UI remains usable. Successful retry opens the incident/updates status. Do not simulate outages on a shared or production server.

**Actual result:**

**Pass/Fail:**

### 6. Admin announcements and targeting

#### ANN-01

- **Test ID:** ANN-01
- **User role:** Admin / Student
- **Preconditions:** A1 and S1 profiles; worker running.

**Exact steps**

1. A1 opens Campus 2.0 > Campus announcements.
2. Enter title of 3-160 characters, content of 5-5000, audience Entire campus; click Create draft.
3. Click Edit draft, change title/content, Save changes; check S1 before publication.
4. Click Publish and wait for worker delivery.

**Expected result:** Draft state is visible to admins, not students; editing retains audience/department. Publish queues fanout and delivers one persisted recipient notification. Student announcement list shows published campus entry. Publication and email are separate asynchronous steps.

**Actual result:**

**Pass/Fail:**

#### ANN-02

- **Test ID:** ANN-02
- **User role:** Admin / Student
- **Preconditions:** S1=Computer Science, S2=Mechanical, S3=Unassigned; A1=IT / Network, A2=Facilities; exact names provisioned; all enabled.

**Exact steps**

1. Create and publish five uniquely titled announcements, one for each audience: Entire campus, All students, All administrators, Student department=Computer Science, Service department=IT / Network.
2. For each, inspect inboxes in all five account profiles after worker processing.
3. Compare GET /api/announcements with inbox records.

**Expected result:** Inbox matrix below is respected. Student list shows published campus/student/matching academic entries only. Admin management list intentionally shows all audience records, even those that do not target that admin's inbox. Unassigned students do not receive department-targeted items.

**Actual result:**

**Pass/Fail:**

#### ANN-03

- **Test ID:** ANN-03
- **User role:** Admin
- **Preconditions:** A published test announcement exists; record ID AN1.

**Exact steps**

1. POST /api/announcements/AN1/publish again with {}.
2. Refresh each intended recipient inbox; attempt PATCH with edited title/message.
3. Click Archive and inspect student list after its next refresh.

**Expected result:** Repeated publication is idempotent and creates no duplicate inbox entries. Published edits return 409. Archive removes the item from student announcement listing and stops subsequent fanout batches; previously persisted notifications/emails are not recalled. Admin still sees archived state.

**Actual result:**

**Pass/Fail:**

#### ANN-04

- **Test ID:** ANN-04
- **User role:** Student / Admin
- **Preconditions:** S1 signed in; A1 has a draft with department audience.

**Exact steps**

1. S1 POSTs a valid announcement payload to /api/announcements.
2. A1 tries too-short title/content and a department name under two characters via API.
3. Edit an existing draft in UI and inspect audience/department controls.

**Expected result:** Student creation returns 403. Invalid text returns 400; no draft is saved. Audience/department are immutable when editing in this UI; only title/content update. Exact provisioned names are required for targeting; no department lookup or freeform student assignment feature is assumed.

**Actual result:**

**Pass/Fail:**

#### ANN-05

- **Test ID:** ANN-05
- **User role:** Admin / Student
- **Preconditions:** More than 20 test announcements; worker running.

**Exact steps**

1. A1 clicks Older announcements; S1 does so where available.
2. Publish another test entry; wait at least 30 seconds for CampusHub polling.
3. Compare IDs and current role's visibility.

**Expected result:** Cursor pages have no duplicates and opened page count is retained on refresh. Students never see drafts, archives or unmatched audiences. CampusHub announcement lists refresh by polling; they are not promised to update instantly on a socket event.

**Actual result:**

**Pass/Fail:**

### 7. Email delivery and retry handling

#### EML-01

- **Test ID:** EML-01
- **User role:** Student / Operator
- **Preconditions:** [LOCAL] EMAIL_DRIVER=development; S1 unverified; worker running; operator can privately inspect test spool.

**Exact steps**

1. S1 opens Inbox > Email preferences and clicks Send verification email.
2. Operator reads only S1's newest file under PRIVATE_DATA_DIR/mail after worker processing; privately gives the test code to S1.
3. Paste the 64-character code and click Verify; refresh preferences.

**Expected result:** Verification email is queued, a private JSON preview has developmentOnly=true, and no real mail is sent. Verification succeeds and Email verified persists. Code expires in one hour and is consumed; do not paste codes/spool contents into issue reports.

**Actual result:**

**Pass/Fail:**

#### EML-02

- **Test ID:** EML-02
- **User role:** Student
- **Preconditions:** Fresh unverified test account; mind the combined three verification requests/minute limit.

**Exact steps**

1. Request code A then code B, at least a minute between groups of requests if needed.
2. Try A, then B; use a separate unverified fixture for a code aged over one hour without changing DB timestamps.
3. Inspect outcome and any stale queued jobs through operator read-only inspection.

**Expected result:** Superseded/consumed/expired code returns 400. Current B verifies only its own user once. Worker skips jobs with obsolete/expired verification hashes. A 429 means pacing must be corrected, not that expiry passed.

**Actual result:**

**Pass/Fail:**

#### EML-03

- **Test ID:** EML-03
- **User role:** Student / Admin
- **Preconditions:** [MAIL] Resend configured with verified sender, authorized real test mailbox, S1 verified and opted in; worker running.

**Exact steps**

1. A1 changes S1's disposable grievance status.
2. Record new in-app notification and corresponding email job/provider event.
3. Inspect actual mailbox receipt, subject, body and send time.

**Expected result:** A real ordinary notification email reaches the authorized mailbox and contains only a generic inbox update, not grievance text/attachments. In-app notification persists independently. Provider acceptance alone is not mailbox receipt; mark Blocked if credentials/domain/recipient access are missing.

**Actual result:**

**Pass/Fail:**

#### EML-04

- **Test ID:** EML-04
- **User role:** Student / Admin
- **Preconditions:** S1 verified; separate unverified S3; [LOCAL] or [MAIL].

**Exact steps**

1. S1 turns Email me about updates off; A1 changes a disposable S1 report.
2. A1 changes an S3 report.
3. Observe in-app inboxes and processing health/read-only job state; then restore S1 preference.

**Expected result:** Both get their authorized in-app updates; ordinary email jobs for opted-out/unverified accounts become skipped, not failed or done. Verification emails are permitted before verification and are not blocked by ordinary-email opt-out.

**Actual result:**

**Pass/Fail:**

#### EML-05

- **Test ID:** EML-05
- **User role:** Operator / Admin
- **Preconditions:** Dedicated sandbox only; a verified opted-in test account; worker process can be stopped/restarted without affecting anyone else.

**Exact steps**

1. Configure only the test worker for EMAIL_DRIVER=resend with missing/invalid test credentials; queue a generic test update.
2. Run worker and inspect Campus 2.0 > Notification & processing health through five unsuccessful attempts.
3. Correct test worker configuration and restart it; click Retry job on that failed job.
4. Observe transition; restore original sandbox settings.

**Expected result:** Attempts back off approximately 4, 8, 16, 32 seconds before fifth failure, with service latency added. Failed job shows sanitized error; in-app update stays intact. Retry job resets attempts and requeues only failed jobs. It finishes done for a working preview/provider, or fails again if unrepaired. Real inbox success still requires EML-03. Never alter production credentials or expose provider keys.

**Actual result:**

**Pass/Fail:**

### 8. Resolution ratings and written feedback

#### FDB-01

- **Test ID:** FDB-01
- **User role:** Student / Admin
- **Preconditions:** G1 resolved, cycle 1; no existing feedback for it.

**Exact steps**

1. S1 opens Evidence, feedback & details > Resolution feedback.
2. Check Submit feedback is disabled until a star is selected.
3. Select the 5 stars button, enter a benign comment and click Submit feedback; refresh.
4. A1 opens the same workspace.

**Expected result:** One record is stored for that resolution cycle; success notice and Resolution 1 rating/comment persist. Form disappears for the current rated cycle. Admin can read it but cannot submit feedback as the student.

**Actual result:**

**Pass/Fail:**

#### FDB-02

- **Test ID:** FDB-02
- **User role:** Student
- **Preconditions:** Another newly resolved report has no feedback.

**Exact steps**

1. Select 3 stars, leave Written feedback empty and submit.
2. Inspect the displayed entry and GET /api/grievances/{id}/feedback.

**Expected result:** Rating is valid without a comment; UI displays No written feedback. Value is an integer 1-5, not a mandatory five-star score. No edit/delete-feedback feature is exposed.

**Actual result:**

**Pass/Fail:**

#### FDB-03

- **Test ID:** FDB-03
- **User role:** Student / Admin
- **Preconditions:** One active report, one resolved report already rated; record IDs.

**Exact steps**

1. POST rating 0, 6, 2.5 or a string to a fresh resolved test report.
2. POST a valid rating to an active report; replay the rated report's valid submission.
3. Try submitting as A1 or unrelated S2.

**Expected result:** Invalid rating gets 400; unresolved report gets 409; duplicate same-cycle rating gets 409. Admin POST is 403; unrelated student is denied. No extra record or overwritten rating is produced.

**Actual result:**

**Pass/Fail:**

#### FDB-04

- **Test ID:** FDB-04
- **User role:** Student
- **Preconditions:** Fresh resolved report; other profile available.

**Exact steps**

1. Enter literal harmless text <script>TEST_ONLY</script> in Written feedback and submit a valid rating.
2. Refresh as student and admin; inspect rendered text.
3. Try a >2000-character comment through the API recipe on another fresh resolved fixture.

**Expected result:** Text is displayed literally without executing markup. Overlong comment is rejected (400); UI caps input at 2000 characters. Ordinary test text must not contain executable payloads or personal data.

**Actual result:**

**Pass/Fail:**

### 9. Reopening requests, approval and rejection

#### ROP-01

- **Test ID:** ROP-01
- **User role:** Student / Admin
- **Preconditions:** G1 resolved; no pending reopening.

**Exact steps**

1. S1 opens Reopening requests and enters a reason under ten trimmed characters.
2. Enter RUN issue persists after repair and click Request reopening.
3. Refresh student workspace; A1 opens Campus 2.0 > Reopening review queue and clicks Review grievance & decide.

**Expected result:** Short reason cannot be submitted; valid request is pending, form hides while pending and admin queue contains it. Report remains Resolved until approval; request does not automatically reopen it. Admin notifications are persisted.

**Actual result:**

**Pass/Fail:**

#### ROP-02

- **Test ID:** ROP-02
- **User role:** Admin / Student
- **Preconditions:** G1 pending request R1, current matching resolution cycle.

**Exact steps**

1. A1 opens R1's grievance, enters a decision reason of at least three trimmed characters and clicks Approve reopening.
2. Refresh as S1; inspect history, feedback and linked incident.
3. Inspect admin queue after refresh.

**Expected result:** Request approved with reason/date; report becomes In Progress and resolvedAt clears, but cycle number does not advance until another resolution. Old feedback remains. Incident derives status again; queue no longer lists R1. Student gets decision notification.

**Actual result:**

**Pass/Fail:**

#### ROP-03

- **Test ID:** ROP-03
- **User role:** Admin / Student
- **Preconditions:** Separate resolved report with pending R2.

**Exact steps**

1. A1 enters a valid reason and clicks Reject request.
2. Refresh both profiles; inspect report state and student decision text.
3. As S1 submit a new reason for that still-resolved cycle, if desired.

**Expected result:** R2 rejected and report stays Resolved; decision reason is visible and student notified. Rejection is final for that request, but uniqueness applies only to pending requests, so a later request for the cycle is allowed. No invented permanent rejection lock is expected.

**Actual result:**

**Pass/Fail:**

#### ROP-04

- **Test ID:** ROP-04
- **User role:** Student / Admin
- **Preconditions:** Pending R3 on a resolved report; two A1 admin tabs; all payload IDs recorded.

**Exact steps**

1. Attempt a second pending request for that report/cycle as owner.
2. From the two admin tabs submit opposite decisions as close together as possible, each with a valid reason.
3. Replay a decision against the decided request; try the decision endpoint as S1.

**Expected result:** Duplicate pending submission returns 409. Only one admin decision wins; the loser/replay receives 409, not a second transition. Student decision attempt gets 403. Final grievance, request and incident reflect the committed winning decision.

**Actual result:**

**Pass/Fail:**

#### ROP-05

- **Test ID:** ROP-05
- **User role:** Student / Admin
- **Preconditions:** ROP-02 approved; G1 In Progress with cycle-1 feedback.

**Exact steps**

1. A1 resolves G1 again from Live Feed.
2. S1 opens workspace, submits 1-star cycle-2 feedback with a different comment.
3. Inspect both feedback entries, status history and GET detail.

**Expected result:** Second resolution advances cycle to 2 and permits one new rating; cycle-1 record is retained. UI labels Resolution 1 and Resolution 2; old feedback is not overwritten. New reopening requests bind to the current cycle.

**Actual result:**

**Pass/Fail:**

### 10. Analytics and resolution-cycle reporting

#### ANL-01

- **Test ID:** ANL-01
- **User role:** Admin
- **Preconditions:** Dedicated clean test cohort: two reports in same department resolved once, ratings 5 and 3; a third resolved but unrated; all in current range.

**Exact steps**

1. Open Campus 2.0 > Department satisfaction with default dates/history unchecked.
2. Compare chart/table and GET /api/analytics/satisfaction to the fixture ledger.

**Expected result:** Department has average 4, Responses 2, Resolutions 3, response rate 66.7%, distribution one 3-star and one 5-star. Unrated report is excluded from average, included in resolution denominator. If other fixtures exist, calculate expected totals including them rather than assuming these exact totals.

**Actual result:**

**Pass/Fail:**

#### ANL-02

- **Test ID:** ANL-02
- **User role:** Admin
- **Preconditions:** One report has cycle-1 rating 5 and cycle-2 rating 1; both resolution times in selected range.

**Exact steps**

1. Choose a From/To covering both resolutions, leaving Include historical resolution feedback unchecked.
2. Record department results; check Include historical resolution feedback.
3. Inspect API history=false versus true and your exact cohort.

**Expected result:** Default feedback includes only current resolutionCycle; history=true includes both cycle records and historical resolution events. A reopened but not yet re-resolved report can retain its current-cycle feedback because filtering is by cycle, not current status. Counts, denominator and averages match the chosen cohort.

**Actual result:**

**Pass/Fail:**

#### ANL-03

- **Test ID:** ANL-03
- **User role:** Admin
- **Preconditions:** Known resolution timestamps and reopening creation times; optional legacy fixture prepared in advance, not by editing live data.

**Exact steps**

1. Set dates that exclude the cohort, then dates that include it.
2. Set From after To and inspect error; restore a valid range.
3. Compare Reopen / approved values to requests created in range and legacy flag in API.

**Expected result:** Invalid range returns 400 and visible error. Feedback is filtered by its resolvedAt, resolution totals by history.at, reopening counts by request createdAt. Response rate is null when denominator is zero. Unknown historical resolution dates are excluded; legacyResolutionDatesExcluded=true. UI date boundaries use browser-local dates converted to ISO.

**Actual result:**

**Pass/Fail:**

#### ANL-04

- **Test ID:** ANL-04
- **User role:** Admin / Student
- **Preconditions:** Existing test reports/incidents; tile CDN access for map; microphone test optional.

**Exact steps**

1. A1 visits Overview, Live Feed, Incidents, Campus Radar, Analytics and Early Warnings.
2. Open an incident and a linked grievance, inspect existing charts/map and computed priority reasons.
3. For warnings use at least three recent active matching category/location reports within 12 hours; resolve them and refresh.
4. S1 tries GET /api/analytics and /api/incidents.

**Expected result:** Existing dashboard features remain usable, charts/radar do not crash after Next upgrade; warnings appear for qualifying groups and disappear as active group falls below threshold. Student admin analytics/incidents APIs are denied (403). Map tile/network failure is recorded separately from permission behavior.

**Actual result:**

**Pass/Fail:**

### 11. Socket.IO notifications, reconnect and logout

#### SOC-01

- **Test ID:** SOC-01
- **User role:** Student / Admin
- **Preconditions:** Custom server via npm run dev (not next dev); S1/S2/A1 separate profiles; DevTools WS/Network open.

**Exact steps**

1. Observe authenticated /api/socket handshake/transport in all profiles.
2. A1 changes S1's report while S1 inbox is open.
3. Inspect notification:changed and grievance:statusChanged frames and S1 state; compare unrelated S2.

**Expected result:** Owner status and inbox update without reload; S2 receives no private S1 status/notification payload. Admin receives authorized admin events. Inbox is persisted and re-fetched on invalidation; socket events are not the notification database. Long-poll fallback is allowed if upgrade is unavailable.

**Actual result:**

**Pass/Fail:**

#### SOC-02

- **Test ID:** SOC-02
- **User role:** Student / Admin
- **Preconditions:** S1 profile can be put offline while A1 remains online.

**Exact steps**

1. Put only S1 DevTools offline; A1 performs two distinct report transitions that create notifications.
2. Restore S1 online and observe connect/re-fetch, then refresh once.
3. Block only socket traffic while leaving HTTP enabled; produce another update and wait over 30 seconds.

**Expected result:** Reconnect reconciles missed persisted notifications/status; no duplicates or permanently lost unread count. With socket down, NotificationCenter's 30-second polling still recovers inbox/count. This is not an offline-write queue; mutations made offline may fail.

**Actual result:**

**Pass/Fail:**

#### SOC-03

- **Test ID:** SOC-03
- **User role:** Student
- **Preconditions:** Two tabs in the same S1 browser profile; S2 credentials.

**Exact steps**

1. Open S1 inbox in both tabs; sign out in one.
2. Observe other tab, attempt an API read, and wait at most roughly 30 seconds for socket revalidation if necessary.
3. In one tab sign in as S2; create S1-only activity from another profile and inspect S2 connection.

**Expected result:** Logout revokes that server session and disconnects its room; stale tab API returns 401 even if rendered content remains. Login switches identity and revokes the prior cookie session; old socket must not deliver new S1 events to S2. No assumption of immediate cross-tab UI navigation is made.

**Actual result:**

**Pass/Fail:**

#### SOC-04

- **Test ID:** SOC-04
- **User role:** Student / Operator
- **Preconditions:** Dedicated test session; real-time capture tools; naturally aged 24-hour session or signed-out profile.

**Exact steps**

1. Without copying cookies into reports, retry socket connection signed out and with an expired session.
2. For a still-open connection at natural expiry, observe it after token expiry.
3. Using a controlled Socket.IO client, send join payload naming admin-room while authenticated as S1.

**Expected result:** Unauthenticated/expired handshake fails with Authentication required; expiry disconnects an existing socket. Client join payload cannot select privileged rooms (server treats join as acknowledgement only). No S1 access to admin events. Do not generate/forge signing keys or alter session timestamps for this guide.

**Actual result:**

**Pass/Fail:**

### 12. Desktop, tablet, mobile and accessibility

#### UI-01

- **Test ID:** UI-01
- **User role:** Student / Admin
- **Preconditions:** Test at 1440x900 and 1024x768; normal and slow-network profiles.

**Exact steps**

1. On both portals open Inbox, grievance workspace and evidence previews.
2. On admin visit every tab and Department satisfaction chart/table.
3. Resize while dialogs are open; check long fixture descriptions and filenames.

**Expected result:** Header/actions remain reachable; cards, charts, previews and status controls are legible without overlap/clipping. Existing dark/glass visual design is preserved. Record console/runtime errors; content loading/error states do not get mistaken for empty successful data.

**Actual result:**

**Pass/Fail:**

#### UI-02

- **Test ID:** UI-02
- **User role:** Student / Admin
- **Preconditions:** Browser device emulation at 768x1024 and 390x844 (also 360px width); optional physical devices.

**Exact steps**

1. Repeat register/login, report upload, inbox read/preferences, feedback and reopening at each width.
2. As admin horizontally scroll tab bar to Campus 2.0; inspect announcement controls and satisfaction table.
3. Rotate device/emulation and open on-screen keyboard on a textarea.

**Expected result:** Essential actions remain reachable, text wraps, dialogs scroll vertically, media fits container and page has no unintended sideways overflow. Admin tab bar and satisfaction table may intentionally scroll horizontally. Inbox text may hide on narrow widths, leaving an accessible bell/count.

**Actual result:**

**Pass/Fail:**

#### UI-03

- **Test ID:** UI-03
- **User role:** Student / Admin
- **Preconditions:** Keyboard-only desktop test; browser accessibility tree available.

**Exact steps**

1. Tab from portal header into Inbox; open dialog and inspect focus.
2. Tab/Shift+Tab through controls, press Escape to close; repeat grievance workspace.
3. Activate star rating using keyboard and inspect accessible names/pressed state; focus file/error controls.

**Expected result:** Dialog focus trapping/restoration and Escape behavior follow implemented Dialog controls; actions are keyboard reachable and labelled. Stars expose 1 star through 5 stars and pressed selection. If visual star glyphs are corrupted/missing while accessible labels work, record an actual UI defect rather than passing based on labels alone.

**Actual result:**

**Pass/Fail:**

#### UI-04

- **Test ID:** UI-04
- **User role:** Student / Admin
- **Preconditions:** Empty fresh student account and populated admin; throttle Slow 3G; failures can be blocked per request.

**Exact steps**

1. Load each portal and open grievance workspace under throttling.
2. Visit empty inbox/announcement/evidence/feedback/request states.
3. Block one relevant GET, observe error and Retry where exposed; unblock and retry/reopen.

**Expected result:** Loading grievance is shown until data arrives; empty states are readable. Errors remain distinguishable from successful empty results. Admin/CampusHub/feed Retry controls recover where implemented; other panels may recover via reopen/poll. Do not invent a universal Retry button or claim every panel has a skeleton.

**Actual result:**

**Pass/Fail:**

### 13. Invalid input, security and failure paths

#### ERR-01

- **Test ID:** ERR-01
- **User role:** Student
- **Preconditions:** Valid active G2; fixtures listed below; worker running.

**Exact steps**

1. In Add evidence select zero-byte file, unsupported GIF/text/ZIP, image over 10 MiB, PDF over 20 MiB and MP4 over 100 MiB.
2. If file picker filters extensions, choose All files or use an API intent with explicit MIME/size/checksum.
3. Also try validly named PNG containing non-image bytes, encrypted/incomplete PDF, >40-megapixel image and MP4 over 600 seconds.

**Expected result:** Unsupported/empty/oversize metadata is rejected before hashing/upload (UI error; API 415 for unsupported MIME, 413 for invalid/oversized size, 400 for invalid checksum). Format/content/container failures are rejected by worker and never accessible. Rejected attachment state differs from admin review=rejected. File extension alone is not sufficient.

**Actual result:**

**Pass/Fail:**

#### ERR-02

- **Test ID:** ERR-02
- **User role:** Student / Admin
- **Preconditions:** Dedicated quota report; ten small valid files, plus suitable valid under-limit MP4s for total-size test; pace attachments to <=15 intents/minute.

**Exact steps**

1. Upload ten valid attachments via workspace/initial form.
2. Try an eleventh; remove an unreviewed attachment and retry.
3. On a separate report attempt total active evidence above 200 MiB with individually valid files.

**Expected result:** Eleventh reservation or aggregate excess is 413 Grievance evidence quota reached. Removed/security-rejected files release quota; admin review rejection alone does not. Concurrent reservations must not exceed quota. A 429 is a pacing issue, not a quota result.

**Actual result:**

**Pass/Fail:**

#### ERR-03

- **Test ID:** ERR-03
- **User role:** Operator / Student / Admin
- **Preconditions:** [SCAN] Dedicated maintained private ClamAV instance, approved benign antivirus fixture in a supported valid media container; scanner logs allowed.

**Exact steps**

1. Upload valid clean fixture and observe scan=clean.
2. Upload approved EICAR test content embedded in a still-valid PDF/container; observe rejection without opening it.
3. Stop only sandbox scanner or point sandbox worker at unavailable port; upload clean fixture and observe retries/final health error; restore scanner and Retry job.

**Expected result:** Actual clean file releases; infected file remains inaccessible. Scanner outage never releases evidence; after five failed attempts it remains processing with Security checks are unavailable and an admin-retry path. A plain .txt/.com EICAR is rejected earlier and cannot prove scanner integration. Never use real malware or weaken endpoint protection; mark Blocked if safe scanner fixture is unavailable.

**Actual result:**

**Pass/Fail:**

#### ERR-04

- **Test ID:** ERR-04
- **User role:** Student / Admin
- **Preconditions:** Controlled API client using S1's sandbox cookie privately; use only test IDs.

**Exact steps**

1. GET /api/grievances/not-an-id and a valid-format nonexistent ID.
2. Send POST feedback/preferences with malformed JSON, JSON array, wrong content type and bounded >32-KiB JSON body.
3. Send cookie-authenticated PATCH /api/notifications/read-all with missing Origin, hostile Origin and then correct Origin.

**Expected result:** Malformed ID returns 400; nonexistent authorized lookup 404. Malformed/non-object JSON returns 400, wrong content type 415, oversized JSON 413. Missing/hostile origin cookie writes get 403; same-origin valid request works. Errors do not include stack traces, secrets or unrelated report contents. Browsers may enforce CORS before API response, so use controlled client for exact status.

**Actual result:**

**Pass/Fail:**

#### ERR-05

- **Test ID:** ERR-05
- **User role:** Student / Admin
- **Preconditions:** Dedicated test accounts with naturally expired session or a saved previous session privately retained before normal logout; no DB timestamp edits.

**Exact steps**

1. After natural 24-hour expiry, call /api/auth/me and a protected mutation.
2. Try POST /api/auth/logout with proper Origin and expired cookie, then sign in again.
3. For a disabled-account fixture prepared by operator before this run, try login and existing protected reads.

**Expected result:** Expired/revoked/disabled sessions fail protected reads/writes with 401; expired-cookie logout can still return 200 and clear it. Disabled or wrong-password login uses generic Invalid email or password. There is no password-reset/session-management/disable-account UI in this test scope.

**Actual result:**

**Pass/Fail:**

#### ERR-06

- **Test ID:** ERR-06
- **User role:** Student
- **Preconditions:** Only sandbox server/profile; account login budget otherwise unused.

**Exact steps**

1. Use controlled client to make 21 wrong-password login attempts for a single test account within one minute.
2. Try a different test account login; wait for next minute window and retry the original correctly.
3. On disposable report create 11 submissions/minute only if budget/data permit; otherwise mark that portion Blocked.

**Expected result:** Login account budget is 20/minute; excess returns 429 and does not block an unrelated account under the coarse 1000/minute network budget. Grievance budget is 10/minute, attachment intents 15/minute, most v2 mutations 60/minute, verification send/consume combined 3/minute. Rate tests are isolated and must not load shared services.

**Actual result:**

**Pass/Fail:**

#### ERR-07

- **Test ID:** ERR-07
- **User role:** Student / Admin / Operator
- **Preconditions:** Sandbox app and worker processes, test data only; operator may interrupt own worker.

**Exact steps**

1. Stop sandbox worker, upload one file and publish a test announcement; inspect state before restart.
2. Restart worker; observe eventual clean/fanout/email processing.
3. For crash recovery, terminate the test worker during a large test job, restart and wait beyond its five-minute lease if needed; inspect job and recipient IDs read-only.

**Expected result:** Queued work waits without being falsely labelled complete. Worker resumes pending/expired-lease work, with no duplicated inbox entries; clean publication is fenced by lease and candidate keys reused. Do not promise exactly-once external email. A storage cleanup failure must not permanently stop unrelated jobs; exercise only with an isolated fault proxy, otherwise mark that fault subcase Blocked.

**Actual result:**

**Pass/Fail:**

## Known limitations, blocked tests and sign-off

- Local/development drivers are safe alternatives for behavior tests, not proof of S3, actual mail receipt or real malware scanning. Production refuses them. EVD-07 is blocked without S3; EML-03 without Resend/domain/recipient mailbox; actual clean/infected scanner assertions in ERR-03 without maintained ClamAV and an approved fixture.
- Current validation records 76 automated tests plus a disposable MongoDB workflow and upgraded build passing. Those do not prefill this manual worksheet. No authenticated browser acceptance/external service certification was claimed in VALIDATION.md.
- Naturally aged 24-hour sessions, one-hour intent/code expiry and delayed deletion may require a later observation session. Do not edit clocks/timestamps or signing keys to fake expiry. Capture exact observation time; mark uncompleted portions Blocked.
- Signed reads last 60 seconds; original upload grants and intents have separate lifetimes. Existing signed reads cannot be revoked instantly; new app authorization is always checked.
- Security state clean/rejected is distinct from admin review accepted/rejected. Admin review rejection retains accessible evidence for its owner/uploader and admin. Student can remove only their own pending-review evidence; admin removal is broader.
- Anonymous records retain internal ownership; admin-facing DTOs hide it. Identifying words/content, PDF/video metadata, external storage access logs or a user's own shared URL can still reveal identity. No forensic anonymization is promised.
- PDF iframe and MP4 codecs depend on browser support; Open file is available, not a guarantee every browser can decode every format. Media checks are bounded container checks, not complete parsers/transcoding.
- Email is at-least-once with a finite provider idempotency window. In-app notifications deduplicate by recipient/event; do not claim exactly-once external email. Archive does not recall already delivered notifications.
- Inbox polls every 30 seconds and reconnects reconcile; evidence polls every five seconds; CampusHub polls every 30 seconds. Dashboard report refresh also uses socket events. Do not treat delayed polling as instant event delivery.
- Single app instance is the supported baseline; multi-instance Socket.IO needs a shared adapter/load-balancer setup outside this guide. Custom server and worker are both required.
- Existing classification/priority/warnings are transparent rules, not trained AI. Priority ageing is not continuously rescheduled. No invented search/filter UI, push-to-device notifications, email link magic login, feedback editing, student department editor or password-reset flow is tested.
- Six moderate development lint-tool findings remain through minimatch; production-only dependency audit was clean at review. Track compatible upstream remediation; do not force a new dependency major as part of manual acceptance.
- Migration twice/backup rollback, CI, production proxy and external integration certification remain operational release gates in VALIDATION.md. This worksheet does not authorize DB changes, remote pushes, merges or deployments.

| Sign-off item | Record |
|---|---|
| Completed cases / outstanding IDs | |
| Failures with reproduction and sanitized evidence | |
| Blocked cases and missing setup/credentials | |
| External service checks actually observed | |
| Browser/device coverage actually observed | |
| Data/environment owner confirms isolation | |
| Reviewer / decision / date | |

Release review must distinguish functional failures from blocked prerequisites. Leave unavailable cases unpassed and follow the remaining gates in [VALIDATION.md](docs/VALIDATION.md); do not infer production readiness solely from this guide or a green automated build.
