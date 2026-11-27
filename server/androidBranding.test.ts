import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAndroidStringsXml,
  escapeAndroidXmlString,
  normalizeServerUrlInput,
} from './androidBranding.ts';

test('escapeAndroidXmlString escapes XML special characters and Android apostrophes', () => {
  assert.equal(escapeAndroidXmlString("CertiField & Co's <Lab>"), "CertiField &amp; Co\\'s &lt;Lab&gt;");
  assert.equal(escapeAndroidXmlString('   '), 'MiLES');
});

test('buildAndroidStringsXml outputs valid Android strings resource', () => {
  const xml = buildAndroidStringsXml('Apex Edu');
  assert.ok(xml.includes('<string name="app_name">Apex Edu</string>'));
});

test('normalizeServerUrlInput prepends http for local IPs and https for domains', () => {
  assert.equal(normalizeServerUrlInput('192.168.1.42:3000/'), 'http://192.168.1.42:3000');
  assert.equal(normalizeServerUrlInput('localhost:3000'), 'http://localhost:3000');
  assert.equal(normalizeServerUrlInput('10.0.2.2:3000'), 'http://10.0.2.2:3000');
  assert.equal(normalizeServerUrlInput('train.example.com/'), 'https://train.example.com');
  assert.equal(normalizeServerUrlInput('https://ais-pre.run.app/'), 'https://ais-pre.run.app');
});
