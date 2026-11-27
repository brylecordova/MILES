import test from 'node:test';
import assert from 'node:assert/strict';
import type { CourseSubmission } from '../types/training';
import {
  canRetryRejectedSubmission,
  getCourseSubmissionPolicy,
  isSubmissionRetakeBlocked,
  normalizeReviewAllowRetry,
} from './submissionPolicy';

function makeSubmission(overrides: Partial<CourseSubmission>): CourseSubmission {
  return {
    _id: 'sub-1',
    courseId: 'course-1',
    courseTitle: 'Safety Training',
    certificateTitle: 'Safety Specialist',
    issuerName: 'MiLES',
    userId: 'user-1',
    userName: 'Alex Rivera',
    userEmail: 'alex@example.com',
    overallScore: 80,
    passed: true,
    completed: true,
    status: 'pending_review',
    submittedAt: '2026-05-01T10:00:00.000Z',
    questionResults: [],
    quizResults: [],
    ...overrides,
  };
}

test('getCourseSubmissionPolicy blocks retake only when latest rejected submission sets allowRetry=false', () => {
  const blocked = makeSubmission({ status: 'rejected', allowRetry: false });
  assert.equal(isSubmissionRetakeBlocked(blocked), true);
  assert.equal(canRetryRejectedSubmission(blocked), false);

  const policy = getCourseSubmissionPolicy([blocked], 'course-1');
  assert.equal(policy.isRetakeBlocked, true);
  assert.equal(policy.canRetryRejected, false);
  assert.equal(policy.isCompleted, true);
});

test('getCourseSubmissionPolicy allows retry when rejected submission leaves allowRetry true or undefined', () => {
  const retryAllowed = makeSubmission({ status: 'rejected', allowRetry: true });
  const legacyRejected = makeSubmission({ status: 'rejected' });

  assert.equal(isSubmissionRetakeBlocked(retryAllowed), false);
  assert.equal(canRetryRejectedSubmission(retryAllowed), true);
  assert.equal(canRetryRejectedSubmission(legacyRejected), true);

  const policy = getCourseSubmissionPolicy([retryAllowed], 'course-1');
  assert.equal(policy.isRetakeBlocked, false);
  assert.equal(policy.canRetryRejected, true);
});

test('getCourseSubmissionPolicy evaluates the newest submission when multiple attempts exist', () => {
  const olderBlocked = makeSubmission({
    _id: 'sub-old',
    status: 'rejected',
    allowRetry: false,
    submittedAt: '2026-05-01T10:00:00.000Z',
  });
  const newerApproved = makeSubmission({
    _id: 'sub-new',
    status: 'approved',
    submittedAt: '2026-05-02T10:00:00.000Z',
  });

  const policy = getCourseSubmissionPolicy([olderBlocked, newerApproved], 'course-1');
  assert.equal(policy.latestSubmission?._id, 'sub-new');
  assert.equal(policy.isRetakeBlocked, false);
  assert.equal(policy.canRetryRejected, false);
});

test('normalizeReviewAllowRetry returns boolean for rejected decisions and undefined for approved', () => {
  assert.equal(normalizeReviewAllowRetry('rejected', false), false);
  assert.equal(normalizeReviewAllowRetry('rejected', true), true);
  assert.equal(normalizeReviewAllowRetry('rejected', undefined), true);
  assert.equal(normalizeReviewAllowRetry('approved', false), undefined);
});
