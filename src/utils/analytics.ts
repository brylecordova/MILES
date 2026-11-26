import type {
  AdminAnalyticsReport,
  AnalyticsSuggestion,
  CertificateRecord,
  Course,
  CourseAnalyticsSummary,
  CourseDownloadEvent,
  CourseSubmission,
  LearnerAnalyticsSummary,
  MedalBadge,
  UserAccount,
} from '../types/training';

export function formatDurationSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  if (safe < 60) return `${safe}s`;
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  if (mins < 60) {
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
}

export function computeSubmissionAvgRetries(submission: CourseSubmission): number {
  if (submission.quizResults.length > 0) {
    const sum = submission.quizResults.reduce((acc, q) => acc + Math.max(1, q.attempts || 1), 0);
    return Number((sum / submission.quizResults.length).toFixed(2));
  }
  if (submission.questionResults.length > 0) {
    const sum = submission.questionResults.reduce((acc, q) => acc + Math.max(1, q.tries || 1), 0);
    return Number((sum / submission.questionResults.length).toFixed(2));
  }
  return 1;
}

export function estimateReadingSeconds(submission: CourseSubmission, course?: Course): number {
  if (typeof submission.readingDurationSeconds === 'number' && submission.readingDurationSeconds > 0) {
    return Math.round(submission.readingDurationSeconds);
  }
  if (!course) return 240;
  const mins = course.modules
    .filter((m) => m.kind === 'lesson')
    .reduce((acc, m) => acc + (m.estimatedMinutes || 5), 0);
  return Math.max(120, mins * 60);
}

export function computeLearningCapacityScore(params: {
  averageScore: number;
  averageRetries: number;
  completedCount: number;
  downloadsCount: number;
  firstAttemptAccuracyPct: number;
}): { score: number; tier: 'Accelerated' | 'Steady' | 'Needs Guidance' } {
  const { averageScore, averageRetries, completedCount, downloadsCount, firstAttemptAccuracyPct } =
    params;

  if (completedCount === 0 && downloadsCount === 0) {
    return { score: 0, tier: 'Needs Guidance' };
  }

  const completionRatio =
    downloadsCount > 0 ? Math.min(1, completedCount / downloadsCount) : completedCount > 0 ? 1 : 0;
  const retryEfficiency = Math.max(0, Math.min(100, 100 - (Math.max(1, averageRetries) - 1) * 24));
  const weighted =
    averageScore * 0.45 +
    firstAttemptAccuracyPct * 0.25 +
    retryEfficiency * 0.15 +
    completionRatio * 100 * 0.15;

  const score = Math.max(0, Math.min(100, Math.round(weighted)));
  const tier =
    score >= 82 ? 'Accelerated' : score >= 62 ? 'Steady' : 'Needs Guidance';

  return { score, tier };
}

export function computeLearnerMedals(params: {
  downloadsCount: number;
  coursesCompleted: number;
  certificatesEarned: number;
  averageScore: number;
  averageQuizRetries: number;
  averageReadingSeconds: number;
}): MedalBadge[] {
  const {
    downloadsCount,
    coursesCompleted,
    certificatesEarned,
    averageScore,
    averageQuizRetries,
    averageReadingSeconds,
  } = params;

  return [
    {
      id: 'first-steps',
      title: 'First Steps',
      description: 'Complete at least 1 training course assessment.',
      tier: 'bronze',
      earned: coursesCompleted >= 1,
    },
    {
      id: 'field-ready',
      title: 'Field Ready',
      description: 'Download 2 or more courses for offline mobile study.',
      tier: 'bronze',
      earned: downloadsCount >= 2,
    },
    {
      id: 'deep-reader',
      title: 'Deep Reader',
      description: 'Average 5+ minutes of focused lesson reading per course.',
      tier: 'silver',
      earned: coursesCompleted >= 1 && averageReadingSeconds >= 300,
    },
    {
      id: 'sharp-shot',
      title: 'Sharp Shot',
      description: 'Maintain an average of 1.25 quiz attempts or fewer.',
      tier: 'silver',
      earned: coursesCompleted >= 1 && averageQuizRetries <= 1.25,
    },
    {
      id: 'honor-roll',
      title: 'Honor Roll',
      description: 'Maintain 90%+ overall assessment accuracy.',
      tier: 'gold',
      earned: coursesCompleted >= 1 && averageScore >= 90,
    },
    {
      id: 'multi-certified',
      title: 'Multi-Certified',
      description: 'Earn 2 or more approved PDF certificates.',
      tier: 'gold',
      earned: certificatesEarned >= 2,
    },
  ];
}

function buildCourseSuggestion(summary: Omit<CourseAnalyticsSummary, 'suggestion'>): string {
  if (summary.downloadCount >= 2 && summary.completionRatePct < 55) {
    return 'High drop-off after download: split long video lessons into 3-minute checkpoints and add quick pre-quiz summaries.';
  }
  if (summary.averageQuizRetries >= 2.0) {
    return 'Elevated quiz retries: clarify tricky distractors and insert an illustrative diagram right before the failing checkpoint.';
  }
  if (summary.averageReadingSeconds > 0 && summary.averageReadingSeconds < 180 && summary.averageScore < 78) {
    return 'Short reading time paired with lower scores: add bold callout takeaways so learners review key steps before quizzing.';
  }
  if (summary.pendingCount > 0) {
    return `${summary.pendingCount} completed submission${summary.pendingCount === 1 ? '' : 's'} awaiting admin review to unlock certificates.`;
  }
  if (summary.submissionCount === 0) {
    return 'No completions yet: highlight this course at the top of the mobile Available catalog.';
  }
  return 'Strong completion and accuracy balance; keep current lesson pacing and quiz threshold.';
}

function buildLearnerSuggestion(learner: {
  coursesCompleted: number;
  downloadsCount: number;
  averageScore: number;
  averageReadingSeconds: number;
  averageQuizRetries: number;
  learningCapacityTier: 'Accelerated' | 'Steady' | 'Needs Guidance';
  weakestTopic: string;
}): string {
  if (learner.downloadsCount > learner.coursesCompleted && learner.coursesCompleted === 0) {
    return 'Downloaded course materials but has not submitted yet; encourage completing Module 1 checkpoint.';
  }
  if (learner.averageReadingSeconds > 0 && learner.averageReadingSeconds < 210 && learner.averageQuizRetries > 1.5) {
    return 'Rushing through lesson text before quizzes; advise spending at least 4 minutes reviewing diagrams and bullets.';
  }
  if (learner.averageQuizRetries >= 2.0) {
    return `Multiple quiz retries detected, especially on "${learner.weakestTopic}". Assign a quick refresher lesson on that topic.`;
  }
  if (learner.learningCapacityTier === 'Accelerated') {
    return 'Fast comprehension with low retries; ideal candidate for advanced compliance or mentor certification tracks.';
  }
  if (learner.averageScore < 75 && learner.coursesCompleted > 0) {
    return `Focus review on "${learner.weakestTopic}" before attempting upcoming final assessments.`;
  }
  return 'Consistent pacing across modules; on track for timely certificate completion.';
}

export function buildAdminAnalyticsReport(params: {
  courses: Course[];
  users: UserAccount[];
  submissions: CourseSubmission[];
  certificates: CertificateRecord[];
  downloads: CourseDownloadEvent[];
  now?: Date;
}): AdminAnalyticsReport {
  const { courses, users, submissions, certificates, downloads, now = new Date() } = params;
  const courseMap = new Map(courses.map((c) => [c._id, c]));
  const learnersOnly = users.filter((u) => u.role === 'learner');

  // Course summaries
  const courseSummaries: CourseAnalyticsSummary[] = courses.map((course) => {
    const cDownloads = downloads.filter((d) => d.courseId === course._id);
    const cSubs = submissions.filter((s) => s.courseId === course._id);
    const approvedCount = cSubs.filter((s) => s.status === 'approved').length;
    const pendingCount = cSubs.filter((s) => s.status === 'pending_review').length;
    const downloadCount = Math.max(cDownloads.length, cSubs.length);
    const submissionCount = cSubs.length;

    const avgScore =
      submissionCount > 0
        ? Math.round(cSubs.reduce((acc, s) => acc + s.overallScore, 0) / submissionCount)
        : 0;
    const passCount = cSubs.filter((s) => s.passed).length;
    const passRatePct = submissionCount > 0 ? Math.round((passCount / submissionCount) * 100) : 0;
    const completionRatePct =
      downloadCount > 0 ? Math.min(100, Math.round((submissionCount / downloadCount) * 100)) : 0;
    const avgReadingSeconds =
      submissionCount > 0
        ? Math.round(
            cSubs.reduce((acc, s) => acc + estimateReadingSeconds(s, course), 0) / submissionCount
          )
        : 0;
    const avgQuizRetries =
      submissionCount > 0
        ? Number(
            (
              cSubs.reduce((acc, s) => acc + computeSubmissionAvgRetries(s), 0) / submissionCount
            ).toFixed(2)
          )
        : 0;

    const base = {
      courseId: course._id,
      title: course.title,
      category: course.category,
      published: course.published,
      downloadCount,
      submissionCount,
      approvedCount,
      pendingCount,
      completionRatePct,
      passRatePct,
      averageScore: avgScore,
      averageReadingSeconds: avgReadingSeconds,
      averageQuizRetries: avgQuizRetries,
    };

    return {
      ...base,
      suggestion: buildCourseSuggestion(base),
    };
  });

  // Highlights
  const sortedByDownloads = [...courseSummaries].sort(
    (a, b) => b.downloadCount - a.downloadCount || b.submissionCount - a.submissionCount
  );
  const sortedByCompleted = [...courseSummaries].sort(
    (a, b) => b.submissionCount - a.submissionCount || b.approvedCount - a.approvedCount
  );
  const activeCourses = courseSummaries.filter((c) => c.submissionCount > 0);
  const sortedByScore = [...activeCourses].sort((a, b) => b.averageScore - a.averageScore);
  const sortedByRetries = [...activeCourses].sort(
    (a, b) => b.averageQuizRetries - a.averageQuizRetries
  );

  // Per-learner summaries
  const learnerSummaries: LearnerAnalyticsSummary[] = learnersOnly.map((user) => {
    const uSubs = submissions
      .filter((s) => s.userId === user._id)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    const uCerts = certificates.filter((c) => c.userId === user._id);
    const uDownloads = downloads.filter((d) => d.userId === user._id);
    const uniqueDownloadedIds = new Set([
      ...uDownloads.map((d) => d.courseId),
      ...uSubs.map((s) => s.courseId),
    ]);

    const downloadsCount = uniqueDownloadedIds.size;
    const coursesCompleted = uSubs.length;
    const certificatesEarned = uCerts.length;

    const averageScore =
      coursesCompleted > 0
        ? Math.round(uSubs.reduce((acc, s) => acc + s.overallScore, 0) / coursesCompleted)
        : 0;

    const totalReadingSeconds = uSubs.reduce(
      (acc, s) => acc + estimateReadingSeconds(s, courseMap.get(s.courseId)),
      0
    );
    const averageReadingSeconds =
      coursesCompleted > 0 ? Math.round(totalReadingSeconds / coursesCompleted) : 0;

    const averageQuizRetries =
      coursesCompleted > 0
        ? Number(
            (
              uSubs.reduce((acc, s) => acc + computeSubmissionAvgRetries(s), 0) / coursesCompleted
            ).toFixed(2)
          )
        : 0;

    const allQuestions = uSubs.flatMap((s) => s.questionResults);
    const firstTryCorrect = allQuestions.filter((q) => q.isCorrect && (q.tries || 1) === 1).length;
    const firstAttemptAccuracyPct =
      allQuestions.length > 0 ? Math.round((firstTryCorrect / allQuestions.length) * 100) : 0;

    const topicMissCounts = new Map<string, number>();
    allQuestions.forEach((q) => {
      if (!q.isCorrect || (q.tries || 1) > 1) {
        const tag = q.topicTag || 'Core Concepts';
        topicMissCounts.set(tag, (topicMissCounts.get(tag) || 0) + Math.max(1, q.tries || 1));
      }
    });
    const weakestTopic =
      [...topicMissCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'None flagged';

    const capacity = computeLearningCapacityScore({
      averageScore,
      averageRetries: averageQuizRetries || 1,
      completedCount: coursesCompleted,
      downloadsCount,
      firstAttemptAccuracyPct,
    });

    const medals = computeLearnerMedals({
      downloadsCount,
      coursesCompleted,
      certificatesEarned,
      averageScore,
      averageQuizRetries: averageQuizRetries || 1,
      averageReadingSeconds,
    });

    const lastActiveAt =
      uSubs[0]?.submittedAt ||
      uDownloads[uDownloads.length - 1]?.downloadedAt ||
      user.createdAt;

    return {
      userId: user._id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      downloadsCount,
      coursesCompleted,
      certificatesEarned,
      averageScore,
      averageReadingSeconds,
      totalReadingSeconds,
      averageQuizRetries,
      firstAttemptAccuracyPct,
      learningCapacityScore: capacity.score,
      learningCapacityTier: capacity.tier,
      weakestTopic,
      medals,
      lastActiveAt,
      suggestion: buildLearnerSuggestion({
        coursesCompleted,
        downloadsCount,
        averageScore,
        averageReadingSeconds,
        averageQuizRetries,
        learningCapacityTier: capacity.tier,
        weakestTopic,
      }),
      courseBreakdown: uSubs.map((s) => ({
        courseId: s.courseId,
        courseTitle: s.courseTitle,
        score: s.overallScore,
        readingDurationSeconds: estimateReadingSeconds(s, courseMap.get(s.courseId)),
        avgQuizRetries: computeSubmissionAvgRetries(s),
        status: s.status,
        submittedAt: s.submittedAt,
      })),
    };
  });

  // Sort learners by learning capacity descending, then completions
  learnerSummaries.sort(
    (a, b) =>
      b.learningCapacityScore - a.learningCapacityScore ||
      b.coursesCompleted - a.coursesCompleted
  );

  // Overview KPIs
  const totalSubmissions = submissions.length;
  const approvedSubmissions = submissions.filter((s) => s.status === 'approved').length;
  const pendingReviews = submissions.filter((s) => s.status === 'pending_review').length;
  const activeLearners = learnerSummaries.filter(
    (l) => l.downloadsCount > 0 || l.coursesCompleted > 0
  ).length;
  const passRatePct =
    totalSubmissions > 0
      ? Math.round((submissions.filter((s) => s.passed).length / totalSubmissions) * 100)
      : 0;
  const averageScore =
    totalSubmissions > 0
      ? Math.round(submissions.reduce((acc, s) => acc + s.overallScore, 0) / totalSubmissions)
      : 0;
  const averageReadingSeconds =
    totalSubmissions > 0
      ? Math.round(
          submissions.reduce(
            (acc, s) => acc + estimateReadingSeconds(s, courseMap.get(s.courseId)),
            0
          ) / totalSubmissions
        )
      : 0;
  const averageQuizRetries =
    totalSubmissions > 0
      ? Number(
          (
            submissions.reduce((acc, s) => acc + computeSubmissionAvgRetries(s), 0) /
            totalSubmissions
          ).toFixed(2)
        )
      : 0;

  const capacityLearners = learnerSummaries.filter(
    (l) => l.coursesCompleted > 0 || l.downloadsCount > 0
  );
  const averageLearningCapacity =
    capacityLearners.length > 0
      ? Math.round(
          capacityLearners.reduce((acc, l) => acc + l.learningCapacityScore, 0) /
            capacityLearners.length
        )
      : 0;

  // Weekly 7-day trend
  const weeklyTrend: Array<{ label: string; downloads: number; completions: number }> = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(now);
    day.setUTCHours(0, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() - offset);
    const dayKey = day.toISOString().slice(0, 10);
    const label = day.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    const dCount = downloads.filter((d) => d.downloadedAt.slice(0, 10) === dayKey).length;
    const cCount = submissions.filter((s) => s.submittedAt.slice(0, 10) === dayKey).length;
    weeklyTrend.push({ label, downloads: dCount, completions: cCount });
  }

  // Actionable Suggestions across KPIs
  const suggestions: AnalyticsSuggestion[] = [];
  if (pendingReviews > 0) {
    suggestions.push({
      id: 'pending-reviews',
      metric: 'Pending Reviews',
      severity: 'attention',
      title: `${pendingReviews} learner submission${pendingReviews === 1 ? '' : 's'} waiting for approval`,
      recommendation:
        'Review open essay responses and issue certificates in the Submissions tab to maintain learner momentum.',
    });
  }
  if (averageQuizRetries >= 1.7) {
    const hardest = sortedByRetries[0];
    suggestions.push({
      id: 'high-retries',
      metric: 'Quiz Retries',
      severity: 'attention',
      title: `Average quiz retries reached ${averageQuizRetries}x${hardest ? ` (highest in ${hardest.title})` : ''}`,
      recommendation:
        'Add a short recap bullet block or diagram directly before quizzes with 2+ retries to reduce repeat attempts.',
    });
  } else {
    suggestions.push({
      id: 'healthy-retries',
      metric: 'Quiz Retries',
      severity: 'positive',
      title: `First-pass efficiency is healthy (${averageQuizRetries || 1}x avg retries)`,
      recommendation:
        'Consider adding optional advanced scenario essay questions on top-performing courses.',
    });
  }

  if (averageReadingSeconds > 0 && averageReadingSeconds < 240) {
    suggestions.push({
      id: 'reading-pace',
      metric: 'Average Reading Time',
      severity: 'opportunity',
      title: `Learners average ${formatDurationSeconds(averageReadingSeconds)} reading per course`,
      recommendation:
        'Embed concise visual diagrams or 90-second MP4 walkthroughs mid-lesson to deepen retention before checkpoints.',
    });
  } else if (averageReadingSeconds >= 240) {
    suggestions.push({
      id: 'reading-strong',
      metric: 'Average Reading Time',
      severity: 'positive',
      title: `Strong engagement at ${formatDurationSeconds(averageReadingSeconds)} average reading time`,
      recommendation:
        'Pair longer lessons with quick 2-question checkpoints so learners lock in concepts while reading.',
    });
  }

  const mostDownloaded = sortedByDownloads[0];
  if (mostDownloaded && mostDownloaded.downloadCount > 0 && mostDownloaded.completionRatePct < 70) {
    suggestions.push({
      id: 'download-conversion',
      metric: 'Download-to-Completion',
      severity: 'opportunity',
      title: `${mostDownloaded.title} leads downloads (${mostDownloaded.downloadCount}) at ${mostDownloaded.completionRatePct}% completion`,
      recommendation:
        'Promote offline quick-resume reminders in the app so field learners finish remaining modules after downloading.',
    });
  }

  const guidanceLearners = learnerSummaries.filter(
    (l) => l.learningCapacityTier === 'Needs Guidance' && (l.downloadsCount > 0 || l.coursesCompleted > 0)
  );
  if (guidanceLearners.length > 0) {
    suggestions.push({
      id: 'learner-coaching',
      metric: 'Learning Capacity',
      severity: 'attention',
      title: `${guidanceLearners.length} learner${guidanceLearners.length === 1 ? '' : 's'} flagged for guided review`,
      recommendation: `Prioritize 1-on-1 feedback on weak topics (e.g. ${guidanceLearners[0].weakestTopic}) when reviewing submissions.`,
    });
  }

  return {
    overview: {
      totalLearners: learnersOnly.length,
      activeLearners,
      totalDownloads: courseSummaries.reduce((acc, c) => acc + c.downloadCount, 0),
      totalSubmissions,
      approvedSubmissions,
      pendingReviews,
      totalCertificates: certificates.length,
      passRatePct,
      averageScore,
      averageReadingSeconds,
      averageQuizRetries,
      averageLearningCapacity,
    },
    highlights: {
      mostDownloadedCourse: sortedByDownloads[0] ?? null,
      mostCompletedCourse: sortedByCompleted[0] ?? null,
      highestScoreCourse: sortedByScore[0] ?? null,
      highestRetryCourse: sortedByRetries[0] ?? null,
    },
    courses: courseSummaries,
    learners: learnerSummaries,
    weeklyTrend,
    suggestions,
  };
}
