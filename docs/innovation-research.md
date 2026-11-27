# Examination innovation: evidence, decisions, and limits

Research reviewed on 27 November 2026. This is a product-design assessment,
not an independent evaluation of Examora or a systematic literature review.
Sources were searched and their full pages inspected; claims below distinguish
published research, institutional guidance, and vendor documentation.

## Executive conclusion

The strongest current demonstration is challenge **5.3, failure resilience**:
show a draft becoming pending during a brief interruption, reconnect within the
server deadline, obtain a server receipt, reload, and recover the accepted work.
Then show that changing the browser clock cannot extend server acceptance.

Do not call autosave itself an invention: established products already provide it.
Examora's practical differentiator is the integration and explanation of local
versus server-accepted state, fixed timing, immutable question assignment, and
non-punitive incident context in an accessible examination workflow.

The implementation is not yet independently validated for high-stakes use.
The scratchpad-only reload recovery scheduling gap identified in the coverage
assessment has been corrected and browser-verified in an isolated sandbox.
Locally retained notes now schedule synchronization after reload even when no
answers are pending, without requiring another edit. Full offline launch,
cross-device recovery of unsynchronized work, and retrospective proof of
offline authorship are not implemented.

### Scratchpad recovery verification

A real-browser sandbox check on 27 November 2026, with no answer edits, confirmed:

- Aborted scratchpad saves survived reload and were automatically retried.
  Restoring connectivity without another edit produced a server receipt and
  matching server text and local confirmed revision.
- Clearing notes to an empty string survived failed-save/reload recovery and
  reached the server as an empty string, not the previous notes.
- A simulated offline reload restored cached notes and kept the status
  **Offline · kept on device only** through repeated retry intervals. The
  scratchpad and header explicitly identified notes as unsynchronized.
- Unsent notes alone triggered the unload warning; server confirmation cleared
  it. Injected HTTP 500 responses retained the failed/retrying status, and
  automatic retries recovered without another edit after the failure ended.
- Moving only the test sandbox's server deadline into the past, then reloading
  with the browser clock one hour earlier, closed the attempt without accepting
  pending notes. A new scratchpad-only save returned HTTP 409 and left the
  server's last confirmed notes unchanged. Unconfirmed notes stayed on device.

Offline simulation used a browser offline flag and blocked API requests while
leaving the session endpoint reachable. This verifies cached-attempt recovery,
not a fully disconnected application launch. These targeted checks do not
establish cross-browser reliability or independent high-stakes validation.

## 1. Connectivity and submission failures

**Evidence.** BetterExaminations documents offline answering, failed submission,
and an encrypted recovery-package process. UCL provides an assessment query
route specifically including technical failures, upload failures, and question
errors.

**Who is affected.** Candidates on unstable networks, examination support staff,
and examiners deciding whether an incomplete record reflects academic work or
a technical failure. These sources establish a real operational need, but do
not establish a prevalence rate for Pakistani students.

**Implemented response.** Local answer drafts, revisions, retry synchronization,
server save receipts, and a server-owned deadline. Work received late is not
automatically awarded marks.

**Trade-off.** Strict acceptance protects the time limit but cannot guarantee
that a candidate with a long outage loses no work. That limitation must be
visible rather than hidden behind a “saved” label.

**Source caveat.** Vendor documentation is evidence of a product policy, not an
independent experiment. UCL's guidance is not itself a report of a specific
platform-wide outage.

## 2. Logs are not proof of cheating

**Documented case.** EFF reported in June 2021 that Dartmouth Geisel dropped
cheating allegations following further review and information from its LMS
provider. EFF explained that background syncing could produce activity logs
without intentional access by the student.

**Implemented response.** Examora's tab/network incidents are contextual.
They do not automatically deduct marks, generate a cheating verdict, or
disqualify a candidate.

**Needed extension: challenge 5.4.** A structured technical-incident review:

- Candidate statement attached to the relevant examination and attempt.
- Server save receipt/revision timeline separated from client-reported events.
- Examiner response and a recorded reason for any decision.
- A policy-preserving remedy such as a supervised resit, rather than silently
  accepting unverified late work.
- Role-scoped access and minimal disclosure of personal information.

**Status:** proposed, not implemented.

**Acceptance criteria:** another candidate cannot access a case; duplicated
submissions do not create competing decisions; each decision identifies its
reviewer and reason; client-reported timestamps remain explicitly unverified;
no decision silently modifies locked published grades.

**Evidence limitation.** EFF participated in challenging the investigation.
Its account is a documented technical/advocacy analysis, not a controlled study.

## 3. Privacy-preserving integrity, not an AI detector

**Research.** The 2022 Frontiers observational study examined approximately 357
students from four courses and found demographic disparities in review flags
in the studied automated proctoring system.

**Implemented response.** No required facial analysis, webcam recording,
microphone recording, or room scan. Controls focus on authorization, timing,
frozen question snapshots, exact marking, publication controls, and human review.

**Scope.** These are useful safeguards related to challenge 5.1, not a complete
solution to external AI assistance. They do not verify who is at the keyboard
or establish that no cheating occurred. The study does not prove every
proctoring system has the same disparities.

**Avoid.** Unvalidated “AI cheating percentages,” gaze-based accusations,
compulsory biometric collection, or punitive automatic decisions from browser
focus events. These would require evidence and policies that this application
does not have.

## 4. Randomized content can create unequal papers

**Research.** Chen, Hartline, and Zoeter's 2023 work explains how different
question subsets can produce different realized difficulty and studies
model-based grading. It does not justify describing arbitrary random selection
as fair.

**Implemented baseline.** Candidates receive the same selected questions and
marks, with optional question-order/choice shuffling and frozen attempt content.
This avoids unequal question-set sampling, but not every potential order effect
or accessibility issue.

**Needed extension: challenge 5.2.** Transparent exam blueprints with required
topic coverage, difficulty bands, question types, and mark totals:

- Validate the eligible bank before publication.
- Reject an impossible blueprint; never silently relax its constraints.
- Freeze each generated form and marking scheme.
- Show the examiner how forms match the configured blueprint.
- Report observed item performance with sample counts.

**Status:** proposed, not implemented.

**Acceptance criteria:** generated forms satisfy all configured counts and
marks; shortages are explicit; active attempts never change after bank edits;
small-sample observed accuracy is not labelled calibrated difficulty.

**Trade-off.** Examiner difficulty labels are judgments, not psychometric
calibration. Do not claim validated equivalence from a tiny fictional dataset,
or silently apply research-model grade adjustments to published results.

## 5. What must not be claimed

- No guarantee of zero lost work, zero downtime, or a cheating-free examination.
- A QR code verifies a matching issued database record; it is not a
  blockchain credential or tamper-proof offline signature.
- A browser-generated hash does not establish when an offline answer was written.
- A server receipt establishes acceptance of a revision, not the candidate's
  independent authorship of that answer.
- IndexedDB is local browser persistence, not a cross-device backup.
- No institution cited here has endorsed or deployed Examora.
- No measured improvement percentage is available from the fictional demo.

## Sources

1. BetterExaminations, “Loss of connectivity” (updated 31 May 2021).
   https://docs.betterexaminations.com/betterexaminations-online/academic-staff/managing-exams/loss-of-connectivity
2. University College London, “Support during your remote online assessment.”
   https://www.ucl.ac.uk/study/current-students/exams-and-assessments/support-during-your-remote-online-assessment
3. Electronic Frontier Foundation, “Victory! Dartmouth Ends Unfounded Cheating
   Investigation After Students, Rights Groups Speak Out” (10 June 2021).
   https://www.eff.org/deeplinks/2021/06/dartmouth-ends-misguided-investigation-after-students-rights-groups-speak-out
4. “Racial, skin tone, and sex disparities in automated proctoring software,”
   Frontiers in Education (20 September 2022).
   https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2022.881449/full
5. Jiale Chen, Jason Hartline, and Onno Zoeter, “Fair Grading Algorithms for
   Randomized Exams,” FORC 2023; author manuscript:
   https://arxiv.org/html/2304.06254v1
