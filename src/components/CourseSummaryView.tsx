import React from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, CloudOff, Send, XCircle } from 'lucide-react';
import type { Course, QuestionAttemptRecord, QuizAttemptSummary } from '../types/training';
import { buildCourseSummary } from '../utils/quizEngine';

interface CourseSummaryViewProps {
  course: Course;
  questionResults: QuestionAttemptRecord[];
  quizResults: QuizAttemptSummary[];
  isOffline?: boolean;
  isAlreadySubmitted?: boolean;
  isPendingQueue?: boolean;
  submitting?: boolean;
  submitError?: string | null;
  onSubmitOnline?: () => void;
  onSaveOfflinePending?: () => void;
  onBack: () => void;
}

export const CourseSummaryView: React.FC<CourseSummaryViewProps> = ({
  course,
  questionResults,
  quizResults,
  isOffline = false,
  isAlreadySubmitted = false,
  isPendingQueue = false,
  submitting = false,
  submitError = null,
  onSubmitOnline,
  onSaveOfflinePending,
  onBack,
}) => {
  const analytics = buildCourseSummary(course, questionResults);
  const wrongResults = questionResults.filter((r) => !r.isCorrect);

  return (
    <div className="mx-auto max-w-4xl pb-24">
      <div className="mb-6 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>
        <span className="font-mono-tabular text-xs font-medium text-slate-500">
          {analytics.correctCount} / {analytics.totalQuestions} Questions Correct
        </span>
      </div>

      {/* Summary Banner */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold text-blue-700">
              Course Completion Summary
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl text-balance">
              {course.title}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Review what you answered correctly, focus areas for reinforcement, and explanations for any missed items.
            </p>
          </div>
          <div className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-center">
            <div className="font-mono-tabular text-3xl font-bold text-slate-900">
              {analytics.overallScore}%
            </div>
            <div className="mt-0.5 text-xs font-medium text-slate-500">Overall Accuracy</div>
          </div>
        </div>

        {/* Quiz Score Breakdown */}
        {quizResults.length > 0 && (
          <div className="mt-6 grid gap-3 border-t border-slate-200 pt-5 sm:grid-cols-2">
            {quizResults.map((qr) => (
              <div
                key={qr.quizId}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="min-w-0 pr-3">
                  <p className="truncate text-sm font-semibold text-slate-900">{qr.quizTitle}</p>
                  <p className="font-mono-tabular text-xs text-slate-500">
                    Required {qr.passingScore}% · Attempts: {qr.attempts}
                  </p>
                </div>
                <span
                  className={`font-mono-tabular shrink-0 text-sm font-bold ${
                    qr.passed ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {qr.score}% {qr.passed ? 'Passed' : 'Failed'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* What You Got Right vs Areas Needing Review */}
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
            <h2 className="text-base font-bold text-slate-900">What You Got Right</h2>
          </div>
          {analytics.gotRight.length === 0 ? (
            <p className="text-sm text-slate-500">No correct answers recorded yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {analytics.gotRight.map((item) => (
                <li key={item.questionId} className="py-3 first:pt-0 last:pb-0 text-sm">
                  <p className="font-medium text-slate-900">{item.questionPrompt}</p>
                  <p className="mt-1 text-xs text-emerald-700">
                    {item.topicTag} <span aria-hidden="true">·</span>{' '}
                    <span className="font-mono-tabular">
                      Solved in {item.tries} {item.tries === 1 ? 'try' : 'tries'}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-2 text-amber-700">
            <AlertCircle className="h-5 w-5" />
            <h2 className="text-base font-bold text-slate-900">Areas Needing More Review</h2>
          </div>
          {analytics.weakAreas.length === 0 && wrongResults.length === 0 ? (
            <p className="text-sm text-emerald-700">
              All topics were mastered accurately on the first attempt.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {analytics.weakAreas.map((area) => (
                <li key={area.topic} className="py-3 first:pt-0 last:pb-0 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{area.topic}</p>
                    <span className="font-mono-tabular text-xs font-semibold text-amber-700">
                      {area.accuracy}% accuracy
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {area.correct} of {area.total} questions mastered ·{' '}
                    <span className="font-mono-tabular">{area.totalTries} total attempts</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Wrong Answers With Correct Answer & Explanation */}
      {wrongResults.length > 0 && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">
            Corrections &amp; Explanations for Missed Questions
          </h2>
          <div className="mt-4 space-y-4">
            {wrongResults.map((item) => (
              <div
                key={item.questionId}
                className="rounded-xl border border-red-200 bg-red-50/40 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{item.questionPrompt}</p>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-red-700">
                    <XCircle className="h-4 w-4" />
                    Incorrect
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <div className="rounded-lg border border-red-200 bg-white p-2.5">
                    <span className="block font-semibold text-red-700">Your Answer</span>
                    <span className="mt-0.5 block text-slate-700">{item.userAnswerLabel}</span>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-white p-2.5">
                    <span className="block font-semibold text-emerald-700">Correct Answer</span>
                    <span className="mt-0.5 block text-slate-900">{item.correctAnswerLabel}</span>
                  </div>
                </div>
                <div className="mt-3 rounded-lg bg-white p-3 text-xs text-slate-700 border border-slate-200">
                  <span className="font-semibold text-slate-900">Explanation: </span>
                  {item.explanation || 'Review the corresponding lesson section for details.'}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Full Answer Sheet */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">Complete Answer Breakdown</h2>
        <div className="mt-4 divide-y divide-slate-200">
          {questionResults.map((item, idx) => (
            <div key={item.questionId} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-500">
                  Q{idx + 1} · {item.quizTitle} · {item.questionType.replace('_', ' ')}
                </span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-mono-tabular text-slate-600">
                    Tries: {item.tries}
                  </span>
                  {item.isCorrect ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      Correct
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                      <XCircle className="h-4 w-4" />
                      Wrong
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-1.5 text-sm font-semibold text-slate-900">{item.questionPrompt}</p>
              <p className="mt-1 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Your answer:</span>{' '}
                {item.userAnswerLabel}
              </p>
              {!item.isCorrect && (
                <p className="mt-1 text-xs text-emerald-800">
                  <span className="font-semibold">Correct answer:</span> {item.correctAnswerLabel}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Submit / Offline Queue Action Bar */}
      {!isAlreadySubmitted && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
          {submitError && (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {submitError}
            </div>
          )}

          {isOffline ? (
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <CloudOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    No Internet Connection Detected
                  </p>
                  <p className="text-xs text-slate-600">
                    Save this completed course to your Pending Queue and submit it once Wi-Fi returns.
                  </p>
                </div>
              </div>
              {onSaveOfflinePending && !isPendingQueue && (
                <button
                  type="button"
                  onClick={onSaveOfflinePending}
                  className="min-h-[48px] w-full shrink-0 rounded-xl bg-amber-600 px-5 text-sm font-semibold text-white hover:bg-amber-700 sm:w-auto"
                >
                  Save to Pending Queue
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Ready for Admin Review &amp; Certification
                </p>
                <p className="text-xs text-slate-600">
                  Submitting sends your answers and question attempt counts to the training administrator.
                </p>
              </div>
              {onSubmitOnline && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={onSubmitOnline}
                  className="flex min-h-[48px] w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 sm:w-auto"
                >
                  <Send className="h-4 w-4" />
                  <span>{submitting ? 'Submitting...' : 'Submit to Admin'}</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
