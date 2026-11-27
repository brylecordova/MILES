import assert from 'node:assert/strict';
import test from 'node:test';
import type { Course } from '../types/training';
import {
  applyCourseRating,
  computeCatalogBaselineRating,
  computeCoursePopularityPercent,
  computeCoursePopularityScore,
  computeCourseRatingStats,
  filterAndSortCoursesByRating,
  getLandingDisplayedCourses,
  toPublicCourseWithRatings,
  validateRatingValue,
} from './courseRating';

function makeCourse(overrides: Partial<Course> = {}): Course {
  return {
    _id: 'course-1',
    title: 'Safety Foundations',
    description: 'Industrial LOTO and PPE protocol',
    category: 'Industrial Safety',
    bannerUrl: '/banner.jpg',
    certificateTitle: 'Safety Specialist',
    issuerName: 'CertiField',
    published: true,
    modules: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('validateRatingValue accepts integers 1..5 and rejects invalid values', () => {
  assert.equal(validateRatingValue(1), 1);
  assert.equal(validateRatingValue(5), 5);
  assert.equal(validateRatingValue(0), null);
  assert.equal(validateRatingValue(6), null);
  assert.equal(validateRatingValue(4.5), null);
  assert.equal(validateRatingValue('5'), null);
  assert.equal(validateRatingValue(NaN), null);
});

test('applyCourseRating computes average and updates existing user rating idempotently', () => {
  let course = makeCourse();
  course = applyCourseRating(course, 'u1', 5, '2026-01-01T10:00:00.000Z');
  course = applyCourseRating(course, 'u2', 4, '2026-01-01T11:00:00.000Z');
  assert.equal(course.ratingCount, 2);
  assert.equal(course.averageRating, 4.5);

  // User u2 updates their rating from 4 to 2
  course = applyCourseRating(course, 'u2', 2, '2026-01-01T12:00:00.000Z');
  assert.equal(course.ratingCount, 2);
  assert.equal(course.averageRating, 3.5);
});

test('toPublicCourseWithRatings strips raw ratings list and surfaces viewer userRating', () => {
  let course = makeCourse();
  course = applyCourseRating(course, 'u1', 5);
  course = applyCourseRating(course, 'u2', 4);

  const forU1 = toPublicCourseWithRatings(course, 'u1');
  assert.equal(forU1.ratings, undefined);
  assert.equal(forU1.averageRating, 4.5);
  assert.equal(forU1.ratingCount, 2);
  assert.equal(forU1.userRating, 5);

  const anon = toPublicCourseWithRatings(course);
  assert.equal(anon.ratings, undefined);
  assert.equal(anon.userRating, undefined);
});

test('computeCourseRatingStats handles empty and malformed arrays cleanly', () => {
  assert.deepEqual(computeCourseRatingStats(undefined), { averageRating: 0, ratingCount: 0 });
  assert.deepEqual(computeCourseRatingStats([]), { averageRating: 0, ratingCount: 0 });
});

test('filterAndSortCoursesByRating filters by query/category and sorts by highly_rated or most_rated', () => {
  const c1 = makeCourse({
    _id: 'c1',
    title: 'Safety Protocol',
    category: 'Safety',
    averageRating: 4.3,
    ratingCount: 12,
  });
  const c2 = makeCourse({
    _id: 'c2',
    title: 'Data Privacy',
    category: 'Security',
    averageRating: 5.0,
    ratingCount: 3,
  });
  const c3 = makeCourse({
    _id: 'c3',
    title: 'Basic Intro',
    category: 'General',
    averageRating: 3.2,
    ratingCount: 6,
  });

  assert.deepEqual(
    filterAndSortCoursesByRating([c1, c2, c3], { ratingMode: 'highly_rated' }).map((c) => c._id),
    ['c2', 'c1', 'c3']
  );
  assert.deepEqual(
    filterAndSortCoursesByRating([c1, c2, c3], { ratingMode: 'most_rated' }).map((c) => c._id),
    ['c1', 'c3', 'c2']
  );
  assert.deepEqual(
    filterAndSortCoursesByRating([c1, c2, c3], { ratingMode: 'four_plus' }).map((c) => c._id),
    ['c1', 'c2']
  );
  assert.deepEqual(
    filterAndSortCoursesByRating([c1, c2, c3], { query: 'privacy' }).map((c) => c._id),
    ['c2']
  );
});

test('computeCoursePopularityScore and percent rank high-rated popular courses fairly', () => {
  const provenTop = makeCourse({ _id: 'proven', averageRating: 4.8, ratingCount: 25 });
  const singleFive = makeCourse({ _id: 'single', averageRating: 5.0, ratingCount: 1 });
  const noisyLow = makeCourse({ _id: 'low', averageRating: 2.2, ratingCount: 40 });
  const unrated = makeCourse({ _id: 'unrated', averageRating: 0, ratingCount: 0 });

  const baseline = computeCatalogBaselineRating([provenTop, singleFive, noisyLow, unrated]);
  assert.ok(baseline > 3 && baseline < 3.5);

  const provenScore = computeCoursePopularityScore(provenTop, baseline);
  const singleScore = computeCoursePopularityScore(singleFive, baseline);
  const lowScore = computeCoursePopularityScore(noisyLow, baseline);
  const unratedScore = computeCoursePopularityScore(unrated, baseline);

  assert.ok(provenScore > singleScore);
  assert.ok(singleScore > lowScore);
  assert.equal(unratedScore, 0);
  assert.equal(computeCoursePopularityPercent(unrated, baseline), 0);
  assert.ok(computeCoursePopularityPercent(provenTop, baseline) >= 85);
});

test('getLandingDisplayedCourses caps initial view to top 3 most popular and expands on search or showAll', () => {
  const c1 = makeCourse({ _id: 'c1', title: 'Alpha', averageRating: 5.0, ratingCount: 1 });
  const c2 = makeCourse({ _id: 'c2', title: 'Beta', averageRating: 4.9, ratingCount: 20 });
  const c3 = makeCourse({ _id: 'c3', title: 'Gamma', averageRating: 4.7, ratingCount: 10 });
  const c4 = makeCourse({ _id: 'c4', title: 'Delta', averageRating: 4.8, ratingCount: 12 });
  const c5 = makeCourse({ _id: 'c5', title: 'Epsilon Searchable', averageRating: 2.1, ratingCount: 30 });

  // Proven high-rated + high-volume courses outrank a single 5.0 review and a low-rated high-volume course
  assert.deepEqual(
    getLandingDisplayedCourses([c1, c2, c3, c4, c5], '').map((c) => c._id),
    ['c2', 'c4', 'c3']
  );

  // Search finds lower-ranked courses beyond the top 3
  assert.deepEqual(
    getLandingDisplayedCourses([c1, c2, c3, c4, c5], 'searchable').map((c) => c._id),
    ['c5']
  );

  // showAll returns all courses ordered by popularity score
  assert.deepEqual(
    getLandingDisplayedCourses([c1, c2, c3, c4, c5], '', true).map((c) => c._id),
    ['c2', 'c4', 'c3', 'c1', 'c5']
  );
});

