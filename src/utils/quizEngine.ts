import type {
  Course,
  CourseModule,
  QuestionAttemptRecord,
  QuizAnswerValue,
  QuizFailureRule,
  QuizModule,
  QuizQuestion,
} from '../types/training.ts';

export interface QuestionEvaluation {
  isCorrect: boolean;
  needsManualReview: boolean;
  userAnswerLabel: string;
  correctAnswerLabel: string;
}

export function evaluateQuestion(
  question: QuizQuestion,
  userAnswer: QuizAnswerValue,
  requireManualReviewForEssay = false
): QuestionEvaluation {
  if (question.type === 'multiple_choice' || question.type === 'true_false') {
    const options =
      question.type === 'true_false' ? ['True', 'False'] : (question.options ?? []);
    const selectedIdx = typeof userAnswer === 'number' ? userAnswer : -1;
    const correctIdx = typeof question.correctIndex === 'number' ? question.correctIndex : 0;
    const isCorrect = selectedIdx === correctIdx;
    return {
      isCorrect,
      needsManualReview: false,
      userAnswerLabel: selectedIdx >= 0 && options[selectedIdx] ? options[selectedIdx] : 'No answer selected',
      correctAnswerLabel: options[correctIdx] ?? 'Unconfigured',
    };
  }

  if (question.type === 'select_all') {
    const options = question.options ?? [];
    const selectedSet = Array.from(
      new Set(Array.isArray(userAnswer) ? userAnswer.filter((n) => typeof n === 'number') : [])
    ).sort((a, b) => a - b);
    const expectedSet = Array.from(new Set(question.correctIndices ?? [])).sort((a, b) => a - b);

    const isCorrect =
      expectedSet.length > 0 &&
      selectedSet.length === expectedSet.length &&
      selectedSet.every((val, idx) => val === expectedSet[idx]);

    const userAnswerLabel =
      selectedSet.length > 0
        ? selectedSet.map((i) => options[i] ?? `Option ${i + 1}`).join(', ')
        : 'No options selected';
    const correctAnswerLabel =
      expectedSet.length > 0
        ? expectedSet.map((i) => options[i] ?? `Option ${i + 1}`).join(', ')
        : 'Unconfigured';

    return {
      isCorrect,
      needsManualReview: false,
      userAnswerLabel,
      correctAnswerLabel,
    };
  }

  // Essay evaluation
  const rawText = typeof userAnswer === 'string' ? userAnswer.trim() : '';
  const keywords = (question.essayRubricKeywords ?? [])
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);

  let isCorrect = false;
  if (rawText.length > 0) {
    if (keywords.length > 0) {
      const lower = rawText.toLowerCase();
      const matched = keywords.filter((kw) => lower.includes(kw)).length;
      const requiredCount = Math.max(1, Math.ceil(keywords.length * 0.5));
      isCorrect = matched >= requiredCount;
    } else {
      isCorrect = rawText.length >= 15;
    }
  }

  return {
    isCorrect,
    needsManualReview: requireManualReviewForEssay || keywords.length === 0,
    userAnswerLabel: rawText.length > 0 ? rawText : 'No response submitted',
    correctAnswerLabel:
      question.modelAnswer?.trim() ||
      (keywords.length > 0 ? `Key concepts: ${keywords.join(', ')}` : 'Reviewed by instructor rubric'),
  };
}

export interface QuizEvaluationResult {
  score: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  questionRecords: QuestionAttemptRecord[];
  updatedTries: Record<string, number>;
}

export function evaluateQuiz(
  quiz: QuizModule,
  answers: Record<string, QuizAnswerValue>,
  existingTries: Record<string, number>
): QuizEvaluationResult {
  const updatedTries: Record<string, number> = { ...existingTries };
  const questionRecords: QuestionAttemptRecord[] = [];
  let correctCount = 0;

  for (const question of quiz.questions) {
    const prevTries = updatedTries[question.id] ?? 0;
    const nextTries = prevTries + 1;
    updatedTries[question.id] = nextTries;

    const answer = answers[question.id] ?? null;
    const evaluation = evaluateQuestion(
      question,
      answer,
      quiz.passingRule === 'require_manual_review'
    );

    if (evaluation.isCorrect) {
      correctCount += 1;
    }

    questionRecords.push({
      questionId: question.id,
      quizId: quiz.id,
      quizTitle: quiz.title,
      questionPrompt: question.prompt,
      questionType: question.type,
      topicTag: question.topicTag?.trim() || quiz.title,
      tries: nextTries,
      userAnswer: answer,
      userAnswerLabel: evaluation.userAnswerLabel,
      correctAnswerLabel: evaluation.correctAnswerLabel,
      isCorrect: evaluation.isCorrect,
      needsManualReview: evaluation.needsManualReview,
      explanation: question.explanation,
    });
  }

  const totalQuestions = quiz.questions.length;
  const score = totalQuestions === 0 ? 100 : Math.round((correctCount / totalQuestions) * 100);
  const passed = score >= quiz.passingScore;

  return {
    score,
    passed,
    correctCount,
    totalQuestions,
    questionRecords,
    updatedTries,
  };
}

export function getRestartTargetIndex(
  modules: CourseModule[],
  failedQuizIndex: number,
  failureRule: QuizFailureRule
): number {
  if (modules.length === 0) return 0;
  const safeQuizIdx = Math.max(0, Math.min(failedQuizIndex, modules.length - 1));

  if (failureRule === 'retry_quiz') {
    return safeQuizIdx;
  }

  if (failureRule === 'restart_course') {
    return 0;
  }

  // 'restart_since_last_quiz': jump back to the first lesson after the previous quiz (or 0 if none)
  for (let i = safeQuizIdx - 1; i >= 0; i -= 1) {
    if (modules[i].kind === 'quiz') {
      return Math.min(i + 1, safeQuizIdx);
    }
  }
  return 0;
}

export interface TopicBreakdown {
  topic: string;
  correct: number;
  total: number;
  accuracy: number;
  totalTries: number;
}

export interface CourseSummaryAnalytics {
  overallScore: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  gotRight: QuestionAttemptRecord[];
  needsReview: QuestionAttemptRecord[];
  strengths: TopicBreakdown[];
  weakAreas: TopicBreakdown[];
}

export function buildCourseSummary(
  course: Course,
  questionResults: QuestionAttemptRecord[]
): CourseSummaryAnalytics {
  const orderedIds: string[] = [];
  for (const mod of course.modules) {
    if (mod.kind === 'quiz') {
      for (const q of mod.questions) {
        orderedIds.push(q.id);
      }
    }
  }

  const byId = new Map(questionResults.map((r) => [r.questionId, r]));
  const orderedResults: QuestionAttemptRecord[] = [];
  for (const id of orderedIds) {
    const rec = byId.get(id);
    if (rec) orderedResults.push(rec);
  }
  for (const rec of questionResults) {
    if (!orderedIds.includes(rec.questionId)) {
      orderedResults.push(rec);
    }
  }

  const gotRight = orderedResults.filter((r) => r.isCorrect);
  const needsReview = orderedResults.filter((r) => !r.isCorrect || r.tries > 1);

  const topicMap = new Map<string, { correct: number; total: number; totalTries: number }>();
  for (const rec of orderedResults) {
    const topic = rec.topicTag || rec.quizTitle;
    const entry = topicMap.get(topic) ?? { correct: 0, total: 0, totalTries: 0 };
    entry.total += 1;
    entry.totalTries += rec.tries;
    if (rec.isCorrect) entry.correct += 1;
    topicMap.set(topic, entry);
  }

  const breakdowns: TopicBreakdown[] = Array.from(topicMap.entries()).map(([topic, stat]) => ({
    topic,
    correct: stat.correct,
    total: stat.total,
    accuracy: stat.total === 0 ? 100 : Math.round((stat.correct / stat.total) * 100),
    totalTries: stat.totalTries,
  }));

  const strengths = breakdowns.filter((b) => b.accuracy >= 80 && b.totalTries === b.total);
  const weakAreas = breakdowns.filter((b) => b.accuracy < 80 || b.totalTries > b.total);

  const totalQuestions = orderedResults.length;
  const correctCount = gotRight.length;
  const overallScore =
    totalQuestions === 0 ? 100 : Math.round((correctCount / totalQuestions) * 100);

  return {
    overallScore,
    totalQuestions,
    correctCount,
    wrongCount: totalQuestions - correctCount,
    gotRight,
    needsReview,
    strengths,
    weakAreas,
  };
}
