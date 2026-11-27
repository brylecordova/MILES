import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCompletedProgressFromSubmission,
  computeCourseProgressSummary,
  filterCoursesByQuery,
  getCompletedCourseIdsFromSubmissions,
  parseStoredProgressMap,
  reconcileProgressMapWithSubmissions,
} from './courseCatalog';
import type { Course, CourseSubmission } from '../types/training';

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

test('getCompletedCourseIdsFromSubmissions marks submitted courses complete regardless of admin review status', () => {
  const submissions: CourseSubmission[] = [
    {
      _id: 'sub-pending',
      courseId: 'course-safety',
      courseTitle: 'Workplace Safety',
      certificateTitle: 'Safety Specialist',
      issuerName: 'CertiField',
      userId: 'u1',
      userName: 'Alex',
      userEmail: 'alex@example.com',
      overallScore: 90,
      passed: true,
      completed: true,
      status: 'pending_review',
      submittedAt: '2026-05-01T00:00:00.000Z',
      questionResults: [],
      quizResults: [],
    },
    {
      _id: 'sub-rejected',
      courseId: 'course-security',
      courseTitle: 'Data Privacy',
      certificateTitle: 'Privacy Associate',
      issuerName: 'CertiField',
      userId: 'u1',
      userName: 'Alex',
      userEmail: 'alex@example.com',
      overallScore: 60,
      passed: false,
      status: 'rejected',
      submittedAt: '2026-05-02T00:00:00.000Z',
      questionResults: [],
      quizResults: [],
    },
  ];

  const completedIds = getCompletedCourseIdsFromSubmissions(submissions);
  assert.equal(completedIds.has('course-safety'), true);
  assert.equal(completedIds.has('course-security'), true);

  const summaryAfterWipe = computeCourseProgressSummary(mockCourses[0], {}, completedIds);
  assert.equal(summaryAfterWipe.hasSavedProgress, true);
  assert.equal(summaryAfterWipe.status, 'completed');
  assert.equal(summaryAfterWipe.completedModules, 4);
  assert.equal(summaryAfterWipe.percent, 100);
});

test('reconcileProgressMapWithSubmissions restores full completed progress after reinstall and redownload', () => {
  const pendingSubmission: CourseSubmission = {
    _id: 'sub-1',
    courseId: 'course-safety',
    courseTitle: 'Workplace Safety & Emergency Response',
    certificateTitle: 'Safety Specialist',
    issuerName: 'CertiField',
    userId: 'u1',
    userName: 'Alex',
    userEmail: 'alex@example.com',
    overallScore: 88,
    passed: true,
    completed: true,
    status: 'pending_review',
    submittedAt: '2026-05-03T10:00:00.000Z',
    readingDurationSeconds: 185,
    questionResults: [
      {
        questionId: 'q1',
        quizId: 'm3',
        quizTitle: 'Q1',
        questionPrompt: 'Prompt',
        questionType: 'multiple_choice',
        topicTag: 'PPE',
        tries: 1,
        userAnswer: 0,
        userAnswerLabel: 'A',
        correctAnswerLabel: 'A',
        isCorrect: true,
        explanation: 'Correct',
      },
    ],
    quizResults: [
      {
        quizId: 'm3',
        quizTitle: 'Q1',
        score: 100,
        passingScore: 70,
        passed: true,
        attempts: 1,
      },
    ],
  };

  // Simulate fresh install + redownload where local progressMap starts empty or not_started
  const reconciled = reconcileProgressMapWithSubmissions(
    mockCourses,
    {
      'course-safety': {
        courseId: 'course-safety',
        currentModuleIndex: 0,
        completedModuleIds: [],
        questionTries: {},
        quizAttempts: {},
        latestAnswers: {},
        latestQuestionResults: {},
        quizResults: {},
        status: 'not_started',
        updatedAt: '2026-05-04T00:00:00.000Z',
      },
    },
    [pendingSubmission]
  );

  const restored = reconciled['course-safety'];
  assert.equal(restored.status, 'completed');
  assert.deepEqual(restored.completedModuleIds, ['m1', 'm2', 'm3', 'm4']);
  assert.equal(restored.currentModuleIndex, 3);
  assert.equal(restored.readingDurationSeconds, 185);
  assert.equal(restored.latestQuestionResults['q1']?.isCorrect, true);
  assert.equal(restored.quizResults['m3']?.passed, true);

  const direct = buildCompletedProgressFromSubmission(mockCourses[1], {
    ...pendingSubmission,
    courseId: 'course-security',
  });
  assert.equal(direct.status, 'completed');
  assert.deepEqual(direct.completedModuleIds, ['s1', 's2']);
});

test('reconcileProgressMapWithSubmissions preserves active in-progress retry for retryable rejected submissions', () => {
  const rejectedRetryable: CourseSubmission = {
    _id: 'sub-rej-1',
    courseId: 'course-safety',
    courseTitle: 'Workplace Safety & Emergency Response',
    certificateTitle: 'Safety Specialist',
    issuerName: 'CertiField',
    userId: 'u1',
    userName: 'Alex',
    userEmail: 'alex@example.com',
    overallScore: 55,
    passed: false,
    completed: true,
    status: 'rejected',
    allowRetry: true,
    submittedAt: '2026-05-03T10:00:00.000Z',
    questionResults: [],
    quizResults: [],
  };

  const activeRetryProgress = {
    'course-safety': {
      courseId: 'course-safety',
      currentModuleIndex: 1,
      completedModuleIds: ['m1'],
      questionTries: {},
      quizAttempts: {},
      latestAnswers: {},
      latestQuestionResults: {},
      quizResults: {},
      status: 'in_progress' as const,
      updatedAt: '2026-05-04T00:00:00.000Z',
    },
  };

  const reconciled = reconcileProgressMapWithSubmissions(
    mockCourses,
    activeRetryProgress,
    [rejectedRetryable]
  );
  assert.equal(reconciled['course-safety'].status, 'in_progress');
  assert.deepEqual(reconciled['course-safety'].completedModuleIds, ['m1']);
});
