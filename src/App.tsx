import React, { useCallback, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { AdminStudio } from './components/AdminStudio';
import { AndroidInstallModal } from './components/AndroidInstallModal';
import { FuturisticBackdrop } from './components/FuturisticBackdrop';
import { LandingPage } from './components/LandingPage';
import { useTheme } from './hooks/useTheme';
import type { Course, SystemBranding } from './types/training';
import { api } from './utils/api';
import {
  DEFAULT_SYSTEM_ICON_URL,
  getDefaultSystemBranding,
} from './utils/certificateDefaults';

function isSystemAdminPath(pathname: string): boolean {
  return pathname === '/systemadministrator' || pathname.startsWith('/systemadministrator/');
}

export default function App() {
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() =>
    typeof window !== 'undefined' ? isSystemAdminPath(window.location.pathname) : false
  );
  const [branding, setBranding] = useState<SystemBranding>(() => getDefaultSystemBranding());
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    const handlePop = () => {
      setIsAdminRoute(isSystemAdminPath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const loadBranding = useCallback(async () => {
    try {
      const res = await api.getSystemBranding();
      setBranding(res.branding);
    } catch {
      // Keep default branding if offline
    }
  }, []);

  const loadRemoteCourses = useCallback(async () => {
    setLoadingCourses(true);
    try {
      const res = await api.listCourses(false);
      setCourses(res.courses);
    } catch {
      // Ignore fetch failure
    } finally {
      setLoadingCourses(false);
    }
  }, []);

  useEffect(() => {
    loadBranding();
    loadRemoteCourses();
  }, [loadBranding, loadRemoteCourses]);

  // Sync browser tab title & favicon with admin-configured System Branding
  useEffect(() => {
    document.title = isAdminRoute
      ? `${branding.systemName} — System Administrator`
      : `${branding.systemName} — Mobile Learning Experience System`;

    if (branding.iconUrl) {
      const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (link) {
        link.href = branding.iconUrl;
      }
    }
  }, [branding, isAdminRoute]);

  if (isAdminRoute) {
    return (
      <div className="relative min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <FuturisticBackdrop isDark={isDark} accentColor={branding.accentColor} />

        <div className="relative z-10">
          <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/80">
            <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-2.5">
                <img
                  src={branding.iconUrl || DEFAULT_SYSTEM_ICON_URL}
                  alt={`${branding.systemName} icon`}
                  className="h-7 w-7 shrink-0 rounded-lg object-contain"
                />
                <div className="flex min-w-0 flex-col sm:flex-row sm:items-center sm:gap-2">
                  <span className="font-display truncate text-sm font-extrabold tracking-tight text-slate-900 sm:text-base dark:text-white">
                    {branding.systemName}
                  </span>
                  <span aria-hidden="true" className="hidden text-slate-300 sm:inline dark:text-slate-700">
                    ·
                  </span>
                  <span className="truncate text-[11px] font-semibold text-slate-500 sm:text-xs dark:text-slate-400">
                    System Administrator
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2.5">
                <button
                  type="button"
                  data-testid="theme-toggle"
                  onClick={toggleTheme}
                  aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white/80 text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
                </button>
                <a
                  href="/"
                  className="flex min-h-[36px] shrink-0 items-center whitespace-nowrap rounded-xl border border-slate-200/80 bg-white/80 px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  View Public Site
                </a>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
            <AdminStudio
              systemBranding={branding}
              onBrandingUpdated={setBranding}
              onCoursesMutated={loadRemoteCourses}
            />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <FuturisticBackdrop isDark={isDark} accentColor={branding.accentColor} />
      <div className="relative z-10">
        <LandingPage
          branding={branding}
          courses={courses}
          loadingCourses={loadingCourses}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          onOpenInstall={() => setInstallModalOpen(true)}
        />
      </div>
      <AndroidInstallModal
        open={installModalOpen}
        branding={branding}
        onClose={() => setInstallModalOpen(false)}
      />
    </div>
  );
}
