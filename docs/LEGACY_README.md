# CampusPulse

Intelligent network-based student grievance & campus issue management system.
(Renamed from "GrievanceNet" per project requirements — same feature set.)

## What this actually is

A real Next.js + TypeScript + MongoDB + Socket.IO application matching every
feature in the CNT project brief. It is **not pre-tested in this environment**
— the sandbox that generated it has no network access, so nothing here has
been run against a live database. You need to run it yourself.

## Setup

```bash
cd campuspulse
npm install
cp .env.example .env.local
# edit .env.local: paste your MongoDB Atlas connection string and a JWT secret
npm run dev
```

Then open `http://localhost:3000`. Register one account with role **student**
and one with role **admin** (the register form has a role toggle).

## Security — admin accounts

Public `/register` only ever creates **student** accounts. The registration
API (`src/app/api/auth/register/route.ts`) does not read a `role` field from
the request body at all — even a hand-crafted request (Postman, curl,
devtools) cannot create an admin this way, because the field is never
looked at, not merely validated.

The only sanctioned way to create or promote an admin account is:

```bash
node scripts/create-admin.js "Full Name" admin@campus.edu "a-strong-password" "IT / Network"
```

Run this by hand, on a trusted machine, against your own `MONGODB_URI` — it
is a standalone script, not an HTTP endpoint, so it is never reachable from
the deployed app. Existing admin accounts (created before this fix, or via
the script) are untouched and continue to log in normally: `/api/auth/login`
has always sourced `role` from the stored database record, never from the
client, so nothing about login changed.

Every admin-only API route (`/api/incidents`, `/api/incidents/[id]`,
`/api/analytics`, `PATCH /api/grievances/[id]`) independently verifies the
JWT server-side and checks `role === "admin"` from the token's signed
payload — a student can't reach these by editing `localStorage` or the
`/admin` page's client-side redirect, since that's UI convenience, not the
actual security boundary. Socket.IO's `admin-room` join works the same way,
verified from the JWT in `server.js`, not from a client-sent flag.

## Feature -> file map (for your report / viva)

| PDF feature | Where it lives |
|---|---|
| Smart classification (category/location/department) | `src/lib/classification.ts` |
| Duplicate/similar complaint detection | `src/lib/similarity.ts` (Jaccard similarity) |
| Incident clustering ("Block C Network Failure") | `src/lib/incidentEngine.ts`, `src/models/Incident.ts` |
| Smart Priority System (0-100 score) | `src/lib/priority.ts` |
| Campus Issue Radar (hotspot map) | `src/components/CampusMap.tsx`, `src/lib/campusMap.ts` |
| Real-time resolution updates | `server.js` (Socket.IO), `src/app/api/grievances/[id]/route.ts` |
| Voice grievance (Web Speech API) | `src/components/VoiceInput.tsx` |
| Anonymous grievances | `isAnonymous` field end-to-end in `Grievance` model + form |
| Admin analytics | `src/app/api/analytics/route.ts`, `src/components/AnalyticsCharts.tsx` |
| Early-warning / issue prediction | `src/lib/earlyWarning.ts` (rule-based: ≥3 same-category/location complaints within 12h), surfaced via `src/components/EarlyWarningPanel.tsx` |
| JWT auth, role-based access | `src/lib/auth.ts`, all API routes check `verifyToken`; Socket.IO also verifies the JWT itself in `server.js` before joining any room |
| Incident status sync | `syncIncidentStatus()` in `src/lib/incidentEngine.ts` — Resolved only once every linked grievance is resolved |
| Priority explanation | `explainPriority()` in `src/lib/priority.ts`, persisted per-grievance and shown on click in the admin live feed |
| Incident clustering detail | `GET /api/incidents/[id]` + `src/components/IncidentDetailModal.tsx` — click an incident to see every linked report |

## Demo script (matches the PDF's recommended scenario)

1. Log in as a student. Submit: *"WiFi not working in Block C"*.
2. Log in as a second student (or use a private window). Submit: *"Internet
   connection is down in C block"*.
3. Submit a third: *"Can't connect to campus WiFi near Block C"*.
4. Log in as admin → **Incidents** tab: the three reports have merged into
   one "Block C Network Issue" with rising severity.
5. **Campus radar** tab: Block C shows as a red hotspot.
6. Move the incident's grievances from Pending → In Progress → Resolved from
   the **Live feed** tab. Switch back to the student's browser tab — the
   status updates without a refresh (Socket.IO push).

## Known gaps to close before submission

- No password-reset flow (out of scope for the PDF, but examiners may ask).
- Leaflet's dark tile layer depends on CARTO's public tiles; if your demo
  network blocks that, swap the `TileLayer` URL in `CampusMap.tsx` for any
  tile provider you have access to.
- `priorityReasons` reflect the situation at submission time; they aren't
  recalculated later if the incident grows further, so an old report's
  stated reasons can lag behind its current linked-report count.
- `clusterAndScore`'s existing-incident lookup has one theoretical edge
  case: if the incident a related grievance points to was deleted between
  the similarity search and the lookup, the new grievance won't be linked
  to any incident even though `affectedCount` still reflects the match.
  Rare in practice; flagged here rather than silently patched, since it
  touches the incident engine you asked not to rebuild.

## Enhancement pass — what changed since the first build

See the end of this conversation for the full changelog. In short: real-time
admin refresh now covers incidents/analytics/hotspots (not just the raw
feed), anonymous grievances keep their database ownership so students never
lose their own anonymous reports, `GET /api/grievances/[id]` is now properly
authorized (401/403/404), incident status stays derived from its grievances,
a rule-based Early Warning panel was added, priority reasoning is now
persisted and viewable, incident clustering has a detail view, the campus
radar has a legend and click-through popups, and Socket.IO room membership
is now decided server-side from a verified JWT instead of a client-supplied
flag.

## Final visual pass

The admin and student dashboards were redesigned around a glassmorphism
"command center" aesthetic (`glass-card` / `glass-card-hover` utilities in
`globals.css`): translucent panels, staggered card entrance animations,
animated KPI counters, a toast notification layer for real-time events,
skeleton loading states on first fetch, and a critical-priority glow pulse.
No new npm dependency was added for icons — `src/components/Icons.tsx` is a
small hand-rolled inline-SVG set, deliberately avoiding an extra
install-time dependency after the earlier Mongoose/TypeScript build issue.
The admin dashboard gained an **Overview** tab (KPI strip, Early Warnings,
top incidents, trend chart, radar) alongside the existing Live Feed,
Incidents, Campus Radar, and Analytics tabs, plus a dedicated Early Warnings
tab. The student dashboard gained a hero section with a "Report an issue"
CTA that scrolls to the form.
