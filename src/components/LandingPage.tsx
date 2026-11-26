import React, { useEffect, useRef, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Download,
  ExternalLink,
  Film,
  Layers,
  Moon,
  Smartphone,
  Sun,
} from 'lucide-react';
import type { Course, SystemBranding } from '../types/training';
import { downloadUploadedApk } from '../utils/api';
import {
  getDefaultCertificateDesign,
  resolveCertificateElementText,
} from '../utils/certificateDefaults';
import { CourseBannerImage } from './MediaRenderer';

interface LandingPageProps {
  branding: SystemBranding;
  courses: Course[];
  loadingCourses: boolean;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenInstall: () => void;
}

interface RevealSectionProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
  delayMs?: number;
}

const RevealSection: React.FC<RevealSectionProps> = ({
  children,
  className = '',
  id,
  delayMs = 0,
}) => {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (
      typeof window === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      typeof IntersectionObserver === 'undefined'
    ) {
      setVisible(true);
      return;
    }

    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.96) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -32px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      id={id}
      style={delayMs > 0 ? { transitionDelay: `${delayMs}ms` } : undefined}
      className={`reveal-section ${visible ? 'is-visible' : ''} ${className}`}
    >
      {children}
    </section>
  );
};

export const LandingPage: React.FC<LandingPageProps> = ({
  branding,
  courses,
  loadingCourses,
  isDark,
  onToggleTheme,
  onOpenInstall,
}) => {
  const [downloadingApk, setDownloadingApk] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const accent = branding.accentColor || '#1d4ed8';

  const distributionMode = branding.appDistributionMode ?? 'apk_download';
  const apkUrl = branding.apkUrl?.trim() || '';
  const playStoreUrl = branding.playStoreUrl?.trim() || '';
  const isPlayStoreActive = distributionMode === 'play_store';
  const hasPlayStoreUrl = Boolean(playStoreUrl);
  const hasDirectApk = Boolean(apkUrl);
  const isExternalApk = apkUrl.startsWith('http://') || apkUrl.startsWith('https://');

  function handleSmoothAnchor(e: React.MouseEvent<HTMLAnchorElement>, targetId: string) {
    const el = document.getElementById(targetId);
    if (!el) return;
    e.preventDefault();
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

  function renderDownloadAppAction(
    variant: 'header' | 'hero' | 'catalog' | 'banner'
  ): React.ReactNode {
    const className =
      variant === 'header'
        ? 'flex min-h-[40px] shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 sm:text-sm'
        : variant === 'catalog'
        ? 'inline-flex min-h-[40px] shrink-0 items-center gap-2 self-start whitespace-nowrap rounded-xl border border-slate-300/90 bg-white/85 px-4 text-xs font-semibold text-slate-800 backdrop-blur-md transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100 dark:hover:bg-slate-800'
        : 'inline-flex min-h-[48px] shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-6 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60';

    const style = variant === 'catalog' ? undefined : { backgroundColor: accent };
    const icon = isPlayStoreActive ? (
      <ExternalLink className="h-4 w-4" />
    ) : variant === 'header' ? (
      <Smartphone className="h-4 w-4" />
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
    <div className="min-h-screen text-slate-900 dark:text-slate-100">
      {/* Strict 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
          {/* Zone 1: Dynamic System Icon + Name */}
          <a
            href="#top"
            onClick={(e) => handleSmoothAnchor(e, 'top')}
            className="flex shrink-0 items-center gap-2.5 whitespace-nowrap"
          >
            <img
              src={branding.iconUrl || '/icon.svg'}
              alt={`${branding.systemName} icon`}
              referrerPolicy="no-referrer"
              className="h-8 w-8 rounded-lg object-contain"
            />
            <span className="font-display text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
              {branding.systemName}
            </span>
          </a>

          {/* Zone 2: Clean Anchor Navigation */}
          <nav aria-label="Landing navigation" className="hidden items-center gap-7 md:flex">
            <a
              href="#capabilities"
              onClick={(e) => handleSmoothAnchor(e, 'capabilities')}
              className="whitespace-nowrap text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 hover:underline hover:underline-offset-4 dark:text-slate-300 dark:hover:text-white"
            >
              Capabilities
            </a>
            <a
              href="#courses"
              onClick={(e) => handleSmoothAnchor(e, 'courses')}
              className="whitespace-nowrap text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 hover:underline hover:underline-offset-4 dark:text-slate-300 dark:hover:text-white"
            >
              Course Catalog
            </a>
            <a
              href="#certificates"
              onClick={(e) => handleSmoothAnchor(e, 'certificates')}
              className="whitespace-nowrap text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 hover:underline hover:underline-offset-4 dark:text-slate-300 dark:hover:text-white"
            >
              Certificates
            </a>
            <a
              href="#get-app"
              onClick={(e) => handleSmoothAnchor(e, 'get-app')}
              className="whitespace-nowrap text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 hover:underline hover:underline-offset-4 dark:text-slate-300 dark:hover:text-white"
            >
              Android App
            </a>
          </nav>

          {/* Zone 3: Dark Mode Toggle + Primary CTA */}
          <div className="flex shrink-0 items-center gap-2.5">
            <button
              type="button"
              data-testid="theme-toggle"
              onClick={onToggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white/80 text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
            </button>
            {renderDownloadAppAction('header')}
          </div>
        </div>
      </header>

      <main id="top">
        {/* Hero Section */}
        <section className="mx-auto max-w-7xl px-4 pt-12 pb-16 sm:px-6 lg:pt-16 lg:pb-24">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="flex max-w-xl flex-col justify-center">
              <p
                className="font-mono-tabular text-xs font-bold tracking-widest uppercase"
                style={{ color: isDark ? '#38bdf8' : accent }}
              >
                Android Field Certification Platform
              </p>
              <h1 className="font-display mt-3 text-4xl font-extrabold tracking-tight text-slate-900 text-balance dark:text-white sm:text-5xl">
                Offline mobile training that ends in verifiable PDF certificates.
              </h1>
              <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg">
                {branding.tagline} Learners sign in directly inside the Android app, download full
                video courses for offline field study, complete multi-format assessments, and earn
                official PDF credentials.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                {renderDownloadAppAction('hero')}
                <a
                  href="#courses"
                  onClick={(e) => handleSmoothAnchor(e, 'courses')}
                  className="flex min-h-[48px] items-center whitespace-nowrap rounded-xl border border-slate-300/90 bg-white/85 px-5 text-sm font-semibold text-slate-800 backdrop-blur-md transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Preview Available Courses
                </a>
              </div>

              {downloadError && (
                <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300">
                  {downloadError}
                </p>
              )}

              <div className="mt-7 flex flex-wrap items-center gap-x-2.5 gap-y-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>Offline MP4 video playback</span>
                <span aria-hidden="true">·</span>
                <span>Offline saved credentials</span>
                <span aria-hidden="true">·</span>
                <span>
                  {isPlayStoreActive
                    ? 'Available via Google Play'
                    : hasDirectApk
                    ? `Direct .apk v${branding.apkVersion || '1.0.0'}`
                    : 'Android APK distribution'}
                </span>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 p-1.5 shadow-lg backdrop-blur-md dark:border-slate-800/90 dark:bg-slate-900/75 dark:shadow-cyan-950/30">
              <div className="overflow-hidden rounded-xl">
                <img
                  src="/src/assets/images/hero_mobile_certification_1795696801213.jpg"
                  alt={`${branding.systemName} mobile certification in action`}
                  referrerPolicy="no-referrer"
                  className="block aspect-video w-full object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Capabilities Bento */}
        <RevealSection
          id="capabilities"
          className="border-y border-slate-200/80 bg-white/70 py-16 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/55 lg:py-20"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                Built for field teams without reliable Wi-Fi.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300 sm:text-base">
                Every course module, embedded training video, illustration, and quiz checkpoint stays
                stored locally inside the Android application until the learner finishes and syncs.
              </p>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
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
                <article
                  key={item.num}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white/80 p-6 backdrop-blur-md transition-transform duration-200 hover:-translate-y-0.5 dark:border-slate-800/80 dark:bg-slate-950/70"
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
                </article>
              ))}
            </div>
          </div>
        </RevealSection>

        {/* Read-Only Course Catalog Teaser */}
        <RevealSection id="courses" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                Published Training Catalog
              </h2>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
                Preview available certification programs below. Sign in inside the{' '}
                {branding.systemName} Android app to download courses and earn credentials.
              </p>
            </div>
            {renderDownloadAppAction('catalog')}
          </div>

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
            <div className="mt-8 rounded-2xl border border-slate-200/80 bg-white/80 p-10 text-center text-sm text-slate-500 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/75 dark:text-slate-400">
              Courses are being prepared for mobile distribution.
            </div>
          ) : (
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => {
                const lessonCount = course.modules.filter((m) => m.kind === 'lesson').length;
                const quizCount = course.modules.filter((m) => m.kind === 'quiz').length;
                return (
                  <article
                    key={course._id}
                    className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/85 backdrop-blur-md transition-transform duration-200 hover:-translate-y-0.5 dark:border-slate-800/80 dark:bg-slate-900/75"
                  >
                    <CourseBannerImage
                      url={course.bannerUrl}
                      title={course.title}
                      className="aspect-video w-full border-b border-slate-100 dark:border-slate-800"
                    />
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold" style={{ color: isDark ? '#38bdf8' : accent }}>
                          {course.category}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular">
                          {lessonCount} {lessonCount === 1 ? 'lesson' : 'lessons'} / {quizCount}{' '}
                          {quizCount === 1 ? 'quiz' : 'quizzes'}
                        </span>
                      </div>
                      <h3 className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                        {course.title}
                      </h3>
                      <p className="mt-1.5 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        {course.description}
                      </p>
                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                        <span className="min-w-0 truncate font-medium text-slate-700 dark:text-slate-200">
                          Credential: {course.certificateTitle}
                        </span>
                        <span className="shrink-0 font-semibold text-slate-900 dark:text-sky-400">
                          Android App
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </RevealSection>

        {/* Certificate Showcase */}
        <RevealSection
          id="certificates"
          className="border-y border-slate-200/80 bg-white/70 py-16 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/55 lg:py-20"
        >
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                Custom-designed PDF certificates per course.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300 sm:text-base">
                Every course issues a tailored A4 landscape PDF certificate bearing your system seal,
                learner full name, assessment score, issue date, and unique verification ID. Learners
                can preview and email PDFs straight from their Android device.
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-slate-700 dark:text-slate-200">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2
                    className="h-4 w-4 shrink-0"
                    style={{ color: isDark ? '#38bdf8' : accent }}
                  />
                  <span>Unique verification ID stamped on every approved submission</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2
                    className="h-4 w-4 shrink-0"
                    style={{ color: isDark ? '#38bdf8' : accent }}
                  />
                  <span>Generated natively as PDF inside the Android app</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2
                    className="h-4 w-4 shrink-0"
                    style={{ color: isDark ? '#38bdf8' : accent }}
                  />
                  <span>One-tap email delivery to your personal or supervisor inbox</span>
                </li>
              </ul>
            </div>

            <div
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
                        fontSize: `clamp(7px, ${(el.fontSize / 842) * 52}vw, ${el.fontSize * 0.78}px)`,
                        fontWeight: el.fontWeight === 'bold' ? 700 : 400,
                        textAlign: el.align,
                      }}
                      className={`absolute whitespace-nowrap ${fontFamilyClass}`}
                    >
                      {el.kind === 'system_icon' ? (
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-full"
                          style={{ backgroundColor: sampleDesign.accentColor || accent }}
                        >
                          <img
                            src={branding.iconUrl || '/icon.svg'}
                            alt={branding.systemName}
                            referrerPolicy="no-referrer"
                            className="h-5 w-5 rounded object-contain"
                          />
                        </div>
                      ) : (
                        <span>{resolveCertificateElementText(el, sampleCert)}</span>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </RevealSection>

        {/* Download the Android App Banner */}
        <RevealSection id="get-app" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="rounded-3xl border border-slate-200/80 bg-slate-900/95 p-8 text-white shadow-xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/85 sm:p-12">
            <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
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
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  {renderDownloadAppAction('banner')}
                  {!isPlayStoreActive && hasDirectApk && (
                    <span className="font-mono-tabular text-xs text-slate-300">
                      {branding.apkFileName || 'app-debug.apk'} · v{branding.apkVersion || '1.0.0'}
                    </span>
                  )}
                </div>
                {downloadError && (
                  <p className="mt-3 rounded-xl border border-red-400/40 bg-red-950/60 px-3.5 py-2 text-xs text-red-200">
                    {downloadError}
                  </p>
                )}
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/75 p-6 text-xs text-slate-300">
                <p className="font-semibold text-white">Inside the Android App</p>
                <ul className="space-y-2.5">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                    <span>Dedicated learner registration, sign-in, and personal stats dashboard</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                    <span>Offline MP4 video playback inside the app via Media3 ExoPlayer</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                    <span>Queued quiz sync, achievement medals, and native PDF certificate export</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </RevealSection>
      </main>

      {/* Quiet Footer (Strictly zero admin links) */}
      <footer className="border-t border-slate-200/80 bg-white/80 py-10 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-4 sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-2.5">
            <img
              src={branding.iconUrl || '/icon.svg'}
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
              href="#get-app"
              onClick={(e) => handleSmoothAnchor(e, 'get-app')}
              className="hover:text-slate-900 dark:hover:text-white"
            >
              Android App
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
