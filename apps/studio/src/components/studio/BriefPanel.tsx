import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useMooStore } from '../../store/useMooStore';
import {
  BRIEF_PLATFORMS,
  BRIEF_TONES,
  MAX_TARGET_SECONDS,
  MIN_TARGET_SECONDS,
  getBriefPlatform,
  planShots
} from '../../engine/ai/brief';
import { CommitNumberInput } from '../ui/CommitNumberInput';

const chipClass = (selected: boolean) =>
  `min-h-[32px] px-2.5 rounded-lg border text-[11px] font-medium transition-colors ${
    selected
      ? 'bg-accent/15 border-accent text-accent font-semibold'
      : 'bg-surface-2/70 border-border/70 text-text-muted hover:text-text'
  }`;

const SectionLabel: React.FC<{ children: React.ReactNode; htmlFor?: string }> = ({ children, htmlFor }) => (
  <label htmlFor={htmlFor} className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
    {children}
  </label>
);

/** The creative brief the AI writes the shot list from: platform, length, tone, audience, goal, persona. */
export const BriefPanel: React.FC = () => {
  const { brief, updateBrief, skills, activeSkillId, setActiveSkillId } = useMooStore(
    useShallow((s) => ({
      brief: s.project.brief,
      updateBrief: s.updateBrief,
      skills: s.skills,
      activeSkillId: s.activeSkillId,
      setActiveSkillId: s.setActiveSkillId
    }))
  );

  const platform = getBriefPlatform(brief?.platform);
  const durations = platform?.durations || BRIEF_PLATFORMS[BRIEF_PLATFORMS.length - 1].durations;
  const target = brief?.targetDurationSec;
  const plan = target ? planShots(target) : null;

  return (
    <div className="flex flex-col gap-3 p-2.5 rounded-lg bg-surface-2/40 border border-border/60">
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Platform</SectionLabel>
        <div className="flex flex-wrap gap-1">
          {BRIEF_PLATFORMS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={brief?.platform === p.id}
              onClick={() => updateBrief({ platform: p.id })}
              className={chipClass(brief?.platform === p.id)}
            >
              {p.label}
              {p.aspectRatio && <span className="ml-1 font-mono opacity-60">{p.aspectRatio}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <SectionLabel htmlFor="brief-duration">Durasi target</SectionLabel>
        <div className="flex flex-wrap items-center gap-1">
          {durations.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={target === d}
              onClick={() => updateBrief({ targetDurationSec: d })}
              className={chipClass(target === d)}
            >
              {d < 60 ? `${d} dtk` : `${Math.floor(d / 60)}${d % 60 ? `:${String(d % 60).padStart(2, '0')}` : ''} mnt`}
            </button>
          ))}
          <div className="flex items-center gap-1">
            <CommitNumberInput
              id="brief-duration"
              value={target || 30}
              min={MIN_TARGET_SECONDS}
              max={MAX_TARGET_SECONDS}
              step={5}
              fallbackValue={30}
              onCommit={(v) => updateBrief({ targetDurationSec: Math.round(v) })}
              ariaLabel="Durasi target dalam detik"
              className="w-14 min-h-[32px] px-1.5 rounded-lg bg-surface-2/70 border border-border/70 focus:border-accent text-[11px] font-mono text-text text-center focus:outline-none"
            />
            <span className="text-[11px] text-text-muted">dtk</span>
          </div>
        </div>
        <p className="text-[11px] text-text-faint leading-snug">
          {plan
            ? `Sekitar ${plan.minShots}–${plan.maxShots} shot, ${plan.minShotSec}–${plan.maxShotSec} detik per shot.`
            : 'Kosongkan untuk video pendek 15–45 detik.'}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <SectionLabel>Nada</SectionLabel>
        <div className="flex flex-wrap gap-1">
          {BRIEF_TONES.map((tone) => (
            <button
              key={tone}
              type="button"
              aria-pressed={brief?.tone === tone}
              onClick={() => updateBrief({ tone: brief?.tone === tone ? undefined : tone })}
              className={chipClass(brief?.tone === tone)}
            >
              {tone}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <SectionLabel htmlFor="brief-audience">Untuk siapa</SectionLabel>
        <input
          id="brief-audience"
          type="text"
          value={brief?.audience || ''}
          maxLength={200}
          onChange={(e) => updateBrief({ audience: e.target.value })}
          placeholder="Misal: mahasiswa yang baru belajar investasi"
          className="w-full min-h-[36px] px-2.5 rounded-lg bg-surface-2/70 border border-border/70 focus:border-accent text-[12px] text-text placeholder:text-text-faint focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <SectionLabel htmlFor="brief-goal">Tujuan / ajakan</SectionLabel>
        <input
          id="brief-goal"
          type="text"
          value={brief?.goal || ''}
          maxLength={200}
          onChange={(e) => updateBrief({ goal: e.target.value })}
          placeholder="Misal: ajak penonton follow untuk tips berikutnya"
          className="w-full min-h-[36px] px-2.5 rounded-lg bg-surface-2/70 border border-border/70 focus:border-accent text-[12px] text-text placeholder:text-text-faint focus:outline-none"
        />
      </div>

      {skills.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <SectionLabel htmlFor="brief-persona">Gaya sutradara</SectionLabel>
          <select
            id="brief-persona"
            value={activeSkillId}
            onChange={(e) => setActiveSkillId(e.target.value)}
            className="w-full min-h-[36px] px-2 rounded-lg bg-surface-2/70 border border-border/70 focus:border-accent text-[12px] text-text focus:outline-none"
          >
            {skills.map((s) => (
              <option key={s.id} value={s.id} className="bg-surface-1">
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};
