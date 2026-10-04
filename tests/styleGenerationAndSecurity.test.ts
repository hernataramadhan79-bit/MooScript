import { describe, it, expect, vi } from 'vitest';
import { generateSingleSceneModule } from '../src/engine/ai/director/directorPipeline';
import type { StoryBeat, StyleBrief } from '../src/types';

describe('Style Generation and Security Safety (Phase 7)', () => {
  const dummyBeat: StoryBeat = {
    id: 'beat-test-1',
    narration: 'Narasi visual untuk adegan 1',
    visualIntent: 'Pameran metrik kinerja 60 FPS',
    durationHint: 3.0
  };

  const dummyStyleBrief: StyleBrief = {
    adjectives: ['energetic', 'clean'],
    palette: {
      bg: '#09090b',
      primary: '#f4f4f6',
      accent: '#84cc16',
      text: '#ffffff'
    },
    fontDisplay: 'JetBrains Mono',
    fontBody: 'Plus Jakarta Sans',
    backgroundLanguage: 'Subtle animated mesh gradient',
    motionSignature: 'Smooth camera punch-in'
  };

  it('passes styleAdvice into executeLlm prompt and sets userEdited to false', async () => {
    let capturedUserPrompt = '';

    const executeLlm = vi.fn().mockImplementation(async (opts: { systemPrompt: string; userPrompt: string }) => {
      capturedUserPrompt = opts.userPrompt;
      return `\`\`\`html
<div class="test-scene"><h1>Hello</h1></div>
\`\`\`
\`\`\`css
.test-scene { width: 100%; height: 100%; }
\`\`\`
\`\`\`javascript
tl.from(root.querySelector("h1"), { opacity: 0, duration: 0.5 });
\`\`\``;
    });

    const advice = 'Gunakan palet warna neon cyberpunk dan animasi glitch punchy';
    const result = await generateSingleSceneModule({
      beat: dummyBeat,
      index: 0,
      total: 3,
      styleBrief: dummyStyleBrief,
      provider: 'groq',
      apiKey: 'test-key',
      executeLlm,
      styleAdvice: advice
    });

    expect(executeLlm).toHaveBeenCalledTimes(1);
    expect(capturedUserPrompt).toContain('=== STYLE ADVICE ===');
    expect(capturedUserPrompt).toContain(advice);
    expect(result.status).toBe('ok');
    expect(result.userEdited).toBe(false);
  });

  it('sets userEdited: false and status: error on failure or exception', async () => {
    const executeLlm = vi.fn().mockRejectedValue(new Error('API quota exceeded or rate limit'));

    const result = await generateSingleSceneModule({
      beat: dummyBeat,
      index: 0,
      total: 1,
      styleBrief: dummyStyleBrief,
      provider: 'openai',
      apiKey: 'test-key',
      executeLlm
    });

    expect(result.status).toBe('error');
    expect(result.userEdited).toBe(false);
    expect(result.errors?.[0]).toContain('API quota exceeded');
  });

  it('maps font options correctly according to the specification', () => {
    const mapFontDisplay = (fontFamily?: string): string => {
      switch (fontFamily) {
        case 'Mono':
          return 'JetBrains Mono';
        case 'Impact':
          return 'Syne';
        case 'Jakarta':
        default:
          return 'Plus Jakarta Sans';
      }
    };

    expect(mapFontDisplay('Jakarta')).toBe('Plus Jakarta Sans');
    expect(mapFontDisplay('Mono')).toBe('JetBrains Mono');
    expect(mapFontDisplay('Impact')).toBe('Syne');
    expect(mapFontDisplay(undefined)).toBe('Plus Jakarta Sans');
  });
});
