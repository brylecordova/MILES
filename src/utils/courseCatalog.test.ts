import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCourseProgressSummary,
  filterCoursesByQuery,
  parseStoredProgressMap,
} from './courseCatalog';
import type { Course } from '../types/training';

const mockCourses: Course[] = [
  {
    _id: 'course-safety',
    title: 'Workplace Safety & Emergency Response',
    description: 'Master lockout-tagout energy isolation and PPE standards.',
    category: 'Industrial Safety',
    bannerUrl: '',
    certificateTitle: 'Safety Specialist',
    issuerName: 'CertiField',
    published: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    modules: [
      { id: 'm1', kind: 'lesson', title: 'L1', estimatedMinutes: 5, blocks: [] },
      { id: 'm2', kind: 'lesson', title: 'L2', estimatedMinutes: 5, blocks: [] },
      {
        id: 'm3',
        kind: 'quiz',
        title: 'Q1',
        description: '',
        passingScore: 70,
        failureRule: 'retry_quiz',
        passingRule: 'proceed_next',
        questions: [],
      },
      {
        id: 'm4',
        kind: 'quiz',
        title: 'Q2',
        description: '',
        passingScore: 70,
        failureRule: 'retry_quiz',
        passingRule: 'proceed_next',
        questions: [],
      },
    ],
  },
  {
    _id: 'course-security',
    title: 'Data Privacy & Security Foundations',
    description: 'Phishing defense, MFA hygiene, and endpoint encryption.',
    category: 'Information Security',
    bannerUrl: '',
    certificateTitle: 'Privacy Associate',
    issuerName: 'CertiField',
    published: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    modules: [
      { id: 's1', kind: 'lesson', title: 'L1', estimatedMinutes: 5, blocks: [] },
      {
        id: 's2',
        kind: 'quiz',
        title: 'Q1',
        description: '',
        passingScore: 70,
        failureRule: 'retry_quiz',
        passingRule: 'proceed_next',
        questions: [],
      },
    ],
  },
];

test('filterCoursesByQuery filters by title or description case-insensitively', () => {
  assert.equal(filterCoursesByQuery(mockCourses, '').length, 2);
  assert.equal(filterCoursesByQuery(mockCourses, '   ').length, 2);

  const byTitle = filterCoursesByQuery(mockCourses, 'workplace');
  assert.equal(byTitle.length, 1);
  assert.equal(byTitle[0]._id, 'course-safety');

  const byDesc = filterCoursesByQuery(mockCourses, 'PHISHING');
  assert.equal(byDesc.length, 1);
  assert.equal(byDesc[0]._id, 'course-security');

  assert.equal(filterCoursesByQuery(mockCourses, 'quantum').length, 0);
});

test('parseStoredProgressMap handles invalid JSON and returns valid entries', () => {
  assert.deepEqual(parseStoredProgressMap(null), {});
  assert.deepEqual(parseStoredProgressMap('not-json{'), {});
  assert.deepEqual(parseStoredProgressMap('[1,2,3]'), {});

  const parsed = parseStoredProgressMap(
    JSON.stringify({
      'course-safety': { status: 'in_progress', completedModuleIds: ['m1', 'm2'] },
    })
  );
  assert.equal(parsed['course-safety']?.status, 'in_progress');
});

test('computeCourseProgressSummary calculates percent and status accurately', () => {
  const empty = computeCourseProgressSummary(mockCourses[0], {});
  assert.equal(empty.hasSavedProgress, false);
  assert.equal(empty.status, 'not_started');
  assert.equal(empty.percent, 0);

  const inProgress = computeCourseProgressSummary(mockCourses[0], {
    'course-safety': { completedModuleIds: ['m1', 'm2'], status: 'in_progress' },
  });
  assert.equal(inProgress.hasSavedProgress, true);
  assert.equal(inProgress.status, 'in_progress');
  assert.equal(inProgress.completedModules, 2);
  assert.equal(inProgress.totalModules, 4);
  assert.equal(inProgress.percent, 50);

  const completed = computeCourseProgressSummary(mockCourses[1], {
    'course-security': { status: 'completed', completedModuleIds: ['s1'] },
  });
  assert.equal(completed.status, 'completed');
  assert.equal(completed.percent, 100);
  assert.equal(completed.completedModules, 2);

  const explicitPercent = computeCourseProgressSummary(mockCourses[0], {
    'course-safety': { percent: 75 },
  });
  assert.equal(explicitPercent.status, 'in_progress');
  assert.equal(explicitPercent.percent, 75);
});
