import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { serializeSvgFrame, getRuntimeScript } from '../src/engine/composition/runtime/mooRuntime';
import { buildCompositionDocument } from '../src/engine/composition/buildDocument';
import { withAlpha } from '../src/engine/renderer/canvasRenderer';
import { buildDuckingCurve } from '../src/engine/audio/bgmMixer';
import { validateSceneCode, stripCommentsRespectingStrings } from '../src/engine/composition/validator';
import { cleanJsonFence } from '../src/engine/ai/llm';
import { generateElevenLabsTTS } from '../src/engine/ai/tts';
import type { MooProject } from '../src/types';

describe('Master Plan regression suite', () => {
  describe('mooRuntime capture contract', () => {
    it('exposes real scene durations and relative ctx.at()', () => {
      const script = getRuntimeScript();
      expect(script).toContain('__MOO_SCENE_DURATIONS__');
      expect(script).toContain('Math.max(0, match.start)');
      expect(script).not.toContain('match.start - accumulatedTime');
      expect(script).toContain("const wrapperXmlns = ' xmlns=\"http://www.w3.org/1999/xhtml\"'");
    });

    it('uses selective external-url neutralization (keeps data: URIs)', () => {
      const script = getRuntimeScript();
      expect(script).toContain('https?:');
      expect(script).not.toContain("split('url(')");
    });
  });

  describe('serializeSvgFrame', () => {
    let origXMLSerializer: any;
    beforeEach(() => {
      origXMLSerializer = (globalThis as any).XMLSerializer;
      (globalThis as any).XMLSerializer = class {
        serializeToString(node: any) {
          return node.outerHTML || '';
        }
      };
    });
    afterEach(() => {
      (globalThis as any).XMLSerializer = origXMLSerializer;
    });

    it('never emits a namespace-less wrapper div', () => {
      const svg = serializeSvgFrame({ outerHTML: '<div>plain</div>' } as any, 1080, 1920, '');
      expect(svg).toMatch(/<foreignObject[^>]*><div xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/);
    });
  });

  describe('buildCompositionDocument hardening', () => {
    const baseProject = (): MooProject => ({
      id: 'mp-test',
      title: 'MP Test',
      renderMode: 'composition',
      aspectRatio: '9:16',
      fps: 30,
      width: 1080,
      height: 1920,
      theme: {
        bg: '#09090b',
        textPrimary: '#ffffff',
        textHighlight: '#84cc16',
        fontFamily: 'Jakarta',
        captionStyle: 'boxed',
        captionPosition: 'center',
        showSubtitles: false
      },
      scenes: [
        {
          id: 'sc-1',
          layout: 'KINETIC_QUOTE',
          narrationText: 'Hello',
          durationInSeconds: 3,
          wordTimestamps: [],
          motionPreset: 'punch_zoom',
          visualData: {}
        }
      ],
      audioDuration: 3,
      bgm: { preset: 'none', level: 0.18, duckRatio: 0.15 },
      composition: {
        id: 'comp-1',
        width: 1080,
        height: 1920,
        fps: 30,
        globalCss: '',
        scenes: [
          { beatId: 'sc-1', html: '<div class="t">Hi</div>', css: '', buildJs: 'tl.to(".t",{opacity:1});', status: 'ok', version: 1 }
        ],
        createdAt: Date.now()
      }
    });

    it('inlines WOFF2 @font-face and loads Google Fonts non-blocking', () => {
      const doc = buildCompositionDocument(baseProject());
      expect(doc).toContain('@font-face');
      expect(doc).toContain('Plus Jakarta Sans');
      expect(doc).toContain("media=\"print\" onload=\"this.media='all'\"");
    });

    it('adds a responsive auto-scale script in standalone mode only', () => {
      const standalone = buildCompositionDocument(baseProject(), { standalone: true });
      expect(standalone).toContain('moo-standalone-controller');
      expect(standalone).toContain('scale(');
      const embedded = buildCompositionDocument(baseProject());
      expect(embedded).not.toContain('moo-standalone-controller');
    });
  });

  describe('withAlpha', () => {
    it('appends alpha to 6-digit hex', () => {
      expect(withAlpha('#84cc16', '22')).toBe('#84cc1622');
    });
    it('expands 3-digit hex before appending alpha', () => {
      expect(withAlpha('#fff', '22')).toBe('#ffffff22');
    });
    it('converts rgb() to rgba() instead of producing garbage', () => {
      expect(withAlpha('rgb(10, 20, 30)', '80')).toContain('rgba(10, 20, 30,');
      expect(() => withAlpha('rgb(10, 20, 30)', '80')).not.toThrow();
    });
    it('passes named colors through untouched (never crashes addColorStop)', () => {
      expect(withAlpha('red', '22')).toBe('red');
    });
  });

  describe('buildDuckingCurve (single-release, monotonic)', () => {
    const opts = { duckRatio: 0.15, attackSec: 0.08, releaseSec: 0.35 };

    it('emits strictly ascending timestamps', () => {
      const curve = buildDuckingCurve(5.0, [{ start: 1.0, end: 2.0 }, { start: 3.0, end: 3.5 }], opts);
      for (let i = 1; i < curve.length; i++) {
        expect(curve[i].time).toBeGreaterThan(curve[i - 1].time);
      }
    });

    it('applies the release tail exactly once per region', () => {
      const curve = buildDuckingCurve(5.0, [{ start: 1.0, end: 2.0 }], opts);
      // duckStart = 0.92, duckEnd = 2.0, releaseEnd = 2.35
      const times = curve.map((p) => p.time);
      expect(times).toContain(2.0);
      expect(times).toContain(2.35);
      // Must NOT contain a doubled release (2.0 + 0.35 + 0.35 = 2.7)
      expect(times).not.toContain(2.7);
    });

    it('handles a word starting at t=0 without duplicate time:0 events', () => {
      const curve = buildDuckingCurve(2.0, [{ start: 0.0, end: 0.5 }], opts);
      const zeros = curve.filter((p) => p.time === 0);
      expect(zeros).toHaveLength(1);
      expect(zeros[0].value).toBeLessThanOrEqual(opts.duckRatio);
    });
  });

  describe('validator string-aware comment stripping', () => {
    it('still rejects parent.postMessage hidden after a // inside a string', () => {
      const res = validateSceneCode({
        buildJs: 'const url = "http://example.com/x"; parent.postMessage("leak"); tl.to(root, { opacity: 1 });'
      });
      expect(res.valid).toBe(false);
    });

    it('does not flag forbidden words that only appear in real comments', () => {
      const res = validateSceneCode({
        buildJs: '// fetch() is not allowed here\n/* eval(x) demo */\ntl.to(root, { opacity: 1 });'
      });
      expect(res.valid).toBe(true);
    });

    it('keeps regex literals intact', () => {
      const stripped = stripCommentsRespectingStrings('const re = /a\\/\\/b/gi; tl.to(root, {x: 1});');
      expect(stripped).toContain('/a\\/\\/b/gi');
    });
  });

  describe('cleanJsonFence reasoning resilience', () => {
    const storyboardJson = JSON.stringify({ title: 'T', scenes: [] });

    it('strips <think> blocks', () => {
      const out = cleanJsonFence(`<think>hmm reasoning</think>\n\`\`\`json\n${storyboardJson}\n\`\`\``);
      expect(out).not.toContain('hmm reasoning');
      expect(out).toContain('"title"');
    });

    it('extracts fenced JSON placed after prose', () => {
      const out = cleanJsonFence(`Here is your storyboard:\n\`\`\`json\n${storyboardJson}\n\`\`\`\nHope it helps!`);
      expect(out).toBe(storyboardJson);
    });

    it('recovers the fence after an unclosed <think>', () => {
      const out = cleanJsonFence(`<think>reasoning cut off...\n\`\`\`json\n${storyboardJson}\n\`\`\``);
      expect(out).toContain('"title"');
    });
  });

  describe('ElevenLabs free-tier model default & error mapping', () => {
    it('defaults to eleven_flash_v2_5 in the request body', async () => {
      const origFetch = globalThis.fetch;
      let capturedBody = '';
      (globalThis as any).fetch = async (_url: string, init: any) => {
        capturedBody = init?.body || '';
        return new Response(
          JSON.stringify({ audio_base64: '', alignment: { characters: [], character_start_times_seconds: [], character_end_times_seconds: [] } }),
          { status: 200 }
        );
      };
      try {
        await generateElevenLabsTTS({ apiKey: 'sk_test', voiceId: 'v1', text: 'Hai' });
        expect(JSON.parse(capturedBody).model_id).toBe('eleven_flash_v2_5');
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it('maps 401 to scoped-key permission guidance', async () => {
      const origFetch = globalThis.fetch;
      (globalThis as any).fetch = async () =>
        new Response(JSON.stringify({ detail: { message: 'Invalid API key' } }), { status: 401 });
      try {
        await expect(generateElevenLabsTTS({ apiKey: 'sk_bad', voiceId: 'v1', text: 'Hai' })).rejects.toThrow(
          /text_to_speech/
        );
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it('maps 402 to quota guidance', async () => {
      const origFetch = globalThis.fetch;
      (globalThis as any).fetch = async () =>
        new Response(JSON.stringify({ detail: { message: 'quota exceeded' } }), { status: 402 });
      try {
        await expect(generateElevenLabsTTS({ apiKey: 'sk_test', voiceId: 'v1', text: 'Hai' })).rejects.toThrow(
          /kuota/i
        );
      } finally {
        globalThis.fetch = origFetch;
      }
    });
  });
});
