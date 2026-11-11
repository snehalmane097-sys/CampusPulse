# Security boundaries

- Public registration never accepts administrative roles. Admin provisioning and department assignment are trusted operator commands.
- HttpOnly SameSite=Strict sessions replace browser-stored JWT credentials. Production cookies are Secure. API and Socket.IO authentication load the current account/session from MongoDB, reject disabled accounts and enforce expiration. Existing users must sign in again.
- Cookie-authenticated mutations check exact Origin; JSON endpoints enforce content type and bounded streaming reads. Database-backed rate counters are shared across workers. Configure a trusted proxy before enabling forwarding-header use.
- Students access only their own grievances, evidence, feedback and reopening records, and only their own notifications. Admins retain existing campus-wide access. All write roles are enforced server-side.
- Anonymous ownership remains in the database for tracking, but admin DTOs strip student identifiers and history actors. Evidence DTOs hide uploader/storage keys and replace filenames on anonymous reports. Feedback and reopening DTOs expose no student reference. User-supplied report/file contents can still identify a person; anonymity is not forensic anonymization.
- File bytes never live under public assets. Upload intents reserve quotas, signed S3 POST policies restrict uploads, checksums/container checks and ClamAV gate release. Clean objects use a separate key. Scanner failure is fail-closed. Administrative review state is distinct from malware scan state.
- Signed download URLs grant access for up to 60 seconds and cannot be immediately revoked after issuance. They must not appear in logs. Public bucket access must remain blocked.
- Notifications/outbox writes share MongoDB transactions with report transitions. Resolution cycles preserve feedback history; approved reopening goes through the same service and derives incident status again.
- CSP, nosniff, framing, referrer and production HSTS headers are configured. Inline scripts/styles remain allowed for the existing Next.js/Tailwind/Leaflet UI; nonce-based CSP can be a later hardening step. New content is rendered as text, never injected HTML. PDF previews use a sandboxed frame; browser support varies and Open file is available.
- Do not expose ClamAV TCP, private-data directories or a database directly to the internet. Rotate secret material, restrict S3 IAM permissions and provider API keys, and operate a backup/retention policy.

## Known release blockers and limits

Next.js is upgraded to 15.5.29 with normal peer resolution, alongside compatible Mongoose/Socket.IO/PostCSS updates. See VALIDATION.md for the final dependency audit. Preflight refuses incomplete production configuration; it does not certify service connectivity.

Disposable replica-set transaction/concurrency tests and dependency auditing are run locally as recorded in VALIDATION.md. Real storage, actual email delivery, a real scanner and staging browser acceptance remain required. No penetration test or external-service certification is claimed. The service architecture is single app-instance until a shared Socket.IO adapter is introduced. Media validation checks container metadata, not every codec or arbitrary document structure; malware scanning and access isolation remain required.
