import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  CertificateRecord,
  Course,
  CourseDownloadEvent,
  CourseSubmission,
  UserAccount,
} from '../types/training';
import {
  buildAdminAnalyticsReport,
  computeLearnerMedals,
  computeLearningCapacityScore,
  formatDurationSeconds,
} from './analytics';

test('formatDurationSeconds formats seconds, minutes, and hours cleanly', () => {
  assert.equal(formatDurationSeconds(45), '45s');
  assert.equal(formatDurationSeconds(180), '3m');
  assert.equal(formatDurationSeconds(325), '5m 25s');
  assert.equal(formatDurationSeconds(3720), '1h 2m');
});

test('computeLearningCapacityScore rewards high scores, first-try accuracy, and completion', () => {
  const accelerated = computeLearningCapacityScore({
    averageScore: 95,
    averageRetries: 1,
    completedCount: 3,
    downloadsCount: 3,
    firstAttemptAccuracyPct: 92,
  });
  assert.equal(accelerated.tier, 'Accelerated');
  assert.ok(accelerated.score >= 85);

  const needsGuidance = computeLearningCapacityScore({
    averageScore: 54,
    averageRetries: 2.8,
    completedCount: 1,
    downloadsCount: 3,
    firstAttemptAccuracyPct: 40,
  });
  assert.equal(needsGuidance.tier, 'Needs Guidance');
  assert.ok(needsGuidance.score < 62);
});

test('computeLearnerMedals awards gold, silver, and bronze badges based on milestones', () => {
  const medals = computeLearnerMedals({
    downloadsCount: 3,
    coursesCompleted: 2,
    certificatesEarned: 2,
    averageScore: 93,
    averageQuizRetries: 1.1,
    averageReadingSeconds: 420,
  });
  assert.equal(medals.filter((m) => m.earned).length, 6);

  const starter = computeLearnerMedals({
    downloadsCount: 1,
    coursesCompleted: 1,
    certificatesEarned: 0,
    averageScore: 76,
    averageQuizRetries: 1.8,
    averageReadingSeconds: 180,
  });
  assert.deepEqual(
    starter.filter((m) => m.earned).map((m) => m.id),
    ['first-steps']
  );
});

test('buildAdminAnalyticsReport ranks most downloaded/completed courses and calculates learner metrics', () => {
  const courses: Course[] = [
    {
      _id: 'c1',
      title: 'Safety LOTO',
      description: 'Desc',
      category: 'Safety',
      bannerUrl: '',
      certificateTitle: 'Safety Spec',
      issuerName: 'Academy',
      published: true,
      modules: [],
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
    },
    {
      _id: 'c2',
      title: 'Clinical Hygiene',
      description: 'Desc',
      category: 'Health',
      bannerUrl: '',
      certificateTitle: 'Hygiene Spec',
      issuerName: 'Academy',
      published: true,
      modules: [],
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
    },
  ];

  const users: UserAccount[] = [
    {
      _id: 'u1',
      name: 'Elena Rostova',
      email: 'elena@example.com',
      role: 'learner',
      createdAt: '2026-11-20T00:00:00.000Z',
    },
    {
      _id: 'u2',
      name: 'Marcus Vance',
      email: 'marcus@example.com',
      role: 'learner',
      createdAt: '2026-11-21T00:00:00.000Z',
    },
  ];

  const downloads: CourseDownloadEvent[] = [
    { _id: 'd1', courseId: 'c1', userId: 'u1', downloadedAt: '2026-11-24T10:00:00.000Z' },
    { _id: 'd2', courseId: 'c1', userId: 'u2', downloadedAt: '2026-11-25T10:00:00.000Z' },
    { _id: 'd4', courseId: 'c1', userId: 'u3', downloadedAt: '2026-11-25T11:00:00.000Z' },
    { _id: 'd3', courseId: 'c2', userId: 'u1', downloadedAt: '2026-11-25T12:00:00.000Z' },
  ];

  const submissions: CourseSubmission[] = [
    {
      _id: 's1',
      courseId: 'c2',
      courseTitle: 'Clinical Hygiene',
      certificateTitle: 'Hygiene Spec',
      issuerName: 'Academy',
      userId: 'u1',
      userName: 'Elena Rostova',
      userEmail: 'elena@example.com',
      overallScore: 95,
      passed: true,
      status: 'approved',
      submittedAt: '2026-11-25T14:00:00.000Z',
      readingDurationSeconds: 420,
      questionResults: [
        {
          questionId: 'q1',
          quizId: 'qz1',
          quizTitle: 'Quiz 1',
          questionPrompt: 'Prompt',
          questionType: 'multiple_choice',
          topicTag: 'Asepsis',
          tries: 1,
          userAnswer: 0,
          userAnswerLabel: 'A',
          correctAnswerLabel: 'A',
          isCorrect: true,
          explanation: 'Exp',
        },
      ],
      quizResults: [{ quizId: 'qz1', quizTitle: 'Quiz 1', score: 95, passingScore: 70, passed: true, attempts: 1 }],
    },
    {
      _id: 's2',
      courseId: 'c2',
      courseTitle: 'Clinical Hygiene',
      certificateTitle: 'Hygiene Spec',
      issuerName: 'Academy',
      userId: 'u2',
      userName: 'Marcus Vance',
      userEmail: 'marcus@example.com',
      overallScore: 72,
      passed: true,
      status: 'pending_review',
      submittedAt: '2026-11-26T09:00:00.000Z',
      readingDurationSeconds: 180,
      questionResults: [
        {
          questionId: 'q1',
          quizId: 'qz1',
          quizTitle: 'Quiz 1',
          questionPrompt: 'Prompt',
          questionType: 'multiple_choice',
          topicTag: 'Sterile Field',
          tries: 3,
          userAnswer: 0,
          userAnswerLabel: 'A',
          correctAnswerLabel: 'A',
          isCorrect: true,
          explanation: 'Exp',
        },
      ],
      quizResults: [{ quizId: 'qz1', quizTitle: 'Quiz 1', score: 72, passingScore: 70, passed: true, attempts: 3 }],
    },
  ];

  const certificates: CertificateRecord[] = [
    {
      _id: 'cert1',
      certificateCode: 'CF-2026-1234',
      submissionId: 's1',
      courseId: 'c2',
      courseTitle: 'Clinical Hygiene',
      certificateTitle: 'Hygiene Spec',
      issuerName: 'Academy',
      userId: 'u1',
      userName: 'Elena Rostova',
      userEmail: 'elena@example.com',
      score: 95,
      issuedAt: '2026-11-25T15:00:00.000Z',
      emailedCount: 0,
    },
  ];

  const report = buildAdminAnalyticsReport({
    courses,
    users,
    submissions,
    certificates,
    downloads,
    now: new Date('2026-11-26T12:00:00.000Z'),
  });

  assert.equal(report.overview.totalLearners, 2);
  assert.equal(report.overview.pendingReviews, 1);
  assert.equal(report.overview.averageReadingSeconds, 300);
  assert.equal(report.overview.averageQuizRetries, 2);
  assert.equal(report.highlights.mostDownloadedCourse?.courseId, 'c1');
  assert.equal(report.highlights.mostCompletedCourse?.courseId, 'c2');
  assert.equal(report.learners[0].userId, 'u1');
  assert.ok(report.learners[0].learningCapacityScore > report.learners[1].learningCapacityScore);
  assert.ok(report.suggestions.length >= 2);
});
