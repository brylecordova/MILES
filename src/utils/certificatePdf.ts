import { jsPDF } from 'jspdf';
import type { CertificateRecord } from '../types/training.ts';
import { getDefaultCertificateDesign, resolveCertificateElementText } from './certificateDefaults.ts';

function parseHexRgb(hex: string | undefined, fallback: [number, number, number]): [number, number, number] {
  if (!hex) return fallback;
  const clean = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return fallback;
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function buildCertificateDoc(cert: CertificateRecord): jsPDF {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const design =
    cert.certificateDesign ?? getDefaultCertificateDesign(cert.issuerName, cert.certificateTitle);

  const [bgR, bgG, bgB] = parseHexRgb(design.canvasBackground, [255, 255, 255]);
  doc.setFillColor(bgR, bgG, bgB);
  doc.rect(0, 0, width, height, 'F');

  // Optional embedded data-URI background image
  if (design.backgroundImageUrl && design.backgroundImageUrl.startsWith('data:image/')) {
    try {
      const format = design.backgroundImageUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(design.backgroundImageUrl, format, 0, 0, width, height);
    } catch {
      // Ignore unsupported background image encoding
    }
  }

  const [borderR, borderG, borderB] = parseHexRgb(design.borderColor, [15, 23, 42]);
  const [accentR, accentG, accentB] = parseHexRgb(design.accentColor, [29, 78, 216]);

  if (design.showBorder) {
    doc.setDrawColor(borderR, borderG, borderB);
    doc.setLineWidth(3);
    doc.rect(28, 28, width - 56, height - 56);

    doc.setDrawColor(accentR, accentG, accentB);
    doc.setLineWidth(1);
    doc.rect(38, 38, width - 76, height - 76);
  }

  for (const el of design.elements) {
    if (!el.visible) continue;
    const x = (Math.max(0, Math.min(100, el.xPct)) / 100) * width;
    const y = (Math.max(0, Math.min(100, el.yPct)) / 100) * height;

    if (el.kind === 'system_icon') {
      const radius = Math.max(14, Math.min(34, el.fontSize * 0.55));
      doc.setFillColor(accentR, accentG, accentB);
      doc.circle(x, y, radius, 'F');
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(1.5);
      doc.circle(x, y, Math.max(8, radius - 4), 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(Math.max(10, radius * 0.65));
      doc.setTextColor(255, 255, 255);
      const monogram = (cert.issuerName || 'C').trim().charAt(0).toUpperCase() || 'C';
      doc.text(monogram, x, y + radius * 0.22, { align: 'center' });
      continue;
    }

    const resolved = resolveCertificateElementText(el, cert);
    if (!resolved) continue;

    const fontMap = {
      sans: 'helvetica',
      serif: 'times',
      mono: 'courier',
    } as const;
    const jsPdfFont = fontMap[el.fontFamily] ?? 'helvetica';
    const jsPdfStyle = el.fontWeight === 'bold' ? 'bold' : 'normal';
    const [textR, textG, textB] = parseHexRgb(el.color, [15, 23, 42]);

    doc.setFont(jsPdfFont, jsPdfStyle);
    doc.setFontSize(Math.max(7, Math.min(64, el.fontSize)));
    doc.setTextColor(textR, textG, textB);
    doc.text(resolved, x, y, { align: el.align || 'center' });

    if (el.kind === 'learner_name') {
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.9);
      doc.line(Math.max(60, x - 165), y + 10, Math.min(width - 60, x + 165), y + 10);
    }
  }

  return doc;
}

export function downloadCertificatePdf(cert: CertificateRecord): void {
  const doc = buildCertificateDoc(cert);
  doc.save(`${cert.certificateCode}-${cert.courseTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`);
}

export function generateCertificatePdfBase64(cert: CertificateRecord): string {
  const doc = buildCertificateDoc(cert);
  const dataUri = doc.output('datauristring');
  const idx = dataUri.indexOf('base64,');
  return idx >= 0 ? dataUri.slice(idx + 7) : '';
}
