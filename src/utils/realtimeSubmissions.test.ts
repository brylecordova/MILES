import test from 'node:test';
import assert from 'node:assert/strict';
import type { CourseSubmission } from '../types/training';
import {
  mergeIncomingSubmission,
  reconcileFetchedSubmissions,
} from './realtimeSubmissions';

function makeSubmission(id: string, submittedAt: string, status: CourseSubmission['status'] = 'pending_review'): CourseSubmission {
  return {
    _id: id,
    courseId: 'course-1',
    courseTitle: 'Safety Fundamentals',
    certificateTitle: 'Safety Specialist',
    issuerName: 'MiLES Academy',
    userId: 'user-1',
    userName: 'Alex Rivera',
    userEmail: 'alex@example.com',
    overallScore: 92,
    passed: true,
    completed: true,
    status,
    submittedAt,
    questionResults: [],
    quizResults: [],
  };
}

test('mergeIncomingSubmission prepends unseen submissions newest-first and updates existing ones without duplicating', () => {
  const older = makeSubmission('sub-1', '2026-11-26T10:00:00.000Z');
  const newer = makeSubmission('sub-2', '2026-11-26T10:05:00.000Z');

  const firstAdd = mergeIncomingSubmission([older], newer);
  assert.equal(firstAdd.isNew, true);
  assert.deepEqual(
    firstAdd.next.map((s) => s._id),
    ['sub-2', 'sub-1']
  );

  const updated = makeSubmission('sub-2', '2026-11-26T10:05:00.000Z', 'approved');
  const afterUpdate = mergeIncomingSubmission(firstAdd.next, updated);
  assert.equal(afterUpdate.isNew, false);
  assert.equal(afterUpdate.next.length, 2);
  assert.equal(afterUpdate.next[0].status, 'approved');
});

test('reconcileFetchedSubmissions seeds initial load silently and flags unseen arrivals afterward', () => {
  const knownIds = new Set<string>();
  const s1 = makeSubmission('sub-1', '2026-11-26T10:00:00.000Z');
  const s2 = makeSubmission('sub-2', '2026-11-26T10:10:00.000Z');

  const initial = reconcileFetchedSubmissions([s1], knownIds, false);
  assert.equal(initial.newlyDetected.length, 0);
  assert.equal(knownIds.has('sub-1'), true);

  const followUp = reconcileFetchedSubmissions([s1, s2], knownIds, true);
  assert.deepEqual(
    followUp.newlyDetected.map((s) => s._id),
    ['sub-2']
  );
  assert.deepEqual(
    followUp.next.map((s) => s._id),
    ['sub-2', 'sub-1']
  );

  // Subsequent sync with same list emits no duplicate notifications
  const repeat = reconcileFetchedSubmissions([s1, s2], knownIds, true);
  assert.equal(repeat.newlyDetected.length, 0);
});
