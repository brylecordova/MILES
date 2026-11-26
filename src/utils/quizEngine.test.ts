import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCourseSummary,
  evaluateQuestion,
  evaluateQuiz,
  getRestartTargetIndex,
} from './quizEngine.ts';
import type { Course, CourseModule, QuizModule, QuizQuestion } from '../types/training.ts';

test('evaluateQuestion handles multiple_choice and true_false', () => {
  const mc: QuizQuestion = {
    id: 'q1',
    type: 'multiple_choice',
    prompt: 'Which PPE is mandatory?',
    options: ['Sandals', 'Hard Hat', 'Baseball Cap'],
    correctIndex: 1,
    explanation: 'Hard hats protect against overhead impact.',
  };

  assert.equal(evaluateQuestion(mc, 1).isCorrect, true);
  assert.equal(evaluateQuestion(mc, 0).isCorrect, false);
  assert.equal(evaluateQuestion(mc, 0).correctAnswerLabel, 'Hard Hat');

  const tf: QuizQuestion = {
    id: 'q2',
    type: 'true_false',
    prompt: 'You may remove another worker’s padlock.',
    correctIndex: 1,
    explanation: 'Only the person who applied a LOTO lock may remove it.',
  };
  assert.equal(evaluateQuestion(tf, 1).isCorrect, true);
  assert.equal(evaluateQuestion(tf, 0).isCorrect, false);
});

test('evaluateQuestion handles select_all with exact multi-answer matching', () => {
  const sa: QuizQuestion = {
    id: 'q3',
    type: 'select_all',
    prompt: 'Select all required energy isolation steps.',
    options: ['Notify affected staff', 'Shut down equipment', 'Skip voltage test', 'Apply personal lock'],
    correctIndices: [0, 1, 3],
    explanation: 'You must notify, shut down, apply personal lock, and verify zero energy.',
  };

  assert.equal(evaluateQuestion(sa, [3, 0, 1]).isCorrect, true);
  assert.equal(evaluateQuestion(sa, [0, 1]).isCorrect, false);
  assert.equal(evaluateQuestion(sa, [0, 1, 2, 3]).isCorrect, false);
});

test('evaluateQuestion handles essay rubric keywords', () => {
  const essay: QuizQuestion = {
    id: 'q4',
    type: 'essay',
    prompt: 'Explain zero-energy verification.',
    essayRubricKeywords: ['voltage', 'test', 'lock'],
    modelAnswer: 'Apply a personal lock and test with a calibrated meter to verify zero voltage.',
    explanation: 'Verification confirms energy is fully isolated before servicing.',
  };

  assert.equal(
    evaluateQuestion(essay, 'Always apply your lock and test for zero voltage before touching circuits.').isCorrect,
    true
  );
  assert.equal(evaluateQuestion(essay, 'Just turn it off.').isCorrect, false);
});

test('evaluateQuiz increments question tries across attempts and checks passing score', () => {
  const quiz: QuizModule = {
    id: 'quiz-1',
    kind: 'quiz',
    title: 'Module 1 Check',
    description: 'Verify safety basics',
    passingScore: 100,
    failureRule: 'retry_quiz',
    passingRule: 'proceed_next',
    questions: [
      {
        id: 'q1',
        type: 'true_false',
        prompt: 'Safety first?',
        correctIndex: 0,
        explanation: 'Yes.',
      },
      {
        id: 'q2',
        type: 'multiple_choice',
        prompt: 'Pick A',
        options: ['A', 'B'],
        correctIndex: 0,
        explanation: 'A is right.',
      },
    ],
  };

  const firstAttempt = evaluateQuiz(quiz, { q1: 0, q2: 1 }, {});
  assert.equal(firstAttempt.score, 50);
  assert.equal(firstAttempt.passed, false);
  assert.equal(firstAttempt.updatedTries.q1, 1);
  assert.equal(firstAttempt.updatedTries.q2, 1);

  const secondAttempt = evaluateQuiz(quiz, { q1: 0, q2: 0 }, firstAttempt.updatedTries);
  assert.equal(secondAttempt.score, 100);
  assert.equal(secondAttempt.passed, true);
  assert.equal(secondAttempt.updatedTries.q1, 2);
  assert.equal(secondAttempt.updatedTries.q2, 2);
});

test('getRestartTargetIndex enforces retry_quiz, restart_since_last_quiz, and restart_course', () => {
  const modules: CourseModule[] = [
    { id: 'l1', kind: 'lesson', title: 'L1', estimatedMinutes: 5, blocks: [] },
    { id: 'l2', kind: 'lesson', title: 'L2', estimatedMinutes: 5, blocks: [] },
    {
      id: 'q1',
      kind: 'quiz',
      title: 'Q1',
      description: '',
      passingScore: 70,
      failureRule: 'retry_quiz',
      passingRule: 'proceed_next',
      questions: [],
    },
    { id: 'l3', kind: 'lesson', title: 'L3', estimatedMinutes: 5, blocks: [] },
    { id: 'l4', kind: 'lesson', title: 'L4', estimatedMinutes: 5, blocks: [] },
    {
      id: 'q2',
      kind: 'quiz',
      title: 'Q2',
      description: '',
      passingScore: 80,
      failureRule: 'restart_since_last_quiz',
      passingRule: 'proceed_next',
      questions: [],
    },
  ];

  assert.equal(getRestartTargetIndex(modules, 2, 'retry_quiz'), 2);
  assert.equal(getRestartTargetIndex(modules, 2, 'restart_since_last_quiz'), 0);
  assert.equal(getRestartTargetIndex(modules, 5, 'restart_since_last_quiz'), 3);
  assert.equal(getRestartTargetIndex(modules, 5, 'restart_course'), 0);
});

test('buildCourseSummary separates strengths from areas needing review', () => {
  const course: Course = {
    _id: 'c1',
    title: 'Test Course',
    description: 'Desc',
    category: 'Safety',
    bannerUrl: '',
    certificateTitle: 'Cert',
    issuerName: 'CertiField',
    published: true,
    createdAt: '',
    updatedAt: '',
    modules: [
      {
        id: 'quiz-1',
        kind: 'quiz',
        title: 'Quiz 1',
        description: '',
        passingScore: 50,
        failureRule: 'retry_quiz',
        passingRule: 'proceed_next',
        questions: [
          {
            id: 'q1',
            type: 'true_false',
            prompt: 'Q1',
            topicTag: 'PPE',
            correctIndex: 0,
            explanation: 'Exp 1',
          },
          {
            id: 'q2',
            type: 'true_false',
            prompt: 'Q2',
            topicTag: 'Lockout',
            correctIndex: 0,
            explanation: 'Exp 2',
          },
        ],
      },
    ],
  };

  const summary = buildCourseSummary(course, [
    {
      questionId: 'q1',
      quizId: 'quiz-1',
      quizTitle: 'Quiz 1',
      questionPrompt: 'Q1',
      questionType: 'true_false',
      topicTag: 'PPE',
      tries: 1,
      userAnswer: 0,
      userAnswerLabel: 'True',
      correctAnswerLabel: 'True',
      isCorrect: true,
      explanation: 'Exp 1',
    },
    {
      questionId: 'q2',
      quizId: 'quiz-1',
      quizTitle: 'Quiz 1',
      questionPrompt: 'Q2',
      questionType: 'true_false',
      topicTag: 'Lockout',
      tries: 2,
      userAnswer: 1,
      userAnswerLabel: 'False',
      correctAnswerLabel: 'True',
      isCorrect: false,
      explanation: 'Exp 2',
    },
  ]);

  assert.equal(summary.overallScore, 50);
  assert.equal(summary.gotRight.length, 1);
  assert.equal(summary.needsReview.length, 1);
  assert.equal(summary.strengths[0].topic, 'PPE');
  assert.equal(summary.weakAreas[0].topic, 'Lockout');
});
