# CampusPulse 2.0

Student grievance intelligence built with the existing Next.js App Router, TypeScript, Tailwind CSS, MongoDB/Mongoose, custom Node server and Socket.IO.

## What is implemented

- Existing student/admin dashboards, text and voice grievances, anonymous tracking, keyword classification, priority reasons, incident clustering, map, analytics and rule-based warnings.
- Private image, MP4 and PDF evidence: initial/additional uploads, progress/cancel, previews, security-processing state and admin review.
- Student/admin notification inbox, unread counts, read tracking, campus/department announcements, preferences and verified-recipient email jobs.
- Five-star resolution ratings, written feedback, reopening requests and admin decisions, resolution history and department satisfaction reporting.
- HttpOnly revocable sessions, current-account permissions, CSRF origin checks, input bounds, MongoDB rate limits, privacy-safe DTOs and authenticated sockets.
- Durable processing/email jobs with retry/lease handling; additive migration, tests and CI configuration.

**Release status:** code and local checks are available; Next.js is upgraded to 15.5.29; production deployment remains gated on production configuration, real integrations and staging browser acceptance. See [validation](docs/VALIDATION.md). Nothing has been deployed or pushed to main.

## Run locally

Use Node 22+ and MongoDB Atlas or a local **replica set**. Existing environment values should be preserved; only copy the example if you do not already have an environment file.

```powershell
npm ci
Copy-Item .env.example .env.local
# Configure MONGODB_URI, a generated JWT_SECRET and APP_ORIGIN.
npm run migrate
npm run migrate -- --apply
npm run dev
```

In another terminal:

```powershell
npm run worker
```

Open the configured APP_ORIGIN, normally http://localhost:3000. All users need to sign in again after the session upgrade. Initial evidence is selected in the report form; additional evidence, feedback and reopening are in each grievance's detail workspace. Both portals have an Inbox button. Administrators also have a Campus 2.0 tab for announcements, reopening review, satisfaction and job health.

Local development stores files outside public assets, writes email previews privately, and visibly labels files that have not undergone real malware scanning. These substitutes are refused in production.

## Administration

```powershell
node scripts/create-admin.js "Administrator" admin@campus.edu "a-long-unique-password" "IT / Network"
npm run department -- student@campus.edu academic "Computer Science"
```

Public registration only creates student accounts. Department assignments are operator-managed. Existing admins retain campus-wide grievance permissions.

Development output is isolated in `.next-dev`; normal `npm run build` prepares a clean `.next` production output. See [post-map stabilization](docs/STABILIZATION.md) for the recovered runtime/build issues and actual browser checks.

## Verify

```powershell
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run build
npm run preflight
```

Run `npm run test:local-integration` for an isolated disposable replica set, or supply an explicitly disposable TEST_MONGODB_URI. Lint runs ESLint with Next.js and React hooks rules; `npm run check:syntax` is separate. Production preflight intentionally fails until production integrations and HTTPS are configured.

## Documentation

- [Setup, storage, scanning, email, migration and rollout](docs/OPERATIONS.md)
- [API and Socket.IO contract](docs/API.md)
- [Automated and staging acceptance tests](docs/TESTING.md)
- [Security boundaries and limitations](docs/SECURITY.md)
- [Validation results and remaining release gates](docs/VALIDATION.md)
- [Review findings and fixes](docs/POST_IMPLEMENTATION_REVIEW.md)
- [Earlier project documentation](docs/LEGACY_README.md)

Classification and warnings remain transparent rules, not trained ML models. Existing colors, glass cards, charts, map and voice interface have been retained.
