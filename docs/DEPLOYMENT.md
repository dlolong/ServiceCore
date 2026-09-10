# Deployment

NegOSu is a cloud-neutral Next.js application backed by Supabase. The repository does not currently contain an authoritative Render, Vercel, or container deployment manifest, so provider-specific infrastructure must not be inferred from an example host name.

## Runtime contract

- Node.js 24, declared by `.nvmrc` and `package.json#engines`.
- Dependencies are installed deterministically with `npm ci` and `package-lock.json`.
- Build command: `npm run build`.
- Start command: `npm run start`; its `prestart` hook re-runs production-mode environment validation and fails before Next.js starts when critical configuration is invalid.
- Public liveness endpoint: `GET /health`.
- Environment validation: `npm run release:env`.

The public health response contains only a status, internal service label, package version, and timestamp. It does not test the database or disclose configuration.

## Environment setup

Start from `.env.example`. Keep server secrets in the hosting provider's encrypted environment configuration; never commit `.env.local` or put service credentials in `NEXT_PUBLIC_*` variables.

Production requires:

```text
NODE_ENV=production
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Optional provider variables are validated as complete sets. Stripe requires its secret key, webhook secret, and reconciliation secret together. Notification delivery currently has only `disabled` and development `console` adapters; console delivery is rejected in production and production Email/SMS delivery must not be claimed until a real adapter is implemented and verified. A configured notification link encryption key must decode to exactly 32 bytes.

Run the same environment configuration used by the target service through:

```bash
npm run release:env -- --production
```

Diagnostics name missing or inconsistent variables and their purpose without printing values.

## Migration procedure

Migrations are append-only and live in `supabase/migrations/`. Never edit an applied migration or use `supabase db reset` against a shared or production project.

For a production release, an authorized operator should:

1. Record the release commit and expected migration range.
2. Review every pending SQL migration and its rollback/forward-fix implications.
3. Confirm a current restorable Supabase database backup.
4. Compare local and linked migration history with `npx supabase migration list --linked`.
5. Apply only the reviewed pending migrations with `npx supabase db push --linked`.
6. Stop if a migration fails. Diagnose and ship an append-only corrective migration; do not silently continue the application rollout against an incompatible schema.

The hosting service must not run seeds, resets, or backfills as part of build or startup.

## Build and deploy sequence

```bash
nvm use
npm ci
npm run release:env -- --production
npm test
npm run lint
npm run typecheck
npm run build
```

After the backup and migration procedure succeeds:

1. Deploy the recorded commit using `npm run build` and `npm run start`.
2. Set `HEALTHCHECK_URL=https://<host>/health` and run `npm run release:health` from an operator environment.
3. Run the public release smoke suite against the deployed URL. The suite validates the `/health` service identity before accepting an operator-managed target.
4. Perform authenticated Automotive and Salon pilot smoke using deliberately provisioned non-production/staging personas or approved pilot accounts—not the QA seed against production.
5. Confirm billing webhook and scheduled notification endpoint configuration only for providers actually enabled.

## Rollout and rollback

Prefer a staged rollout to a controlled pilot. Keep the previous deployable application artifact/commit available. If the application release fails but migrations are compatible, roll the application back to the previous artifact. Do not automatically reverse business-data migrations. Database remediation uses a reviewed append-only forward fix or a separately approved restore procedure.

## Seed and backfill safety

`npm run qa:seed` is a non-production tool. It defaults to dry-run, requires `--apply` to write, rejects production, and allows a remote development target only with three explicit guards. It is never called by `build` or `start`. Full instructions are in `PILOT_QA.md`.

Development SQL fixtures remain in `supabase/seed.sql` and must never be applied to production. Production startup must never create demo organizations, QA users, fake customers, or fake payments.

Production backfill was NOT executed.

## External setup required

- A supported Node 24 application host and HTTPS domain.
- A production Supabase project with backups, reviewed migrations, Auth URLs, and mail configuration.
- Stripe price/webhook configuration only if online billing is enabled.
- A production notification delivery adapter before Email/SMS delivery can be called operational.
- Scheduler/cron invocation secrets and schedules for enabled background endpoints.
- Provider dashboards, logs, alerting, and backup-restore testing owned by the deployment operator.
