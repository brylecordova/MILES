import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  RotateCcw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import type { SystemBranding, VerifiedCertificatePublic } from '../types/training';
import { api } from '../utils/api';
import {
  getDefaultCertificateDesign,
  resolveCertificateElementText,
} from '../utils/certificateDefaults';
import {
  isValidCertificateCodeFormat,
  normalizeCertificateCode,
} from '../utils/certificateVerification';
import { LoadingSpinner } from './LoadingSpinner';

interface CertificateVerifierProps {
  branding: SystemBranding;
  isDark: boolean;
}

const EASE_EXPO = [0.16, 1, 0.3, 1] as const;

export const CertificateVerifier: React.FC<CertificateVerifierProps> = ({ branding, isDark }) => {
  const [codeInput, setCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedCert, setVerifiedCert] = useState<VerifiedCertificatePublic | null>(null);
  const accent = branding.accentColor || '#1d4ed8';

  const runVerification = useCallback(async (rawCode: string) => {
    const normalized = normalizeCertificateCode(rawCode);
    setCodeInput(normalized);

    if (!normalized) {
      setVerifiedCert(null);
      setError('Enter a certificate verification code (for example, CF-2026-9041B1).');
      return;
    }

    if (!isValidCertificateCodeFormat(normalized)) {
      setVerifiedCert(null);
      setError('Invalid code format. Use letters, numbers, and hyphens (e.g. CF-2026-9041B1).');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.verifyCertificate(normalized);
      setVerifiedCert(res.certificate);
    } catch (err) {
      setVerifiedCert(null);
      setError(
        err instanceof Error
          ? err.message
          : `No issued certificate found matching code "${normalized}".`
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const initialCode = params.get('verify');
    if (initialCode) {
      void runVerification(initialCode);
      const section = document.getElementById('verify');
      if (section) {
        section.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
    }
  }, [runVerification]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void runVerification(codeInput);
  }

  function handleReset() {
    setCodeInput('');
    setError(null);
    setVerifiedCert(null);
  }

  const design = verifiedCert
    ? verifiedCert.certificateDesign ??
      getDefaultCertificateDesign(verifiedCert.issuerName, verifiedCert.certificateTitle)
    : null;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="grid items-start gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        {/* Left: Verifier Controls */}
        <motion.div
          initial={{ opacity: 0, y: 36, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: EASE_EXPO }}
          className="rounded-3xl border border-slate-200/80 bg-white/85 p-6 shadow-sm backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/75 sm:p-8"
        >
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ scale: 0.5, rotate: -18, opacity: 0 }}
              whileInView={{ scale: 1, rotate: 0, opacity: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ type: 'spring', stiffness: 280, damping: 18, delay: 0.12 }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
              style={{ backgroundColor: accent }}
            >
              <ShieldCheck className="h-5 w-5" />
            </motion.div>
            <div>
              <p
                className="font-mono-tabular text-xs font-bold tracking-widest uppercase"
                style={{ color: isDark ? '#38bdf8' : accent }}
              >
                Credential Verification
              </p>
              <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Verify a Certificate Code
              </h2>
            </div>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Employers and supervisors can confirm the authenticity of any {branding.systemName} PDF
            credential by entering the unique verification ID printed on the certificate.
          </p>

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-3">
            <label
              htmlFor="certificate-code-input"
              className="block text-xs font-semibold tracking-wide text-slate-700 uppercase dark:text-slate-300"
            >
              Certificate Verification Code
            </label>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="certificate-code-input"
                  type="text"
                  value={codeInput}
                  onChange={(e) => {
                    setCodeInput(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="e.g. CF-2026-9041B1"
                  autoCapitalize="characters"
                  spellCheck={false}
                  aria-describedby="certificate-code-help"
                  className="font-mono-tabular min-h-[48px] w-full rounded-xl border border-slate-300 bg-white pr-3.5 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100 dark:focus:border-sky-400"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                style={{ backgroundColor: accent }}
                className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {loading ? (
                  <LoadingSpinner size="sm" lightTrack />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                <span>{loading ? 'Verifying...' : 'Verify Certificate'}</span>
              </button>
              {(codeInput || verifiedCert || error) && (
                <button
                  type="button"
                  onClick={handleReset}
                  aria-label="Reset certificate verifier"
                  className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span className="sm:hidden">Reset</span>
                </button>
              )}
            </div>
            <p id="certificate-code-help" className="text-xs text-slate-500 dark:text-slate-400">
              Codes are case-insensitive and appear in the lower-right corner of every issued PDF
              certificate.
            </p>
          </form>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="verify-error"
                role="alert"
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="mt-4 flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Right: Verification Result / Empty Ready Panel */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.65, delay: 0.1, ease: EASE_EXPO }}
        >
          {loading ? (
            <motion.div
              key="verify-loading"
              data-testid="verify-loading-panel"
              initial={{ opacity: 0.75, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.12 }}
              className="flex min-h-[260px] flex-col items-center justify-center rounded-3xl border border-slate-200/90 bg-white/85 p-8 text-center shadow-sm backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/75"
            >
              <LoadingSpinner
                size="lg"
                accentColor={isDark ? '#38bdf8' : accent}
                label="Checking official certificate registry..."
                className="flex-col gap-3"
              />
              <p className="mt-2 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                Validating credential code and retrieving issued course details.
              </p>
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              {verifiedCert && design ? (
              <motion.div
                key={verifiedCert.certificateCode}
                data-testid="verified-certificate-result"
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 220, damping: 22 }}
                className="rounded-3xl border border-emerald-200/90 bg-white/90 p-6 shadow-md backdrop-blur-md dark:border-emerald-800/70 dark:bg-slate-900/85"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <motion.div
                      initial={{ scale: 0.4, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 16 }}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white"
                    >
                      <CheckCircle2 className="h-5 w-5" />
                    </motion.div>
                    <div>
                      <p className="text-xs font-bold tracking-wider text-emerald-700 uppercase dark:text-emerald-400">
                        Verified Authentic Credential
                      </p>
                      <p className="font-mono-tabular text-sm font-bold text-slate-900 dark:text-white">
                        {verifiedCert.certificateCode}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono-tabular rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/60 dark:text-emerald-300">
                    Score {verifiedCert.score}%
                  </span>
                </div>

                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Credential Holder
                    </dt>
                    <dd className="mt-0.5 font-semibold text-slate-900 dark:text-white">
                      {verifiedCert.userName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Credential Title
                    </dt>
                    <dd className="mt-0.5 font-semibold text-slate-900 dark:text-white">
                      {verifiedCert.certificateTitle}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Completed Course
                    </dt>
                    <dd className="mt-0.5 text-slate-800 dark:text-slate-200">
                      {verifiedCert.courseTitle}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Issued By &amp; Date
                    </dt>
                    <dd className="mt-0.5 text-slate-800 dark:text-slate-200">
                      {verifiedCert.issuerName} ·{' '}
                      {new Date(verifiedCert.issuedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </dd>
                  </div>
                </dl>

                {/* Compact Official Certificate Preview */}
                <div
                  className="relative mt-5 aspect-[842/595] w-full overflow-hidden rounded-xl border border-slate-200 shadow-xs dark:border-slate-700"
                  style={{ backgroundColor: design.canvasBackground || '#ffffff' }}
                >
                  {design.backgroundImageUrl && (
                    <img
                      src={design.backgroundImageUrl}
                      alt="Verified certificate backdrop"
                      referrerPolicy="no-referrer"
                      className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-35"
                    />
                  )}
                  {design.showBorder && (
                    <>
                      <div
                        className="pointer-events-none absolute inset-[4%] border-[3px]"
                        style={{ borderColor: design.borderColor || '#0f172a' }}
                      />
                      <div
                        className="pointer-events-none absolute inset-[5.4%] border"
                        style={{ borderColor: design.accentColor || accent }}
                      />
                    </>
                  )}
                  {design.elements
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
                            fontSize: `clamp(6px, ${(el.fontSize / 842) * 84}vw, ${el.fontSize * 0.66}px)`,
                            fontWeight: el.fontWeight === 'bold' ? 700 : 400,
                            textAlign: el.align,
                          }}
                          className={`absolute whitespace-nowrap ${fontFamilyClass}`}
                        >
                          {el.kind === 'system_icon' ? (
                            <div
                              className="flex h-7 w-7 items-center justify-center rounded-full"
                              style={{ backgroundColor: design.accentColor || accent }}
                            >
                              {verifiedCert.systemIconUrl || branding.iconUrl ? (
                                <img
                                  src={verifiedCert.systemIconUrl || branding.iconUrl}
                                  alt={verifiedCert.issuerName}
                                  referrerPolicy="no-referrer"
                                  className="h-4 w-4 rounded object-contain"
                                />
                              ) : (
                                <Award className="h-4 w-4 text-white" />
                              )}
                            </div>
                          ) : (
                            <span>{resolveCertificateElementText(el, verifiedCert)}</span>
                          )}
                        </div>
                      );
                    })}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="verify-idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex min-h-[260px] flex-col justify-between rounded-3xl border border-dashed border-slate-300/90 bg-white/60 p-7 backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-900/45"
              >
                <div>
                  <p className="font-mono-tabular text-xs font-bold tracking-widest text-slate-400 uppercase dark:text-slate-500">
                    Registry Status · Live
                  </p>
                  <h3 className="font-display mt-2 text-lg font-bold text-slate-900 dark:text-white">
                    Instant Official Registry Lookup
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    Submitting a certificate code queries the {branding.systemName} issuance
                    registry directly and displays the recipient name, course title, score,
                    issuing authority, and official certificate layout.
                  </p>
                </div>

                <div className="mt-6 grid gap-3 border-t border-slate-200/80 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:grid-cols-3">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      Recipient &amp; Score
                    </p>
                    <p className="mt-0.5">Confirms learner name and assessment grade.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      Issuing Board
                    </p>
                    <p className="mt-0.5">Shows issuing academy and approval date.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      Privacy Safe
                    </p>
                    <p className="mt-0.5">Personal contact details remain hidden.</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          )}
        </motion.div>
      </div>
    </div>
  );
};
