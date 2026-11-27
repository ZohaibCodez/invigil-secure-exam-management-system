import test from 'node:test';
import assert from 'node:assert/strict';
import { hasAnswerValue } from '../src/lib/answer-state';

test('written answers that begin with brackets still count for submission and locking', () => {
  for (const value of ['[]', '[0, 1]', '[proof follows]', 'A written response']) {
    assert.equal(hasAnswerValue(value, 'written'), true);
  }
  for (const value of ['', ' \n\t', undefined]) assert.equal(hasAnswerValue(value, 'written'), false);
});
test('objective answers require a nonempty selection array and a known question type', () => {
  assert.equal(hasAnswerValue('["a"]', 'single'), true);
  assert.equal(hasAnswerValue('["a","b"]', 'multiple'), true);
  for (const value of ['[]', '', 'not-json', 'null', '"a"', '[1]']) {
    assert.equal(hasAnswerValue(value, 'multiple'), false);
  }
  assert.equal(hasAnswerValue('anything', undefined), false);
});
