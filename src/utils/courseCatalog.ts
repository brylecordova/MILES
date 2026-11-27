import type { Course, CourseProgressState } from '../types/training';

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

export function computeCourseProgressSummary(
  course: Course,
  progressMap: Record<string, StoredLocalProgressEntry>
): CourseProgressSummary {
  const totalModules = Math.max(0, course.modules.length);
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
