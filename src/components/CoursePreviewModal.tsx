import React, { useEffect } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Lock,
  Star,
  X,
} from 'lucide-react';
import type { Course, LessonModule, SystemBranding } from '../types/training';
import {
  computeCoursePopularityPercent,
  computeCoursePopularityScore,
} from '../utils/courseRating';
import { renderFormattedText } from '../utils/formatText';
import { AndroidIcon } from './AndroidIcon';
import { CourseBannerImage, MediaRenderer } from './MediaRenderer';

interface CoursePreviewModalProps {
  course: Course | null;
  branding: SystemBranding;
  accent: string;
  isDark: boolean;
  catalogBaselineRating?: number;
  onClose: () => void;
  onOpenInstall: () => void;
}

export const CoursePreviewModal: React.FC<CoursePreviewModalProps> = ({
  course,
  branding,
  accent,
  isDark,
  catalogBaselineRating = 4.0,
  onClose,
  onOpenInstall,
}) => {
  useEffect(() => {
    if (!course) return undefined;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [course, onClose]);

  const lessons = course
    ? course.modules.filter((m): m is LessonModule => m.kind === 'lesson')
    : [];
  const quizzes = course ? course.modules.filter((m) => m.kind === 'quiz') : [];
  const totalMinutes = lessons.reduce((sum, l) => sum + (l.estimatedMinutes || 0), 0);
  const totalQuestions = quizzes.reduce((sum, q) => sum + q.questions.length, 0);
  const sampleLesson = lessons[0] ?? null;
  const ratingCount = course?.ratingCount ?? 0;
  const averageRating = course?.averageRating ?? 0;
  const popularityScore = course
    ? computeCoursePopularityScore(course, catalogBaselineRating)
    : 0;
  const popularityPercent = course
    ? computeCoursePopularityPercent(course, catalogBaselineRating)
    : 0;
  const isPlayStore = branding.appDistributionMode === 'play_store';

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {course && (
          <motion.div
            key={course._id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-xs sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-preview-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) onClose();
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 28, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28, mass: 0.85 }}
              className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white/95 shadow-2xl backdrop-blur-xl will-change-transform dark:border-slate-800 dark:bg-slate-900/95 sm:rounded-2xl"
            >
        {/* Sticky Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 px-6 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span style={{ color: isDark ? '#38bdf8' : accent }}>{course.category}</span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                ·
              </span>
              <span className="text-slate-500 dark:text-slate-400">{course.issuerName}</span>
            </div>
            <h2
              id="course-preview-title"
              className="mt-1 text-lg font-bold leading-snug text-slate-900 dark:text-white sm:text-xl"
            >
              {course.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close course preview"
            className="flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* Banner + Description */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
            <CourseBannerImage
              url={course.bannerUrl}
              title={course.title}
              className="aspect-video max-h-60 w-full"
            />
          </div>

          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {course.description}
          </p>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4 text-xs sm:grid-cols-4 dark:border-slate-800 dark:bg-slate-950/60">
            <div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Lessons</p>
              <p className="font-mono-tabular mt-1 font-semibold text-slate-900 dark:text-white">
                {lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'}
                {totalMinutes > 0 ? ` · ${totalMinutes} min` : ''}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Assessments
              </p>
              <p className="font-mono-tabular mt-1 font-semibold text-slate-900 dark:text-white">
                {quizzes.length} {quizzes.length === 1 ? 'quiz' : 'quizzes'} · {totalQuestions} Qs
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Rating</p>
              <p className="font-mono-tabular mt-1 inline-flex items-center gap-1 font-semibold text-slate-900 dark:text-white">
                <Star
                  className={`h-3.5 w-3.5 ${
                    ratingCount > 0
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-slate-300 dark:text-slate-600'
                  }`}
                />
                {ratingCount > 0 ? `${averageRating.toFixed(1)} (${ratingCount})` : 'No ratings'}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Credential
              </p>
              <p className="mt-1 truncate font-semibold text-slate-900 dark:text-white">
                {course.certificateTitle}
              </p>
            </div>
          </div>

          {/* Visual Star-Rating Popularity Progress Bar */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Course Popularity Performance
                </span>
                <div
                  className="flex items-center gap-0.5"
                  aria-label={`${averageRating.toFixed(1)} out of 5 stars`}
                >
                  {[1, 2, 3, 4, 5].map((starIndex) => {
                    const filled = ratingCount > 0 && averageRating >= starIndex - 0.25;
                    return (
                      <Star
                        key={starIndex}
                        className={`h-3.5 w-3.5 ${
                          filled
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-300 dark:text-slate-700'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
              <span className="font-mono-tabular text-xs font-bold text-slate-900 dark:text-sky-400">
                {ratingCount > 0
                  ? `${popularityScore.toFixed(2)} / 5.00 (${popularityPercent}%)`
                  : '0.00 / 5.00 (0%)'}
              </span>
            </div>

            <div
              role="progressbar"
              aria-label="Course popularity rating performance"
              aria-valuenow={popularityPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${popularityPercent}%`,
                  background:
                    ratingCount > 0
                      ? `linear-gradient(90deg, #f59e0b 0%, ${isDark ? '#38bdf8' : accent} 100%)`
                      : undefined,
                }}
              />
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span>
                {ratingCount > 0
                  ? `Weighted from ${averageRating.toFixed(1)}★ avg across ${ratingCount} ${
                      ratingCount === 1 ? 'rating' : 'ratings'
                    } (baseline ${catalogBaselineRating.toFixed(2)}★)`
                  : 'No learner ratings yet — complete this course in the mobile app to submit the first rating.'}
              </span>
              <span className="font-mono-tabular shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
                0★ — 5★ Scale
              </span>
            </div>
          </div>

          {/* Curriculum Outline */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Curriculum Syllabus
              </h3>
              <span className="font-mono-tabular text-xs text-slate-500 dark:text-slate-400">
                {course.modules.length} {course.modules.length === 1 ? 'module' : 'modules'}
              </span>
            </div>

            {course.modules.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
                Course modules are being prepared for mobile release.
              </p>
            ) : (
              <ol className="space-y-2">
                {course.modules.map((mod, idx) => {
                  const isFirstLesson = sampleLesson && mod.id === sampleLesson.id;
                  return (
                    <li
                      key={mod.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-950/60"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="font-mono-tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold text-slate-900 dark:text-white">
                              {mod.title}
                            </p>
                            {isFirstLesson && (
                              <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-sky-950/70 dark:text-sky-300">
                                Sample Preview Below
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {mod.kind === 'lesson' ? (
                              <>
                                <BookOpen className="h-3 w-3 shrink-0" />
                                <span>Lesson</span>
                                <span>·</span>
                                <Clock className="h-3 w-3 shrink-0" />
                                <span>{mod.estimatedMinutes} min read</span>
                              </>
                            ) : (
                              <>
                                <ClipboardCheck className="h-3 w-3 shrink-0" />
                                <span>
                                  Assessment · {mod.questions.length}{' '}
                                  {mod.questions.length === 1 ? 'question' : 'questions'} · Pass{' '}
                                  {mod.passingScore}%
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      {!isFirstLesson && (
                        <span
                          title="Complete inside the Android app"
                          className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-slate-500"
                        >
                          <Lock className="h-3 w-3" />
                          <span className="hidden sm:inline">In App</span>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* Sample First Lesson Preview */}
          {sampleLesson && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
                <div>
                  <p className="text-[11px] font-bold tracking-wider text-blue-700 uppercase dark:text-sky-400">
                    Lesson 1 Sample Preview
                  </p>
                  <h4 className="mt-0.5 text-base font-bold text-slate-900 dark:text-white">
                    {sampleLesson.title}
                  </h4>
                </div>
                <span className="font-mono-tabular inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <Clock className="h-3.5 w-3.5" />
                  {sampleLesson.estimatedMinutes} min
                </span>
              </div>

              <div className="space-y-4">
                {sampleLesson.blocks.map((block) => {
                  if (block.type === 'header') {
                    return (
                      <h5
                        key={block.id}
                        className={`font-bold text-slate-900 dark:text-white ${
                          block.level === 1
                            ? 'text-lg'
                            : block.level === 2
                            ? 'text-base'
                            : 'text-sm'
                        }`}
                      >
                        {block.text}
                      </h5>
                    );
                  }
                  if (block.type === 'body') {
                    return (
                      <p
                        key={block.id}
                        className={`text-sm leading-relaxed text-slate-700 dark:text-slate-300 ${
                          block.align === 'center' ? 'text-center' : ''
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
                        className="space-y-1.5 rounded-xl border border-slate-200/80 bg-white p-3.5 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300"
                      >
                        {block.items.map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            <span>{renderFormattedText(item)}</span>
                          </li>
                        ))}
                      </ul>
                    );
                  }
                  return (
                    <MediaRenderer
                      key={block.id}
                      type={block.type}
                      url={block.url}
                      caption={block.caption}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Certificate Note */}
          <div className="flex items-start gap-3 rounded-2xl border border-blue-200/80 bg-blue-50/70 p-4 text-xs text-slate-700 dark:border-sky-900/60 dark:bg-sky-950/35 dark:text-slate-300">
            <Award className="mt-0.5 h-5 w-5 shrink-0 text-blue-700 dark:text-sky-400" />
            <div>
              <p className="font-bold text-slate-900 dark:text-white">
                Earn Verified Certificate: {course.certificateTitle}
              </p>
              <p className="mt-0.5 leading-relaxed">
                Issued by {course.issuerName} upon completing all lessons and passing the course
                assessments inside the {branding.systemName} Android app.
              </p>
            </div>
          </div>
        </div>

        {/* Sticky Modal Footer */}
        <div className="flex flex-col-reverse gap-2 border-t border-slate-200/80 bg-slate-50/90 px-6 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-950/70">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Download the Android app to save this course for offline study and earn your PDF
            certificate.
          </p>
          <div className="flex shrink-0 items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Close
            </button>
            <button
              type="button"
              onClick={onOpenInstall}
              style={!isDark ? { backgroundColor: accent } : undefined}
              className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90 dark:bg-sky-500 dark:text-slate-950"
            >
              <AndroidIcon className="h-4 w-4 shrink-0" />
              <span>{isPlayStore ? 'Get App on Google Play' : 'Download Android App'}</span>
            </button>
          </div>
        </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
};
