import type { MooProject, Scene, SceneTransition, CaptionStyle, CaptionPosition } from '../../types';
import { spring, easeOutExpo, easeInOutQuad, clamp, lerp } from '../physics/spring';
import { drawIcon } from '../assets/icons';
import { cleanWord } from '../../utils/textUtils';

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

    // 2. Clear & Render Background (pre-rendered cached grid + vignette + deterministic pulse)
    this.renderBackground(ctx, width, height, project, sceneProgress);

    if (!activeScene) {
      this.renderEmptyState(ctx, width, height);
      return;
    }

    // 3. Motion Preset, Camera Push & Scene Transitions
    ctx.save();

    // Camera Push: subtle scale increment
    const cameraScale = 1.0 + (frameInScene / sceneTotalFrames) * 0.05;
    ctx.translate(width / 2, height / 2);
    ctx.scale(cameraScale, cameraScale);

    // Preset-specific motion transform with guaranteed non-zero scale floor
    const preset = activeScene.motionPreset || 'punch_zoom';
    this.applyMotionPresetTransform(ctx, preset, sceneElapsed, frameInScene, sceneTotalFrames);

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

    // Scene Center Icon
    if (activeScene.icon) {
      this.renderSceneIcon(ctx, width, activeScene.icon, project.theme.textHighlight, sceneElapsed);
    }

    // Dynamic Kinetic Typography with Layout Memoization & Auto-fit
    this.renderKineticTypography(ctx, width, height, activeScene, sceneElapsed, project);

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
      grad.addColorStop(0, `${highlight}22`);
      grad.addColorStop(0.5, `${highlight}08`);
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

  private renderBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
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
        pulseGrad.addColorStop(0, `${highlight}${alphaHex}`);
        pulseGrad.addColorStop(0.7, 'transparent');
        ctx.fillStyle = pulseGrad;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
    }
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
    ctx.strokeStyle = `${highlightColor}88`;
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
    const rawWords = scene.text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0);
    if (rawWords.length === 0) {
      return { fontSize: 74, lineHeight: 110, words: [], totalLines: 0 };
    }

    const focusSet = new Set((scene.focusWords || []).map((w) => cleanWord(w)));
    const maxAllowedHeight = scene.icon ? height * 0.48 : height * 0.62;

    // Auto-fit font sizing: step down from 74 to min 44 (or lower down to 24 if long words require it)
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

    // Safe zone constants (absolute px at 1920 height; scale proportionally)
    const safeTop = Math.round(height * (120 / 1920));    // ~120px: TikTok/Reels top bar
    const safeBottom = Math.round(height * (220 / 1920)); // ~220px: TikTok/Reels bottom nav

    let startY: number;
    if (scene.icon) {
      // Icon occupies top ~550px; always center below icon
      const availableTop = 550;
      const availableBottom = height - safeBottom;
      const centerY = (availableTop + availableBottom) / 2;
      startY = centerY - totalBlockHeight / 2 + lineHeight / 2;
    } else {
      switch (captionPosition) {
        case 'top': {
          // Anchor top edge of text block just below top safe zone
          startY = safeTop + lineHeight / 2 + Math.round(height * 0.04);
          break;
        }
        case 'bottom': {
          // Anchor bottom edge of text block just above bottom safe zone
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

    // Cache key includes style+position for full determinism
    const cacheKey = `${scene.id}:${scene.text}:${fontFamily}:${maxLineWidth}x${height}:${(scene.focusWords || []).join(',')}:${captionStyle}:${captionPosition}`;
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
        this.renderCaptionKaraoke(ctx, layout, fontSize, fontFamily, activeWordIndex, timestamps, sceneElapsed, highlightColor, primaryTextColor);
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

  // ── Caption Style: BOXED (original pill badge) ──────────────────────────────
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

  // ── Caption Style: KARAOKE (active word changes color, no badge) ─────────────
  private renderCaptionKaraoke(
    ctx: CanvasRenderingContext2D,
    layout: MemoizedSceneLayout,
    fontSize: number,
    fontFamily: string,
    activeWordIndex: number,
    _timestamps: MooProject['scenes'][0]['wordTimestamps'] | undefined,
    _sceneElapsed: number,
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
        // Active: highlight color, full opacity, slight glow
        ctx.fillStyle = highlightColor;
        ctx.globalAlpha = 1.0;
        ctx.shadowColor = highlightColor;
        ctx.shadowBlur = Math.round(fontSize * 0.3);
        ctx.fillText(wObj.word, wObj.x, wObj.y);
      } else if (wObj.wordIndex < activeWordIndex) {
        // Already spoken: faded highlight
        ctx.fillStyle = highlightColor;
        ctx.globalAlpha = 0.38;
        ctx.fillText(wObj.word, wObj.x, wObj.y);
      } else {
        // Not yet spoken: primary text
        ctx.fillStyle = primaryTextColor;
        ctx.globalAlpha = 0.55;
        ctx.fillText(wObj.word, wObj.x, wObj.y);
      }

      ctx.restore();
    }
  }

  // ── Caption Style: BOLD-POP (active word scales up + thick stroke) ───────────
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

        // Thick stroke (outline)
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

  // ── Caption Style: MINIMAL (no badge, subtle dimming for inactive) ────────────
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
