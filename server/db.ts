import fs from 'node:fs';
import path from 'node:path';
import { MongoClient, type Collection, type Db } from 'mongodb';
import type {
  CertificateRecord,
  Course,
  CourseSubmission,
  SystemBranding,
  UserAccount,
} from '../src/types/training.ts';
import { getDefaultSystemBranding } from '../src/utils/certificateDefaults.ts';
import { getSeedCourses } from './seedData.ts';

export interface StoredUser extends UserAccount {
  passwordHash: string;
}

export interface AdminSettingsDoc {
  _id: string;
  adminPasscodeHash?: string;
  claimedAt?: string;
  branding?: SystemBranding;
}

interface LocalDbSchema {
  courses: Course[];
  users: StoredUser[];
  submissions: CourseSubmission[];
  certificates: CertificateRecord[];
  settings: AdminSettingsDoc[];
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const LOCAL_DB_PATH = path.join(DATA_DIR, 'certify_db.json');

class DatabaseRepository {
  private mongoClient: MongoClient | null = null;
  private mongoDb: Db | null = null;
  private mode: 'mongodb' | 'local-store' = 'local-store';
  private localData: LocalDbSchema = {
    courses: [],
    users: [],
    submissions: [],
    certificates: [],
    settings: [],
  };

  async init(): Promise<void> {
    const uri = process.env.MONGODB_URI?.trim();
    if (uri) {
      try {
        this.mongoClient = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
        await this.mongoClient.connect();
        this.mongoDb = this.mongoClient.db('certifield');
        this.mode = 'mongodb';
        await this.seedIfEmpty();
        return;
      } catch (err) {
        console.warn('MongoDB connection failed, falling back to local persistent store:', err);
      }
    }

    this.mode = 'local-store';
    this.loadLocal();
    await this.seedIfEmpty();
  }

  getMode(): 'mongodb' | 'local-store' {
    return this.mode;
  }

  private loadLocal(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(LOCAL_DB_PATH)) {
      try {
        const raw = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<LocalDbSchema>;
        this.localData = {
          courses: Array.isArray(parsed.courses) ? parsed.courses : [],
          users: Array.isArray(parsed.users) ? parsed.users : [],
          submissions: Array.isArray(parsed.submissions) ? parsed.submissions : [],
          certificates: Array.isArray(parsed.certificates) ? parsed.certificates : [],
          settings: Array.isArray(parsed.settings) ? parsed.settings : [],
        };
      } catch {
        this.localData = { courses: [], users: [], submissions: [], certificates: [], settings: [] };
      }
    }
  }

  private saveLocal(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpPath = `${LOCAL_DB_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(this.localData, null, 2), 'utf-8');
    fs.renameSync(tmpPath, LOCAL_DB_PATH);
  }

  private col<T extends { _id: string }>(name: string): Collection<T> {
    if (!this.mongoDb) {
      throw new Error('MongoDB not connected');
    }
    return this.mongoDb.collection<T>(name);
  }

  private async seedIfEmpty(): Promise<void> {
    if (this.mode === 'mongodb') {
      const count = await this.col<Course>('courses').countDocuments();
      if (count === 0) {
        await this.col<Course>('courses').insertMany(getSeedCourses());
      }
    } else if (this.localData.courses.length === 0) {
      this.localData.courses = getSeedCourses();
      this.saveLocal();
    }
  }

  // ---- Courses ----
  async listCourses(includeDrafts: boolean): Promise<Course[]> {
    if (this.mode === 'mongodb') {
      const filter = includeDrafts ? {} : { published: true };
      return this.col<Course>('courses').find(filter).sort({ createdAt: -1 }).toArray();
    }
    const list = includeDrafts
      ? this.localData.courses
      : this.localData.courses.filter((c) => c.published);
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getCourseById(id: string): Promise<Course | null> {
    if (this.mode === 'mongodb') {
      return this.col<Course>('courses').findOne({ _id: id });
    }
    return this.localData.courses.find((c) => c._id === id) ?? null;
  }

  async createCourse(course: Course): Promise<Course> {
    if (this.mode === 'mongodb') {
      await this.col<Course>('courses').insertOne(course);
      return course;
    }
    this.localData.courses.unshift(course);
    this.saveLocal();
    return course;
  }

  async updateCourse(id: string, course: Course): Promise<Course | null> {
    if (this.mode === 'mongodb') {
      const res = await this.col<Course>('courses').replaceOne({ _id: id }, course);
      return res.matchedCount > 0 ? course : null;
    }
    const idx = this.localData.courses.findIndex((c) => c._id === id);
    if (idx === -1) return null;
    this.localData.courses[idx] = course;
    this.saveLocal();
    return course;
  }

  async deleteCourse(id: string): Promise<boolean> {
    if (this.mode === 'mongodb') {
      const res = await this.col<Course>('courses').deleteOne({ _id: id });
      return res.deletedCount > 0;
    }
    const prevLen = this.localData.courses.length;
    this.localData.courses = this.localData.courses.filter((c) => c._id !== id);
    if (this.localData.courses.length !== prevLen) {
      this.saveLocal();
      return true;
    }
    return false;
  }

  // ---- Users ----
  async findUserByEmail(email: string): Promise<StoredUser | null> {
    const normalized = email.trim().toLowerCase();
    if (this.mode === 'mongodb') {
      return this.col<StoredUser>('users').findOne({ email: normalized });
    }
    return this.localData.users.find((u) => u.email.toLowerCase() === normalized) ?? null;
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    if (this.mode === 'mongodb') {
      return this.col<StoredUser>('users').findOne({ _id: id });
    }
    return this.localData.users.find((u) => u._id === id) ?? null;
  }

  async createUser(user: StoredUser): Promise<StoredUser> {
    if (this.mode === 'mongodb') {
      await this.col<StoredUser>('users').insertOne(user);
      return user;
    }
    this.localData.users.push(user);
    this.saveLocal();
    return user;
  }

  // ---- Admin Settings ----
  async getAdminSettings(): Promise<AdminSettingsDoc | null> {
    if (this.mode === 'mongodb') {
      return this.col<AdminSettingsDoc>('settings').findOne({ _id: 'admin' });
    }
    return this.localData.settings.find((s) => s._id === 'admin') ?? null;
  }

  async setAdminPasscodeHash(hash: string): Promise<void> {
    const doc: AdminSettingsDoc = {
      _id: 'admin',
      adminPasscodeHash: hash,
      claimedAt: new Date().toISOString(),
    };
    if (this.mode === 'mongodb') {
      await this.col<AdminSettingsDoc>('settings').updateOne(
        { _id: 'admin' },
        { $set: doc },
        { upsert: true }
      );
      return;
    }
    const idx = this.localData.settings.findIndex((s) => s._id === 'admin');
    if (idx === -1) this.localData.settings.push(doc);
    else this.localData.settings[idx] = doc;
    this.saveLocal();
  }

  async getSystemBranding(): Promise<SystemBranding> {
    if (this.mode === 'mongodb') {
      const doc = await this.col<AdminSettingsDoc>('settings').findOne({ _id: 'system_branding' });
      return doc?.branding ?? getDefaultSystemBranding();
    }
    const doc = this.localData.settings.find((s) => s._id === 'system_branding');
    return doc?.branding ?? getDefaultSystemBranding();
  }

  async saveSystemBranding(branding: SystemBranding): Promise<SystemBranding> {
    const doc: AdminSettingsDoc = {
      _id: 'system_branding',
      branding,
    };
    if (this.mode === 'mongodb') {
      await this.col<AdminSettingsDoc>('settings').updateOne(
        { _id: 'system_branding' },
        { $set: doc },
        { upsert: true }
      );
      return branding;
    }
    const idx = this.localData.settings.findIndex((s) => s._id === 'system_branding');
    if (idx === -1) this.localData.settings.push(doc);
    else this.localData.settings[idx] = doc;
    this.saveLocal();
    return branding;
  }

  // ---- Submissions ----
  async createSubmission(submission: CourseSubmission): Promise<CourseSubmission> {
    if (this.mode === 'mongodb') {
      await this.col<CourseSubmission>('submissions').insertOne(submission);
      return submission;
    }
    this.localData.submissions.unshift(submission);
    this.saveLocal();
    return submission;
  }

  async listSubmissionsByUser(userId: string): Promise<CourseSubmission[]> {
    if (this.mode === 'mongodb') {
      return this.col<CourseSubmission>('submissions')
        .find({ userId })
        .sort({ submittedAt: -1 })
        .toArray();
    }
    return this.localData.submissions
      .filter((s) => s.userId === userId)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }

  async listAllSubmissions(): Promise<CourseSubmission[]> {
    if (this.mode === 'mongodb') {
      return this.col<CourseSubmission>('submissions')
        .find({})
        .sort({ submittedAt: -1 })
        .toArray();
    }
    return [...this.localData.submissions].sort((a, b) =>
      b.submittedAt.localeCompare(a.submittedAt)
    );
  }

  async getSubmissionById(id: string): Promise<CourseSubmission | null> {
    if (this.mode === 'mongodb') {
      return this.col<CourseSubmission>('submissions').findOne({ _id: id });
    }
    return this.localData.submissions.find((s) => s._id === id) ?? null;
  }

  async updateSubmission(id: string, submission: CourseSubmission): Promise<CourseSubmission | null> {
    if (this.mode === 'mongodb') {
      const res = await this.col<CourseSubmission>('submissions').replaceOne({ _id: id }, submission);
      return res.matchedCount > 0 ? submission : null;
    }
    const idx = this.localData.submissions.findIndex((s) => s._id === id);
    if (idx === -1) return null;
    this.localData.submissions[idx] = submission;
    this.saveLocal();
    return submission;
  }

  // ---- Certificates ----
  async createCertificate(cert: CertificateRecord): Promise<CertificateRecord> {
    if (this.mode === 'mongodb') {
      await this.col<CertificateRecord>('certificates').insertOne(cert);
      return cert;
    }
    this.localData.certificates.unshift(cert);
    this.saveLocal();
    return cert;
  }

  async listCertificatesByUser(userId: string): Promise<CertificateRecord[]> {
    if (this.mode === 'mongodb') {
      return this.col<CertificateRecord>('certificates')
        .find({ userId })
        .sort({ issuedAt: -1 })
        .toArray();
    }
    return this.localData.certificates
      .filter((c) => c.userId === userId)
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  }

  async getCertificateById(id: string): Promise<CertificateRecord | null> {
    if (this.mode === 'mongodb') {
      return this.col<CertificateRecord>('certificates').findOne({ _id: id });
    }
    return this.localData.certificates.find((c) => c._id === id) ?? null;
  }

  async updateCertificate(id: string, cert: CertificateRecord): Promise<CertificateRecord | null> {
    if (this.mode === 'mongodb') {
      const res = await this.col<CertificateRecord>('certificates').replaceOne({ _id: id }, cert);
      return res.matchedCount > 0 ? cert : null;
    }
    const idx = this.localData.certificates.findIndex((c) => c._id === id);
    if (idx === -1) return null;
    this.localData.certificates[idx] = cert;
    this.saveLocal();
    return cert;
  }
}

export const db = new DatabaseRepository();
