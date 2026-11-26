import React, { useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  BookOpen,
  Clock,
  Download,
  Lightbulb,
  Medal,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import type { AdminAnalyticsReport, LearnerAnalyticsSummary } from '../types/training';
import { formatDurationSeconds } from '../utils/analytics';

interface AdminAnalyticsDashboardProps {
  report: AdminAnalyticsReport | null;
  loading: boolean;
  onRefresh: () => void;
  onOpenSubmissions: () => void;
}

type CourseSortField =
  | 'downloadCount'
  | 'submissionCount'
  | 'averageScore'
  | 'averageReadingSeconds'
  | 'averageQuizRetries';

export const AdminAnalyticsDashboard: React.FC<AdminAnalyticsDashboardProps> = ({
  report,
  loading,
  onRefresh,
  onOpenSubmissions,
}) => {
  const [courseSort, setCourseSort] = useState<CourseSortField>('downloadCount');
  const [learnerQuery, setLearnerQuery] = useState('');
  const [capacityFilter, setCapacityFilter] = useState<
    'all' | 'Accelerated' | 'Steady' | 'Needs Guidance'
  >('all');
  const [selectedLearner, setSelectedLearner] = useState<LearnerAnalyticsSummary | null>(null);

  const sortedCourses = useMemo(() => {
    if (!report) return [];
    return [...report.courses].sort((a, b) => b[courseSort] - a[courseSort]);
  }, [report, courseSort]);

  const filteredLearners = useMemo(() => {
    if (!report) return [];
    const q = learnerQuery.trim().toLowerCase();
    return report.learners.filter((l) => {
      if (capacityFilter !== 'all' && l.learningCapacityTier !== capacityFilter) return false;
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.weakestTopic.toLowerCase().includes(q)
      );
    });
  }, [report, learnerQuery, capacityFilter]);

  if (loading && !report) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/75"
            />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/75" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white/85 p-10 text-center backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Unable to load analytics report.
        </p>
        <button
          type="button"
          onClick={onRefresh}
          className="mt-4 min-h-[40px] rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
        >
          Retry Loading Stats
        </button>
      </div>
    );
  }

  const { overview, highlights, weeklyTrend, suggestions } = report;
  const maxBarDownloads = Math.max(1, ...report.courses.map((c) => c.downloadCount));
  const maxTrendVal = Math.max(
    1,
    ...weeklyTrend.map((d) => Math.max(d.downloads, d.completions))
  );

  const tierCounts = {
    Accelerated: report.learners.filter((l) => l.learningCapacityTier === 'Accelerated').length,
    Steady: report.learners.filter((l) => l.learningCapacityTier === 'Steady').length,
    NeedsGuidance: report.learners.filter((l) => l.learningCapacityTier === 'Needs Guidance').length,
  };

  const statGuidanceMap = [
    {
      label: 'Total Downloads',
      value: String(overview.totalDownloads),
      sub: `${overview.activeLearners} of ${overview.totalLearners} active learners`,
      tip:
        overview.totalDownloads > overview.totalSubmissions * 1.5
          ? 'Suggestion: Add quick resume prompts to convert offline downloads into finished exams.'
          : 'Suggestion: Download-to-completion conversion is keeping pace.',
      icon: <Download className="h-4 w-4 text-blue-700 dark:text-sky-400" />,
    },
    {
      label: 'Completed Submissions',
      value: String(overview.totalSubmissions),
      sub: `${overview.passRatePct}% pass rate · ${overview.pendingReviews} pending`,
      tip:
        overview.pendingReviews > 0
          ? `Suggestion: Review ${overview.pendingReviews} open submission${overview.pendingReviews === 1 ? '' : 's'} to issue certificates.`
          : 'Suggestion: All submitted assessments are reviewed.',
      icon: <BookOpen className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />,
    },
    {
      label: 'Avg Reading Time',
      value: formatDurationSeconds(overview.averageReadingSeconds),
      sub: `Per course · ${overview.averageScore}% avg score`,
      tip:
        overview.averageReadingSeconds < 240
          ? 'Suggestion: Insert visual check-ins mid-lesson to encourage deeper reading.'
          : 'Suggestion: Learners spend solid focused time studying lessons.',
      icon: <Clock className="h-4 w-4 text-cyan-700 dark:text-cyan-400" />,
    },
    {
      label: 'Avg Quiz Retries',
      value: `${overview.averageQuizRetries || 1}x`,
      sub: 'Attempts per quiz checkpoint',
      tip:
        overview.averageQuizRetries >= 1.7
          ? 'Suggestion: Review high-retry quiz distractors and clarify lesson examples.'
          : 'Suggestion: Quiz difficulty aligns well with lesson explanations.',
      icon: <RefreshCw className="h-4 w-4 text-amber-700 dark:text-amber-400" />,
    },
    {
      label: 'Avg Learning Capacity',
      value: `${overview.averageLearningCapacity}/100`,
      sub: `${tierCounts.Accelerated} accelerated · ${tierCounts.NeedsGuidance} guided`,
      tip: 'Weighted from score accuracy (45%), first-try mastery (25%), low retries (15%), and completion (15%).',
      icon: <TrendingUp className="h-4 w-4 text-blue-700 dark:text-sky-400" />,
    },
    {
      label: 'Certificates Issued',
      value: String(overview.totalCertificates),
      sub: `${overview.approvedSubmissions} approved completions`,
      tip: 'Suggestion: Enable custom per-course seals so each credential reflects its track.',
      icon: <Award className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Training Analytics &amp; Learner Telemetry
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Track course popularity, offline downloads, average reading duration, quiz retries, and individual learning capacity.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {overview.pendingReviews > 0 && (
            <button
              type="button"
              onClick={onOpenSubmissions}
              className="min-h-[40px] whitespace-nowrap rounded-xl border border-amber-300 bg-amber-50 px-3.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-700/60 dark:bg-amber-950/60 dark:text-amber-200 dark:hover:bg-amber-900/60"
            >
              Review {overview.pendingReviews} Pending
            </button>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="flex min-h-[40px] items-center gap-2 whitespace-nowrap rounded-xl border border-slate-300 bg-white/85 px-4 text-xs font-semibold text-slate-800 backdrop-blur-md hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh Stats'}</span>
          </button>
        </div>
      </div>

      {/* Executive KPI Grid + Per-Statistic Suggestions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statGuidanceMap.map((kpi) => (
          <article
            key={kpi.label}
            className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white/85 p-5 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/75"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {kpi.label}
                </span>
                {kpi.icon}
              </div>
              <p className="font-mono-tabular mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {kpi.value}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{kpi.sub}</p>
            </div>
            <p className="mt-3 border-t border-slate-100 pt-2.5 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:text-slate-300">
              {kpi.tip}
            </p>
          </article>
        ))}
      </div>

      {/* Course Leader Highlights */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Most Downloaded Course',
            course: highlights.mostDownloadedCourse,
            metric: highlights.mostDownloadedCourse
              ? `${highlights.mostDownloadedCourse.downloadCount} downloads · ${highlights.mostDownloadedCourse.completionRatePct}% finished`
              : 'No downloads yet',
          },
          {
            label: 'Most Completed Course',
            course: highlights.mostCompletedCourse,
            metric: highlights.mostCompletedCourse
              ? `${highlights.mostCompletedCourse.submissionCount} completions · ${highlights.mostCompletedCourse.approvedCount} approved`
              : 'No completions yet',
          },
          {
            label: 'Highest Average Score',
            course: highlights.highestScoreCourse,
            metric: highlights.highestScoreCourse
              ? `${highlights.highestScoreCourse.averageScore}% avg · ${highlights.highestScoreCourse.passRatePct}% pass`
              : 'Awaiting scores',
          },
          {
            label: 'Highest Quiz Retries',
            course: highlights.highestRetryCourse,
            metric: highlights.highestRetryCourse
              ? `${highlights.highestRetryCourse.averageQuizRetries}x avg attempts`
              : 'Awaiting quiz data',
          },
        ].map((item) => (
          <article
            key={item.label}
            className="rounded-2xl border border-slate-200/80 bg-white/85 p-4 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/75"
          >
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{item.label}</p>
            <p className="mt-1.5 line-clamp-2 text-sm leading-snug font-bold text-slate-900 dark:text-white">
              {item.course?.title || 'No course data'}
            </p>
            <p className="font-mono-tabular mt-1.5 text-xs font-medium text-blue-700 dark:text-sky-400">
              {item.metric}
            </p>
          </article>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Course Downloads vs Completions Bar Chart */}
        <section className="rounded-2xl border border-slate-200/80 bg-white/85 p-5 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/75">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Course Downloads vs. Completions
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Visual comparison of mobile offline downloads against finished submissions.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-xs bg-blue-600 dark:bg-sky-400" />
                Downloads
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-xs bg-emerald-600 dark:bg-emerald-400" />
                Completions
              </span>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {report.courses.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                No courses published yet.
              </p>
            ) : (
              report.courses.map((c) => {
                const dlPct = Math.round((c.downloadCount / maxBarDownloads) * 100);
                const compPct = Math.round((c.submissionCount / maxBarDownloads) * 100);
                return (
                  <div key={c.courseId} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate font-semibold text-slate-800 dark:text-slate-100">
                        {c.title}
                      </span>
                      <span className="font-mono-tabular shrink-0 text-slate-500 dark:text-slate-400">
                        {c.downloadCount} dl / {c.submissionCount} done ({c.completionRatePct}%)
                      </span>
                    </div>
                    <svg
                      viewBox="0 0 400 18"
                      className="h-4 w-full overflow-visible rounded bg-slate-100 dark:bg-slate-800"
                      role="img"
                      aria-label={`${c.title}: ${c.downloadCount} downloads, ${c.submissionCount} completions`}
                    >
                      <rect
                        x="0"
                        y="1"
                        width={Math.max(4, (dlPct / 100) * 400)}
                        height="7"
                        rx="3"
                        fill="#38bdf8"
                      />
                      <rect
                        x="0"
                        y="10"
                        width={Math.max(c.submissionCount > 0 ? 4 : 0, (compPct / 100) * 400)}
                        height="7"
                        rx="3"
                        fill="#10b981"
                      />
                    </svg>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* 7-Day Downloads & Completions Trend SVG Chart */}
        <section className="rounded-2xl border border-slate-200/80 bg-white/85 p-5 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/75">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                7-Day Activity Trend
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Daily course downloads &amp; completions
              </p>
            </div>
            <BarChart3 className="h-4 w-4 text-slate-400" />
          </div>

          <div className="mt-5">
            <svg
              viewBox="0 0 350 150"
              className="h-40 w-full"
              role="img"
              aria-label="7-day downloads and completions chart"
            >
              {[0, 0.5, 1].map((tick) => {
                const y = 115 - tick * 95;
                return (
                  <line
                    key={tick}
                    x1="8"
                    y1={y}
                    x2="342"
                    y2={y}
                    stroke="#64748b"
                    strokeOpacity="0.3"
                    strokeDasharray="3 3"
                  />
                );
              })}
              {weeklyTrend.map((day, idx) => {
                const groupX = 16 + idx * 47;
                const dlH = Math.round((day.downloads / maxTrendVal) * 90);
                const cpH = Math.round((day.completions / maxTrendVal) * 90);
                return (
                  <g key={day.label}>
                    <rect
                      x={groupX}
                      y={115 - (day.downloads > 0 ? Math.max(6, dlH) : 3)}
                      width="14"
                      height={day.downloads > 0 ? Math.max(6, dlH) : 3}
                      rx="3"
                      fill={day.downloads > 0 ? '#38bdf8' : '#475569'}
                      fillOpacity={day.downloads > 0 ? 1 : 0.25}
                    />
                    <rect
                      x={groupX + 17}
                      y={115 - (day.completions > 0 ? Math.max(6, cpH) : 3)}
                      width="14"
                      height={day.completions > 0 ? Math.max(6, cpH) : 3}
                      rx="3"
                      fill={day.completions > 0 ? '#10b981' : '#475569'}
                      fillOpacity={day.completions > 0 ? 1 : 0.25}
                    />
                    <text
                      x={groupX + 15}
                      y="134"
                      textAnchor="middle"
                      fontSize="9"
                      fill="#94a3b8"
                    >
                      {day.label.split(' ')[1] || day.label}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Cohort Capacity Split:</span>
              <span className="font-mono-tabular">
                {tierCounts.Accelerated} Accelerated · {tierCounts.Steady} Steady ·{' '}
                {tierCounts.NeedsGuidance} Guided
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Course Statistics Report Table */}
      <section className="rounded-2xl border border-slate-200/80 bg-white/85 p-5 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/75">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Course Performance &amp; Completion Report
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sort by downloads, completions, reading time, or quiz retries to spot curriculum bottlenecks.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label
              htmlFor="course-sort-select"
              className="text-xs font-medium text-slate-600 dark:text-slate-300"
            >
              Sort by:
            </label>
            <select
              id="course-sort-select"
              value={courseSort}
              onChange={(e) => setCourseSort(e.target.value as CourseSortField)}
              className="min-h-[36px] rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="downloadCount">Most Downloaded</option>
              <option value="submissionCount">Most Completed</option>
              <option value="averageScore">Highest Avg Score</option>
              <option value="averageReadingSeconds">Longest Reading Time</option>
              <option value="averageQuizRetries">Highest Quiz Retries</option>
            </select>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="py-2.5 pr-4 font-semibold">Course</th>
                <th className="py-2.5 pr-4 text-right font-semibold">Downloads</th>
                <th className="py-2.5 pr-4 text-right font-semibold">Completed</th>
                <th className="py-2.5 pr-4 text-right font-semibold">Completion %</th>
                <th className="py-2.5 pr-4 text-right font-semibold">Avg Reading</th>
                <th className="py-2.5 pr-4 text-right font-semibold">Avg Retries</th>
                <th className="py-2.5 pr-4 text-right font-semibold">Avg Score</th>
                <th className="py-2.5 font-semibold">Recommended Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedCourses.map((c) => (
                <tr key={c.courseId} className="align-top hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="py-3 pr-4">
                    <p className="font-semibold text-slate-900 dark:text-white">{c.title}</p>
                    <p className="text-slate-500 dark:text-slate-400">{c.category}</p>
                  </td>
                  <td className="font-mono-tabular py-3 pr-4 text-right font-semibold text-slate-900 dark:text-slate-100">
                    {c.downloadCount}
                  </td>
                  <td className="font-mono-tabular py-3 pr-4 text-right font-semibold text-slate-900 dark:text-slate-100">
                    {c.submissionCount}
                  </td>
                  <td className="font-mono-tabular py-3 pr-4 text-right text-slate-700 dark:text-slate-300">
                    {c.completionRatePct}%
                  </td>
                  <td className="font-mono-tabular py-3 pr-4 text-right text-slate-700 dark:text-slate-300">
                    {c.averageReadingSeconds > 0
                      ? formatDurationSeconds(c.averageReadingSeconds)
                      : '—'}
                  </td>
                  <td className="font-mono-tabular py-3 pr-4 text-right text-slate-700 dark:text-slate-300">
                    {c.averageQuizRetries > 0 ? `${c.averageQuizRetries}x` : '—'}
                  </td>
                  <td className="font-mono-tabular py-3 pr-4 text-right font-semibold text-slate-900 dark:text-slate-100">
                    {c.submissionCount > 0 ? `${c.averageScore}%` : '—'}
                  </td>
                  <td className="max-w-xs py-3 text-slate-600 dark:text-slate-300">
                    {c.suggestion}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Individual Learner Progress & Statistics Table */}
      <section className="rounded-2xl border border-slate-200/80 bg-white/85 p-5 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/75">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              <Users className="h-4 w-4 text-blue-700 dark:text-sky-400" />
              <span>Learner Progress, Reading Speed &amp; Capacity</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Inspect any learner to view per-course completion breakdown, earned medals, and coaching suggestions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={learnerQuery}
                onChange={(e) => setLearnerQuery(e.target.value)}
                placeholder="Search learner or topic..."
                aria-label="Search learners"
                className="min-h-[36px] rounded-xl border border-slate-300 bg-white pr-3 pl-8 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              {(['all', 'Accelerated', 'Steady', 'Needs Guidance'] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setCapacityFilter(tier)}
                  className={`min-h-[28px] whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold transition-colors ${
                    capacityFilter === tier
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-950 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  {tier === 'all' ? 'All Tiers' : tier}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          {filteredLearners.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No learner statistics match the current filter.
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="py-2.5 pr-4 font-semibold">Learner</th>
                  <th className="py-2.5 pr-4 text-right font-semibold">Downloads</th>
                  <th className="py-2.5 pr-4 text-right font-semibold">Completed</th>
                  <th className="py-2.5 pr-4 text-right font-semibold">Avg Reading</th>
                  <th className="py-2.5 pr-4 text-right font-semibold">Avg Retries</th>
                  <th className="py-2.5 pr-4 text-right font-semibold">Avg Score</th>
                  <th className="py-2.5 pr-4 font-semibold">Learning Capacity</th>
                  <th className="py-2.5 pr-4 text-right font-semibold">Medals</th>
                  <th className="py-2.5 text-right font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLearners.map((learner) => {
                  const earnedMedals = learner.medals.filter((m) => m.earned).length;
                  const tierColor =
                    learner.learningCapacityTier === 'Accelerated'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : learner.learningCapacityTier === 'Steady'
                      ? 'text-blue-700 dark:text-sky-400'
                      : 'text-amber-700 dark:text-amber-400';
                  return (
                    <tr
                      key={learner.userId}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {learner.name}
                        </p>
                        <p className="text-slate-500 dark:text-slate-400">{learner.email}</p>
                      </td>
                      <td className="font-mono-tabular py-3 pr-4 text-right text-slate-700 dark:text-slate-300">
                        {learner.downloadsCount}
                      </td>
                      <td className="font-mono-tabular py-3 pr-4 text-right font-semibold text-slate-900 dark:text-white">
                        {learner.coursesCompleted}
                      </td>
                      <td className="font-mono-tabular py-3 pr-4 text-right text-slate-700 dark:text-slate-300">
                        {learner.averageReadingSeconds > 0
                          ? formatDurationSeconds(learner.averageReadingSeconds)
                          : '—'}
                      </td>
                      <td className="font-mono-tabular py-3 pr-4 text-right text-slate-700 dark:text-slate-300">
                        {learner.averageQuizRetries > 0 ? `${learner.averageQuizRetries}x` : '—'}
                      </td>
                      <td className="font-mono-tabular py-3 pr-4 text-right font-semibold text-slate-900 dark:text-white">
                        {learner.coursesCompleted > 0 ? `${learner.averageScore}%` : '—'}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`font-semibold ${tierColor}`}>
                          <span className="font-mono-tabular">{learner.learningCapacityScore}/100</span>{' '}
                          · {learner.learningCapacityTier}
                        </span>
                      </td>
                      <td className="font-mono-tabular py-3 pr-4 text-right text-slate-700 dark:text-slate-300">
                        {earnedMedals}/{learner.medals.length}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedLearner(learner);
                            window.setTimeout(() => {
                              document
                                .getElementById('learner-diagnostics-panel')
                                ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            }, 50);
                          }}
                          className="min-h-[32px] whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Selected Learner Drill-Down Panel */}
      {selectedLearner && (
        <section
          id="learner-diagnostics-panel"
          aria-label={`Details for ${selectedLearner.name}`}
          className="rounded-2xl border border-slate-300 bg-white/90 p-6 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/85"
        >
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
            <div>
              <p className="text-xs font-semibold text-blue-700 dark:text-sky-400">
                Individual Learner Diagnostics
              </p>
              <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                {selectedLearner.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedLearner.email} · Weakest topic: {selectedLearner.weakestTopic} · First-try
                accuracy: {selectedLearner.firstAttemptAccuracyPct}%
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedLearner(null)}
              aria-label="Close learner details"
              className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950/70">
              <p className="text-xs text-slate-500 dark:text-slate-400">Learning Capacity</p>
              <p className="font-mono-tabular mt-1 text-lg font-bold text-slate-900 dark:text-white">
                {selectedLearner.learningCapacityScore}/100 ({selectedLearner.learningCapacityTier})
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950/70">
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Reading Time</p>
              <p className="font-mono-tabular mt-1 text-lg font-bold text-slate-900 dark:text-white">
                {formatDurationSeconds(selectedLearner.totalReadingSeconds)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950/70">
              <p className="text-xs text-slate-500 dark:text-slate-400">Avg Quiz Retries</p>
              <p className="font-mono-tabular mt-1 text-lg font-bold text-slate-900 dark:text-white">
                {selectedLearner.averageQuizRetries || 0}x
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950/70">
              <p className="text-xs text-slate-500 dark:text-slate-400">Certificates Earned</p>
              <p className="font-mono-tabular mt-1 text-lg font-bold text-slate-900 dark:text-white">
                {selectedLearner.certificatesEarned}
              </p>
            </div>
          </div>

          <p className="mt-4 rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-3 text-xs text-slate-800 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-100">
            <strong>Coaching Suggestion:</strong> {selectedLearner.suggestion}
          </p>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Course Breakdown</h4>
              {selectedLearner.courseBreakdown.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  No submitted courses yet.
                </p>
              ) : (
                <table className="mt-2 w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      <th className="py-2 pr-3 font-semibold">Course</th>
                      <th className="py-2 pr-3 text-right font-semibold">Read</th>
                      <th className="py-2 pr-3 text-right font-semibold">Retries</th>
                      <th className="py-2 text-right font-semibold">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedLearner.courseBreakdown.map((item, idx) => (
                      <tr key={`${item.courseId}-${idx}`}>
                        <td className="py-2 pr-3 font-medium text-slate-800 dark:text-slate-200">
                          {item.courseTitle}
                        </td>
                        <td className="font-mono-tabular py-2 pr-3 text-right text-slate-600 dark:text-slate-400">
                          {formatDurationSeconds(item.readingDurationSeconds)}
                        </td>
                        <td className="font-mono-tabular py-2 pr-3 text-right text-slate-600 dark:text-slate-400">
                          {item.avgQuizRetries}x
                        </td>
                        <td className="font-mono-tabular py-2 text-right font-bold text-slate-900 dark:text-white">
                          {item.score}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Achievement Medals</h4>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {selectedLearner.medals.map((m) => (
                  <div
                    key={m.id}
                    className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-xs ${
                      m.earned
                        ? 'border-amber-200 bg-amber-50/70 text-slate-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-slate-100'
                        : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-500'
                    }`}
                  >
                    <Medal
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        m.earned
                          ? m.tier === 'gold'
                            ? 'text-amber-600 dark:text-amber-400'
                            : m.tier === 'silver'
                            ? 'text-slate-600 dark:text-slate-300'
                            : 'text-orange-700 dark:text-orange-400'
                          : 'text-slate-300 dark:text-slate-600'
                      }`}
                    />
                    <div>
                      <p className="font-semibold">{m.title}</p>
                      <p className="text-[11px] leading-snug">{m.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Actionable Recommendations Engine */}
      <section className="rounded-2xl border border-slate-200/80 bg-white/85 p-5 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/75">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Actionable Statistics Recommendations
          </h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {suggestions.map((sug) => (
            <div
              key={sug.id}
              className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/60"
            >
              <p className="text-xs font-semibold text-blue-700 dark:text-sky-400">{sug.metric}</p>
              <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{sug.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {sug.recommendation}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
