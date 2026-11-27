# ECAT / NUST reference-video feature map

The supplied recordings are functional references, not a request to reproduce
another institution's branding, personal records, advertisements or credentials.
Analysis used 113 timestamped overview frames sampled every 30 seconds across all
three videos, with additional native-size frames for the instructions and controls.
This is **frame-based analysis**, not a claim that every video frame was inspected.
The user explicitly said transcription was not needed; audio transcription was
stopped and no speech-derived requirement is treated as verified evidence.

## References

| Recording | Duration | Useful visible material |
| --- | --- | --- |
| ECAT software overview | 8m40s | Candidate details, invigilator check, instructions, save/skip navigation, palette, submission |
| ECAT orientation walkthrough | 40m48s | Entry/admit information, subject confirmation, readiness, exam instructions, zoom, start time, explicit save confirmation, result receipt |
| NUST sample CBT | 6m24s | Subject heading, marks, start time, remaining time, Save/Next/Previous/Review, section controls, First/Last, Help |

## Functional mapping

| Visible reference behavior | Examora behavior |
| --- | --- |
| Candidate sign-in | Existing authenticated candidate account; no shared candidate password or invented identity |
| Candidate details / admit information | Registered name and reference, authorized exam information, schedule, duration, marks, subjects; optional venue/session; printable without credentials |
| Subject/combination confirmation | Per-exam confirmation of the frozen paper's subject categories before starting |
| Invigilator PIN check | Requested enhancement: an opaque, expiring QR request approved by the owning examiner or administrator, rather than a shared PIN |
| Read instructions | Explicit acknowledgement for exams with additional delivery rules; assistance-policy acknowledgement remains separate |
| Computer/software readiness | Candidate's own device-ready statement, not a false automated hardware certification |
| Paper-ready / Start | Authorized entry metadata loads before start. Questions are released only by the successful Start endpoint, which begins the authoritative timer |
| Questions and marks | Existing single-answer, multiple-answer and written questions retained, with per-question marks |
| Save / Save and Next | Background autosave remains editable; optional **explicit** server-confirmed Save and Lock makes a response immutable |
| Skip and Next | Blank questions can be skipped and revisited. In lock mode, selected responses must be saved/locked or cleared before skipping |
| Save confirmation when leaving a selected answer | Strict-mode navigation asks the candidate to stay or explicitly save/lock; no optimistic irreversible advancement |
| Locked / attempted / current / skipped palette | Accessible question-state indicators and labels, including opened/unopened, answered, flagged, locked and pending confirmation |
| Subject controls | Category-based section navigation, per-section counts, first/last and previous/next section |
| Review | Existing progress/submit review retained. Locked answers are available for **read-only** review |
| Candidate details during test | Existing candidate/exam identity remains visible; no forced national-ID, parent-name or gender collection |
| Zoom In / Out | Existing workspace font controls retained |
| Start time / remaining time | Start time and answered/locked counts alongside the existing server-aligned countdown |
| Help | In-workspace explanation of navigation, saved drafts, locking, timing and recovery |
| Finish / receipt | Existing deliberate submit review, server finalization and submission receipt retained |
| At least half the paper before early Finish | Optional configurable minimum answered percentage, default **0**. A 50% policy is possible; it is not imposed on other exams |
| Expiry saves/submits | Server expiry finalizes only previously accepted answers, even below the optional manual-submit threshold |
| No negative marking | Existing exact objective grading: correct earns question marks, otherwise zero; written grading retained |
| Sample test | Existing examiner sandbox retained, separated from real candidate grading and admission |

## Intentional safety differences

- Video-specific totals such as 100 questions/100 minutes/five choices are examples,
  not global application limits.
- A scanned QR is **not identity proof**. Authenticated authorized staff must check
  the institution's roster and explicitly approve. A candidate cannot self-approve.
- A request expires after five minutes or the exam closing time, whichever is sooner.
  Approval does not extend it. Starting consumes it atomically. Resuming the same
  attempt never creates extra exam time or requires a second admission.
- QR contents are an opaque request URL, never a password, session or personal record.
- No timer starts on requesting, scanning or approving a QR.
- Autosaved, server-confirmed drafts count at final submission. Locking is a separate
  explicit action that prevents further editing; it does not award marks.
- Read-only review is retained even when the source software discourages reopening
  saved questions, preserving the hackathon's review requirement.
- Monitoring observations are contextual evidence, not proof of cheating. The
  recordings' threats of automatic disqualification/blacklisting are not copied.
- Camera use is restricted to an optional, explicitly opened **staff QR scanner**.
  It is not candidate surveillance, face recognition or an exam recording system.
- Offline work is not described as server-saved or guaranteed recoverable. A strict
  save/lock needs confirmation from the server.

## PDF preservation

These additions do not replace the three roles, scheduled lifecycle, frozen papers,
question bank and imports, enrollment, objective/written grading, publication,
analytics, monitoring/announcements, sandbox, autosave/recovery, scratchpad,
preferences, authorized reports or minimal public report verification. Existing
assistance-policy, blueprint fairness and dispute-review work must remain intact.

## Deployment prerequisite

`lib/db/migrations/20261127_delivery_admission.sql` is an additive migration for
the **existing** external Neon database. Apply it before deploying code that
selects the new fields. Do not substitute a Replit-managed database for Neon,
run a destructive schema reset, or execute migrations from server startup.

Development schema was applied explicitly. Production Neon migration and actual
deployment must be confirmed separately; local verification alone is not proof
that the Vercel deployment has these features.
