import React, { useState } from 'react';
import { Download, ExternalLink, Film, ShieldCheck, X } from 'lucide-react';
import type { SystemBranding } from '../types/training';
import { downloadUploadedApk } from '../utils/api';
import { AndroidIcon } from './AndroidIcon';

interface AndroidInstallModalProps {
  open: boolean;
  branding: SystemBranding;
  onClose: () => void;
}

export const AndroidInstallModal: React.FC<AndroidInstallModalProps> = ({
  open,
  branding,
  onClose,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const mode = branding.appDistributionMode ?? 'apk_download';
  const apkUrl = branding.apkUrl?.trim() || '';
  const playStoreUrl = branding.playStoreUrl?.trim() || '';
  const isExternalApk = apkUrl.startsWith('http://') || apkUrl.startsWith('https://');

  async function handleApkDownload() {
    setDownloading(true);
    setError(null);
    try {
      await downloadUploadedApk(branding.apkFileName || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download Android APK.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="android-install-title"
    >
      <div className="w-full max-w-lg rounded-t-3xl border border-slate-200 bg-white/95 p-6 shadow-xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-sky-950/70 dark:text-sky-300">
              <AndroidIcon className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="android-install-title"
                className="text-lg font-bold text-slate-900 dark:text-white"
              >
                Download {branding.systemName} for Android
              </h2>
              {mode === 'apk_download' && branding.apkVersion && (
                <p className="font-mono-tabular text-xs text-slate-500 dark:text-slate-400">
                  Release v{branding.apkVersion}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close install dialog"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {mode === 'play_store' ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Google Play Store Release
              </h3>
              {playStoreUrl ? (
                <>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    Install the official {branding.systemName} mobile app directly from Google Play
                    to sign in, download training videos offline, and earn PDF certificates.
                  </p>
                  <a
                    href={playStoreUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>Open Google Play Store</span>
                  </a>
                </>
              ) : (
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  The Google Play Store listing link is currently being finalized by your training
                  organization. Check back shortly to download the Android application.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Direct Android Package (.apk)
              </h3>
              {apkUrl ? (
                <>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    Download the signed Android installer package ({branding.apkFileName || 'app-debug.apk'})
                    to your phone and open it to install {branding.systemName}.
                  </p>
                  {isExternalApk ? (
                    <a
                      href={apkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download App (.apk)</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled={downloading}
                      onClick={handleApkDownload}
                      className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
                    >
                      <Download className="h-4 w-4" />
                      <span>{downloading ? 'Downloading .apk...' : 'Download App (.apk)'}</span>
                    </button>
                  )}
                  {error && (
                    <p className="mt-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300">
                      {error}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  The latest Android <code className="font-mono-tabular">.apk</code> release is
                  currently being prepared and will appear here as soon as it is published by your
                  training administrator.
                </p>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                <Film className="h-4 w-4 text-blue-700 dark:text-sky-400" />
                <span>Offline MP4 Video</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                Downloaded lesson videos play natively inside the app without an internet signal.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                <ShieldCheck className="h-4 w-4 text-blue-700 dark:text-sky-400" />
                <span>Mobile Accounts &amp; PDFs</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                Register, track attempts, sync completed quizzes, and export A4 PDF certificates.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
