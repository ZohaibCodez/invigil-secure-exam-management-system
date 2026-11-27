# Video-inspired delivery verification — 27 November 2026

## Scope and environment

This verifies the supervised-entry and optional save-and-lock additions, not a
claim that every hackathon submission requirement has been independently accepted.
Reference-video analysis was frame-based; transcription was stopped at the user's
request. The [feature map](../../reference-video-feature-map.md) records the
functional mapping and intentional safety differences.

The browser journey ran against **development only**. Existing examinations were
not edited. Questions, draft exam and enrollment were created through authenticated
same-origin API calls as a disclosed setup shortcut; delivery settings, approval,
candidate answering and submission were exercised through the interface.

Fictional development fixture:

- Exam: `VIDEO-QR AAD4dG`, `b016a8fa-248b-42df-b081-fff656afdb7d`
- Admission: `bd0097fd-b4f6-42ff-b299-206399653e48`
- Attempt: `a0bf6ba2-a81c-4c5f-911a-bd3d6a2031fc`
- Paper: single-answer Mathematics (2), multiple-answer Mathematics (3),
  written English (4).

These identifiers belong to development, not the production Neon database.

## Passed browser journey

1. An examiner applied the supervised preset, enabled QR approval, set a 100%
   answered threshold and saved the settings. Publication preserved the three
   questions and the assistance policy.
2. Candidate entry displayed a pending QR with expiry. Start remained disabled
   before approval.
3. A signed-out admission deep link retained its URL through examiner sign-in.
   The authorized examiner approved the correct candidate and examination with
   a recorded reason.
4. Candidate Start created the attempt and consumed the admission. The deadline
   was exactly 15 minutes after the server start:
   `11:55:19.508Z` to `12:10:19.508Z`.
5. A selected single answer autosaved with no lock. Leaving it prompted
   **Stay here / Save and lock**. Staying preserved the draft; explicit locking
   was confirmed by the server and disabled editing.
6. The multiple-answer response was also explicitly locked. Progress showed two
   answered and two locked.
7. The written response and scratchpad were server-confirmed while the written
   answer remained editable/unlocked.
8. Offline editing showed device-only status and disabled locking. After
   reconnecting, the new text reached the server without an invented lock.
9. Reload retained both locked answers, the unlocked written response, scratchpad
   and the identical deadline. Progress showed three answered and two locked.
10. Manual submission at the 100% threshold correctly counted the confirmed
    unlocked written response. The review said two locked and one unlocked draft
    would be submitted.
11. Submit returned HTTP 200. All three responses were retained; the attempt
    remained `submitted` pending written marking. The candidate receipt showed
    3/3 answers and did not reveal a score.

Screenshots and the native test replay are available in Replit's testing history.
No downloadable MP4/WebM was exported, and no reference video is misrepresented as
an application test recording.

## Automated checks

- Database-backed admission/locking integration passed: permissions, no pre-start
  attempt, duplicate/concurrent start, candidate/exam binding, approval expiry,
  denial, one-use consumption, stale revisions, immutable locked values, sandbox
  separation, minimum threshold and expiry finalization, and legacy reviewable mode.
- New answer-state unit checks passed: written text beginning with brackets,
  including `[]`, still counts as a written answer; objective questions require
  a nonempty selection array.
- Existing recovery checks passed: serialized device writes, truthful storage
  failures, scratchpad version conflicts and late-save behavior.
- Existing blueprint, incident review and sign-in cache regressions passed.
- Backend/shared/frontend TypeScript checks and the Vercel-style build passed.
  After the final frontend corrections, frontend typecheck and production build
  passed again.

## Live Neon compatibility reads

After the user reported applying the schema from their external editor, read-only
API checks on the supplied Vercel deployment returned:

| Check | Result |
| --- | --- |
| `/api/healthz` | 200, `status: ok` |
| Examiner sign-in / sign-out | 200 |
| Examiner exam list | 200; delivery settings and entry versions present |
| Authorized entry information | 200; no question contents |
| Authorized admissions list | 200, array response |
| Candidate exam list, including attempt projection | 200 |

These confirm that the deployed queries can read the new Neon tables/fields.
They are not a claim that production constraints were exhaustively inspected or
that a production examination was attempted during this check.

## Findings corrected after the journey

- The narrow receipt could exceed the screen width because the full immutable
  policy-version hash did not wrap. The receipt now has a shrinkable grid/card,
  responsive padding and wrapping policy hashes/content. This correction was
  code-reviewed and typechecked/built; the narrow viewport was not remeasured in
  another browser pass.
- The receipt now explicitly states when written responses await examiner marking.
- Current answer controls/navigation are frozen while an explicit lock request is
  pending, preventing an edit made during that request from being silently replaced
  by the server's already-confirmed locked value.
- The staff scanner explicitly owns its media stream and stops late permission
  results without detaching a newer session's preview.

## Limits and unverified points

- Physical-camera QR decoding was **not** exercised. The supervisor used the
  same-origin admission link/request ID; the scanner paste-input form was not
  independently tested.
- Camera cancellation is implemented and code-reviewed, not hardware-certified.
- The final fixture's examiner marking/publication was outside this focused
  journey. Earlier separate evidence covers the ordinary grading/report flow.
- Some timer screenshots differed during load; the authoritative server deadline
  remained unchanged throughout the journey. The countdown uses a server-time
  anchor and monotonic elapsed time; cached-only estimates are not authoritative.
- This does not promise browser-level cheating prevention, AI-use detection,
  guaranteed offline recovery or calibrated equivalence of randomized forms.
