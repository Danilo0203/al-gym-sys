# AGENTS.md

## Commands
- Use `npm`; this repo has `package-lock.json` and no pnpm/yarn lockfile.
- Dev server: `npm run dev` uses `next dev --webpack`. `npm run dev:turbo` is opt-in and may behave differently.
- Lint: `npm run lint` runs plain `eslint`. For focused checks, use `npm run lint -- src/path/to/file.tsx`.
- There is no `typecheck` script. Use `npx tsc --noEmit`.
- There is no test runner configured in root. For full app verification, use `npm run build`.

## Verification
- Preferred verification order for app changes: `npm run lint -- <changed files>` -> `npx tsc --noEmit` -> `npm run build`.
- If you touch auth, routing, or env-dependent code, do not stop at lint; build catches App Router and server/client boundary issues.

## App Shape
- This is a single Next.js App Router app, not a monorepo. Main code lives under `src/`.
- `src/app/panel` is the internal staff/admin area.
- `src/app/mi` is the client/member area.
- `src/proxy.ts` is the real auth/role gatekeeper. It redirects `/`, `/iniciar-sesion`, `/panel/*`, and `/mi/*` based on the logged-in user's role.

## Local backend
- Runtime auth and data operations should use the local backend through `src/lib/auth/backend-auth.ts` or existing `/api/*` proxies. Forward the local session cookie from server actions.
- Do not add new Supabase runtime calls. Remaining Supabase code is migration debt tracked in `PLAN_MIGRACION_LOCAL.md`; remove it as each active flow moves to the local backend.
- The old Supabase migration files are historical schema references. New local schema changes belong in the sibling `algym-local-backend/database/migrations/` and must be tested against `algym_test` before applying to `algym`.

## External Integrations
- Cash and customer mutations reconcile the affected customer with local `gym-sync-server` through `src/features/cash/lib/local-device-sync.ts`. Device hardware acceptance is still pending.
- The attendance admin page reads the local `gym-sync-server`.
- The visible exercise catalog, routine search, replacement suggestions, and manual draft generation use local API data. Automatic generation from Cash, routine blueprints, and historical image imports still need migration.

## Database And Schema
- Active local SQL migrations live in the sibling backend's `database/migrations/`.
- Payments/customer listings rely on PostgreSQL views such as `payments_overview` and `customer_overview`; check the local schema and exact migration state before changing those flows.

## UI Tooling
- Tailwind is v4 via `@tailwindcss/postcss`; there is no root `tailwind.config.*`.
- Shadcn is configured in `components.json` with `new-york` style, RSC enabled, and aliases rooted at `@/`.
- ESLint explicitly ignores `.agents/**`; generated skill assets are not part of normal app linting.
