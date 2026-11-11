# CampusPulse 2.0 API

All private endpoints require the HttpOnly `cp_session` cookie. Cookie-authenticated writes require an exact same-origin `Origin` header. JSON operations require `application/json`; request JSON is bounded to 32 KB. IDs are MongoDB ObjectIds. Errors are JSON `{ error }` with 400/401/403/404/409/413/415/416/429/503 as appropriate. Private responses are no-store.

## Existing endpoints

- `POST /api/auth/register`: name, email, password (10 characters minimum, 72 UTF-8 bytes maximum); always student-only.
- `POST /api/auth/login`: email/password. Sets session cookie; returned `token` is a noncredential UI marker.
- `GET /api/auth/me`, `POST /api/auth/logout`: active account / revoke current session.
- `POST /api/auth/email-verification`: `{}` requests email; `{ token }` redeems one-time code.
- `GET /api/grievances?limit=20&cursor=<id>`: own or admin feed, `nextCursor`, total/active summary.
- `POST /api/grievances`: existing text/severity/anonymity/source inputs. Optional UUID `Idempotency-Key` deduplicates retries.
- `GET /api/grievances/[id]`: owner/admin access, anonymous admin DTO.
- `PATCH /api/grievances/[id]`: admin `{ status }`; resolved grievances require approved reopening.
- `GET /api/incidents`, `GET /api/incidents/[id]`, `GET /api/analytics`: existing admin functionality.

## Evidence

- `GET /api/grievances/[id]/attachments`: authorized metadata; no object keys or uploader identity in response.
- `POST /api/grievances/[id]/attachments`: `{ name, mime, size, checksum }`, checksum is hex SHA-256. Returns attachment, driver, uploadUrl and optional uploadFields. Local: PUT raw file bytes. S3: POST multipart fields and append `file` last. Ten active files / 200 MB total per grievance.
- `PUT /api/attachments/[attachmentId]/upload`: local-development raw upload, uploader only, bounded to declared size.
- `POST /api/attachments/[attachmentId]/complete`: uploader only; enqueue processing, idempotent for processing/clean state.
- `GET /api/attachments/[attachmentId]/access`: authorized clean bytes; local range response or short S3 redirect.
- `PATCH /api/attachments/[attachmentId]/review`: admin `{ review: accepted|rejected, reviewNote }`; reason required for rejection.
- `DELETE /api/attachments/[attachmentId]`: uploader for unreviewed evidence, or admin; schedules storage removal. Reviewed evidence requires admin removal.

Accepted formats: JPEG/PNG/WebP 10 MB, PDF 20 MB, MP4 100 MB. Images up to 40 megapixels; MP4 up to ten minutes with readable duration. Scanning is separate from administrative review. An administrative rejection does not erase the uploader's evidence/history.

## Notifications and announcements

- `GET /api/notifications?cursor=&limit=&unread=true`: recipient-only inbox.
- `GET /api/notifications/unread-count`.
- `PATCH /api/notifications/[id]/read`, `PATCH /api/notifications/read-all`: recipient-only idempotent actions.
- `GET/PATCH /api/notifications/preferences`: read preferences; PATCH `{ emailNotifications: boolean }`.
- `GET /api/announcements`: audience-filtered for student, management list for admin, cursor pagination.
- `POST /api/announcements`: admin draft `{ title, message, audience, department? }`.
- `PATCH /api/announcements/[id]`: admin draft title/message edit.
- `DELETE /api/announcements/[id]`: admin archive; does not erase previously delivered inbox entries.
- `POST /api/announcements/[id]/publish`: admin idempotent publication/fanout enqueue.
- `GET /api/notifications/delivery`: admin job counts and sanitized failures; POST `{ id }` retries a failed job.

Audiences: `campus`, `students`, `admins`, `academic-department`, `service-department`. Department audiences require an exact trusted department value. Publishing targets current eligible users in worker batches; accounts created after fanout completes can read matching published announcements but receive no retroactive inbox entry.

## Feedback and reopening

- `GET /api/grievances/[id]/feedback`: owner/admin history.
- `POST /api/grievances/[id]/feedback`: resolved owner only `{ rating: 1..5, comment? }`; one record per resolution cycle.
- `GET /api/grievances/[id]/reopen-requests`: owner/admin history.
- `POST /api/grievances/[id]/reopen-requests`: resolved owner only `{ reason }` (10–2000 characters); one pending request per cycle.
- `GET /api/reopen-requests`: admin pending queue with anonymous-safe report details, cursor pagination.
- `POST /api/reopen-requests/[id]/decision`: admin `{ state: approved|rejected, decisionReason }`. Only one concurrent decision succeeds. Approval transitions report to In Progress and resynchronizes incident.
- `GET /api/analytics/satisfaction?from=<ISO>&to=<ISO>&history=true|false`: admin department averages, distributions, response counts/rates and reopening counts. Ratings are attributed to the resolution-date cohort. Unknown historical resolution dates are excluded; unrated reports are not zero stars.

## Socket contract

`/api/socket`, same-origin authenticated cookie handshake. Rooms are assigned by the server: `user:<id>`, `session:<id>`, optional `admin-room`. Browser role flags are ignored. Existing `join` is a harmless compatibility event; malformed payloads do not throw. No client event can join another user's room.

Existing events: `grievance:new`, `grievance:statusChanged`, `incident:updated`. Added: `notification:changed` (invalidation, retrieve persisted inbox). Clients reconcile on reconnect and poll. Token expiry disconnects the socket; account/session status is also revalidated every 30 seconds. Logout explicitly disconnects the current session's sockets. Room state is never reused for a new account.
