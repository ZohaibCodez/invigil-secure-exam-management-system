# Automated verification results

These checks were executed successfully during development on 2026-11-27.
They are code, route and database checks, not a claim of complete end-to-end or
production coverage.

| Command | Result |
| --- | --- |
| `pnpm run typecheck` | Workspace type checks passed |
| `pnpm run test:recovery` | 6 tests passed |
| `pnpm run test:auth-cache` | 1 test passed |
| `pnpm --filter @workspace/api-server exec tsx --test src/blueprint.test.ts src/incident-review.test.ts` | 3 tests passed |
| Frontend type check after the sign-in correction | Passed |

The recovery checks cover server scratchpad versions, concurrent writers,
no partial application of a rejected batch, original retry receipts, empty
clears, candidate isolation, late/post-submission rejection, serialized device
writes, truthful confirmation, quota/security/unavailable-storage errors and
successful retries.

The blueprint/incident checks cover exact stratified selection, frozen papers
and marking, comparison authorization, immutable grades, evidence separation,
review permissions and duplicate requests.

The tests use uniquely named fictional development fixtures and remove their
own fixtures. Do not point database-writing tests at a production database.

One initial recovery-test run failed in fixture cleanup because dependent
attempts still referenced the fixture examination. Cleanup was corrected, the
remaining fixture was removed, and the full six-test recovery command passed.
That cleanup failure is not omitted from the evidence.

See [recovery behavior and limitations](../../recovery-verification.md) for
additional context.
