import React, { useId, useMemo } from 'react';
import { waveformPath } from './shared';

/** Waveform drawn as one SVG path that stretches to its box; the played part is tinted. */
export const WaveformStrip: React.FC<{ peaks: number[] | null; progressPct: number }> = ({ peaks, progressPct }) => {
  const path = useMemo(() => waveformPath(peaks && peaks.length ? peaks : [], 1000, 40), [peaks]);
  const clipId = `moo-wave-${useId().replace(/:/g, '')}`;
  if (!path) {
    return <div className="absolute inset-0 flex items-center px-1"><div className="h-px w-full bg-[#84cc16]/30" /></div>;
  }
  return (
    <svg viewBox="0 0 1000 40" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={progressPct * 10} height="40" />
        </clipPath>
      </defs>
      <path d={path} fill="rgba(132,204,22,0.28)" />
      <path d={path} fill="#84cc16" clipPath={`url(#${clipId})`} />
    </svg>
  );
};
