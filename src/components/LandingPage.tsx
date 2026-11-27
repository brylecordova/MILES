import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MotionConfig, motion, useScroll, useTransform } from 'motion/react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  Film,
  Layers,
  Moon,
  Search,
  ShieldCheck,
  Star,
  Sun,
  X,
} from 'lucide-react';
import type { Course, SystemBranding } from '../types/training';
import { downloadUploadedApk, getLearnerToken } from '../utils/api';
import {
  DEFAULT_SYSTEM_ICON_URL,
  getDefaultCertificateDesign,
  resolveCertificateElementText,
} from '../utils/certificateDefaults';
import {
  COURSE_PROGRESS_STORAGE_KEY,
  computeCourseProgressSummary,
  readCourseProgressFromLocalStorage,
  type StoredLocalProgressEntry,
} from '../utils/courseCatalog';
import {
  computeCatalogBaselineRating,
  getLandingDisplayedCourses,
} from '../utils/courseRating';
import {
  LANDING_NAV_ITEMS,
  computeActiveLandingSection,
  type LandingSectionId,
} from '../utils/landingNav';
import { AndroidIcon } from './AndroidIcon';
import { CertificateVerifier } from './CertificateVerifier';
import { CoursePreviewModal } from './CoursePreviewModal';
import { CourseBannerImage } from './MediaRenderer';

interface LandingPageProps {
  branding: SystemBranding;
  courses: Course[];
  loadingCourses: boolean;
  isDark: boolean;
  isAuthenticated?: boolean;
  onToggleTheme: () => void;
  onOpenInstall: () => void;
}

const EASE_EXPO = [0.16, 1, 0.3, 1] as const;

export const LandingPage: React.FC<LandingPageProps> = ({
  branding,
  courses,
  loadingCourses,
  isDark,
  isAuthenticated,
  onToggleTheme,
  onOpenInstall,
}) => {
  const hasAuthenticatedUser = isAuthenticated ?? Boolean(getLearnerToken());
  const [downloadingApk, setDownloadingApk] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [courseSearch, setCourseSearch] = useState('');
  const [showAllCourses, setShowAllCourses] = useState(false);
  const [previewCourse, setPreviewCourse] = useState<Course | null>(null);
  const [activeSection, setActiveSection] = useState<LandingSectionId>('capabilities');
  const [localProgressMap, setLocalProgressMap] = useState<
    Record<string, StoredLocalProgressEntry>
  >(() => readCourseProgressFromLocalStorage());
  const heroRef = useRef<HTMLElement | null>(null);
  const navScrollLockUntilRef = useRef<number>(0);

  useEffect(() => {
    const syncProgress = () => {
      setLocalProgressMap(readCourseProgressFromLocalStorage());
    };
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === COURSE_PROGRESS_STORAGE_KEY) {
        syncProgress();
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', syncProgress);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', syncProgress);
    };
  }, []);

  useEffect(() => {
    let rafId = 0;
    const updateActiveSection = () => {
      if (Date.now() < navScrollLockUntilRef.current) return;
      const sectionPositions = LANDING_NAV_ITEMS.flatMap((item) => {
        const el = document.getElementById(item.id);
        if (!el) return [];
        const top = el.getBoundingClientRect().top + window.scrollY;
        return [{ id: item.id, top }];
      });
      const next = computeActiveLandingSection({
        scrollY: window.scrollY,
        innerHeight: window.innerHeight,
        docHeight: document.documentElement.scrollHeight,
        sectionPositions,
      });
      setActiveSection((prev) => (prev === next ? prev : next));
    };

    const scheduleUpdate = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateActiveSection);
    };

    updateActiveSection();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate, { passive: true });
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [courses.length, loadingCourses]);

  const filteredCourses = useMemo(
    () => getLandingDisplayedCourses(courses, courseSearch, showAllCourses),
    [courses, courseSearch, showAllCourses]
  );
  const catalogBaselineRating = useMemo(() => computeCatalogBaselineRating(courses), [courses]);
  const { scrollYProgress: heroScrollProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroVisualY = useTransform(heroScrollProgress, [0, 1], [0, 36]);
  const heroVisualScale = useTransform(heroScrollProgress, [0, 1], [1, 0.96]);

  const accent = branding.accentColor || '#1d4ed8';

  const distributionMode = branding.appDistributionMode ?? 'apk_download';
  const apkUrl = branding.apkUrl?.trim() || '';
  const playStoreUrl = branding.playStoreUrl?.trim() || '';
  const isPlayStoreActive = distributionMode === 'play_store';
  const hasPlayStoreUrl = Boolean(playStoreUrl);
  const hasDirectApk = Boolean(apkUrl);
  const isExternalApk = apkUrl.startsWith('http://') || apkUrl.startsWith('https://');

  function handleSmoothAnchor(
    e: React.MouseEvent<HTMLAnchorElement>,
    targetId: 'top' | LandingSectionId
  ) {
    const el = document.getElementById(targetId);
    if (!el) return;
    e.preventDefault();
    const resolvedSection: LandingSectionId =
      targetId === 'top' ? LANDING_NAV_ITEMS[0].id : targetId;
    navScrollLockUntilRef.current = Date.now() + 750;
    setActiveSection(resolvedSection);
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }

  async function handleDirectApkDownload() {
    if (!hasDirectApk) {
      onOpenInstall();
      return;
    }
    setDownloadingApk(true);
    setDownloadError(null);
    try {
      await downloadUploadedApk(branding.apkFileName || undefined);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Unable to download Android APK.');
    } finally {
      setDownloadingApk(false);
    }
  }

  function renderDownloadAppAction(variant: 'hero' | 'catalog' | 'banner'): React.ReactNode {
    const className =
      variant === 'catalog'
        ? 'inline-flex min-h-[40px] shrink-0 items-center gap-2 self-start whitespace-nowrap rounded-xl border border-slate-300/90 bg-white/85 px-4 text-xs font-semibold text-slate-800 backdrop-blur-md transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100 dark:hover:bg-slate-800'
        : 'inline-flex min-h-[48px] shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-6 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60';

    const style = variant === 'catalog' ? undefined : { backgroundColor: accent };
    const icon = isPlayStoreActive ? (
      <ExternalLink className="h-4 w-4" />
    ) : (
      <Download className="h-4 w-4" />
    );

    const label =
      variant === 'catalog'
        ? 'Download App to Enroll'
        : downloadingApk && !isPlayStoreActive
        ? 'Downloading .apk...'
        : 'Download App';

    if (isPlayStoreActive) {
      if (hasPlayStoreUrl) {
        return (
          <a
            href={playStoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={style}
            className={className}
          >
            {icon}
            <span>{label}</span>
          </a>
        );
      }
      return (
        <button type="button" onClick={onOpenInstall} style={style} className={className}>
          {icon}
          <span>{label}</span>
        </button>
      );
    }

    if (hasDirectApk && isExternalApk) {
      return (
        <a
          href={apkUrl}
          target="_blank"
          rel="noopener noreferrer"
          download
          style={style}
          className={className}
        >
          {icon}
          <span>{label}</span>
        </a>
      );
    }

    return (
      <button
        type="button"
        disabled={downloadingApk}
        onClick={handleDirectApkDownload}
        style={style}
        className={className}
      >
        {icon}
        <span>{label}</span>
      </button>
    );
  }

  const featuredCourse = courses[0];
  const sampleDesign =
    featuredCourse?.certificateDesign ??
    getDefaultCertificateDesign(
      featuredCourse?.issuerName || `${branding.systemName} Academy`,
      featuredCourse?.certificateTitle || 'Field Safety & Compliance Specialist'
    );

  const sampleCert = {
    userName: 'Elena Rostova',
    courseTitle: featuredCourse?.title || 'Industrial Lockout / Tagout & Hazard Control',
    certificateTitle:
      featuredCourse?.certificateTitle || 'Field Safety & Compliance Specialist',
    issuerName: featuredCourse?.issuerName || `${branding.systemName} Academy`,
    score: 96,
    issuedAt: '2026-05-15T12:00:00.000Z',
    certificateCode: 'CF-2026-8419A2',
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen pb-16 text-slate-900 md:pb-0 dark:text-slate-100">
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/80">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:h-16 sm:gap-6 sm:px-6">
            {/* Zone 1: Dynamic System Icon + Name */}
            <a
              href="#top"
              onClick={(e) => handleSmoothAnchor(e, 'top')}
              className="flex shrink-0 items-center gap-2.5 whitespace-nowrap"
            >
              <img
                src={branding.iconUrl || DEFAULT_SYSTEM_ICON_URL}
                alt={`${branding.systemName} icon`}
                referrerPolicy="no-referrer"
                className="h-8 w-8 rounded-lg object-contain"
              />
              <span className="font-display text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                {branding.systemName}
              </span>
            </a>

            {/* Zone 2: Clean Anchor Navigation with Smooth Animated Active Underline */}
            <nav aria-label="Landing navigation" className="hidden items-center gap-7 md:flex">
              {LANDING_NAV_ITEMS.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    onClick={(e) => handleSmoothAnchor(e, item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`relative py-2 text-sm whitespace-nowrap transition-colors duration-200 ${
                      isActive
                        ? 'font-semibold text-slate-900 dark:text-white'
                        : 'font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                    }`}
                  >
                    <span>{item.label}</span>
                    {isActive && (
                      <motion.span
                        layoutId="landing-nav-active-underline"
                        aria-hidden="true"
                        transition={{
                          type: 'spring',
                          stiffness: 420,
                          damping: 34,
                          mass: 0.7,
                        }}
                        style={{ backgroundColor: isDark ? '#38bdf8' : accent }}
                        className="pointer-events-none absolute right-0 bottom-0 left-0 h-[2.5px] rounded-full"
                      />
                    )}
                  </a>
                );
              })}
            </nav>

            {/* Zone 3: Dark Mode Toggle */}
            <div className="flex shrink-0 items-center">
              <button
                type="button"
                data-testid="theme-toggle"
                onClick={onToggleTheme}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white/80 text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </header>

        <main id="top" className="overflow-x-clip">
          {/* Section 1: Hero — Kinetic Split-Stage & Scroll Depth Parallax */}
          <section
            ref={heroRef}
            className="mx-auto max-w-7xl px-4 pt-12 pb-16 sm:px-6 lg:pt-16 lg:pb-24"
          >
            <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="flex max-w-xl flex-col justify-center">
                <motion.p
                  initial={{ opacity: 0, x: -26 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, ease: EASE_EXPO }}
                  className="font-mono-tabular text-xs font-bold tracking-widest uppercase"
                  style={{ color: isDark ? '#38bdf8' : accent }}
                >
                  {branding.systemName} · Mobile Learning Experience System
                </motion.p>

                <motion.h1
                  initial={{ opacity: 0, y: 28, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ duration: 0.65, delay: 0.08, ease: EASE_EXPO }}
                  className="font-display mt-3 text-4xl font-extrabold tracking-tight text-slate-900 text-balance dark:text-white sm:text-5xl"
                >
                  Offline mobile training that ends in verifiable PDF certificates.
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.18, ease: EASE_EXPO }}
                  className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg"
                >
                  Welcome to the Mobile Learning Experience System. Learners sign in directly
                  inside the Android app, download full video courses for offline field study,
                  complete multi-format assessments, and earn official PDF credentials.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 18, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    type: 'spring',
                    stiffness: 260,
                    damping: 22,
                    delay: 0.26,
                  }}
                  className="mt-7 flex flex-wrap items-center gap-3"
                >
                  {renderDownloadAppAction('hero')}
                  <a
                    href="#courses"
                    onClick={(e) => handleSmoothAnchor(e, 'courses')}
                    className="flex min-h-[48px] items-center whitespace-nowrap rounded-xl border border-slate-300/90 bg-white/85 px-5 text-sm font-semibold text-slate-800 backdrop-blur-md transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    Preview Available Courses
                  </a>
                </motion.div>

                {downloadError && (
                  <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300">
                    {downloadError}
                  </p>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.36, ease: EASE_EXPO }}
                  className="mt-7 grid gap-2.5 sm:grid-cols-3"
                >
                  {[
                    { label: 'Playback', value: 'Offline MP4 Video' },
                    { label: 'Credentials', value: 'A4 PDF Export' },
                    {
                      label: 'Distribution',
                      value: isPlayStoreActive
                        ? 'Google Play Store'
                        : hasDirectApk
                        ? `APK v${branding.apkVersion || '1.0.0'}`
                        : 'Android App',
                    },
                  ].map((spec) => (
                    <div
                      key={spec.label}
                      className="rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2 backdrop-blur-xs dark:border-slate-800/80 dark:bg-slate-900/60"
                    >
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {spec.label}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {spec.value}
                      </p>
                    </div>
                  ))}
                </motion.div>
              </div>

              <div className="[perspective:1200px]">
                <motion.div
                  initial={{ opacity: 0, x: 48, scale: 0.92, rotateY: -8 }}
                  animate={{ opacity: 1, x: 0, scale: 1, rotateY: 0 }}
                  transition={{ duration: 0.8, delay: 0.14, ease: EASE_EXPO }}
                  style={{ y: heroVisualY, scale: heroVisualScale }}
                  className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 p-1.5 shadow-lg backdrop-blur-md dark:border-slate-800/90 dark:bg-slate-900/75 dark:shadow-cyan-950/30"
                >
                  <div className="overflow-hidden rounded-xl">
                    <img
                      src="/src/assets/images/hero_mobile_certification_1795696801213.jpg"
                      alt={`${branding.systemName} mobile certification in action`}
                      referrerPolicy="no-referrer"
                      className="block aspect-video w-full object-cover"
                    />
                  </div>
                </motion.div>
              </div>
            </div>
          </section>

          {/* Section 2: Capabilities Bento — Staggered Spring Wave Cascade */}
          <section
            id="capabilities"
            className="border-y border-slate-200/80 bg-white/70 py-16 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/55 lg:py-20"
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <motion.div
                initial={{ opacity: 0, x: -32 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.55, ease: EASE_EXPO }}
                className="max-w-2xl"
              >
                <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                  Built for field teams without reliable Wi-Fi.
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300 sm:text-base">
                  Every course module, embedded training video, illustration, and quiz checkpoint
                  stays stored locally inside the Android application until the learner finishes and
                  syncs.
                </p>
              </motion.div>

              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.15 }}
                variants={{
                  hidden: {},
                  visible: {
                    transition: {
                      staggerChildren: 0.1,
                      delayChildren: 0.08,
                    },
                  },
                }}
                className="mt-10 grid gap-5 [perspective:1000px] md:grid-cols-2 lg:grid-cols-4"
              >
                {[
                  {
                    num: '01',
                    icon: <Film className="h-5 w-5" />,
                    title: 'Offline Video & Lessons',
                    body: 'Download complete courses—including MP4 videos, diagrams, and formatted guides—for uninterrupted playback with zero signal.',
                  },
                  {
                    num: '02',
                    icon: <Layers className="h-5 w-5" />,
                    title: 'Flexible Quiz Rules',
                    body: 'Multiple choice, true/false, select-all, and essay checkpoints placed after any sequence of lessons with custom retry rules.',
                  },
                  {
                    num: '03',
                    icon: <CheckCircle2 className="h-5 w-5" />,
                    title: 'Answer Diagnostics & Sync',
                    body: 'Post-completion breakdowns show correct vs. weak topics with explanations. Offline completions queue safely until online.',
                  },
                  {
                    num: '04',
                    icon: <Award className="h-5 w-5" />,
                    title: 'Custom PDF Certificates',
                    body: 'Approved completions issue high-resolution A4 PDF certificates learners can view, download, or email from their phone.',
                  },
                ].map((item) => (
                  <motion.article
                    key={item.num}
                    variants={{
                      hidden: { opacity: 0, y: 38, scale: 0.9, rotateX: 12 },
                      visible: {
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        rotateX: 0,
                        transition: {
                          type: 'spring',
                          stiffness: 230,
                          damping: 20,
                        },
                      },
                    }}
                    whileHover={{ y: -5, transition: { duration: 0.2 } }}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white/80 p-6 backdrop-blur-md transition-shadow duration-200 hover:shadow-md dark:border-slate-800/80 dark:bg-slate-950/70"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono-tabular text-xs font-bold text-slate-400 dark:text-slate-500">
                          {item.num}
                        </span>
                        <span style={{ color: isDark ? '#38bdf8' : accent }}>{item.icon}</span>
                      </div>
                      <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        {item.body}
                      </p>
                    </div>
                  </motion.article>
                ))}
              </motion.div>
            </div>
          </section>

          {/* Section 3: Course Catalog — Opposing Header Split & Deck Unfold */}
          <section id="courses" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <motion.div
                initial={{ opacity: 0, x: -34 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.55, ease: EASE_EXPO }}
              >
                <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                  Published Training Catalog
                </h2>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
                  Preview available certification programs below. Sign in inside the{' '}
                  {branding.systemName} Android app to download courses and earn credentials.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 34 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.55, delay: 0.08, ease: EASE_EXPO }}
              >
                {renderDownloadAppAction('catalog')}
              </motion.div>
            </div>

            {!loadingCourses && courses.length > 0 && (
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-md">
                  <label htmlFor="course-catalog-search" className="sr-only">
                    Search courses by title or description
                  </label>
                  <Search className="pointer-events-none absolute top-1/2 left-3.5 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="course-catalog-search"
                    type="search"
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    placeholder="Search courses..."
                    className="min-h-[44px] w-full rounded-xl border border-slate-300/90 bg-white/90 pr-10 pl-10 text-sm text-slate-900 placeholder:text-slate-400 backdrop-blur-md focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100 dark:focus:border-sky-400"
                  />
                  {courseSearch && (
                    <button
                      type="button"
                      onClick={() => setCourseSearch('')}
                      aria-label="Clear course search"
                      className="absolute top-1/2 right-2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <p
                    aria-live="polite"
                    className="font-mono-tabular text-xs font-medium text-slate-500 dark:text-slate-400"
                  >
                    {courseSearch.trim()
                      ? `Showing ${filteredCourses.length} of ${courses.length} ${
                          courses.length === 1 ? 'course' : 'courses'
                        }`
                      : courses.length > 3 && !showAllCourses
                      ? `Top 3 most popular of ${courses.length} courses`
                      : `Top ${courses.length} most popular ${
                          courses.length === 1 ? 'course' : 'courses'
                        }`}
                  </p>
                  {courses.length > 3 && !courseSearch.trim() && (
                    <button
                      type="button"
                      onClick={() => setShowAllCourses((prev) => !prev)}
                      className="text-xs font-semibold text-blue-700 underline-offset-4 hover:underline dark:text-sky-400"
                    >
                      {showAllCourses ? 'Show top 3' : `View all (${courses.length})`}
                    </button>
                  )}
                </div>
              </div>
            )}

            {loadingCourses ? (
              <div className="mt-8 grid gap-6 md:grid-cols-3">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white/75 dark:border-slate-800 dark:bg-slate-900/60"
                  />
                ))}
              </div>
            ) : courses.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.45, ease: EASE_EXPO }}
                className="mt-8 rounded-2xl border border-slate-200/80 bg-white/80 p-10 text-center text-sm text-slate-500 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/75 dark:text-slate-400"
              >
                Courses are being prepared for mobile distribution.
              </motion.div>
            ) : filteredCourses.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-dashed border-slate-300/90 bg-white/75 p-10 text-center backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-900/65">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  No courses match &ldquo;{courseSearch.trim()}&rdquo;
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Try another keyword from a course title or description.
                </p>
                <button
                  type="button"
                  onClick={() => setCourseSearch('')}
                  className="mt-4 inline-flex min-h-[38px] items-center rounded-xl border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredCourses.map((course, idx) => {
                  const lessonCount = course.modules.filter((m) => m.kind === 'lesson').length;
                  const quizCount = course.modules.filter((m) => m.kind === 'quiz').length;
                  const ratingCount = course.ratingCount ?? 0;
                  const averageRating = course.averageRating ?? 0;
                  const progressSummary = hasAuthenticatedUser
                    ? computeCourseProgressSummary(course, localProgressMap)
                    : null;
                  const statusLabel = progressSummary
                    ? progressSummary.status === 'completed'
                      ? 'Completed'
                      : progressSummary.status === 'in_progress'
                      ? 'In Progress'
                      : 'Not Started'
                    : null;
                  const badgeClass = progressSummary
                    ? progressSummary.status === 'completed'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : progressSummary.status === 'in_progress'
                      ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-sky-800/70 dark:bg-sky-950/60 dark:text-sky-300'
                      : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300'
                    : '';
                  const barColor =
                    progressSummary?.status === 'completed'
                      ? '#10b981'
                      : isDark
                      ? '#38bdf8'
                      : accent;

                  return (
                    <motion.article
                      key={course._id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Preview course: ${course.title}`}
                      onClick={() => setPreviewCourse(course)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setPreviewCourse(course);
                        }
                      }}
                      initial={{
                        opacity: 0,
                        y: 48,
                        scale: 0.92,
                        rotate: idx % 2 === 0 ? -1.8 : 1.8,
                      }}
                      whileInView={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                      viewport={{ once: true, amount: 0.15 }}
                      transition={{
                        delay: (idx % 3) * 0.1,
                        type: 'spring',
                        stiffness: 205,
                        damping: 22,
                      }}
                      whileHover={{ y: -6, transition: { duration: 0.2 } }}
                      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/85 backdrop-blur-md transition-all duration-200 hover:border-blue-400/80 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:border-slate-800/80 dark:bg-slate-900/75 dark:hover:border-sky-500/70"
                    >
                      <CourseBannerImage
                        url={course.bannerUrl}
                        title={course.title}
                        className="aspect-video w-full border-b border-slate-100 dark:border-slate-800"
                      />
                      <div className="flex flex-1 flex-col p-5">
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className="text-xs font-semibold leading-snug"
                            style={{ color: isDark ? '#38bdf8' : accent }}
                          >
                            {course.category}
                          </span>
                          {hasAuthenticatedUser && statusLabel && (
                            <span
                              className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${badgeClass}`}
                            >
                              {statusLabel}
                            </span>
                          )}
                        </div>
                        <h3 className="mt-2 text-lg font-bold leading-snug text-slate-900 dark:text-white">
                          {course.title}
                        </h3>
                        <p className="mt-1.5 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                          {course.description}
                        </p>

                        {/* Structured 2-Column Spec & Rating Grid */}
                        <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs dark:border-slate-800/80 dark:bg-slate-950/55">
                          <div>
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              Curriculum
                            </p>
                            <p className="font-mono-tabular mt-0.5 font-semibold text-slate-800 dark:text-slate-200">
                              {lessonCount} {lessonCount === 1 ? 'lesson' : 'lessons'}, {quizCount}{' '}
                              {quizCount === 1 ? 'quiz' : 'quizzes'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              Rating
                            </p>
                            <p className="font-mono-tabular mt-0.5 inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                              <Star
                                className={`h-3.5 w-3.5 ${
                                  ratingCount > 0
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-slate-300 dark:text-slate-600'
                                }`}
                              />
                              {ratingCount > 0 ? (
                                <span>
                                  {averageRating.toFixed(1)} ({ratingCount})
                                </span>
                              ) : (
                                <span className="font-normal text-slate-500 dark:text-slate-400">
                                  No ratings
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Local Storage Progress Bar (Logged-in users only) */}
                        {hasAuthenticatedUser && progressSummary && (
                          <div className="mt-4 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                              <span>
                                {progressSummary.hasSavedProgress
                                  ? `${progressSummary.completedModules}/${progressSummary.totalModules} modules completed`
                                  : 'Local progress'}
                              </span>
                              <span className="font-mono-tabular font-semibold text-slate-800 dark:text-slate-200">
                                {progressSummary.percent}%
                              </span>
                            </div>
                            <div
                              role="progressbar"
                              aria-label={`${course.title} progress`}
                              aria-valuenow={progressSummary.percent}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                            >
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${progressSummary.percent}%`,
                                  backgroundColor: barColor,
                                }}
                              />
                            </div>
                          </div>
                        )}

                        <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              Credential
                            </p>
                            <p className="truncate font-semibold text-slate-800 dark:text-slate-200">
                              {course.certificateTitle}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewCourse(course);
                            }}
                            className="inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/80 px-2.5 font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-sky-800/70 dark:bg-sky-950/60 dark:text-sky-300 dark:hover:bg-sky-900/60"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Preview Course</span>
                          </button>
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Section 4: Certificate Showcase — Converging Split & Seal Stamp Elevation */}
          <section
            id="certificates"
            className="border-y border-slate-200/80 bg-white/70 py-16 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/55 lg:py-20"
          >
            <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
              <motion.div
                initial={{ opacity: 0, x: -46 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.65, ease: EASE_EXPO }}
              >
                <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                  Custom-designed PDF certificates per course.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300 sm:text-base">
                  Every course issues a tailored A4 landscape PDF certificate bearing your system
                  seal, learner full name, assessment score, issue date, and unique verification ID.
                  Learners can preview and email PDFs straight from their Android device.
                </p>
                <ul className="mt-5 space-y-2.5 text-sm text-slate-700 dark:text-slate-200">
                  {[
                    'Unique verification ID stamped on every approved submission',
                    'Generated natively as PDF inside the Android app',
                    'One-tap email delivery to your personal or supervisor inbox',
                  ].map((line, idx) => (
                    <motion.li
                      key={line}
                      initial={{ opacity: 0, x: -22 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, amount: 0.3 }}
                      transition={{
                        duration: 0.45,
                        delay: 0.16 + idx * 0.1,
                        ease: EASE_EXPO,
                      }}
                      className="flex items-center gap-2.5"
                    >
                      <CheckCircle2
                        className="h-4 w-4 shrink-0"
                        style={{ color: isDark ? '#38bdf8' : accent }}
                      />
                      <span>{line}</span>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>

              <div className="[perspective:1200px]">
                <motion.div
                  initial={{ opacity: 0, x: 52, scale: 0.9, rotateY: 8 }}
                  whileInView={{ opacity: 1, x: 0, scale: 1, rotateY: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{
                    type: 'spring',
                    stiffness: 175,
                    damping: 20,
                    delay: 0.1,
                  }}
                  whileHover={{ y: -4, scale: 1.01, transition: { duration: 0.25 } }}
                  className="relative aspect-[842/595] w-full overflow-hidden rounded-2xl border border-slate-200 shadow-lg dark:border-slate-700"
                  style={{ backgroundColor: sampleDesign.canvasBackground || '#ffffff' }}
                >
                  {sampleDesign.backgroundImageUrl && (
                    <img
                      src={sampleDesign.backgroundImageUrl}
                      alt="Sample certificate backdrop"
                      referrerPolicy="no-referrer"
                      className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-35"
                    />
                  )}
                  {sampleDesign.showBorder && (
                    <>
                      <div
                        className="pointer-events-none absolute inset-[4%] border-[3px]"
                        style={{ borderColor: sampleDesign.borderColor || '#0f172a' }}
                      />
                      <div
                        className="pointer-events-none absolute inset-[5.4%] border"
                        style={{ borderColor: sampleDesign.accentColor || accent }}
                      />
                    </>
                  )}
                  {sampleDesign.elements
                    .filter((el) => el.visible)
                    .map((el) => {
                      const translateX =
                        el.align === 'left' ? '0%' : el.align === 'right' ? '-100%' : '-50%';
                      const fontFamilyClass =
                        el.fontFamily === 'serif'
                          ? 'font-serif'
                          : el.fontFamily === 'mono'
                          ? 'font-mono-tabular'
                          : 'font-sans';
                      return (
                        <div
                          key={el.id}
                          style={{
                            left: `${el.xPct}%`,
                            top: `${el.yPct}%`,
                            transform: `translate(${translateX}, -50%)`,
                            color: el.color,
                            fontSize: `clamp(7px, ${(el.fontSize / 842) * 86}vw, ${el.fontSize * 0.78}px)`,
                            fontWeight: el.fontWeight === 'bold' ? 700 : 400,
                            textAlign: el.align,
                          }}
                          className={`absolute whitespace-nowrap ${fontFamilyClass}`}
                        >
                          {el.kind === 'system_icon' ? (
                            <motion.div
                              initial={{ scale: 0.25, opacity: 0, rotate: -25 }}
                              whileInView={{ scale: 1, opacity: 1, rotate: 0 }}
                              viewport={{ once: true, amount: 0.3 }}
                              transition={{
                                delay: 0.36,
                                type: 'spring',
                                stiffness: 320,
                                damping: 16,
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-full"
                              style={{ backgroundColor: sampleDesign.accentColor || accent }}
                            >
                              <img
                                src={branding.iconUrl || DEFAULT_SYSTEM_ICON_URL}
                                alt={branding.systemName}
                                referrerPolicy="no-referrer"
                                className="h-5 w-5 rounded object-contain"
                              />
                            </motion.div>
                          ) : (
                            <span>{resolveCertificateElementText(el, sampleCert)}</span>
                          )}
                        </div>
                      );
                    })}
                </motion.div>
              </div>
            </div>
          </section>

          {/* Section 4b: Certificate Verifier */}
          <section id="verify" className="mx-auto max-w-7xl py-16 lg:py-20">
            <CertificateVerifier branding={branding} isDark={isDark} />
          </section>

          {/* Section 5: Android App Banner — Horizon Expansion & Converging Feature Panel */}
          <section id="get-app" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
            <motion.div
              initial={{ opacity: 0, y: 44, scale: 0.94 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.65, ease: EASE_EXPO }}
              className="rounded-3xl border border-slate-200/80 bg-slate-900/95 p-8 text-white shadow-xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/85 sm:p-12"
            >
              <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
                <motion.div
                  initial={{ opacity: 0, x: -28 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.55, delay: 0.14, ease: EASE_EXPO }}
                >
                  <p className="font-mono-tabular text-xs font-bold tracking-widest text-sky-300 uppercase">
                    {isPlayStoreActive ? 'Google Play Distribution' : 'Android Mobile Application'}
                  </p>
                  <h2 className="font-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                    Start learning with {branding.systemName} on Android.
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">
                    {isPlayStoreActive
                      ? 'Install the Android application from Google Play to create your learner account, download full training modules with offline MP4 videos, and receive verified PDF certificates.'
                      : 'Download the Android application directly to your phone to register your learner account, save video courses for offline playback inside the app, and earn verified PDF certificates.'}
                  </p>
                  <div className="mt-6 space-y-2.5">
                    <div>{renderDownloadAppAction('banner')}</div>
                    {!isPlayStoreActive && hasDirectApk && (
                      <p className="font-mono-tabular text-xs text-slate-300">
                        Package: {branding.apkFileName || 'app-debug.apk'} (v
                        {branding.apkVersion || '1.0.0'})
                      </p>
                    )}
                  </div>
                  {downloadError && (
                    <p className="mt-3 rounded-xl border border-red-400/40 bg-red-950/60 px-3.5 py-2 text-xs text-red-200">
                      {downloadError}
                    </p>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 28, y: 16 }}
                  whileInView={{ opacity: 1, x: 0, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{
                    type: 'spring',
                    stiffness: 200,
                    damping: 22,
                    delay: 0.2,
                  }}
                  className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/75 p-6 text-xs text-slate-300"
                >
                  <p className="font-semibold text-white">Inside the Android App</p>
                  <ul className="space-y-2.5">
                    {[
                      'Dedicated learner registration, sign-in, and personal stats dashboard',
                      'Offline MP4 video playback inside the app via Media3 ExoPlayer',
                      'Queued quiz sync, achievement medals, and native PDF certificate export',
                    ].map((feature, idx) => (
                      <motion.li
                        key={feature}
                        initial={{ opacity: 0, x: 16 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, amount: 0.2 }}
                        transition={{
                          duration: 0.4,
                          delay: 0.28 + idx * 0.08,
                          ease: EASE_EXPO,
                        }}
                        className="flex items-start gap-2.5"
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                        <span>{feature}</span>
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>
              </div>
            </motion.div>
          </section>
        </main>

        {/* Quiet Footer (Desktop/Tablet only, strictly zero admin links) */}
        <motion.footer
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: EASE_EXPO }}
          className="hidden border-t border-slate-200/80 bg-white/80 py-10 backdrop-blur-md md:block dark:border-slate-800/80 dark:bg-slate-950/80"
        >
          <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-4 sm:flex-row sm:items-center sm:px-6">
            <div className="flex items-center gap-2.5">
              <img
                src={branding.iconUrl || DEFAULT_SYSTEM_ICON_URL}
                alt={branding.systemName}
                referrerPolicy="no-referrer"
                className="h-6 w-6 rounded object-contain"
              />
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {branding.systemName}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{branding.tagline}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-6 text-xs font-medium text-slate-500 dark:text-slate-400">
              <a
                href="#capabilities"
                onClick={(e) => handleSmoothAnchor(e, 'capabilities')}
                className="hover:text-slate-900 dark:hover:text-white"
              >
                Capabilities
              </a>
              <a
                href="#courses"
                onClick={(e) => handleSmoothAnchor(e, 'courses')}
                className="hover:text-slate-900 dark:hover:text-white"
              >
                Courses
              </a>
              <a
                href="#certificates"
                onClick={(e) => handleSmoothAnchor(e, 'certificates')}
                className="hover:text-slate-900 dark:hover:text-white"
              >
                Certificates
              </a>
              <a
                href="#verify"
                onClick={(e) => handleSmoothAnchor(e, 'verify')}
                className="hover:text-slate-900 dark:hover:text-white"
              >
                Verify
              </a>
              <a
                href="#get-app"
                onClick={(e) => handleSmoothAnchor(e, 'get-app')}
                className="hover:text-slate-900 dark:hover:text-white"
              >
                Android App
              </a>
            </div>
          </div>
        </motion.footer>

        {/* Mobile Bottom Navigation Bar */}
        <nav
          aria-label="Mobile navigation"
          data-testid="mobile-bottom-nav"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/85 bg-white/95 backdrop-blur-xl md:hidden dark:border-slate-800/85 dark:bg-slate-950/95"
        >
          <div className="mx-auto grid h-14 max-w-md grid-cols-5">
            {LANDING_NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              const NavIcon =
                item.id === 'capabilities'
                  ? Layers
                  : item.id === 'courses'
                  ? BookOpen
                  : item.id === 'certificates'
                  ? Award
                  : item.id === 'verify'
                  ? ShieldCheck
                  : AndroidIcon;
              const activeColor = isDark ? '#38bdf8' : accent;

              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => handleSmoothAnchor(e, item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  style={isActive ? { color: activeColor } : undefined}
                  className={`relative flex flex-col items-center justify-center gap-0.5 px-1 text-[11px] whitespace-nowrap transition-colors ${
                    isActive
                      ? 'font-bold'
                      : 'font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {isActive && (
                    <span
                      aria-hidden="true"
                      style={{ backgroundColor: activeColor }}
                      className="absolute top-0 right-3 left-3 h-[2.5px] rounded-b-full"
                    />
                  )}
                  {NavIcon === AndroidIcon ? (
                    <AndroidIcon
                      data-testid="landing-mobile-android-icon"
                      className="h-4 w-4 shrink-0"
                    />
                  ) : (
                    <NavIcon className="h-4 w-4 shrink-0" />
                  )}
                  <span>{item.shortLabel}</span>
                </a>
              );
            })}
          </div>
        </nav>

        <CoursePreviewModal
          course={previewCourse}
          branding={branding}
          accent={accent}
          isDark={isDark}
          catalogBaselineRating={catalogBaselineRating}
          onClose={() => setPreviewCourse(null)}
          onOpenInstall={() => {
            setPreviewCourse(null);
            onOpenInstall();
          }}
        />
      </div>
    </MotionConfig>
  );
};
