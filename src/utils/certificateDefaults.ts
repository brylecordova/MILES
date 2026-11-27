import type {
  CertificateDesign,
  CertificateElement,
  CertificateRecord,
  SystemBranding,
} from '../types/training.ts';

export const DEFAULT_SYSTEM_NAME = 'MiLES';
export const DEFAULT_SYSTEM_FULL_NAME = 'Mobile Learning Experience System';
export const DEFAULT_SYSTEM_ICON_URL =
  '/assets/aistudio/Gemini_Generated_Image_wrxsxwrxsxwrxsxw-removebg-preview_a8a27cfa.png';

export function getDefaultSystemBranding(): SystemBranding {
  return {
    systemName: DEFAULT_SYSTEM_NAME,
    tagline:
      'Mobile Learning Experience System — offline-ready Android training and verifiable PDF certification.',
    iconUrl: DEFAULT_SYSTEM_ICON_URL,
    accentColor: '#1d4ed8',
    appDistributionMode: 'apk_download',
    apkUrl: '',
    apkFileName: '',
    apkVersion: '1.0.0',
    playStoreUrl: '',
    updatedAt: new Date().toISOString(),
  };
}

export function getDefaultCertificateDesign(
  issuerName = 'MiLES Academy',
  certificateTitle = 'Certified Training Specialist'
): CertificateDesign {
  return {
    canvasBackground: '#ffffff',
    borderColor: '#0f172a',
    accentColor: '#1d4ed8',
    showBorder: true,
    elements: [
      {
        id: 'el-icon',
        kind: 'system_icon',
        label: 'System Icon / Seal',
        text: '',
        xPct: 50,
        yPct: 14,
        fontSize: 36,
        fontWeight: 'bold',
        fontFamily: 'sans',
        color: '#1d4ed8',
        align: 'center',
        visible: true,
      },
      {
        id: 'el-issuer',
        kind: 'issuer_name',
        label: 'Issuing Authority',
        text: issuerName,
        xPct: 50,
        yPct: 23,
        fontSize: 12,
        fontWeight: 'bold',
        fontFamily: 'sans',
        color: '#1d4ed8',
        align: 'center',
        visible: true,
      },
      {
        id: 'el-heading',
        kind: 'heading',
        label: 'Certificate Heading',
        text: 'Certificate of Completion',
        xPct: 50,
        yPct: 32,
        fontSize: 32,
        fontWeight: 'bold',
        fontFamily: 'serif',
        color: '#0f172a',
        align: 'center',
        visible: true,
      },
      {
        id: 'el-subtitle',
        kind: 'subtitle',
        label: 'Subtitle Lead-in',
        text: 'THIS CERTIFIES THAT',
        xPct: 50,
        yPct: 40,
        fontSize: 11,
        fontWeight: 'normal',
        fontFamily: 'sans',
        color: '#64748b',
        align: 'center',
        visible: true,
      },
      {
        id: 'el-learner',
        kind: 'learner_name',
        label: 'Learner Full Name',
        text: '{{learner_name}}',
        xPct: 50,
        yPct: 48,
        fontSize: 28,
        fontWeight: 'bold',
        fontFamily: 'serif',
        color: '#0f172a',
        align: 'center',
        visible: true,
      },
      {
        id: 'el-completion',
        kind: 'completion_text',
        label: 'Completion Statement',
        text: 'has successfully completed all lessons and assessments for',
        xPct: 50,
        yPct: 56,
        fontSize: 13,
        fontWeight: 'normal',
        fontFamily: 'sans',
        color: '#475569',
        align: 'center',
        visible: true,
      },
      {
        id: 'el-cert-title',
        kind: 'certificate_title',
        label: 'Credential Title',
        text: certificateTitle,
        xPct: 50,
        yPct: 64,
        fontSize: 20,
        fontWeight: 'bold',
        fontFamily: 'sans',
        color: '#1d4ed8',
        align: 'center',
        visible: true,
      },
      {
        id: 'el-course',
        kind: 'course_title',
        label: 'Course & Score',
        text: '{{course_title}} · Score {{score}}%',
        xPct: 50,
        yPct: 71,
        fontSize: 12,
        fontWeight: 'normal',
        fontFamily: 'sans',
        color: '#475569',
        align: 'center',
        visible: true,
      },
      {
        id: 'el-date',
        kind: 'issue_date',
        label: 'Issue Date',
        text: 'Issued {{issue_date}}',
        xPct: 22,
        yPct: 86,
        fontSize: 11,
        fontWeight: 'bold',
        fontFamily: 'sans',
        color: '#0f172a',
        align: 'center',
        visible: true,
      },
      {
        id: 'el-signature',
        kind: 'signature_label',
        label: 'Authorized Signatory',
        text: 'Authorized Training Director',
        xPct: 50,
        yPct: 86,
        fontSize: 11,
        fontWeight: 'normal',
        fontFamily: 'serif',
        color: '#334155',
        align: 'center',
        visible: true,
      },
      {
        id: 'el-code',
        kind: 'certificate_code',
        label: 'Verification ID',
        text: '{{certificate_code}}',
        xPct: 78,
        yPct: 86,
        fontSize: 11,
        fontWeight: 'bold',
        fontFamily: 'mono',
        color: '#0f172a',
        align: 'center',
        visible: true,
      },
    ],
  };
}

export function resolveCertificateElementText(
  el: CertificateElement,
  cert: Pick<
    CertificateRecord,
    'userName' | 'courseTitle' | 'certificateTitle' | 'issuerName' | 'score' | 'issuedAt' | 'certificateCode'
  >
): string {
  const formattedDate = new Date(cert.issuedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const raw = el.text || '';
  if (el.kind === 'learner_name' && !raw.includes('{{')) {
    return cert.userName;
  }

  return raw
    .replaceAll('{{learner_name}}', cert.userName)
    .replaceAll('{{course_title}}', cert.courseTitle)
    .replaceAll('{{certificate_title}}', cert.certificateTitle)
    .replaceAll('{{issuer_name}}', cert.issuerName)
    .replaceAll('{{score}}', String(cert.score))
    .replaceAll('{{issue_date}}', formattedDate)
    .replaceAll('{{certificate_code}}', cert.certificateCode);
}
