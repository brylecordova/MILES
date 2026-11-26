import React, { useCallback, useEffect, useState } from 'react';
import { AdminStudio } from './components/AdminStudio';
import { AndroidInstallModal } from './components/AndroidInstallModal';
import { LandingPage } from './components/LandingPage';
import type { Course, SystemBranding } from './types/training';
import { api } from './utils/api';
import { getDefaultSystemBranding } from './utils/certificateDefaults';

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
      : `${branding.systemName} — Mobile Training & Certification`;

    if (branding.iconUrl) {
      const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (link) {
        link.href = branding.iconUrl;
      }
    }
  }, [branding, isAdminRoute]);

  if (isAdminRoute) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex items-center gap-2.5">
              <img
                src={branding.iconUrl || '/icon.svg'}
                alt={`${branding.systemName} icon`}
                className="h-7 w-7 rounded-lg object-contain"
              />
              <span className="font-display text-base font-extrabold tracking-tight text-slate-900">
                {branding.systemName}
              </span>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span className="text-xs font-semibold text-slate-500">System Administrator</span>
            </div>
            <a
              href="/"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              View Public Site
            </a>
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
    );
  }

  return (
    <>
      <LandingPage
        branding={branding}
        courses={courses}
        loadingCourses={loadingCourses}
        onOpenInstall={() => setInstallModalOpen(true)}
      />
      <AndroidInstallModal
        open={installModalOpen}
        systemName={branding.systemName}
        onClose={() => setInstallModalOpen(false)}
      />
    </>
  );
}
