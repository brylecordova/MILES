import React, { useEffect, useRef } from 'react';

interface FuturisticBackdropProps {
  isDark: boolean;
  accentColor?: string;
}

interface NodeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

function hexToRgbTuple(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return [r, g, b];
    }
  }
  return [29, 78, 216];
}

export const FuturisticBackdrop: React.FC<FuturisticBackdropProps> = ({
  isDark,
  accentColor = '#1d4ed8',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const [ar, ag, ab] = hexToRgbTuple(accentColor);
    const nodeCount = width < 768 ? 18 : 30;
    const nodes: NodeParticle[] = Array.from({ length: nodeCount }, (_, idx) => ({
      x: ((idx * 137.5) % 100) * (width / 100),
      y: ((idx * 73.1) % 100) * (height / 100),
      vx: ((idx % 2 === 0 ? 1 : -1) * (0.18 + (idx % 5) * 0.05)),
      vy: ((idx % 3 === 0 ? 1 : -1) * (0.14 + (idx % 4) * 0.05)),
      radius: 1.5 + (idx % 3) * 0.7,
    }));

    const drawFrame = () => {
      ctx.clearRect(0, 0, width, height);

      const lineColor = isDark
        ? `rgba(56, 189, 248, 0.14)`
        : `rgba(${ar}, ${ag}, ${ab}, 0.09)`;
      const dotColor = isDark
        ? `rgba(125, 211, 252, 0.42)`
        : `rgba(${ar}, ${ag}, ${ab}, 0.24)`;

      const maxDist = 155;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        if (!reducedMotion) {
          a.x += a.vx;
          a.y += a.vy;
          if (a.x < 0 || a.x > width) a.vx *= -1;
          if (a.y < 0 || a.y > height) a.vy *= -1;
        }

        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * (isDark ? 0.18 : 0.11);
            ctx.strokeStyle = isDark
              ? `rgba(56, 189, 248, ${alpha.toFixed(3)})`
              : `rgba(${ar}, ${ag}, ${ab}, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }

        ctx.fillStyle = dotColor;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Subtle horizon scan line accent
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
    };

    drawFrame();
    if (reducedMotion) {
      return () => window.removeEventListener('resize', resize);
    }

    let rafId = 0;
    let lastTick = 0;
    const tick = (now: number) => {
      if (!document.hidden && now - lastTick >= 34) {
        lastTick = now;
        drawFrame();
      }
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [isDark, accentColor]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
    >
      {/* Subtle architectural coordinate grid */}
      <div className="futuristic-grid absolute inset-0 opacity-75 dark:opacity-100" />

      {/* Ambient field illumination orbs */}
      <div
        className="absolute -top-32 right-[-10%] h-[520px] w-[520px] rounded-full blur-3xl transition-opacity duration-500"
        style={{
          background: isDark
            ? `radial-gradient(circle, rgba(56, 189, 248, 0.16) 0%, rgba(29, 78, 216, 0.08) 45%, transparent 72%)`
            : `radial-gradient(circle, rgba(29, 78, 216, 0.12) 0%, rgba(14, 165, 233, 0.05) 50%, transparent 75%)`,
        }}
      />
      <div
        className="absolute -bottom-40 left-[-8%] h-[460px] w-[460px] rounded-full blur-3xl transition-opacity duration-500"
        style={{
          background: isDark
            ? `radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, rgba(14, 165, 233, 0.06) 50%, transparent 75%)`
            : `radial-gradient(circle, rgba(14, 165, 233, 0.10) 0%, rgba(16, 185, 129, 0.04) 50%, transparent 75%)`,
        }}
      />

      {/* Lightweight dynamic geometric network constellation */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
};
