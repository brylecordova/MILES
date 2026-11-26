import React from 'react';
import { Cloud, Download, Smartphone, X } from 'lucide-react';

interface AndroidInstallModalProps {
  open: boolean;
  systemName: string;
  onClose: () => void;
}

export const AndroidInstallModal: React.FC<AndroidInstallModalProps> = ({
  open,
  systemName,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="android-install-title"
    >
      <div className="w-full max-w-lg rounded-t-3xl border border-slate-200 bg-white p-6 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Smartphone className="h-5 w-5" />
            </div>
            <h2 id="android-install-title" className="text-lg font-bold text-slate-900">
              Get {systemName} for Android
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close install dialog"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Option 1: Cloud APK Build without Android Studio */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <Cloud className="h-4 w-4 text-blue-700" />
              <h3 className="text-sm font-bold text-slate-900">
                Cloud APK Build (No Android Studio on PC)
              </h3>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              On a low-spec PC, you do not need Android Studio installed. Download the native Kotlin
              project below, push it to a GitHub repository, and run the included{' '}
              <code className="font-mono-tabular text-slate-900">Build Android APK</code> workflow in
              GitHub Actions to generate your installable <code className="font-mono-tabular">app-debug.apk</code>{' '}
              in ~2 minutes.
            </p>
            <a
              href="/api/android-project.zip"
              download="certifield-android-app.zip"
              className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Download className="h-4 w-4" />
              <span>Download Android Project + Cloud Workflow (.zip)</span>
            </a>
          </div>

          {/* Option 2: Offline Video Playback inside Native App */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-bold text-slate-900">
              Native Offline Video &amp; Learner Accounts
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Inside the compiled Android APK, learners register/sign in, download courses with
              MP4 videos straight into private device storage, play them offline with Media3
              ExoPlayer, queue quiz submissions without Wi-Fi, and export/email PDF certificates.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
