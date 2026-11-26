import type {
  CertificateRecord,
  Course,
  CourseSubmission,
  SystemBranding,
  UserAccount,
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

  const res = await fetch(path, { ...options, headers });
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
    apiFetch<{ configuredViaEnv: boolean; hasClaimedPasscode: boolean; databaseMode: string }>(
      '/api/admin/auth/status'
    ),
  claimAdminPasscode: (passcode: string) =>
    apiFetch<{ token: string }>('/api/admin/auth/claim', {
      method: 'POST',
      body: JSON.stringify({ passcode }),
    }),
  loginAdmin: (passcode: string) =>
    apiFetch<{ token: string }>('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ passcode }),
    }),

  // Courses
  listCourses: (includeDrafts = false) =>
    apiFetch<{ courses: Course[] }>(
      `/api/courses${includeDrafts ? '?includeDrafts=1' : ''}`,
      {},
      includeDrafts ? 'admin' : 'none'
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
  reviewSubmission: (id: string, status: 'approved' | 'rejected', adminFeedback?: string) =>
    apiFetch<{ submission: CourseSubmission; certificate?: CertificateRecord }>(
      `/api/admin/submissions/${id}/review`,
      { method: 'PATCH', body: JSON.stringify({ status, adminFeedback }) },
      'admin'
    ),

  // Certificates
  listMyCertificates: () =>
    apiFetch<{ certificates: CertificateRecord[] }>('/api/certificates/mine', {}, 'learner'),
  emailCertificate: (id: string, recipientEmail: string, pdfBase64: string) =>
    apiFetch<{
      deliveredViaSmtp: boolean;
      recipientEmail: string;
      certificate?: CertificateRecord;
      message: string;
    }>(
      `/api/certificates/${id}/email`,
      { method: 'POST', body: JSON.stringify({ recipientEmail, pdfBase64 }) },
      'learner'
    ),
};
