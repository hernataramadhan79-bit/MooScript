import type {
  MooProject,
  Scene,
  SceneTransition,
  CaptionStyle,
  CaptionPosition,
  CameraMovement,
  MotionNode,
  NodeAnimation,
  BackgroundConfig,
  ThemeTokens
} from '../../types';
import { resolveTheme } from '../../types';
import { spring, easeOutExpo, easeInOutQuad, clamp, lerp } from '../physics/spring';
import { drawIcon } from '../assets/icons';
import { cleanWord } from '../../utils/textUtils';

class SimpleDOMRect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
  constructor(x = 0, y = 0, width = 0, height = 0) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.left = x;
    this.top = y;
    this.right = x + width;
    this.bottom = y + height;
  }
}
const RectClass = typeof DOMRect !== 'undefined' ? DOMRect : (SimpleDOMRect as unknown as typeof DOMRect);

export interface RenderOptions {
  hud?: boolean;
  watermark?: boolean;
}

export interface MemoizedWord {
  readonly word: string;
  readonly cleanWord: string;
  readonly isFocus: boolean;
  readonly wordIndex: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
  readonly lineIndex: number;
}

export interface MemoizedSceneLayout {
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly words: readonly MemoizedWord[];
  readonly totalLines: number;
}

/**
 * Deterministic helper to count up or format animated metric string
 */
export function interpolateMetricValue(target: string, progress: number): string {
  if (progress >= 1) return target;
  const match = target.match(/^([^\d]*)(\d+(?:\.\d+)?)(.*)$/);
  if (!match) return target;
  const prefix = match[1];
  const numStr = match[2];
  const suffix = match[3];
  const isDecimal = numStr.includes('.');
  const decimals = isDecimal ? numStr.split('.')[1].length : 0;
  const targetNum = parseFloat(numStr);
  const currentNum = targetNum * progress;
  return `${prefix}${currentNum.toFixed(decimals)}${suffix}`;
}

/**
 * Safely applies an alpha channel to any CSS color string.
 * Plain `${color}${alphaHex}` concatenation crashes `addColorStop` / canvas
 * fills when the color is not a 6-digit hex (e.g. `#fff`, `rgb(...)`,
 * named colors), so normalize every form instead.
 */
export function withAlpha(color: string, alphaHex: string): string {
  if (typeof color !== 'string') return color;
  const a = alphaHex.replace(/^#/, '').slice(0, 2).padEnd(2, '0');
  const c = color.trim();

  let m = c.match(/^#([0-9a-fA-F]{6})$/);
  if (m) return `#${m[1]}${a}`;

  m = c.match(/^#([0-9a-fA-F]{3})$/);
  if (m) {
    const [r, g, b] = m[1].split('');
    return `#${r}${r}${g}${g}${b}${b}${a}`;
  }

  m = c.match(/^#([0-9a-fA-F]{8})$/);
  if (m) return `#${m[1].slice(0, 6)}${a}`;

  m = c.match(/^rgba?\(\s*([^)]+)\)$/i);
  if (m) {
    const parts = m[1].split(',').map((s) => s.trim());
    if (parts.length >= 3) {
      const alphaDec = (parseInt(a, 16) / 255).toFixed(3);
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alphaDec})`;
    }
    return c;
  }

  // Named colors / CSS vars / unparseable tokens: return untouched rather
  // than producing an invalid color string that would throw on assignment.
  return c;
}

/**
 * Deterministic syntax tokenizer for code mockup cards
 */
export function tokenizeCodeLine(line: string): Array<{ text: string; color: string }> {
  if (line.trim().startsWith('//') || line.trim().startsWith('#')) {
    return [{ text: line, color: '#71717a' }];
  }
  const tokens: Array<{ text: string; color: string }> = [];
  let remaining = line;
  if (remaining.startsWith('$ ') || remaining.startsWith('> ')) {
    tokens.push({ text: remaining.slice(0, 2), color: '#84cc16' });
    remaining = remaining.slice(2);
  }
  const parts = remaining.split(/(\s+|[(),.;={}[\]]|"[^"]*"|'[^']*')/);
  const keywords = new Set([
    'const', 'let', 'var', 'import', 'from', 'export', 'default',
    'function', 'return', 'async', 'await', 'npm', 'npx', 'run',
    'git', 'install', 'add', 'true', 'false', 'if', 'else', 'class'
  ]);
  for (const part of parts) {
    if (!part) continue;
    if (keywords.has(part)) {
      tokens.push({ text: part, color: '#38bdf8' });
    } else if (part.startsWith('"') || part.startsWith("'")) {
      tokens.push({ text: part, color: '#a3e635' });
    } else if (/^\d+$/.test(part)) {
      tokens.push({ text: part, color: '#fb923c' });
    } else {
      tokens.push({ text: part, color: '#f4f4f5' });
    }
  }
  return tokens;
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement | OffscreenCanvas;
  private ctx: CanvasRenderingContext2D;
  public width: number;
  public height: number;

  private bgCache = new Map<string, HTMLCanvasElement | OffscreenCanvas>();
  private layoutCache = new Map<string, MemoizedSceneLayout>();

  constructor(existingCanvas?: HTMLCanvasElement | OffscreenCanvas, width = 1080, height = 1920) {
    this.width = width;
    this.height = height;

    if (existingCanvas) {
      this.canvas = existingCanvas;
      this.width = existingCanvas.width || width;
      this.height = existingCanvas.height || height;
    } else if (typeof OffscreenCanvas !== 'undefined') {
      this.canvas = new OffscreenCanvas(this.width, this.height);
    } else if (typeof document !== 'undefined') {
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.width;
      this.canvas.height = this.height;
    } else {
      this.canvas = { width: this.width, height: this.height } as any;
    }

    const context = (this.canvas as any).getContext?.('2d', { alpha: false, desynchronized: true });
    if (!context && typeof (this.canvas as any).getContext === 'function') {
      throw new Error('Failed to acquire 2D Canvas Context');
    }
    this.ctx = (context || {}) as CanvasRenderingContext2D;
  }

  public getCanvas(): HTMLCanvasElement | OffscreenCanvas {
    return this.canvas;
  }

  public getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  public clearCaches(): void {
    this.bgCache.clear();
    this.layoutCache.clear();
    this.nodeBoundsMap.clear();
  }

  private nodeBoundsMap = new Map<string, DOMRect>();

  public getNodeBoundsMap(): Map<string, DOMRect> {
    return this.nodeBoundsMap;
  }

  public hitTestNode(canvasX: number, canvasY: number): string | null {
    const entries = Array.from(this.nodeBoundsMap.entries()).reverse();
    for (const [id, rect] of entries) {
      if (
        canvasX >= rect.left &&
        canvasX <= rect.right &&
        canvasY >= rect.top &&
        canvasY <= rect.bottom
      ) {
        return id;
      }
    }
    return null;
  }

  /**
   * Deterministic Frame Evaluation:
   * RenderState = f(currentFrame, fps, project)
   */
  public draw(currentFrame: number, totalFrames: number, project: MooProject, opts?: RenderOptions): void {
    const targetWidth = project.width || 1080;
    const targetHeight = project.height || 1920;

    // Dynamically synchronize canvas size with project dimensions
    if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
      this.canvas.width = targetWidth;
      this.canvas.height = targetHeight;
      this.width = targetWidth;
      this.height = targetHeight;
    }

    const { ctx, width, height } = this;
    const fps = project.fps || 30;
    const t = currentFrame / fps;
    const showHud = opts?.hud ?? false;
    const showWatermark = opts?.watermark ?? false;

    // 1. Locate Active Scene and Timing
    let accumulatedTime = 0;
    let activeScene: Scene | null = null;
    let sceneIndex = 0;
    let sceneStartTime = 0;

    for (let i = 0; i < project.scenes.length; i++) {
      const s = project.scenes[i];
      const dur = s.durationInSeconds > 0 ? s.durationInSeconds : 3;
      if (t >= accumulatedTime && t < accumulatedTime + dur) {
        activeScene = s;
        sceneIndex = i;
        sceneStartTime = accumulatedTime;
        break;
      }
      accumulatedTime += dur;
    }

    // Default to last scene if playback extends slightly beyond
    if (!activeScene && project.scenes.length > 0) {
      activeScene = project.scenes[project.scenes.length - 1];
      sceneIndex = project.scenes.length - 1;
      sceneStartTime = accumulatedTime - (activeScene.durationInSeconds > 0 ? activeScene.durationInSeconds : 3);
    }

    const sceneDuration = activeScene ? (activeScene.durationInSeconds > 0 ? activeScene.durationInSeconds : 3) : 3;
    const sceneElapsed = Math.max(0, t - sceneStartTime);
    const sceneProgress = clamp(sceneElapsed / sceneDuration, 0, 1);
    const sceneTotalFrames = Math.max(1, Math.round(sceneDuration * fps));
    const frameInScene = Math.max(0, Math.round(sceneElapsed * fps));

    // 2. Clear & Render Background
    const themeTokens = resolveTheme(project, activeScene);
    this.nodeBoundsMap.clear();

    const hasAtomicNodes = Boolean(activeScene && activeScene.nodes && activeScene.nodes.length > 0);

    if (hasAtomicNodes) {
      this.drawProceduralBackground(ctx, activeScene?.background, t, themeTokens);
    } else {
      this.drawKineticBackground(ctx, width, height, t, project, sceneProgress);
    }

    if (!activeScene) {
      this.renderEmptyState(ctx, width, height);
      return;
    }

    // 3. Camera Movement, Motion Preset, and Scene Transitions
    ctx.save();
    ctx.translate(width / 2, height / 2);

    if (!hasAtomicNodes) {
      // Apply Camera Transform
      this.applyCameraMovement(ctx, activeScene.camera, sceneElapsed, sceneDuration, width, height);

      // Subtle scale drift ONLY when no explicit camera move owns the transform.
      // push_in / pull_out / snap_zoom already scale inside applyCameraMovement,
      // so an unconditional extra scale would neutralize pull_out and over-zoom push_in.
      const camMode = activeScene.camera;
      if (!camMode || camMode === 'steady_drift') {
        const cameraScale = 1.0 + (frameInScene / sceneTotalFrames) * 0.05;
        ctx.scale(cameraScale, cameraScale);
      }

      // Preset-specific motion transform with guaranteed non-zero scale floor
      const preset = activeScene.motionPreset || 'punch_zoom';
      this.applyMotionPresetTransform(ctx, preset, sceneElapsed, frameInScene, sceneTotalFrames);
    }

    // Dynamic scene transitions: cut, fade, slide
    const transition: SceneTransition = activeScene.transition ?? 'fade';
    const transDuration = 0.25;
    const remaining = sceneDuration - sceneElapsed;

    if (transition === 'fade') {
      let alpha = 1.0;
      if (sceneIndex > 0 && sceneElapsed < transDuration) {
        alpha = Math.min(alpha, easeInOutQuad(clamp(sceneElapsed / transDuration, 0, 1)));
      }
      if (sceneIndex < project.scenes.length - 1 && remaining < transDuration) {
        alpha = Math.min(alpha, easeInOutQuad(clamp(remaining / transDuration, 0, 1)));
      }
      ctx.globalAlpha = clamp(ctx.globalAlpha * alpha, 0, 1);
    } else if (transition === 'slide') {
      let slideX = 0;
      if (sceneIndex > 0 && sceneElapsed < transDuration) {
        const enterFactor = easeOutExpo(clamp(sceneElapsed / transDuration, 0, 1));
        slideX += (1 - enterFactor) * 160;
      }
      if (sceneIndex < project.scenes.length - 1 && remaining < transDuration) {
        const exitFactor = easeInOutQuad(clamp(1 - remaining / transDuration, 0, 1));
        slideX -= exitFactor * 160;
        ctx.globalAlpha = clamp(ctx.globalAlpha * (1 - exitFactor * 0.4), 0, 1);
      }
      if (slideX !== 0) {
        ctx.translate(slideX, 0);
      }
    }

    ctx.translate(-width / 2, -height / 2);

    // 4. Render Scene Visuals
    if (showHud) {
      this.renderHeader(ctx, width, sceneIndex + 1, project.scenes.length, project);
    }

    const layout = activeScene.layout || 'KINETIC_QUOTE';

    if (hasAtomicNodes && activeScene.nodes) {
      for (const node of activeScene.nodes) {
        this.renderNode(ctx, node, t, sceneElapsed, themeTokens);
      }
    } else {
      // Scene Center Icon (rendered if layout is KINETIC_QUOTE)
      if (activeScene.icon && layout === 'KINETIC_QUOTE') {
        this.renderSceneIcon(ctx, width, activeScene.icon, project.theme.textHighlight, sceneElapsed);
      }

      // Dispatch rendering based on LayoutType
      const springProgress = clamp(spring(sceneElapsed, { stiffness: 200, damping: 16 }), 0, 1);

      switch (layout) {
        case 'METRIC_COUNTER': {
          const val = activeScene.visualData?.metricValue || '100%';
          const lbl = activeScene.visualData?.metricLabel || activeScene.narrationText || activeScene.text || 'Performance';
          const title = activeScene.visualData?.title;
          this.drawMetricCounter(ctx, 80, 420, width - 160, height * 0.46, val, lbl, springProgress, project.theme, title);
          break;
        }
        case 'TERMINAL_MOCKUP': {
          const code = activeScene.visualData?.codeSnippet || activeScene.narrationText || activeScene.text || 'npm install mooscript';
          const lang = activeScene.visualData?.codeLanguage || 'terminal';
          this.drawTerminalMockup(ctx, 70, 380, width - 140, height * 0.46, code, lang, springProgress, project.theme, sceneElapsed);
          break;
        }
        case 'VS_COMPARISON': {
          const lTitle = activeScene.visualData?.leftTitle || 'BEFORE';
          const lDesc = activeScene.visualData?.leftDesc || 'Slow, manual editing';
          const rTitle = activeScene.visualData?.rightTitle || 'AFTER';
          const rDesc = activeScene.visualData?.rightDesc || activeScene.narrationText || activeScene.text || 'Fast automated rendering';
          this.drawVsComparison(ctx, 80, 360, width - 160, height * 0.50, lTitle, lDesc, rTitle, rDesc, springProgress, project.theme);
          break;
        }
        case 'LIST_STAGGER': {
          let items = activeScene.visualData?.bulletItems;
          if (!items || items.length === 0) {
            const text = (activeScene.narrationText || activeScene.text || '').trim();
            items = text.split(/[.,;]\s+/).filter((s) => s.length > 0);
            if (items.length === 0 && text) items = [text];
          }
          const title = activeScene.visualData?.title;
          this.drawStaggeredList(ctx, 80, 360, width - 160, height * 0.50, items || [], sceneElapsed, project.theme, title);
          break;
        }
        case 'KINETIC_QUOTE':
        default:
          this.renderKineticTypography(ctx, width, height, activeScene, sceneElapsed, project);
          break;
      }
    }

    // Optional Bottom Subtitles Layer
    const shouldShowSubtitles = activeScene.showSubtitles ?? project.theme.showSubtitles ?? false;
    if (shouldShowSubtitles && (hasAtomicNodes || layout !== 'KINETIC_QUOTE')) {
      this.renderBottomSubtitleOverlay(ctx, width, height, activeScene, sceneElapsed, project);
    }

    ctx.restore();

    // 5. Foreground Overlays (only rendered when HUD is active)
    if (showHud) {
      this.renderOverlays(ctx, width, height, currentFrame, totalFrames, fps, project);
    }

    // 6. Watermark (if enabled)
    if (showWatermark) {
      this.renderWatermark(ctx, width, height);
    }
  }

  /**
   * Deterministic Camera Transform (Push In, Pull Out, Pan Left/Right, Drift)
   */
  public applyCameraMovement(
    ctx: CanvasRenderingContext2D,
    camera: CameraMovement | undefined,
    sceneElapsed: number,
    sceneDuration: number,
    _width: number,
    _height: number
  ): void {
    const cam: CameraMovement = camera || 'steady_drift';
    const normTime = clamp(sceneDuration > 0 ? sceneElapsed / sceneDuration : 0, 0, 1);

    switch (cam) {
      case 'push_in': {
        const s = lerp(1.0, 1.08, normTime);
        ctx.scale(s, s);
        break;
      }
      case 'pull_out': {
        const s = lerp(1.08, 1.0, normTime);
        ctx.scale(s, s);
        break;
      }
      case 'snap_zoom': {
        const snap = spring(sceneElapsed, { stiffness: 320, damping: 14 });
        const s = lerp(0.88, 1.0, clamp(snap, 0, 1.15));
        ctx.scale(s, s);
        break;
      }
      case 'whip_pan': {
        const whip = spring(sceneElapsed, { stiffness: 280, damping: 16 });
        const tx = lerp(120, 0, clamp(whip, 0, 1.1));
        ctx.translate(tx, 0);
        break;
      }
      case 'steady_drift':
      default: {
        const tx = Math.sin(sceneElapsed * 1.4) * 8;
        const ty = Math.cos(sceneElapsed * 1.1) * 6;
        ctx.translate(tx, ty);
        break;
      }
    }
  }

  /**
   * Living Kinetic Background with deterministic moving grid & subtle vignette
   */
  public drawKineticBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    t: number,
    project: MooProject,
    progress: number
  ): void {
    const bg = project.theme.bg || '#131315';
    const highlight = project.theme.textHighlight || '#84cc16';
    const cachedBg = this.getOrCreateBgCanvas(width, height, bg, highlight);

    if ((cachedBg as any).getContext) {
      ctx.drawImage(cachedBg as any, 0, 0);
    } else {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);
    }

    // Dynamic subtle pulse based on sceneProgress
    if (progress > 0) {
      const pulse = Math.sin(progress * Math.PI); // 0 -> 1 -> 0
      if (pulse > 0.05) {
        ctx.save();
        const glowX = width / 2;
        const glowY = height * 0.45;
        const pulseRadius = width * (0.6 + 0.25 * pulse);
        const pulseGrad = ctx.createRadialGradient(glowX, glowY, 20, glowX, glowY, pulseRadius);
        const alphaHex = Math.round(pulse * 26)
          .toString(16)
          .padStart(2, '0');
        pulseGrad.addColorStop(0, withAlpha(highlight, alphaHex));
        pulseGrad.addColorStop(0.7, 'transparent');
        ctx.fillStyle = pulseGrad;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
    }
  }

  public drawSolid(ctx: CanvasRenderingContext2D, theme: ThemeTokens, fill?: string): void {
    ctx.fillStyle = fill || theme.bg;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  public drawDotGrid(ctx: CanvasRenderingContext2D, t: number, theme: ThemeTokens): void {
    const { width, height } = this;
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, width, height);

    const spacing = 48;
    const radius = 2.2;
    const cols = Math.ceil(width / spacing) + 1;
    const rows = Math.ceil(height / spacing) + 1;

    for (let r = 0; r < rows; r++) {
      const y = r * spacing;
      for (let c = 0; c < cols; c++) {
        const x = c * spacing;
        const wave = Math.sin((x / width) * 4.5 + t * 2.2) * Math.cos((y / height) * 4.5 + t * 1.8);
        const alpha = clamp(0.12 + 0.32 * ((wave + 1) / 2), 0.04, 0.55);

        ctx.fillStyle = theme.text;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1.0;
  }

  public drawMeshBlobs(ctx: CanvasRenderingContext2D, t: number, theme: ThemeTokens): void {
    const { width, height } = this;
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, width, height);

    const p1x = width * (0.35 + 0.18 * Math.sin(t * 1.1));
    const p1y = height * (0.30 + 0.16 * Math.cos(t * 0.9));
    const r1 = width * 0.55;

    const g1 = ctx.createRadialGradient(p1x, p1y, 0, p1x, p1y, r1);
    g1.addColorStop(0, withAlpha(theme.primary, '55'));
    g1.addColorStop(1, 'transparent');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, width, height);

    const p2x = width * (0.65 + 0.16 * Math.cos(t * 1.3));
    const p2y = height * (0.70 + 0.18 * Math.sin(t * 1.0));
    const r2 = width * 0.60;

    const g2 = ctx.createRadialGradient(p2x, p2y, 0, p2x, p2y, r2);
    g2.addColorStop(0, withAlpha(theme.accent, '44'));
    g2.addColorStop(1, 'transparent');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, width, height);

    const p3x = width * (0.50 + 0.20 * Math.sin(t * 0.8 + 1));
    const p3y = height * (0.50 + 0.15 * Math.cos(t * 1.2 + 2));
    const r3 = width * 0.45;

    const g3 = ctx.createRadialGradient(p3x, p3y, 0, p3x, p3y, r3);
    g3.addColorStop(0, withAlpha(theme.surface, '66'));
    g3.addColorStop(1, 'transparent');
    ctx.fillStyle = g3;
    ctx.fillRect(0, 0, width, height);
  }

  public drawBentoBase(ctx: CanvasRenderingContext2D, t: number, theme: ThemeTokens): void {
    const { width, height } = this;
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, width, height);

    this.drawMeshBlobs(ctx, t * 0.5, theme);

    const padX = width * 0.08;
    const cardW = width - padX * 2;
    const cardH = height * 0.62;
    const cardY = height * 0.22;

    ctx.save();
    ctx.fillStyle = withAlpha(theme.surface, '99');
    ctx.strokeStyle = withAlpha(theme.muted, '40');
    ctx.lineWidth = 1.5;

    if (typeof (ctx as any).roundRect === 'function') {
      ctx.beginPath();
      (ctx as any).roundRect(padX, cardY, cardW, cardH, 28);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(padX, cardY, cardW, cardH);
      ctx.strokeRect(padX, cardY, cardW, cardH);
    }
    ctx.restore();
  }

  public drawProceduralBackground(
    ctx: CanvasRenderingContext2D,
    config: BackgroundConfig | undefined,
    t: number,
    theme: ThemeTokens
  ): void {
    const type = config?.type || 'dot_grid';
    switch (type) {
      case 'solid':
        this.drawSolid(ctx, theme, config?.customFill);
        break;
      case 'mesh_gradient':
        this.drawMeshBlobs(ctx, t, theme);
        break;
      case 'bento_card':
        this.drawBentoBase(ctx, t, theme);
        break;
      case 'dot_grid':
      default:
        this.drawDotGrid(ctx, t, theme);
        break;
    }
  }

  public renderNode(
    ctx: CanvasRenderingContext2D,
    node: MotionNode,
    frameTime: number,
    sceneTime: number,
    theme: ThemeTokens,
    parentCoord?: { x: number; y: number; width: number; height: number },
    parentAbsPos?: { x: number; y: number },
    parentCompoundScale = 1.0,
    parentCompoundRotation = 0
  ): void {
    const { width: canvasWidth, height: canvasHeight } = this;

    const baseW = parentCoord ? parentCoord.width : canvasWidth;
    const baseH = parentCoord ? parentCoord.height : canvasHeight;

    const transform = node.transform || { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 };
    const style = node.style || { fillToken: 'text', fontSize: 32 };

    const nodeW = transform.width !== undefined
      ? (transform.width / 100) * baseW
      : (parentCoord ? baseW * 0.8 : canvasWidth * 0.85);
    const nodeH = transform.height !== undefined
      ? (transform.height / 100) * baseH
      : (parentCoord ? baseH * 0.35 : 120);

    let localX = (transform.x / 100) * canvasWidth;
    let localY = (transform.y / 100) * canvasHeight;
    let absPx = localX;
    let absPy = localY;

    if (parentCoord && parentAbsPos) {
      localX = -parentCoord.width / 2 + (transform.x / 100) * parentCoord.width;
      localY = -parentCoord.height / 2 + (transform.y / 100) * parentCoord.height;
      const pRad = (parentCompoundRotation * Math.PI) / 180;
      const cosP = Math.cos(pRad);
      const sinP = Math.sin(pRad);
      const rotX = (localX * cosP - localY * sinP) * parentCompoundScale;
      const rotY = (localX * sinP + localY * cosP) * parentCompoundScale;
      absPx = parentAbsPos.x + rotX;
      absPy = parentAbsPos.y + rotY;
    }

    let scale = transform.scale ?? 1.0;
    let opacity = transform.opacity ?? 1.0;
    const rotation = transform.rotation ?? 0;
    let yOffset = 0;
    let textSliceProgress = 1.0;

    const enterAnim: NodeAnimation['enter'] = node.animation?.enter || (
      (node.animation as any)?.enterType && (node.animation as any)?.enterType !== 'none'
        ? { type: (node.animation as any).enterType, startAtSecond: 0, duration: 0.6 }
        : undefined
    );

    if (enterAnim) {
      const { type, startAtSecond = 0, duration = 0.6, springConfig } = enterAnim;
      const elapsed = sceneTime - startAtSecond;

      if (elapsed < 0) {
        opacity = 0;
        scale = 0;
      } else {
        if (type === 'spring_pop') {
          const sp = spring(elapsed, springConfig || { stiffness: 220, damping: 14 });
          scale *= clamp(sp, 0, 1.3);
          opacity *= clamp(sp * 2, 0, 1);
        } else if (type === 'wipe_up') {
          const progress = clamp(duration > 0 ? elapsed / duration : 1, 0, 1);
          const eased = easeOutExpo(progress);
          yOffset += (1 - eased) * 50;
          opacity *= eased;
        } else if (type === 'blur_in') {
          const progress = clamp(duration > 0 ? elapsed / duration : 1, 0, 1);
          const eased = easeInOutQuad(progress);
          opacity *= eased;
        } else if (type === 'typewriter') {
          const progress = clamp(duration > 0 ? elapsed / duration : 1, 0, 1);
          textSliceProgress = progress;
        }
      }
    }

    if (node.animation?.active) {
      const { type, intensity = 1 } = node.animation.active;
      if (type === 'subtle_float') {
        yOffset += Math.sin(sceneTime * 2.5) * (6 * intensity);
      } else if (type === 'karaoke_glow') {
        const pulse = Math.sin(sceneTime * 4) * 0.5 + 0.5;
        scale *= 1 + 0.02 * pulse * intensity;
      }
    }

    if (node.animation?.exit) {
      const { type, startAtSecond = 3, duration = 0.5 } = node.animation.exit;
      if (sceneTime >= startAtSecond) {
        const exitElapsed = sceneTime - startAtSecond;
        const progress = clamp(duration > 0 ? exitElapsed / duration : 1, 0, 1);
        opacity *= clamp(1 - progress, 0, 1);
        if (type === 'slide_down') {
          yOffset += easeInOutQuad(progress) * 80;
        }
      }
    }

    if (opacity <= 0.001) {
      return;
    }

    const resolveToken = (token?: string, fallback = '#ffffff') => {
      if (!token) return fallback;
      if (token in theme) return (theme as any)[token];
      return token;
    };

    const fillColor = style.customFill || resolveToken(style.fillToken, theme.text);
    const strokeColor = resolveToken(style.strokeToken, theme.muted);
    const strokeWidth = style.strokeWidth || 0;
    const borderRadius = style.borderRadius || 16;
    const fontFamily = style.fontFamily === 'Mono'
      ? "'JetBrains Mono', monospace"
      : "'Plus Jakarta Sans', sans-serif";
    const fontSize = style.fontSize || 32;
    const fontWeight = style.fontWeight || 600;

    ctx.save();
    ctx.translate(localX, localY + yOffset);
    if (rotation !== 0) {
      ctx.rotate((rotation * Math.PI) / 180);
    }
    if (scale !== 1.0) {
      ctx.scale(scale, scale);
    }
    ctx.globalAlpha = clamp(ctx.globalAlpha * opacity, 0, 1);

    if (style.shadow) {
      ctx.shadowColor = style.shadow.color;
      ctx.shadowBlur = style.shadow.blur;
      ctx.shadowOffsetY = style.shadow.offsetY;
    }

    let finalBoxWidth = nodeW;
    let finalBoxHeight = nodeH;

    switch (node.type) {
      case 'container': {
        const x0 = -nodeW / 2;
        const y0 = -nodeH / 2;
        ctx.fillStyle = fillColor;
        if (strokeWidth > 0) {
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = strokeWidth;
        }

        if (typeof (ctx as any).roundRect === 'function') {
          ctx.beginPath();
          (ctx as any).roundRect(x0, y0, nodeW, nodeH, borderRadius);
          ctx.fill();
          if (strokeWidth > 0) ctx.stroke();
        } else {
          ctx.fillRect(x0, y0, nodeW, nodeH);
          if (strokeWidth > 0) ctx.strokeRect(x0, y0, nodeW, nodeH);
        }
        break;
      }
      case 'text': {
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        ctx.textBaseline = 'middle';

        let textToDraw = node.content || '';
        if (textSliceProgress < 1.0) {
          const chars = Math.max(1, Math.floor(textToDraw.length * textSliceProgress));
          textToDraw = textToDraw.slice(0, chars);
        }

        const maxW = nodeW > 0 ? nodeW : canvasWidth * 0.85;
        const words = textToDraw.split(/\s+/).filter(Boolean);
        const focusWords = new Set(
          ((node.extraProps?.focusWords as string[]) || []).map((w: string) => cleanWord(w))
        );

        if (words.length <= 1 || ctx.measureText(textToDraw).width <= maxW) {
          ctx.textAlign = 'center';
          ctx.fillStyle = fillColor;
          ctx.fillText(textToDraw, 0, 0);
          const metrics = ctx.measureText(textToDraw);
          finalBoxWidth = metrics.width + 24;
          finalBoxHeight = fontSize * 1.4;
        } else {
          const lines: string[][] = [[]];
          let curLineWidth = 0;
          const spaceW = ctx.measureText(' ').width;

          for (const w of words) {
            const wWidth = ctx.measureText(w).width;
            if (curLineWidth + wWidth > maxW && lines[lines.length - 1].length > 0) {
              lines.push([w]);
              curLineWidth = wWidth + spaceW;
            } else {
              lines[lines.length - 1].push(w);
              curLineWidth += wWidth + spaceW;
            }
          }

          const lineHeight = fontSize * 1.35;
          const totalTextHeight = lines.length * lineHeight;
          const startY = -(totalTextHeight / 2) + lineHeight / 2;
          let maxMeasuredLineWidth = 0;

          for (let lIdx = 0; lIdx < lines.length; lIdx++) {
            const lineWords = lines[lIdx];
            let lineWidth = 0;
            for (let wi = 0; wi < lineWords.length; wi++) {
              lineWidth += ctx.measureText(lineWords[wi]).width;
              if (wi < lineWords.length - 1) lineWidth += spaceW;
            }
            maxMeasuredLineWidth = Math.max(maxMeasuredLineWidth, lineWidth);

            let curX = -lineWidth / 2;
            const lineY = startY + lIdx * lineHeight;

            const hasFocusOnLine = lineWords.some((w) => focusWords.has(cleanWord(w)));
            if (!hasFocusOnLine) {
              ctx.fillStyle = fillColor;
              ctx.textAlign = 'left';
              ctx.fillText(lineWords.join(' '), curX, lineY);
            } else {
              for (const w of lineWords) {
                const wW = ctx.measureText(w).width;
                const isFocus = focusWords.has(cleanWord(w));
                ctx.fillStyle = isFocus ? theme.accent : fillColor;
                ctx.textAlign = 'left';
                ctx.fillText(w, curX, lineY);
                curX += wW + spaceW;
              }
            }
          }

          finalBoxWidth = Math.max(maxMeasuredLineWidth + 24, 60);
          finalBoxHeight = Math.max(totalTextHeight, fontSize * 1.4);
        }
        break;
      }
      case 'badge': {
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        const label = (node.content || '').toUpperCase();
        const textMetrics = ctx.measureText(label);
        const badgeW = Math.max(nodeW, textMetrics.width + 36);
        const badgeH = Math.max(nodeH, fontSize * 1.8);
        const x0 = -badgeW / 2;
        const y0 = -badgeH / 2;

        ctx.fillStyle = fillColor;
        if (strokeWidth > 0) {
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = strokeWidth;
        }

        if (typeof (ctx as any).roundRect === 'function') {
          ctx.beginPath();
          (ctx as any).roundRect(x0, y0, badgeW, badgeH, borderRadius || badgeH / 2);
          ctx.fill();
          if (strokeWidth > 0) ctx.stroke();
        } else {
          ctx.fillRect(x0, y0, badgeW, badgeH);
          if (strokeWidth > 0) ctx.strokeRect(x0, y0, badgeW, badgeH);
        }

        ctx.fillStyle = node.style.fillToken === 'surface' || node.style.fillToken === 'muted'
          ? theme.text
          : theme.bg;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 0, 0);

        finalBoxWidth = badgeW;
        finalBoxHeight = badgeH;
        break;
      }
      case 'metric': {
        let displayVal = node.content || '100%';
        if (node.animation?.active?.type === 'counter_tick') {
          const enterDuration = node.animation?.enter?.duration || 1.0;
          const tickProgress = clamp(sceneTime / enterDuration, 0, 1);
          displayVal = interpolateMetricValue(displayVal, tickProgress);
        }

        ctx.font = `900 ${fontSize}px ${fontFamily}`;
        ctx.fillStyle = fillColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(displayVal, 0, 0);

        const metrics = ctx.measureText(displayVal);
        finalBoxWidth = metrics.width + 24;
        finalBoxHeight = fontSize * 1.3;
        break;
      }
      case 'code': {
        const codeW = nodeW;
        const codeH = nodeH;
        const x0 = -codeW / 2;
        const y0 = -codeH / 2;

        ctx.fillStyle = fillColor;
        if (typeof (ctx as any).roundRect === 'function') {
          ctx.beginPath();
          (ctx as any).roundRect(x0, y0, codeW, codeH, borderRadius);
          ctx.fill();
        } else {
          ctx.fillRect(x0, y0, codeW, codeH);
        }

        const lines = (node.content || '').split('\n');
        ctx.font = `${fontSize}px 'JetBrains Mono', monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        const lineHeight = fontSize * 1.5;
        const pad = 24;
        let lineY = y0 + pad;

        const visibleLineCount = textSliceProgress < 1.0
          ? Math.max(1, Math.floor(lines.length * textSliceProgress))
          : lines.length;

        for (let i = 0; i < visibleLineCount; i++) {
          const line = lines[i];
          const tokens = tokenizeCodeLine(line);
          let tokenX = x0 + pad;

          for (const token of tokens) {
            ctx.fillStyle = token.color;
            ctx.fillText(token.text, tokenX, lineY);
            tokenX += ctx.measureText(token.text).width;
          }
          lineY += lineHeight;
        }
        break;
      }
      case 'shape': {
        const x0 = -nodeW / 2;
        const y0 = -nodeH / 2;
        ctx.fillStyle = fillColor;
        ctx.fillRect(x0, y0, nodeW, nodeH);
        break;
      }
    }

    const totalEffectiveScale = scale * parentCompoundScale;
    const rectW = finalBoxWidth * totalEffectiveScale;
    const rectH = finalBoxHeight * totalEffectiveScale;
    const rectX = absPx - rectW / 2;
    const rectY = (absPy + yOffset * parentCompoundScale) - rectH / 2;

    const domRect = new RectClass(rectX, rectY, rectW, rectH);
    this.nodeBoundsMap.set(node.id, domRect as DOMRect);

    if (node.children && node.children.length > 0) {
      const containerCoord = {
        x: -nodeW / 2,
        y: -nodeH / 2,
        width: nodeW,
        height: nodeH
      };
      const currentAbsPos = { x: absPx, y: absPy + yOffset * parentCompoundScale };
      const nextCompoundScale = parentCompoundScale * scale;
      const nextCompoundRotation = parentCompoundRotation + rotation;
      for (const child of node.children) {
        this.renderNode(
          ctx,
          child,
          frameTime,
          sceneTime,
          theme,
          containerCoord,
          currentAbsPos,
          nextCompoundScale,
          nextCompoundRotation
        );
      }
    }

    ctx.restore();
  }

  /**
   * Modular Card Container Primitive
   */
  public drawCardContainer(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    radius = 20,
    progress = 1,
    options?: { bg?: string; borderColor?: string; accentGlow?: string }
  ): void {
    ctx.save();
    const cx = x + w / 2;
    const cy = y + h / 2;

    const scale = lerp(0.92, 1.0, clamp(progress, 0, 1.15));
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    ctx.globalAlpha = clamp(ctx.globalAlpha * clamp(progress * 1.5, 0, 1), 0, 1);

    // Subtle glow if requested
    if (options?.accentGlow) {
      ctx.shadowColor = options.accentGlow;
      ctx.shadowBlur = 32;
    }

    // Card background
    ctx.fillStyle = options?.bg || '#18181be6';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, radius);
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.fill();

    // Reset shadow before border
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Card 1px crisp border
    ctx.strokeStyle = options?.borderColor || '#27272a';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Top edge specular sheen (1px highlight)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Layout Primitive: METRIC_COUNTER
   */
  public drawMetricCounter(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    valueStr: string,
    labelStr: string,
    progress: number,
    theme: MooProject['theme'],
    title?: string
  ): void {
    this.drawCardContainer(ctx, x, y, w, h, 24, progress, {
      bg: '#141416f0',
      borderColor: '#27272ae6',
      accentGlow: withAlpha(theme.textHighlight || '#84cc16', '22')
    });

    ctx.save();
    const cx = x + w / 2;
    const highlight = theme.textHighlight || '#84cc16';
    const textPrimary = theme.textPrimary || '#f4f4f5';

    // Header Title Badge
    const headerTitle = title || 'KEY METRIC';
    ctx.font = '700 20px "JetBrains Mono", monospace';
    ctx.fillStyle = '#71717a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(headerTitle.toUpperCase(), cx, y + 42);

    // Circular Progress Arc Gauge
    const gaugeY = y + h * 0.44;
    const radius = Math.min(w * 0.28, 140);

    // Background track
    ctx.beginPath();
    ctx.arc(cx, gaugeY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#27272a88';
    ctx.lineWidth = 12;
    ctx.stroke();

    // Active animated arc
    const arcAngle = clamp(progress, 0, 1) * Math.PI * 1.8;
    ctx.beginPath();
    ctx.arc(cx, gaugeY, radius, -Math.PI * 0.9, -Math.PI * 0.9 + arcAngle);
    ctx.strokeStyle = highlight;
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Animated Value String
    const displayVal = interpolateMetricValue(valueStr, clamp(progress, 0, 1));
    ctx.font = '800 84px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = highlight;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayVal, cx, gaugeY);

    // Sub-Label
    ctx.font = '600 28px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = textPrimary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // Word wrap label if wide
    const maxLabelWidth = w - 60;
    if (ctx.measureText(labelStr).width > maxLabelWidth) {
      ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
    }
    ctx.fillText(labelStr, cx, y + h - 50);

    // Trend Indicator Pill
    ctx.beginPath();
    const pillW = 120;
    const pillH = 32;
    const pillX = cx - pillW / 2;
    const pillY = y + h - 110;
    if (ctx.roundRect) {
      ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    } else {
      ctx.rect(pillX, pillY, pillW, pillH);
    }
    ctx.fillStyle = withAlpha(highlight, '22');
    ctx.fill();
    ctx.strokeStyle = withAlpha(highlight, '66');
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = '700 14px "JetBrains Mono", monospace';
    ctx.fillStyle = highlight;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('▲ VERIFIED', cx, pillY + pillH / 2);

    ctx.restore();
  }

  /**
   * Layout Primitive: TERMINAL_MOCKUP
   */
  public drawTerminalMockup(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    codeStr: string,
    language: string,
    progress: number,
    theme: MooProject['theme'],
    sceneElapsed = 0
  ): void {
    this.drawCardContainer(ctx, x, y, w, h, 20, progress, {
      bg: '#0f0f11fa',
      borderColor: '#27272a',
      accentGlow: 'rgba(56, 189, 248, 0.12)'
    });

    ctx.save();
    const highlight = theme.textHighlight || '#84cc16';

    // 1. macOS Titlebar Header
    const titleBarH = 54;
    ctx.fillStyle = '#18181be6';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, titleBarH, [20, 20, 0, 0]);
    } else {
      ctx.rect(x, y, w, titleBarH);
    }
    ctx.fill();

    // Divider
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + titleBarH);
    ctx.lineTo(x + w, y + titleBarH);
    ctx.stroke();

    // 3 Dots (Traffic Lights)
    const dotY = y + titleBarH / 2;
    const dotRadius = 6.5;
    const colors = ['#ef4444', '#eab308', '#22c55e'];
    colors.forEach((col, idx) => {
      ctx.beginPath();
      ctx.arc(x + 28 + idx * 20, dotY, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
    });

    // Window Title
    ctx.font = '600 16px "JetBrains Mono", monospace';
    ctx.fillStyle = '#71717a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${language.toLowerCase()} — mooscript-term`, x + w / 2, dotY);

    // 2. Monospace Code Area with Typewriter animation
    const codeAreaX = x + 36;
    const codeAreaY = y + titleBarH + 34;
    const maxVisibleChars = Math.floor(clamp(progress * 1.25, 0, 1) * codeStr.length);
    const visibleCode = codeStr.slice(0, maxVisibleChars);

    const lines = visibleCode.split('\n');
    const lineHeight = 36;
    ctx.font = '500 23px "JetBrains Mono", monospace';
    ctx.textBaseline = 'top';

    let lastX = codeAreaX;
    let lastY = codeAreaY;

    lines.forEach((line, lineIdx) => {
      const lineY = codeAreaY + lineIdx * lineHeight;
      if (lineY + lineHeight > y + h - 20) return; // Prevent card overflow

      // Line number gutter
      ctx.fillStyle = '#3f3f46';
      ctx.textAlign = 'right';
      ctx.fillText(String(lineIdx + 1).padStart(2, '0'), codeAreaX - 12, lineY);

      // Syntax colored tokens
      ctx.textAlign = 'left';
      let currentX = codeAreaX + 16;
      const tokens = tokenizeCodeLine(line);
      tokens.forEach((tok) => {
        ctx.fillStyle = tok.color === '#84cc16' ? highlight : tok.color;
        ctx.fillText(tok.text, currentX, lineY);
        currentX += ctx.measureText(tok.text).width;
      });

      lastX = currentX;
      lastY = lineY;
    });

    // 3. Typing Cursor (blinks deterministically based on sceneElapsed)
    const isCursorBlink = Math.floor(sceneElapsed * 3) % 2 === 0;
    if (progress < 1 || isCursorBlink) {
      ctx.fillStyle = highlight;
      ctx.fillRect(lastX + 4, lastY + 2, 10, 24);
    }

    ctx.restore();
  }

  /**
   * Layout Primitive: VS_COMPARISON
   */
  public drawVsComparison(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    leftTitle: string,
    leftDesc: string,
    rightTitle: string,
    rightDesc: string,
    progress: number,
    theme: MooProject['theme']
  ): void {
    ctx.save();
    const highlight = theme.textHighlight || '#84cc16';
    const textPrimary = theme.textPrimary || '#f4f4f5';
    const cardH = (h - 70) / 2;

    // Card 1: Top (Old / Problem / Left)
    const topY = y;
    this.drawCardContainer(ctx, x, topY, w, cardH, 18, progress, {
      bg: '#141416f5',
      borderColor: '#ef444444',
      accentGlow: 'rgba(239, 68, 68, 0.1)'
    });

    // Tag for Top Card
    ctx.font = '700 16px "JetBrains Mono", monospace';
    ctx.fillStyle = '#ef4444';
    ctx.textAlign = 'left';
    ctx.fillText('✕ ' + leftTitle.toUpperCase(), x + 32, topY + 36);

    ctx.font = '600 28px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#a1a1aa';
    ctx.fillText(leftDesc, x + 32, topY + 84);

    // VS Circle Badge in Center
    const vsY = y + cardH + 35;
    const vsRadius = 30;
    const vsSpring = spring(progress, { stiffness: 300, damping: 12 });
    const vsScale = lerp(0.8, 1.0, clamp(vsSpring, 0, 1.2));

    ctx.save();
    ctx.translate(x + w / 2, vsY);
    ctx.scale(vsScale, vsScale);

    ctx.beginPath();
    ctx.arc(0, 0, vsRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#09090b';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#27272a';
    ctx.stroke();

    ctx.font = '800 18px "JetBrains Mono", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VS', 0, 0);
    ctx.restore();

    // Card 2: Bottom (New / Solution / Right)
    const bottomY = y + cardH + 70;
    this.drawCardContainer(ctx, x, bottomY, w, cardH, 18, progress, {
      bg: '#141416f5',
      borderColor: withAlpha(highlight, '88'),
      accentGlow: withAlpha(highlight, '22')
    });

    // Tag for Bottom Card
    ctx.font = '700 16px "JetBrains Mono", monospace';
    ctx.fillStyle = highlight;
    ctx.textAlign = 'left';
    ctx.fillText('✓ ' + rightTitle.toUpperCase(), x + 32, bottomY + 36);

    ctx.font = '700 30px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = textPrimary;
    ctx.fillText(rightDesc, x + 32, bottomY + 84);

    ctx.restore();
  }

  /**
   * Layout Primitive: LIST_STAGGER
   */
  public drawStaggeredList(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    items: string[],
    sceneElapsed: number,
    theme: MooProject['theme'],
    title?: string
  ): void {
    ctx.save();
    const highlight = theme.textHighlight || '#84cc16';
    const textPrimary = theme.textPrimary || '#f4f4f5';

    // Header Title
    if (title) {
      ctx.font = '700 22px "JetBrains Mono", monospace';
      ctx.fillStyle = '#71717a';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(title.toUpperCase(), x + 10, y - 40);
    }

    const maxItems = Math.min(items.length, 5);
    const itemGap = 18;
    const rowH = Math.min(84, (h - (maxItems - 1) * itemGap) / maxItems);

    items.slice(0, maxItems).forEach((itemText, idx) => {
      const delay = idx * 0.28;
      const itemAge = Math.max(0, sceneElapsed - delay);
      const rowSpring = spring(itemAge, { stiffness: 240, damping: 16 });
      const rowProgress = clamp(rowSpring, 0, 1);

      const slideX = lerp(-40, 0, rowProgress);
      const rowY = y + idx * (rowH + itemGap);

      ctx.save();
      ctx.translate(slideX, 0);
      ctx.globalAlpha = clamp(rowProgress, 0, 1);

      // Card container per item
      this.drawCardContainer(ctx, x, rowY, w, rowH, 14, rowProgress, {
        bg: '#18181bf0',
        borderColor: '#27272ae6'
      });

      // Number badge
      const badgeSize = 36;
      const badgeX = x + 20;
      const badgeY = rowY + (rowH - badgeSize) / 2;

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(badgeX, badgeY, badgeSize, badgeSize, 8);
      } else {
        ctx.rect(badgeX, badgeY, badgeSize, badgeSize);
      }
      ctx.fillStyle = withAlpha(highlight, '22');
      ctx.fill();
      ctx.strokeStyle = withAlpha(highlight, '66');
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = '700 16px "JetBrains Mono", monospace';
      ctx.fillStyle = highlight;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(idx + 1).padStart(2, '0'), badgeX + badgeSize / 2, badgeY + badgeSize / 2);

      // Item text
      ctx.font = '600 24px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = textPrimary;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(itemText, badgeX + badgeSize + 20, rowY + rowH / 2);

      ctx.restore();
    });

    ctx.restore();
  }

  /**
   * Auxiliary Subtitle Layer for Visual Components (when showSubtitles is true)
   */
  public renderBottomSubtitleOverlay(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    scene: Scene,
    sceneElapsed: number,
    project: MooProject
  ): void {
    const text = (scene.narrationText || scene.text || '').trim();
    if (!text) return;

    ctx.save();
    const safeBottom = Math.round(height * (220 / 1920));
    const subY = height - safeBottom - 70;
    const subW = width - 160;
    const subX = 80;
    const subH = 68;

    // Semi-transparent pill
    ctx.fillStyle = '#09090be6';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(subX, subY, subW, subH, 16);
    } else {
      ctx.rect(subX, subY, subW, subH);
    }
    ctx.fill();

    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Determine active word
    let activeWordIndex = -1;
    const timestamps = scene.wordTimestamps;
    if (timestamps && timestamps.length > 0) {
      for (let i = 0; i < timestamps.length; i++) {
        if (sceneElapsed >= timestamps[i].start && sceneElapsed <= timestamps[i].end) {
          activeWordIndex = i;
          break;
        }
      }
    }

    ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
    ctx.textBaseline = 'middle';

    const words = text.split(/\s+/);
    const spaceW = ctx.measureText(' ').width;
    let totalTextW = 0;
    for (const w of words) totalTextW += ctx.measureText(w).width + spaceW;

    let curX = Math.max(subX + 24, (width - totalTextW) / 2);
    const highlight = project.theme.textHighlight || '#84cc16';
    const textPrimary = project.theme.textPrimary || '#f4f4f5';

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const wWidth = ctx.measureText(w).width;
      if (curX + wWidth > subX + subW - 24) break; // Keep inside pill

      ctx.fillStyle = i === activeWordIndex ? highlight : textPrimary;
      ctx.globalAlpha = i === activeWordIndex ? 1.0 : 0.65;
      ctx.fillText(w, curX, subY + subH / 2);
      curX += wWidth + spaceW;
    }

    ctx.restore();
  }

  private renderWatermark(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.font = '700 24px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#ffffff44';
    ctx.textAlign = 'right';
    ctx.fillText('MOOSCRIPT', width - 90, height - 120);
    ctx.restore();
  }

  private createOffscreen(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
    if (typeof OffscreenCanvas !== 'undefined') {
      return new OffscreenCanvas(w, h);
    }
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    }
    return { width: w, height: h, getContext: () => null } as any;
  }

  private getOrCreateBgCanvas(
    width: number,
    height: number,
    bg: string,
    highlight: string
  ): HTMLCanvasElement | OffscreenCanvas {
    const cacheKey = `${width}x${height}:${bg}:${highlight}`;
    const cached = this.bgCache.get(cacheKey);
    if (cached) return cached;

    const offscreen = this.createOffscreen(width, height);
    const offCtx = (offscreen as any).getContext?.('2d', { alpha: false }) as CanvasRenderingContext2D | null;

    if (offCtx) {
      // 1. Base solid background
      offCtx.fillStyle = bg;
      offCtx.fillRect(0, 0, width, height);

      // 2. Base Radial Glow
      const glowX = width / 2;
      const glowY = height * 0.45;
      const glowRadius = width * 0.85;
      const grad = offCtx.createRadialGradient(glowX, glowY, 40, glowX, glowY, glowRadius);
      grad.addColorStop(0, withAlpha(highlight, '22'));
      grad.addColorStop(0.5, withAlpha(highlight, '08'));
      grad.addColorStop(1, 'transparent');
      offCtx.fillStyle = grad;
      offCtx.fillRect(0, 0, width, height);

      // 3. Tech Grid Pattern (~33 lines across width & height)
      offCtx.strokeStyle = '#27272a33';
      offCtx.lineWidth = 1.5;
      const gridSize = 90;
      offCtx.beginPath();
      for (let x = 0; x <= width; x += gridSize) {
        offCtx.moveTo(x, 0);
        offCtx.lineTo(x, height);
      }
      for (let y = 0; y <= height; y += gridSize) {
        offCtx.moveTo(0, y);
        offCtx.lineTo(width, y);
      }
      offCtx.stroke();

      // 4. Top & Bottom vignette gradient
      const vignette = offCtx.createLinearGradient(0, 0, 0, height);
      vignette.addColorStop(0, '#09090b88');
      vignette.addColorStop(0.15, 'transparent');
      vignette.addColorStop(0.85, 'transparent');
      vignette.addColorStop(1, '#09090bee');
      offCtx.fillStyle = vignette;
      offCtx.fillRect(0, 0, width, height);
    }

    if (this.bgCache.size > 20) {
      this.bgCache.clear();
    }
    this.bgCache.set(cacheKey, offscreen);
    return offscreen;
  }

  private applyMotionPresetTransform(
    ctx: CanvasRenderingContext2D,
    preset: Scene['motionPreset'],
    sceneElapsed: number,
    frameInScene: number,
    _totalFrames: number
  ): void {
    switch (preset) {
      case 'punch_zoom': {
        const s = spring(sceneElapsed, { stiffness: 220, damping: 14, mass: 1 });
        const rawScale = lerp(0.8, 1.0, clamp(s, 0, 1.2));
        const scaleVal = Math.max(0.01, rawScale);
        ctx.scale(scaleVal, scaleVal);
        break;
      }
      case 'slide_split': {
        const enterProgress = easeOutExpo(clamp(sceneElapsed * 2.5, 0, 1));
        const slideY = lerp(80, 0, enterProgress);
        ctx.translate(0, slideY);
        break;
      }
      case 'fade_float': {
        const floatOffset = Math.sin(sceneElapsed * 2.5) * 14;
        const enterAlpha = easeInOutQuad(clamp(sceneElapsed * 3, 0, 1));
        ctx.globalAlpha = clamp(ctx.globalAlpha * enterAlpha, 0, 1);
        ctx.translate(0, floatOffset);
        break;
      }
      case 'kinetic_shake': {
        const enterScale = Math.max(0.01, spring(sceneElapsed, { stiffness: 260, damping: 18 }));
        ctx.scale(enterScale, enterScale);
        if (sceneElapsed < 0.25) {
          const shakeMag = (1 - sceneElapsed / 0.25) * 8;
          const shakeX = Math.sin(frameInScene * 1.5) * shakeMag;
          const shakeY = Math.cos(frameInScene * 1.5) * shakeMag;
          ctx.translate(shakeX, shakeY);
        }
        break;
      }
    }
  }

  private renderHeader(
    ctx: CanvasRenderingContext2D,
    width: number,
    currentSceneNum: number,
    totalScenes: number,
    project: MooProject
  ): void {
    ctx.save();
    const topMargin = 220;

    // Brand Monogram + Tag
    ctx.font = '600 32px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#71717a';
    ctx.fillText('MOOSCRIPT // CORE ENGINE', 90, topMargin);

    // Scene Counter Badge
    ctx.textAlign = 'right';
    const counterText = `SCENE ${String(currentSceneNum).padStart(2, '0')} / ${String(totalScenes).padStart(2, '0')}`;
    ctx.fillStyle = project.theme.textHighlight || '#84cc16';
    ctx.fillText(counterText, width - 90, topMargin);

    // Header divider line
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(90, topMargin + 25);
    ctx.lineTo(width - 90, topMargin + 25);
    ctx.stroke();

    ctx.restore();
  }

  private renderSceneIcon(
    ctx: CanvasRenderingContext2D,
    width: number,
    iconName: string,
    highlightColor: string,
    sceneElapsed: number
  ): void {
    ctx.save();
    const iconY = 460;
    const iconEntrance = spring(sceneElapsed, { stiffness: 200, damping: 12 });
    const currentScale = Math.max(0.01, clamp(iconEntrance, 0, 1.15));

    ctx.translate(width / 2, iconY);
    ctx.scale(currentScale, currentScale);

    // Glowing badge circle
    ctx.beginPath();
    ctx.arc(0, 0, 68, 0, Math.PI * 2);
    ctx.fillStyle = '#1c1b1d';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = withAlpha(highlightColor, '88');
    ctx.stroke();

    // Draw pre-compiled icon
    drawIcon(ctx, iconName, 0, 0, 64, highlightColor);

    ctx.restore();
  }

  private computeSceneLayout(
    ctx: CanvasRenderingContext2D,
    scene: Scene,
    fontFamily: string,
    width: number,
    height: number,
    maxLineWidth: number,
    captionPosition: CaptionPosition = 'center'
  ): MemoizedSceneLayout {
    const textToRender = (scene.narrationText || scene.text || '').trim();
    const rawWords = textToRender
      .split(/\s+/)
      .filter((w) => w.length > 0);
    if (rawWords.length === 0) {
      return { fontSize: 74, lineHeight: 110, words: [], totalLines: 0 };
    }

    const focusSet = new Set((scene.focusWords || []).map((w) => cleanWord(w)));
    const maxAllowedHeight = scene.icon ? height * 0.48 : height * 0.62;

    // Auto-fit font sizing: step down from 74 to min 24
    let chosenFontSize = 74;
    const minFontSize = 24;

    while (chosenFontSize > minFontSize) {
      ctx.font = `800 ${chosenFontSize}px ${fontFamily}`;
      const testLineHeight = Math.round(chosenFontSize * 1.45);

      let anyWordExceeds = false;
      for (let i = 0; i < rawWords.length; i++) {
        if (ctx.measureText(rawWords[i]).width > maxLineWidth) {
          anyWordExceeds = true;
          break;
        }
      }

      if (anyWordExceeds && chosenFontSize > minFontSize) {
        chosenFontSize = Math.max(minFontSize, chosenFontSize - 4);
        continue;
      }

      let simLines = 1;
      let simLineWidth = 0;
      const simSpaceWidth = ctx.measureText(' ').width;

      for (let i = 0; i < rawWords.length; i++) {
        const wWidth = ctx.measureText(rawWords[i]).width;
        if (simLineWidth + wWidth > maxLineWidth && simLineWidth > 0) {
          simLines++;
          simLineWidth = 0;
        }
        simLineWidth += wWidth + simSpaceWidth;
      }

      const simTotalHeight = simLines * testLineHeight;
      if (simTotalHeight <= maxAllowedHeight && simLines <= 8) {
        break;
      }

      chosenFontSize = Math.max(minFontSize, chosenFontSize - 4);
    }

    ctx.font = `800 ${chosenFontSize}px ${fontFamily}`;
    const spaceWidth = ctx.measureText(' ').width;
    const lineHeight = Math.round(chosenFontSize * 1.45);

    const words: string[] = [];
    const wordIndexMap: number[] = [];

    for (let i = 0; i < rawWords.length; i++) {
      const w = rawWords[i];
      const wMetrics = ctx.measureText(w).width;
      if (wMetrics > maxLineWidth) {
        let chunk = '';
        for (const char of w) {
          if (ctx.measureText(chunk + char + '-').width > maxLineWidth && chunk.length > 0) {
            words.push(chunk + '-');
            wordIndexMap.push(i);
            chunk = char;
          } else {
            chunk += char;
          }
        }
        if (chunk.length > 0) {
          words.push(chunk);
          wordIndexMap.push(i);
        }
      } else {
        words.push(w);
        wordIndexMap.push(i);
      }
    }

    interface TempWord {
      word: string;
      clean: string;
      isFocus: boolean;
      wordIndex: number;
      width: number;
    }
    const lines: TempWord[][] = [[]];
    let currentLine = 0;
    let currentLineWidth = 0;

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const originalIndex = wordIndexMap[i];
      const clean = cleanWord(w);
      const wWidth = ctx.measureText(w).width;
      const isFocus = focusSet.has(clean);

      if (currentLineWidth + wWidth > maxLineWidth && lines[currentLine].length > 0) {
        currentLine++;
        lines[currentLine] = [];
        currentLineWidth = 0;
      }

      lines[currentLine].push({
        word: w,
        clean,
        isFocus,
        wordIndex: originalIndex,
        width: wWidth
      });
      currentLineWidth += wWidth + spaceWidth;
    }

    const totalBlockHeight = lines.length * lineHeight;

    // Safe zone constants
    const safeTop = Math.round(height * (120 / 1920));
    const safeBottom = Math.round(height * (220 / 1920));

    let startY: number;
    if (scene.icon) {
      const availableTop = 550;
      const availableBottom = height - safeBottom;
      const centerY = (availableTop + availableBottom) / 2;
      startY = centerY - totalBlockHeight / 2 + lineHeight / 2;
    } else {
      switch (captionPosition) {
        case 'top': {
          startY = safeTop + lineHeight / 2 + Math.round(height * 0.04);
          break;
        }
        case 'bottom': {
          startY = height - safeBottom - totalBlockHeight + lineHeight / 2;
          break;
        }
        case 'center':
        default: {
          startY = height / 2 + 30 - totalBlockHeight / 2 + lineHeight / 2;
          break;
        }
      }
    }

    const memoizedWords: MemoizedWord[] = [];
    for (let lIdx = 0; lIdx < lines.length; lIdx++) {
      const line = lines[lIdx];
      let lineWidth = 0;
      for (let wIdx = 0; wIdx < line.length; wIdx++) {
        lineWidth += line[wIdx].width;
        if (wIdx < line.length - 1) lineWidth += spaceWidth;
      }

      let currentX = (width - lineWidth) / 2;
      const lineY = startY + lIdx * lineHeight;

      for (let wIdx = 0; wIdx < line.length; wIdx++) {
        const tw = line[wIdx];
        memoizedWords.push({
          word: tw.word,
          cleanWord: tw.clean,
          isFocus: tw.isFocus,
          wordIndex: tw.wordIndex,
          width: tw.width,
          x: currentX,
          y: lineY,
          lineIndex: lIdx
        });
        currentX += tw.width + spaceWidth;
      }
    }

    return {
      fontSize: chosenFontSize,
      lineHeight,
      words: memoizedWords,
      totalLines: lines.length
    };
  }

  private renderKineticTypography(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    scene: Scene,
    sceneElapsed: number,
    project: MooProject
  ): void {
    ctx.save();

    const fontFamily =
      project.theme.fontFamily === 'Mono'
        ? '"JetBrains Mono", monospace'
        : project.theme.fontFamily === 'Impact'
          ? 'Impact, "Plus Jakarta Sans", sans-serif'
          : '"Plus Jakarta Sans", sans-serif';

    const captionStyle: CaptionStyle = project.theme.captionStyle || 'boxed';
    const captionPosition: CaptionPosition = project.theme.captionPosition || 'center';
    const maxLineWidth = width - 180;

    const textForCache = scene.narrationText || scene.text || '';
    const cacheKey = `${scene.id}:${textForCache}:${fontFamily}:${maxLineWidth}x${height}:${(scene.focusWords || []).join(',')}:${captionStyle}:${captionPosition}`;
    let layout = this.layoutCache.get(cacheKey);
    if (!layout) {
      layout = this.computeSceneLayout(ctx, scene, fontFamily, width, height, maxLineWidth, captionPosition);
      if (this.layoutCache.size > 100) this.layoutCache.clear();
      this.layoutCache.set(cacheKey, layout);
    }

    if (layout.words.length === 0) {
      ctx.restore();
      return;
    }

    const { fontSize } = layout;
    ctx.font = `800 ${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'middle';

    // Determine active spoken word index
    let activeWordIndex = -1;
    const timestamps = scene.wordTimestamps;
    if (timestamps && timestamps.length > 0) {
      for (let i = 0; i < timestamps.length; i++) {
        if (sceneElapsed >= timestamps[i].start && sceneElapsed <= timestamps[i].end) {
          activeWordIndex = i;
          break;
        }
      }
      if (activeWordIndex === -1 && sceneElapsed > timestamps[timestamps.length - 1].end) {
        activeWordIndex = timestamps.length - 1;
      }
    }

    const highlightColor = project.theme.textHighlight || '#84cc16';
    const primaryTextColor = project.theme.textPrimary || '#f4f4f5';

    // Dispatch to the correct style renderer
    switch (captionStyle) {
      case 'karaoke':
        this.renderCaptionKaraoke(ctx, layout, fontSize, fontFamily, activeWordIndex, highlightColor, primaryTextColor);
        break;
      case 'bold-pop':
        this.renderCaptionBoldPop(ctx, layout, fontSize, fontFamily, activeWordIndex, timestamps, sceneElapsed, highlightColor, primaryTextColor);
        break;
      case 'minimal':
        this.renderCaptionMinimal(ctx, layout, fontSize, fontFamily, activeWordIndex, highlightColor, primaryTextColor);
        break;
      case 'boxed':
      default:
        this.renderCaptionBoxed(ctx, layout, fontSize, fontFamily, activeWordIndex, timestamps, sceneElapsed, highlightColor, primaryTextColor);
        break;
    }

    ctx.restore();
  }

  private renderCaptionBoxed(
    ctx: CanvasRenderingContext2D,
    layout: MemoizedSceneLayout,
    fontSize: number,
    fontFamily: string,
    activeWordIndex: number,
    timestamps: MooProject['scenes'][0]['wordTimestamps'] | undefined,
    sceneElapsed: number,
    highlightColor: string,
    primaryTextColor: string
  ): void {
    ctx.font = `800 ${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'middle';

    for (let i = 0; i < layout.words.length; i++) {
      const wObj = layout.words[i];
      ctx.save();

      if (wObj.wordIndex === activeWordIndex) {
        let wordAge = 0;
        if (timestamps && timestamps[wObj.wordIndex]) {
          wordAge = Math.max(0, sceneElapsed - timestamps[wObj.wordIndex].start);
        }
        const bounce = spring(wordAge, { stiffness: 280, damping: 15, mass: 0.8 });
        const rawScale = lerp(0.85, 1.15, clamp(bounce, 0, 1.25));
        const wordScale = Math.max(0.01, rawScale);

        const cx = wObj.x + wObj.width / 2;
        const cy = wObj.y;
        ctx.translate(cx, cy);
        ctx.scale(wordScale, wordScale);
        ctx.translate(-cx, -cy);

        const paddingX = Math.round(fontSize * 0.28);
        const paddingY = Math.round(fontSize * 0.18);
        const badgeX = wObj.x - paddingX;
        const badgeY = wObj.y - fontSize / 2 - paddingY;
        const badgeW = wObj.width + paddingX * 2;
        const badgeH = fontSize + paddingY * 2;
        const cornerRadius = Math.round(fontSize * 0.24);

        ctx.fillStyle = highlightColor;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(badgeX, badgeY, badgeW, badgeH, cornerRadius);
        } else {
          ctx.rect(badgeX, badgeY, badgeW, badgeH);
        }
        ctx.fill();

        ctx.fillStyle = '#09090b';
        ctx.textAlign = 'left';
        ctx.fillText(wObj.word, wObj.x, wObj.y);
      } else if (wObj.isFocus) {
        ctx.fillStyle = highlightColor;
        ctx.textAlign = 'left';
        ctx.fillText(wObj.word, wObj.x, wObj.y);
      } else {
        ctx.fillStyle = primaryTextColor;
        ctx.globalAlpha = 0.55;
        ctx.textAlign = 'left';
        ctx.fillText(wObj.word, wObj.x, wObj.y);
      }

      ctx.restore();
    }
  }

  private renderCaptionKaraoke(
    ctx: CanvasRenderingContext2D,
    layout: MemoizedSceneLayout,
    fontSize: number,
    fontFamily: string,
    activeWordIndex: number,
    highlightColor: string,
    primaryTextColor: string
  ): void {
    ctx.font = `800 ${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'middle';

    for (let i = 0; i < layout.words.length; i++) {
      const wObj = layout.words[i];
      ctx.save();
      ctx.textAlign = 'left';

      if (wObj.wordIndex === activeWordIndex) {
        ctx.fillStyle = highlightColor;
        ctx.globalAlpha = 1.0;
        ctx.shadowColor = highlightColor;
        ctx.shadowBlur = Math.round(fontSize * 0.3);
        ctx.fillText(wObj.word, wObj.x, wObj.y);
      } else if (wObj.wordIndex < activeWordIndex) {
        ctx.fillStyle = highlightColor;
        ctx.globalAlpha = 0.38;
        ctx.fillText(wObj.word, wObj.x, wObj.y);
      } else {
        ctx.fillStyle = primaryTextColor;
        ctx.globalAlpha = 0.55;
        ctx.fillText(wObj.word, wObj.x, wObj.y);
      }

      ctx.restore();
    }
  }

  private renderCaptionBoldPop(
    ctx: CanvasRenderingContext2D,
    layout: MemoizedSceneLayout,
    fontSize: number,
    fontFamily: string,
    activeWordIndex: number,
    timestamps: MooProject['scenes'][0]['wordTimestamps'] | undefined,
    sceneElapsed: number,
    highlightColor: string,
    primaryTextColor: string
  ): void {
    ctx.textBaseline = 'middle';

    for (let i = 0; i < layout.words.length; i++) {
      const wObj = layout.words[i];
      ctx.save();

      if (wObj.wordIndex === activeWordIndex) {
        let wordAge = 0;
        if (timestamps && timestamps[wObj.wordIndex]) {
          wordAge = Math.max(0, sceneElapsed - timestamps[wObj.wordIndex].start);
        }
        const bounce = spring(wordAge, { stiffness: 300, damping: 12, mass: 0.7 });
        const rawScale = lerp(0.75, 1.30, clamp(bounce, 0, 1.35));
        const wordScale = Math.max(0.01, rawScale);

        const cx = wObj.x + wObj.width / 2;
        const cy = wObj.y;
        ctx.translate(cx, cy);
        ctx.scale(wordScale, wordScale);
        ctx.translate(-cx, -cy);

        ctx.font = `900 ${fontSize}px ${fontFamily}`;
        ctx.textAlign = 'left';

        ctx.strokeStyle = highlightColor;
        ctx.lineWidth = Math.round(fontSize * 0.08);
        ctx.lineJoin = 'round';
        ctx.strokeText(wObj.word, wObj.x, wObj.y);

        ctx.fillStyle = primaryTextColor;
        ctx.fillText(wObj.word, wObj.x, wObj.y);
      } else if (wObj.isFocus) {
        ctx.font = `800 ${fontSize}px ${fontFamily}`;
        ctx.fillStyle = highlightColor;
        ctx.textAlign = 'left';
        ctx.fillText(wObj.word, wObj.x, wObj.y);
      } else {
        ctx.font = `800 ${fontSize}px ${fontFamily}`;
        ctx.fillStyle = primaryTextColor;
        ctx.globalAlpha = 0.50;
        ctx.textAlign = 'left';
        ctx.fillText(wObj.word, wObj.x, wObj.y);
      }

      ctx.restore();
    }
  }

  private renderCaptionMinimal(
    ctx: CanvasRenderingContext2D,
    layout: MemoizedSceneLayout,
    fontSize: number,
    fontFamily: string,
    activeWordIndex: number,
    highlightColor: string,
    primaryTextColor: string
  ): void {
    ctx.font = `700 ${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'middle';

    for (let i = 0; i < layout.words.length; i++) {
      const wObj = layout.words[i];
      ctx.save();
      ctx.textAlign = 'left';

      if (wObj.wordIndex === activeWordIndex) {
        ctx.fillStyle = primaryTextColor;
        ctx.globalAlpha = 1.0;
        ctx.fillText(wObj.word, wObj.x, wObj.y);
      } else if (wObj.isFocus) {
        ctx.fillStyle = highlightColor;
        ctx.globalAlpha = 0.85;
        ctx.fillText(wObj.word, wObj.x, wObj.y);
      } else {
        ctx.fillStyle = primaryTextColor;
        ctx.globalAlpha = 0.35;
        ctx.fillText(wObj.word, wObj.x, wObj.y);
      }

      ctx.restore();
    }
  }

  private renderOverlays(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    currentFrame: number,
    totalFrames: number,
    fps: number,
    project: MooProject
  ): void {
    ctx.save();

    const bottomY = height - 140;

    // Timeline progress line
    const progress = totalFrames > 0 ? clamp(currentFrame / totalFrames, 0, 1) : 0;
    ctx.fillStyle = '#27272a';
    ctx.fillRect(90, bottomY, width - 180, 6);

    ctx.fillStyle = '#84cc16';
    ctx.fillRect(90, bottomY, (width - 180) * progress, 6);

    // Frame & Timecode tag
    ctx.font = '500 24px "JetBrains Mono", monospace';
    ctx.fillStyle = '#71717a';
    ctx.textAlign = 'left';

    const currentSec = (currentFrame / fps).toFixed(2);
    const totalSec = (totalFrames / fps).toFixed(2);
    ctx.fillText(`${currentSec}s / ${totalSec}s [FR: ${currentFrame}]`, 90, bottomY + 45);

    // Dynamic Resolution & Audio Format tag
    ctx.textAlign = 'right';
    ctx.fillText(`${width}×${height} (${project.aspectRatio || '9:16'}) • AVC/AAC`, width - 90, bottomY + 45);

    ctx.restore();
  }

  private renderEmptyState(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.font = '600 42px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#71717a';
    ctx.textAlign = 'center';
    ctx.fillText('No Scenes Defined', width / 2, height / 2);
    ctx.restore();
  }
}
