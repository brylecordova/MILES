import React from 'react';
import {
  Award,
  CheckCircle2,
  Cloud,
  Download,
  Film,
  Layers,
  Smartphone,
} from 'lucide-react';
import type { Course, SystemBranding } from '../types/training';
import {
  getDefaultCertificateDesign,
  resolveCertificateElementText,
} from '../utils/certificateDefaults';
import { CourseBannerImage } from './MediaRenderer';

interface LandingPageProps {
  branding: SystemBranding;
  courses: Course[];
  loadingCourses: boolean;
  onOpenInstall: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  branding,
  courses,
  loadingCourses,
  onOpenInstall,
}) => {
  const accent = branding.accentColor || '#1d4ed8';
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Strict 3-Zone Top Navigation Bar (No learner workspace tabs, no web sign-in, no admin link) */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
          {/* Zone 1: Dynamic System Icon + Name */}
          <a href="#top" className="flex shrink-0 items-center gap-2.5 whitespace-nowrap">
            <img
              src={branding.iconUrl || '/icon.svg'}
              alt={`${branding.systemName} icon`}
              className="h-8 w-8 rounded-lg object-contain"
            />
            <span className="font-display text-lg font-extrabold tracking-tight text-slate-900">
              {branding.systemName}
            </span>
          </a>

          {/* Zone 2: Clean Anchor Navigation */}
          <nav aria-label="Landing navigation" className="hidden items-center gap-7 md:flex">
            <a
              href="#capabilities"
              className="whitespace-nowrap text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              Capabilities
            </a>
            <a
              href="#courses"
              className="whitespace-nowrap text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              Course Catalog
            </a>
            <a
              href="#certificates"
              className="whitespace-nowrap text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              Certificates
            </a>
            <a
              href="#get-app"
              className="whitespace-nowrap text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              Android App
            </a>
          </nav>

          {/* Zone 3: Single Primary CTA */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={onOpenInstall}
              style={{ backgroundColor: accent }}
              className="flex min-h-[40px] items-center gap-2 whitespace-nowrap rounded-xl px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90 sm:text-sm"
            >
              <Smartphone className="h-4 w-4" />
              <span>Get Android App</span>
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* Hero Section */}
        <section className="mx-auto max-w-7xl px-4 pt-12 pb-16 sm:px-6 lg:pt-16 lg:pb-24">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="max-w-xl">
              <p
                className="text-xs font-bold tracking-wider uppercase"
                style={{ color: accent }}
              >
                Android Field Certification Platform
              </p>
              <h1 className="font-display mt-3 text-4xl font-extrabold tracking-tight text-slate-900 text-balance sm:text-5xl">
                Offline mobile training that ends in verifiable PDF certificates.
              </h1>
              <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
                {branding.tagline} Learners sign in directly inside the Android app, download full
                video courses for offline field study, complete multi-format assessments, and earn
                official PDF credentials.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onOpenInstall}
                  style={{ backgroundColor: accent }}
                  className="flex min-h-[48px] items-center gap-2 rounded-xl px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  <Download className="h-4 w-4" />
                  <span>Get the Android App</span>
                </button>
                <a
                  href="#courses"
                  className="flex min-h-[48px] items-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100"
                >
                  Preview Available Courses
                </a>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-x-2.5 gap-y-2 text-xs font-medium text-slate-500">
                <span>Offline MP4 video playback</span>
                <span aria-hidden="true">·</span>
                <span>Account sign-in inside Android app</span>
                <span aria-hidden="true">·</span>
                <span>Cloud APK build ready</span>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <img
                src="/src/assets/images/hero_mobile_certification_1795696801213.jpg"
                alt={`${branding.systemName} mobile certification in action`}
                className="aspect-video w-full object-cover"
              />
            </div>
          </div>
        </section>

        {/* Capabilities Bento */}
        <section id="capabilities" className="border-y border-slate-200 bg-white py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Built for field teams without reliable Wi-Fi.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
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
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-6"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono-tabular text-xs font-bold text-slate-400">
                        {item.num}
                      </span>
                      <span style={{ color: accent }}>{item.icon}</span>
                    </div>
                    <h3 className="mt-4 text-base font-bold text-slate-900">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Read-Only Course Catalog Teaser */}
        <section id="courses" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Published Training Catalog
              </h2>
              <p className="mt-1.5 text-sm text-slate-600">
                Preview available certification programs below. Sign in inside the {branding.systemName}{' '}
                Android app to download courses and earn credentials.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenInstall}
              className="min-h-[40px] self-start rounded-xl border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 hover:bg-slate-100"
            >
              Install Android App to Enroll
            </button>
          </div>

          {loadingCourses ? (
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white"
                />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
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
                    className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white"
                  >
                    <CourseBannerImage
                      url={course.bannerUrl}
                      title={course.title}
                      className="aspect-video w-full border-b border-slate-100"
                    />
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold" style={{ color: accent }}>
                          {course.category}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular">
                          {lessonCount} {lessonCount === 1 ? 'lesson' : 'lessons'} / {quizCount}{' '}
                          {quizCount === 1 ? 'quiz' : 'quizzes'}
                        </span>
                      </div>
                      <h3 className="mt-2 text-lg font-bold text-slate-900">{course.title}</h3>
                      <p className="mt-1.5 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-600">
                        {course.description}
                      </p>
                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                        <span className="min-w-0 truncate font-medium text-slate-700">
                          Credential: {course.certificateTitle}
                        </span>
                        <span className="shrink-0 font-semibold text-slate-900">
                          Android App
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Certificate Showcase */}
        <section id="certificates" className="border-y border-slate-200 bg-white py-16 lg:py-20">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Custom-designed PDF certificates per course.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                Every course issues a tailored A4 landscape PDF certificate bearing your system seal,
                learner full name, assessment score, issue date, and unique verification ID. Learners
                can preview and email PDFs straight from their Android device.
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-slate-700">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: accent }} />
                  <span>Unique verification ID stamped on every approved submission</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: accent }} />
                  <span>Generated natively as PDF inside the Android app</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: accent }} />
                  <span>One-tap email delivery to your personal or supervisor inbox</span>
                </li>
              </ul>
            </div>

            <div
              className="relative aspect-[842/595] w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm"
              style={{ backgroundColor: sampleDesign.canvasBackground || '#ffffff' }}
            >
              {sampleDesign.backgroundImageUrl && (
                <img
                  src={sampleDesign.backgroundImageUrl}
                  alt="Sample certificate backdrop"
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
        </section>

        {/* Get the Android App (Low-Spec PC Friendly Cloud APK + Direct Install) */}
        <section id="get-app" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="rounded-3xl border border-slate-200 bg-slate-900 p-8 text-white sm:p-12">
            <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <p className="text-xs font-bold tracking-wider text-blue-300 uppercase">
                  Android Application
                </p>
                <h2 className="font-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                  Install {branding.systemName} on Android — no heavy PC required.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">
                  Learners register and sign in strictly inside the Android mobile app. Download the
                  Android project with the included GitHub Actions cloud build workflow to compile an
                  installable <code className="font-mono-tabular text-white">.apk</code> in the cloud
                  with zero Android Studio setup—complete with native offline MP4 video playback.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href="/api/android-project.zip"
                    download="certifield-android-app.zip"
                    style={{ backgroundColor: accent }}
                    className="flex min-h-[48px] items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download Android App Project (.zip)</span>
                  </a>
                  <button
                    type="button"
                    onClick={onOpenInstall}
                    className="flex min-h-[48px] items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-5 text-sm font-semibold text-white hover:bg-slate-700"
                  >
                    <Cloud className="h-4 w-4" />
                    <span>View Cloud APK Build Guide</span>
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 space-y-3 text-xs text-slate-300">
                <p className="font-semibold text-white">3-Step Cloud APK Build (No Android Studio)</p>
                <ol className="list-decimal space-y-2 pl-4">
                  <li>Download and extract the Android project archive above.</li>
                  <li>
                    Upload the folder to GitHub (includes{' '}
                    <code className="font-mono-tabular text-blue-300">
                      .github/workflows/build-android-apk.yml
                    </code>
                    ).
                  </li>
                  <li>
                    Run the <strong>Build Android APK</strong> workflow in GitHub Actions and install{' '}
                    <code className="font-mono-tabular text-blue-300">app-debug.apk</code> on your
                    Android phone. Downloaded videos play locally via Media3 ExoPlayer.
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer (Strictly zero admin links) */}
      <footer className="border-t border-slate-200 bg-white py-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-4 sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-2.5">
            <img
              src={branding.iconUrl || '/icon.svg'}
              alt={branding.systemName}
              className="h-6 w-6 rounded object-contain"
            />
            <div>
              <p className="text-sm font-bold text-slate-900">{branding.systemName}</p>
              <p className="text-xs text-slate-500">{branding.tagline}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 text-xs font-medium text-slate-500">
            <a href="#capabilities" className="hover:text-slate-900">
              Capabilities
            </a>
            <a href="#courses" className="hover:text-slate-900">
              Courses
            </a>
            <a href="#certificates" className="hover:text-slate-900">
              Certificates
            </a>
            <a href="#get-app" className="hover:text-slate-900">
              Android App
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
