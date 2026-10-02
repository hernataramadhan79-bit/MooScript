import type { MooProject, Scene, WordTimestamp } from '../../types';
import { spring, easeOutExpo, easeInOutQuad, clamp, lerp } from '../physics/spring';
import { drawIcon } from '../assets/icons';

export class CanvasRenderer {
  private canvas: HTMLCanvasElement | OffscreenCanvas;
  private ctx: CanvasRenderingContext2D;
  readonly width = 1080;
  readonly height = 1920;

  constructor(existingCanvas?: HTMLCanvasElement | OffscreenCanvas) {
    if (existingCanvas) {
      this.canvas = existingCanvas;
    } else if (typeof OffscreenCanvas !== 'undefined') {
      this.canvas = new OffscreenCanvas(this.width, this.height);
    } else {
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.width;
      this.canvas.height = this.height;
    }

    const context = this.canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!context) {
      throw new Error('Failed to acquire 2D Canvas Context');
    }
    this.ctx = context as CanvasRenderingContext2D;
  }

  public getCanvas(): HTMLCanvasElement | OffscreenCanvas {
    return this.canvas;
  }

  public getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  /**
   * Deterministic Frame Evaluation:
   * RenderState = f(currentFrame, fps, project)
   */
  public draw(currentFrame: number, totalFrames: number, project: MooProject): void {
    const { ctx, width, height } = this;
    const fps = project.fps || 30;
    const t = currentFrame / fps;

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
      sceneStartTime = accumulatedTime - activeScene.durationInSeconds;
    }

    const sceneDuration = activeScene ? (activeScene.durationInSeconds > 0 ? activeScene.durationInSeconds : 3) : 3;
    const sceneElapsed = Math.max(0, t - sceneStartTime);
    const sceneProgress = clamp(sceneElapsed / sceneDuration, 0, 1);
    const sceneTotalFrames = Math.max(1, Math.round(sceneDuration * fps));
    const frameInScene = Math.max(0, Math.round(sceneElapsed * fps));

    // 2. Clear & Render Background
    this.renderBackground(ctx, width, height, project, sceneProgress);

    if (!activeScene) {
      this.renderEmptyState(ctx, width, height);
      return;
    }

    // 3. Motion Preset & Camera Push
    ctx.save();

    // Camera Push: subtle scale increment
    const cameraScale = 1.0 + (frameInScene / sceneTotalFrames) * 0.05;
    ctx.translate(width / 2, height / 2);
    ctx.scale(cameraScale, cameraScale);

    // Preset-specific camera / root transformations
    const preset = activeScene.motionPreset || 'punch_zoom';
    this.applyMotionPresetTransform(ctx, preset, sceneElapsed, frameInScene, sceneTotalFrames);

    ctx.translate(-width / 2, -height / 2);

    // 4. Render Scene Visuals
    // Scene Index & Brand Pill
    this.renderHeader(ctx, width, sceneIndex + 1, project.scenes.length, project);

    // Scene Center Icon
    if (activeScene.icon) {
      this.renderSceneIcon(ctx, width, activeScene.icon, project.theme.textHighlight, sceneElapsed);
    }

    // Dynamic Kinetic Typography
    this.renderKineticTypography(ctx, width, height, activeScene, sceneElapsed, project);

    ctx.restore();

    // 5. Foreground Safe Zone & Watermark
    this.renderOverlays(ctx, width, height, currentFrame, totalFrames, fps);
  }

  private renderBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    project: MooProject,
    progress: number
  ): void {
    // Base solid background
    ctx.fillStyle = project.theme.bg || '#131315';
    ctx.fillRect(0, 0, width, height);

    // Subtle Radial Glow that pulses softly with scene progress
    const glowX = width / 2;
    const glowY = height * 0.45;
    const glowRadius = width * 0.85;

    const grad = ctx.createRadialGradient(glowX, glowY, 40, glowX, glowY, glowRadius);
    const highlight = project.theme.textHighlight || '#84cc16';
    grad.addColorStop(0, `${highlight}22`); // 13% opacity
    grad.addColorStop(0.5, `${highlight}08`); // 3% opacity
    grad.addColorStop(1, 'transparent');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Tech Grid Pattern
    ctx.strokeStyle = '#27272a33';
    ctx.lineWidth = 1.5;
    const gridSize = 90;
    ctx.beginPath();
    for (let x = 0; x <= width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Top & Bottom vignette gradient
    const vignette = ctx.createLinearGradient(0, 0, 0, height);
    vignette.addColorStop(0, '#09090b88');
    vignette.addColorStop(0.15, 'transparent');
    vignette.addColorStop(0.85, 'transparent');
    vignette.addColorStop(1, '#09090bee');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  private applyMotionPresetTransform(
    ctx: CanvasRenderingContext2D,
    preset: Scene['motionPreset'],
    sceneElapsed: number,
    frameInScene: number,
    totalFrames: number
  ): void {
    switch (preset) {
      case 'punch_zoom': {
        // Explosive spring punch zoom on entrance
        const s = spring(sceneElapsed, { stiffness: 220, damping: 14, mass: 1 });
        const scaleVal = lerp(0.8, 1.0, clamp(s, 0, 1.2));
        ctx.scale(scaleVal, scaleVal);
        break;
      }
      case 'slide_split': {
        // Kinetic slide with exponential ease
        const enterProgress = easeOutExpo(clamp(sceneElapsed * 2.5, 0, 1));
        const slideY = lerp(80, 0, enterProgress);
        ctx.translate(0, slideY);
        break;
      }
      case 'fade_float': {
        // Gentle sinusoidal floating elevation
        const floatOffset = Math.sin(sceneElapsed * 2.5) * 14;
        const enterAlpha = easeInOutQuad(clamp(sceneElapsed * 3, 0, 1));
        ctx.globalAlpha = enterAlpha;
        ctx.translate(0, floatOffset);
        break;
      }
      case 'kinetic_shake': {
        // High-energy entrance + micro-shake
        const enterScale = spring(sceneElapsed, { stiffness: 260, damping: 18 });
        ctx.scale(enterScale, enterScale);
        if (sceneElapsed < 0.25) {
          const shakeMag = (1 - sceneElapsed / 0.25) * 8;
          const shakeX = (Math.sin(frameInScene * 1.5) * shakeMag);
          const shakeY = (Math.cos(frameInScene * 1.5) * shakeMag);
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
    const currentScale = clamp(iconEntrance, 0, 1.15);

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

  private renderKineticTypography(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    scene: Scene,
    sceneElapsed: number,
    project: MooProject
  ): void {
    ctx.save();

    // Typography styling
    const fontFamily = project.theme.fontFamily === 'Mono'
      ? '"JetBrains Mono", monospace'
      : project.theme.fontFamily === 'Impact'
      ? 'Impact, "Plus Jakarta Sans", sans-serif'
      : '"Plus Jakarta Sans", sans-serif';

    const fontSize = 74;
    const lineHeight = 110;
    const maxLineWidth = width - 180; // 90px margin each side

    ctx.font = `800 ${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'middle';

    // 1. Determine spoken word
    // If scene has wordTimestamps, check active word
    let activeWordIndex = -1;
    if (scene.wordTimestamps && scene.wordTimestamps.length > 0) {
      for (let i = 0; i < scene.wordTimestamps.length; i++) {
        const wt = scene.wordTimestamps[i];
        if (sceneElapsed >= wt.start && sceneElapsed <= wt.end) {
          activeWordIndex = i;
          break;
        }
      }
      // If past the last word, keep the last word highlighted
      if (activeWordIndex === -1 && sceneElapsed > scene.wordTimestamps[scene.wordTimestamps.length - 1].end) {
        activeWordIndex = scene.wordTimestamps.length - 1;
      }
    }

    // 2. Break scene text into words and compute multi-line layout
    const words = scene.text.trim().split(/\s+/);
    if (words.length === 0 || (words.length === 1 && words[0] === '')) {
      ctx.restore();
      return;
    }

    interface WordLayout {
      word: string;
      cleanWord: string;
      isFocus: boolean;
      isActive: boolean;
      wordIndex: number;
      width: number;
      x: number;
      y: number;
      lineIndex: number;
    }

    const lines: WordLayout[][] = [[]];
    let currentLineIndex = 0;
    let currentLineWidth = 0;
    const spaceWidth = ctx.measureText(' ').width;

    const focusSet = new Set((scene.focusWords || []).map(w => w.toLowerCase().replace(/[^a-z0-9]/gi, '')));

    words.forEach((w, idx) => {
      const clean = w.toLowerCase().replace(/[^a-z0-9]/gi, '');
      const wordMetrics = ctx.measureText(w);
      const wWidth = wordMetrics.width;

      if (currentLineWidth + wWidth > maxLineWidth && lines[currentLineIndex].length > 0) {
        currentLineIndex++;
        lines[currentLineIndex] = [];
        currentLineWidth = 0;
      }

      const isFocus = focusSet.has(clean);
      const isActive = activeWordIndex === idx;

      lines[currentLineIndex].push({
        word: w,
        cleanWord: clean,
        isFocus,
        isActive,
        wordIndex: idx,
        width: wWidth,
        x: 0,
        y: 0,
        lineIndex: currentLineIndex
      });

      currentLineWidth += wWidth + spaceWidth;
    });

    // 3. Center lines vertically and horizontally
    const totalBlockHeight = lines.length * lineHeight;
    const startY = (height / 2) + 60 - (totalBlockHeight / 2);

    lines.forEach((line, lIdx) => {
      let lineWidth = 0;
      line.forEach((wObj, wIdx) => {
        lineWidth += wObj.width;
        if (wIdx < line.length - 1) lineWidth += spaceWidth;
      });

      let currentX = (width - lineWidth) / 2;
      const lineY = startY + lIdx * lineHeight;

      line.forEach((wObj) => {
        wObj.x = currentX;
        wObj.y = lineY;
        currentX += wObj.width + spaceWidth;
      });
    });

    // 4. Render each word with kinetic effects
    const highlightColor = project.theme.textHighlight || '#84cc16';
    const primaryTextColor = project.theme.textPrimary || '#f4f4f5';

    lines.forEach((line) => {
      line.forEach((wObj) => {
        ctx.save();

        let wordScale = 1.0;
        let wordOffsetY = 0;

        if (wObj.isActive) {
          // Dynamic active word bounce
          let wordAge = 0;
          if (scene.wordTimestamps && scene.wordTimestamps[wObj.wordIndex]) {
            wordAge = Math.max(0, sceneElapsed - scene.wordTimestamps[wObj.wordIndex].start);
          }
          const bounce = spring(wordAge, { stiffness: 280, damping: 15, mass: 0.8 });
          wordScale = lerp(0.85, 1.15, clamp(bounce, 0, 1.25));

          // Draw active Pill Badge background
          const paddingX = 22;
          const paddingY = 14;
          const badgeX = wObj.x - paddingX;
          const badgeY = wObj.y - (fontSize / 2) - paddingY;
          const badgeW = wObj.width + paddingX * 2;
          const badgeH = fontSize + paddingY * 2;
          const cornerRadius = 18;

          ctx.fillStyle = highlightColor;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(badgeX, badgeY, badgeW, badgeH, cornerRadius);
          } else {
            ctx.rect(badgeX, badgeY, badgeW, badgeH);
          }
          ctx.fill();

          // Text inside badge: bold contrast dark
          ctx.fillStyle = '#09090b';
          ctx.textAlign = 'left';
          ctx.fillText(wObj.word, wObj.x, wObj.y);
        } else if (wObj.isFocus) {
          // Focus words that are not currently active: accented color with subtle glow
          ctx.fillStyle = highlightColor;
          ctx.textAlign = 'left';
          ctx.fillText(wObj.word, wObj.x, wObj.y);
        } else {
          // Non-active words: lowered opacity
          ctx.fillStyle = primaryTextColor;
          ctx.globalAlpha = 0.55;
          ctx.textAlign = 'left';
          ctx.fillText(wObj.word, wObj.x, wObj.y);
        }

        ctx.restore();
      });
    });

    ctx.restore();
  }

  private renderOverlays(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    currentFrame: number,
    totalFrames: number,
    fps: number
  ): void {
    ctx.save();

    // Bottom Safe-Zone Status Bar
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

    // Resolution & Audio Format tag
    ctx.textAlign = 'right';
    ctx.fillText('1080×1920 (9:16) • AVC/AAC', width - 90, bottomY + 45);

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
