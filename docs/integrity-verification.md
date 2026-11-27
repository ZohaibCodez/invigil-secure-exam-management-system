# Integrated examination safeguards: verification and demonstration

## Scope

These are development regression checks with fictional data, not independent
high-stakes, psychometric, security or cross-browser certification. No published
production service was changed. No stored deadline, server clock, browser clock,
Git authorship or timestamp was rewritten in this verification.

## Reproducible server checks

After explicitly applying the development schema:

```sh
pnpm --filter @workspace/db run push
pnpm exec tsc -p artifacts/api-server/tsconfig.source.json --noEmit
pnpm exec tsc -p artifacts/examora/tsconfig.source.json --noEmit
pnpm --filter @workspace/api-server exec tsx --test src/integrity.test.ts src/blueprint.test.ts
```

The two source-only type checks and all three regression tests passed on
27 November 2026. The tests call actual Express handlers, authorization rules
and PostgreSQL transactions. They do not bypass authentication in the running
application or establish that every HTTP middleware behaves correctly.
They create unique fictional fixtures and remove them afterward.

| Area | What the server checks confirmed |
| --- | --- |
| Policy | Conditional AI mode; AI-with-disclosure cannot disable disclosure; version changes with content; exact published policy snapshot; missing/false/stale acknowledgement rejected; concurrent starts return the same attempt. |
| Compatibility | No-policy published examination remains accessible; resume retains the original attempt, policy and acknowledgement; sandbox cannot produce candidate acknowledgement. |
| Disclosure | Candidate-only access; identical retries do not add versions; stale competing updates rejected; missing required disclosure visible after natural expiry, without blocking finalization or modifying marks. |
| Save integrity | Identical concurrent save retry; conflicting reuse of an operation ID; answer and scratchpad conflicts; accepted answer/scratchpad content preserved; new saves after closure rejected. |
| Timing | An original short examination closing window expires naturally; late saves rejected; deadline unchanged; repeat submit is idempotent. |
| Authorship | Assigned-question linkage; request only after submission; owner/admin access; candidate/outsider isolation; identical request retry; changed window rejected; immutable response and reasoned outcome; competing reviewers serialized. |
| Separate window | A short directly seeded review fixture expires by elapsed time; late explanation rejected; advisory referral then allowed. Normal API requests enforce 1–168 hours. |
| Incident review | Existing candidate statement/decision endpoints reused; candidate/examiner isolation; identical statements and conflicting replacements; no-action decision preserved separately from authorship explanations. |
| Published grades | Authorship and incident decisions leave the entire original attempt unchanged, including answers, score, questions, acknowledgement, scratchpad and deadline; published-grade mutation rejected. |
| Blueprint | Exact sampling, explicit shortages blocking publication/generation, repeated starts, frozen bank content/marking after bank deletion, authorized comparisons, sandbox exclusion from real statistics, and locked grades. |

## Browser verification

One integrated browser pass completed successfully on 27 November 2026 using
separate fictional examiner and candidate sessions:

- Saved and reloaded conditional AI policy, then AI with disclosure; confirmed
  its disclosure checkbox could not be disabled.
- Saved an impossible blueprint and saw explicit shortage/publication blocking;
  repaired the quota, published and confirmed the policy/settings were locked.
- Verified sandbox acknowledgement was null. At 402 pixels, the policy version
  wrapped with no horizontal overflow.
- Read the policy before entry; Start timer stayed disabled until acknowledged.
  The server recorded the matching version and acknowledgement time.
- Blocked answer saves, edited only scratchpad notes and reloaded. Restoring
  requests synchronized notes automatically without another edit.
- Simulated offline state with `navigator.onLine` and blocked answer saves while
  keeping assets and session available. Answer and note edits survived reload;
  reconnecting produced matching server content and confirmation.
- Saved disclosure, reloaded and submitted through the confirmation dialog.
- Requested a question-linked explanation with a one-hour window; early decision
  was rejected. Candidate responded and reloaded; examiner recorded a reasoned
  satisfactory outcome; candidate saw attribution, time and reason.
- Recorded a separate technical-incident statement and no-action outcome through
  the existing workflow. Same-session API retries returned identical records;
  conflicting explanations, decisions, incident statements and request hours
  returned conflicts. Original answers, deadline and score were unchanged.

The browser pass did **not** repeat natural expiry, cross-user denial, duplicate
starts, conflicting save payloads, missing disclosure or frozen-bank checks;
those were covered by the server regressions above. Offline simulation is not
fully disconnected application launch. The uniquely created browser fixtures
were removed after verification; existing demo data was left untouched.

Small presentation findings were corrected afterward: the dashboard review link
now wraps, candidate explanation cards receive question text, the navigation
legend explicitly identifies its amber-dot meaning, and Monitor offers explicit
review refresh with its polling interval explained. These low-risk changes were
confirmed by source-only typechecking and code inspection, not a second browser
pass.

A pre-existing login/logout screen-refresh issue remains: authentication can
succeed while the screen continues showing a spinner until reload. The pass
used that workaround. Other sessions' review changes are polled every 10–15
seconds, not pushed instantly. Fully objective attempts become internally graded
on submission; candidate marks remain hidden until publication, as intended.

## Fictional-data demonstration sequence

Use only a disposable demonstration database with the public fictional accounts
in the README. Never use those accounts with real student records.

1. **Examiner:** draft “Numbers and reasoning”, select an objective question,
   enroll a fictional candidate, and enter an impossible blueprint quota. Show
   the shortage, then repair it. Configure “AI with disclosure” and a clear
   resources statement; publish. Show the locked policy and quotas.
2. **Candidate:** open Begin exam. Show the policy before entry and the unchecked
   acknowledgement. Check it and start. Record the displayed fixed deadline.
3. **Recovery:** briefly interrupt answer-save requests. Enter scratchpad-only
   work and reload; restore connectivity before the deadline. Show pending
   versus server-confirmed state. Do not describe this as fully offline launch
   or guaranteed recovery.
4. **Candidate:** answer, open the assistance section, explicitly save a disclosure,
   and submit. Show the policy snapshot and acknowledgement time.
5. **Examiner:** select the candidate in Monitor. Ask for an explanation of the
   assigned answer, with a separate one-hour window. Do not reopen the attempt.
6. **Candidate:** follow the dashboard review link, submit an explanation and
   reload to show persistence.
7. **Examiner:** record a satisfactory outcome with a reason. Candidate sees the
   reviewer, time and reason. Show unchanged examination answers/deadline/marks.
   Explain that “further review” refers to the institution's existing process.
8. **Optional expiry demonstration:** create a separate exam with an original
   near-term closing time and wait for it naturally. Show missing required
   disclosure and rejected late saves. Never edit deadlines or clocks to stage it.

## Remaining limits

- There is no detection of external AI, verified identity, device lockdown or
  proof of when offline work was authored. Human explanations do not prove
  independent authorship.
- Recovery requires available device storage and server acceptance before the
  fixed deadline. Unsynchronized work is not a cross-device backup. Fully
  disconnected application launch is not supported.
- Disclosures require explicit online saving; a missing disclosure is a record,
  not a finding. Explanation/decision forms are not offline-recovery documents.
- Policy acknowledgements and disclosures are self-reported. Acknowledgement
  demonstrates an affirmative server request for that version, not actual
  comprehension or compliance.
- Coverage quotas and examiner-assigned difficulty do not establish calibrated
  equivalence or universal fairness. Observed accuracy never adjusts grades.
- Reviews are advisory, not a formal institutional appeals/resit system.
- Fixture-based tests do not establish reliability under long outages, storage
  eviction, device loss, multiple browser engines or institutional-scale load.
