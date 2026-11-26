import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import type {
  Course,
  CourseProgressState,
  PendingOfflineSubmission,
  QuestionAttemptRecord,
  QuizAnswerValue,
  QuizModule,
  UserAccount,
} from '../types/training';
import { renderFormattedText } from '../utils/formatText';
import { evaluateQuiz, getRestartTargetIndex } from '../utils/quizEngine';
import { CourseSummaryView } from './CourseSummaryView';
import { MediaRenderer } from './MediaRenderer';

interface CoursePlayerProps {
  course: Course;
  offlineBlobs?: Record<string, Blob>;
  initialProgress: CourseProgressState;
  isOffline: boolean;
  user: UserAccount | null;
  onProgressChange: (next: CourseProgressState) => Promise<void>;
  onSubmitOnline: (payload: {
    courseId: string;
    courseTitle: string;
    certificateTitle: string;
    issuerName: string;
    overallScore: number;
    passed: boolean;
    questionResults: QuestionAttemptRecord[];
    quizResults: Array<{
      quizId: string;
      quizTitle: string;
      score: number;
      passingScore: number;
      passed: boolean;
      attempts: number;
    }>;
  }) => Promise<void>;
  onSavePendingOffline: (item: PendingOfflineSubmission) => Promise<void>;
  onRequireAuth: () => void;
  onExit: () => void;
}

export const CoursePlayer: React.FC<CoursePlayerProps> = ({
  course,
  offlineBlobs,
  initialProgress,
  isOffline,
  user,
  onProgressChange,
  onSubmitOnline,
  onSavePendingOffline,
  onRequireAuth,
  onExit,
}) => {
  const [progress, setProgress] = useState<CourseProgressState>(initialProgress);
  const [showSummary, setShowSummary] = useState(
    initialProgress.status === 'completed'
  );
  const [quizAnswers, setQuizAnswers] = useState<Record<string, QuizAnswerValue>>({});
  const [quizFeedback, setQuizFeedback] = useState<{
    quizId: string;
    score: number;
    passed: boolean;
    passingScore: number;
    restartTargetIdx: number;
    restartMessage: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const currentModule = course.modules[progress.currentModuleIndex];

  async function updateProgress(next: CourseProgressState) {
    setProgress(next);
    await onProgressChange(next);
  }

  async function handleCompleteLesson() {
    if (!currentModule) return;
    const completedSet = new Set(progress.completedModuleIds);
    completedSet.add(currentModule.id);

    const isLast = progress.currentModuleIndex >= course.modules.length - 1;
    const nextState: CourseProgressState = {
      ...progress,
      completedModuleIds: Array.from(completedSet),
      currentModuleIndex: isLast
        ? progress.currentModuleIndex
        : progress.currentModuleIndex + 1,
      status: isLast ? 'completed' : 'in_progress',
      startedAt: progress.startedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await updateProgress(nextState);
    if (isLast) {
      setShowSummary(true);
    }
  }

  async function handleSubmitQuiz(quiz: QuizModule) {
    const evalResult = evaluateQuiz(quiz, quizAnswers, progress.questionTries);
    const nextQuizAttempts = {
      ...progress.quizAttempts,
      [quiz.id]: (progress.quizAttempts[quiz.id] ?? 0) + 1,
    };

    const nextQuestionResults = { ...progress.latestQuestionResults };
    for (const rec of evalResult.questionRecords) {
      nextQuestionResults[rec.questionId] = rec;
    }

    const nextQuizResults = {
      ...progress.quizResults,
      [quiz.id]: {
        quizId: quiz.id,
        quizTitle: quiz.title,
        score: evalResult.score,
        passingScore: quiz.passingScore,
        passed: evalResult.passed,
        attempts: nextQuizAttempts[quiz.id],
      },
    };

    const nextAnswers = { ...progress.latestAnswers, ...quizAnswers };
    const completedSet = new Set(progress.completedModuleIds);
    if (evalResult.passed) {
      completedSet.add(quiz.id);
    }

    const restartIdx = getRestartTargetIndex(
      course.modules,
      progress.currentModuleIndex,
      quiz.failureRule
    );

    let restartMessage = '';
    if (!evalResult.passed) {
      if (quiz.failureRule === 'restart_course') {
        restartMessage = `You scored ${evalResult.score}% (${quiz.passingScore}% required). Course policy requires restarting from Lesson 1.`;
      } else if (quiz.failureRule === 'restart_since_last_quiz') {
        const targetMod = course.modules[restartIdx];
        restartMessage = `You scored ${evalResult.score}% (${quiz.passingScore}% required). Course policy requires reviewing from "${targetMod?.title ?? 'the start of this section'}".`;
      } else {
        restartMessage = `You scored ${evalResult.score}% (${quiz.passingScore}% required). Please review and retry this quiz.`;
      }
    }

    const nextState: CourseProgressState = {
      ...progress,
      completedModuleIds: Array.from(completedSet),
      questionTries: evalResult.updatedTries,
      quizAttempts: nextQuizAttempts,
      latestAnswers: nextAnswers,
      latestQuestionResults: nextQuestionResults,
      quizResults: nextQuizResults,
      status: 'in_progress',
      startedAt: progress.startedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await updateProgress(nextState);

    setQuizFeedback({
      quizId: quiz.id,
      score: evalResult.score,
      passed: evalResult.passed,
      passingScore: quiz.passingScore,
      restartTargetIdx: restartIdx,
      restartMessage,
    });
  }

  async function handleAdvanceAfterQuiz() {
    if (!quizFeedback) return;
    if (quizFeedback.passed) {
      const isLast = progress.currentModuleIndex >= course.modules.length - 1;
      const nextState: CourseProgressState = {
        ...progress,
        currentModuleIndex: isLast
          ? progress.currentModuleIndex
          : progress.currentModuleIndex + 1,
        status: isLast ? 'completed' : 'in_progress',
        updatedAt: new Date().toISOString(),
      };
      await updateProgress(nextState);
      setQuizFeedback(null);
      setQuizAnswers({});
      if (isLast) {
        setShowSummary(true);
      }
    } else {
      // Failed -> apply restart target while preserving questionTries
      const targetIdx = quizFeedback.restartTargetIdx;
      const keepIds = new Set(course.modules.slice(0, targetIdx).map((m) => m.id));
      const nextState: CourseProgressState = {
        ...progress,
        currentModuleIndex: targetIdx,
        completedModuleIds: progress.completedModuleIds.filter((id) => keepIds.has(id)),
        status: 'in_progress',
        updatedAt: new Date().toISOString(),
      };
      await updateProgress(nextState);
      setQuizFeedback(null);
      setQuizAnswers({});
    }
  }

  function gatherSubmissionArrays() {
    const orderedQuestions: QuestionAttemptRecord[] = [];
    for (const mod of course.modules) {
      if (mod.kind === 'quiz') {
        for (const q of mod.questions) {
          const rec = progress.latestQuestionResults[q.id];
          if (rec) orderedQuestions.push(rec);
        }
      }
    }
    const quizList = Object.values(progress.quizResults);
    const correctCount = orderedQuestions.filter((q) => q.isCorrect).length;
    const overallScore =
      orderedQuestions.length === 0
        ? 100
        : Math.round((correctCount / orderedQuestions.length) * 100);
    const passed = quizList.every((qr) => qr.passed);
    return { orderedQuestions, quizList, overallScore, passed };
  }

  async function handleOnlineSubmitClick() {
    if (!user) {
      onRequireAuth();
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { orderedQuestions, quizList, overallScore, passed } = gatherSubmissionArrays();
      await onSubmitOnline({
        courseId: course._id,
        courseTitle: course.title,
        certificateTitle: course.certificateTitle,
        issuerName: course.issuerName,
        overallScore,
        passed,
        questionResults: orderedQuestions,
        quizResults: quizList,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOfflineSaveClick() {
    const { orderedQuestions, quizList, overallScore, passed } = gatherSubmissionArrays();
    const pendingItem: PendingOfflineSubmission = {
      id: `pending-${course._id}-${Date.now()}`,
      courseId: course._id,
      courseTitle: course.title,
      certificateTitle: course.certificateTitle,
      issuerName: course.issuerName,
      userId: user?._id ?? 'offline-learner',
      userName: user?.name ?? 'Offline Learner',
      userEmail: user?.email ?? '',
      overallScore,
      passed,
      completedOfflineAt: new Date().toISOString(),
      questionResults: orderedQuestions,
      quizResults: quizList,
    };
    await onSavePendingOffline(pendingItem);
  }

  if (showSummary) {
    const { orderedQuestions, quizList } = gatherSubmissionArrays();
    return (
      <CourseSummaryView
        course={course}
        questionResults={orderedQuestions}
        quizResults={quizList}
        isOffline={isOffline}
        submitting={submitting}
        submitError={submitError}
        onSubmitOnline={handleOnlineSubmitClick}
        onSaveOfflinePending={handleOfflineSaveClick}
        onBack={() => setShowSummary(false)}
      />
    );
  }

  if (!currentModule) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-base font-semibold text-slate-900">This course has no modules yet.</p>
        <button
          type="button"
          onClick={onExit}
          className="mt-4 min-h-[44px] rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white"
        >
          Back to Courses
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl pb-24">
      {/* Top Player Navigation */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onExit}
          className="flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Exit Course</span>
        </button>

        <div className="flex items-center gap-3 text-xs font-medium text-slate-600">
          <span className="font-mono-tabular">
            Module {progress.currentModuleIndex + 1} of {course.modules.length}
          </span>
          {progress.status === 'completed' && (
            <button
              type="button"
              onClick={() => setShowSummary(true)}
              className="min-h-[36px] rounded-lg bg-blue-50 px-3 font-semibold text-blue-700 hover:bg-blue-100"
            >
              View Summary
            </button>
          )}
        </div>
      </div>

      {/* Curriculum Stepper Bar */}
      <div className="mb-6 flex gap-1.5 overflow-x-auto pb-1">
        {course.modules.map((mod, idx) => {
          const isCurrent = idx === progress.currentModuleIndex;
          const isDone = progress.completedModuleIds.includes(mod.id);
          const canJump = isDone || idx <= progress.currentModuleIndex;
          return (
            <button
              key={mod.id}
              type="button"
              disabled={!canJump}
              onClick={() => {
                setQuizFeedback(null);
                setQuizAnswers({});
                updateProgress({
                  ...progress,
                  currentModuleIndex: idx,
                  updatedAt: new Date().toISOString(),
                });
              }}
              className={`flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors ${
                isCurrent
                  ? 'border-blue-700 bg-blue-700 text-white'
                  : isDone
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-400'
              }`}
            >
              <span className="font-mono-tabular">{idx + 1}.</span>
              <span className="max-w-[140px] truncate">{mod.title}</span>
            </button>
          );
        })}
      </div>

      {/* Active Module Viewport */}
      {currentModule.kind === 'lesson' ? (
        <article className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <div className="border-b border-slate-200 pb-4">
            <p className="text-xs font-medium text-slate-500">
              Lesson · {currentModule.estimatedMinutes} min read
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl text-balance">
              {currentModule.title}
            </h1>
          </div>

          <div className="mt-6 space-y-6">
            {currentModule.blocks.map((block) => {
              if (block.type === 'header') {
                if (block.level === 1) {
                  return (
                    <h2 key={block.id} className="text-xl font-bold text-slate-900 sm:text-2xl">
                      {block.text}
                    </h2>
                  );
                }
                if (block.level === 2) {
                  return (
                    <h3 key={block.id} className="text-lg font-bold text-slate-900">
                      {block.text}
                    </h3>
                  );
                }
                return (
                  <h4 key={block.id} className="text-base font-semibold text-slate-900">
                    {block.text}
                  </h4>
                );
              }

              if (block.type === 'body') {
                return (
                  <p
                    key={block.id}
                    className={`max-w-[70ch] text-[15px] leading-relaxed text-slate-700 ${
                      block.align === 'center' ? 'mx-auto text-center' : ''
                    }`}
                  >
                    {renderFormattedText(block.text)}
                  </p>
                );
              }

              if (block.type === 'bullets') {
                return (
                  <ul key={block.id} className="max-w-[70ch] list-disc space-y-2 pl-5 text-[15px] text-slate-700">
                    {block.items.map((item, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {renderFormattedText(item)}
                      </li>
                    ))}
                  </ul>
                );
              }

              if (block.type === 'image' || block.type === 'video') {
                return (
                  <MediaRenderer
                    key={block.id}
                    type={block.type}
                    url={block.url}
                    caption={block.caption}
                    offlineBlobs={offlineBlobs}
                  />
                );
              }

              return null;
            })}
          </div>

          <div className="mt-8 flex justify-end border-t border-slate-200 pt-6">
            <button
              type="button"
              onClick={handleCompleteLesson}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 text-sm font-semibold text-white hover:bg-blue-800 sm:w-auto"
            >
              <span>
                {progress.currentModuleIndex >= course.modules.length - 1
                  ? 'Finish Course & View Summary'
                  : 'Complete Lesson & Continue'}
              </span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </article>
      ) : (
        /* Quiz View */
        <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <div className="border-b border-slate-200 pb-4">
            <p className="font-mono-tabular text-xs font-medium text-blue-700">
              Assessment · Passing Score {currentModule.passingScore}%
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{currentModule.title}</h1>
            {currentModule.description && (
              <p className="mt-1.5 text-sm text-slate-600">{currentModule.description}</p>
            )}
          </div>

          {/* Quiz Result Feedback Banner */}
          {quizFeedback && quizFeedback.quizId === currentModule.id ? (
            <div className="mt-6 space-y-5">
              <div
                className={`rounded-2xl border p-6 ${
                  quizFeedback.passed
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  {quizFeedback.passed ? (
                    <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-red-700" />
                  )}
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {quizFeedback.passed
                        ? `Quiz Passed (${quizFeedback.score}%)`
                        : `Score ${quizFeedback.score}% — Below ${quizFeedback.passingScore}% Threshold`}
                    </h2>
                    <p className="mt-1 text-sm text-slate-700">
                      {quizFeedback.passed
                        ? 'You met the passing threshold. Advance to the next step.'
                        : quizFeedback.restartMessage}
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAdvanceAfterQuiz}
                className={`flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold text-white sm:w-auto ${
                  quizFeedback.passed
                    ? 'bg-emerald-700 hover:bg-emerald-800'
                    : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                {quizFeedback.passed ? (
                  <>
                    <span>
                      {progress.currentModuleIndex >= course.modules.length - 1
                        ? 'View Course Summary'
                        : 'Proceed to Next Module'}
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    <span>
                      {currentModule.failureRule === 'retry_quiz'
                        ? 'Retry Quiz Now'
                        : currentModule.failureRule === 'restart_course'
                        ? 'Restart Course from Lesson 1'
                        : 'Return to Section Start'}
                    </span>
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Quiz Questions Form */
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmitQuiz(currentModule);
              }}
              className="mt-6 space-y-6"
            >
              {currentModule.questions.map((q, qIdx) => {
                const currentAnswer = quizAnswers[q.id];
                const options =
                  q.type === 'true_false' ? ['True', 'False'] : (q.options ?? []);

                return (
                  <div
                    key={q.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/60 p-5"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-500">
                        Question {qIdx + 1} ·{' '}
                        {q.type === 'select_all'
                          ? 'Select all that apply'
                          : q.type === 'true_false'
                          ? 'True or False'
                          : q.type === 'essay'
                          ? 'Written Response'
                          : 'Multiple Choice'}
                      </span>
                      {progress.questionTries[q.id] ? (
                        <span className="font-mono-tabular text-xs text-slate-500">
                          Previous tries: {progress.questionTries[q.id]}
                        </span>
                      ) : null}
                    </div>

                    <p className="text-base font-semibold text-slate-900">{q.prompt}</p>

                    {(q.type === 'multiple_choice' || q.type === 'true_false') && (
                      <div className="mt-3 space-y-2">
                        {options.map((opt, optIdx) => {
                          const selected = currentAnswer === optIdx;
                          return (
                            <label
                              key={optIdx}
                              className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition-colors ${
                                selected
                                  ? 'border-blue-700 bg-blue-50 font-medium text-slate-900'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`q-${q.id}`}
                                checked={selected}
                                onChange={() =>
                                  setQuizAnswers((prev) => ({ ...prev, [q.id]: optIdx }))
                                }
                                className="h-4 w-4 accent-blue-700"
                              />
                              <span>{opt}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {q.type === 'select_all' && (
                      <div className="mt-3 space-y-2">
                        {options.map((opt, optIdx) => {
                          const selectedArr = Array.isArray(currentAnswer) ? currentAnswer : [];
                          const checked = selectedArr.includes(optIdx);
                          return (
                            <label
                              key={optIdx}
                              className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition-colors ${
                                checked
                                  ? 'border-blue-700 bg-blue-50 font-medium text-slate-900'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const nextArr = checked
                                    ? selectedArr.filter((v) => v !== optIdx)
                                    : [...selectedArr, optIdx];
                                  setQuizAnswers((prev) => ({ ...prev, [q.id]: nextArr }));
                                }}
                                className="h-4 w-4 rounded accent-blue-700"
                              />
                              <span>{opt}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {q.type === 'essay' && (
                      <div className="mt-3">
                        <textarea
                          rows={4}
                          value={typeof currentAnswer === 'string' ? currentAnswer : ''}
                          onChange={(e) =>
                            setQuizAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                          }
                          placeholder="Write your clear, step-by-step response..."
                          className="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="flex justify-end border-t border-slate-200 pt-5">
                <button
                  type="submit"
                  className="min-h-[48px] w-full rounded-xl bg-blue-700 px-6 text-sm font-semibold text-white hover:bg-blue-800 sm:w-auto"
                >
                  Submit Quiz Answers
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </div>
  );
};
