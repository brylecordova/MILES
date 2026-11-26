import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import nodemailer from 'nodemailer';
import { createServer as createViteServer } from 'vite';
import { db, type StoredUser } from './server/db.ts';
import type {
  CertificateDesign,
  CertificateElement,
  CertificateRecord,
  Course,
  CourseModule,
  CourseSubmission,
  LessonBlock,
  SystemBranding,
  UserAccount,
} from './src/types/training.ts';
import {
  getDefaultCertificateDesign,
  getDefaultSystemBranding,
} from './src/utils/certificateDefaults.ts';

const PORT = 3000;
const SESSION_SECRET =
  process.env.SESSION_SECRET?.trim() || crypto.randomBytes(32).toString('hex');

const UPLOADS_DIR = path.resolve(process.cwd(), 'public', 'uploads');

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  const actualBuf = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

function safeCompareString(a: string, b: string): boolean {
  const digestA = crypto.createHash('sha256').update(a).digest();
  const digestB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

interface TokenPayload {
  sub: string;
  role: 'learner' | 'admin';
  exp: number;
}

function signToken(payload: Omit<TokenPayload, 'exp'>): string {
  const full: TokenPayload = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  };
  const encoded = Buffer.from(JSON.stringify(full), 'utf-8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  if (!safeCompareString(sig, expectedSig)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as TokenPayload;
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function extractBearer(req: Request): TokenPayload | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return verifyToken(header.slice(7).trim());
}

function toPublicUser(user: StoredUser): UserAccount {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

function isSafeMediaUrl(url: string): boolean {
  if (!url) return true;
  const trimmed = url.trim();
  if (trimmed.startsWith('/')) return true;
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('data:video/')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function sanitizeHexColor(value: unknown, fallback: string): string {
  if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim())) {
    return value.trim();
  }
  return fallback;
}

function sanitizeCertificateDesign(
  raw: unknown,
  issuerName: string,
  certificateTitle: string,
  existing?: CertificateDesign
): CertificateDesign {
  const base = existing ?? getDefaultCertificateDesign(issuerName, certificateTitle);
  if (!raw || typeof raw !== 'object') {
    return base;
  }
  const obj = raw as Partial<CertificateDesign>;
  const validKinds = new Set([
    'system_icon',
    'issuer_name',
    'heading',
    'subtitle',
    'learner_name',
    'completion_text',
    'certificate_title',
    'course_title',
    'score',
    'issue_date',
    'certificate_code',
    'signature_label',
    'custom_text',
  ]);
  const elements: CertificateElement[] = Array.isArray(obj.elements)
    ? obj.elements
        .filter((el): el is CertificateElement => Boolean(el && typeof el === 'object' && validKinds.has(el.kind)))
        .map((el) => ({
          id: String(el.id || `el-${crypto.randomUUID().slice(0, 6)}`),
          kind: el.kind,
          label: String(el.label || el.kind).slice(0, 60),
          text: String(el.text ?? '').slice(0, 240),
          xPct: Math.max(0, Math.min(100, Number(el.xPct ?? 50))),
          yPct: Math.max(0, Math.min(100, Number(el.yPct ?? 50))),
          fontSize: Math.max(7, Math.min(64, Number(el.fontSize ?? 14))),
          fontWeight: el.fontWeight === 'bold' ? 'bold' : 'normal',
          fontFamily:
            el.fontFamily === 'serif' || el.fontFamily === 'mono' ? el.fontFamily : 'sans',
          color: sanitizeHexColor(el.color, '#0f172a'),
          align: el.align === 'left' || el.align === 'right' ? el.align : 'center',
          visible: typeof el.visible === 'boolean' ? el.visible : true,
        }))
    : base.elements;

  const bgImage =
    typeof obj.backgroundImageUrl === 'string' && isSafeMediaUrl(obj.backgroundImageUrl)
      ? obj.backgroundImageUrl.trim()
      : existing?.backgroundImageUrl;

  return {
    canvasBackground: sanitizeHexColor(obj.canvasBackground, base.canvasBackground),
    backgroundImageUrl: bgImage || undefined,
    borderColor: sanitizeHexColor(obj.borderColor, base.borderColor),
    accentColor: sanitizeHexColor(obj.accentColor, base.accentColor),
    showBorder: typeof obj.showBorder === 'boolean' ? obj.showBorder : base.showBorder,
    elements: elements.length > 0 ? elements : base.elements,
  };
}

function sanitizeCourseInput(raw: Partial<Course>, existing?: Course): Course {
  const now = new Date().toISOString();
  const title = typeof raw.title === 'string' ? raw.title.trim() : existing?.title ?? '';
  const description =
    typeof raw.description === 'string' ? raw.description.trim() : existing?.description ?? '';
  const category =
    typeof raw.category === 'string' && raw.category.trim()
      ? raw.category.trim()
      : existing?.category ?? 'General Training';
  const bannerUrl =
    typeof raw.bannerUrl === 'string' && isSafeMediaUrl(raw.bannerUrl)
      ? raw.bannerUrl.trim()
      : existing?.bannerUrl ?? '';
  const certificateTitle =
    typeof raw.certificateTitle === 'string' && raw.certificateTitle.trim()
      ? raw.certificateTitle.trim()
      : `${title} Certificate`;
  const issuerName =
    typeof raw.issuerName === 'string' && raw.issuerName.trim()
      ? raw.issuerName.trim()
      : existing?.issuerName ?? 'CertiField Academy';
  const published = typeof raw.published === 'boolean' ? raw.published : existing?.published ?? true;

  const modules: CourseModule[] = Array.isArray(raw.modules)
    ? raw.modules.map((mod): CourseModule => {
        if (mod.kind === 'lesson') {
          const blocks: LessonBlock[] = Array.isArray(mod.blocks)
            ? mod.blocks.map((blk) => {
                if ((blk.type === 'image' || blk.type === 'video') && !isSafeMediaUrl(blk.url)) {
                  return { ...blk, url: '' };
                }
                return blk;
              })
            : [];
          return {
            id: mod.id || `lesson-${crypto.randomUUID()}`,
            kind: 'lesson',
            title: String(mod.title || 'Untitled Lesson').trim(),
            estimatedMinutes: Number(mod.estimatedMinutes) > 0 ? Number(mod.estimatedMinutes) : 5,
            blocks,
          };
        }
        return {
          id: mod.id || `quiz-${crypto.randomUUID()}`,
          kind: 'quiz',
          title: String(mod.title || 'Knowledge Check').trim(),
          description: String(mod.description || '').trim(),
          passingScore: Math.max(0, Math.min(100, Number(mod.passingScore ?? 70))),
          failureRule: mod.failureRule || 'retry_quiz',
          passingRule: mod.passingRule || 'proceed_next',
          questions: Array.isArray(mod.questions) ? mod.questions : [],
        };
      })
    : existing?.modules ?? [];

  const certificateDesign = sanitizeCertificateDesign(
    raw.certificateDesign,
    issuerName,
    certificateTitle,
    existing?.certificateDesign
  );

  return {
    _id: existing?._id ?? `course-${crypto.randomUUID().slice(0, 8)}`,
    title,
    description,
    category,
    bannerUrl,
    certificateTitle,
    issuerName,
    published,
    modules,
    certificateDesign,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

interface AuthedRequest extends Request {
  auth?: TokenPayload;
  learner?: StoredUser;
}

async function requireLearner(req: AuthedRequest, res: Response, next: NextFunction) {
  const payload = extractBearer(req);
  if (!payload || payload.role !== 'learner') {
    res.status(401).json({ error: 'Please sign in to your learner account.' });
    return;
  }
  const user = await db.findUserById(payload.sub);
  if (!user) {
    res.status(401).json({ error: 'Learner account not found.' });
    return;
  }
  req.auth = payload;
  req.learner = user;
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  const payload = extractBearer(req);
  if (!payload || payload.role !== 'admin') {
    res.status(401).json({ error: 'Admin authorization required.' });
    return;
  }
  req.auth = payload;
  next();
}

async function startServer() {
  await db.init();
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  const app = express();
  app.use(express.json({ limit: '25mb' }));
  app.use('/media', express.static(path.resolve(process.cwd(), 'public', 'media')));
  app.use('/uploads', express.static(UPLOADS_DIR));

  // ---- Health / Mode ----
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, database: db.getMode() });
  });

  // ---- System Branding ----
  app.get('/api/system/branding', async (_req, res) => {
    const branding = await db.getSystemBranding();
    res.json({ branding });
  });

  app.put('/api/admin/branding', requireAdmin, async (req, res) => {
    try {
      const current = await db.getSystemBranding();
      const defaults = getDefaultSystemBranding();
      const rawName = typeof req.body?.systemName === 'string' ? req.body.systemName.trim() : '';
      const rawTagline = typeof req.body?.tagline === 'string' ? req.body.tagline.trim() : '';
      const rawIcon = typeof req.body?.iconUrl === 'string' ? req.body.iconUrl.trim() : '';

      if (!rawName) {
        res.status(400).json({ error: 'System name is required.' });
        return;
      }
      if (rawIcon && !isSafeMediaUrl(rawIcon)) {
        res.status(400).json({ error: 'System icon URL must be a valid relative or HTTPS URL.' });
        return;
      }

      const branding: SystemBranding = {
        systemName: rawName.slice(0, 60),
        tagline: (rawTagline || defaults.tagline).slice(0, 180),
        iconUrl: rawIcon || current.iconUrl || defaults.iconUrl,
        accentColor: sanitizeHexColor(req.body?.accentColor, current.accentColor || defaults.accentColor),
        updatedAt: new Date().toISOString(),
      };
      await db.saveSystemBranding(branding);
      res.json({ branding });
    } catch (err) {
      console.error('Branding update error:', err);
      res.status(500).json({ error: 'Failed to save system branding.' });
    }
  });

  // ---- Learner Auth ----
  app.post('/api/auth/register', async (req, res) => {
    try {
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';

      if (!name || !email || !email.includes('@') || password.length < 6) {
        res.status(400).json({
          error: 'Full name, a valid email address, and a password of at least 6 characters are required.',
        });
        return;
      }

      const existing = await db.findUserByEmail(email);
      if (existing) {
        res.status(409).json({ error: 'An account with this email already exists.' });
        return;
      }

      const user: StoredUser = {
        _id: `user-${crypto.randomUUID()}`,
        name,
        email,
        role: 'learner',
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString(),
      };
      await db.createUser(user);
      const token = signToken({ sub: user._id, role: 'learner' });
      res.status(201).json({ token, user: toPublicUser(user) });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Failed to create account.' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required.' });
        return;
      }

      const user = await db.findUserByEmail(email);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }

      const token = signToken({ sub: user._id, role: 'learner' });
      res.json({ token, user: toPublicUser(user) });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Failed to sign in.' });
    }
  });

  app.get('/api/auth/me', requireLearner, (req: AuthedRequest, res) => {
    res.json({ user: toPublicUser(req.learner!) });
  });

  // ---- Admin Auth & First-Run Setup ----
  app.get('/api/admin/auth/status', async (_req, res) => {
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    const settings = await db.getAdminSettings();
    res.json({
      configuredViaEnv: Boolean(envPasscode),
      hasClaimedPasscode: Boolean(settings?.adminPasscodeHash),
      databaseMode: db.getMode(),
    });
  });

  app.post('/api/admin/auth/claim', async (req, res) => {
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    if (envPasscode) {
      res.status(403).json({ error: 'Admin passcode is managed via server configuration.' });
      return;
    }
    const settings = await db.getAdminSettings();
    if (settings?.adminPasscodeHash) {
      res.status(403).json({ error: 'Admin passcode has already been claimed.' });
      return;
    }
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    if (passcode.length < 6) {
      res.status(400).json({ error: 'Choose an admin passcode of at least 6 characters.' });
      return;
    }
    await db.setAdminPasscodeHash(hashPassword(passcode));
    const token = signToken({ sub: 'admin', role: 'admin' });
    res.status(201).json({ token });
  });

  app.post('/api/admin/auth/login', async (req, res) => {
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    if (!passcode) {
      res.status(400).json({ error: 'Admin passcode is required.' });
      return;
    }
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    if (envPasscode) {
      if (!safeCompareString(passcode, envPasscode)) {
        res.status(401).json({ error: 'Invalid admin passcode.' });
        return;
      }
      res.json({ token: signToken({ sub: 'admin', role: 'admin' }) });
      return;
    }
    const settings = await db.getAdminSettings();
    if (!settings?.adminPasscodeHash || !verifyPassword(passcode, settings.adminPasscodeHash)) {
      res.status(401).json({ error: 'Invalid admin passcode.' });
      return;
    }
    res.json({ token: signToken({ sub: 'admin', role: 'admin' }) });
  });

  // ---- Courses ----
  app.get('/api/courses', async (req, res) => {
    const wantDrafts = req.query.includeDrafts === '1';
    const payload = extractBearer(req);
    const includeDrafts = wantDrafts && payload?.role === 'admin';
    const courses = await db.listCourses(includeDrafts);
    res.json({ courses });
  });

  app.get('/api/courses/:id', async (req, res) => {
    const course = await db.getCourseById(String(req.params.id));
    if (!course) {
      res.status(404).json({ error: 'Course not found.' });
      return;
    }
    if (!course.published) {
      const payload = extractBearer(req);
      if (payload?.role !== 'admin') {
        res.status(404).json({ error: 'Course not found.' });
        return;
      }
    }
    res.json({ course });
  });

  app.post('/api/courses', requireAdmin, async (req, res) => {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!title) {
      res.status(400).json({ error: 'Course title is required.' });
      return;
    }
    const course = sanitizeCourseInput(req.body);
    await db.createCourse(course);
    res.status(201).json({ course });
  });

  app.put('/api/courses/:id', requireAdmin, async (req, res) => {
    const id = String(req.params.id);
    const existing = await db.getCourseById(id);
    if (!existing) {
      res.status(404).json({ error: 'Course not found.' });
      return;
    }
    const updated = sanitizeCourseInput(req.body, existing);
    if (!updated.title) {
      res.status(400).json({ error: 'Course title is required.' });
      return;
    }
    await db.updateCourse(id, updated);
    res.json({ course: updated });
  });

  app.delete('/api/courses/:id', requireAdmin, async (req, res) => {
    const deleted = await db.deleteCourse(String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Course not found.' });
      return;
    }
    res.json({ ok: true });
  });

  // ---- Media Upload (Admin) ----
  app.post('/api/admin/upload', requireAdmin, (req, res) => {
    try {
      const dataUrl = typeof req.body?.dataUrl === 'string' ? req.body.dataUrl : '';
      const match = dataUrl.match(
        /^data:(image\/jpeg|image\/png|image\/webp|video\/mp4|video\/webm);base64,([A-Za-z0-9+/=]+)$/
      );
      if (!match) {
        res.status(400).json({
          error: 'Unsupported file format. Please upload JPG, PNG, WebP, MP4, or WebM media.',
        });
        return;
      }
      const mime = match[1];
      const buffer = Buffer.from(match[2], 'base64');
      if (buffer.byteLength > 18 * 1024 * 1024) {
        res.status(413).json({ error: 'File exceeds the 18 MB upload limit.' });
        return;
      }
      const extMap: Record<string, string> = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'video/mp4': '.mp4',
        'video/webm': '.webm',
      };
      const fileName = `${crypto.randomUUID()}${extMap[mime]}`;
      const targetPath = path.resolve(UPLOADS_DIR, fileName);
      if (!targetPath.startsWith(UPLOADS_DIR + path.sep)) {
        res.status(400).json({ error: 'Invalid upload path.' });
        return;
      }
      fs.writeFileSync(targetPath, buffer);
      res.status(201).json({ url: `/uploads/${fileName}` });
    } catch (err) {
      console.error('Upload error:', err);
      res.status(500).json({ error: 'Failed to store uploaded file.' });
    }
  });

  // ---- Submissions ----
  app.post('/api/submissions', requireLearner, async (req: AuthedRequest, res) => {
    try {
      const learner = req.learner!;
      const body = req.body ?? {};
      const courseId = typeof body.courseId === 'string' ? body.courseId : '';
      const course = await db.getCourseById(courseId);
      const questionResults = Array.isArray(body.questionResults) ? body.questionResults : [];
      const quizResults = Array.isArray(body.quizResults) ? body.quizResults : [];

      if (!courseId || questionResults.length === 0) {
        res.status(400).json({ error: 'Course ID and completed quiz results are required.' });
        return;
      }

      const submission: CourseSubmission = {
        _id: `sub-${crypto.randomUUID().slice(0, 8)}`,
        courseId,
        courseTitle: course?.title ?? String(body.courseTitle || 'Training Course'),
        certificateTitle: course?.certificateTitle ?? String(body.certificateTitle || 'Course Certificate'),
        issuerName: course?.issuerName ?? String(body.issuerName || 'CertiField Academy'),
        userId: learner._id,
        userName: learner.name,
        userEmail: learner.email,
        overallScore: Math.max(0, Math.min(100, Number(body.overallScore ?? 0))),
        passed: Boolean(body.passed),
        status: 'pending_review',
        submittedAt: new Date().toISOString(),
        completedOfflineAt:
          typeof body.completedOfflineAt === 'string' ? body.completedOfflineAt : undefined,
        questionResults,
        quizResults,
      };

      await db.createSubmission(submission);
      res.status(201).json({ submission });
    } catch (err) {
      console.error('Submission error:', err);
      res.status(500).json({ error: 'Failed to record submission.' });
    }
  });

  app.get('/api/submissions/mine', requireLearner, async (req: AuthedRequest, res) => {
    const submissions = await db.listSubmissionsByUser(req.learner!._id);
    res.json({ submissions });
  });

  app.get('/api/admin/submissions', requireAdmin, async (_req, res) => {
    const submissions = await db.listAllSubmissions();
    res.json({ submissions });
  });

  app.patch('/api/admin/submissions/:id/review', requireAdmin, async (req, res) => {
    try {
      const id = String(req.params.id);
      const submission = await db.getSubmissionById(id);
      if (!submission) {
        res.status(404).json({ error: 'Submission not found.' });
        return;
      }

      const decision = req.body?.status;
      if (decision !== 'approved' && decision !== 'rejected') {
        res.status(400).json({ error: 'Review status must be approved or rejected.' });
        return;
      }

      const feedback =
        typeof req.body?.adminFeedback === 'string' ? req.body.adminFeedback.trim() : undefined;

      let certificate: CertificateRecord | undefined;
      if (decision === 'approved') {
        if (submission.certificateId) {
          certificate = (await db.getCertificateById(submission.certificateId)) ?? undefined;
        }
        if (!certificate) {
          const [course, branding] = await Promise.all([
            db.getCourseById(submission.courseId),
            db.getSystemBranding(),
          ]);
          certificate = {
            _id: `cert-${crypto.randomUUID().slice(0, 8)}`,
            certificateCode: `CF-${new Date().getFullYear()}-${crypto
              .randomBytes(3)
              .toString('hex')
              .toUpperCase()}`,
            submissionId: submission._id,
            courseId: submission.courseId,
            courseTitle: submission.courseTitle,
            certificateTitle: submission.certificateTitle,
            issuerName: submission.issuerName,
            userId: submission.userId,
            userName: submission.userName,
            userEmail: submission.userEmail,
            score: submission.overallScore,
            issuedAt: new Date().toISOString(),
            emailedCount: 0,
            certificateDesign:
              course?.certificateDesign ??
              getDefaultCertificateDesign(submission.issuerName, submission.certificateTitle),
            systemIconUrl: branding.iconUrl,
          };
          await db.createCertificate(certificate);
        }
      }

      const updated: CourseSubmission = {
        ...submission,
        status: decision,
        adminFeedback: feedback,
        reviewedAt: new Date().toISOString(),
        certificateId: certificate?._id ?? submission.certificateId,
      };
      await db.updateSubmission(id, updated);
      res.json({ submission: updated, certificate });
    } catch (err) {
      console.error('Review error:', err);
      res.status(500).json({ error: 'Failed to update submission review.' });
    }
  });

  // ---- Certificates & Email ----
  app.get('/api/certificates/mine', requireLearner, async (req: AuthedRequest, res) => {
    const certificates = await db.listCertificatesByUser(req.learner!._id);
    res.json({ certificates });
  });

  app.post('/api/certificates/:id/email', requireLearner, async (req: AuthedRequest, res) => {
    try {
      const certId = String(req.params.id);
      const cert = await db.getCertificateById(certId);
      if (!cert || cert.userId !== req.learner!._id) {
        res.status(404).json({ error: 'Certificate not found.' });
        return;
      }

      const recipientEmail =
        typeof req.body?.recipientEmail === 'string' && req.body.recipientEmail.includes('@')
          ? req.body.recipientEmail.trim()
          : cert.userEmail;
      const pdfBase64 = typeof req.body?.pdfBase64 === 'string' ? req.body.pdfBase64 : '';

      const smtpHost = process.env.SMTP_HOST?.trim();
      const smtpUser = process.env.SMTP_USER?.trim();
      const smtpPass = process.env.SMTP_PASS?.trim();
      const smtpPort = Number(process.env.SMTP_PORT || 587);
      const smtpFrom = process.env.SMTP_FROM?.trim() || smtpUser || 'certificates@certifield.local';

      if (!smtpHost || !smtpUser || !smtpPass) {
        res.json({
          deliveredViaSmtp: false,
          recipientEmail,
          message:
            'Direct SMTP is not configured on this server. Your PDF certificate is ready to download or attach in your email client.',
        });
        return;
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      const attachments = pdfBase64
        ? [
            {
              filename: `${cert.certificateCode}.pdf`,
              content: Buffer.from(pdfBase64, 'base64'),
              contentType: 'application/pdf',
            },
          ]
        : [];

      await transporter.sendMail({
        from: smtpFrom,
        to: recipientEmail,
        subject: `Your Certificate: ${cert.certificateTitle} (${cert.certificateCode})`,
        text: `Congratulations ${cert.userName},\n\nYou have earned ${cert.certificateTitle} for completing "${cert.courseTitle}" with a score of ${cert.score}%.\n\nCertificate ID: ${cert.certificateCode}\nIssued by: ${cert.issuerName}\nIssued on: ${new Date(cert.issuedAt).toLocaleDateString()}`,
        attachments,
      });

      const updated: CertificateRecord = {
        ...cert,
        emailedCount: cert.emailedCount + 1,
        lastEmailedAt: new Date().toISOString(),
      };
      await db.updateCertificate(cert._id, updated);

      res.json({
        deliveredViaSmtp: true,
        recipientEmail,
        certificate: updated,
        message: `Certificate PDF emailed to ${recipientEmail}.`,
      });
    } catch (err) {
      console.error('Email error:', err);
      res.status(500).json({ error: 'Unable to send certificate email.' });
    }
  });

  // ---- Native Android Studio Project Archive ----
  app.get('/api/android-project.zip', (_req, res) => {
    try {
      const androidDir = path.resolve(process.cwd(), 'android');
      const dataDir = path.resolve(process.cwd(), '.data');
      if (!fs.existsSync(androidDir)) {
        res.status(404).json({ error: 'Android project directory not found.' });
        return;
      }
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const zipPath = path.join(dataDir, 'certifield-android-app.zip');
      execFileSync(
        'python3',
        [
          '-c',
          'import os, zipfile, sys; src, dst = sys.argv[1], sys.argv[2]; zf = zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED);\nfor r, _, fs in os.walk(src):\n for f in fs:\n  p = os.path.join(r, f)\n  zf.write(p, os.path.relpath(p, os.path.dirname(src)))\nzf.close()',
          androidDir,
          zipPath,
        ],
        { timeout: 10000 }
      );
      res.download(zipPath, 'certifield-android-app.zip');
    } catch (err) {
      console.error('Android archive error:', err);
      res.status(500).json({ error: 'Unable to package Android project.' });
    }
  });

  // ---- Vite Dev Middleware / Production Static ----
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CertiField server listening on http://localhost:${PORT} [${db.getMode()}]`);
  });
}

startServer().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
