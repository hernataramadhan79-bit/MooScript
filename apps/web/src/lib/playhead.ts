/**
 * One shared playhead for every live stage on a page. The hero rail owns it,
 * each stage maps the shared time onto its own duration (t % duration), so one
 * scrub moves a 9:16, a 16:9 and a cropped slot at the same moment.
 */
type Listener = (t: number, playing: boolean) => void;

const START = 2.2;

let time = START;
let playing = true;
let visible = true;
let raf = 0;
let last = 0;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((fn) => fn(time, playing));
}

function loop(ts: number) {
  if (!last) last = ts;
  const dt = Math.min(0.05, (ts - last) / 1000);
  last = ts;
  if (playing && visible && !document.hidden) {
    time += dt;
    if (time > 600) time = START;
    emit();
  }
  raf = requestAnimationFrame(loop);
}

function ensureLoop() {
  if (!raf && typeof window !== 'undefined') {
    last = 0;
    raf = requestAnimationFrame(loop);
  }
}

export const playhead = {
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    ensureLoop();
    fn(time, playing);
    return () => {
      listeners.delete(fn);
      if (listeners.size === 0 && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
  },
  get time() {
    return time;
  },
  get playing() {
    return playing;
  },
  seek(t: number) {
    time = Math.max(0, t);
    emit();
  },
  setPlaying(next: boolean) {
    playing = next;
    emit();
  },
  setVisible(next: boolean) {
    visible = next;
  }
};
