import type { CourseSubmission, SubmissionStatus } from '../types/training';

export interface CourseSubmissionPolicy {
  latestSubmission: CourseSubmission | null;
  isCompleted: boolean;
  isRetakeBlocked: boolean;
  canRetryRejected: boolean;
}

export function isSubmissionRetakeBlocked(
  submission: CourseSubmission | null | undefined
): boolean {
  return Boolean(
    submission && submission.status === 'rejected' && submission.allowRetry === false
  );
}

export function canRetryRejectedSubmission(
  submission: CourseSubmission | null | undefined
): boolean {
  return Boolean(
    submission && submission.status === 'rejected' && submission.allowRetry !== false
  );
}

export function getLatestSubmissionsByCourse(
  submissions: CourseSubmission[]
): Map<string, CourseSubmission> {
  const sorted = [...submissions].sort((a, b) =>
    (b.submittedAt || '').localeCompare(a.submittedAt || '')
  );
  const map = new Map<string, CourseSubmission>();
  for (const sub of sorted) {
    if (sub.courseId && !map.has(sub.courseId)) {
      map.set(sub.courseId, sub);
    }
  }
  return map;
}

export function getCourseSubmissionPolicy(
  submissions: CourseSubmission[],
  courseId: string
): CourseSubmissionPolicy {
  const latestSubmission = getLatestSubmissionsByCourse(submissions).get(courseId) ?? null;
  if (!latestSubmission) {
    return {
      latestSubmission: null,
      isCompleted: false,
      isRetakeBlocked: false,
      canRetryRejected: false,
    };
  }

  return {
    latestSubmission,
    isCompleted: latestSubmission.completed !== false,
    isRetakeBlocked: isSubmissionRetakeBlocked(latestSubmission),
    canRetryRejected: canRetryRejectedSubmission(latestSubmission),
  };
}

export function normalizeReviewAllowRetry(
  decision: Extract<SubmissionStatus, 'approved' | 'rejected'>,
  requestedAllowRetry: unknown
): boolean | undefined {
  if (decision !== 'rejected') {
    return undefined;
  }
  return requestedAllowRetry === false ? false : true;
}
