import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidCertificateCodeFormat,
  normalizeCertificateCode,
  toPublicVerifiedCertificate,
} from './certificateVerification';
import type { CertificateRecord } from '../types/training';

test('normalizeCertificateCode trims, removes whitespace, and uppercases', () => {
  assert.equal(normalizeCertificateCode('  cf-2026-9041b1  '), 'CF-2026-9041B1');
  assert.equal(normalizeCertificateCode('cf - 2026 - 8824 d7'), 'CF-2026-8824D7');
  assert.equal(normalizeCertificateCode(''), '');
});

test('isValidCertificateCodeFormat accepts valid alphanumeric codes and rejects empty or malformed input', () => {
  assert.equal(isValidCertificateCodeFormat('CF-2026-9041B1'), true);
  assert.equal(isValidCertificateCodeFormat(' cf-2026-8824d7 '), true);
  assert.equal(isValidCertificateCodeFormat(''), false);
  assert.equal(isValidCertificateCodeFormat('CF'), false);
  assert.equal(isValidCertificateCodeFormat('CF-2026!@#'), false);
});

test('toPublicVerifiedCertificate strips private userEmail and internal identifiers', () => {
  const record: CertificateRecord = {
    _id: 'cert-1',
    certificateCode: 'CF-2026-9041B1',
    submissionId: 'sub-1',
    courseId: 'course-1',
    courseTitle: 'Workplace Safety',
    certificateTitle: 'Safety Specialist',
    issuerName: 'CertiField Academy',
    userId: 'user-1',
    userName: 'Elena Rostova',
    userEmail: 'elena.private@fieldops.org',
    score: 96,
    issuedAt: '2026-05-15T12:00:00.000Z',
    emailedCount: 2,
  };

  const pub = toPublicVerifiedCertificate(record, '/icon.svg');
  assert.equal(pub.certificateCode, 'CF-2026-9041B1');
  assert.equal(pub.userName, 'Elena Rostova');
  assert.equal(pub.score, 96);
  assert.equal(pub.systemIconUrl, '/icon.svg');
  assert.equal('userEmail' in pub, false);
  assert.equal('userId' in pub, false);
  assert.equal('submissionId' in pub, false);
});
