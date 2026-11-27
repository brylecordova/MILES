import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { SystemBranding } from '../src/types/training.ts';

const MIPMAP_DENSITIES: Array<{ folder: string; size: number }> = [
  { folder: 'mipmap-mdpi', size: 48 },
  { folder: 'mipmap-hdpi', size: 72 },
  { folder: 'mipmap-xhdpi', size: 96 },
  { folder: 'mipmap-xxhdpi', size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
];

export function escapeAndroidXmlString(value: string): string {
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim() || 'MiLES';
  return cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'");
}

export function buildAndroidStringsXml(appName: string): string {
  return `<resources>\n    <string name="app_name">${escapeAndroidXmlString(appName)}</string>\n</resources>\n`;
}

export function normalizeServerUrlInput(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(localhost|127\.0\.0\.1|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|\d+\.\d+\.\d+\.\d+)/i.test(trimmed)) {
    return `http://${trimmed}`;
  }
  return `https://${trimmed}`;
}

async function resolveIconSourceBuffer(
  iconUrl: string,
  rootDir: string
): Promise<{ buffer: Buffer; ext: string } | null> {
  const trimmed = (iconUrl || '').trim();
  const defaultMilesPng = path.resolve(
    rootDir,
    'public',
    'assets',
    'aistudio',
    'Gemini_Generated_Image_wrxsxwrxsxwrxsxw-removebg-preview_a8a27cfa.png'
  );
  const fallbackPng = fs.existsSync(defaultMilesPng)
    ? defaultMilesPng
    : path.resolve(rootDir, 'public', 'pwa-512x512.png');

  if (!trimmed || trimmed === '/icon.svg') {
    if (fs.existsSync(fallbackPng)) {
      return { buffer: fs.readFileSync(fallbackPng), ext: '.png' };
    }
    return null;
  }

  if (trimmed.startsWith('data:image/')) {
    const match = trimmed.match(/^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/i);
    if (match) {
      const ext = match[1].toLowerCase() === 'jpeg' ? '.jpg' : `.${match[1].toLowerCase()}`;
      return { buffer: Buffer.from(match[2], 'base64'), ext };
    }
  }

  if (trimmed.startsWith('/')) {
    const rel = trimmed.replace(/^\/+/, '');
    const candidatePublic = path.resolve(rootDir, 'public', rel);
    const candidateRoot = path.resolve(rootDir, rel);
    const chosen = fs.existsSync(candidatePublic)
      ? candidatePublic
      : fs.existsSync(candidateRoot)
      ? candidateRoot
      : null;
    if (chosen && !chosen.endsWith('.svg')) {
      return { buffer: fs.readFileSync(chosen), ext: path.extname(chosen) || '.png' };
    }
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(trimmed, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('svg')) {
          const arr = new Uint8Array(await res.arrayBuffer());
          if (arr.byteLength > 32) {
            const ext = contentType.includes('jpeg') || contentType.includes('jpg')
              ? '.jpg'
              : contentType.includes('webp')
              ? '.webp'
              : '.png';
            return { buffer: Buffer.from(arr), ext };
          }
        }
      }
    } catch {
      // Fall back to bundled raster icon
    }
  }

  if (fs.existsSync(fallbackPng)) {
    return { buffer: fs.readFileSync(fallbackPng), ext: '.png' };
  }
  return null;
}

export async function syncAndroidProjectBranding(
  branding: SystemBranding,
  rootDir = process.cwd()
): Promise<void> {
  const androidResDir = path.resolve(rootDir, 'android', 'app', 'src', 'main', 'res');
  if (!fs.existsSync(androidResDir)) return;

  // 1. Sync Android app_name in strings.xml
  const valuesDir = path.join(androidResDir, 'values');
  fs.mkdirSync(valuesDir, { recursive: true });
  const stringsPath = path.join(valuesDir, 'strings.xml');
  fs.writeFileSync(stringsPath, buildAndroidStringsXml(branding.systemName), 'utf-8');

  // 2. Sync Android launcher icons across mipmap-* densities
  const source = await resolveIconSourceBuffer(branding.iconUrl, rootDir);
  if (!source) return;

  const tempDir = path.resolve(rootDir, '.data');
  fs.mkdirSync(tempDir, { recursive: true });
  const tempSrc = path.join(tempDir, `android-icon-src-${process.pid}${source.ext}`);
  fs.writeFileSync(tempSrc, source.buffer);

  try {
    for (const { folder, size } of MIPMAP_DENSITIES) {
      const outDir = path.join(androidResDir, folder);
      fs.mkdirSync(outDir, { recursive: true });
      const squareOut = path.join(outDir, 'ic_launcher.png');
      const roundOut = path.join(outDir, 'ic_launcher_round.png');

      try {
        execFileSync(
          'convert',
          [
            tempSrc,
            '-auto-orient',
            '-resize',
            `${size}x${size}^`,
            '-gravity',
            'center',
            '-extent',
            `${size}x${size}`,
            'PNG32:' + squareOut,
          ],
          { timeout: 8000 }
        );

        const half = Math.floor(size / 2);
        execFileSync(
          'convert',
          [
            squareOut,
            '(',
            '-size',
            `${size}x${size}`,
            'xc:none',
            '-fill',
            'white',
            '-draw',
            `circle ${half},${half} ${half},0`,
            ')',
            '-compose',
            'CopyOpacity',
            '-composite',
            'PNG32:' + roundOut,
          ],
          { timeout: 8000 }
        );
      } catch {
        // Fallback: copy PNG directly if ImageMagick fails
        if (source.ext === '.png') {
          fs.copyFileSync(tempSrc, squareOut);
          fs.copyFileSync(tempSrc, roundOut);
        }
      }
    }
  } finally {
    if (fs.existsSync(tempSrc)) {
      fs.unlinkSync(tempSrc);
    }
  }
}
