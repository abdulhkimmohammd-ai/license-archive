# Migration Note

## Target architecture

The independent runtime is designed as React/Vite on Cloudflare Pages, with Cloudflare Workers available for server-side API mediation, and Supabase Development providing PostgreSQL, Auth, RLS, RPC, triggers, audit, invitations, and notifications.

## Migration boundary

The current phase is Development-only. No Production database has been read, copied, migrated, or modified. DNS, domains, Cloudflare Deploy, and external Preview remain outside the approved scope.

## What is independent

The Pages entry, Supabase Auth session handling, operational pages, CRUD contracts, archive rules, Offline queue, idempotency, QR, Team Invitations, Notifications, PDF/print/CSV, and Worker contract are independent of the legacy runtime. Daily operations do not call AI services.

## What remains legacy

Express, tRPC, MySQL, Drizzle, Manus OAuth, Manus runtime integrations, and historical storage references remain in the project only for rollback compatibility or documented asset limitations. They are not imported by the Pages entry and must not be required for independent runtime execution.

## Future controlled migration sequence

1. Create a separately named Cloudflare Pages/Workers Preview project and configure Development-only variables.
2. Validate Supabase Development schema and RLS against synthetic accounts.
3. Run manual acceptance for QR camera and official ministry print output.
4. Approve a separate Production migration plan and backup/rollback window.
5. Only after explicit approval, perform a staged, read-verified Production migration; never combine it with DNS or deployment approval.

