# Examora — Secure Examination Management

A role-based examination platform focused on fair timing, resilient answer saving, secure grading, and verifiable reports.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- `pnpm --filter @workspace/api-server run seed:demo` — explicit fictional demo seed; requires `DEMO_MODE=true`
- Authentication requires `SESSION_SECRET`; published origins must set `BETTER_AUTH_URL`.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Web: React + Vite, Tailwind, accessible components, Framer Motion
- Auth: Better Auth, SQL-backed sessions and rate limits
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml`: API contract; regenerate hooks after changes.
- `lib/db/src/schema/`: identity, exam, attempt, incident and audit models.
- `artifacts/api-server/src/lib/`: authorization, timing and marking rules.
- `artifacts/api-server/src/routes/`: role-scoped routes.
- `artifacts/examora/src/`: application frontend.
- `README.md`: setup, policies, demo credentials, Vercel/Neon guidance and limitations.

## Architecture decisions

- Prefer a complete, reliable examination workflow over optional AI integrations.
- Required functionality must not depend on paid services or billing information, per the supplied competition brief.
- Published exams and grades are deliberately locked; late offline work never automatically earns marks.
- Application schemas are applied explicitly in development, never from server startup.

## Product

Administrator account management; examiner exam/question/enrollment workflows;
candidate timed attempts; monitoring and announcements; grading and publication;
PDFs and minimal public verification; imports and question analytics.

## User preferences

- Do not commit under the assistant's name or change Git authorship; the user is attaching their own GitHub account.
- UI/UX must be professional, modern and creative, with micro-interactions, transitions and restrained animation.
- Keep the application deployable on free tiers such as Vercel and Neon.

## Gotchas

- No commits, pushes, builds or deployments after the hackathon submission deadline.
- Demo accounts are public fictional accounts, not a secure deployment for real student data.
- Import Drizzle operators through `@workspace/db` so optional peer variants cannot produce mismatched SQL types.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
