import type { Course, CourseRatingEntry } from '../types/training';

export type CourseRatingFilterMode =
  | 'all'
  | 'popular'
  | 'highly_rated'
  | 'most_rated'
  | 'four_plus';

export const POPULARITY_CONFIDENCE_THRESHOLD = 5;

export function validateRatingValue(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (!Number.isInteger(value)) return null;
  if (value < 1 || value > 5) return null;
  return value;
}

export function computeCourseRatingStats(entries: CourseRatingEntry[] | undefined): {
  averageRating: number;
  ratingCount: number;
} {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { averageRating: 0, ratingCount: 0 };
  }
  const valid = entries.filter(
    (e) =>
      e &&
      typeof e.userId === 'string' &&
      typeof e.rating === 'number' &&
      e.rating >= 1 &&
      e.rating <= 5
  );
  if (valid.length === 0) {
    return { averageRating: 0, ratingCount: 0 };
  }
  const sum = valid.reduce((acc, item) => acc + item.rating, 0);
  const averageRating = Math.round((sum / valid.length) * 10) / 10;
  return { averageRating, ratingCount: valid.length };
}

export function applyCourseRating(
  course: Course,
  userId: string,
  rating: number,
  now = new Date().toISOString()
): Course {
  const valid = validateRatingValue(rating);
  if (valid === null) {
    throw new Error('Rating must be a whole number from 1 to 5.');
  }

  const existingEntries = Array.isArray(course.ratings) ? [...course.ratings] : [];
  const idx = existingEntries.findIndex((entry) => entry.userId === userId);
  if (idx >= 0) {
    existingEntries[idx] = { userId, rating: valid, updatedAt: now };
  } else {
    existingEntries.push({ userId, rating: valid, updatedAt: now });
  }

  const stats = computeCourseRatingStats(existingEntries);
  return {
    ...course,
    ratings: existingEntries,
    averageRating: stats.averageRating,
    ratingCount: stats.ratingCount,
  };
}

export function toPublicCourseWithRatings(course: Course, viewerUserId?: string): Course {
  const hasEntries = Array.isArray(course.ratings) && course.ratings.length > 0;
  const stats = hasEntries
    ? computeCourseRatingStats(course.ratings)
    : {
        averageRating:
          typeof course.averageRating === 'number' && Number.isFinite(course.averageRating)
            ? Math.round(course.averageRating * 10) / 10
            : 0,
        ratingCount:
          typeof course.ratingCount === 'number' && Number.isFinite(course.ratingCount)
            ? Math.max(0, Math.round(course.ratingCount))
            : 0,
      };

  const viewerEntry =
    viewerUserId && Array.isArray(course.ratings)
      ? course.ratings.find((entry) => entry.userId === viewerUserId)
      : undefined;

  const { ratings: _omitted, ...publicFields } = course;
  return {
    ...publicFields,
    averageRating: stats.averageRating,
    ratingCount: stats.ratingCount,
    userRating: viewerEntry?.rating ?? course.userRating,
  };
}

export function computeCatalogBaselineRating(courses: Course[]): number {
  let weightedSum = 0;
  let totalCount = 0;
  for (const course of courses) {
    const count = Math.max(0, course.ratingCount ?? 0);
    const avg = Math.max(0, Math.min(5, course.averageRating ?? 0));
    if (count > 0 && avg > 0) {
      weightedSum += avg * count;
      totalCount += count;
    }
  }
  if (totalCount === 0) return 4.0;
  return Math.round((weightedSum / totalCount) * 100) / 100;
}

export function computeCoursePopularityScore(
  course: Course,
  catalogBaselineRating = 4.0,
  confidenceThreshold = POPULARITY_CONFIDENCE_THRESHOLD
): number {
  const v = Math.max(0, course.ratingCount ?? 0);
  const R = Math.max(0, Math.min(5, course.averageRating ?? 0));
  if (v === 0) return 0;
  const m = Math.max(1, confidenceThreshold);
  const score = (v / (v + m)) * R + (m / (v + m)) * catalogBaselineRating;
  return Math.round(score * 100) / 100;
}

export function computeCoursePopularityPercent(
  course: Course,
  catalogBaselineRating = 4.0,
  confidenceThreshold = POPULARITY_CONFIDENCE_THRESHOLD
): number {
  const score = computeCoursePopularityScore(course, catalogBaselineRating, confidenceThreshold);
  return Math.max(0, Math.min(100, Math.round((score / 5) * 100)));
}

export function filterAndSortCoursesByRating(
  courses: Course[],
  options: {
    query?: string;
    category?: string;
    ratingMode?: CourseRatingFilterMode;
    catalogBaselineRating?: number;
  }
): Course[] {
  const query = (options.query ?? '').trim().toLowerCase();
  const category = (options.category ?? 'All').trim();
  const ratingMode = options.ratingMode ?? 'all';
  const baseline = options.catalogBaselineRating ?? computeCatalogBaselineRating(courses);

  const filtered = courses.filter((course) => {
    if (category && category !== 'All' && course.category !== category) {
      return false;
    }
    if (query) {
      const matchesQuery =
        course.title.toLowerCase().includes(query) ||
        course.description.toLowerCase().includes(query) ||
        course.category.toLowerCase().includes(query);
      if (!matchesQuery) return false;
    }
    if (ratingMode === 'four_plus') {
      return (course.averageRating ?? 0) >= 4.0 && (course.ratingCount ?? 0) > 0;
    }
    return true;
  });

  if (ratingMode === 'popular') {
    return [...filtered].sort((a, b) => {
      const scoreDiff =
        computeCoursePopularityScore(b, baseline) - computeCoursePopularityScore(a, baseline);
      if (scoreDiff !== 0) return scoreDiff;
      const countDiff = (b.ratingCount ?? 0) - (a.ratingCount ?? 0);
      if (countDiff !== 0) return countDiff;
      return (b.averageRating ?? 0) - (a.averageRating ?? 0);
    });
  }

  if (ratingMode === 'highly_rated') {
    return [...filtered].sort((a, b) => {
      const avgDiff = (b.averageRating ?? 0) - (a.averageRating ?? 0);
      if (avgDiff !== 0) return avgDiff;
      return (b.ratingCount ?? 0) - (a.ratingCount ?? 0);
    });
  }

  if (ratingMode === 'most_rated') {
    return [...filtered].sort((a, b) => {
      const countDiff = (b.ratingCount ?? 0) - (a.ratingCount ?? 0);
      if (countDiff !== 0) return countDiff;
      return (b.averageRating ?? 0) - (a.averageRating ?? 0);
    });
  }

  return filtered;
}

export function getLandingDisplayedCourses(
  courses: Course[],
  query: string,
  showAll = false
): Course[] {
  const baseline = computeCatalogBaselineRating(courses);
  const ranked = filterAndSortCoursesByRating(courses, {
    query,
    ratingMode: 'popular',
    catalogBaselineRating: baseline,
  });
  if (query.trim().length > 0 || showAll) {
    return ranked;
  }
  return ranked.slice(0, 3);
}

