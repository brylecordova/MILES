import type {
  AdminAnalyticsReport,
  CertificateRecord,
  Course,
  CourseSubmission,
  SystemBranding,
  UserAccount,
  VerifiedCertificatePublic,
} from '../types/training';

let learnerToken: string | null = null;
let adminToken: string | null = null;

export function setLearnerToken(token: string | null) {
  learnerToken = token;
}

export function getLearnerToken(): string | null {
  return learnerToken;
}

export function setAdminToken(token: string | null) {
  adminToken = token;
}

export function getAdminToken(): string | null {
  return adminToken;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  authRole: 'learner' | 'admin' | 'none' = 'none'
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (authRole === 'learner' && learnerToken) {
    headers.set('Authorization', `Bearer ${learnerToken}`);
  } else if (authRole === 'admin' && adminToken) {
    headers.set('Authorization', `Bearer ${adminToken}`);
  }

  const res = await fetch(path, {
    ...options,
    cache: options.cache ?? 'no-store',
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  // System branding
  getSystemBranding: () =>
    apiFetch<{ branding: SystemBranding }>('/api/system/branding'),
  updateSystemBranding: (branding: Omit<SystemBranding, 'updatedAt'>) =>
    apiFetch<{ branding: SystemBranding }>(
      '/api/admin/branding',
      { method: 'PUT', body: JSON.stringify(branding) },
      'admin'
    ),

  // Learner auth
  registerLearner: (name: string, email: string, password: string) =>
    apiFetch<{ token: string; user: UserAccount }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),
  loginLearner: (email: string, password: string) =>
    apiFetch<{ token: string; user: UserAccount }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  // Admin auth
  getAdminAuthStatus: () =>
    apiFetch<{
      configuredViaEnv: boolean;
      hasClaimedPasscode: boolean;
      databaseMode: string;
      adminName?: string;
    }>('/api/admin/auth/status'),
  claimAdminPasscode: (passcode: string, adminName?: string) =>
    apiFetch<{ token: string; adminName?: string }>('/api/admin/auth/claim', {
      method: 'POST',
      body: JSON.stringify({ passcode, adminName }),
    }),
  loginAdmin: (passcode: string, adminName?: string) =>
    apiFetch<{ token: string; adminName?: string }>('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ passcode, adminName }),
    }),
  getAdminProfile: () =>
    apiFetch<{ adminName: string }>('/api/admin/profile', {}, 'admin'),
  updateAdminProfile: (adminName: string) =>
    apiFetch<{ adminName: string }>(
      '/api/admin/profile',
      { method: 'PUT', body: JSON.stringify({ adminName }) },
      'admin'
    ),

  // Courses
  listCourses: (includeDrafts = false) =>
    apiFetch<{ courses: Course[] }>(
      `/api/courses${includeDrafts ? '?includeDrafts=1' : ''}`,
      {},
      includeDrafts ? 'admin' : 'learner'
    ),
  rateCourse: (id: string, rating: number) =>
    apiFetch<{ course: Course }>(
      `/api/courses/${encodeURIComponent(id)}/rate`,
      { method: 'POST', body: JSON.stringify({ rating }) },
      'learner'
    ),
  createCourse: (course: Omit<Course, '_id' | 'createdAt' | 'updatedAt'>) =>
    apiFetch<{ course: Course }>(
      '/api/courses',
      { method: 'POST', body: JSON.stringify(course) },
      'admin'
    ),
  updateCourse: (id: string, course: Partial<Course>) =>
    apiFetch<{ course: Course }>(
      `/api/courses/${id}`,
      { method: 'PUT', body: JSON.stringify(course) },
      'admin'
    ),
  deleteCourse: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/courses/${id}`, { method: 'DELETE' }, 'admin'),

  uploadMedia: (dataUrl: string) =>
    apiFetch<{ url: string }>(
      '/api/admin/upload',
      { method: 'POST', body: JSON.stringify({ dataUrl }) },
      'admin'
    ),

  // Submissions
  submitCourse: (payload: {
    courseId: string;
    courseTitle: string;
    certificateTitle: string;
    issuerName: string;
    overallScore: number;
    passed: boolean;
    completedOfflineAt?: string;
    questionResults: CourseSubmission['questionResults'];
    quizResults: CourseSubmission['quizResults'];
  }) =>
    apiFetch<{ submission: CourseSubmission }>(
      '/api/submissions',
      { method: 'POST', body: JSON.stringify(payload) },
      'learner'
    ),
  listMySubmissions: () =>
    apiFetch<{ submissions: CourseSubmission[] }>('/api/submissions/mine', {}, 'learner'),
  listAllSubmissions: () =>
    apiFetch<{ submissions: CourseSubmission[] }>('/api/admin/submissions', {}, 'admin'),
  getAdminAnalytics: () =>
    apiFetch<{ report: AdminAnalyticsReport }>('/api/admin/analytics', {}, 'admin'),
  reviewSubmission: (
    id: string,
    status: 'approved' | 'rejected',
    adminFeedback?: string,
    allowRetry?: boolean
  ) =>
    apiFetch<{ submission: CourseSubmission; certificate?: CertificateRecord }>(
      `/api/admin/submissions/${id}/review`,
      { method: 'PATCH', body: JSON.stringify({ status, adminFeedback, allowRetry }) },
      'admin'
    ),

  // Certificates
  verifyCertificate: (code: string) =>
    apiFetch<{ verified: boolean; certificate: VerifiedCertificatePublic }>(
      `/api/certificates/verify/${encodeURIComponent(code)}`
    ),
  listMyCertificates: () =>
    apiFetch<{ certificates: CertificateRecord[] }>('/api/certificates/mine', {}, 'learner'),
  listAdminCertificates: () =>
    apiFetch<{ certificates: CertificateRecord[] }>('/api/admin/certificates', {}, 'admin'),
  getSubmissionCertificate: (submissionId: string) =>
    apiFetch<{ certificate: CertificateRecord }>(
      `/api/admin/submissions/${encodeURIComponent(submissionId)}/certificate`,
      {},
      'admin'
    ),
  emailCertificate: (
    id: string,
    recipientEmail: string,
    pdfBase64: string,
    authRole: 'learner' | 'admin' = 'learner'
  ) =>
    apiFetch<{
      deliveredViaSmtp: boolean;
      recipientEmail: string;
      certificate?: CertificateRecord;
      message: string;
    }>(
      `/api/certificates/${id}/email`,
      { method: 'POST', body: JSON.stringify({ recipientEmail, pdfBase64 }) },
      authRole
    ),
};

export async function downloadAndroidProjectZip(): Promise<void> {
  const fetchZip = async () => {
    const res = await fetch('/api/android-project.zip', {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (!res.ok) {
      throw new Error(`Download failed (${res.status}).`);
    }
    return res.arrayBuffer();
  };

  let buffer = await fetchZip();
  let bytes = new Uint8Array(buffer);

  // If a stale Service Worker intercepted the request and returned HTML, unregister and retry once
  if (bytes.length < 22 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    buffer = await fetchZip();
    bytes = new Uint8Array(buffer);
  }

  if (bytes.length < 22 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error('The server did not return a valid ZIP archive. Please refresh the page and try again.');
  }

  const blob = new Blob([buffer], { type: 'application/zip' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = 'certifield-android-app.zip';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

export async function uploadAdminApk(
  file: File
): Promise<{ url: string; fileName: string; sizeBytes: number }> {
  const headers = new Headers();
  headers.set('Content-Type', 'application/vnd.android.package-archive');
  headers.set('x-file-name', file.name);
  if (adminToken) {
    headers.set('Authorization', `Bearer ${adminToken}`);
  }
  const res = await fetch('/api/admin/upload-apk', {
    method: 'POST',
    headers,
    body: file,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `APK upload failed (${res.status})`);
  }
  return data as { url: string; fileName: string; sizeBytes: number };
}

export async function downloadUploadedApk(fallbackName = 'certifield-android.apk'): Promise<void> {
  const res = await fetch('/api/android-app.apk', {
    cache: 'no-store',
    credentials: 'same-origin',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `APK download failed (${res.status}).`);
  }
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 64 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error('Downloaded file is not a valid Android APK package.');
  }
  const disposition = res.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const fileName = match?.[1] || fallbackName;

  const blob = new Blob([buffer], { type: 'application/vnd.android.package-archive' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}
