# Candidate work recovery

The device draft and the server record are separate. Only a server receipt
confirms that work reached the examination before its fixed deadline. A device
draft can support recovery, but must not be described as durable until its
IndexedDB write succeeds.

## Automated regression checks

Run `pnpm run test:recovery` against the configured **development** database.
The API test creates uniquely named fictional fixtures and removes only those
fixtures afterwards.

The checks cover:

- Scratchpad compare-and-swap versions, including two simultaneous writers.
- Rejected stale notes without partially persisting accompanying answers.
- Immutable save receipts when an old operation is retried after newer saves.
- Ordinary answer saves without changing scratchpad versions.
- Empty-string note clears, candidate isolation, and immutable deadlines.
- Rejection of late or post-submission saves, with expiry finalization committed.
- Device confirmation only after the actual write completes.
- Serialized device writes; an older success cannot confirm a newer draft.
- Quota, security and unavailable-storage errors, including successful retry.
- Storage warnings remain visible while a failed write is being retried.

These are route/database and persistence-logic checks, not browser tests or a
guarantee of recovery across every device, private-browsing mode or browser crash.

## Candidate-facing behavior

When another tab saves different notes, both versions are displayed. The
candidate must explicitly choose whether to replace the latest server notes or
discard their unsent copy. Answers can continue syncing while the scratchpad
choice is unresolved. A new conflict is possible if another tab saves again
before that choice reaches the server.

Device-storage failures are reported separately from network/server failures.
Server-confirmed work remains confirmed even if device storage is unavailable.
Retrying device storage cannot extend the examination or change closed answers.
Scratchpad notes are not graded.

## Browser verification

A focused browser pass on 2026-11-27 verified cross-tab comparison and explicit
resolution, empty clears across reload, scratchpad-only unsent reload recovery,
real IndexedDB write failures, separate server/device status, persistence retry
and reconnection. The server deadline remained unchanged throughout.

The test inspected retained **answer** data after storage was restored; it did
not separately inspect the scratchpad's device-store copy during the injected
storage-failure phase. This is not a full PDF acceptance or production test.
