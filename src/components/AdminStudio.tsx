import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Download,
  ExternalLink,
  Film,
  ImageIcon,
  Lock,
  Palette,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import type {
  AdminAnalyticsReport,
  AppDistributionMode,
  CertificateRecord,
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
import {
  api,
  downloadAndroidProjectZip,
  getAdminToken,
  setAdminToken,
  uploadAdminApk,
} from '../utils/api';
import {
  ADMIN_NAV_CLUSTERS,
  type AdminTabId,
} from '../utils/adminNav';
import {
  DEFAULT_SYSTEM_ICON_URL,
  getDefaultCertificateDesign,
} from '../utils/certificateDefaults';
import {
  mergeIncomingSubmission,
  reconcileFetchedSubmissions,
} from '../utils/realtimeSubmissions';
import { AdminAnalyticsDashboard } from './AdminAnalyticsDashboard';
import { AndroidIcon } from './AndroidIcon';
import { CertificateDesigner } from './CertificateDesigner';
import { CertificateModal } from './CertificateModal';
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

function createEmptyCourse(defaultIssuer = 'MiLES Academy'): Omit<Course, '_id' | 'createdAt' | 'updatedAt'> {
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

const inputCls =
  'min-h-[42px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-400';
const cardCls =
  'rounded-2xl border border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/75';
const labelCls = 'mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200';

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
    adminName?: string;
  } | null>(null);
  const [passcode, setPasscode] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminNameInput, setAdminNameInput] = useState('');
  const [adminNameDraft, setAdminNameDraft] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [adminTab, setAdminTab] = useState<AdminTabId>('analytics');
  const [courses, setCourses] = useState<Course[]>([]);
  const [submissions, setSubmissions] = useState<CourseSubmission[]>([]);
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [viewingCertificate, setViewingCertificate] = useState<CertificateRecord | null>(null);
  const [loadingCertSubId, setLoadingCertSubId] = useState<string | null>(null);
  const [analyticsReport, setAnalyticsReport] = useState<AdminAnalyticsReport | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [subFilter, setSubFilter] = useState<'all' | 'pending_review' | 'approved' | 'rejected'>('all');
  const [selectedSub, setSelectedSub] = useState<CourseSubmission | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [pendingReviewDecision, setPendingReviewDecision] = useState<'approved' | 'rejected' | null>(
    null
  );
  const [rejectAllowRetry, setRejectAllowRetry] = useState(true);
  const [reviewResultBanner, setReviewResultBanner] = useState<{
    type: 'approved' | 'rejected' | 'error';
    message: string;
    certificateCode?: string;
  } | null>(null);
  const [confirmDeleteCourseId, setConfirmDeleteCourseId] = useState<string | null>(null);
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);
  const [adminNotice, setAdminNotice] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
    certificateCode?: string;
  } | null>(null);
  const [realtimeToast, setRealtimeToast] = useState<{
    id: string;
    submission: CourseSubmission;
    unreadCount: number;
  } | null>(null);
  const [recentArrivalIds, setRecentArrivalIds] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const knownSubmissionIdsRef = useRef<Set<string>>(new Set());
  const hasLoadedSubmissionsRef = useRef(false);
  const syncInFlightRef = useRef(false);

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
  const [downloadingSourceZip, setDownloadingSourceZip] = useState(false);
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
      .then((status) => {
        setAuthStatus(status);
        if (status.adminName) {
          setAdminName(status.adminName);
          setAdminNameInput((prev) => prev || status.adminName || '');
          setAdminNameDraft((prev) => prev || status.adminName || '');
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (authed) {
      refreshAdminData();
    }
  }, [authed]);

  useEffect(() => {
    if (!realtimeToast) return;
    const timer = window.setTimeout(() => {
      setRealtimeToast((prev) => (prev?.id === realtimeToast.id ? null : prev));
    }, 14000);
    return () => window.clearTimeout(timer);
  }, [realtimeToast]);

  const notifyNewSubmissions = (newSubs: CourseSubmission[]) => {
    if (newSubs.length === 0) return;
    const latest = newSubs[0];
    setRecentArrivalIds((prev) => {
      const next = [...newSubs.map((s) => s._id), ...prev];
      return Array.from(new Set(next)).slice(0, 20);
    });
    setRealtimeToast((prev) => ({
      id: `${latest._id}-${Date.now()}`,
      submission: latest,
      unreadCount: (prev?.unreadCount ?? 0) + newSubs.length,
    }));
    api
      .getAdminAnalytics()
      .then((res) => setAnalyticsReport(res.report))
      .catch(() => {});
    api
      .listAdminCertificates()
      .then((res) => setCertificates(res.certificates))
      .catch(() => {});
  };

  const handleIncomingSubmissionEvent = (
    eventType: 'submission:created' | 'submission:updated',
    submission: CourseSubmission
  ) => {
    if (eventType === 'submission:created') {
      const isBrandNew = !knownSubmissionIdsRef.current.has(submission._id);
      knownSubmissionIdsRef.current.add(submission._id);
      hasLoadedSubmissionsRef.current = true;
      setSubmissions((prev) => mergeIncomingSubmission(prev, submission).next);
      if (isBrandNew) {
        notifyNewSubmissions([submission]);
      }
      return;
    }

    knownSubmissionIdsRef.current.add(submission._id);
    setSubmissions((prev) => mergeIncomingSubmission(prev, submission).next);
    setSelectedSub((prev) => (prev && prev._id === submission._id ? submission : prev));
    api
      .getAdminAnalytics()
      .then((res) => setAnalyticsReport(res.report))
      .catch(() => {});
    api
      .listAdminCertificates()
      .then((res) => setCertificates(res.certificates))
      .catch(() => {});
  };

  const syncSubmissionsSilently = async () => {
    if (syncInFlightRef.current || !getAdminToken()) return;
    syncInFlightRef.current = true;
    try {
      const sRes = await api.listAllSubmissions();
      const wasLoaded = hasLoadedSubmissionsRef.current;
      const { next, newlyDetected } = reconcileFetchedSubmissions(
        sRes.submissions,
        knownSubmissionIdsRef.current,
        wasLoaded
      );
      hasLoadedSubmissionsRef.current = true;
      setSubmissions(next);
      setSelectedSub((prev) =>
        prev ? next.find((s) => s._id === prev._id) ?? prev : prev
      );
      if (newlyDetected.length > 0) {
        notifyNewSubmissions(newlyDetected);
      }
    } catch {
      // Ignore transient network errors during background sync
    } finally {
      syncInFlightRef.current = false;
    }
  };

  useEffect(() => {
    if (!authed) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      knownSubmissionIdsRef.current.clear();
      hasLoadedSubmissionsRef.current = false;
      setRealtimeToast(null);
      setRecentArrivalIds([]);
      return;
    }

    let disposed = false;
    let wsReconnectTimer: number | null = null;
    let sseReconnectTimer: number | null = null;
    let wsRetryDelayMs = 1500;
    let sseRetryDelayMs = 1500;

    const handleRawEvent = (raw: string) => {
      try {
        const msg = JSON.parse(raw || '{}') as {
          type?: string;
          submission?: CourseSubmission;
        };
        if (
          (msg.type === 'submission:created' || msg.type === 'submission:updated') &&
          msg.submission
        ) {
          handleIncomingSubmissionEvent(msg.type, msg.submission);
        }
      } catch {
        // Ignore malformed event payloads
      }
    };

    const connectSse = () => {
      if (disposed || typeof EventSource === 'undefined') return;
      const token = getAdminToken();
      if (!token) return;

      const sse = new EventSource(
        `/api/admin/events?token=${encodeURIComponent(token)}`
      );
      sseRef.current = sse;

      sse.addEventListener('connected', () => {
        sseRetryDelayMs = 1500;
        void syncSubmissionsSilently();
      });

      sse.addEventListener('submission:created', (event) => {
        handleRawEvent(String((event as MessageEvent).data || '{}'));
      });

      sse.addEventListener('submission:updated', (event) => {
        handleRawEvent(String((event as MessageEvent).data || '{}'));
      });

      sse.onerror = () => {
        sse.close();
        if (sseRef.current === sse) {
          sseRef.current = null;
        }
        if (!disposed && getAdminToken()) {
          sseReconnectTimer = window.setTimeout(connectSse, sseRetryDelayMs);
          sseRetryDelayMs = Math.min(10000, sseRetryDelayMs * 2);
        }
      };
    };

    const connectWs = () => {
      if (disposed) return;
      const token = getAdminToken();
      if (!token) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(
        `${protocol}//${window.location.host}/ws/admin?token=${encodeURIComponent(token)}`
      );
      wsRef.current = ws;

      ws.onopen = () => {
        wsRetryDelayMs = 1500;
        void syncSubmissionsSilently();
      };

      ws.onmessage = (event) => {
        handleRawEvent(String(event.data || '{}'));
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        if (!disposed && getAdminToken()) {
          wsReconnectTimer = window.setTimeout(connectWs, wsRetryDelayMs);
          wsRetryDelayMs = Math.min(10000, wsRetryDelayMs * 2);
        }
      };
    };

    connectSse();
    connectWs();

    const pollInterval = window.setInterval(() => {
      if (!disposed && document.visibilityState !== 'hidden') {
        void syncSubmissionsSilently();
      }
    }, 3000);

    const handleWakeSync = () => {
      if (!disposed && document.visibilityState === 'visible') {
        void syncSubmissionsSilently();
      }
    };
    window.addEventListener('focus', handleWakeSync);
    document.addEventListener('visibilitychange', handleWakeSync);

    return () => {
      disposed = true;
      window.clearInterval(pollInterval);
      window.removeEventListener('focus', handleWakeSync);
      document.removeEventListener('visibilitychange', handleWakeSync);
      if (wsReconnectTimer !== null) {
        window.clearTimeout(wsReconnectTimer);
      }
      if (sseReconnectTimer !== null) {
        window.clearTimeout(sseReconnectTimer);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };
  }, [authed]);

  async function refreshAdminData() {
    setAnalyticsLoading(true);
    try {
      const [cRes, sRes, aRes, pRes, certRes] = await Promise.all([
        api.listCourses(true),
        api.listAllSubmissions(),
        api.getAdminAnalytics(),
        api.getAdminProfile().catch(() => ({ adminName: '' })),
        api.listAdminCertificates().catch(() => ({ certificates: [] as CertificateRecord[] })),
      ]);
      setCourses(cRes.courses);
      const { next, newlyDetected } = reconcileFetchedSubmissions(
        sRes.submissions,
        knownSubmissionIdsRef.current,
        hasLoadedSubmissionsRef.current
      );
      hasLoadedSubmissionsRef.current = true;
      setSubmissions(next);
      setAnalyticsReport(aRes.report);
      setCertificates(certRes.certificates);
      if (newlyDetected.length > 0) {
        notifyNewSubmissions(newlyDetected);
      }
      if (pRes.adminName) {
        setAdminName(pRes.adminName);
        setAdminNameDraft(pRes.adminName);
      }
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
      const trimmedName = adminNameInput.trim();
      const res = isFirstRun
        ? await api.claimAdminPasscode(passcode, trimmedName)
        : await api.loginAdmin(passcode, trimmedName || undefined);
      setAdminToken(res.token);
      const resolvedName = res.adminName?.trim() || trimmedName || '';
      setAdminName(resolvedName);
      setAdminNameDraft(resolvedName);
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
      setAdminNotice({
        type: 'success',
        title: 'Course Saved',
        message: `"${draft.title.trim()}" has been saved and synced to the catalog.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save course.';
      setEditorError(msg);
      setAdminNotice({
        type: 'error',
        title: 'Save Failed',
        message: msg,
      });
    } finally {
      setSavingCourse(false);
    }
  }

  async function handleDeleteCourse(course: Course) {
    setDeletingCourseId(course._id);
    try {
      await api.deleteCourse(course._id);
      if (editingCourseId === course._id) {
        setEditingCourseId(null);
        setDraft(null);
      }
      setConfirmDeleteCourseId(null);
      await refreshAdminData();
      await onCoursesMutated();
      setAdminNotice({
        type: 'success',
        title: 'Course Deleted',
        message: `"${course.title}" was removed from the training catalog.`,
      });
    } catch (err) {
      setAdminNotice({
        type: 'error',
        title: 'Delete Failed',
        message: err instanceof Error ? err.message : 'Failed to delete course.',
      });
    } finally {
      setDeletingCourseId(null);
    }
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

  async function handleDownloadBrandedAndroidZip() {
    setDownloadingSourceZip(true);
    setBrandingError(null);
    try {
      await downloadAndroidProjectZip();
    } catch (err) {
      setBrandingError(
        err instanceof Error ? err.message : 'Failed to download Android Studio ZIP.'
      );
    } finally {
      setDownloadingSourceZip(false);
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
      const trimmedAdminName = adminNameDraft.trim();
      if (trimmedAdminName && trimmedAdminName !== adminName) {
        const profileRes = await api.updateAdminProfile(trimmedAdminName);
        setAdminName(profileRes.adminName);
        setAdminNameDraft(profileRes.adminName);
      }
      const successMsg =
        'System branding saved. Android app resources (app_name & launcher icons) and live Android clients are now synced.';
      setBrandingSuccess(successMsg);
      setAdminNotice({
        type: 'success',
        title: 'Branding & App Distribution Saved',
        message: successMsg,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save system branding.';
      setBrandingError(msg);
      setAdminNotice({
        type: 'error',
        title: 'Branding Save Failed',
        message: msg,
      });
    } finally {
      setSavingBranding(false);
    }
  }

  async function handleReviewDecision(decision: 'approved' | 'rejected') {
    if (!selectedSub) return;
    setReviewLoading(true);
    setReviewResultBanner(null);
    try {
      const res = await api.reviewSubmission(
        selectedSub._id,
        decision,
        reviewFeedback,
        decision === 'rejected' ? rejectAllowRetry : undefined
      );
      setSelectedSub(res.submission);
      setPendingReviewDecision(null);
      setSubmissions((prev) =>
        prev.map((s) => (s._id === res.submission._id ? res.submission : s))
      );
      if (decision === 'approved') {
        const issuedCert = res.certificate;
        if (issuedCert) {
          setCertificates((prev) => [
            issuedCert,
            ...prev.filter((c) => c._id !== issuedCert._id),
          ]);
        }
        const certCode = issuedCert?.certificateCode;
        const msg = certCode
          ? `Approved ${res.submission.userName}'s assessment and issued official certificate ${certCode}.`
          : `Approved ${res.submission.userName}'s assessment and confirmed certificate eligibility.`;
        setReviewResultBanner({
          type: 'approved',
          message: msg,
          certificateCode: certCode,
        });
        setAdminNotice({
          type: 'success',
          title: 'Certificate Approved & Issued',
          message: msg,
          certificateCode: certCode,
        });
      } else {
        setCertificates((prev) =>
          prev.filter((c) => c.submissionId !== res.submission._id)
        );
        const retryMsg =
          res.submission.allowRetry === false
            ? 'Retaking the course is blocked and no certificate will be issued.'
            : 'Learner is allowed to retry the course.';
        const msg = `Rejected ${res.submission.userName}'s submission for "${res.submission.courseTitle}". ${retryMsg}`;
        setReviewResultBanner({
          type: 'rejected',
          message: msg,
        });
        setAdminNotice({
          type: 'success',
          title: 'Submission Rejected',
          message: msg,
        });
      }
      await refreshAdminData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update submission review.';
      setReviewResultBanner({
        type: 'error',
        message: msg,
      });
      setAdminNotice({
        type: 'error',
        title: 'Review Action Failed',
        message: msg,
      });
    } finally {
      setReviewLoading(false);
    }
  }

  async function handleViewSubmissionCertificate(sub: CourseSubmission) {
    const cached = certificates.find(
      (c) => (sub.certificateId && c._id === sub.certificateId) || c.submissionId === sub._id
    );
    if (cached) {
      setViewingCertificate(cached);
      return;
    }
    setLoadingCertSubId(sub._id);
    try {
      const res = await api.getSubmissionCertificate(sub._id);
      setCertificates((prev) => [
        res.certificate,
        ...prev.filter((c) => c._id !== res.certificate._id),
      ]);
      setViewingCertificate(res.certificate);
    } catch (err) {
      setAdminNotice({
        type: 'error',
        title: 'Certificate Unavailable',
        message:
          err instanceof Error
            ? err.message
            : 'Unable to load the issued certificate for this submission.',
      });
    } finally {
      setLoadingCertSubId(null);
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
      <div className={`mx-auto my-8 max-w-md p-7 ${cardCls}`}>
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950">
          <Lock className="h-5 w-5" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {isFirstRun ? 'First-Run Admin Studio Setup' : 'Admin Course Studio Sign In'}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
          {isFirstRun
            ? 'No admin passcode is configured yet. Claim your studio passcode to configure courses and review submissions.'
            : 'Enter the administrator passcode to manage courses, lesson media, quizzes, and certificates.'}
        </p>

        <form onSubmit={handleAdminAuthSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="admin-full-name"
              className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              {isFirstRun ? 'Admin Full Name' : 'Admin Full Name (optional update)'}
            </label>
            <input
              id="admin-full-name"
              type="text"
              required={Boolean(isFirstRun)}
              value={adminNameInput}
              onChange={(e) => setAdminNameInput(e.target.value)}
              placeholder="e.g. Elena Rostova"
              className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-400"
            />
          </div>

          <div>
            <label
              htmlFor="admin-passcode"
              className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
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
              className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-400"
            />
          </div>

          {authError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300">
              {authError}
            </div>
          )}

          <button
            type="submit"
            disabled={authLoading}
            className="min-h-[48px] w-full rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
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
  const approvedCount = submissions.filter((s) => s.status === 'approved').length;
  const rejectedCount = submissions.filter((s) => s.status === 'rejected').length;
  const filteredSubs =
    subFilter === 'all' ? submissions : submissions.filter((s) => s.status === subFilter);

  function handleSelectAdminTab(tabId: AdminTabId) {
    setAdminTab(tabId);
    if (tabId !== 'courses') {
      setDraft(null);
    }
    if (tabId !== 'submissions') {
      setSelectedSub(null);
      setPendingReviewDecision(null);
    } else {
      setPendingReviewDecision(null);
      if (pendingCount > 0 && !selectedSub) {
        setSubFilter('pending_review');
      }
    }
    if (tabId === 'branding' || tabId === 'distribution') {
      setBrandingError(null);
      setBrandingSuccess(null);
    }
  }

  const activePanelKey =
    adminTab === 'courses'
      ? draft
        ? 'courses-editor'
        : 'courses-list'
      : adminTab === 'submissions'
      ? selectedSub
        ? `submissions-detail-${selectedSub._id}`
        : 'submissions-list'
      : adminTab;

  return (
    <MotionConfig reducedMotion="user">
    <div className="grid gap-6 pb-16 lg:grid-cols-[276px_1fr]">
      {/* Admin Left Sidebar — Clustered Functional Navigation */}
      <aside className={`p-4 lg:sticky lg:top-20 lg:self-start ${cardCls}`}>
        <div className="border-b border-slate-200/80 px-2 pb-3 dark:border-slate-800/80">
          <p className="text-xs font-bold text-slate-900 dark:text-white">
            {systemBranding.systemName}
          </p>
          <p
            data-testid="admin-sidebar-name"
            className="mt-0.5 truncate text-xs font-medium text-slate-500 dark:text-slate-400"
          >
            {adminName || 'System Administrator'}
          </p>
        </div>

        <nav aria-label="Admin Studio navigation" className="mt-4 space-y-5">
          {ADMIN_NAV_CLUSTERS.map((cluster) => (
            <div key={cluster.id} className="space-y-1.5">
              <p className="px-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase dark:text-slate-500">
                {cluster.label}
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
                {cluster.items.map((item) => {
                  const isActive = adminTab === item.id;
                  const IconComponent =
                    item.id === 'analytics'
                      ? BarChart3
                      : item.id === 'submissions'
                      ? ClipboardList
                      : item.id === 'courses'
                      ? BookOpen
                      : item.id === 'branding'
                      ? Palette
                      : AndroidIcon;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-testid={`admin-nav-${item.id}`}
                      onClick={() => handleSelectAdminTab(item.id)}
                      className={`flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl px-3 text-left text-sm font-semibold transition-colors ${
                        isActive
                          ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950'
                          : item.id === 'submissions' && pendingCount > 0
                          ? 'border border-amber-300/80 bg-amber-50/75 text-amber-950 hover:bg-amber-100/80 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/50'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <IconComponent className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </span>

                      {item.id === 'courses' && (
                        <span
                          className={`font-mono-tabular shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                            isActive
                              ? 'bg-white/15 text-white dark:bg-slate-950/20 dark:text-slate-950'
                              : 'bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {courses.length}
                        </span>
                      )}

                      {item.id === 'submissions' && (
                        <span
                          className={`font-mono-tabular shrink-0 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-bold ${
                            pendingCount > 0
                              ? 'bg-amber-500 text-slate-950'
                              : isActive
                              ? 'bg-white/15 text-white dark:bg-slate-950/20 dark:text-slate-950'
                              : 'bg-slate-200/80 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {pendingCount > 0 ? `${pendingCount} pending` : '0'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              setAdminToken(null);
              setAuthed(false);
            }}
            className="min-h-[40px] w-full rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Lock Admin Studio
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="min-w-0 space-y-5">
        {/* Global Admin Confirmation / Error Notice */}
        {adminNotice && (
          <div
            role={adminNotice.type === 'error' ? 'alert' : 'status'}
            className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-3.5 shadow-xs ${
              adminNotice.type === 'error'
                ? 'border-red-300 bg-red-50/95 text-red-900 dark:border-red-800/70 dark:bg-red-950/75 dark:text-red-100'
                : 'border-emerald-300 bg-emerald-50/95 text-emerald-950 dark:border-emerald-800/70 dark:bg-emerald-950/75 dark:text-emerald-100'
            }`}
          >
            <div className="flex items-start gap-3">
              {adminNotice.type === 'error' ? (
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              )}
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold">{adminNotice.title}</p>
                  {adminNotice.certificateCode && (
                    <span className="font-mono-tabular rounded-md border border-emerald-400/60 bg-white/80 px-2 py-0.5 text-xs font-bold text-emerald-900 dark:border-emerald-700 dark:bg-slate-900 dark:text-emerald-300">
                      {adminNotice.certificateCode}
                    </span>
                  )}
                </div>
                <p className="text-xs leading-relaxed opacity-90">{adminNotice.message}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAdminNotice(null)}
              aria-label="Dismiss notification"
              className="rounded-lg p-1 opacity-70 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Pending Certificate Approval Banner */}
        {pendingCount > 0 && !(adminTab === 'submissions' && selectedSub) && (
          <section
            aria-label="Pending certificate approvals"
            className="grid gap-4 rounded-2xl border border-amber-300 bg-amber-50/90 p-5 shadow-xs md:grid-cols-[auto_1fr_auto] md:items-center dark:border-amber-700/70 dark:bg-amber-950/45"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-slate-950">
              <Award className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-bold tracking-wider text-amber-900 uppercase dark:text-amber-300">
                Action Required
              </p>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {pendingCount} Pending Certificate{pendingCount === 1 ? '' : 's'} Awaiting Admin Approval
              </h2>
              <p className="text-xs text-slate-700 dark:text-amber-100/80">
                Review learner assessment attempts and approve or reject certificate issuance.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAdminTab('submissions');
                setDraft(null);
                setSelectedSub(null);
                setSubFilter('pending_review');
              }}
              className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-amber-500 px-4 text-xs font-bold text-slate-950 hover:bg-amber-400"
            >
              <ClipboardCheck className="h-4 w-4 shrink-0" />
              <span>Review Pending ({pendingCount})</span>
            </button>
          </section>
        )}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activePanelKey}
            data-testid="admin-tab-panel"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
        {adminTab === 'analytics' && (
          <AdminAnalyticsDashboard
            report={analyticsReport}
            loading={analyticsLoading}
            onRefresh={refreshAdminData}
          />
        )}

        {adminTab === 'courses' && !draft && (
          <div className="space-y-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Course Catalog &amp; Curriculum
                </h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
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
                className="flex min-h-[44px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
              >
                <Plus className="h-4 w-4" />
                <span>New Course</span>
              </button>
            </div>

            <div className="space-y-4">
              {courses.map((course) => {
                const lessons = course.modules.filter((m) => m.kind === 'lesson').length;
                const quizzes = course.modules.filter((m) => m.kind === 'quiz').length;
                return (
                  <article
                    key={course._id}
                    className={`grid gap-4 p-5 md:grid-cols-[136px_1fr] md:items-center ${cardCls}`}
                  >
                    <CourseBannerImage
                      url={course.bannerUrl}
                      title={course.title}
                      className="aspect-video w-full rounded-xl border border-slate-200 md:h-24 md:w-[136px] dark:border-slate-700"
                    />

                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="min-w-0 text-base font-bold text-slate-900 dark:text-white">
                          {course.title}
                        </h2>

                        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
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
                              setConfirmDeleteCourseId(null);
                            }}
                            aria-label={`Edit ${course.title}`}
                            className="inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
                          >
                            <Pencil className="h-3.5 w-3.5 shrink-0" />
                            <span>Edit</span>
                          </button>
                          {confirmDeleteCourseId === course._id ? (
                            <div className="flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-2 py-0.5 dark:border-red-800 dark:bg-red-950/60">
                              <span className="text-[11px] font-semibold text-red-800 dark:text-red-200">
                                Delete?
                              </span>
                              <button
                                type="button"
                                disabled={deletingCourseId === course._id}
                                onClick={() => handleDeleteCourse(course)}
                                className="h-7 rounded-md bg-red-600 px-2 text-[11px] font-bold text-white hover:bg-red-700 disabled:opacity-60"
                              >
                                {deletingCourseId === course._id ? 'Deleting...' : 'Confirm'}
                              </button>
                              <button
                                type="button"
                                disabled={deletingCourseId === course._id}
                                onClick={() => setConfirmDeleteCourseId(null)}
                                className="h-7 rounded-md px-1.5 text-[11px] font-semibold text-slate-700 hover:bg-white/70 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteCourseId(course._id)}
                              aria-label={`Delete ${course.title}`}
                              className="inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-red-950/60 dark:hover:text-red-300"
                            >
                              <Trash2 className="h-3.5 w-3.5 shrink-0" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50/90 p-3 text-xs sm:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1.4fr)] sm:gap-5 dark:bg-slate-950/60">
                        <div>
                          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            Status
                          </p>
                          <p
                            className={`mt-0.5 whitespace-nowrap font-semibold ${
                              course.published
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            {course.published ? 'Published' : 'Draft'}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            Category
                          </p>
                          <p className="mt-0.5 truncate font-semibold text-slate-800 dark:text-slate-200">
                            {course.category}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            Curriculum
                          </p>
                          <p className="font-mono-tabular mt-0.5 whitespace-nowrap font-semibold text-slate-800 dark:text-slate-200">
                            {lessons} {lessons === 1 ? 'lesson' : 'lessons'}, {quizzes}{' '}
                            {quizzes === 1 ? 'quiz' : 'quizzes'}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            Credential
                          </p>
                          <p className="mt-0.5 truncate font-medium text-slate-700 dark:text-slate-300">
                            {course.certificateTitle || 'Standard'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* COURSE & CURRICULUM BUILDER */}
        {adminTab === 'courses' && draft && (
          <form onSubmit={handleSaveCourse} className="space-y-6">
            <div
              data-testid="course-editor-sticky-bar"
              className="sticky top-[68px] z-20 flex items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white/95 px-4 py-2.5 shadow-sm backdrop-blur-md dark:border-slate-800/90 dark:bg-slate-900/95"
            >
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="inline-flex min-h-[40px] shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <ArrowLeft className="h-4 w-4 shrink-0" />
                  <span>Back to Course List</span>
                </button>
                <span className="hidden truncate text-xs font-semibold text-slate-500 sm:inline dark:text-slate-400">
                  {editingCourseId
                    ? `Editing: ${draft.title || 'Untitled Course'}`
                    : `New Course: ${draft.title || 'Untitled Course'}`}
                </span>
              </div>
              <button
                type="submit"
                disabled={savingCourse}
                className="flex min-h-[42px] shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white shadow-xs hover:bg-blue-800 disabled:opacity-60 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
              >
                <Save className="h-4 w-4" />
                <span>{savingCourse ? 'Saving...' : 'Save Course'}</span>
              </button>
            </div>

            {editorError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300">
                {editorError}
              </div>
            )}
            {editorSuccess && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300">
                {editorSuccess}
              </div>
            )}

            {/* Metadata Card */}
            <section className={`space-y-4 p-6 ${cardCls}`}>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Course Details &amp; Banner
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Course Title</label>
                  <input
                    type="text"
                    required
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder="e.g. Confined Space Entry Certification"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Category</label>
                  <input
                    type="text"
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Certificate Title</label>
                  <input
                    type="text"
                    value={draft.certificateTitle}
                    onChange={(e) => setDraft({ ...draft, certificateTitle: e.target.value })}
                    placeholder="Certified Specialist"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Issuing Organization</label>
                  <input
                    type="text"
                    value={draft.issuerName}
                    onChange={(e) => setDraft({ ...draft, issuerName: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Course Description</label>
                <textarea
                  rows={3}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              {/* Banner Selection + Upload */}
              <div className="grid gap-4 sm:grid-cols-[200px_1fr] sm:items-center">
                <CourseBannerImage
                  url={draft.bannerUrl}
                  title={draft.title || 'Course Banner'}
                  className="h-28 w-full rounded-xl border border-slate-200 dark:border-slate-700"
                />
                <div className="space-y-2.5">
                  <label className={labelCls}>Banner Image URL or Upload</label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={draft.bannerUrl}
                      onChange={(e) => setDraft({ ...draft, bannerUrl: e.target.value })}
                      className="min-h-[40px] flex-1 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                    <label className="flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
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
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        Use {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <label className="inline-flex min-h-[36px] cursor-pointer items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
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
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Curriculum Sequence (Place Lessons &amp; Quizzes Anywhere)
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Insert quizzes after any number of lessons, reorder modules, and place images/videos at any position inside lessons.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => addModule('lesson')}
                    className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Lesson</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addModule('quiz')}
                    className="flex min-h-[40px] items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Quiz</span>
                  </button>
                </div>
              </div>

              {draft.modules.map((mod, modIdx) => (
                <div key={mod.id} className={`space-y-4 p-5 ${cardCls}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                    <span className="font-mono-tabular text-xs font-bold text-blue-700 dark:text-sky-400">
                      #{modIdx + 1} · {mod.kind === 'lesson' ? 'LESSON' : 'QUIZ CHECKPOINT'}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveModule(modIdx, -1)}
                        disabled={modIdx === 0}
                        aria-label="Move module up"
                        className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveModule(modIdx, 1)}
                        disabled={modIdx === draft.modules.length - 1}
                        aria-label="Move module down"
                        className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeModule(modIdx)}
                        aria-label="Remove module"
                        className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-red-950/60 dark:hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {mod.kind === 'lesson' ? (
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                        <div>
                          <label className={labelCls}>Lesson Title</label>
                          <input
                            type="text"
                            value={mod.title}
                            onChange={(e) =>
                              updateModule(modIdx, { ...mod, title: e.target.value })
                            }
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Est. Minutes</label>
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
                            className={`font-mono-tabular ${inputCls}`}
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        {mod.blocks.map((blk, blkIdx) => (
                          <div
                            key={blk.id}
                            className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/60"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono-tabular text-xs font-semibold text-slate-600 uppercase dark:text-slate-300">
                                Block {blkIdx + 1}: {blk.type}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={blkIdx === 0}
                                  onClick={() => moveLessonBlock(modIdx, mod, blkIdx, -1)}
                                  className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                  aria-label="Move block up"
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={blkIdx === mod.blocks.length - 1}
                                  onClick={() => moveLessonBlock(modIdx, mod, blkIdx, 1)}
                                  className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
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
                                  className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 hover:text-red-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-red-300"
                                  aria-label="Delete block"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            {blk.type === 'header' && (
                              <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                                <div>
                                  <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                    Heading Level
                                  </label>
                                  <select
                                    value={blk.level}
                                    onChange={(e) =>
                                      updateLessonBlock(modIdx, mod, blkIdx, {
                                        ...blk,
                                        level: Number(e.target.value) as 1 | 2 | 3,
                                      })
                                    }
                                    className="min-h-[38px] w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                  >
                                    <option value={1}>H1</option>
                                    <option value={2}>H2</option>
                                    <option value={3}>H3</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                    Heading Text
                                  </label>
                                  <input
                                    type="text"
                                    value={blk.text}
                                    onChange={(e) =>
                                      updateLessonBlock(modIdx, mod, blkIdx, {
                                        ...blk,
                                        text: e.target.value,
                                      })
                                    }
                                    className="min-h-[38px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                  />
                                </div>
                              </div>
                            )}

                            {blk.type === 'body' && (
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateLessonBlock(modIdx, mod, blkIdx, {
                                          ...blk,
                                          text: `${blk.text} **bold text**`,
                                        })
                                      }
                                      className="rounded border border-slate-200 bg-white px-2 py-0.5 font-bold dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
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
                                      className="rounded border border-slate-200 bg-white px-2 py-0.5 italic dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
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
                                      className="rounded border border-slate-200 bg-white px-2 py-0.5 underline dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                    >
                                      U
                                    </button>
                                  </div>
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
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
                                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                />
                              </div>
                            )}

                            {blk.type === 'bullets' && (
                              <div className="space-y-1.5">
                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                  Bullet Items (one per line)
                                </label>
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
                                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                />
                              </div>
                            )}

                            {(blk.type === 'image' || blk.type === 'video') && (
                              <div className="grid gap-3">
                                <div>
                                  <label className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                    {blk.type === 'video' ? (
                                      <Film className="h-3.5 w-3.5" />
                                    ) : (
                                      <ImageIcon className="h-3.5 w-3.5" />
                                    )}
                                    <span>
                                      {blk.type === 'video' ? 'Video Source URL or Upload' : 'Image Source URL or Upload'}
                                    </span>
                                  </label>
                                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
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
                                      className="min-h-[38px] w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                    />
                                    <label className="flex min-h-[38px] cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                                      <Upload className="h-3.5 w-3.5" />
                                      <span>
                                        {uploadingKey === blk.id ? 'Uploading...' : 'Upload File'}
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
                                </div>
                                <div>
                                  <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                    Caption (optional)
                                  </label>
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
                                    className="min-h-[36px] w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-950/60">
                        <span className="mr-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
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
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            + {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* QUIZ CONFIGURATION */
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className={labelCls}>Quiz Title</label>
                          <input
                            type="text"
                            value={mod.title}
                            onChange={(e) =>
                              updateModule(modIdx, { ...mod, title: e.target.value })
                            }
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Passing Score (%)</label>
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
                            className={`font-mono-tabular ${inputCls}`}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Failure Rule</label>
                          <select
                            value={mod.failureRule}
                            onChange={(e) =>
                              updateModule(modIdx, {
                                ...mod,
                                failureRule: e.target.value as QuizFailureRule,
                              })
                            }
                            className={inputCls}
                          >
                            <option value="retry_quiz">Retry this quiz only</option>
                            <option value="restart_since_last_quiz">
                              Restart from last lesson after previous quiz
                            </option>
                            <option value="restart_course">Restart entire course from Lesson 1</option>
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Passing Rule</label>
                          <select
                            value={mod.passingRule}
                            onChange={(e) =>
                              updateModule(modIdx, {
                                ...mod,
                                passingRule: e.target.value as QuizPassingRule,
                              })
                            }
                            className={inputCls}
                          >
                            <option value="proceed_next">Proceed to next module</option>
                            <option value="require_manual_review">
                              Proceed &amp; flag for admin manual review
                            </option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {mod.questions.map((q, qIdx) => (
                          <div
                            key={q.id}
                            className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60"
                          >
                            <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2 dark:border-slate-800">
                              <div className="flex items-center gap-2">
                                <span className="font-mono-tabular text-xs font-bold text-slate-900 dark:text-white">
                                  Q{qIdx + 1}
                                </span>
                                <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                                  {q.type.replace('_', ' ')}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  updateModule(modIdx, {
                                    ...mod,
                                    questions: mod.questions.filter((_, i) => i !== qIdx),
                                  })
                                }
                                className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:text-red-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-red-300"
                                aria-label="Delete question"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <div>
                              <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                Question Prompt
                              </label>
                              <input
                                type="text"
                                value={q.prompt}
                                onChange={(e) => {
                                  const qs = [...mod.questions];
                                  qs[qIdx] = { ...q, prompt: e.target.value };
                                  updateModule(modIdx, { ...mod, questions: qs });
                                }}
                                placeholder="Question prompt..."
                                className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                              />
                            </div>

                            {(q.type === 'multiple_choice' || q.type === 'select_all') && (
                              <div className="space-y-2">
                                <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                  Answer Options (check correct{' '}
                                  {q.type === 'multiple_choice' ? 'answer' : 'answers'})
                                </p>
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
                                        className="min-h-[36px] flex-1 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
                                  className="text-xs font-semibold text-blue-700 hover:underline dark:text-sky-400"
                                >
                                  + Add option
                                </button>
                              </div>
                            )}

                            {q.type === 'true_false' && (
                              <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-800 dark:text-slate-200">
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
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                  <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                    Rubric Keywords (comma-separated)
                                  </label>
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
                                    placeholder="safety, verify"
                                    className="min-h-[38px] w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                  />
                                </div>
                                <div>
                                  <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                    Model Answer
                                  </label>
                                  <input
                                    type="text"
                                    value={q.modelAnswer ?? ''}
                                    onChange={(e) => {
                                      const qs = [...mod.questions];
                                      qs[qIdx] = { ...q, modelAnswer: e.target.value };
                                      updateModule(modIdx, { ...mod, questions: qs });
                                    }}
                                    placeholder="Model answer shown to learner"
                                    className="min-h-[38px] w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                  />
                                </div>
                              </div>
                            )}

                            <div>
                              <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                Diagnostic Explanation
                              </label>
                              <input
                                type="text"
                                value={q.explanation}
                                onChange={(e) => {
                                  const qs = [...mod.questions];
                                  qs[qIdx] = { ...q, explanation: e.target.value };
                                  updateModule(modIdx, { ...mod, questions: qs });
                                }}
                                placeholder="Explanation shown if answered wrong..."
                                className="min-h-[38px] w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-950/60">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          Add question:
                        </span>
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
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            + {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick Insert Module After This Row */}
                  <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => addModule('lesson', modIdx)}
                      className="font-medium text-slate-600 hover:text-blue-700 dark:text-slate-400 dark:hover:text-sky-400"
                    >
                      + Insert Lesson Below
                    </button>
                    <button
                      type="button"
                      onClick={() => addModule('quiz', modIdx)}
                      className="font-medium text-slate-600 hover:text-blue-700 dark:text-slate-400 dark:hover:text-sky-400"
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
            <div className="space-y-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Learner Submissions &amp; Certificate Approvals
                </h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Inspect per-question attempt counts, essay responses, and approve or reject pending certificates.
                </p>
              </div>
              <div
                data-testid="submissions-status-filter"
                className="inline-flex w-fit flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
              >
                {[
                  { id: 'all', label: 'All', count: submissions.length },
                  { id: 'pending_review', label: 'Pending Certificates', count: pendingCount },
                  { id: 'approved', label: 'Approved', count: approvedCount },
                  { id: 'rejected', label: 'Rejected', count: rejectedCount },
                ].map((f) => {
                  const isPendingTab = f.id === 'pending_review' && f.count > 0;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setSubFilter(f.id as typeof subFilter)}
                      className={`inline-flex min-h-[36px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold transition-colors ${
                        subFilter === f.id
                          ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-950 dark:text-white'
                          : isPendingTab
                          ? 'text-amber-800 hover:bg-amber-100/70 dark:text-amber-300 dark:hover:bg-amber-950/60'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <span>{f.label}</span>
                      <span
                        className={`font-mono-tabular rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          isPendingTab
                            ? 'bg-amber-500/20 text-amber-900 dark:bg-amber-500/30 dark:text-amber-200'
                            : 'bg-slate-200/80 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {f.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {filteredSubs.length === 0 ? (
              <div className={`p-10 text-center text-sm text-slate-500 dark:text-slate-400 ${cardCls}`}>
                No learner submissions in this status yet.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredSubs.map((sub) => {
                  const isPending = sub.status === 'pending_review';
                  const isApproved = sub.status === 'approved';
                  return (
                    <article
                      key={sub._id}
                      className={`grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center ${cardCls} ${
                        isPending
                          ? 'border-amber-300/90 bg-amber-50/45 dark:border-amber-700/60 dark:bg-amber-950/20'
                          : ''
                      }`}
                    >
                      <div className="min-w-0 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h2 className="text-base font-bold text-slate-900 dark:text-white">
                              {sub.userName}
                            </h2>
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                              {sub.userEmail}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {recentArrivalIds.includes(sub._id) && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-800 dark:border-sky-700/70 dark:bg-sky-950/70 dark:text-sky-200">
                                New
                              </span>
                            )}
                            {isPending ? (
                              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-amber-300 bg-amber-100/90 px-2.5 py-1 text-xs font-bold text-amber-900 dark:border-amber-700/70 dark:bg-amber-950/80 dark:text-amber-200">
                                <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                Pending Approval
                              </span>
                            ) : isApproved ? (
                              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Approved
                              </span>
                            ) : (
                              <>
                                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300">
                                  <XCircle className="h-3.5 w-3.5" />
                                  Rejected
                                </span>
                                <span
                                  className={`inline-flex shrink-0 items-center rounded-md border px-2 py-1 text-[11px] font-semibold ${
                                    sub.allowRetry === false
                                      ? 'border-red-200 bg-red-100/80 text-red-900 dark:border-red-900/70 dark:bg-red-950/80 dark:text-red-200'
                                      : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/60 dark:text-amber-200'
                                  }`}
                                >
                                  {sub.allowRetry === false ? 'Retake Locked' : 'Retry Allowed'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50/90 p-3 text-xs sm:grid-cols-4 dark:bg-slate-950/60">
                          <div className="min-w-0">
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">Course</p>
                            <p className="mt-0.5 truncate font-semibold text-slate-800 dark:text-slate-200">
                              {sub.courseTitle}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Target Certificate
                            </p>
                            <p className="mt-0.5 truncate font-medium text-slate-700 dark:text-slate-300">
                              {sub.certificateTitle}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">Score</p>
                            <p className="font-mono-tabular mt-0.5 font-bold text-slate-900 dark:text-white">
                              {sub.overallScore}%
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Submitted
                            </p>
                            <p className="font-mono-tabular mt-0.5 text-slate-700 dark:text-slate-300">
                              {new Date(sub.submittedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-stretch">
                        {isApproved && (
                          <button
                            type="button"
                            disabled={loadingCertSubId === sub._id}
                            onClick={() => handleViewSubmissionCertificate(sub)}
                            className="inline-flex min-h-[42px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-emerald-300 bg-emerald-50 px-4 text-xs font-bold text-emerald-900 transition-colors hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-700/70 dark:bg-emerald-950/60 dark:text-emerald-200 dark:hover:bg-emerald-900/60"
                          >
                            <Award className="h-4 w-4 shrink-0" />
                            <span>
                              {loadingCertSubId === sub._id ? 'Loading...' : 'View Certificate'}
                            </span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSub(sub);
                            setRecentArrivalIds((prev) => prev.filter((id) => id !== sub._id));
                            setReviewFeedback(sub.adminFeedback ?? '');
                            setRejectAllowRetry(sub.allowRetry !== false);
                            setPendingReviewDecision(null);
                            setReviewResultBanner(null);
                          }}
                          className={`min-h-[42px] shrink-0 whitespace-nowrap rounded-xl px-4 text-xs font-bold transition-colors ${
                            isPending
                              ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                              : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400'
                          }`}
                        >
                          {isPending ? 'Review' : 'Inspect Review Details'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SUBMISSION INSPECTOR WITH QUESTION TRY COUNTS */}
        {adminTab === 'submissions' && selectedSub && (
          <div className="space-y-6">
            <button
              type="button"
              onClick={() => {
                setSelectedSub(null);
                setPendingReviewDecision(null);
                setReviewResultBanner(null);
              }}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              <span>Back to Submissions List</span>
            </button>

            <section className={`p-6 ${cardCls}`}>
              {/* Clear Certificate Status Indicator Banner */}
              <div
                className={`mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-semibold ${
                  selectedSub.status === 'pending_review'
                    ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700/70 dark:bg-amber-950/60 dark:text-amber-100'
                    : selectedSub.status === 'approved'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
                    : 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  {selectedSub.status === 'pending_review' ? (
                    <>
                      <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <span>
                        Pending Certificate Approval — Inspect answers below and confirm whether to issue a certificate.
                      </span>
                    </>
                  ) : selectedSub.status === 'approved' ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Approved — Official Certificate Issued for this submission.</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      <span>
                        {selectedSub.allowRetry === false
                          ? 'Submission Rejected — Retake disabled (learner cannot retake this course or receive a certificate).'
                          : 'Submission Rejected — Retry allowed (learner may retake the course). No certificate was issued.'}
                      </span>
                    </>
                  )}
                </span>
                <div className="flex flex-wrap items-center gap-2.5">
                  {selectedSub.reviewedAt && (
                    <span className="text-[11px] opacity-80">
                      Reviewed {new Date(selectedSub.reviewedAt).toLocaleString()}
                    </span>
                  )}
                  {selectedSub.status === 'approved' && (
                    <button
                      type="button"
                      disabled={loadingCertSubId === selectedSub._id}
                      onClick={() => handleViewSubmissionCertificate(selectedSub)}
                      className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-emerald-400/70 bg-white/90 px-3 text-xs font-bold text-emerald-900 shadow-xs hover:bg-white disabled:opacity-60 dark:border-emerald-700 dark:bg-slate-900 dark:text-emerald-200 dark:hover:bg-slate-800"
                    >
                      <Award className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {loadingCertSubId === selectedSub._id ? 'Loading...' : 'View Certificate'}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-4 border-b border-slate-200 pb-5 dark:border-slate-800">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {selectedSub.courseTitle}
                </h2>
                <div className="grid gap-3 rounded-xl bg-slate-50/90 p-4 text-xs sm:grid-cols-2 lg:grid-cols-4 dark:bg-slate-950/60">
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Learner</p>
                    <p className="mt-0.5 font-bold text-slate-900 dark:text-white">
                      {selectedSub.userName}
                    </p>
                    <p className="truncate text-slate-500 dark:text-slate-400">
                      {selectedSub.userEmail}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Certificate Track
                    </p>
                    <p className="mt-0.5 font-semibold text-slate-800 dark:text-slate-200">
                      {selectedSub.certificateTitle}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Final Score</p>
                    <p className="font-mono-tabular mt-0.5 text-xl font-bold text-slate-900 dark:text-white">
                      {selectedSub.overallScore}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {selectedSub.completedOfflineAt ? 'Completed Offline' : 'Submitted'}
                    </p>
                    <p className="font-mono-tabular mt-0.5 font-medium text-slate-800 dark:text-slate-200">
                      {new Date(
                        selectedSub.completedOfflineAt || selectedSub.submittedAt
                      ).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <h3 className="mt-5 text-sm font-bold text-slate-900 dark:text-white">
                Per-Question Attempts &amp; Answers
              </h3>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      <th className="py-2.5 pr-4 font-semibold">Question</th>
                      <th className="py-2.5 pr-4 font-semibold">Learner Response</th>
                      <th className="py-2.5 pr-4 font-semibold">Result</th>
                      <th className="py-2.5 text-right font-semibold">Tries Taken</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedSub.questionResults.map((qr) => (
                      <tr key={qr.questionId} className="align-top">
                        <td className="py-3 pr-4">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {qr.questionPrompt}
                          </p>
                          <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                            {qr.quizTitle} · {qr.questionType.replace('_', ' ')}
                          </p>
                        </td>
                        <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">
                          {qr.userAnswerLabel}
                        </td>
                        <td className="py-3 pr-4">
                          {qr.isCorrect ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Correct
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-semibold text-red-700 dark:text-red-400">
                              <XCircle className="h-3.5 w-3.5" />
                              Wrong
                            </span>
                          )}
                        </td>
                        <td className="font-mono-tabular py-3 text-right font-bold text-slate-900 dark:text-white">
                          {qr.tries} {qr.tries === 1 ? 'try' : 'tries'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 space-y-3 border-t border-slate-200 pt-5 dark:border-slate-800">
                <label className={labelCls}>
                  Reviewer Feedback (optional, visible to learner)
                </label>
                <textarea
                  rows={2}
                  value={reviewFeedback}
                  onChange={(e) => setReviewFeedback(e.target.value)}
                  placeholder="Great accuracy on safety procedures..."
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />

                {reviewResultBanner && (
                  <div
                    role={reviewResultBanner.type === 'error' ? 'alert' : 'status'}
                    className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs font-medium ${
                      reviewResultBanner.type === 'approved'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
                        : reviewResultBanner.type === 'rejected'
                        ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
                        : 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200'
                    }`}
                  >
                    {reviewResultBanner.type === 'approved' ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : reviewResultBanner.type === 'rejected' ? (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
                    ) : (
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                    )}
                    <div>
                      <p className="font-bold">{reviewResultBanner.message}</p>
                      {reviewResultBanner.certificateCode && (
                        <p className="font-mono-tabular mt-1 text-[11px]">
                          Issued Certificate ID: {reviewResultBanner.certificateCode}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {pendingReviewDecision ? (
                  <div
                    className={`space-y-4 rounded-xl border p-4 ${
                      pendingReviewDecision === 'approved'
                        ? 'border-emerald-300 bg-emerald-50/90 dark:border-emerald-800 dark:bg-emerald-950/50'
                        : 'border-red-300 bg-red-50/90 dark:border-red-800 dark:bg-red-950/50'
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-xs">
                        <p className="font-bold text-slate-900 dark:text-white">
                          {pendingReviewDecision === 'approved'
                            ? `Confirm Approval & Certificate Issuance for ${selectedSub.userName}?`
                            : `Confirm Rejection of ${selectedSub.userName}'s Submission?`}
                        </p>
                        <p className="mt-0.5 text-slate-700 dark:text-slate-300">
                          {pendingReviewDecision === 'approved'
                            ? `An official verifiable certificate (${selectedSub.certificateTitle}) will be issued immediately.`
                            : 'Choose whether the learner is permitted to retake this course after rejection.'}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={reviewLoading}
                          onClick={() => handleReviewDecision(pendingReviewDecision)}
                          className={`min-h-[40px] rounded-xl px-4 text-xs font-bold text-white disabled:opacity-60 ${
                            pendingReviewDecision === 'approved'
                              ? 'bg-emerald-700 hover:bg-emerald-800'
                              : 'bg-red-700 hover:bg-red-800'
                          }`}
                        >
                          {reviewLoading
                            ? 'Saving...'
                            : pendingReviewDecision === 'approved'
                            ? 'Confirm Approve & Issue'
                            : 'Confirm Reject'}
                        </button>
                        <button
                          type="button"
                          disabled={reviewLoading}
                          onClick={() => setPendingReviewDecision(null)}
                          className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>

                    {pendingReviewDecision === 'rejected' && (
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <label
                          className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-xs transition-colors ${
                            rejectAllowRetry
                              ? 'border-blue-600 bg-white shadow-xs dark:border-sky-400 dark:bg-slate-900'
                              : 'border-slate-200 bg-white/70 hover:bg-white dark:border-slate-800 dark:bg-slate-900/60'
                          }`}
                        >
                          <input
                            type="radio"
                            name="reject-retry-policy"
                            checked={rejectAllowRetry}
                            onChange={() => setRejectAllowRetry(true)}
                            className="mt-0.5 h-4 w-4 accent-blue-700 dark:accent-sky-400"
                          />
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">
                              Allow Learner to Retry Course
                            </p>
                            <p className="mt-0.5 text-slate-600 dark:text-slate-300">
                              Learner can retake the lessons and quizzes to submit a new attempt.
                            </p>
                          </div>
                        </label>
                        <label
                          className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-xs transition-colors ${
                            !rejectAllowRetry
                              ? 'border-red-600 bg-white shadow-xs dark:border-red-400 dark:bg-slate-900'
                              : 'border-slate-200 bg-white/70 hover:bg-white dark:border-slate-800 dark:bg-slate-900/60'
                          }`}
                        >
                          <input
                            type="radio"
                            name="reject-retry-policy"
                            checked={!rejectAllowRetry}
                            onChange={() => setRejectAllowRetry(false)}
                            className="mt-0.5 h-4 w-4 accent-red-700 dark:accent-red-400"
                          />
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">
                              Do Not Allow Retry (Lock Course)
                            </p>
                            <p className="mt-0.5 text-slate-600 dark:text-slate-300">
                              Learner cannot undergo this course again and will not receive a certificate.
                            </p>
                          </div>
                        </label>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={reviewLoading || selectedSub.status === 'approved'}
                      onClick={() => setPendingReviewDecision('approved')}
                      className="flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>
                        {selectedSub.status === 'approved'
                          ? 'Approved'
                          : 'Approve & Issue Certificate'}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={reviewLoading || selectedSub.status === 'rejected'}
                      onClick={() => {
                        setRejectAllowRetry(selectedSub.allowRetry !== false);
                        setPendingReviewDecision('rejected');
                      }}
                      className="flex min-h-[44px] items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-900/50"
                    >
                      <XCircle className="h-4 w-4" />
                      <span>
                        {selectedSub.status === 'rejected'
                          ? 'Rejected'
                          : 'Reject Submission'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* SYSTEM SETTINGS: BRANDING & IDENTITY */}
        {adminTab === 'branding' && (
          <form onSubmit={handleSaveBranding} className="space-y-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Branding &amp; Platform Identity
                </h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Configure the platform title, accent color, tagline, and launcher icon. Saving updates both the public site and connected Android clients.
                </p>
              </div>
              <button
                type="submit"
                disabled={savingBranding || uploadingApk}
                className="flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
              >
                <Save className="h-4 w-4" />
                <span>{savingBranding ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>

            {brandingError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300">
                {brandingError}
              </div>
            )}
            {brandingSuccess && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300">
                {brandingSuccess}
              </div>
            )}

            <section className={`space-y-5 p-6 ${cardCls}`}>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">System Identity</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="system-name-input" className={labelCls}>
                    System Name (also sets Android APK app_name)
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
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="system-accent-input" className={labelCls}>
                    Primary Accent Color
                  </label>
                  <div className="grid grid-cols-[56px_1fr] gap-2">
                    <input
                      id="system-accent-input"
                      type="color"
                      value={brandingDraft.accentColor}
                      onChange={(e) =>
                        setBrandingDraft({ ...brandingDraft, accentColor: e.target.value })
                      }
                      className="h-[42px] w-14 cursor-pointer rounded-xl border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-950"
                    />
                    <input
                      type="text"
                      value={brandingDraft.accentColor}
                      onChange={(e) =>
                        setBrandingDraft({ ...brandingDraft, accentColor: e.target.value })
                      }
                      className={`font-mono-tabular ${inputCls}`}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="admin-name-setting-input" className={labelCls}>
                    Administrator Full Name (shown in sidebar)
                  </label>
                  <input
                    id="admin-name-setting-input"
                    type="text"
                    value={adminNameDraft}
                    onChange={(e) => setAdminNameDraft(e.target.value)}
                    placeholder="e.g. Elena Rostova"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="system-tagline-input" className={labelCls}>
                    Landing Page Tagline
                  </label>
                  <input
                    id="system-tagline-input"
                    type="text"
                    value={brandingDraft.tagline}
                    onChange={(e) =>
                      setBrandingDraft({ ...brandingDraft, tagline: e.target.value })
                    }
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid gap-4 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 sm:grid-cols-[96px_1fr] sm:items-start dark:border-slate-800 dark:bg-slate-950/50">
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
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
                <div className="space-y-3">
                  <div>
                    <label htmlFor="system-icon-url-input" className={labelCls}>
                      System Icon (sets Android Launcher Icon &amp; Runtime Badge)
                    </label>
                    <input
                      id="system-icon-url-input"
                      type="text"
                      value={brandingDraft.iconUrl}
                      onChange={(e) =>
                        setBrandingDraft({ ...brandingDraft, iconUrl: e.target.value })
                      }
                      placeholder={DEFAULT_SYSTEM_ICON_URL}
                      className="min-h-[40px] w-full rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label className="flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
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
                        setBrandingDraft((prev) => ({
                          ...prev,
                          iconUrl: DEFAULT_SYSTEM_ICON_URL,
                        }))
                      }
                      className="min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Use Default Icon
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className={`grid gap-4 p-6 sm:grid-cols-[1fr_auto] sm:items-center ${cardCls}`}>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Branded Android Build Source
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  Downloads the Android Studio project with your saved System Name and launcher mipmap icons pre-applied.
                </p>
              </div>
              <button
                type="button"
                disabled={downloadingSourceZip}
                onClick={handleDownloadBrandedAndroidZip}
                className="flex min-h-[42px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <Download className="h-3.5 w-3.5" />
                <span>
                  {downloadingSourceZip
                    ? 'Preparing .zip...'
                    : 'Download Android Studio Project (.zip)'}
                </span>
              </button>
            </section>
          </form>
        )}

        {/* SYSTEM SETTINGS: APP DISTRIBUTION */}
        {adminTab === 'distribution' && (
          <form onSubmit={handleSaveBranding} className="space-y-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Android App Distribution
                </h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Choose whether the public Download App buttons serve a direct .apk release or link to your Google Play Store listing.
                </p>
              </div>
              <button
                type="submit"
                disabled={savingBranding || uploadingApk}
                className="flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
              >
                <Save className="h-4 w-4" />
                <span>{savingBranding ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>

            {brandingError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300">
                {brandingError}
              </div>
            )}
            {brandingSuccess && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300">
                {brandingSuccess}
              </div>
            )}

            <section className={`space-y-5 p-6 ${cardCls}`}>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Public &ldquo;Download App&rdquo; Behavior
                </h2>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  Select the active distribution channel shown on the landing page.
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
                          ? 'border-blue-700 bg-blue-50/70 ring-1 ring-blue-700 dark:border-sky-400 dark:bg-sky-950/40 dark:ring-sky-400'
                          : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/70 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:bg-slate-800/70'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                        <span
                          className={
                            selected
                              ? 'text-blue-700 dark:text-sky-400'
                              : 'text-slate-500 dark:text-slate-400'
                          }
                        >
                          {modeOption.icon}
                        </span>
                        <span>{modeOption.title}</span>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {modeOption.desc}
                      </p>
                    </button>
                  );
                })}
              </div>

              {(brandingDraft.appDistributionMode ?? 'apk_download') === 'apk_download' ? (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="flex items-start gap-2.5">
                      <AndroidIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-700 dark:text-sky-400" />
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          Upload Android Release (.apk)
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                          Build <code className="font-mono-tabular">app-debug.apk</code> via{' '}
                          <code className="font-mono-tabular">.github/workflows/android-build.yml</code>{' '}
                          and upload it here.
                        </p>
                      </div>
                    </div>

                    <label className="flex min-h-[42px] cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400">
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
                    <div className="grid gap-3 rounded-xl border border-emerald-200 bg-white p-4 text-xs sm:grid-cols-[1fr_auto] sm:items-center dark:border-emerald-900/60 dark:bg-slate-900">
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="min-w-0">
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Active Package
                          </p>
                          <p className="mt-0.5 truncate font-bold text-slate-900 dark:text-white">
                            {brandingDraft.apkFileName || 'app-debug.apk'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">Size</p>
                          <p className="font-mono-tabular mt-0.5 font-semibold text-slate-800 dark:text-slate-200">
                            {apkSizeBytes
                              ? `${Math.max(1, Math.round(apkSizeBytes / 1024))} KB`
                              : 'Ready'}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">Path</p>
                          <p className="font-mono-tabular mt-0.5 truncate text-slate-600 dark:text-slate-300">
                            {brandingDraft.apkUrl}
                          </p>
                        </div>
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
                        className="min-h-[36px] shrink-0 whitespace-nowrap rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-900/50"
                      >
                        Remove APK
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
                      No .apk uploaded yet. Upload your .apk file above or paste an external HTTPS download link below.
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="apk-version-input" className={labelCls}>
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
                        className="font-mono-tabular min-h-[40px] w-full rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label htmlFor="apk-url-input" className={labelCls}>
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
                        className="font-mono-tabular min-h-[40px] w-full rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/60">
                  <label htmlFor="play-store-url-input" className={labelCls}>
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
                    className={inputCls}
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    When saved, all Download App buttons on the public landing page will link directly to this Google Play Store URL.
                  </p>
                </div>
              )}
            </section>
          </form>
        )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>

    <CertificateModal
      certificate={viewingCertificate}
      isAdmin
      onClose={() => setViewingCertificate(null)}
      onUpdated={(updated) => {
        setViewingCertificate(updated);
        setCertificates((prev) =>
          prev.map((c) => (c._id === updated._id ? updated : c))
        );
      }}
    />

    <AnimatePresence>
      {realtimeToast && (
        <motion.div
          key={realtimeToast.id}
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          role="status"
          aria-live="polite"
          data-testid="realtime-submission-toast"
          className="fixed right-4 bottom-4 z-50 w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-blue-200 bg-white/95 p-3.5 shadow-xl backdrop-blur-xl dark:border-sky-800/70 dark:bg-slate-900/95"
        >
          <div className="flex items-start gap-3">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-sky-950/70 dark:text-sky-400">
              <Bell className="h-4 w-4" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75 dark:bg-sky-400" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-600 dark:bg-sky-400" />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  New Submission Received
                </p>
                {realtimeToast.unreadCount > 1 && (
                  <span className="font-mono-tabular rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-sky-950 dark:text-sky-300">
                    +{realtimeToast.unreadCount - 1} more
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-slate-600 dark:text-slate-300">
                {realtimeToast.submission.userName} · {realtimeToast.submission.courseTitle}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="font-mono-tabular rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900 dark:bg-amber-950/70 dark:text-amber-200">
                  Score {realtimeToast.submission.overallScore}%
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const sub = realtimeToast.submission;
                    setAdminTab('submissions');
                    setDraft(null);
                    setSubFilter('all');
                    setSelectedSub(sub);
                    setRecentArrivalIds((prev) => prev.filter((id) => id !== sub._id));
                    setReviewFeedback(sub.adminFeedback ?? '');
                    setRejectAllowRetry(sub.allowRetry !== false);
                    setPendingReviewDecision(null);
                    setReviewResultBanner(null);
                    setRealtimeToast(null);
                  }}
                  className="rounded-lg bg-blue-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
                >
                  View
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRealtimeToast(null)}
              aria-label="Dismiss new submission notification"
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </MotionConfig>
  );
};
