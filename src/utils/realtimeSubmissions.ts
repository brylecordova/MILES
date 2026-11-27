import type { CourseSubmission } from '../types/training';

export function sortSubmissionsNewestFirst(list: CourseSubmission[]): CourseSubmission[] {
  return [...list].sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
}

export function mergeIncomingSubmission(
  existing: CourseSubmission[],
  incoming: CourseSubmission
): { next: CourseSubmission[]; isNew: boolean } {
  const alreadyPresent = existing.some((s) => s._id === incoming._id);
  if (alreadyPresent) {
    return {
      next: existing.map((s) => (s._id === incoming._id ? incoming : s)),
      isNew: false,
    };
  }
  return {
    next: sortSubmissionsNewestFirst([incoming, ...existing]),
    isNew: true,
  };
}

export function reconcileFetchedSubmissions(
  fetched: CourseSubmission[],
  knownIds: Set<string>,
  notifyOnNew: boolean
): { next: CourseSubmission[]; newlyDetected: CourseSubmission[] } {
  const sorted = sortSubmissionsNewestFirst(fetched);
  const newlyDetected: CourseSubmission[] = [];

  for (const sub of sorted) {
    if (!knownIds.has(sub._id)) {
      knownIds.add(sub._id);
      if (notifyOnNew) {
        newlyDetected.push(sub);
      }
    }
  }

  return {
    next: sorted,
    newlyDetected,
  };
}
