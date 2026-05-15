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

## Supabase
- Use `src/lib/supabase/server.ts` for SSR/server-component queries tied to the current user.
- Use `src/lib/supabase/client.ts` only in client components.
- Use `src/lib/supabase/admin.ts` only on the server; it requires `SUPABASE_SERVICE_ROLE_KEY` and bypasses normal user RLS.
- The actual publishable key env var is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, not `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The README is stale on this point.
- Required env vars for normal auth/query flow: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`.
- Extra server-only flows depend on `SUPABASE_SERVICE_ROLE_KEY`.

## External Integrations
- Customer/device sync code in `src/features/customers/actions/customer-actions.ts` also depends on `GYM_SYNC_SERVER_URL`, `GYM_SYNC_API_TOKEN`, `DEFAULT_ZK_DEVICE_SN`, `ZK_DEFAULT_USER_GROUP`, `ZK_DEFAULT_AUTHORIZE_TIMEZONE_ID`, and `ZK_DEFAULT_AUTHORIZE_DOOR_ID`.
- The attendance admin page at `src/app/panel/asistencias/page.tsx` reads from the external `gym-sync-server`, not directly from a Next API route.
- Exercise catalog import/search also depends on `EXERCISEDB_RAPIDAPI_KEY`; the Supabase Edge Function lives at `supabase/functions/exercise-catalog-provider/index.ts`.

## Database And Schema
- Repo-managed SQL lives under `supabase/migrations/`.
- Payments/customer listings rely on database views such as `payments_overview` and `customer_overview`; check SQL migrations and live Supabase schema before changing those flows.
- If you change RLS, views, or SQL functions through Supabase MCP, mirror the change in `supabase/migrations/` or the repo will drift from the live database.

## UI Tooling
- Tailwind is v4 via `@tailwindcss/postcss`; there is no root `tailwind.config.*`.
- Shadcn is configured in `components.json` with `new-york` style, RSC enabled, and aliases rooted at `@/`.
- ESLint explicitly ignores `.agents/**`; generated skill assets are not part of normal app linting.
