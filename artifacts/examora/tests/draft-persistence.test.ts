import test from 'node:test';
import assert from 'node:assert/strict';
import { createDraftWriter, DEVICE_STORAGE_ERROR, type DeviceWriteState } from '../src/lib/draft-persistence';

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
test('a device draft is confirmed only after its actual write resolves', async () => {
  const pending = deferred();
  const states: DeviceWriteState[] = [];
  const persist = createDraftWriter(async () => pending.promise, state => states.push(state));
  const saved = persist('answer');
  assert.equal(states.at(-1)?.status, 'writing');
  pending.resolve();
  await saved;
  assert.deepEqual(states.at(-1), { status: 'stored', error: null });
});
test('older successes do not confirm newer work; writes never race', async () => {
  const first = deferred(), second = deferred();
  const writes: string[] = [], states: DeviceWriteState[] = [];
  const persist = createDraftWriter<string>(draft => {
    writes.push(draft);
    return draft === 'first' ? first.promise : second.promise;
  }, state => states.push(state));
  const p1 = persist('first'), p2 = persist('second');
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(writes, ['first']);
  first.resolve();
  await p1;
  assert.ok(!states.some(s => s.status === 'stored'));
  await Promise.resolve();
  assert.deepEqual(writes, ['first', 'second']);
  second.resolve();
  await p2;
  assert.equal(states.at(-1)?.status, 'stored');
});
for (const name of ['QuotaExceededError', 'SecurityError', 'InvalidStateError']) {
  test(`${name} is visible, stays visible during retry, and clears only on success`, async () => {
    const states: DeviceWriteState[] = [];
    let failing = true;
    const persist = createDraftWriter(async () => {
      if (failing) throw new DOMException('Storage refused', name);
    }, state => states.push(state));
    await persist('draft');
    assert.deepEqual(states.at(-1), { status: 'failed', error: DEVICE_STORAGE_ERROR });
    failing = false;
    const retried = persist('draft');
    assert.deepEqual(states.at(-1), { status: 'writing', error: DEVICE_STORAGE_ERROR });
    await retried;
    assert.deepEqual(states.at(-1), { status: 'stored', error: null });
  });
}
