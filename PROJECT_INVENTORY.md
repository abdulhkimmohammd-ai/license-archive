# Project Inventory

## Purpose

License Archive – Migration Lab is the Development-only workspace for transitioning the Arabic RTL license archive from the legacy Express/tRPC/MySQL stack to Supabase and Cloudflare-compatible runtime paths.

## Runtime paths

| File | Type | Purpose | Used By | Required |
|---|---|---|---|---|
| `client/src/main.pages.tsx` | TypeScript entry | Independent Pages entry | Cloudflare Pages build | Yes |
| `client/src/IndependentApp.tsx` | React component | Independent Supabase route shell | Pages entry | Yes |
| `workers/src/index.ts` | TypeScript Worker | Optional Worker API adapter | Cloudflare Workers | When Worker mediation is used |
| `workers/wrangler.toml` | TOML config | Development Worker name, entry, compatibility date, and non-secret vars | Wrangler | Yes for future Development deploy |
| `supabase/migrations/` | SQL migrations | Development PostgreSQL schema, RLS, RPC, triggers | Supabase Development | Yes |
| `client/src/main.tsx` | TypeScript entry | Legacy application entry | Local/Legacy build | Rollback only |
| `server/` | TypeScript server | Express/tRPC legacy backend | Local/Legacy build | Rollback only |
| `CLOUDFLARE_SETUP.md` | Markdown guide | Pages, Workers, and Supabase setup | Human operator | Yes for handoff |
| `MANUS_DEPENDENCIES.md` | Markdown inventory | Legacy/Rollback and runtime dependency classification | Handoff reviewer | Yes for handoff |
| `CLOUDFLARE_DEPLOYMENT_GUIDE.md` | Markdown guide | Human-oriented Wrangler/Pages/Worker/Supabase deployment steps | Future operator | Yes for handoff |

## Operational capabilities

Supabase Auth, roles, RLS, RPC, CRUD, search, filtering, pagination, archive numbering, audit logging, renewal, archive/trash/restore, Offline queue, idempotency, retry isolation, QR generation/scanning, Team Invitations, internal Notifications, PDF, print, and CSV are covered by the independent Development path or its automated contracts.

## Safety boundary

No Production data, Production credentials, DNS, Domain, Cloudflare Deploy, or external Preview is included or required by this inventory. Local test records are synthetic Development records only.

## Quality evidence

The latest verified gate recorded 43 Vitest files and 119 passing tests, successful TypeScript checking, successful legacy and Pages builds, a clean production dependency audit, and no forbidden runtime markers in the Pages output.

