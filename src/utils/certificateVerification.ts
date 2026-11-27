import type { CertificateRecord, VerifiedCertificatePublic } from '../types/training';

export function normalizeCertificateCode(raw: string): string {
  return raw.trim().replace(/\s+/g, '').toUpperCase();
}

export function isValidCertificateCodeFormat(code: string): boolean {
  const normalized = normalizeCertificateCode(code);
  return /^[A-Z0-9-]{4,32}$/.test(normalized);
}

export function toPublicVerifiedCertificate(
  cert: CertificateRecord,
  fallbackSystemIconUrl?: string
): VerifiedCertificatePublic {
  return {
    certificateCode: cert.certificateCode,
    userName: cert.userName,
    courseTitle: cert.courseTitle,
    certificateTitle: cert.certificateTitle,
    issuerName: cert.issuerName,
    score: cert.score,
    issuedAt: cert.issuedAt,
    certificateDesign: cert.certificateDesign,
    systemIconUrl: cert.systemIconUrl || fallbackSystemIconUrl,
  };
}
