import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMooStore } from '../../store/useMooStore';
import { activeBrollAt } from '../../engine/composition/broll';

/**
 * B-roll footage under the stage iframe: the shot under the playhead decides which video plays
 * and from where; the stage clears that shot's background so the footage shows through.
 */
export const BrollPreview: React.FC<{ timeSec: number; isPlaying: boolean }> = ({ timeSec, isPlaying }) => {
  const scenes = useMooStore((s) => s.project.scenes);
  const assets = useMooStore((s) => s.assets);
  const videoRef = useRef<HTMLVideoElement>(null);
  const active = activeBrollAt(scenes, timeSec);
  const blob = active ? assets.find((a) => a.id === active.broll.assetId)?.blob : undefined;
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  const target = active?.videoTime ?? 0;
  const key = useMemo(() => (active ? `${active.sceneId}:${active.broll.assetId}` : ''), [active]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !url || !active) return;
    const dur = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : null;
    const want = dur ? target % dur : target;
    if (isPlaying) {
      // Small drift is left alone so playback stays smooth; a jump (seek, new shot) resyncs.
      if (Math.abs(v.currentTime - want) > 0.25) v.currentTime = want;
      if (v.paused) v.play().catch(() => {});
    } else {
      if (!v.paused) v.pause();
      if (Math.abs(v.currentTime - want) > 0.03) v.currentTime = want;
    }
  }, [target, isPlaying, url, active, key]);

  if (!active || !url) return null;
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      <video
        key={key}
        ref={videoRef}
        src={url}
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: active.broll.fit === 'contain' ? 'contain' : 'cover' }}
      />
      {active.broll.dim > 0 && <div className="absolute inset-0 bg-black" style={{ opacity: active.broll.dim }} />}
    </div>
  );
};
