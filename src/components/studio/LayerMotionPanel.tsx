import React from 'react';
import type { LayerMotion, LayerMotionPreset, TransitionCurve } from '../../types';
import { LAYER_MOTION_PRESETS } from '../../types';
import { CommitNumberInput } from '../ui/CommitNumberInput';

const PRESET_LABEL: Record<LayerMotionPreset, string> = {
  fade: 'Pudar',
  pop: 'Pop',
  'slide-up': 'Geser dari bawah',
  'slide-down': 'Geser dari atas',
  'slide-left': 'Geser dari kanan',
  'slide-right': 'Geser dari kiri',
  zoom: 'Zoom',
  spin: 'Putar',
  blur: 'Blur'
};

/** Exit presets read as where the layer goes. */
const EXIT_LABEL: Partial<Record<LayerMotionPreset, string>> = {
  'slide-up': 'Geser ke atas',
  'slide-down': 'Geser ke bawah',
  'slide-left': 'Geser ke kiri',
  'slide-right': 'Geser ke kanan'
};

const CURVES: { id: TransitionCurve; label: string }[] = [
  { id: 'smooth', label: 'Halus' },
  { id: 'soft', label: 'Lembut' },
  { id: 'strong', label: 'Tegas' },
  { id: 'sharp', label: 'Tajam' },
  { id: 'rush', label: 'Melesat' },
  { id: 'linear', label: 'Rata' }
];

interface LayerMotionPanelProps {
  motion: LayerMotion | undefined;
  /** Shot length in seconds; default timings are placed inside it. */
  sceneDuration: number;
  /** Playhead time inside the shot, read when a step is set to the playhead. */
  getPlayheadInShot: () => number;
  onChange: (motion: LayerMotion | null) => void;
}

const inputClass =
  'w-full h-7 px-1.5 rounded-md bg-surface-2 border border-border focus:border-accent text-[11px] font-mono text-on-surface text-center focus:outline-none';
const selectClass =
  'w-full h-7 px-1.5 rounded-md bg-surface-2 border border-border focus:border-accent text-[11px] text-on-surface focus:outline-none';

/** Entrance, A→B move and exit for one layer, timed in seconds from the shot's start. */
export const LayerMotionPanel: React.FC<LayerMotionPanelProps> = ({ motion, sceneDuration, getPlayheadInShot, onChange }) => {
  const m = motion || {};
  const maxT = Math.max(0.1, sceneDuration);
  const update = (next: LayerMotion) => onChange(next);
  const here = () => Math.min(maxT, Math.max(0, Math.round(getPlayheadInShot() * 100) / 100));

  const timingRow = (
    step: { at: number; dur: number; curve?: TransitionCurve },
    onStep: (patch: Partial<{ at: number; dur: number; curve: TransitionCurve | undefined }>) => void,
    label: string
  ) => (
    <div className="grid grid-cols-[1fr_1fr_1.2fr_auto] gap-1 items-end">
      <label className="flex flex-col gap-0.5 text-[9px] text-text-muted">
        Mulai (dtk)
        <CommitNumberInput
          value={step.at}
          min={0}
          max={maxT}
          step={0.1}
          onCommit={(v) => onStep({ at: v })}
          ariaLabel={`Waktu mulai ${label}`}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-0.5 text-[9px] text-text-muted">
        Durasi
        <CommitNumberInput
          value={step.dur}
          min={0.05}
          max={10}
          step={0.1}
          onCommit={(v) => onStep({ dur: v })}
          ariaLabel={`Durasi ${label}`}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-0.5 text-[9px] text-text-muted">
        Gerak
        <select
          value={step.curve || ''}
          onChange={(e) => onStep({ curve: (e.target.value || undefined) as TransitionCurve | undefined })}
          aria-label={`Gaya gerak ${label}`}
          className={selectClass}
        >
          <option value="">Halus</option>
          {CURVES.filter((c) => c.id !== 'smooth').map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => onStep({ at: here() })}
        title="Mulai di posisi playhead"
        aria-label={`Mulai ${label} di playhead`}
        className="h-7 w-7 rounded-md bg-surface-2 border border-border text-text-muted hover:text-accent flex items-center justify-center"
      >
        <span className="material-symbols-outlined text-[14px]">my_location</span>
      </button>
    </div>
  );

  const presetSelect = (
    value: LayerMotionPreset | undefined,
    onPick: (p: LayerMotionPreset | null) => void,
    label: string,
    names: Partial<Record<LayerMotionPreset, string>> = {}
  ) => (
    <select
      value={value || ''}
      onChange={(e) => onPick((e.target.value || null) as LayerMotionPreset | null)}
      aria-label={label}
      className={selectClass}
    >
      <option value="">Tidak ada</option>
      {LAYER_MOTION_PRESETS.map((p) => (
        <option key={p} value={p}>
          {names[p] || PRESET_LABEL[p]}
        </option>
      ))}
    </select>
  );

  const move = m.move;
  const moveField = (key: 'x' | 'y' | 'scale' | 'rotation' | 'opacity', label: string, fallback: number, step: number) => (
    <label className="flex flex-col gap-0.5 text-[9px] text-text-muted">
      {label}
      <CommitNumberInput
        value={move?.to?.[key] ?? fallback}
        step={step}
        min={key === 'opacity' ? 0 : key === 'scale' ? 0.05 : undefined}
        max={key === 'opacity' ? 1 : undefined}
        onCommit={(v) => move && update({ ...m, move: { ...move, to: { ...move.to, [key]: v } } })}
        ariaLabel={`Tujuan ${label}`}
        className={inputClass}
      />
    </label>
  );

  return (
    <div className="flex flex-col gap-3 pt-2 border-t border-border/40">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-on-surface flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[15px] text-accent">animation</span>
          Animasi Layer
        </span>
        {(m.enter || m.move || m.exit) && (
          <button type="button" onClick={() => onChange(null)} className="text-[10px] text-text-muted hover:text-rose-300">
            Hapus semua
          </button>
        )}
      </div>

      {/* Entrance */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Masuk</span>
        {presetSelect(
          m.enter?.preset,
          (p) => update({ ...m, enter: p ? { at: m.enter?.at ?? 0, dur: m.enter?.dur ?? 0.5, curve: m.enter?.curve, preset: p } : undefined }),
          'Animasi masuk'
        )}
        {m.enter && timingRow(m.enter, (patch) => update({ ...m, enter: { ...m.enter!, ...patch } }), 'animasi masuk')}
      </div>

      {/* A → B move */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Gerak A → B</span>
          <button
            type="button"
            onClick={() =>
              update({
                ...m,
                move: move
                  ? undefined
                  : { at: here(), dur: Math.min(1, Math.max(0.2, maxT - here())), to: { x: 0, y: -120, scale: 1, rotation: 0, opacity: 1 } }
              })
            }
            aria-pressed={Boolean(move)}
            className={`px-2 py-0.5 rounded-full text-[10px] border ${
              move ? 'bg-accent/15 border-accent text-accent font-semibold' : 'bg-surface-2 border-border text-text-muted hover:text-on-surface'
            }`}
          >
            {move ? 'Aktif' : 'Tambah'}
          </button>
        </div>
        {move && (
          <>
            <p className="text-[10px] text-text-faint leading-snug">
              Layer bergerak dari posisinya sekarang (A) ke posisi B, diukur dari A.
            </p>
            <div className="grid grid-cols-5 gap-1">
              {moveField('x', 'X (px)', 0, 10)}
              {moveField('y', 'Y (px)', 0, 10)}
              {moveField('scale', 'Skala', 1, 0.05)}
              {moveField('rotation', 'Putar°', 0, 5)}
              {moveField('opacity', 'Opasitas', 1, 0.05)}
            </div>
            {timingRow(move, (patch) => update({ ...m, move: { ...move, ...patch } }), 'gerak')}
          </>
        )}
      </div>

      {/* Exit */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Keluar</span>
        {presetSelect(
          m.exit?.preset,
          (p) =>
            update({
              ...m,
              exit: p
                ? {
                    at: m.exit?.at ?? Math.max(0, Math.round((maxT - 0.4) * 100) / 100),
                    dur: m.exit?.dur ?? 0.4,
                    curve: m.exit?.curve,
                    preset: p
                  }
                : undefined
            }),
          'Animasi keluar',
          EXIT_LABEL
        )}
        {m.exit && timingRow(m.exit, (patch) => update({ ...m, exit: { ...m.exit!, ...patch } }), 'animasi keluar')}
      </div>
    </div>
  );
};
