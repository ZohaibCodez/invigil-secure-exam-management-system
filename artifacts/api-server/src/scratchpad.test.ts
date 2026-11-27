import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { db, pool, users, exams, attempts, saveOperations, eq, and, inArray } from '@workspace/db';
import attemptRouter from './routes/attempts';
import { HttpError, type AppUser } from './lib/access';

type TestRouter = { stack: { route?: { path: string; methods: Record<string, boolean>; stack: { handle: (req: Request, res: Response) => Promise<void> }[] } }[] };
async function call(method: string, path: string, id: string, appUser: AppUser, body = {}) {
  const route = (attemptRouter as unknown as TestRouter).stack.find(s => s.route?.path === path && s.route.methods[method])!.route!;
  let status = 200;
  let data: any;
  const res = { status(n: number) { status = n; return this; }, json(value: unknown) { data = value; return this; } } as Response;
  try { await route.stack[0]!.handle({ params: { id }, appUser, body } as unknown as Request, res); }
  catch (e) { if (e instanceof HttpError) return { status: e.status, data: { error: e.message } }; throw e; }
  return { status, data };
}

test('scratchpad versions prevent stale tabs, partial batches, replay drift, and late saves', async () => {
  const prefix = `scratch-test-${randomUUID()}`;
  const ids = ['owner', 'candidate', 'other'].map(s => `${prefix}-${s}`);
  const examId = `${prefix}-exam`, attemptId = `${prefix}-attempt`, expiredId = `${prefix}-expired`;
  const path = '/attempts/:id/answers';
  try {
    const people = await db.insert(users).values(ids.map((id, index) => ({
      id, email: `${id}@example.invalid`, name: `Fixture ${index}`, role: index === 0 ? 'examiner' : 'candidate',
    }))).returning();
    const [owner, candidate, other] = ids.map(id => people.find(p => p.id === id)!);
    const now = Date.now();
    const deadline = new Date(now + 60_000), past = new Date(now - 1000);
    await db.insert(exams).values({ id: examId, ownerId: owner!.id, title: 'Scratchpad fixture',
      instructions: 'Fixture only', duration: 5, startsAt: new Date(now - 60_000), endsAt: new Date(now + 60_000), status: 'published' });
    const questions = [{ id: 'written', text: 'Explain', type: 'written' as const, category: 'Fixture',
      difficulty: 'easy' as const, marks: 1, options: [], correctAnswers: [] }];
    await db.insert(attempts).values([
      { id: attemptId, examId, userId: candidate!.id, questions, totalMarks: 1, startedAt: new Date(now - 2000), deadline },
      { id: expiredId, examId, userId: other!.id, questions, totalMarks: 1, startedAt: new Date(now - 2000), deadline: past },
    ]);
    const save = (body: Record<string, unknown>, who = candidate!, id = attemptId) =>
      call('put', path, id, who, { operationId: randomUUID(), answers: [], ...body });
    const row = async () => (await db.select().from(attempts).where(eq(attempts.id, attemptId)))[0]!;
    assert.equal((await row()).scratchpadVersion, 0);
    const originalOp = randomUUID();
    const first = await save({ operationId: originalOp, scratchpad: 'Tab A', scratchpadVersion: 0 });
    assert.equal(first.data.accepted, true);
    assert.equal(first.data.scratchpadVersion, 1);

    const rejectedOp = randomUUID();
    const stale = await save({ operationId: rejectedOp, scratchpad: 'Stale tab', scratchpadVersion: 0,
      answers: [{ questionId: 'written', value: 'Must not partially save', revision: 1, markedForReview: false }] });
    assert.equal(stale.data.accepted, false);
    assert.equal(stale.data.conflict, 'scratchpad');
    assert.equal((await row()).scratchpad, 'Tab A');
    assert.deepEqual((await row()).answers, []);
    assert.equal((await db.select().from(saveOperations).where(and(eq(saveOperations.attemptId, attemptId), eq(saveOperations.operationId, rejectedOp)))).length, 0);
    assert.equal((await save({ scratchpad: 'Missing version' })).data.accepted, false);

    const second = await save({ scratchpad: 'Tab B', scratchpadVersion: 1 });
    assert.equal(second.data.scratchpadVersion, 2);
    const replay = await save({ operationId: originalOp, scratchpad: 'Tab A', scratchpadVersion: 0 });
    assert.equal(replay.data.scratchpadVersion, 1, 'retry returns the original receipt version, not a later write');
    assert.equal(replay.data.savedAt, first.data.savedAt);
    assert.equal((await row()).scratchpad, 'Tab B');
    const answerOnly = await save({ answers: [{ questionId: 'written', value: 'Answer', revision: 2, markedForReview: false }] });
    assert.equal(answerOnly.data.accepted, true);
    assert.equal((await row()).scratchpadVersion, 2);

    const concurrent = await Promise.all(['Left', 'Right'].map(scratchpad => save({ scratchpad, scratchpadVersion: 2 })));
    assert.equal(concurrent.filter(r => r.data.accepted).length, 1);
    assert.equal(concurrent.filter(r => r.data.conflict === 'scratchpad').length, 1);
    assert.equal((await row()).scratchpadVersion, 3);
    const clear = await save({ scratchpad: '', scratchpadVersion: 3 });
    assert.equal(clear.data.accepted, true);
    assert.equal((await row()).scratchpad, '');
    assert.equal((await row()).scratchpadVersion, 4);
    assert.equal((await row()).deadline.toISOString(), deadline.toISOString());
    assert.equal((await save({ scratchpad: 'Wrong candidate', scratchpadVersion: 4 }, other!)).status, 403);

    const late = await save({ scratchpad: 'Late text', scratchpadVersion: 0 }, other!, expiredId);
    assert.equal(late.status, 409);
    const [expired] = await db.select().from(attempts).where(eq(attempts.id, expiredId));
    assert.notEqual(expired!.status, 'active', 'deadline finalization is committed even though the write is rejected');
    assert.equal(expired!.scratchpad, '');
    assert.equal(expired!.deadline.toISOString(), past.toISOString());
    assert.equal((await call('post', '/attempts/:id/submit', attemptId, candidate!)).status, 200);
    assert.equal((await save({ scratchpad: 'After submit', scratchpadVersion: 4 })).status, 409);
    assert.equal((await row()).scratchpad, '');
  } finally {
    await db.delete(saveOperations).where(inArray(saveOperations.attemptId, [attemptId, expiredId]));
    await db.delete(attempts).where(inArray(attempts.id, [attemptId, expiredId]));
    await db.delete(exams).where(eq(exams.id, examId));
    await db.delete(users).where(inArray(users.id, ids));
  }
});
after(async () => { await pool.end(); });
