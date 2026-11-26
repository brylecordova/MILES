import React, { useRef, useState } from 'react';
import { Award, Eye, EyeOff, Move, Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import type {
  CertificateDesign,
  CertificateElement,
  SystemBranding,
} from '../types/training';
import {
  getDefaultCertificateDesign,
  resolveCertificateElementText,
} from '../utils/certificateDefaults';

interface CertificateDesignerProps {
  design: CertificateDesign;
  courseTitle: string;
  certificateTitle: string;
  issuerName: string;
  systemBranding: SystemBranding;
  onChange: (next: CertificateDesign) => void;
  onUploadBackground: (file: File, onReady: (url: string) => void) => void;
  uploadingBg: boolean;
}

const PLACEHOLDER_TOKENS = [
  '{{learner_name}}',
  '{{certificate_title}}',
  '{{course_title}}',
  '{{score}}',
  '{{issue_date}}',
  '{{certificate_code}}',
];

export const CertificateDesigner: React.FC<CertificateDesignerProps> = ({
  design,
  courseTitle,
  certificateTitle,
  issuerName,
  systemBranding,
  onChange,
  onUploadBackground,
  uploadingBg,
}) => {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>(
    design.elements.find((e) => e.kind === 'learner_name')?.id ?? design.elements[0]?.id ?? ''
  );
  const [snappedCenter, setSnappedCenter] = useState(false);

  const sampleCert = {
    userName: 'Jordan Vance',
    courseTitle: courseTitle || 'Field Safety Certification',
    certificateTitle: certificateTitle || 'Certified Specialist',
    issuerName: issuerName || systemBranding.systemName || 'CertiField Academy',
    score: 96,
    issuedAt: new Date().toISOString(),
    certificateCode: 'CF-2026-SAMPLE',
  };

  const selectedElement = design.elements.find((el) => el.id === selectedId) ?? null;

  function updateElement(id: string, patch: Partial<CertificateElement>) {
    onChange({
      ...design,
      elements: design.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)),
    });
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>, id: string) {
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointerId is not active in synthetic events
    }
    draggingRef.current = id;
    setSelectedId(id);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>, id: string) {
    if (draggingRef.current !== id || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    let xPct = ((e.clientX - rect.left) / rect.width) * 100;
    let yPct = ((e.clientY - rect.top) / rect.height) * 100;
    xPct = Math.max(4, Math.min(96, xPct));
    yPct = Math.max(5, Math.min(95, yPct));

    // Snap horizontally to center guide when within 1.8%
    if (Math.abs(xPct - 50) <= 1.8) {
      xPct = 50;
      setSnappedCenter(true);
    } else {
      setSnappedCenter(false);
    }

    updateElement(id, {
      xPct: Math.round(xPct * 10) / 10,
      yPct: Math.round(yPct * 10) / 10,
    });
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore synthetic pointer release errors
    }
    draggingRef.current = null;
    setSnappedCenter(false);
  }

  function addCustomTextElement() {
    const id = `el-custom-${Date.now()}`;
    const nextEl: CertificateElement = {
      id,
      kind: 'custom_text',
      label: 'Custom Text',
      text: 'Accredited Field Program',
      xPct: 50,
      yPct: 77,
      fontSize: 12,
      fontWeight: 'normal',
      fontFamily: 'sans',
      color: '#475569',
      align: 'center',
      visible: true,
    };
    onChange({ ...design, elements: [...design.elements, nextEl] });
    setSelectedId(id);
  }

  function removeElement(id: string) {
    const next = design.elements.filter((el) => el.id !== id);
    onChange({ ...design, elements: next });
    if (selectedId === id) {
      setSelectedId(next[0]?.id ?? '');
    }
  }

  function resetToDefault() {
    const fresh = getDefaultCertificateDesign(
      issuerName || systemBranding.systemName,
      certificateTitle || 'Certified Specialist'
    );
    fresh.accentColor = systemBranding.accentColor || fresh.accentColor;
    onChange(fresh);
    setSelectedId(fresh.elements.find((e) => e.kind === 'learner_name')?.id ?? fresh.elements[0]?.id ?? '');
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Drag-and-Drop Certificate Designer
          </h2>
          <p className="text-xs text-slate-600">
            Drag the learner name, credential title, verification ID, or seal directly onto the A4 certificate canvas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={addCustomTextElement}
            className="flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Text</span>
          </button>
          <button
            type="button"
            onClick={resetToDefault}
            className="flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Layout</span>
          </button>
        </div>
      </div>

      {/* Interactive A4 Landscape Canvas + Inspector */}
      <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        {/* Interactive Canvas */}
        <div className="space-y-2.5">
          <div
            ref={canvasRef}
            data-testid="certificate-designer-canvas"
            className="relative aspect-[842/595] w-full overflow-hidden rounded-xl border border-slate-300 shadow-sm select-none"
            style={{
              backgroundColor: design.canvasBackground || '#ffffff',
            }}
          >
            {design.backgroundImageUrl && (
              <img
                src={design.backgroundImageUrl}
                alt="Certificate background"
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

            {/* Vertical center alignment guide while dragging */}
            {snappedCenter && (
              <div className="pointer-events-none absolute top-0 bottom-0 left-1/2 w-px bg-blue-500/70" />
            )}

            {design.elements
              .filter((el) => el.visible)
              .map((el) => {
                const isSelected = el.id === selectedId;
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
                    role="button"
                    tabIndex={0}
                    data-testid={`cert-el-${el.kind}`}
                    onClick={() => setSelectedId(el.id)}
                    onPointerDown={(e) => handlePointerDown(e, el.id)}
                    onPointerMove={(e) => handlePointerMove(e, el.id)}
                    onPointerUp={handlePointerUp}
                    style={{
                      left: `${el.xPct}%`,
                      top: `${el.yPct}%`,
                      transform: `translate(${translateX}, -50%)`,
                      color: el.color,
                      fontSize: `clamp(9px, ${(el.fontSize / 842) * 100}cqw, ${el.fontSize}px)`,
                      fontWeight: el.fontWeight === 'bold' ? 700 : 400,
                      textAlign: el.align,
                    }}
                    className={`absolute cursor-grab active:cursor-grabbing rounded px-2 py-0.5 whitespace-nowrap transition-shadow ${fontFamilyClass} ${
                      isSelected
                        ? 'ring-2 ring-blue-600 bg-blue-50/40'
                        : 'hover:ring-1 hover:ring-slate-400/70'
                    }`}
                    title={`Drag ${el.label}`}
                  >
                    {el.kind === 'system_icon' ? (
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/60 shadow-xs"
                        style={{ backgroundColor: design.accentColor || '#1d4ed8' }}
                      >
                        {systemBranding.iconUrl ? (
                          <img
                            src={systemBranding.iconUrl}
                            alt={systemBranding.systemName}
                            className="h-6 w-6 rounded object-contain"
                          />
                        ) : (
                          <Award className="h-5 w-5 text-white" />
                        )}
                      </div>
                    ) : (
                      <span>{resolveCertificateElementText(el, sampleCert)}</span>
                    )}
                  </div>
                );
              })}
          </div>
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <Move className="h-3.5 w-3.5" />
            <span>
              Click and drag any field above. Dynamic tags like{' '}
              <code className="font-mono-tabular text-slate-800">{'{{learner_name}}'}</code> populate automatically when issued.
            </span>
          </p>
        </div>

        {/* Properties & Element Inspector */}
        <div className="space-y-4">
          {/* Canvas Styling */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Canvas &amp; Border
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <label className="text-[11px] font-medium text-slate-600">
                Paper
                <input
                  type="color"
                  value={design.canvasBackground}
                  onChange={(e) => onChange({ ...design, canvasBackground: e.target.value })}
                  className="mt-1 h-8 w-full cursor-pointer rounded border border-slate-300 bg-white p-0.5"
                />
              </label>
              <label className="text-[11px] font-medium text-slate-600">
                Border
                <input
                  type="color"
                  value={design.borderColor}
                  onChange={(e) => onChange({ ...design, borderColor: e.target.value })}
                  className="mt-1 h-8 w-full cursor-pointer rounded border border-slate-300 bg-white p-0.5"
                />
              </label>
              <label className="text-[11px] font-medium text-slate-600">
                Accent
                <input
                  type="color"
                  value={design.accentColor}
                  onChange={(e) => onChange({ ...design, accentColor: e.target.value })}
                  className="mt-1 h-8 w-full cursor-pointer rounded border border-slate-300 bg-white p-0.5"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={design.showBorder}
                  onChange={(e) => onChange({ ...design, showBorder: e.target.checked })}
                  className="h-4 w-4 accent-blue-700"
                />
                <span>Show double border frame</span>
              </label>

              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                <Upload className="h-3.5 w-3.5" />
                <span>{uploadingBg ? 'Uploading...' : 'Backdrop Image'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      onUploadBackground(file, (url) =>
                        onChange({ ...design, backgroundImageUrl: url })
                      );
                    }
                  }}
                />
              </label>
            </div>
            {design.backgroundImageUrl && (
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="truncate">Background image attached</span>
                <button
                  type="button"
                  onClick={() => onChange({ ...design, backgroundImageUrl: undefined })}
                  className="font-semibold text-red-700 hover:underline"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Element Layer List */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Certificate Fields
            </h3>
            <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
              {design.elements.map((el) => (
                <div
                  key={el.id}
                  className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs ${
                    el.id === selectedId
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(el.id)}
                    className="flex-1 truncate text-left font-medium"
                  >
                    {el.label}
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateElement(el.id, { visible: !el.visible })}
                      aria-label={el.visible ? `Hide ${el.label}` : `Show ${el.label}`}
                      className="rounded p-1 hover:bg-slate-500/20"
                    >
                      {el.visible ? (
                        <Eye className="h-3.5 w-3.5" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5 opacity-60" />
                      )}
                    </button>
                    {el.kind === 'custom_text' && (
                      <button
                        type="button"
                        onClick={() => removeElement(el.id)}
                        aria-label={`Remove ${el.label}`}
                        className="rounded p-1 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Element Editor */}
          {selectedElement && (
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">
                  Edit: {selectedElement.label}
                </span>
                <span className="font-mono-tabular text-[11px] text-slate-500">
                  X {selectedElement.xPct}% · Y {selectedElement.yPct}%
                </span>
              </div>

              {selectedElement.kind !== 'system_icon' && (
                <>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                      Text / Placeholder Template
                    </label>
                    <input
                      type="text"
                      value={selectedElement.text}
                      onChange={(e) => updateElement(selectedElement.id, { text: e.target.value })}
                      className="min-h-[36px] w-full rounded-lg border border-slate-300 px-2.5 text-xs"
                    />
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {PLACEHOLDER_TOKENS.map((tok) => (
                        <button
                          key={tok}
                          type="button"
                          onClick={() =>
                            updateElement(selectedElement.id, {
                              text: selectedElement.text
                                ? `${selectedElement.text} ${tok}`
                                : tok,
                            })
                          }
                          className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono-tabular text-[10px] text-slate-700 hover:bg-slate-100"
                        >
                          {tok}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[11px] font-semibold text-slate-600">
                      Font
                      <select
                        value={selectedElement.fontFamily}
                        onChange={(e) =>
                          updateElement(selectedElement.id, {
                            fontFamily: e.target.value as CertificateElement['fontFamily'],
                          })
                        }
                        className="mt-1 min-h-[34px] w-full rounded-lg border border-slate-300 bg-white px-2 text-xs"
                      >
                        <option value="sans">Sans Serif</option>
                        <option value="serif">Institutional Serif</option>
                        <option value="mono">Monospace</option>
                      </select>
                    </label>
                    <label className="text-[11px] font-semibold text-slate-600">
                      Weight
                      <select
                        value={selectedElement.fontWeight}
                        onChange={(e) =>
                          updateElement(selectedElement.id, {
                            fontWeight: e.target.value as CertificateElement['fontWeight'],
                          })
                        }
                        className="mt-1 min-h-[34px] w-full rounded-lg border border-slate-300 bg-white px-2 text-xs"
                      >
                        <option value="normal">Regular</option>
                        <option value="bold">Bold</option>
                      </select>
                    </label>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-[11px] font-semibold text-slate-600">
                      Size (pt)
                      <input
                        type="number"
                        min={8}
                        max={48}
                        value={selectedElement.fontSize}
                        onChange={(e) =>
                          updateElement(selectedElement.id, {
                            fontSize: Math.max(8, Math.min(48, Number(e.target.value) || 12)),
                          })
                        }
                        className="font-mono-tabular mt-1 min-h-[34px] w-full rounded-lg border border-slate-300 px-2 text-xs"
                      />
                    </label>
                    <label className="text-[11px] font-semibold text-slate-600">
                      Align
                      <select
                        value={selectedElement.align}
                        onChange={(e) =>
                          updateElement(selectedElement.id, {
                            align: e.target.value as CertificateElement['align'],
                          })
                        }
                        className="mt-1 min-h-[34px] w-full rounded-lg border border-slate-300 bg-white px-2 text-xs"
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </label>
                    <label className="text-[11px] font-semibold text-slate-600">
                      Color
                      <input
                        type="color"
                        value={selectedElement.color}
                        onChange={(e) =>
                          updateElement(selectedElement.id, { color: e.target.value })
                        }
                        className="mt-1 h-[34px] w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-0.5"
                      />
                    </label>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] font-semibold text-slate-600">
                  Horizontal X (%)
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={selectedElement.xPct}
                    onChange={(e) =>
                      updateElement(selectedElement.id, {
                        xPct: Math.max(0, Math.min(100, Number(e.target.value) || 50)),
                      })
                    }
                    className="font-mono-tabular mt-1 min-h-[34px] w-full rounded-lg border border-slate-300 px-2 text-xs"
                  />
                </label>
                <label className="text-[11px] font-semibold text-slate-600">
                  Vertical Y (%)
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={selectedElement.yPct}
                    onChange={(e) =>
                      updateElement(selectedElement.id, {
                        yPct: Math.max(0, Math.min(100, Number(e.target.value) || 50)),
                      })
                    }
                    className="font-mono-tabular mt-1 min-h-[34px] w-full rounded-lg border border-slate-300 px-2 text-xs"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
