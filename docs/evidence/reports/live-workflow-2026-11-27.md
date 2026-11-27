# Live examination workflow verification

**Date:** 2026-11-27

**Target:** https://invigil-secure-exam-management-syst.vercel.app/

**Permission:** the user confirmed that the live Neon database contains only
fictional demo data and approved creating fictional attempts and submissions.

**Outcome:** the five-step candidate-to-result journey passed.

## Scope and fixture

A uniquely named `LIVE-VERIFY` examination was created with one single-choice
question worth 2 marks, one multiple-select question worth 3 marks and one
written question worth 4 marks. The new fixture remains completed, with results
published, for review.

Exam, questions, enrollment and publication were **API setup**, not checks of the
corresponding creation interfaces. No existing examinations, grades or roles
were changed.

## Executed journey

1. **Examiner authentication:** form login automatically reached the dashboard.
2. **Prepared paper:** only the new 9-mark, three-question fixture was published.
3. **Candidate attempt:** policy acknowledgement was required before Start.
   The timer started only on Start, with a ten-minute deadline. Each answer and
   the scratchpad reached server confirmation. After reload, the answers, notes
   and original deadline remained. Submission through the review dialog returned
   success, showed all three answers submitted and withheld unpublished marks.
   No correct answers were exposed in the candidate payload.
4. **Grading/publication:** objective answers received 2/2 and 3/3 respectively;
   the written answer received 3/4 with feedback. The completed and published
   score was **8/9 (88.9%)**.
5. **Results/report:** the candidate saw the published 8/9 score. The authorized
   PDF request returned HTTP 200, `application/pdf`, a `%PDF-` header and 5,474
   bytes. Anonymous report verification showed an authentic report, candidate
   initials and 8/9, without full email or private answer text.

A duplicate submission returned success without changing the score,
per-question marks or original submission time.

## Evidence and limitations

- The browser returned still-image observations for entry, saving, submission,
  grading, candidate results and anonymous verification. No image files were
  exposed for repository export.
- The tester reported that recording support lacked FFmpeg in its browser
  environment. FFmpeg in the project shell does not provide it to that separate
  environment. No continuous recording file was produced.
- Incorrect objective-answer scoring was not exercised in this journey.
- The PDF's header/type/size were checked; its extracted contents were not
  independently inspected for sensitive information.
- Examiner configuration and grading showed loading placeholders for several
  seconds. A dashboard briefly retained a draft label immediately after
  publication. These observations were not treated as failures of persisted
  publication.
- UI sign-out was used. An API sign-out request without the required origin
  context was rejected with HTTP 403.
- This is not complete PDF acceptance or verification of work still awaiting
  merge/deployment.
