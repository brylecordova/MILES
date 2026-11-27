export type LessonBlockType = 'header' | 'body' | 'bullets' | 'image' | 'video';

export interface LessonHeaderBlock {
  id: string;
  type: 'header';
  level: 1 | 2 | 3;
  text: string;
}

export interface LessonBodyBlock {
  id: string;
  type: 'body';
  text: string;
  align?: 'left' | 'center';
}

export interface LessonBulletsBlock {
  id: string;
  type: 'bullets';
  items: string[];
}

export interface LessonMediaBlock {
  id: string;
  type: 'image' | 'video';
  url: string;
  caption?: string;
}

export type LessonBlock =
  | LessonHeaderBlock
  | LessonBodyBlock
  | LessonBulletsBlock
  | LessonMediaBlock;

export type QuestionType = 'multiple_choice' | 'true_false' | 'select_all' | 'essay';

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  topicTag?: string;
  options?: string[];
  correctIndex?: number;
  correctIndices?: number[];
  modelAnswer?: string;
  essayRubricKeywords?: string[];
  explanation: string;
}

export type QuizFailureRule = 'retry_quiz' | 'restart_since_last_quiz' | 'restart_course';
export type QuizPassingRule = 'proceed_next' | 'require_manual_review';

export interface LessonModule {
  id: string;
  kind: 'lesson';
  title: string;
  estimatedMinutes: number;
  blocks: LessonBlock[];
}

export interface QuizModule {
  id: string;
  kind: 'quiz';
  title: string;
  description: string;
  passingScore: number;
  failureRule: QuizFailureRule;
  passingRule: QuizPassingRule;
  questions: QuizQuestion[];
}

export type CourseModule = LessonModule | QuizModule;

export type CertificateElementKind =
  | 'system_icon'
  | 'issuer_name'
  | 'heading'
  | 'subtitle'
  | 'learner_name'
  | 'completion_text'
  | 'certificate_title'
  | 'course_title'
  | 'score'
  | 'issue_date'
  | 'certificate_code'
  | 'signature_label'
  | 'custom_text';

export interface CertificateElement {
  id: string;
  kind: CertificateElementKind;
  label: string;
  text: string;
  xPct: number;
  yPct: number;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontFamily: 'sans' | 'serif' | 'mono';
  color: string;
  align: 'left' | 'center' | 'right';
  visible: boolean;
}

export interface CertificateDesign {
  canvasBackground: string;
  backgroundImageUrl?: string;
  borderColor: string;
  accentColor: string;
  showBorder: boolean;
  elements: CertificateElement[];
}

export type AppDistributionMode = 'apk_download' | 'play_store';

export interface SystemBranding {
  systemName: string;
  tagline: string;
  iconUrl: string;
  accentColor: string;
  appDistributionMode?: AppDistributionMode;
  apkUrl?: string;
  apkFileName?: string;
  apkVersion?: string;
  playStoreUrl?: string;
  updatedAt: string;
}

export interface CourseRatingEntry {
  userId: string;
  rating: number;
  updatedAt: string;
}

export interface Course {
  _id: string;
  title: string;
  description: string;
  category: string;
  bannerUrl: string;
  certificateTitle: string;
  issuerName: string;
  published: boolean;
  modules: CourseModule[];
  certificateDesign?: CertificateDesign;
  averageRating?: number;
  ratingCount?: number;
  userRating?: number;
  ratings?: CourseRatingEntry[];
  createdAt: string;
  updatedAt: string;
}

export type QuizAnswerValue = number | number[] | string | null;

export interface QuestionAttemptRecord {
  questionId: string;
  quizId: string;
  quizTitle: string;
  questionPrompt: string;
  questionType: QuestionType;
  topicTag: string;
  tries: number;
  userAnswer: QuizAnswerValue;
  userAnswerLabel: string;
  correctAnswerLabel: string;
  isCorrect: boolean;
  needsManualReview?: boolean;
  explanation: string;
}

export interface QuizAttemptSummary {
  quizId: string;
  quizTitle: string;
  score: number;
  passingScore: number;
  passed: boolean;
  attempts: number;
}

export type SubmissionStatus = 'pending_review' | 'approved' | 'rejected';

export interface CourseSubmission {
  _id: string;
  courseId: string;
  courseTitle: string;
  certificateTitle: string;
  issuerName: string;
  userId: string;
  userName: string;
  userEmail: string;
  overallScore: number;
  passed: boolean;
  completed?: boolean;
  status: SubmissionStatus;
  allowRetry?: boolean;
  adminFeedback?: string;
  reviewedAt?: string;
  submittedAt: string;
  completedOfflineAt?: string;
  readingDurationSeconds?: number;
  questionResults: QuestionAttemptRecord[];
  quizResults: QuizAttemptSummary[];
  certificateId?: string;
}

export interface CertificateRecord {
  _id: string;
  certificateCode: string;
  submissionId: string;
  courseId: string;
  courseTitle: string;
  certificateTitle: string;
  issuerName: string;
  userId: string;
  userName: string;
  userEmail: string;
  score: number;
  issuedAt: string;
  emailedCount: number;
  lastEmailedAt?: string;
  certificateDesign?: CertificateDesign;
  systemIconUrl?: string;
}

export interface VerifiedCertificatePublic {
  certificateCode: string;
  userName: string;
  courseTitle: string;
  certificateTitle: string;
  issuerName: string;
  score: number;
  issuedAt: string;
  certificateDesign?: CertificateDesign;
  systemIconUrl?: string;
}

export interface UserAccount {
  _id: string;
  name: string;
  email: string;
  role: 'learner' | 'admin';
  createdAt: string;
}

export interface CourseProgressState {
  courseId: string;
  currentModuleIndex: number;
  completedModuleIds: string[];
  questionTries: Record<string, number>;
  quizAttempts: Record<string, number>;
  latestAnswers: Record<string, QuizAnswerValue>;
  latestQuestionResults: Record<string, QuestionAttemptRecord>;
  quizResults: Record<string, QuizAttemptSummary>;
  readingDurationSeconds?: number;
  status: 'not_started' | 'in_progress' | 'completed';
  startedAt?: string;
  updatedAt: string;
}

export interface PendingOfflineSubmission {
  id: string;
  courseId: string;
  courseTitle: string;
  certificateTitle: string;
  issuerName: string;
  userId: string;
  userName: string;
  userEmail: string;
  overallScore: number;
  passed: boolean;
  completedOfflineAt: string;
  readingDurationSeconds?: number;
  questionResults: QuestionAttemptRecord[];
  quizResults: QuizAttemptSummary[];
}

export interface CourseDownloadEvent {
  _id: string;
  courseId: string;
  userId?: string;
  downloadedAt: string;
}

export interface MedalBadge {
  id: string;
  title: string;
  description: string;
  tier: 'gold' | 'silver' | 'bronze';
  earned: boolean;
}

export interface CourseAnalyticsSummary {
  courseId: string;
  title: string;
  category: string;
  published: boolean;
  downloadCount: number;
  submissionCount: number;
  approvedCount: number;
  pendingCount: number;
  completionRatePct: number;
  passRatePct: number;
  averageScore: number;
  averageReadingSeconds: number;
  averageQuizRetries: number;
  suggestion: string;
}

export interface LearnerAnalyticsSummary {
  userId: string;
  name: string;
  email: string;
  createdAt: string;
  downloadsCount: number;
  coursesCompleted: number;
  certificatesEarned: number;
  averageScore: number;
  averageReadingSeconds: number;
  totalReadingSeconds: number;
  averageQuizRetries: number;
  firstAttemptAccuracyPct: number;
  learningCapacityScore: number;
  learningCapacityTier: 'Accelerated' | 'Steady' | 'Needs Guidance';
  weakestTopic: string;
  medals: MedalBadge[];
  lastActiveAt: string;
  suggestion: string;
  courseBreakdown: Array<{
    courseId: string;
    courseTitle: string;
    score: number;
    readingDurationSeconds: number;
    avgQuizRetries: number;
    status: SubmissionStatus;
    submittedAt: string;
  }>;
}

export interface AnalyticsSuggestion {
  id: string;
  metric: string;
  severity: 'attention' | 'opportunity' | 'positive';
  title: string;
  recommendation: string;
}

export interface AdminAnalyticsReport {
  overview: {
    totalLearners: number;
    activeLearners: number;
    totalDownloads: number;
    totalSubmissions: number;
    approvedSubmissions: number;
    pendingReviews: number;
    totalCertificates: number;
    passRatePct: number;
    averageScore: number;
    averageReadingSeconds: number;
    averageQuizRetries: number;
    averageLearningCapacity: number;
  };
  highlights: {
    mostDownloadedCourse: CourseAnalyticsSummary | null;
    mostCompletedCourse: CourseAnalyticsSummary | null;
    highestScoreCourse: CourseAnalyticsSummary | null;
    highestRetryCourse: CourseAnalyticsSummary | null;
  };
  courses: CourseAnalyticsSummary[];
  learners: LearnerAnalyticsSummary[];
  weeklyTrend: Array<{
    label: string;
    downloads: number;
    completions: number;
  }>;
  suggestions: AnalyticsSuggestion[];
}
