import React, { useState } from 'react';
import { Award, CheckCircle2, Download, Mail, X } from 'lucide-react';
import type { CertificateRecord } from '../types/training';
import { api } from '../utils/api';
import {
  getDefaultCertificateDesign,
  resolveCertificateElementText,
} from '../utils/certificateDefaults';
import { downloadCertificatePdf, generateCertificatePdfBase64 } from '../utils/certificatePdf';

interface CertificateModalProps {
  certificate: CertificateRecord | null;
  onClose: () => void;
  onUpdated: (updated: CertificateRecord) => void;
}

export const CertificateModal: React.FC<CertificateModalProps> = ({
  certificate,
  onClose,
  onUpdated,
}) => {
  const [recipientEmail, setRecipientEmail] = useState(certificate?.userEmail ?? '');
  const [sending, setSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{
    type: 'success' | 'info' | 'error';
    message: string;
  } | null>(null);

  React.useEffect(() => {
    if (certificate) {
      setRecipientEmail(certificate.userEmail);
      setEmailStatus(null);
    }
  }, [certificate]);

  if (!certificate) return null;

  const design =
    certificate.certificateDesign ??
    getDefaultCertificateDesign(certificate.issuerName, certificate.certificateTitle);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!certificate) return;
    setSending(true);
    setEmailStatus(null);
    try {
      const pdfBase64 = generateCertificatePdfBase64(certificate);
      const res = await api.emailCertificate(certificate._id, recipientEmail, pdfBase64);
      if (res.certificate) {
        onUpdated(res.certificate);
      }
      setEmailStatus({
        type: res.deliveredViaSmtp ? 'success' : 'info',
        message: res.message,
      });
    } catch (err) {
      setEmailStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to send email.',
      });
    } finally {
      setSending(false);
    }
  }

  const mailtoSubject = encodeURIComponent(
    `Certificate: ${certificate.certificateTitle} (${certificate.certificateCode})`
  );
  const mailtoBody = encodeURIComponent(
    `Certificate of Completion\n\nRecipient: ${certificate.userName}\nCredential: ${certificate.certificateTitle}\nCourse: ${certificate.courseTitle}\nScore: ${certificate.score}%\nVerification Code: ${certificate.certificateCode}\nIssued: ${new Date(certificate.issuedAt).toLocaleDateString()}`
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cert-modal-title"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-slate-200 bg-white/95 p-6 shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="cert-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
            Official Training Certificate
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close certificate preview"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Dynamic Certificate Frame */}
        <div
          className="relative aspect-[842/595] w-full overflow-hidden rounded-xl border border-slate-200 shadow-xs dark:border-slate-700"
          style={{ backgroundColor: design.canvasBackground || '#ffffff' }}
        >
          {design.backgroundImageUrl && (
            <img
              src={design.backgroundImageUrl}
              alt="Certificate backdrop"
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
                style={{ borderColor: design.accentColor || '#1d4ed8' }}
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
                    fontSize: `clamp(9px, ${(el.fontSize / 842) * 100}vw, ${el.fontSize}px)`,
                    fontWeight: el.fontWeight === 'bold' ? 700 : 400,
                    textAlign: el.align,
                  }}
                  className={`absolute whitespace-nowrap ${fontFamilyClass}`}
                >
                  {el.kind === 'system_icon' ? (
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full"
                      style={{ backgroundColor: design.accentColor || '#1d4ed8' }}
                    >
                      {certificate.systemIconUrl ? (
                        <img
                          src={certificate.systemIconUrl}
                          alt={certificate.issuerName}
                          className="h-6 w-6 rounded object-contain"
                        />
                      ) : (
                        <Award className="h-5 w-5 text-white" />
                      )}
                    </div>
                  ) : (
                    <span>{resolveCertificateElementText(el, certificate)}</span>
                  )}
                </div>
              );
            })}
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => downloadCertificatePdf(certificate)}
            className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
          >
            <Download className="h-4 w-4" />
            <span>Download PDF Certificate</span>
          </button>
        </div>

        {/* Email Certificate Form */}
        <form
          onSubmit={handleEmailSubmit}
          className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60"
        >
          <label
            htmlFor="cert-email-input"
            className="mb-2 block text-sm font-semibold text-slate-900 dark:text-white"
          >
            Email PDF Certificate to Yourself
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="cert-email-input"
              type="email"
              required
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="you@example.com"
              className="min-h-[44px] flex-1 rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={sending}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <Mail className="h-4 w-4" />
              <span>{sending ? 'Sending...' : 'Send Email'}</span>
            </button>
          </div>

          {emailStatus && (
            <div
              className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
                emailStatus.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : emailStatus.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300'
                  : 'border-blue-200 bg-blue-50 text-blue-800 dark:border-sky-900/60 dark:bg-sky-950/50 dark:text-sky-300'
              }`}
            >
              <div className="flex items-start gap-2">
                {emailStatus.type === 'success' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
                <div>
                  <p>{emailStatus.message}</p>
                  {emailStatus.type === 'info' && (
                    <a
                      href={`mailto:${encodeURIComponent(recipientEmail)}?subject=${mailtoSubject}&body=${mailtoBody}`}
                      className="mt-1.5 inline-block font-semibold underline"
                    >
                      Open in Mail App
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
