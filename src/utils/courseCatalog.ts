import type {
  Course,
  CourseProgressState,
  CourseSubmission,
  QuestionAttemptRecord,
  QuizAnswerValue,
  QuizAttemptSummary,
} from '../types/training';
import {
  canRetryRejectedSubmission,
  getLatestSubmissionsByCourse,
} from './submissionPolicy';

export const COURSE_PROGRESS_STORAGE_KEY = 'certifield_course_progress_v1';

export interface StoredLocalProgressEntry {
  courseId?: string;
  completedModuleIds?: string[];
  currentModuleIndex?: number;
  status?: 'not_started' | 'in_progress' | 'completed';
  percent?: number;
  updatedAt?: string;
}

export interface CourseProgressSummary {
  hasSavedProgress: boolean;
  status: 'not_started' | 'in_progress' | 'completed';
  completedModules: number;
  totalModules: number;
  percent: number;
}

export function filterCoursesByQuery(courses: Course[], rawQuery: string): Course[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return courses;
  return courses.filter((course) => {
    const titleMatch = course.title.toLowerCase().includes(query);
    const descriptionMatch = course.description.toLowerCase().includes(query);
    return titleMatch || descriptionMatch;
  });
}

export function parseStoredProgressMap(
  rawJson: string | null
): Record<string, StoredLocalProgressEntry> {
  if (!rawJson) return {};
  try {
    const parsed = JSON.parse(rawJson) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const result: Record<string, StoredLocalProgressEntry> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = value as StoredLocalProgressEntry;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function readCourseProgressFromLocalStorage(): Record<string, StoredLocalProgressEntry> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    return parseStoredProgressMap(window.localStorage.getItem(COURSE_PROGRESS_STORAGE_KEY));
  } catch {
    return {};
  }
}

export function writeCourseProgressEntryToLocalStorage(progress: CourseProgressState): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const current = readCourseProgressFromLocalStorage();
    current[progress.courseId] = {
      courseId: progress.courseId,
      completedModuleIds: progress.completedModuleIds,
      currentModuleIndex: progress.currentModuleIndex,
      status: progress.status,
      updatedAt: progress.updatedAt,
    };
    window.localStorage.setItem(COURSE_PROGRESS_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

export function removeCourseProgressEntryFromLocalStorage(courseId: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const current = readCourseProgressFromLocalStorage();
    if (courseId in current) {
      delete current[courseId];
      window.localStorage.setItem(COURSE_PROGRESS_STORAGE_KEY, JSON.stringify(current));
    }
  } catch {
    // Ignore storage errors
  }
}

export function getCompletedCourseIdsFromSubmissions(
  submissions: CourseSubmission[]
): Set<string> {
  const completedIds = new Set<string>();
  for (const sub of submissions) {
    if (sub.courseId && sub.completed !== false) {
      completedIds.add(sub.courseId);
    }
  }
  return completedIds;
}

export function buildCompletedProgressFromSubmission(
  course: Course,
  submission: CourseSubmission,
  existing?: CourseProgressState
): CourseProgressState {
  const allModuleIds = course.modules.map((m) => m.id);
  const mergedCompletedIds = Array.from(
    new Set([...(existing?.completedModuleIds ?? []), ...allModuleIds])
  );
  const lastIndex = Math.max(0, course.modules.length - 1);

  const hydratedQuestionResults: Record<string, QuestionAttemptRecord> =
    existing?.latestQuestionResults && Object.keys(existing.latestQuestionResults).length > 0
      ? existing.latestQuestionResults
      : Object.fromEntries(
          (submission.questionResults ?? []).map((rec) => [rec.questionId, rec])
        );

  const hydratedQuizResults: Record<string, QuizAttemptSummary> =
    existing?.quizResults && Object.keys(existing.quizResults).length > 0
      ? existing.quizResults
      : Object.fromEntries((submission.quizResults ?? []).map((qr) => [qr.quizId, qr]));

  const hydratedQuestionTries: Record<string, number> =
    existing?.questionTries && Object.keys(existing.questionTries).length > 0
      ? existing.questionTries
      : Object.fromEntries(
          (submission.questionResults ?? []).map((rec) => [
            rec.questionId,
            Math.max(1, rec.tries || 1),
          ])
        );

  const hydratedQuizAttempts: Record<string, number> =
    existing?.quizAttempts && Object.keys(existing.quizAttempts).length > 0
      ? existing.quizAttempts
      : Object.fromEntries(
          (submission.quizResults ?? []).map((qr) => [qr.quizId, Math.max(1, qr.attempts || 1)])
        );

  const hydratedAnswers: Record<string, QuizAnswerValue> =
    existing?.latestAnswers && Object.keys(existing.latestAnswers).length > 0
      ? existing.latestAnswers
      : Object.fromEntries(
          (submission.questionResults ?? []).map((rec) => [rec.questionId, rec.userAnswer ?? null])
        );

  return {
    courseId: course._id,
    currentModuleIndex: Math.max(existing?.currentModuleIndex ?? 0, lastIndex),
    completedModuleIds: mergedCompletedIds,
    questionTries: hydratedQuestionTries,
    quizAttempts: hydratedQuizAttempts,
    latestAnswers: hydratedAnswers,
    latestQuestionResults: hydratedQuestionResults,
    quizResults: hydratedQuizResults,
    readingDurationSeconds: Math.max(
      existing?.readingDurationSeconds ?? 0,
      submission.readingDurationSeconds ?? 0
    ),
    status: 'completed',
    startedAt: existing?.startedAt ?? submission.submittedAt,
    updatedAt: existing?.updatedAt || submission.submittedAt,
  };
}

export function reconcileProgressMapWithSubmissions(
  courses: Course[],
  progressMap: Record<string, CourseProgressState>,
  submissions: CourseSubmission[]
): Record<string, CourseProgressState> {
  if (!submissions.length) return progressMap;
  const latestSubByCourse = getLatestSubmissionsByCourse(submissions);
  if (latestSubByCourse.size === 0) return progressMap;

  const coursesById = new Map(courses.map((c) => [c._id, c]));
  const next: Record<string, CourseProgressState> = { ...progressMap };
  for (const [courseId, sub] of latestSubByCourse.entries()) {
    if (sub.completed === false) continue;
    const course = coursesById.get(courseId);
    if (!course) continue;
    if (canRetryRejectedSubmission(sub) && next[courseId]?.status === 'in_progress') {
      continue;
    }
    next[courseId] = buildCompletedProgressFromSubmission(course, sub, next[courseId]);
  }
  return next;
}

export function computeCourseProgressSummary(
  course: Course,
  progressMap: Record<string, StoredLocalProgressEntry>,
  completedCourseIds?: Set<string>
): CourseProgressSummary {
  const totalModules = Math.max(0, course.modules.length);
  if (completedCourseIds?.has(course._id)) {
    return {
      hasSavedProgress: true,
      status: 'completed',
      completedModules: totalModules,
      totalModules,
      percent: 100,
    };
  }

  const entry = progressMap[course._id];
  if (!entry) {
    return {
      hasSavedProgress: false,
      status: 'not_started',
      completedModules: 0,
      totalModules,
      percent: 0,
    };
  }

  const validModuleIds = new Set(course.modules.map((m) => m.id));
  const completedFromIds = Array.isArray(entry.completedModuleIds)
    ? entry.completedModuleIds.filter((id) => validModuleIds.has(id)).length
    : 0;

  let percent = 0;
  if (typeof entry.percent === 'number' && Number.isFinite(entry.percent)) {
    percent = Math.max(0, Math.min(100, Math.round(entry.percent)));
  } else if (entry.status === 'completed') {
    percent = 100;
  } else if (totalModules > 0) {
    percent = Math.max(0, Math.min(100, Math.round((completedFromIds / totalModules) * 100)));
  }

  const completedModules =
    entry.status === 'completed' || percent === 100
      ? totalModules
      : completedFromIds > 0
      ? completedFromIds
      : totalModules > 0 && percent > 0
      ? Math.round((percent / 100) * totalModules)
      : 0;

  const status: 'not_started' | 'in_progress' | 'completed' =
    entry.status === 'completed' || percent >= 100
      ? 'completed'
      : entry.status === 'in_progress' || percent > 0 || completedModules > 0
      ? 'in_progress'
      : 'not_started';

  return {
    hasSavedProgress: true,
    status,
    completedModules,
    totalModules,
    percent,
  };
}
