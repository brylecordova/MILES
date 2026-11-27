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
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white/85 p-8 text-center backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/75">
        <p className="text-base font-semibold text-slate-900 dark:text-white">
          This course has no modules yet.
        </p>
        <button
          type="button"
          onClick={onExit}
          className="mt-4 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white dark:bg-sky-500 dark:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span>Back to Courses</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl pb-24">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onExit}
          className="flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white/85 px-4 text-sm font-medium text-slate-700 backdrop-blur-md hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Exit Course</span>
        </button>

        <div className="flex items-center gap-3 text-xs font-medium text-slate-600 dark:text-slate-300">
          <span className="font-mono-tabular">
            Module {progress.currentModuleIndex + 1} of {course.modules.length}
          </span>
          {progress.status === 'completed' && (
            <button
              type="button"
              onClick={() => setShowSummary(true)}
              className="min-h-[36px] rounded-lg bg-blue-50 px-3 font-semibold text-blue-700 hover:bg-blue-100 dark:bg-sky-950/60 dark:text-sky-300"
            >
              View Summary
            </button>
          )}
        </div>
      </div>

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
                  ? 'border-blue-700 bg-blue-700 text-white dark:border-sky-500 dark:bg-sky-500 dark:text-slate-950'
                  : isDone
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'border-slate-200 bg-white/80 text-slate-400 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-500'
              }`}
            >
              <span className="font-mono-tabular">{idx + 1}.</span>
              <span className="max-w-[140px] truncate">{mod.title}</span>
            </button>
          );
        })}
      </div>

      {currentModule.kind === 'lesson' ? (
        <article className="rounded-2xl border border-slate-200/80 bg-white/85 p-6 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/75 sm:p-8">
          <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Lesson · {currentModule.estimatedMinutes} min read
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 text-balance dark:text-white sm:text-3xl">
              {currentModule.title}
            </h1>
          </div>

          <div className="mt-6 space-y-6">
            {currentModule.blocks.map((block) => {
              if (block.type === 'header') {
                if (block.level === 1) {
                  return (
                    <h2 key={block.id} className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
                      {block.text}
                    </h2>
                  );
                }
                if (block.level === 2) {
                  return (
                    <h3 key={block.id} className="text-lg font-bold text-slate-900 dark:text-white">
                      {block.text}
                    </h3>
                  );
                }
                return (
                  <h4 key={block.id} className="text-base font-semibold text-slate-900 dark:text-white">
                    {block.text}
                  </h4>
                );
              }

              if (block.type === 'body') {
                return (
                  <p
                    key={block.id}
                    className={`max-w-[70ch] text-[15px] leading-relaxed text-slate-700 dark:text-slate-200 ${
                      block.align === 'center' ? 'mx-auto text-center' : ''
                    }`}
                  >
                    {renderFormattedText(block.text)}
                  </p>
                );
              }

              if (block.type === 'bullets') {
                return (
                  <ul
                    key={block.id}
                    className="max-w-[70ch] list-disc space-y-2 pl-5 text-[15px] text-slate-700 dark:text-slate-200"
                  >
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

          <div className="mt-8 flex justify-end border-t border-slate-200 pt-6 dark:border-slate-800">
            <button
              type="button"
              onClick={handleCompleteLesson}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 text-sm font-semibold text-white hover:bg-blue-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400 sm:w-auto"
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
        <section className="rounded-2xl border border-slate-200/80 bg-white/85 p-6 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/75 sm:p-8">
          <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
            <p className="font-mono-tabular text-xs font-medium text-blue-700 dark:text-sky-400">
              Assessment · Passing Score {currentModule.passingScore}%
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
              {currentModule.title}
            </h1>
            {currentModule.description && (
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
                {currentModule.description}
              </p>
            )}
          </div>

          {quizFeedback && quizFeedback.quizId === currentModule.id ? (
            <div className="mx-auto my-8 max-w-xl">
              <div
                className={`rounded-3xl border p-8 text-center shadow-sm sm:p-10 ${
                  quizFeedback.passed
                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/40'
                    : 'border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40'
                }`}
              >
                <div className="mx-auto flex flex-col items-center">
                  <div
                    className={`flex h-16 w-16 items-center justify-center rounded-2xl ${
                      quizFeedback.passed
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/70 dark:text-red-300'
                    }`}
                  >
                    {quizFeedback.passed ? (
                      <CheckCircle2 className="h-9 w-9" />
                    ) : (
                      <AlertTriangle className="h-9 w-9" />
                    )}
                  </div>
                  <p className="font-mono-tabular mt-4 text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    {quizFeedback.score}%
                  </p>
                  <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                    {quizFeedback.passed
                      ? 'Quiz Passed'
                      : `Below ${quizFeedback.passingScore}% Passing Score`}
                  </h2>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                    {quizFeedback.passed
                      ? 'You met the passing threshold. Advance to the next step.'
                      : quizFeedback.restartMessage}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAdvanceAfterQuiz}
                  className={`mt-7 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl px-8 text-base font-bold text-white shadow-xs ${
                    quizFeedback.passed
                      ? 'bg-emerald-700 hover:bg-emerald-800'
                      : 'bg-slate-900 hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400'
                  }`}
                >
                  {quizFeedback.passed ? (
                    <>
                      <span>
                        {progress.currentModuleIndex >= course.modules.length - 1
                          ? 'View Course Summary'
                          : 'Continue'}
                      </span>
                      <ChevronRight className="h-5 w-5" />
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-5 w-5" />
                      <span>Retry</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
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
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/60"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
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
                        <span className="font-mono-tabular text-xs text-slate-500 dark:text-slate-400">
                          Previous tries: {progress.questionTries[q.id]}
                        </span>
                      ) : null}
                    </div>

                    <p className="text-base font-semibold text-slate-900 dark:text-white">
                      {q.prompt}
                    </p>

                    {(q.type === 'multiple_choice' || q.type === 'true_false') && (
                      <div className="mt-3 space-y-2">
                        {options.map((opt, optIdx) => {
                          const selected = currentAnswer === optIdx;
                          return (
                            <label
                              key={optIdx}
                              className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition-colors ${
                                selected
                                  ? 'border-blue-700 bg-blue-50 font-medium text-slate-900 dark:border-sky-400 dark:bg-sky-950/50 dark:text-white'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700'
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
                                  ? 'border-blue-700 bg-blue-50 font-medium text-slate-900 dark:border-sky-400 dark:bg-sky-950/50 dark:text-white'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700'
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
                          className="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="flex justify-end border-t border-slate-200 pt-5 dark:border-slate-800">
                <button
                  type="submit"
                  className="min-h-[48px] w-full rounded-xl bg-blue-700 px-6 text-sm font-semibold text-white hover:bg-blue-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400 sm:w-auto"
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
