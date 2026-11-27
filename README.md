<!-- SEO Meta Tags
Description: Examora is a secure online examination management system with server-timed exams, offline-resilient answers, fullscreen supervision, AI-assisted grading and QR-verifiable results.
Keywords: online examination system, secure exam management, proctoring, exam software, React, Express, PostgreSQL, Neon, Groq AI grading, QR verified results
author: Muhammad Zohaib Khan
canonical: https://github.com/ZohaibCodez/invigil-secure-exam-management-system
-->
<!-- Open Graph
og:type: website
og:url: https://invigil-secure-exam-management-syst.vercel.app
og:title: Examora - Secure Examination Management, Examination with Confidence
og:description: Create, conduct, supervise, grade and verify online examinations. Answers survive network drops, time is kept by the server, and every published result carries a QR verification.
og:image: docs/screenshots/landing.jpg
og:site_name: Examora
og:locale: en_US
-->
<!-- Twitter Card
twitter:card: summary_large_image
twitter:title: Examora - Secure Examination Management
twitter:description: Server-timed, offline-resilient online exams with fullscreen supervision, AI-assisted grading and QR-verifiable reports.
twitter:image: docs/screenshots/landing.jpg
-->
<!-- GitHub Metadata
topics: online-exam, exam-management-system, proctoring, react, express, postgresql, hackathon
languages: TypeScript
homepage: https://invigil-secure-exam-management-syst.vercel.app
-->

<div align="center">

<img src="artifacts/examora/public/brand/logo-full.png" alt="Examora - Examination with confidence" width="420" />

### Secure examination management: server-timed, failure-resilient and verifiable

**Built for Web-e-Thon, Technoverse 5.0, COMSATS University Lahore (27-28 November 2026)**

[![Live demo](https://img.shields.io/badge/live%20demo-vercel-000000?logo=vercel)](https://invigil-secure-exam-management-syst.vercel.app)
![TypeScript](https://img.shields.io/badge/typescript-5.9-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/react-19.1-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/vite-7-646CFF?logo=vite&logoColor=white)
![Express](https://img.shields.io/badge/express-5-000000?logo=express)
![PostgreSQL](https://img.shields.io/badge/postgresql-neon-4169E1?logo=postgresql&logoColor=white)
![Drizzle](https://img.shields.io/badge/drizzle-orm-C5F74F?logo=drizzle&logoColor=black)
![Better Auth](https://img.shields.io/badge/auth-better%20auth-111111)
![Tests](https://img.shields.io/badge/acceptance-69%2F69%20live%20checks-success)

[**Live application**](https://invigil-secure-exam-management-syst.vercel.app) • [**Demo accounts**](#-demo-accounts) • [**Requirement map**](#-requirement-coverage) • [**Innovations**](#-innovation-challenges) • [**Setup**](#-getting-started)

<img src="docs/screenshots/landing.jpg" alt="Examora landing page with the animated save-ledger console" width="900" />

</div>

---

## 📋 Table of Contents

- [About](#-about)
- [Demo accounts](#-demo-accounts)
- [Requirement coverage](#-requirement-coverage)
- [Feature tour](#-feature-tour)
- [Innovation challenges](#-innovation-challenges)
- [Architecture](#-architecture)
- [Tech stack](#-tech-stack)
- [Getting started](#-getting-started)
- [Deployment (Vercel + Neon)](#-deployment-vercel--neon)
- [Testing and verification](#-testing-and-verification)
- [API reference](#-api-reference)
- [Project structure](#-project-structure)
- [Known limitations](#-known-limitations)
- [Team and acknowledgments](#-team-and-acknowledgments)

---

## 🎯 About

**Examora** is a full-stack **secure online examination management system** for institutions and competition organisers. Administrators manage people and access; examiners build question banks, configure and publish examinations, supervise them live, grade and publish results; candidates sit timed papers and receive verifiable reports.

It is designed around one principle: **"saved" is not the same as "submitted".** Every answer is kept on the candidate's device first, then accepted by the server in order with a receipt. Time is decided by the server clock only, so a network drop, a refresh or a changed laptop clock never costs a candidate their work and never buys extra time.

### Why Examora?

- 🛡️ **Integrity without surveillance**: no webcam, no biometrics, no automated "cheating score". Indicators are context for a human decision, as the problem statement requires.
- 🌐 **Failure-resilient delivery**: answers survive outages, refreshes and crashes; only the server decides the deadline.
- 🔏 **Trustworthy outcomes**: frozen papers, immutable decisions, examiner-approved grading and QR-verifiable PDF reports.

---

## 🔑 Demo accounts

The live database contains fictional demonstration data only. All accounts share one password.

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@examora.demo` | `ExamoraDemo2026!` |
| Examiner | `examiner@examora.demo` | `ExamoraDemo2026!` |
| Candidate | `candidate@examora.demo` | `ExamoraDemo2026!` |

Additional fictional candidates: `sam@examora.demo`, `taylor@examora.demo` (same password). Self-registration is disabled by design: accounts are issued by administrators or bulk import.

---

## ✅ Requirement coverage

Every row was exercised end to end against the **live deployment** by an automated acceptance run (69 of 69 functional checks passing). See [Testing](#-testing-and-verification).

<details open>
<summary><b>Core requirements (3.1 - 3.8)</b></summary>

| # | Requirement | How Examora meets it |
|---|---|---|
| 3.1 | Authentication and authorization | Better Auth sessions (httpOnly cookies, rate-limited sign-in). Admin creates users, assigns roles, deactivates (sessions revoked, sign-in refused). Every API route checks role and ownership on the server; examiners only see their own exams, candidates only enrolled ones. Cross-origin writes rejected. |
| 3.2 | Examination management | Title, instructions, schedule window, duration, marks, pass mark, shuffling, delivery rules. Lifecycle draft, published, ongoing, completed (derived from the database clock). Drafts editable and reviewable; published papers locked. No access before the window opens. |
| 3.3 | Question management | Reusable bank with topics and difficulty; create, edit, delete, assign. Single-answer, multiple-select (all-or-nothing **or** partial credit with wrong-pick penalty) and written questions. Question and option shuffling. Each attempt stores a frozen copy of its paper and marking scheme. |
| 3.4 | Candidate management | Enrolment of active candidates; enrolment list per exam. Candidate dashboard groups **Available now / Upcoming / Completed** with instructions and status. Entry restricted to enrolled candidates within the window. |
| 3.5 | Examination interface | Question palette distinguishing answered, unanswered and marked-for-review; marks and server-anchored timer; autosave; refresh restores answers, flags and remaining time; review before submit; server finalises at expiry with accepted answers only. |
| 3.6 | Monitoring | Live monitor of active attempts, progress, last save and incidents; announcements delivered into running attempts; incidents labelled "context, not proof of misconduct". |
| 3.7 | Evaluation and grading | Automatic objective marking per scheme; written answers graded by examiners with 0..max validation (optional AI suggestions, examiner approval required). Results cannot be published while anything is ungraded. |
| 3.8 | Results and analytics | Controlled publication; candidates see only their own published results; exam-level summary (mean, median, highest, lowest, pass rate) and candidate scores from real data; attempts retained. |

</details>

<details open>
<summary><b>Secondary features (4.1 - 4.8)</b></summary>

| # | Feature | Implementation |
|---|---|---|
| 4.1 | Network-aware interface | Online/offline detection, per-answer sync state (saved on device, sending, server confirmed, offline, retrying), honest submit when answers never reached the server. |
| 4.2 | PDF reports | Branded A4 certificate (pdf-lib): score ring, pass badge, topic performance, question breakdown with feedback, QR verification. Only the candidate (after publication) or authorised staff can download. |
| 4.3 | Sandbox | Examiners run the real candidate experience; sandbox attempts are private and excluded from results and statistics. |
| 4.4 | Bulk import | CSV / JSON for questions and candidates with dry-run validation and readable per-row errors ("difficulty: use easy, medium, hard"). |
| 4.5 | Question analytics | Accuracy, skipped count, **most-chosen wrong answer**, and **observed vs labelled difficulty** with a mismatch flag; filterable per exam. |
| 4.6 | Verifiable reports | 48-hex random token and QR; public verification page shows exam, score, issue date and **initials only**. Forged tokens rejected. |
| 4.7 | Customisable workspace | Font size, paper/night theme, split/focus layout, zen fullscreen; retained per user. |
| 4.8 | Digital scratchpad | Ruled scratchpad inside the exam, saved locally and to the server, restored on refresh; never graded. |

</details>

---

## 🖼️ Feature tour

<table>
<tr>
<td width="50%"><img src="docs/screenshots/login.jpg" alt="Sign in" /><br/><sub><b>Sign in</b>: one door for all three roles, demo shortcuts</sub></td>
<td width="50%"><img src="docs/screenshots/exdash.jpg" alt="Examiner dashboard" /><br/><sub><b>Examiner overview</b>: exams, grading queue, live activity</sub></td>
</tr>
<tr>
<td><img src="docs/screenshots/cadash.jpg" alt="Candidate dashboard" /><br/><sub><b>Candidate overview</b>: available, upcoming and completed exams</sub></td>
<td><img src="docs/screenshots/detail.jpg" alt="Exam detail" /><br/><sub><b>Exam detail</b>: pool, blueprint, candidates, admissions, settings, lifecycle</sub></td>
</tr>
<tr>
<td><img src="docs/screenshots/questions.jpg" alt="Question bank" /><br/><sub><b>Question bank</b>: topics, difficulty, marking rules</sub></td>
<td><img src="docs/screenshots/a3.jpg" alt="Exam workspace" /><br/><sub><b>Exam workspace</b>: palette, review flags, server timer, sync status</sub></td>
</tr>
<tr>
<td><img src="docs/screenshots/qoff.jpg" alt="Offline answering" /><br/><sub><b>Offline</b>: writing continues, answers kept on device</sub></td>
<td><img src="docs/screenshots/scratch.jpg" alt="Scratchpad" /><br/><sub><b>Scratchpad</b>: rough work inside the exam</sub></td>
</tr>
<tr>
<td><img src="docs/screenshots/night.jpg" alt="Night theme" /><br/><sub><b>Workspace preferences</b>: night theme, font size, layout</sub></td>
<td><img src="docs/screenshots/submit.jpg" alt="Submission" /><br/><sub><b>Submit</b>: review before submission, server-confirmed receipt</sub></td>
</tr>
<tr>
<td><img src="docs/screenshots/monitor.jpg" alt="Live monitor" /><br/><sub><b>Live monitor</b>: progress, incidents, announcements, QR scanning</sub></td>
<td><img src="docs/screenshots/supmon.jpg" alt="Supervision decisions" /><br/><sub><b>Supervision</b>: lock, resume, void or authorise a retake, with reasons</sub></td>
</tr>
<tr>
<td><img src="docs/screenshots/grade.jpg" alt="Grading" /><br/><sub><b>Grading</b>: AI suggestion pre-filled, examiner approves</sub></td>
<td><img src="docs/screenshots/results.jpg" alt="Results" /><br/><sub><b>Results</b>: grading queue, publication, PDF export</sub></td>
</tr>
<tr>
<td><img src="docs/screenshots/analytics.jpg" alt="Analytics" /><br/><sub><b>Analytics</b>: exam summary, distribution, question insights</sub></td>
<td><img src="docs/screenshots/blueprint.jpg" alt="Blueprint" /><br/><sub><b>Blueprint</b>: comparable randomised papers</sub></td>
</tr>
<tr>
<td><img src="docs/screenshots/imperr.jpg" alt="Import validation" /><br/><sub><b>Bulk import</b>: dry run with clear row errors</sub></td>
<td><img src="docs/screenshots/incident.jpg" alt="Incident review" /><br/><sub><b>Dispute review</b>: candidate statement, attributed decision</sub></td>
</tr>
<tr>
<td><img src="docs/screenshots/report.jpg" alt="PDF report" /><br/><sub><b>PDF report</b>: branded, QR-verifiable result certificate</sub></td>
<td><img src="docs/screenshots/verify.jpg" alt="Verification" /><br/><sub><b>Public verification</b>: authentic report, initials only</sub></td>
</tr>
</table>

---

## 💡 Innovation challenges

Examora addresses four of the five open challenges. The primary focus is **5.3**; the others strengthen it. Full evidence and trade-offs are in [`docs/innovation-research.md`](docs/innovation-research.md).

### 5.3 Failure-resilient examinations (primary)

| Problem | Mechanism | Why it is fair |
|---|---|---|
| Network drops mid-answer | Every keystroke is stored on the device (IndexedDB), then synced in batches with **revision numbers** and **idempotent operation IDs** | A retried save is counted once; an older tab can never overwrite a newer answer |
| Refresh, crash, power loss | On return the attempt reloads server answers, merges unsent local drafts and restores the remaining time | Re-opening the page is logged for context, never penalised |
| Device clock manipulation | Deadline computed from the **database clock** at start; the timer only displays server time | Changing the laptop clock changes nothing |
| Expiry while offline | The server finalises at the deadline with answers it accepted before it | Unsent answers are shown honestly as "not credited"; no extra time is granted |

### 5.1 Integrity in the AI era (privacy-preserving)

- Versioned **assistance policy** (closed book, open book, AI disclosed, AI conditional) that the candidate must acknowledge before starting.
- Candidate **AI-use disclosure** and question-linked **authorship review** where the candidate explains their own work to a human.
- **Fullscreen supervision** (per exam, on by default for new exams): leaving fullscreen, switching tabs or windows blocks the paper and counts a violation; at the limit the attempt **locks for a human decision** (resume, void with score 0, or authorise a retake). A reason is required and logged with the decider's name.
- Deliberately **no webcam, no biometrics and no AI detector**; indicators never change a score automatically (requirement 3.6).

### 5.2 Fairness of randomised examinations

- **Blueprints** with exact quotas by topic, difficulty, type and marks; publication is refused if the pool cannot satisfy them.
- Each candidate receives a different but **structurally equivalent** paper, frozen at start.
- Examiner comparisons of form difficulty from observed accuracy.

### 5.4 Trust and dispute resolution

- Candidates submit one **statement** per attempt about a technical incident or grading concern.
- Examiners record one **reasoned, attributed, immutable decision** (no action, supervised resit recommended, referred for review), shown beside separated **server evidence** (save receipts, browser events).
- Published grades are locked to preserve report authenticity.

### Plus: AI-assisted grading with human approval

When an examiner opens a submission, each written answer receives an advisory score and feedback from **Groq (`openai/gpt-oss-120b`)**, pre-filled for review. Nothing counts until the examiner presses **Approve and save grades**. Only the question, marks, marking guidance and answer text are sent (no identity). Answers are treated as untrusted data; calibration against 13 reference answers placed 12 within the expected range, with prompt-injection attempts scored 0. Without `GROQ_API_KEY`, grading is fully manual, so no required feature depends on a paid service.

---

## 🏗️ Architecture

```mermaid
flowchart LR
  subgraph Browser
    UI[React 19 SPA<br/>Vite, Tailwind, Framer Motion]
    IDB[(IndexedDB<br/>local drafts, prefs)]
  end
  subgraph Vercel
    FN[Express 5 API<br/>serverless function]
  end
  DB[(Neon PostgreSQL<br/>Drizzle ORM)]
  AI[Groq API<br/>optional]
  UI <-->|same-origin /api, httpOnly cookie| FN
  UI <--> IDB
  FN <-->|row locks, DB clock| DB
  FN -.->|advisory grading| AI
```

- **Modular monolith**: one relational source of truth, explicit transactional state transitions, simple free-tier deployment.
- **Contract-first API**: [`lib/api-spec/openapi.yaml`](lib/api-spec/openapi.yaml) generates React Query hooks and Zod validators (Orval), so the client and server validate the same shapes.
- **Data integrity**: `SELECT ... FOR UPDATE` on attempts, timing from `clock_timestamp()`, a partial unique index allowing exactly one current real attempt per candidate and exam, CHECK constraints on windows and durations, idempotent save operations.
- **Security**: server-side RBAC on every route, answer keys never sent during an attempt, same-origin cookies, cross-origin mutation guard, rate-limited sign-in, `no-store` caching, public endpoints expose initials only.

---

## 🛠️ Tech stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, Vite 7, TypeScript, Tailwind CSS 4, Radix UI primitives, Framer Motion, TanStack Query, Wouter, idb-keyval, qrcode.react |
| Backend | Node.js 22, Express 5, Better Auth, Zod 4, pdf-lib, qrcode, pino |
| Database | PostgreSQL on Neon, Drizzle ORM and drizzle-kit |
| API contract | OpenAPI 3.1, Orval code generation |
| AI (optional) | Groq chat completions, strict JSON schema output |
| Hosting | Vercel (static SPA and one serverless API function) |

---

## 🚀 Getting started

### Prerequisites

- Node.js **22** or newer and **pnpm 10**
- A PostgreSQL database (a free [Neon](https://neon.tech) project works)

### Installation

```bash
git clone https://github.com/ZohaibCodez/invigil-secure-exam-management-system.git
cd invigil-secure-exam-management-system
pnpm install
```

### Environment

Create `.env.local` in the repository root (it is git-ignored):

```bash
DATABASE_URL='postgresql://user:pass@host-pooler.region.aws.neon.tech/neondb?sslmode=require'
DATABASE_URL_UNPOOLED='postgresql://user:pass@host.region.aws.neon.tech/neondb?sslmode=require'
SESSION_SECRET='at-least-32-random-characters'
BETTER_AUTH_URL='http://localhost:8080'
DEMO_MODE='true'
# Optional AI-assisted grading
GROQ_API_KEY='gsk_...'
GROQ_MODEL='openai/gpt-oss-120b'
```

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Pooled connection used by the API |
| `DATABASE_URL_UNPOOLED` | recommended | Direct connection used for schema migrations |
| `SESSION_SECRET` | yes | Better Auth signing secret (32+ characters) |
| `BETTER_AUTH_URL` | yes | Exact public origin; also used in report QR links |
| `DEMO_MODE` | for seeding | Must be `true` to run the demo seed |
| `GROQ_API_KEY`, `GROQ_MODEL` | no | Enables advisory AI grading |

### Database and demo data

```bash
set -a; . ./.env.local; set +a
pnpm --filter @workspace/db run push                # create or update tables
pnpm --filter @workspace/api-server run seed:demo   # idempotent fictional data
```

### Run locally

```bash
# API on :8081
PORT=8081 pnpm --filter @workspace/api-server run dev
# Web app on :8080, proxying /api to the API (same-origin cookies)
PORT=8080 BASE_PATH=/ API_PROXY=http://localhost:8081 pnpm --filter @workspace/examora run dev
```

Open `http://localhost:8080` and sign in with a [demo account](#-demo-accounts).

> On Windows, run these from Git Bash. If paths are rewritten, prefix with `MSYS_NO_PATHCONV=1`.

---

## ☁️ Deployment (Vercel + Neon)

1. Import the repository in Vercel with Framework Preset **Other** and Root Directory `./`. [`vercel.json`](vercel.json) builds the SPA and bundles the API into `api/index.mjs`; every `/api/*` request is rewritten to it.
2. Add the environment variables above (Production, Preview, Development). Set `BETTER_AUTH_URL` to the exact deployed origin.
3. Run `pnpm --filter @workspace/db run push` against the production database whenever `lib/db/src/schema` changes.
4. Deploy. Check `https://<domain>/api/healthz` returns `{"status":"ok"}`.

---

## 🧪 Testing and verification

| Suite | Command | Covers |
|---|---|---|
| Recovery | `pnpm run test:recovery` | Scratchpad and draft persistence, reload recovery |
| Auth cache | `pnpm run test:auth-cache` | Session refresh behaviour |
| Delivery | `pnpm run test:delivery` | Supervised admission, answer state, entry rules |
| Blueprint | `pnpm --filter @workspace/api-server run test:blueprint` | Comparable paper generation |
| Incident review | `pnpm --filter @workspace/api-server run test:incident-review` | Statement and immutable decision flow |
| Type safety | `pnpm run typecheck` | All workspaces |

**Live acceptance run (27 Nov 2026)**: an automated script exercised the deployed site end to end with dedicated QA accounts, covering every requirement in sections 3, 4 and 6 including a real timer expiry: 69 of 69 functional checks passed. It found two issues, both fixed and re-verified live: deactivated accounts can no longer sign in, and import errors are human-readable.

---

## 📚 API reference

<details>
<summary><b>Main endpoints</b> (full contract in <code>lib/api-spec/openapi.yaml</code>)</summary>

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/api/auth/sign-in/email` | anyone | Sign in (self-registration is disabled) |
| GET | `/api/session` | signed in | Current user and role |
| GET/POST/PATCH | `/api/users` | admin | Create users, change roles, deactivate |
| GET/POST/PATCH/DELETE | `/api/questions` | staff | Question bank |
| GET/POST/PATCH/DELETE | `/api/exams` | staff | Exams (drafts editable) |
| POST | `/api/exams/:id/action` | staff | `publish`, `complete`, `publish-results` |
| PUT | `/api/exams/:id/delivery` | staff | Change delivery rules for future attempts |
| POST | `/api/exams/:id/enrollments` | staff | Enrol candidates |
| POST | `/api/exams/:id/start` | candidate / staff sandbox | Start or resume an attempt |
| PUT | `/api/attempts/:id/answers` | candidate | Idempotent, revisioned autosave |
| POST | `/api/attempts/:id/submit` | candidate | Submit (repeat-safe) |
| POST | `/api/attempts/:id/violations` | candidate | Supervision violation report |
| POST | `/api/attempts/:id/supervision` | staff | Lock, resume, void, retake |
| POST | `/api/attempts/:id/ai-grade` | staff | Advisory AI suggestions |
| POST | `/api/attempts/:id/grade` | staff | Approve written grades |
| GET | `/api/exams/:id/monitor` | staff | Live monitor |
| GET | `/api/analytics?examId=` | staff | Exam and question analytics |
| POST | `/api/imports` | staff | Bulk import with validation |
| GET | `/api/reports/:id/pdf` | owner / staff | PDF result report |
| GET | `/api/verify/:token` | public | Report verification (initials only) |

</details>

---

## 🗂️ Project structure

```text
├── artifacts/
│   ├── examora/          React frontend (pages, components, local-first draft store)
│   └── api-server/       Express API (routes, grading, supervision, reports, seed)
├── lib/
│   ├── api-spec/         OpenAPI contract and Orval config (source of truth)
│   ├── api-client-react/ Generated React Query hooks
│   ├── api-zod/          Generated Zod validators
│   └── db/               Drizzle schema and PostgreSQL pool
├── api/index.mjs         Vercel serverless entry
├── docs/                 Innovation research, evidence, screenshots
└── vercel.json           SPA + API routing
```

---

## ⚠️ Known limitations

- A browser cannot lock the whole computer (Esc always exits fullscreen). Examora blocks and records instead of claiming a lockdown; decisions stay with humans.
- Local drafts live in the browser profile. Clearing site data or switching devices loses unsent drafts; only server-accepted answers count.
- AI grading is advisory. On Groq's free tier, heavy bursts can be rate-limited; the app retries and falls back to manual grading.
- Challenge 5.5 (participant-defined) is not addressed separately.

---

## 👥 Team and acknowledgments

**Muhammad Zohaib Khan** and team, for Web-e-Thon (Technoverse 5.0), COMSATS University Lahore.

Built with open-source tools: React, Vite, Express, Drizzle, Better Auth, Radix UI, Tailwind CSS, Framer Motion, pdf-lib, Neon and Vercel. AI-assisted coding was used as permitted by the competition rules.

All repository commits were made before the submission deadline; no timestamps have been altered.

<div align="center">

**Examora** • Examination with confidence • Built with 🖤 for Web-e-Thon 2026

</div>
