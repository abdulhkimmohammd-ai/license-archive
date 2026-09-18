# Export Limitations

The export is a Development/Migration Lab package, not a Production release.

## Included

Source code, client and server code, Supabase migrations, Worker source and examples, Cloudflare examples, tests, documentation, package metadata, lockfile, and synthetic-development integration contracts are included.

## Excluded

The export excludes `node_modules`, `dist`, `.git`, local environment files, Worker local secrets, Cloudflare credentials, Supabase service-role values, Production credentials, Production data, user passwords, tokens, and temporary logs. The archive is verified with `exports/project-export.sha256`.

## Environment template limitation

The WebDev environment prevents direct creation of `.env.example` through the file editor. Variable names and classifications are documented in `docs/ENVIRONMENT_VARIABLES.md`, and the Worker-safe template is `workers/.dev.vars.example`. These files contain no secret values.

## Ministry template limitation

No official ministry template image was found in the project or designated static-assets directory. The existing code-level template and technical calibration remain unchanged. A separately approved official asset may be supplied later without changing business logic.

## Manual acceptance limitation

QR camera behavior requires a real mobile device, HTTPS secure context, and camera permission. Automated synthetic QR generation/decoding and route acceptance are covered; physical camera acceptance remains a manual step.

## Deployment limitation

This package is not a Cloudflare Deploy, external Preview, DNS change, domain change, or Production migration. It requires separately managed Development environment variables before any future Preview operation.

