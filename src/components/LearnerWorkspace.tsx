import React, { useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  CloudOff,
  Download,
  FileText,
  Mail,
  Play,
  Search,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react';
import type {
  CertificateRecord,
  Course,
  CourseProgressState,
  CourseSubmission,
  PendingOfflineSubmission,
  UserAccount,
} from '../types/training';
import { formatBytes, type DownloadedCoursePackage } from '../utils/offlineDb';
import { CertificateModal } from './CertificateModal';
import { CourseBannerImage } from './MediaRenderer';
import { CourseSummaryView } from './CourseSummaryView';

export type LearnerTab = 'available' | 'downloaded' | 'finished' | 'certificates';

interface LearnerWorkspaceProps {
  activeTab: LearnerTab;
  courses: Course[];
  loadingCourses: boolean;
  downloadedMap: Record<string, DownloadedCoursePackage>;
  progressMap: Record<string, CourseProgressState>;
  pendingSubmissions: PendingOfflineSubmission[];
  submittedCourses: CourseSubmission[];
  certificates: CertificateRecord[];
  downloadProgress: Record<string, number>;
  isOffline: boolean;
  user: UserAccount | null;
  onDownloadCourse: (course: Course) => Promise<void>;
  onRemoveDownloaded: (courseId: string) => Promise<void>;
  onOpenCoursePlayer: (courseId: string) => void;
  onSubmitPendingItem: (item: PendingOfflineSubmission) => Promise<void>;
  onCertificateUpdated: (cert: CertificateRecord) => void;
  onRequireAuth: () => void;
}

export const LearnerWorkspace: React.FC<LearnerWorkspaceProps> = ({
  activeTab,
  courses,
  loadingCourses,
  downloadedMap,
  progressMap,
  pendingSubmissions,
  submittedCourses,
  certificates,
  downloadProgress,
  isOffline,
  user,
  onDownloadCourse,
  onRemoveDownloaded,
  onOpenCoursePlayer,
  onSubmitPendingItem,
  onCertificateUpdated,
  onRequireAuth,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [downloadedFilter, setDownloadedFilter] = useState<'all' | 'not_started' | 'in_progress'>('all');
  const [submittedFilter, setSubmittedFilter] = useState<'all' | 'pending_review' | 'approved' | 'rejected'>('all');
  const [inspectingPending, setInspectingPending] = useState<PendingOfflineSubmission | null>(null);
  const [inspectingSubmission, setInspectingSubmission] = useState<CourseSubmission | null>(null);
  const [activeCertificate, setActiveCertificate] = useState<CertificateRecord | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>(['All']);
    courses.forEach((c) => {
      if (c.category) set.add(c.category);
    });
    return Array.from(set);
  }, [courses]);

  const filteredAvailable = useMemo(() => {
    return courses.filter((c) => {
      const matchesCat = selectedCategory === 'All' || c.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }, [courses, searchQuery, selectedCategory]);

  const downloadedList = useMemo(() => {
    return Object.values(downloadedMap).sort((a, b) =>
      b.downloadedAt.localeCompare(a.downloadedAt)
    );
  }, [downloadedMap]);

  const filteredDownloaded = useMemo(() => {
    return downloadedList.filter((pkg) => {
      const prog = progressMap[pkg.courseId];
      const status = prog?.status ?? 'not_started';
      if (downloadedFilter === 'not_started') return status === 'not_started';
      if (downloadedFilter === 'in_progress') return status === 'in_progress' || status === 'completed';
      return true;
    });
  }, [downloadedList, progressMap, downloadedFilter]);

  const filteredSubmitted = useMemo(() => {
    if (submittedFilter === 'all') return submittedCourses;
    return submittedCourses.filter((s) => s.status === submittedFilter);
  }, [submittedCourses, submittedFilter]);

  // If inspecting a summary from Finished Courses
  if (inspectingPending) {
    const course =
      downloadedMap[inspectingPending.courseId]?.course ??
      courses.find((c) => c._id === inspectingPending.courseId) ?? {
        _id: inspectingPending.courseId,
        title: inspectingPending.courseTitle,
        description: '',
        category: '',
        bannerUrl: '',
        certificateTitle: inspectingPending.certificateTitle,
        issuerName: inspectingPending.issuerName,
        published: true,
        modules: [],
        createdAt: '',
        updatedAt: '',
      };

    return (
      <CourseSummaryView
        course={course}
        questionResults={inspectingPending.questionResults}
        quizResults={inspectingPending.quizResults}
        isOffline={isOffline}
        isPendingQueue
        submitting={syncingId === inspectingPending.id}
        submitError={syncError}
        onSubmitOnline={async () => {
          if (!user) {
            onRequireAuth();
            return;
          }
          setSyncingId(inspectingPending.id);
          setSyncError(null);
          try {
            await onSubmitPendingItem(inspectingPending);
            setInspectingPending(null);
          } catch (err) {
            setSyncError(err instanceof Error ? err.message : 'Submission failed.');
          } finally {
            setSyncingId(null);
          }
        }}
        onBack={() => {
          setInspectingPending(null);
          setSyncError(null);
        }}
      />
    );
  }

  if (inspectingSubmission) {
    const course =
      courses.find((c) => c._id === inspectingSubmission.courseId) ??
      downloadedMap[inspectingSubmission.courseId]?.course ?? {
        _id: inspectingSubmission.courseId,
        title: inspectingSubmission.courseTitle,
        description: '',
        category: '',
        bannerUrl: '',
        certificateTitle: inspectingSubmission.certificateTitle,
        issuerName: inspectingSubmission.issuerName,
        published: true,
        modules: [],
        createdAt: '',
        updatedAt: '',
      };

    return (
      <CourseSummaryView
        course={course}
        questionResults={inspectingSubmission.questionResults}
        quizResults={inspectingSubmission.quizResults}
        isAlreadySubmitted
        onBack={() => setInspectingSubmission(null)}
      />
    );
  }

  return (
    <div className="pb-24 md:pb-10">
      {/* TAB 1: AVAILABLE COURSES */}
      {activeTab === 'available' && (
        <div>
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl text-balance">
                Available Training Courses
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Download complete courses with videos, illustrations, and quizzes for offline study.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1 sm:w-64">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search courses..."
                  aria-label="Search available courses"
                  className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white/85 pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 backdrop-blur-md focus:border-blue-700 focus:outline-none dark:border-slate-700/80 dark:bg-slate-900/75 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-sky-400"
                />
              </div>
            </div>
          </div>

          {/* Category Filter Bar */}
          <div className="mb-6 flex gap-1.5 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`min-h-[40px] shrink-0 whitespace-nowrap rounded-lg px-3.5 text-xs font-semibold transition-colors ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950'
                    : 'border border-slate-200 bg-white/80 text-slate-600 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {loadingCourses ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/70"
                />
              ))}
            </div>
          ) : filteredAvailable.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white/85 p-10 text-center backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/75">
              <BookOpen className="mx-auto mb-3 h-8 w-8 text-slate-400 dark:text-slate-500" />
              <p className="text-base font-semibold text-slate-900 dark:text-white">No matching courses found</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Try clearing your search filter or check back after an administrator publishes new training.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredAvailable.map((course) => {
                const isDownloaded = Boolean(downloadedMap[course._id]);
                const pct = downloadProgress[course._id];
                const lessonCount = course.modules.filter((m) => m.kind === 'lesson').length;
                const quizCount = course.modules.filter((m) => m.kind === 'quiz').length;

                return (
                  <article
                    key={course._id}
                    className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white/85 backdrop-blur-md transition hover:border-slate-300 dark:border-slate-800/80 dark:bg-slate-900/75 dark:hover:border-slate-700"
                  >
                    <CourseBannerImage
                      url={course.bannerUrl}
                      title={course.title}
                      offlineBlobs={downloadedMap[course._id]?.mediaBlobs}
                      className="h-44 w-full"
                    />
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-medium text-blue-700 dark:text-sky-400">{course.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular">
                          {lessonCount} {lessonCount === 1 ? 'lesson' : 'lessons'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular">
                          {quizCount} {quizCount === 1 ? 'quiz' : 'quizzes'}
                        </span>
                      </div>

                      <h2 className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{course.title}</h2>
                      <p className="mt-1.5 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        {course.description}
                      </p>

                      <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
                        {isDownloaded ? (
                          <button
                            type="button"
                            onClick={() => onOpenCoursePlayer(course._id)}
                            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                          >
                            <Play className="h-4 w-4" />
                            <span>Downloaded · Open Course</span>
                          </button>
                        ) : typeof pct === 'number' ? (
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs font-medium text-blue-700 dark:text-sky-400">
                              <span>Downloading lessons &amp; media...</span>
                              <span className="font-mono-tabular">{pct}%</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                              <div
                                className="h-full bg-blue-700 transition-all dark:bg-sky-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={isOffline}
                            onClick={() => {
                              if (!user) {
                                onRequireAuth();
                                return;
                              }
                              onDownloadCourse(course);
                            }}
                            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-500 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                          >
                            <Download className="h-4 w-4" />
                            <span>
                              {isOffline ? 'Reconnect to Download' : 'Download for Offline'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DOWNLOADED COURSES */}
      {activeTab === 'downloaded' && (
        <div>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                Downloaded Courses
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Available completely offline with cached videos, images, and quizzes.
              </p>
            </div>

            <div className="inline-flex rounded-xl border border-slate-200/80 bg-slate-100/90 p-1 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
              {[
                { id: 'all', label: 'All' },
                { id: 'not_started', label: 'Not Started' },
                { id: 'in_progress', label: 'In Progress' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDownloadedFilter(item.id as typeof downloadedFilter)}
                  className={`min-h-[38px] whitespace-nowrap rounded-lg px-3.5 text-xs font-semibold transition-colors ${
                    downloadedFilter === item.id
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {filteredDownloaded.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white/85 p-10 text-center backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/75">
              <Download className="mx-auto mb-3 h-8 w-8 text-slate-400 dark:text-slate-500" />
              <p className="text-base font-semibold text-slate-900 dark:text-white">
                {downloadedList.length === 0
                  ? 'No courses downloaded yet'
                  : 'No courses in this status'}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Download any course from Available Courses to read lessons and take quizzes without Wi-Fi.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredDownloaded.map((pkg) => {
                const prog = progressMap[pkg.courseId];
                const totalMods = Math.max(1, pkg.course.modules.length);
                const doneCount = prog?.completedModuleIds.length ?? 0;
                const pct = Math.min(100, Math.round((doneCount / totalMods) * 100));
                const status = prog?.status ?? 'not_started';
                const currentModTitle =
                  pkg.course.modules[prog?.currentModuleIndex ?? 0]?.title ?? 'Module 1';

                return (
                  <article
                    key={pkg.courseId}
                    className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white/85 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/75"
                  >
                    <CourseBannerImage
                      url={pkg.course.bannerUrl}
                      title={pkg.course.title}
                      offlineBlobs={pkg.mediaBlobs}
                      className="h-36 w-full"
                    />
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span
                          className={`font-semibold ${
                            status === 'not_started'
                              ? 'text-slate-600 dark:text-slate-400'
                              : status === 'completed'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-blue-700 dark:text-sky-400'
                          }`}
                        >
                          {status === 'not_started'
                            ? 'Not Started'
                            : status === 'completed'
                            ? 'Completed'
                            : 'In Progress'}
                        </span>
                        <span className="font-mono-tabular text-slate-500 dark:text-slate-400">
                          {formatBytes(pkg.totalBytes)}
                        </span>
                      </div>

                      <h2 className="mt-1.5 text-lg font-bold text-slate-900 dark:text-white">
                        {pkg.course.title}
                      </h2>

                      <div className="mt-4 space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                          <span className="truncate pr-2">
                            {status === 'not_started'
                              ? `${pkg.course.modules.length} modules ready`
                              : `Current: ${currentModTitle}`}
                          </span>
                          <span className="font-mono-tabular shrink-0 font-semibold text-slate-900 dark:text-white">
                            {doneCount}/{totalMods} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className={`h-full transition-all ${
                              status === 'completed'
                                ? 'bg-emerald-600 dark:bg-emerald-500'
                                : 'bg-blue-700 dark:bg-sky-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => onOpenCoursePlayer(pkg.courseId)}
                          className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
                        >
                          <Play className="h-4 w-4" />
                          <span>
                            {status === 'not_started'
                              ? 'Start Course'
                              : status === 'completed'
                              ? 'Review & Submit'
                              : 'Resume Course'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveDownloaded(pkg.courseId)}
                          aria-label={`Remove offline download for ${pkg.course.title}`}
                          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: FINISHED COURSES */}
      {activeTab === 'finished' && (
        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">Finished Courses</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Track offline completions waiting to sync and review admin approval status on submitted courses.
            </p>
          </div>

          {syncError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              {syncError}
            </div>
          )}

          {/* Section 1: Pending Submission (Offline Queue) */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Pending Submission (Offline Queue)
              </h2>
              <span className="font-mono-tabular text-xs font-medium text-slate-500 dark:text-slate-400">
                {pendingSubmissions.length} waiting
              </span>
            </div>

            {pendingSubmissions.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white/85 p-6 text-sm text-slate-500 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/75 dark:text-slate-400">
                No completed courses waiting in the offline queue.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingSubmissions.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-5 backdrop-blur-md sm:flex-row sm:items-center dark:border-amber-800/50 dark:bg-amber-950/30"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
                        <CloudOff className="h-4 w-4" />
                        <span>Completed Offline · Ready to Sync</span>
                      </div>
                      <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                        {item.courseTitle}
                      </h3>
                      <p className="mt-0.5 font-mono-tabular text-xs text-slate-600 dark:text-slate-300">
                        Score: {item.overallScore}% · Saved{' '}
                        {new Date(item.completedOfflineAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setInspectingPending(item)}
                        className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        View Summary
                      </button>
                      <button
                        type="button"
                        disabled={isOffline || syncingId === item.id}
                        onClick={async () => {
                          if (!user) {
                            onRequireAuth();
                            return;
                          }
                          setSyncingId(item.id);
                          setSyncError(null);
                          try {
                            await onSubmitPendingItem(item);
                          } catch (err) {
                            setSyncError(
                              err instanceof Error ? err.message : 'Unable to submit.'
                            );
                          } finally {
                            setSyncingId(null);
                          }
                        }}
                        className="flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-700 px-4 text-xs font-semibold text-white hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-500 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>
                          {isOffline
                            ? 'Connect Wi-Fi to Submit'
                            : syncingId === item.id
                            ? 'Submitting...'
                            : 'Submit Now'}
                        </span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section 2: Submitted Courses */}
          <section>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Submitted Courses</h2>
              <div className="inline-flex rounded-xl border border-slate-200/80 bg-slate-100/90 p-1 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'pending_review', label: 'Pending Review' },
                  { id: 'approved', label: 'Approved' },
                  { id: 'rejected', label: 'Rejected' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSubmittedFilter(tab.id as typeof submittedFilter)}
                    className={`min-h-[36px] whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition-colors ${
                      submittedFilter === tab.id
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {!user ? (
              <div className="rounded-2xl border border-slate-200 bg-white/85 p-8 text-center backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/75">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Sign in to view your submitted courses and admin review status.
                </p>
                <button
                  type="button"
                  onClick={onRequireAuth}
                  className="mt-4 min-h-[44px] rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
                >
                  Sign In / Register
                </button>
              </div>
            ) : filteredSubmitted.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white/85 p-8 text-center text-sm text-slate-500 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/75 dark:text-slate-400">
                No submitted courses match this filter yet.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSubmitted.map((sub) => (
                  <div
                    key={sub._id}
                    className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white/85 p-5 backdrop-blur-md sm:flex-row sm:items-center dark:border-slate-800/80 dark:bg-slate-900/75"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {sub.status === 'approved' ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-4 w-4" />
                            Approved
                          </span>
                        ) : sub.status === 'rejected' ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-red-700 dark:text-red-400">
                            <XCircle className="h-4 w-4" />
                            Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400">
                            <Clock className="h-4 w-4" />
                            Pending Admin Review
                          </span>
                        )}
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                          ·
                        </span>
                        <span className="font-mono-tabular text-slate-600 dark:text-slate-300">
                          Score {sub.overallScore}%
                        </span>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                          ·
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          Submitted {new Date(sub.submittedAt).toLocaleDateString()}
                        </span>
                      </div>

                      <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                        {sub.courseTitle}
                      </h3>
                      {sub.adminFeedback && (
                        <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
                          <span className="font-semibold text-slate-800 dark:text-slate-100">Admin note:</span>{' '}
                          {sub.adminFeedback}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setInspectingSubmission(sub)}
                      className="flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <FileText className="h-4 w-4" />
                      <span>View Answer Summary</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 4: CERTIFICATES */}
      {activeTab === 'certificates' && (
        <div>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
              Earned Certificates
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              View official training credentials, download high-resolution PDFs, or email copies to yourself.
            </p>
          </div>

          {!user ? (
            <div className="rounded-2xl border border-slate-200 bg-white/85 p-10 text-center backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/75">
              <Award className="mx-auto mb-3 h-8 w-8 text-slate-400 dark:text-slate-500" />
              <p className="text-base font-semibold text-slate-900 dark:text-white">
                Sign in to access your earned certificates
              </p>
              <button
                type="button"
                onClick={onRequireAuth}
                className="mt-4 min-h-[44px] rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
              >
                Sign In / Register
              </button>
            </div>
          ) : certificates.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white/85 p-10 text-center backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/75">
              <Award className="mx-auto mb-3 h-8 w-8 text-slate-400 dark:text-slate-500" />
              <p className="text-base font-semibold text-slate-900 dark:text-white">No certificates issued yet</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Complete a course and submit it for admin approval to receive your PDF certificate.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {certificates.map((cert) => (
                <article
                  key={cert._id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white/85 p-6 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/75"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-blue-700 dark:text-sky-400">{cert.issuerName}</span>
                      <span className="font-mono-tabular">{cert.certificateCode}</span>
                    </div>
                    <h2 className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                      {cert.certificateTitle}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{cert.courseTitle}</p>
                    <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono-tabular font-semibold text-slate-900 dark:text-white">
                        Score {cert.score}%
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Issued {new Date(cert.issuedAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setActiveCertificate(cert)}
                      className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
                    >
                      <Award className="h-4 w-4" />
                      <span>View &amp; PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveCertificate(cert)}
                      aria-label={`Email certificate ${cert.certificateTitle}`}
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Mail className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      <CertificateModal
        certificate={activeCertificate}
        onClose={() => setActiveCertificate(null)}
        onUpdated={(updated) => {
          setActiveCertificate(updated);
          onCertificateUpdated(updated);
        }}
      />
    </div>
  );
};
