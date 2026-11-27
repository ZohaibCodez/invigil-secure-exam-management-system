# Examora — Secure Examination Management

A full-stack examination platform built for Web-e-Thon: three protected roles,
reusable question banks, server-timed attempts, recoverable answer synchronization,
monitoring, grading, controlled publication, and verifiable PDF results.

## Implemented product

- **Public website:** a detailed landing page at `/` for signed-out visitors
  (always available at `/welcome`), sign-in at `/login`, and a source-linked
  research and innovation assessment at `/research`. Signed-in users retain
  the dashboard at `/`.
- **Administrator:** create accounts, assign roles, deactivate access.
- **Examiner:** question bank CRUD, draft exam creation and editing, question
  assignment, candidate enrollment, publication, isolated sandbox preview,
  live monitoring, announcements, written-response grading, and result publication.
- **Candidate:** assigned upcoming/available/completed exams, timed question workspace,
  single-answer and multiple-select MCQs, written responses, review flags,
  autosave, scratchpad, retained viewing preferences, and own published results.
- **Secondary features:** network-aware saving, PDF reports, sandbox,
  CSV/JSON import with validation, question analytics, QR verification, workspace
  customization, and a digital scratchpad.
- **Innovation challenge 5.3:** failure-resilient examination delivery without
  granting extra time based on untrusted client clocks.

## Stack and architecture

This implementation uses the project's React + Vite frontend and Express API
architecture rather than the Next.js option discussed during analysis.
Both layers are TypeScript. Shared OpenAPI contracts generate React Query hooks
and Zod validation schemas. PostgreSQL and Drizzle provide persistence; Better Auth
owns credentials, password hashing, cookies, sessions, and authentication rate limits.

The frontend uses Tailwind, accessible UI primitives, and lightweight motion.
The server uses `pdf-lib` and QR codes for result reports. No required feature
depends on a paid API, LLM, webcam, email service, or credit-card-only service.

```text
artifacts/examora/         React frontend
artifacts/api-server/      Express API, business rules, demo seed
lib/api-spec/openapi.yaml  Source-of-truth API contract
lib/api-client-react/     Generated client hooks and types
lib/api-zod/              Generated server validation
lib/db/                   Drizzle schema and PostgreSQL pool
api/index.mjs             Vercel serverless API adapter
vercel.json               Vercel SPA + API routing
```

### Why these choices?

The application is a modular monolith, not a set of distributed services:
fewer integration points, one relational source of truth, explicit transactional
state transitions, and straightforward free-tier deployment.

Separate modules handle identity/access, exams, attempts, people/imports,
insights, and reports. Client rendering is intentionally separate from the
authoritative examination state.

## Development setup

Requirements: Node.js 22 or newer, pnpm 10, and PostgreSQL.

1. Install dependencies with `pnpm install`.
2. Set `DATABASE_URL` securely to a PostgreSQL connection string.
3. Set `SESSION_SECRET` securely to a high-entropy random secret of at least
   32 characters. Do not commit it.
4. Set `BETTER_AUTH_URL` to the exact app origin. Development in Replit can
   derive its development origin automatically.
5. Run `pnpm --filter @workspace/db run push` against the **development** database.
6. Start the existing API and Examora frontend workflows in Replit.

For local development outside Replit, run the Express service and Vite frontend
behind a same-origin reverse proxy: route `/api/*` to the API server and other
requests to Vite. Authentication requires same-origin requests.

Commands:

```sh
pnpm --filter @workspace/api-spec run codegen
pnpm run typecheck
pnpm --filter @workspace/db run push
```

Do not expose your database connection string in browser variables or source code.

## Fictional demonstration environment

Explicitly set `DEMO_MODE=true` in the environment where demo access is intended,
then seed **once**:

```sh
pnpm --filter @workspace/api-server run seed:demo
```

The seed is idempotent and not executed during startup, builds, or deployment.
It creates fictional accounts, examinations, enrollment records, and historical
submissions. Dashboard and analytics values are calculated from these persisted
records, not hardcoded frontend counters.

| Role | Email | Demo password |
|---|---|---|
| Administrator | `admin@examora.demo` | `ExamoraDemo2026!` |
| Examiner | `examiner@examora.demo` | `ExamoraDemo2026!` |
| Candidate | `candidate@examora.demo` | `ExamoraDemo2026!` |

These are deliberately public **fictional demo credentials**, not private accounts.
Demo shortcuts perform real authentication; they do not bypass backend authorization.

**Never use a seeded demo database for real examinations.** Hiding shortcuts does
not delete public demo accounts. Use a clean production database and create a
private administrator account instead. In a private deployment, bootstrap the
first administrator by registering a candidate account, then promote that exact
account through your authorized database administration workflow. All later role
assignments happen through the administrator UI.

## Timing, grading, and recovery rules

### Examination lifecycle

- Only draft examinations can be edited or deleted.
- Publication requires questions and a closing time in the future.
- Candidate entry requires enrollment and the examination availability window.
- A real candidate has at most one attempt per exam, enforced by a partial unique
  index. Sandbox attempts are separate.
- Published exam content is frozen. Editing the reusable bank cannot mutate
  existing exam or attempt snapshots.
- The attempt deadline is the earlier of the examination close time and
  the server start time plus the configured duration.
- Completing an examination is an explicit early-close action and finalizes
  active real attempts. It should be used intentionally.

### Comparable randomized papers

In an examination's **Pool** tab, select the eligible bank questions. In
**Blueprint**, add exact quota rows: topic (the case-sensitive bank category),
examiner difficulty band, question type, marks per question, and question count.
The row totals determine the marks and number of questions **per attempt**, not
the size of the eligible pool. Duplicate strata and papers over 200 questions
are rejected. Remove all rows and save to restore the same-full-pool baseline.

Draft validation displays available counts and explicit shortages against the
live bank. Infeasible drafts can be saved for repair, but cannot be published or
used for a sandbox attempt. Publication checks the bank again and freezes the
eligible content and quotas. Each attempt independently samples without
replacement inside each quota, even when order shuffling is off. Its selected
questions, choices, answer keys, marks and quotas remain fixed on resume and
after later bank changes.

The Blueprint tab compares forms against **their own frozen quotas**, including
clearly labelled private sandbox previews. It shows count/mark matches and
selected question IDs. Observed accuracy includes sample counts from completed
real objective responses only and separates frozen item versions. Examiner
labels are not psychometric calibration; matching coverage does not establish
equivalent realized difficulty. Comparisons never adjust scores or unlock
published grades.

Regression checks: `pnpm --filter @workspace/api-server run test:blueprint`
(requires the development PostgreSQL schema to be applied).

### Answer synchronization

- The server's database clock decides whether an answer batch is on time.
- Attempts are row-locked during save/submission so late saves cannot overwrite
  finalized results.
- Operation identifiers make network retries idempotent.
- Per-answer revisions prevent older saves from replacing newer answers.
- Client-supplied marks, feedback, or identity are never trusted.
- Questions, choices, and marking rules retain their original assignment.
- Objective responses use exact-set marking: every correct choice and no extra
  choice must be selected. There is no negative marking.
- Written responses are manually graded within `0..assigned marks`.
- Results cannot be published until the exam is closed and every real attempt
  is finalized and graded. Published grades are locked.

### Offline limitations — intentionally explicit

Local recovery reduces loss; it does not make a browser a trusted proctor.
Unsynchronized answers must reach the server **before the fixed deadline** to
count automatically. A client-provided timestamp cannot prove when an offline
answer was written. Late work remains unverified recovery evidence, not
automatically accepted marks.

Only server-synchronized work transfers to another device. Clearing browser
storage removes unsynchronized local work. Offline page reopening depends on
the application shell already being available; this is not a guaranteed fully
offline installable PWA.

Expiry is enforced on every relevant request. When a browser is closed at
expiry, the next authorized read finalizes the attempt using previously
accepted answers. Correctness does not depend on an always-running timer,
cron job, websocket, or paid background worker.

### Integrity and privacy

Tab visibility/network events are reviewable context, **not proof of cheating**.
No camera, microphone, biometric analysis, or invasive monitoring is required.
Answer keys are excluded from active candidate responses. Candidates only
receive their own published results. Authorization is checked on every protected
endpoint, including report downloads.

## Report verification

Results receive an unguessable verification token on publication. The PDF includes
that token and a QR link to `/verify/:token`.

The public verification page exposes only exam title, candidate initials, score,
maximum score, and issuance date—never email addresses, answer scripts, or full
candidate identity. A QR image alone is not a digital signature: authenticity is
verified against the issued server-side record.

Published grades cannot be edited, avoiding stale reports claiming old marks.
Report generation is on demand and does not store PDF bytes in PostgreSQL.

## Bulk import

The UI supports CSV and JSON. Always preview validation before committing.
Imports with validation errors are not committed. Candidate account creation is
performed through Better Auth; any concurrent account-creation failure is
reported with the imported count rather than silently claiming full success.

Candidate fields:

```text
name,email,password
```

Imported candidates cannot choose privileged roles. Passwords must contain at
least 10 characters.

Question fields:

```text
text,type,category,difficulty,marks,options,correctAnswers,explanation
```

- `type`: `single`, `multiple`, or `written`.
- `difficulty`: `easy`, `medium`, or `hard`.
- `options`: JSON array of `{ "id": "a", "text": "..." }` objects, or pipe-separated
  text (auto-assigned `a`, `b`, `c` identifiers).
- `correctAnswers`: JSON string array or pipe-separated identifiers.
- Written questions use empty option and correct-answer arrays.

## Vercel + Neon deployment

The repository includes a Vercel adapter and routing configuration. **External
Vercel deployment has not been performed as part of the local preview build.**

1. Create a free Neon PostgreSQL project. Use its pooled, TLS-enabled connection
   string. Do not paste it into a commit or issue.
2. Import your GitHub repository into Vercel, keeping the **repository root**
   as the project root.
3. Vercel reads `vercel.json`. The build checks shared-library, API and frontend types,
   bundles the non-listening Express app into
   `artifacts/api-server/dist/vercel/app.mjs`, builds the frontend into
   `artifacts/examora/dist/public`, and serves `/api/*` through the JavaScript
   serverless adapter. Keep both the adapter and the build command: pointing
   Vercel directly at the workspace TypeScript source can trigger NodeNext import
   errors despite the workspace's valid bundler-mode configuration.
4. Configure secure environment variables in Vercel:
   - `DATABASE_URL`: your Neon connection string.
   - `SESSION_SECRET`: a new high-entropy secret.
   - `BETTER_AUTH_URL`: the exact HTTPS origin of your Vercel application.
   - `DEMO_MODE`: `true` only for an intentionally public fictional demo.
5. Before serving users, apply the schema to that **explicitly selected external
   Neon database** with `pnpm --filter @workspace/db run push` from a secure shell
   configured for that target. Do not run migrations in request handlers.
6. Seed only if the target is an intentional demo environment.
7. Deploy and verify sign-in, a real candidate attempt, server saving, submission,
   grading, and a PDF/QR report on the actual production origin.

Database schema setup is a separate explicit operation—not a Vercel build step.
Replit-managed production database migrations are handled by Replit's Publish
flow instead; do not target that database with external deployment instructions.

Free tiers have compute, invocation, storage, and transfer limits and do not
guarantee production availability. Neon free compute can sleep after inactivity;
handle first-request wake-up delays. Keep the Vercel function region near Neon.
Avoid continuously polling every exam or scheduling always-on keep-alive requests.

## Test evidence archive

See [the evidence archive](docs/evidence/README.md) for available visual snapshots,
executed browser-test reports, regression commands and coverage limitations.
Replit-native replay views are not downloadable recordings in this repository;
the archive explicitly identifies which media could and could not be exported.

## Demonstration and verification checklist

The first build is type-checked and startup-checked; a full automated browser
regression suite is not claimed. Before a real high-stakes examination, perform
additional security, concurrency, accessibility, load, and recovery testing.

Important scenarios:

- Each role can sign in and sees only its permitted workflow.
- Candidates cannot obtain another candidate's attempt or an unpublished grade.
- Unenrolled candidates and candidates outside the window cannot start.
- Answer keys are absent from active candidate responses.
- Refresh preserves assignment and remaining time.
- Changing the device clock cannot extend server acceptance.
- Disconnect/reconnect before expiry recovers pending work.
- Late unsynchronized work is not automatically accepted.
- Duplicate submit and delayed saves cannot change a finalized attempt.
- Written marks exceeding the question maximum are rejected.
- Sandbox activity is excluded from actual results and analytics.
- PDF downloads are authorized; verification reveals minimal information.

## Technical-incident review

Candidates can open **Had a technical problem?** on a real attempt, including
after submission via **Technical problem or review decision** on their dashboard.
One immutable statement is retained per attempt. In **Monitor**, the owning
examiner (or an administrator) selects the candidate and records a final
disposition with a reason. The candidate can return to see the reviewer's name,
decision time, reason, and outcome.

Server save receipt times and persisted revision numbers are shown separately
from unverified browser reports. Historical receipts may lack revision details.
A server receipt confirms acceptance, not when offline work was authored.
Reviews do not credit late work, modify answers or marks, extend deadlines,
unlock published grades, or create resits. Supervised resit recommendations
require separate institutional arrangements.

After pulling schema changes, apply them explicitly with
`pnpm --filter @workspace/db run push` in development before starting the API.
The PostgreSQL-backed regression check creates and removes its own fictional
fixtures in the configured development database:

```bash
pnpm --filter @workspace/api-server run test:incident-review
```

It checks cross-candidate/examiner isolation, duplicate and competing decisions,
server revision evidence, late-answer rejection, and published-grade protection.

## Competition submission freeze

The supplied guide forbids **commits, pushes, builds, and deployments after the
submission deadline**, including on the next evaluation day.

Finish deployment and verification early. Disable automatic dependency updates,
scheduled builds, and other deployment triggers before the freeze. No application
code alters Git authorship, commit dates, or platform metadata.

Commit and push meaningful milestones under your own GitHub identity.
