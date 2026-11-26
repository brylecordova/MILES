import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Film,
  ImageIcon,
  Lock,
  Palette,
  Plus,
  Save,
  Smartphone,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import type {
  AdminAnalyticsReport,
  AppDistributionMode,
  Course,
  CourseModule,
  CourseSubmission,
  LessonBlock,
  LessonModule,
  QuestionType,
  QuizFailureRule,
  QuizModule,
  QuizPassingRule,
  QuizQuestion,
  SystemBranding,
} from '../types/training';
import { api, getAdminToken, setAdminToken, uploadAdminApk } from '../utils/api';
import { getDefaultCertificateDesign } from '../utils/certificateDefaults';
import { AdminAnalyticsDashboard } from './AdminAnalyticsDashboard';
import { CertificateDesigner } from './CertificateDesigner';
import { CourseBannerImage } from './MediaRenderer';

const PRESET_BANNERS = [
  {
    label: 'Industrial Safety',
    url: '/src/assets/images/course_safety_banner_1795694649926.jpg',
  },
  {
    label: 'Clinical Hygiene',
    url: '/src/assets/images/course_clinical_banner_1795694650320.jpg',
  },
  {
    label: 'Cybersecurity Office',
    url: '/src/assets/images/course_security_banner_1795694650637.jpg',
  },
];

function createEmptyCourse(defaultIssuer = 'CertiField Academy'): Omit<Course, '_id' | 'createdAt' | 'updatedAt'> {
  return {
    title: '',
    description: '',
    category: 'Workplace Training',
    bannerUrl: PRESET_BANNERS[0].url,
    certificateTitle: '',
    issuerName: defaultIssuer,
    published: true,
    certificateDesign: getDefaultCertificateDesign(defaultIssuer, 'Certified Training Specialist'),
    modules: [
      {
        id: `lesson-${Date.now()}`,
        kind: 'lesson',
        title: 'Lesson 1: Introduction',
        estimatedMinutes: 5,
        blocks: [
          {
            id: `blk-${Date.now()}-1`,
            type: 'header',
            level: 1,
            text: 'Overview & Learning Objectives',
          },
          {
            id: `blk-${Date.now()}-2`,
            type: 'body',
            text: 'Add **formatted** lesson content here and place videos or images anywhere above or below headers and paragraphs.',
          },
        ],
      },
    ],
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

interface AdminStudioProps {
  systemBranding: SystemBranding;
  onBrandingUpdated: (next: SystemBranding) => void;
  onCoursesMutated: () => Promise<void>;
}

export const AdminStudio: React.FC<AdminStudioProps> = ({
  systemBranding,
  onBrandingUpdated,
  onCoursesMutated,
}) => {
  const [authed, setAuthed] = useState(Boolean(getAdminToken()));
  const [authStatus, setAuthStatus] = useState<{
    configuredViaEnv: boolean;
    hasClaimedPasscode: boolean;
    databaseMode: string;
  } | null>(null);
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [adminTab, setAdminTab] = useState<'analytics' | 'courses' | 'submissions' | 'branding'>('analytics');
  const [courses, setCourses] = useState<Course[]>([]);
  const [submissions, setSubmissions] = useState<CourseSubmission[]>([]);
  const [analyticsReport, setAnalyticsReport] = useState<AdminAnalyticsReport | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [subFilter, setSubFilter] = useState<'all' | 'pending_review' | 'approved' | 'rejected'>('all');
  const [selectedSub, setSelectedSub] = useState<CourseSubmission | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);

  // System Branding & App Distribution State
  const [brandingDraft, setBrandingDraft] = useState<Omit<SystemBranding, 'updatedAt'>>({
    systemName: systemBranding.systemName,
    tagline: systemBranding.tagline,
    iconUrl: systemBranding.iconUrl,
    accentColor: systemBranding.accentColor,
    appDistributionMode: systemBranding.appDistributionMode ?? 'apk_download',
    apkUrl: systemBranding.apkUrl ?? '',
    apkFileName: systemBranding.apkFileName ?? '',
    apkVersion: systemBranding.apkVersion ?? '1.0.0',
    playStoreUrl: systemBranding.playStoreUrl ?? '',
  });
  const [savingBranding, setSavingBranding] = useState(false);
  const [uploadingApk, setUploadingApk] = useState(false);
  const [apkSizeBytes, setApkSizeBytes] = useState<number | null>(null);
  const [brandingError, setBrandingError] = useState<string | null>(null);
  const [brandingSuccess, setBrandingSuccess] = useState<string | null>(null);

  // Course Editor State
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<Course, '_id' | 'createdAt' | 'updatedAt'> | null>(null);
  const [savingCourse, setSavingCourse] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [editorSuccess, setEditorSuccess] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  useEffect(() => {
    setBrandingDraft({
      systemName: systemBranding.systemName,
      tagline: systemBranding.tagline,
      iconUrl: systemBranding.iconUrl,
      accentColor: systemBranding.accentColor,
      appDistributionMode: systemBranding.appDistributionMode ?? 'apk_download',
      apkUrl: systemBranding.apkUrl ?? '',
      apkFileName: systemBranding.apkFileName ?? '',
      apkVersion: systemBranding.apkVersion ?? '1.0.0',
      playStoreUrl: systemBranding.playStoreUrl ?? '',
    });
  }, [systemBranding]);

  useEffect(() => {
    api
      .getAdminAuthStatus()
      .then((status) => setAuthStatus(status))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (authed) {
      refreshAdminData();
    }
  }, [authed]);

  async function refreshAdminData() {
    setAnalyticsLoading(true);
    try {
      const [cRes, sRes, aRes] = await Promise.all([
        api.listCourses(true),
        api.listAllSubmissions(),
        api.getAdminAnalytics(),
      ]);
      setCourses(cRes.courses);
      setSubmissions(sRes.submissions);
      setAnalyticsReport(aRes.report);
    } catch {
      // Token may have expired
    } finally {
      setAnalyticsLoading(false);
    }
  }

  async function handleAdminAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const isFirstRun =
        authStatus && !authStatus.configuredViaEnv && !authStatus.hasClaimedPasscode;
      const res = isFirstRun
        ? await api.claimAdminPasscode(passcode)
        : await api.loginAdmin(passcode);
      setAdminToken(res.token);
      setAuthed(true);
      setPasscode('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleFileUpload(
    file: File,
    uploadKey: string,
    onUrlReady: (url: string) => void
  ) {
    setUploadingKey(uploadKey);
    setEditorError(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await api.uploadMedia(dataUrl);
      onUrlReady(res.url);
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploadingKey(null);
    }
  }

  async function handleSaveCourse(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    if (!draft.title.trim()) {
      setEditorError('Course title is required.');
      return;
    }
    setSavingCourse(true);
    setEditorError(null);
    setEditorSuccess(null);
    try {
      if (editingCourseId) {
        await api.updateCourse(editingCourseId, draft);
      } else {
        const res = await api.createCourse(draft);
        setEditingCourseId(res.course._id);
      }
      await refreshAdminData();
      await onCoursesMutated();
      setEditorSuccess('Course saved to database.');
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : 'Failed to save course.');
    } finally {
      setSavingCourse(false);
    }
  }

  async function handleDeleteCourse(id: string) {
    await api.deleteCourse(id);
    if (editingCourseId === id) {
      setEditingCourseId(null);
      setDraft(null);
    }
    await refreshAdminData();
    await onCoursesMutated();
  }

  async function handleApkFileSelected(file: File) {
    setUploadingApk(true);
    setBrandingError(null);
    setBrandingSuccess(null);
    try {
      const res = await uploadAdminApk(file);
      setApkSizeBytes(res.sizeBytes);
      setBrandingDraft((prev) => ({
        ...prev,
        appDistributionMode: 'apk_download',
        apkUrl: res.url,
        apkFileName: res.fileName,
      }));
      setBrandingSuccess(
        `Uploaded ${res.fileName} (${Math.max(1, Math.round(res.sizeBytes / 1024))} KB). Click Save Settings to publish it on the Download App button.`
      );
    } catch (err) {
      setBrandingError(err instanceof Error ? err.message : 'APK upload failed.');
    } finally {
      setUploadingApk(false);
    }
  }

  async function handleSaveBranding(e: React.FormEvent) {
    e.preventDefault();
    setSavingBranding(true);
    setBrandingError(null);
    setBrandingSuccess(null);
    try {
      const res = await api.updateSystemBranding(brandingDraft);
      onBrandingUpdated(res.branding);
      setBrandingSuccess('System branding and Android Download App settings saved.');
    } catch (err) {
      setBrandingError(err instanceof Error ? err.message : 'Failed to save system branding.');
    } finally {
      setSavingBranding(false);
    }
  }

  async function handleReviewDecision(decision: 'approved' | 'rejected') {
    if (!selectedSub) return;
    setReviewLoading(true);
    try {
      const res = await api.reviewSubmission(selectedSub._id, decision, reviewFeedback);
      setSelectedSub(res.submission);
      setSubmissions((prev) =>
        prev.map((s) => (s._id === res.submission._id ? res.submission : s))
      );
    } finally {
      setReviewLoading(false);
    }
  }

  // ---- Module & Block Helpers ----
  function moveModule(index: number, delta: -1 | 1) {
    if (!draft) return;
    const target = index + delta;
    if (target < 0 || target >= draft.modules.length) return;
    const next = [...draft.modules];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setDraft({ ...draft, modules: next });
  }

  function updateModule(index: number, updated: CourseModule) {
    if (!draft) return;
    const next = [...draft.modules];
    next[index] = updated;
    setDraft({ ...draft, modules: next });
  }

  function removeModule(index: number) {
    if (!draft) return;
    setDraft({
      ...draft,
      modules: draft.modules.filter((_, i) => i !== index),
    });
  }

  function addModule(kind: 'lesson' | 'quiz', insertAfterIndex?: number) {
    if (!draft) return;
    const newMod: CourseModule =
      kind === 'lesson'
        ? {
            id: `lesson-${Date.now()}`,
            kind: 'lesson',
            title: `Lesson ${draft.modules.filter((m) => m.kind === 'lesson').length + 1}`,
            estimatedMinutes: 5,
            blocks: [
              {
                id: `blk-${Date.now()}`,
                type: 'header',
                level: 1,
                text: 'Section Heading',
              },
              {
                id: `blk-${Date.now()}-2`,
                type: 'body',
                text: 'Lesson body text...',
              },
            ],
          }
        : {
            id: `quiz-${Date.now()}`,
            kind: 'quiz',
            title: `Quiz ${draft.modules.filter((m) => m.kind === 'quiz').length + 1}`,
            description: 'Knowledge assessment for preceding lessons.',
            passingScore: 70,
            failureRule: 'retry_quiz',
            passingRule: 'proceed_next',
            questions: [
              {
                id: `q-${Date.now()}`,
                type: 'multiple_choice',
                topicTag: 'Core Concepts',
                prompt: 'Enter your question prompt',
                options: ['Option A', 'Option B', 'Option C'],
                correctIndex: 0,
                explanation: 'Explain why this answer is correct.',
              },
            ],
          };

    const next = [...draft.modules];
    if (typeof insertAfterIndex === 'number') {
      next.splice(insertAfterIndex + 1, 0, newMod);
    } else {
      next.push(newMod);
    }
    setDraft({ ...draft, modules: next });
  }

  function updateLessonBlock(
    modIdx: number,
    lesson: LessonModule,
    blkIdx: number,
    updatedBlock: LessonBlock
  ) {
    const blocks = [...lesson.blocks];
    blocks[blkIdx] = updatedBlock;
    updateModule(modIdx, { ...lesson, blocks });
  }

  function moveLessonBlock(
    modIdx: number,
    lesson: LessonModule,
    blkIdx: number,
    delta: -1 | 1
  ) {
    const target = blkIdx + delta;
    if (target < 0 || target >= lesson.blocks.length) return;
    const blocks = [...lesson.blocks];
    const [blk] = blocks.splice(blkIdx, 1);
    blocks.splice(target, 0, blk);
    updateModule(modIdx, { ...lesson, blocks });
  }

  function addLessonBlock(
    modIdx: number,
    lesson: LessonModule,
    type: LessonBlock['type'],
    insertAtTop = false
  ) {
    const id = `blk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    let newBlock: LessonBlock;
    if (type === 'header') {
      newBlock = { id, type: 'header', level: 2, text: 'New Heading' };
    } else if (type === 'body') {
      newBlock = { id, type: 'body', text: 'Write body text with **bold** or *italic* formatting.' };
    } else if (type === 'bullets') {
      newBlock = { id, type: 'bullets', items: ['First bullet point', 'Second bullet point'] };
    } else if (type === 'image') {
      newBlock = {
        id,
        type: 'image',
        url: '/src/assets/images/lesson_inspection_diagram_1795694651098.jpg',
        caption: 'Lesson illustration',
      };
    } else {
      newBlock = {
        id,
        type: 'video',
        url: '/media/safety-loto-brief.mp4',
        caption: 'Training video briefing',
      };
    }
    const blocks = insertAtTop ? [newBlock, ...lesson.blocks] : [...lesson.blocks, newBlock];
    updateModule(modIdx, { ...lesson, blocks });
  }

  function addQuestionToQuiz(modIdx: number, quiz: QuizModule, type: QuestionType) {
    const id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const base: QuizQuestion =
      type === 'true_false'
        ? {
            id,
            type: 'true_false',
            topicTag: quiz.title,
            prompt: 'True or False statement...',
            correctIndex: 0,
            explanation: 'Explanation shown when reviewed.',
          }
        : type === 'select_all'
        ? {
            id,
            type: 'select_all',
            topicTag: quiz.title,
            prompt: 'Select all correct answers...',
            options: ['Choice A', 'Choice B', 'Choice C', 'Choice D'],
            correctIndices: [0, 1],
            explanation: 'Explanation shown when reviewed.',
          }
        : type === 'essay'
        ? {
            id,
            type: 'essay',
            topicTag: quiz.title,
            prompt: 'Explain the procedure in your own words...',
            essayRubricKeywords: ['safety', 'verify'],
            modelAnswer: 'Describe the verification and safety steps clearly.',
            explanation: 'Model rubric explanation.',
          }
        : {
            id,
            type: 'multiple_choice',
            topicTag: quiz.title,
            prompt: 'Enter multiple choice question...',
            options: ['Option A', 'Option B', 'Option C'],
            correctIndex: 0,
            explanation: 'Explanation shown when reviewed.',
          };

    updateModule(modIdx, { ...quiz, questions: [...quiz.questions, base] });
  }

  // ---- Render Admin Gate if unauthenticated ----
  if (!authed) {
    const isFirstRun =
      authStatus && !authStatus.configuredViaEnv && !authStatus.hasClaimedPasscode;

    return (
      <div className="mx-auto my-8 max-w-md rounded-2xl border border-slate-200 bg-white p-7">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
          <Lock className="h-5 w-5" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">
          {isFirstRun ? 'First-Run Admin Studio Setup' : 'Admin Course Studio Sign In'}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600">
          {isFirstRun
            ? 'No admin passcode is configured yet. Claim your studio passcode to configure courses and review submissions.'
            : 'Enter the administrator passcode to manage courses, lesson media, quizzes, and certificates.'}
        </p>

        <form onSubmit={handleAdminAuthSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="admin-passcode" className="mb-1.5 block text-sm font-medium text-slate-700">
              {isFirstRun ? 'Choose Admin Passcode' : 'Admin Passcode'}
            </label>
            <input
              id="admin-passcode"
              type="password"
              required
              minLength={6}
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Minimum 6 characters"
              className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
            />
          </div>

          {authError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {authError}
            </div>
          )}

          <button
            type="submit"
            disabled={authLoading}
            className="min-h-[48px] w-full rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {authLoading
              ? 'Verifying...'
              : isFirstRun
              ? 'Claim Admin Passcode & Enter'
              : 'Unlock Admin Studio'}
          </button>
        </form>
      </div>
    );
  }

  const pendingCount = submissions.filter((s) => s.status === 'pending_review').length;
  const filteredSubs =
    subFilter === 'all' ? submissions : submissions.filter((s) => s.status === subFilter);

  return (
    <div className="grid gap-6 pb-16 lg:grid-cols-[240px_1fr]">
      {/* Admin Left Sidebar */}
      <aside className="rounded-2xl border border-slate-200 bg-white p-4 lg:sticky lg:top-20 lg:self-start">
        <p className="px-2 text-xs font-semibold text-slate-500">
          {systemBranding.systemName} · /systemadministrator
        </p>
        <nav className="mt-3 flex flex-wrap gap-2 lg:flex-col">
          <button
            type="button"
            onClick={() => {
              setAdminTab('analytics');
              setDraft(null);
              setSelectedSub(null);
            }}
            className={`flex min-h-[44px] flex-1 items-center gap-2.5 rounded-xl px-3 text-sm font-semibold transition-colors ${
              adminTab === 'analytics'
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Analytics</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAdminTab('courses');
              setSelectedSub(null);
            }}
            className={`flex min-h-[44px] flex-1 items-center gap-2.5 rounded-xl px-3 text-sm font-semibold transition-colors ${
              adminTab === 'courses'
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            <span>Courses ({courses.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAdminTab('submissions');
              setDraft(null);
            }}
            className={`flex min-h-[44px] flex-1 items-center justify-between rounded-xl px-3 text-sm font-semibold transition-colors ${
              adminTab === 'submissions'
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <ClipboardList className="h-4 w-4" />
              <span>Submissions</span>
            </span>
            <span className="font-mono-tabular text-xs">{pendingCount}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAdminTab('branding');
              setDraft(null);
              setSelectedSub(null);
              setBrandingError(null);
              setBrandingSuccess(null);
            }}
            className={`flex min-h-[44px] flex-1 items-center gap-2.5 rounded-xl px-3 text-sm font-semibold transition-colors ${
              adminTab === 'branding'
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Palette className="h-4 w-4" />
            <span>Branding &amp; App</span>
          </button>
        </nav>

        <div className="mt-4 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={() => {
              setAdminToken(null);
              setAuthed(false);
            }}
            className="min-h-[40px] w-full rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Lock Admin Studio
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="min-w-0">
        {adminTab === 'analytics' && (
          <AdminAnalyticsDashboard
            report={analyticsReport}
            loading={analyticsLoading}
            onRefresh={refreshAdminData}
            onOpenSubmissions={() => setAdminTab('submissions')}
          />
        )}

        {adminTab === 'courses' && !draft && (
          <div className="space-y-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Course Catalog &amp; Curriculum</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Configure banners, rich lesson blocks with embedded videos/images anywhere, and multi-format quizzes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingCourseId(null);
                  setDraft(createEmptyCourse(`${systemBranding.systemName} Academy`));
                  setEditorError(null);
                  setEditorSuccess(null);
                }}
                className="flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800"
              >
                <Plus className="h-4 w-4" />
                <span>New Course</span>
              </button>
            </div>

            <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {courses.map((course) => {
                const lessons = course.modules.filter((m) => m.kind === 'lesson').length;
                const quizzes = course.modules.filter((m) => m.kind === 'quiz').length;
                return (
                  <div
                    key={course._id}
                    className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"
                  >
                    <div className="flex items-center gap-4">
                      <CourseBannerImage
                        url={course.bannerUrl}
                        title={course.title}
                        className="h-16 w-24 shrink-0 rounded-xl border border-slate-200"
                      />
                      <div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span
                            className={`font-semibold ${
                              course.published ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {course.published ? 'Published' : 'Draft'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{course.category}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">
                            {lessons} {lessons === 1 ? 'lesson' : 'lessons'} / {quizzes}{' '}
                            {quizzes === 1 ? 'quiz' : 'quizzes'}
                          </span>
                        </div>
                        <h2 className="mt-1 text-base font-bold text-slate-900">{course.title}</h2>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const cloned = JSON.parse(JSON.stringify(course)) as Course;
                          if (!cloned.certificateDesign) {
                            cloned.certificateDesign = getDefaultCertificateDesign(
                              cloned.issuerName,
                              cloned.certificateTitle
                            );
                          }
                          setEditingCourseId(course._id);
                          setDraft(cloned);
                          setEditorError(null);
                          setEditorSuccess(null);
                        }}
                        className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        Edit Curriculum &amp; Certificate
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCourse(course._id)}
                        aria-label={`Delete ${course.title}`}
                        className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* COURSE & CURRICULUM BUILDER */}
        {adminTab === 'courses' && draft && (
          <form onSubmit={handleSaveCourse} className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back to Course List
              </button>
              <button
                type="submit"
                disabled={savingCourse}
                className="flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                <span>{savingCourse ? 'Saving...' : 'Save Course'}</span>
              </button>
            </div>

            {editorError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {editorError}
              </div>
            )}
            {editorSuccess && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {editorSuccess}
              </div>
            )}

            {/* Metadata Card */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900">Course Details &amp; Banner</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Course Title
                  </label>
                  <input
                    type="text"
                    required
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder="e.g. Confined Space Entry Certification"
                    className="min-h-[42px] w-full rounded-xl border border-slate-300 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Category
                  </label>
                  <input
                    type="text"
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    className="min-h-[42px] w-full rounded-xl border border-slate-300 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Certificate Title
                  </label>
                  <input
                    type="text"
                    value={draft.certificateTitle}
                    onChange={(e) => setDraft({ ...draft, certificateTitle: e.target.value })}
                    placeholder="Certified Specialist"
                    className="min-h-[42px] w-full rounded-xl border border-slate-300 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Issuing Organization
                  </label>
                  <input
                    type="text"
                    value={draft.issuerName}
                    onChange={(e) => setDraft({ ...draft, issuerName: e.target.value })}
                    className="min-h-[42px] w-full rounded-xl border border-slate-300 px-3 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Course Description
                </label>
                <textarea
                  rows={3}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm"
                />
              </div>

              {/* Banner Selection + Upload */}
              <div className="grid gap-4 sm:grid-cols-[200px_1fr] sm:items-center">
                <CourseBannerImage
                  url={draft.bannerUrl}
                  title={draft.title || 'Course Banner'}
                  className="h-28 w-full rounded-xl border border-slate-200"
                />
                <div className="space-y-2.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Banner Image URL or Upload
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={draft.bannerUrl}
                      onChange={(e) => setDraft({ ...draft, bannerUrl: e.target.value })}
                      className="min-h-[40px] flex-1 rounded-xl border border-slate-300 px-3 text-xs"
                    />
                    <label className="flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                      <Upload className="h-3.5 w-3.5" />
                      <span>{uploadingKey === 'banner' ? 'Uploading...' : 'Upload'}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleFileUpload(file, 'banner', (url) =>
                              setDraft((prev) => (prev ? { ...prev, bannerUrl: url } : prev))
                            );
                          }
                        }}
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_BANNERS.map((p) => (
                      <button
                        key={p.url}
                        type="button"
                        onClick={() => setDraft({ ...draft, bannerUrl: p.url })}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Use {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <label className="inline-flex min-h-[36px] cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
                <input
                  type="checkbox"
                  checked={draft.published}
                  onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
                  className="h-4 w-4 rounded accent-blue-700"
                />
                <span>Published (visible on teaser showcase &amp; Android app)</span>
              </label>
            </section>

            {/* Per-Course Drag-and-Drop Certificate Designer */}
            <CertificateDesigner
              design={
                draft.certificateDesign ??
                getDefaultCertificateDesign(draft.issuerName, draft.certificateTitle)
              }
              courseTitle={draft.title}
              certificateTitle={draft.certificateTitle}
              issuerName={draft.issuerName}
              systemBranding={systemBranding}
              onChange={(nextDesign) => setDraft({ ...draft, certificateDesign: nextDesign })}
              uploadingBg={uploadingKey === 'cert-bg'}
              onUploadBackground={(file, onReady) =>
                handleFileUpload(file, 'cert-bg', onReady)
              }
            />

            {/* Ordered Curriculum Modules */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Curriculum Sequence (Place Lessons &amp; Quizzes Anywhere)
                  </h2>
                  <p className="text-xs text-slate-600">
                    Insert quizzes after any number of lessons, reorder modules, and place images/videos at any position inside lessons.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => addModule('lesson')}
                    className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Lesson</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addModule('quiz')}
                    className="flex min-h-[40px] items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Quiz</span>
                  </button>
                </div>
              </div>

              {draft.modules.map((mod, modIdx) => (
                <div
                  key={mod.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <span className="font-mono-tabular text-xs font-bold text-blue-700">
                      #{modIdx + 1} · {mod.kind === 'lesson' ? 'LESSON' : 'QUIZ CHECKPOINT'}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveModule(modIdx, -1)}
                        disabled={modIdx === 0}
                        aria-label="Move module up"
                        className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveModule(modIdx, 1)}
                        disabled={modIdx === draft.modules.length - 1}
                        aria-label="Move module down"
                        className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeModule(modIdx)}
                        aria-label="Remove module"
                        className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {mod.kind === 'lesson' ? (
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-700">
                            Lesson Title
                          </label>
                          <input
                            type="text"
                            value={mod.title}
                            onChange={(e) =>
                              updateModule(modIdx, { ...mod, title: e.target.value })
                            }
                            className="min-h-[40px] w-full rounded-xl border border-slate-300 px-3 text-sm font-medium"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-700">
                            Est. Minutes
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={mod.estimatedMinutes}
                            onChange={(e) =>
                              updateModule(modIdx, {
                                ...mod,
                                estimatedMinutes: Number(e.target.value) || 5,
                              })
                            }
                            className="font-mono-tabular min-h-[40px] w-full rounded-xl border border-slate-300 px-3 text-sm"
                          />
                        </div>
                      </div>

                      {/* Insert block bar at top */}
                      <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-50 p-2.5">
                        <span className="mr-1 text-xs font-semibold text-slate-500">
                          Add block:
                        </span>
                        {(
                          [
                            ['header', 'Header'],
                            ['body', 'Body Text'],
                            ['bullets', 'Bullets'],
                            ['image', 'Image'],
                            ['video', 'Video'],
                          ] as const
                        ).map(([bType, label]) => (
                          <button
                            key={bType}
                            type="button"
                            onClick={() => addLessonBlock(modIdx, mod, bType, false)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            + {label}
                          </button>
                        ))}
                      </div>

                      {/* Ordered Lesson Blocks */}
                      <div className="space-y-3">
                        {mod.blocks.map((blk, blkIdx) => (
                          <div
                            key={blk.id}
                            className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono-tabular text-xs font-semibold text-slate-600 uppercase">
                                Block {blkIdx + 1}: {blk.type}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={blkIdx === 0}
                                  onClick={() => moveLessonBlock(modIdx, mod, blkIdx, -1)}
                                  className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 disabled:opacity-40"
                                  aria-label="Move block up"
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={blkIdx === mod.blocks.length - 1}
                                  onClick={() => moveLessonBlock(modIdx, mod, blkIdx, 1)}
                                  className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 disabled:opacity-40"
                                  aria-label="Move block down"
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateModule(modIdx, {
                                      ...mod,
                                      blocks: mod.blocks.filter((_, i) => i !== blkIdx),
                                    })
                                  }
                                  className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 hover:text-red-700"
                                  aria-label="Delete block"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            {blk.type === 'header' && (
                              <div className="flex gap-2">
                                <select
                                  value={blk.level}
                                  onChange={(e) =>
                                    updateLessonBlock(modIdx, mod, blkIdx, {
                                      ...blk,
                                      level: Number(e.target.value) as 1 | 2 | 3,
                                    })
                                  }
                                  className="rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold"
                                >
                                  <option value={1}>H1</option>
                                  <option value={2}>H2</option>
                                  <option value={3}>H3</option>
                                </select>
                                <input
                                  type="text"
                                  value={blk.text}
                                  onChange={(e) =>
                                    updateLessonBlock(modIdx, mod, blkIdx, {
                                      ...blk,
                                      text: e.target.value,
                                    })
                                  }
                                  className="min-h-[38px] flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold"
                                />
                              </div>
                            )}

                            {blk.type === 'body' && (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5 text-xs">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateLessonBlock(modIdx, mod, blkIdx, {
                                        ...blk,
                                        text: `${blk.text} **bold text**`,
                                      })
                                    }
                                    className="rounded border border-slate-200 bg-white px-2 py-0.5 font-bold"
                                  >
                                    B
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateLessonBlock(modIdx, mod, blkIdx, {
                                        ...blk,
                                        text: `${blk.text} *italic text*`,
                                      })
                                    }
                                    className="rounded border border-slate-200 bg-white px-2 py-0.5 italic"
                                  >
                                    I
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateLessonBlock(modIdx, mod, blkIdx, {
                                        ...blk,
                                        text: `${blk.text} __underlined__`,
                                      })
                                    }
                                    className="rounded border border-slate-200 bg-white px-2 py-0.5 underline"
                                  >
                                    U
                                  </button>
                                  <span className="text-slate-500">
                                    Supports **bold**, *italic*, __underline__
                                  </span>
                                </div>
                                <textarea
                                  rows={3}
                                  value={blk.text}
                                  onChange={(e) =>
                                    updateLessonBlock(modIdx, mod, blkIdx, {
                                      ...blk,
                                      text: e.target.value,
                                    })
                                  }
                                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm"
                                />
                              </div>
                            )}

                            {blk.type === 'bullets' && (
                              <div className="space-y-2">
                                <textarea
                                  rows={3}
                                  value={blk.items.join('\n')}
                                  onChange={(e) =>
                                    updateLessonBlock(modIdx, mod, blkIdx, {
                                      ...blk,
                                      items: e.target.value.split('\n'),
                                    })
                                  }
                                  placeholder="One bullet point per line..."
                                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm"
                                />
                                <p className="text-xs text-slate-500">One bullet item per line.</p>
                              </div>
                            )}

                            {(blk.type === 'image' || blk.type === 'video') && (
                              <div className="space-y-2">
                                <div className="flex flex-wrap gap-2">
                                  <div className="flex items-center text-slate-500">
                                    {blk.type === 'video' ? (
                                      <Film className="h-4 w-4" />
                                    ) : (
                                      <ImageIcon className="h-4 w-4" />
                                    )}
                                  </div>
                                  <input
                                    type="text"
                                    value={blk.url}
                                    onChange={(e) =>
                                      updateLessonBlock(modIdx, mod, blkIdx, {
                                        ...blk,
                                        url: e.target.value,
                                      })
                                    }
                                    placeholder={
                                      blk.type === 'video'
                                        ? '/media/safety-loto-brief.mp4 or upload'
                                        : '/src/assets/images/... or upload'
                                    }
                                    className="min-h-[38px] flex-1 rounded-lg border border-slate-300 bg-white px-3 text-xs"
                                  />
                                  <label className="flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                                    <Upload className="h-3.5 w-3.5" />
                                    <span>
                                      {uploadingKey === blk.id ? 'Uploading...' : 'Upload'}
                                    </span>
                                    <input
                                      type="file"
                                      accept={
                                        blk.type === 'video'
                                          ? 'video/mp4,video/webm'
                                          : 'image/jpeg,image/png,image/webp'
                                      }
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          handleFileUpload(file, blk.id, (url) =>
                                            updateLessonBlock(modIdx, mod, blkIdx, {
                                              ...blk,
                                              url,
                                            })
                                          );
                                        }
                                      }}
                                    />
                                  </label>
                                </div>
                                <input
                                  type="text"
                                  value={blk.caption ?? ''}
                                  onChange={(e) =>
                                    updateLessonBlock(modIdx, mod, blkIdx, {
                                      ...blk,
                                      caption: e.target.value,
                                    })
                                  }
                                  placeholder="Optional caption..."
                                  className="min-h-[36px] w-full rounded-lg border border-slate-300 bg-white px-3 text-xs"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* QUIZ CONFIGURATION */
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-700">
                            Quiz Title
                          </label>
                          <input
                            type="text"
                            value={mod.title}
                            onChange={(e) =>
                              updateModule(modIdx, { ...mod, title: e.target.value })
                            }
                            className="min-h-[40px] w-full rounded-xl border border-slate-300 px-3 text-sm font-medium"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-700">
                            Passing Score (%)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={mod.passingScore}
                            onChange={(e) =>
                              updateModule(modIdx, {
                                ...mod,
                                passingScore: Math.max(
                                  0,
                                  Math.min(100, Number(e.target.value) || 0)
                                ),
                              })
                            }
                            className="font-mono-tabular min-h-[40px] w-full rounded-xl border border-slate-300 px-3 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-700">
                            Failure Rule
                          </label>
                          <select
                            value={mod.failureRule}
                            onChange={(e) =>
                              updateModule(modIdx, {
                                ...mod,
                                failureRule: e.target.value as QuizFailureRule,
                              })
                            }
                            className="min-h-[40px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
                          >
                            <option value="retry_quiz">Retry this quiz only</option>
                            <option value="restart_since_last_quiz">
                              Restart from last lesson after previous quiz
                            </option>
                            <option value="restart_course">Restart entire course from Lesson 1</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-700">
                            Passing Rule
                          </label>
                          <select
                            value={mod.passingRule}
                            onChange={(e) =>
                              updateModule(modIdx, {
                                ...mod,
                                passingRule: e.target.value as QuizPassingRule,
                              })
                            }
                            className="min-h-[40px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
                          >
                            <option value="proceed_next">Proceed to next module</option>
                            <option value="require_manual_review">
                              Proceed &amp; flag for admin manual review
                            </option>
                          </select>
                        </div>
                      </div>

                      {/* Questions */}
                      <div className="space-y-3">
                        {mod.questions.map((q, qIdx) => (
                          <div
                            key={q.id}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-700">
                                Q{qIdx + 1} · {q.type.replace('_', ' ').toUpperCase()}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateModule(modIdx, {
                                    ...mod,
                                    questions: mod.questions.filter((_, i) => i !== qIdx),
                                  })
                                }
                                className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:text-red-700"
                                aria-label="Delete question"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <input
                              type="text"
                              value={q.prompt}
                              onChange={(e) => {
                                const qs = [...mod.questions];
                                qs[qIdx] = { ...q, prompt: e.target.value };
                                updateModule(modIdx, { ...mod, questions: qs });
                              }}
                              placeholder="Question prompt..."
                              className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium"
                            />

                            {(q.type === 'multiple_choice' || q.type === 'select_all') && (
                              <div className="space-y-2">
                                {(q.options ?? []).map((opt, optIdx) => {
                                  const isChecked =
                                    q.type === 'multiple_choice'
                                      ? q.correctIndex === optIdx
                                      : (q.correctIndices ?? []).includes(optIdx);
                                  return (
                                    <div key={optIdx} className="flex items-center gap-2">
                                      <input
                                        type={q.type === 'multiple_choice' ? 'radio' : 'checkbox'}
                                        name={`admin-q-${q.id}`}
                                        checked={isChecked}
                                        onChange={() => {
                                          const qs = [...mod.questions];
                                          if (q.type === 'multiple_choice') {
                                            qs[qIdx] = { ...q, correctIndex: optIdx };
                                          } else {
                                            const prev = q.correctIndices ?? [];
                                            const next = prev.includes(optIdx)
                                              ? prev.filter((i) => i !== optIdx)
                                              : [...prev, optIdx];
                                            qs[qIdx] = { ...q, correctIndices: next };
                                          }
                                          updateModule(modIdx, { ...mod, questions: qs });
                                        }}
                                        className="h-4 w-4 accent-blue-700"
                                      />
                                      <input
                                        type="text"
                                        value={opt}
                                        onChange={(e) => {
                                          const opts = [...(q.options ?? [])];
                                          opts[optIdx] = e.target.value;
                                          const qs = [...mod.questions];
                                          qs[qIdx] = { ...q, options: opts };
                                          updateModule(modIdx, { ...mod, questions: qs });
                                        }}
                                        className="min-h-[36px] flex-1 rounded-lg border border-slate-300 bg-white px-3 text-xs"
                                      />
                                    </div>
                                  );
                                })}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const qs = [...mod.questions];
                                    qs[qIdx] = {
                                      ...q,
                                      options: [...(q.options ?? []), `Option ${(q.options?.length ?? 0) + 1}`],
                                    };
                                    updateModule(modIdx, { ...mod, questions: qs });
                                  }}
                                  className="text-xs font-semibold text-blue-700 hover:underline"
                                >
                                  + Add option
                                </button>
                              </div>
                            )}

                            {q.type === 'true_false' && (
                              <div className="flex gap-4 text-xs font-medium">
                                {[
                                  { idx: 0, label: 'True is correct' },
                                  { idx: 1, label: 'False is correct' },
                                ].map((choice) => (
                                  <label key={choice.idx} className="flex items-center gap-1.5">
                                    <input
                                      type="radio"
                                      name={`admin-tf-${q.id}`}
                                      checked={(q.correctIndex ?? 0) === choice.idx}
                                      onChange={() => {
                                        const qs = [...mod.questions];
                                        qs[qIdx] = { ...q, correctIndex: choice.idx };
                                        updateModule(modIdx, { ...mod, questions: qs });
                                      }}
                                      className="accent-blue-700"
                                    />
                                    <span>{choice.label}</span>
                                  </label>
                                ))}
                              </div>
                            )}

                            {q.type === 'essay' && (
                              <div className="grid gap-2 sm:grid-cols-2">
                                <input
                                  type="text"
                                  value={(q.essayRubricKeywords ?? []).join(', ')}
                                  onChange={(e) => {
                                    const qs = [...mod.questions];
                                    qs[qIdx] = {
                                      ...q,
                                      essayRubricKeywords: e.target.value
                                        .split(',')
                                        .map((s) => s.trim())
                                        .filter(Boolean),
                                    };
                                    updateModule(modIdx, { ...mod, questions: qs });
                                  }}
                                  placeholder="Rubric keywords (comma-separated)"
                                  className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 text-xs"
                                />
                                <input
                                  type="text"
                                  value={q.modelAnswer ?? ''}
                                  onChange={(e) => {
                                    const qs = [...mod.questions];
                                    qs[qIdx] = { ...q, modelAnswer: e.target.value };
                                    updateModule(modIdx, { ...mod, questions: qs });
                                  }}
                                  placeholder="Model answer shown to learner"
                                  className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 text-xs"
                                />
                              </div>
                            )}

                            <input
                              type="text"
                              value={q.explanation}
                              onChange={(e) => {
                                const qs = [...mod.questions];
                                qs[qIdx] = { ...q, explanation: e.target.value };
                                updateModule(modIdx, { ...mod, questions: qs });
                              }}
                              placeholder="Explanation shown if answered wrong..."
                              className="min-h-[38px] w-full rounded-lg border border-slate-300 bg-white px-3 text-xs"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2.5">
                        <span className="text-xs font-semibold text-slate-600">Add question:</span>
                        {(
                          [
                            ['multiple_choice', 'Multiple Choice'],
                            ['true_false', 'True / False'],
                            ['select_all', 'Select All Correct'],
                            ['essay', 'Essay'],
                          ] as const
                        ).map(([qType, label]) => (
                          <button
                            key={qType}
                            type="button"
                            onClick={() => addQuestionToQuiz(modIdx, mod, qType)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                          >
                            + {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick Insert Module After This Row */}
                  <div className="flex justify-end gap-2 pt-2 text-xs">
                    <button
                      type="button"
                      onClick={() => addModule('lesson', modIdx)}
                      className="text-slate-500 hover:text-blue-700"
                    >
                      + Insert Lesson Below
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => addModule('quiz', modIdx)}
                      className="text-slate-500 hover:text-blue-700"
                    >
                      + Insert Quiz Below
                    </button>
                  </div>
                </div>
              ))}
            </section>
          </form>
        )}

        {/* SUBMISSIONS & REVIEW QUEUE */}
        {adminTab === 'submissions' && !selectedSub && (
          <div className="space-y-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Learner Submissions Queue</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Inspect per-question attempt counts, essay responses, and approve or reject certificates.
                </p>
              </div>
              <div className="inline-flex rounded-xl bg-slate-100 p-1">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'pending_review', label: 'Pending' },
                  { id: 'approved', label: 'Approved' },
                  { id: 'rejected', label: 'Rejected' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSubFilter(f.id as typeof subFilter)}
                    className={`min-h-[36px] rounded-lg px-3 text-xs font-semibold ${
                      subFilter === f.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredSubs.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
                No learner submissions in this status yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {filteredSubs.map((sub) => (
                  <div
                    key={sub._id}
                    className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`font-semibold ${
                            sub.status === 'approved'
                              ? 'text-emerald-700'
                              : sub.status === 'rejected'
                              ? 'text-red-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {sub.status === 'approved'
                            ? 'Approved'
                            : sub.status === 'rejected'
                            ? 'Rejected'
                            : 'Pending Review'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular font-semibold text-slate-900">
                          {sub.overallScore}%
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-slate-500">
                          {new Date(sub.submittedAt).toLocaleString()}
                        </span>
                      </div>
                      <h2 className="mt-1 text-base font-bold text-slate-900">
                        {sub.userName} <span className="font-normal text-slate-500">({sub.userEmail})</span>
                      </h2>
                      <p className="text-xs text-slate-600">{sub.courseTitle}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSub(sub);
                        setReviewFeedback(sub.adminFeedback ?? '');
                      }}
                      className="min-h-[42px] shrink-0 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      Inspect Tries &amp; Grade
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SUBMISSION INSPECTOR WITH QUESTION TRY COUNTS */}
        {adminTab === 'submissions' && selectedSub && (
          <div className="space-y-6">
            <button
              type="button"
              onClick={() => setSelectedSub(null)}
              className="min-h-[42px] rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to Submissions List
            </button>

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedSub.courseTitle}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Learner: <span className="font-semibold text-slate-900">{selectedSub.userName}</span> ({selectedSub.userEmail})
                  </p>
                  {selectedSub.completedOfflineAt && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      Completed offline on {new Date(selectedSub.completedOfflineAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-mono-tabular text-2xl font-bold text-slate-900">
                    {selectedSub.overallScore}%
                  </div>
                  <div className="text-xs font-semibold text-slate-500">
                    Status: {selectedSub.status.replace('_', ' ')}
                  </div>
                </div>
              </div>

              <h3 className="mt-5 text-sm font-bold text-slate-900">
                Per-Question Attempts &amp; Answers
              </h3>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2.5 pr-4 font-semibold">Question</th>
                      <th className="py-2.5 pr-4 font-semibold">Learner Response</th>
                      <th className="py-2.5 pr-4 font-semibold">Result</th>
                      <th className="py-2.5 text-right font-semibold">Tries Taken</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedSub.questionResults.map((qr) => (
                      <tr key={qr.questionId} className="align-top">
                        <td className="py-3 pr-4">
                          <p className="font-semibold text-slate-900">{qr.questionPrompt}</p>
                          <p className="mt-0.5 text-slate-500">
                            {qr.quizTitle} · {qr.questionType.replace('_', ' ')}
                          </p>
                        </td>
                        <td className="py-3 pr-4 text-slate-700">{qr.userAnswerLabel}</td>
                        <td className="py-3 pr-4">
                          {qr.isCorrect ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Correct
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                              <XCircle className="h-3.5 w-3.5" />
                              Wrong
                            </span>
                          )}
                        </td>
                        <td className="font-mono-tabular py-3 text-right font-bold text-slate-900">
                          {qr.tries} {qr.tries === 1 ? 'try' : 'tries'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Admin Review Decision Controls */}
              <div className="mt-6 border-t border-slate-200 pt-5 space-y-3">
                <label className="block text-xs font-semibold text-slate-700">
                  Reviewer Feedback (optional, visible to learner)
                </label>
                <textarea
                  rows={2}
                  value={reviewFeedback}
                  onChange={(e) => setReviewFeedback(e.target.value)}
                  placeholder="Great accuracy on safety procedures..."
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm"
                />
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={reviewLoading}
                    onClick={() => handleReviewDecision('approved')}
                    className="flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Approve &amp; Issue Certificate</span>
                  </button>
                  <button
                    type="button"
                    disabled={reviewLoading}
                    onClick={() => handleReviewDecision('rejected')}
                    className="flex min-h-[44px] items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                  >
                    <XCircle className="h-4 w-4" />
                    <span>Reject Submission</span>
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* SYSTEM BRANDING & ANDROID APP DISTRIBUTION */}
        {adminTab === 'branding' && (
          <form onSubmit={handleSaveBranding} className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Branding &amp; Android App Distribution
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  Configure the platform title, icon, and whether the public Download App buttons serve a direct .apk download or a Google Play Store link.
                </p>
              </div>
              <button
                type="submit"
                disabled={savingBranding || uploadingApk}
                className="flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                <span>{savingBranding ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>

            {brandingError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {brandingError}
              </div>
            )}
            {brandingSuccess && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {brandingSuccess}
              </div>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
              <h2 className="text-base font-bold text-slate-900">System Identity</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="system-name-input"
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    System Name
                  </label>
                  <input
                    id="system-name-input"
                    type="text"
                    required
                    value={brandingDraft.systemName}
                    onChange={(e) =>
                      setBrandingDraft({ ...brandingDraft, systemName: e.target.value })
                    }
                    placeholder="e.g. Apex Field Academy"
                    className="min-h-[42px] w-full rounded-xl border border-slate-300 px-3 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="system-accent-input"
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    Primary Accent Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="system-accent-input"
                      type="color"
                      value={brandingDraft.accentColor}
                      onChange={(e) =>
                        setBrandingDraft({ ...brandingDraft, accentColor: e.target.value })
                      }
                      className="h-[42px] w-14 cursor-pointer rounded-xl border border-slate-300 bg-white p-1"
                    />
                    <input
                      type="text"
                      value={brandingDraft.accentColor}
                      onChange={(e) =>
                        setBrandingDraft({ ...brandingDraft, accentColor: e.target.value })
                      }
                      className="font-mono-tabular min-h-[42px] flex-1 rounded-xl border border-slate-300 px-3 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="system-tagline-input"
                  className="mb-1 block text-xs font-semibold text-slate-700"
                >
                  Landing Page Tagline
                </label>
                <input
                  id="system-tagline-input"
                  type="text"
                  value={brandingDraft.tagline}
                  onChange={(e) =>
                    setBrandingDraft({ ...brandingDraft, tagline: e.target.value })
                  }
                  className="min-h-[42px] w-full rounded-xl border border-slate-300 px-3 text-sm"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-[96px_1fr] sm:items-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  {brandingDraft.iconUrl ? (
                    <img
                      src={brandingDraft.iconUrl}
                      alt={brandingDraft.systemName}
                      className="h-14 w-14 rounded-lg object-contain"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">No Icon</span>
                  )}
                </div>
                <div className="space-y-2.5">
                  <label
                    htmlFor="system-icon-url-input"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    System Icon (URL or Upload PNG/JPG/WebP)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      id="system-icon-url-input"
                      type="text"
                      value={brandingDraft.iconUrl}
                      onChange={(e) =>
                        setBrandingDraft({ ...brandingDraft, iconUrl: e.target.value })
                      }
                      placeholder="/icon.svg"
                      className="min-h-[40px] flex-1 rounded-xl border border-slate-300 px-3 text-xs"
                    />
                    <label className="flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                      <Upload className="h-3.5 w-3.5" />
                      <span>{uploadingKey === 'system-icon' ? 'Uploading...' : 'Upload Icon'}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleFileUpload(file, 'system-icon', (url) =>
                              setBrandingDraft((prev) => ({ ...prev, iconUrl: url }))
                            );
                          }
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setBrandingDraft((prev) => ({ ...prev, iconUrl: '/icon.svg' }))
                      }
                      className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Default Icon
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Android App Distribution Mode & APK Upload */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Android &ldquo;Download App&rdquo; Button Behavior
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  Choose whether the public landing page Download App button downloads the uploaded .apk file directly or opens your Google Play Store listing.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Android app distribution mode">
                {(
                  [
                    {
                      value: 'apk_download' as AppDistributionMode,
                      title: 'Direct .apk Download',
                      desc: 'Downloads the .apk built from GitHub Actions directly onto Android devices.',
                      icon: <Upload className="h-4 w-4" />,
                    },
                    {
                      value: 'play_store' as AppDistributionMode,
                      title: 'Google Play Store Link',
                      desc: 'Redirects learners straight to your Google Play Store listing.',
                      icon: <ExternalLink className="h-4 w-4" />,
                    },
                  ] as const
                ).map((modeOption) => {
                  const selected =
                    (brandingDraft.appDistributionMode ?? 'apk_download') === modeOption.value;
                  return (
                    <button
                      key={modeOption.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() =>
                        setBrandingDraft((prev) => ({
                          ...prev,
                          appDistributionMode: modeOption.value,
                        }))
                      }
                      className={`flex flex-col items-start gap-1.5 rounded-2xl border p-4 text-left transition-colors ${
                        selected
                          ? 'border-blue-700 bg-blue-50/70 ring-1 ring-blue-700'
                          : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                        <span className={selected ? 'text-blue-700' : 'text-slate-500'}>
                          {modeOption.icon}
                        </span>
                        <span>{modeOption.title}</span>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-600">{modeOption.desc}</p>
                    </button>
                  );
                })}
              </div>

              {(brandingDraft.appDistributionMode ?? 'apk_download') === 'apk_download' ? (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Smartphone className="h-4 w-4 text-blue-700" />
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          Upload Android Release (.apk)
                        </p>
                        <p className="text-xs text-slate-600">
                          Build <code className="font-mono-tabular">app-debug.apk</code> via the included{' '}
                          <code className="font-mono-tabular">.github/workflows/android-build.yml</code>{' '}
                          workflow on GitHub Actions, then upload it here.
                        </p>
                      </div>
                    </div>

                    <label className="flex min-h-[42px] cursor-pointer items-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800">
                      <Upload className="h-3.5 w-3.5" />
                      <span>{uploadingApk ? 'Uploading APK...' : 'Upload .apk File'}</span>
                      <input
                        id="admin-apk-upload-input"
                        type="file"
                        accept=".apk,application/vnd.android.package-archive"
                        className="hidden"
                        disabled={uploadingApk}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleApkFileSelected(file);
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>

                  {brandingDraft.apkUrl ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-xs">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900">
                          Active APK: {brandingDraft.apkFileName || 'app-debug.apk'}
                          {apkSizeBytes ? ` · ${Math.max(1, Math.round(apkSizeBytes / 1024))} KB` : ''}
                        </p>
                        <p className="font-mono-tabular mt-0.5 truncate text-slate-500">
                          {brandingDraft.apkUrl}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setApkSizeBytes(null);
                          setBrandingDraft((prev) => ({
                            ...prev,
                            apkUrl: '',
                            apkFileName: '',
                          }));
                        }}
                        className="min-h-[34px] rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 hover:bg-red-100"
                      >
                        Remove APK
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                      No .apk uploaded yet. Upload your .apk file above or paste an external HTTPS download link below.
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="apk-version-input"
                        className="mb-1 block text-xs font-semibold text-slate-700"
                      >
                        App Version Label
                      </label>
                      <input
                        id="apk-version-input"
                        type="text"
                        value={brandingDraft.apkVersion || ''}
                        onChange={(e) =>
                          setBrandingDraft({ ...brandingDraft, apkVersion: e.target.value })
                        }
                        placeholder="1.0.0"
                        className="font-mono-tabular min-h-[40px] w-full rounded-xl border border-slate-300 bg-white px-3 text-xs"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="apk-url-input"
                        className="mb-1 block text-xs font-semibold text-slate-700"
                      >
                        Direct APK URL (auto-filled on upload or GitHub Release URL)
                      </label>
                      <input
                        id="apk-url-input"
                        type="text"
                        value={brandingDraft.apkUrl || ''}
                        onChange={(e) =>
                          setBrandingDraft({ ...brandingDraft, apkUrl: e.target.value })
                        }
                        placeholder="/uploads/... or https://github.com/.../app-debug.apk"
                        className="font-mono-tabular min-h-[40px] w-full rounded-xl border border-slate-300 bg-white px-3 text-xs"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <label
                    htmlFor="play-store-url-input"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Google Play Store App URL
                  </label>
                  <input
                    id="play-store-url-input"
                    type="url"
                    value={brandingDraft.playStoreUrl || ''}
                    onChange={(e) =>
                      setBrandingDraft({ ...brandingDraft, playStoreUrl: e.target.value })
                    }
                    placeholder="https://play.google.com/store/apps/details?id=com.certifield.app"
                    className="min-h-[42px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
                  />
                  <p className="text-xs text-slate-500">
                    When saved, all Download App buttons on the public landing page will link directly to this Google Play Store URL.
                  </p>
                </div>
              )}
            </section>
          </form>
        )}
      </div>
    </div>
  );
};
