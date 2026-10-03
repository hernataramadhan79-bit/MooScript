import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  OPENAI_STORYBOARD_SCHEMA,
  stripNulls,
  extractJsonObject,
  tryParseAndValidate,
  DEFAULT_PROVIDER_MODELS,
  sanitizeModelName,
  generateStoryboard
} from '../src/engine/ai/llm';
import { DEFAULT_SETTINGS } from '../src/store/slices/settingsSlice';

describe('OpenAI Strict JSON Schema (Phase 1a)', () => {
  function verifyStrictSchema(schema: any, path = 'root') {
    if (schema.type === 'object') {
      expect(
        schema.additionalProperties,
        `Expected ${path}.additionalProperties to be false`
      ).toBe(false);

      expect(
        Array.isArray(schema.required),
        `Expected ${path}.required to be an array`
      ).toBe(true);

      if (schema.properties) {
        const propKeys = Object.keys(schema.properties);
        for (const key of propKeys) {
          expect(
            schema.required,
            `Expected ${path}.required to contain property key '${key}'`
          ).toContain(key);

          verifyStrictSchema(schema.properties[key], `${path}.${key}`);
        }
      }
    } else if (schema.type === 'array' || (Array.isArray(schema.type) && schema.type.includes('array'))) {
      if (schema.items) {
        verifyStrictSchema(schema.items, `${path}[items]`);
      }
    }
  }

  it('ensures every key in properties is listed in required at every object level with additionalProperties:false', () => {
    verifyStrictSchema(OPENAI_STORYBOARD_SCHEMA);
  });

  it('ensures scene required has all expected fields', () => {
    const sceneSchema = OPENAI_STORYBOARD_SCHEMA.properties.scenes.items;
    expect(sceneSchema.required).toEqual([
      'layout',
      'text',
      'camera',
      'visualData',
      'focusWords',
      'motionPreset',
      'icon'
    ]);
  });

  it('ensures visualData.required lists all its properties as nullable', () => {
    const visualData = OPENAI_STORYBOARD_SCHEMA.properties.scenes.items.properties.visualData;
    const propKeys = Object.keys(visualData.properties);
    expect(visualData.required).toEqual(propKeys);

    for (const key of propKeys) {
      const prop = (visualData.properties as any)[key];
      expect(Array.isArray(prop.type)).toBe(true);
      expect(prop.type).toContain('null');
    }

    expect(visualData.properties.bulletItems.type).toEqual(['array', 'null']);
  });
});

describe('stripNulls helper (Phase 1a)', () => {
  it('strips null values from objects and replaces them with undefined / omits keys', () => {
    const input = {
      title: null,
      metricValue: '10x',
      nested: {
        a: null,
        b: 'hello'
      }
    };
    const stripped = stripNulls(input) as any;
    expect(stripped.title).toBeUndefined();
    expect(stripped.metricValue).toBe('10x');
    expect(stripped.nested.a).toBeUndefined();
    expect(stripped.nested.b).toBe('hello');
  });

  it('filters null items out of arrays', () => {
    const input = [null, 'item1', null, 'item2'];
    const stripped = stripNulls(input);
    expect(stripped).toEqual(['item1', 'item2']);
  });

  it('leaves primitive values intact', () => {
    expect(stripNulls('test')).toBe('test');
    expect(stripNulls(123)).toBe(123);
    expect(stripNulls(true)).toBe(true);
    expect(stripNulls(null)).toBeUndefined();
  });
});

describe('extractJsonObject & tryParseAndValidate (Phase 1e)', () => {
  it('extracts JSON substring from prose wrapper', () => {
    const wrapped = 'Sure! {"title":"x","scenes":[{"layout":"KINETIC_QUOTE","text":"test","camera":"push_in","focusWords":["test"],"motionPreset":"punch_zoom","icon":"mascot"}]} hope it helps';
    const extracted = extractJsonObject(wrapped);
    expect(extracted).toBe('{"title":"x","scenes":[{"layout":"KINETIC_QUOTE","text":"test","camera":"push_in","focusWords":["test"],"motionPreset":"punch_zoom","icon":"mascot"}]}');
  });

  it('parses valid storyboard wrapped in conversational prose', () => {
    const raw = 'Sure! {"title":"x","scenes":[{"layout":"KINETIC_QUOTE","text":"test","camera":"push_in","focusWords":["test"],"motionPreset":"punch_zoom","icon":"mascot"}]} hope it helps';
    const res = tryParseAndValidate(raw);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.title).toBe('x');
      expect(res.data.scenes).toHaveLength(1);
    }
  });

  it('strips nulls from strict OpenAI response before zod validation', () => {
    const rawOpenAiStrict = JSON.stringify({
      title: 'Zero-Server Video',
      scenes: [
        {
          layout: 'METRIC_COUNTER',
          text: 'Compile 60fps MP4 in your browser directly.',
          camera: 'steady_drift',
          visualData: {
            title: null,
            metricValue: '+400%',
            metricLabel: 'Render Speedup',
            codeSnippet: null,
            codeLanguage: null,
            leftTitle: null,
            leftDesc: null,
            rightTitle: null,
            rightDesc: null,
            bulletItems: null
          },
          focusWords: ['Compile', '60fps'],
          motionPreset: 'punch_zoom',
          icon: 'zap'
        }
      ]
    });

    const res = tryParseAndValidate(rawOpenAiStrict);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.scenes[0].visualData.metricValue).toBe('+400%');
      expect(res.data.scenes[0].visualData.title).toBeUndefined();
    }
  });
});

describe('Anthropic & OpenRouter Model Configurations (Phase 1b)', () => {
  it('sets correct anthropic and openrouter defaults in DEFAULT_SETTINGS', () => {
    expect(DEFAULT_SETTINGS.anthropicModel).toBe('claude-sonnet-4-6');
    expect(DEFAULT_SETTINGS.openrouterModel).toBe('anthropic/claude-sonnet-4.6');
  });

  it('provides updated anthropic model list with recommended claude-sonnet-4-6', () => {
    const anthropicModels = DEFAULT_PROVIDER_MODELS.anthropic;
    expect(anthropicModels[0].id).toBe('claude-sonnet-4-6');
    expect(anthropicModels[0].isRecommended).toBe(true);
    expect(anthropicModels[1].id).toBe('claude-haiku-4-5-20251001');
  });

  it('sets openrouter default to anthropic/claude-sonnet-4.6 while keeping legacy selectable', () => {
    const openrouterModels = DEFAULT_PROVIDER_MODELS.openrouter;
    expect(openrouterModels[0].id).toBe('anthropic/claude-sonnet-4.6');
    expect(openrouterModels[0].isRecommended).toBe(true);
    expect(openrouterModels.some((m) => m.id === 'anthropic/claude-3.7-sonnet')).toBe(true);
  });

  it('sanitizes empty model names to new defaults', () => {
    expect(sanitizeModelName('anthropic', '')).toBe('claude-sonnet-4-6');
    expect(sanitizeModelName('openrouter', '')).toBe('anthropic/claude-sonnet-4.6');
  });
});

describe('generateStoryboard Error Handling (Phase 1d)', () => {
  const dummySkill = {
    id: 'test-skill',
    name: 'Director',
    icon: 'zap',
    description: 'Test skill',
    systemPrompt: 'Be creative',
    isBuiltin: true
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rethrows 401/429/network errors as-is on attempt 2 instead of swallowing as validation error', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // Attempt 1: returns invalid JSON syntax so it triggers attempt 2
        return {
          ok: true,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: 'NOT VALID JSON' }] } }]
          })
        } as any;
      }
      // Attempt 2: returns 401 Unauthorized API error
      return {
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: { message: 'Invalid API key' } })
      } as any;
    });

    await expect(
      generateStoryboard({
        provider: 'gemini',
        apiKey: 'test-key',
        prompt: 'test prompt',
        skill: dummySkill
      })
    ).rejects.toThrow(/401 Unauthorized/);
  });
});
