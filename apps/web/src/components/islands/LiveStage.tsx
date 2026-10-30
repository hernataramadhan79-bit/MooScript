import { useEffect, useMemo, useRef, useState } from 'react';
import { SHOWCASE_PRESETS, getShowcasePreset } from '@mooscript/presets';
import { buildPresetStageDoc } from '../../lib/stageDocBuilder';
import { playhead } from '../../lib/playhead';

interface Props {
  slug: string;
  /** contain keeps the whole frame, cover fills the box and crops. */
  fit?: 'contain' | 'cover';
  /** Transparent scene backgrounds, so footage can sit underneath. */
  clear?: boolean;
  /** Follow the shared playhead; otherwise run an own looping clock. */
  shared?: boolean;
  /** Vertical anchor for cover crops, 0 (top) to 1 (bottom). */
  anchorY?: number;
  title: string;
  className?: string;
}

export default function LiveStage({
  slug,
  fit = 'contain',
  clear = false,
  shared = false,
  anchorY = 0.5,
  title,
  className = ''
}: Props) {
  const preset = useMemo(() => getShowcasePreset(slug) || SHOWCASE_PRESETS[0], [slug]);
  const duration = useMemo(
    () => preset.shots.reduce((sum, s) => sum + s.durationInSeconds, 0) || 3.4,
    [preset]
  );
  // The stage document is built after hydration only: it is ~100 KB and must not be inlined in the static HTML.
  const [srcDoc, setSrcDoc] = useState<string | null>(null);
  useEffect(() => {
    readyRef.current = false;
    setSrcDoc(buildPresetStageDoc(preset, { clearBackgrounds: clear }));
  }, [preset, clear]);

  const boxRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const readyRef = useRef(false);
  const lastSentRef = useRef(-1);
  const ownTimeRef = useRef(0.6);
  const inViewRef = useRef(true);
  const [scale, setScale] = useState(1);

  const send = (t: number) => {
    const local = t % duration;
    if (Math.abs(local - lastSentRef.current) < 0.012) return;
    lastSentRef.current = local;
    iframeRef.current?.contentWindow?.postMessage({ type: 'seek', time: local }, '*');
  };

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      const w = box.clientWidth;
      const h = box.clientHeight;
      if (!w || !h) return;
      const sx = w / preset.width;
      const sy = h / preset.height;
      setScale(fit === 'cover' ? Math.max(sx, sy) : Math.min(sx, sy));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [preset, fit]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => {
      inViewRef.current = entry.isIntersecting;
    });
    io.observe(box);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (shared) {
      return playhead.subscribe((t) => {
        if (readyRef.current && inViewRef.current) send(t);
      });
    }

    if (reduced) {
      ownTimeRef.current = Math.min(1.4, duration * 0.4);
      send(ownTimeRef.current);
      return;
    }

    let raf = 0;
    let last = 0;
    const tick = (ts: number) => {
      if (!last) last = ts;
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      if (readyRef.current && inViewRef.current && !document.hidden) {
        ownTimeRef.current = (ownTimeRef.current + dt) % duration;
        send(ownTimeRef.current);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared, duration]);

  const w = preset.width * scale;
  const h = preset.height * scale;

  return (
    <div
      ref={boxRef}
      className={`${/(^|\s)(absolute|fixed)(\s|$)/.test(className) ? '' : 'relative '}overflow-hidden ${className}`}
      role="img"
      aria-label={title}
    >
      {srcDoc && (
      <iframe
        ref={iframeRef}
        title={title}
        srcDoc={srcDoc}
        sandbox="allow-scripts"
        tabIndex={-1}
        loading="eager"
        onLoad={() => {
          readyRef.current = true;
          lastSentRef.current = -1;
          send(shared ? playhead.time : ownTimeRef.current);
        }}
        style={{
          position: 'absolute',
          left: '50%',
          top: `${anchorY * 100}%`,
          width: preset.width,
          height: preset.height,
          border: 0,
          background: 'transparent',
          colorScheme: 'normal',
          pointerEvents: 'none',
          transformOrigin: '0 0',
          transform: `translate(${-w / 2}px, ${-h * anchorY}px) scale(${scale})`
        }}
      />
      )}
    </div>
  );
}
