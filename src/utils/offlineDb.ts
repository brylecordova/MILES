import type {
  Course,
  CourseProgressState,
  PendingOfflineSubmission,
} from '../types/training';
import {
  removeCourseProgressEntryFromLocalStorage,
  writeCourseProgressEntryToLocalStorage,
} from './courseCatalog';

const DB_NAME = 'certifield_offline_v1';
const DB_VERSION = 1;

export interface DownloadedCoursePackage {
  courseId: string;
  course: Course;
  mediaBlobs: Record<string, Blob>;
  downloadedAt: string;
  totalBytes: number;
}

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('courses')) {
        db.createObjectStore('courses', { keyPath: 'courseId' });
      }
      if (!db.objectStoreNames.contains('progress')) {
        db.createObjectStore('progress', { keyPath: 'courseId' });
      }
      if (!db.objectStoreNames.contains('pendingSubmissions')) {
        db.createObjectStore('pendingSubmissions', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbReq<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listDownloadedCourses(): Promise<DownloadedCoursePackage[]> {
  const db = await openOfflineDb();
  const tx = db.transaction('courses', 'readonly');
  const store = tx.objectStore('courses');
  return idbReq(store.getAll());
}

export async function getDownloadedCourse(
  courseId: string
): Promise<DownloadedCoursePackage | undefined> {
  const db = await openOfflineDb();
  const tx = db.transaction('courses', 'readonly');
  return idbReq(tx.objectStore('courses').get(courseId));
}

export async function removeDownloadedCourse(courseId: string): Promise<void> {
  const db = await openOfflineDb();
  const tx = db.transaction(['courses', 'progress'], 'readwrite');
  tx.objectStore('courses').delete(courseId);
  tx.objectStore('progress').delete(courseId);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  removeCourseProgressEntryFromLocalStorage(courseId);
}

export function collectCourseMediaUrls(course: Course): string[] {
  const urls = new Set<string>();
  if (course.bannerUrl) urls.add(course.bannerUrl);
  for (const mod of course.modules) {
    if (mod.kind === 'lesson') {
      for (const blk of mod.blocks) {
        if ((blk.type === 'image' || blk.type === 'video') && blk.url) {
          urls.add(blk.url);
        }
      }
    }
  }
  return Array.from(urls);
}

export async function downloadCourseForOffline(
  course: Course,
  onProgress?: (pct: number) => void
): Promise<DownloadedCoursePackage> {
  const mediaUrls = collectCourseMediaUrls(course);
  const mediaBlobs: Record<string, Blob> = {};
  let totalBytes = new Blob([JSON.stringify(course)]).size;

  const totalSteps = Math.max(1, mediaUrls.length);
  for (let i = 0; i < mediaUrls.length; i += 1) {
    const url = mediaUrls[i];
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const blob = await resp.blob();
        mediaBlobs[url] = blob;
        totalBytes += blob.size;
      }
    } catch {
      // Skip unfetchable external assets gracefully while preserving course data
    }
    onProgress?.(Math.round(((i + 1) / totalSteps) * 100));
  }
  if (mediaUrls.length === 0) {
    onProgress?.(100);
  }

  const pkg: DownloadedCoursePackage = {
    courseId: course._id,
    course,
    mediaBlobs,
    downloadedAt: new Date().toISOString(),
    totalBytes,
  };

  const db = await openOfflineDb();
  const tx = db.transaction(['courses', 'progress'], 'readwrite');
  tx.objectStore('courses').put(pkg);
  const existingProgress = await idbReq<CourseProgressState | undefined>(
    tx.objectStore('progress').get(course._id)
  );
  let createdInitialProgress: CourseProgressState | null = null;
  if (!existingProgress) {
    createdInitialProgress = {
      courseId: course._id,
      currentModuleIndex: 0,
      completedModuleIds: [],
      questionTries: {},
      quizAttempts: {},
      latestAnswers: {},
      latestQuestionResults: {},
      quizResults: {},
      status: 'not_started',
      updatedAt: new Date().toISOString(),
    };
    tx.objectStore('progress').put(createdInitialProgress);
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  if (createdInitialProgress) {
    writeCourseProgressEntryToLocalStorage(createdInitialProgress);
  }

  return pkg;
}

export async function listCourseProgress(): Promise<Record<string, CourseProgressState>> {
  const db = await openOfflineDb();
  const tx = db.transaction('progress', 'readonly');
  const all = await idbReq<CourseProgressState[]>(tx.objectStore('progress').getAll());
  const map: Record<string, CourseProgressState> = {};
  for (const item of all) {
    map[item.courseId] = item;
  }
  return map;
}

export async function saveCourseProgress(progress: CourseProgressState): Promise<void> {
  const db = await openOfflineDb();
  const tx = db.transaction('progress', 'readwrite');
  tx.objectStore('progress').put(progress);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  writeCourseProgressEntryToLocalStorage(progress);
}

export async function listPendingSubmissions(): Promise<PendingOfflineSubmission[]> {
  const db = await openOfflineDb();
  const tx = db.transaction('pendingSubmissions', 'readonly');
  const all = await idbReq<PendingOfflineSubmission[]>(
    tx.objectStore('pendingSubmissions').getAll()
  );
  return all.sort((a, b) => b.completedOfflineAt.localeCompare(a.completedOfflineAt));
}

export async function savePendingSubmission(item: PendingOfflineSubmission): Promise<void> {
  const db = await openOfflineDb();
  const tx = db.transaction('pendingSubmissions', 'readwrite');
  tx.objectStore('pendingSubmissions').put(item);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function removePendingSubmission(id: string): Promise<void> {
  const db = await openOfflineDb();
  const tx = db.transaction('pendingSubmissions', 'readwrite');
  tx.objectStore('pendingSubmissions').delete(id);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
