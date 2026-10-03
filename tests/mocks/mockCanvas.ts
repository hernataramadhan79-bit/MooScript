export interface MockCanvasCall {
  method: string;
  args: any[];
}

// Shared singleton gradient stub — same reference every call, so toEqual passes
const GRADIENT_STUB = { addColorStop: (_stop: number, _color: string): void => {} };

export function createMockCanvas(initialWidth = 1080, initialHeight = 1920) {
  const calls: MockCanvasCall[] = [];

  // Internal state backing the tracked properties
  const _state: Record<string, any> = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    globalAlpha: 1.0,
    shadowColor: 'transparent',
    shadowBlur: 0,
    lineJoin: 'miter'
  };

  // Normalize a style value: non-primitive (gradient/pattern) → stable sentinel
  const normalizeStyle = (v: any): any => (typeof v !== 'string' && typeof v !== 'number' ? '[gradient]' : v);

  // Methods defined before ctx so they can be referenced in the Proxy getter
  const methods: Record<string, any> = {
    canvas: null as any,

    save: () => calls.push({ method: 'save', args: [] }),
    restore: () => calls.push({ method: 'restore', args: [] }),
    translate: (x: number, y: number) =>
      calls.push({ method: 'translate', args: [Math.round(x * 100) / 100, Math.round(y * 100) / 100] }),
    scale: (x: number, y: number) =>
      calls.push({ method: 'scale', args: [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000] }),
    rotate: (angle: number) => calls.push({ method: 'rotate', args: [angle] }),

    fillRect: (x: number, y: number, w: number, h: number) => calls.push({ method: 'fillRect', args: [x, y, w, h] }),
    strokeRect: (x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'strokeRect', args: [x, y, w, h] }),
    clearRect: (x: number, y: number, w: number, h: number) => calls.push({ method: 'clearRect', args: [x, y, w, h] }),

    beginPath: () => calls.push({ method: 'beginPath', args: [] }),
    closePath: () => calls.push({ method: 'closePath', args: [] }),
    moveTo: (x: number, y: number) => calls.push({ method: 'moveTo', args: [x, y] }),
    lineTo: (x: number, y: number) => calls.push({ method: 'lineTo', args: [x, y] }),
    arc: (x: number, y: number, r: number, s: number, e: number) =>
      calls.push({ method: 'arc', args: [x, y, r, s, e] }),
    roundRect: (x: number, y: number, w: number, h: number, r: number) =>
      calls.push({ method: 'roundRect', args: [x, y, w, h, r] }),
    rect: (x: number, y: number, w: number, h: number) => calls.push({ method: 'rect', args: [x, y, w, h] }),
    fill: () => calls.push({ method: 'fill', args: [] }),
    stroke: () => calls.push({ method: 'stroke', args: [] }),

    fillText: (text: string, x: number, y: number) =>
      calls.push({ method: 'fillText', args: [text, Math.round(x * 10) / 10, Math.round(y * 10) / 10] }),
    strokeText: (text: string, x: number, y: number) =>
      calls.push({ method: 'strokeText', args: [text, Math.round(x * 10) / 10, Math.round(y * 10) / 10] }),
    measureText: (text: string) => {
      // Deterministic font metric mock: width proportional to character count
      const fontStr: string = _state['font'] || '20px sans-serif';
      const parsedSize = parseInt(fontStr.match(/\d+px/)?.[0] || '20', 10);
      const charWidth = parsedSize * 0.55;
      return { width: text.length * charWidth };
    },

    createLinearGradient: () => GRADIENT_STUB,
    createRadialGradient: () => GRADIENT_STUB,
    drawImage: () => calls.push({ method: 'drawImage', args: [] })
  };

  // Proxy wraps _state so property assignments (ctx.fillStyle = …) are tracked as calls
  const ctx: any = new Proxy(_state, {
    set(target, prop, value) {
      // Normalize gradient/pattern objects to a stable sentinel for style properties
      const normalized =
        (prop === 'fillStyle' || prop === 'strokeStyle') ? normalizeStyle(value) : value;
      target[prop as string] = normalized;
      // Record property-assignment as a named call entry
      if (typeof prop === 'string' && prop in target) {
        calls.push({ method: prop, args: [normalized] });
      }
      return true;
    },
    get(target, prop) {
      if (typeof prop === 'string' && prop in target) {
        return target[prop];
      }
      return methods[prop as string];
    }
  });

  const canvas: any = {
    width: initialWidth,
    height: initialHeight,
    getContext: (type: string) => (type === '2d' ? ctx : null)
  };

  methods.canvas = canvas;

  return {
    canvas,
    ctx,
    calls,
    clearCalls: () => {
      calls.length = 0;
    }
  };
}
