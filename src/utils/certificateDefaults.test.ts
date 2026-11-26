import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getDefaultCertificateDesign,
  getDefaultSystemBranding,
  resolveCertificateElementText,
} from './certificateDefaults.ts';

test('getDefaultSystemBranding provides valid defaults', () => {
  const branding = getDefaultSystemBranding();
  assert.equal(branding.systemName, 'CertiField');
  assert.ok(branding.iconUrl.startsWith('/'));
  assert.match(branding.accentColor, /^#[0-9a-fA-F]{6}$/);
  assert.equal(branding.appDistributionMode, 'apk_download');
});

test('getDefaultCertificateDesign places learner_name and all required elements', () => {
  const design = getDefaultCertificateDesign('Acme Field Ops', 'Safety Lead');
  assert.equal(design.showBorder, true);
  const learnerEl = design.elements.find((el) => el.kind === 'learner_name');
  assert.ok(learnerEl);
  assert.equal(learnerEl.xPct, 50);
  assert.equal(learnerEl.text, '{{learner_name}}');

  const issuerEl = design.elements.find((el) => el.kind === 'issuer_name');
  assert.equal(issuerEl?.text, 'Acme Field Ops');

  const certTitleEl = design.elements.find((el) => el.kind === 'certificate_title');
  assert.equal(certTitleEl?.text, 'Safety Lead');
});

test('resolveCertificateElementText substitutes dynamic certificate fields', () => {
  const cert = {
    userName: 'Jordan Vance',
    courseTitle: 'Lockout Tagout Essentials',
    certificateTitle: 'LOTO Level 1 Specialist',
    issuerName: 'Apex Industrial',
    score: 96,
    issuedAt: '2026-05-15T12:00:00.000Z',
    certificateCode: 'CF-2026-99AB12',
  };

  const design = getDefaultCertificateDesign(cert.issuerName, cert.certificateTitle);
  const learnerEl = design.elements.find((e) => e.kind === 'learner_name')!;
  const courseEl = design.elements.find((e) => e.kind === 'course_title')!;
  const codeEl = design.elements.find((e) => e.kind === 'certificate_code')!;

  assert.equal(resolveCertificateElementText(learnerEl, cert), 'Jordan Vance');
  assert.equal(
    resolveCertificateElementText(courseEl, cert),
    'Lockout Tagout Essentials · Score 96%'
  );
  assert.equal(resolveCertificateElementText(codeEl, cert), 'CF-2026-99AB12');

  // Even if admin clears {{learner_name}}, learner_name element still resolves to cert.userName
  assert.equal(
    resolveCertificateElementText({ ...learnerEl, text: 'Placeholder' }, cert),
    'Jordan Vance'
  );
});
