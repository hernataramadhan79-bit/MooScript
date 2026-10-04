import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  OPENAI_STORYBOARD_SCHEMA,
  stripNulls,
  extractJsonObject,
  tryParseAndValidate,
  DEFAULT_PROVIDER_MODELS,
  sanitizeModelName,
  generateStoryboard,
  callRawLLM,
  parseGeminiModelsList,
  parseOpenAIModelsList,
  parseAnthropicModelsList,
  parseOpenRouterModelsList
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

  it('ensures scene required has all expected generative storyboard fields', () => {
    const sceneSchema = OPENAI_STORYBOARD_SCHEMA.properties.scenes.items;
    expect(sceneSchema.required).toEqual([
      'narration',
      'visualIntent',
      'visualConcept',
      'visualElements',
      'motionIntent',
      'cameraIntent',
      'transitionIntent',
      'emphasis',
      'durationHint'
    ]);
  });

  it('ensures generative storyboard schema forbids legacy layout templates', () => {
    const sceneProps = OPENAI_STORYBOARD_SCHEMA.properties.scenes.items.properties as any;
    expect(sceneProps.layout).toBeUndefined();
    expect(sceneProps.visualData).toBeUndefined();
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

describe('Dynamic Model Resolution & BYOK Independence', () => {
  it('preserves user-selected and custom model names without hardcoded overrides', () => {
    // Gemini: any valid ID or preview model must not be reverted to 2.0-flash
    expect(sanitizeModelName('gemini', 'gemini-2.5-flash')).toBe('gemini-2.5-flash');
    expect(sanitizeModelName('gemini', 'gemini-3.0-flash-preview')).toBe('gemini-3.0-flash-preview');
    expect(sanitizeModelName('gemini', 'gemini-1.5-pro')).toBe('gemini-1.5-pro');
    expect(sanitizeModelName('gemini', 'models/gemini-2.5-pro')).toBe('gemini-2.5-pro');

    // Groq: custom or legacy IDs must be preserved as selected
    expect(sanitizeModelName('groq', 'llama3-70b-8192')).toBe('llama3-70b-8192');
    expect(sanitizeModelName('groq', 'deepseek-r1-distill-llama-70b')).toBe('deepseek-r1-distill-llama-70b');

    // OpenAI: non-standard prefixes like chatgpt-4o-latest or fine-tuned models
    expect(sanitizeModelName('openai', 'chatgpt-4o-latest')).toBe('chatgpt-4o-latest');
    expect(sanitizeModelName('openai', 'ft:gpt-4o-mini:custom-org:version-1')).toBe('ft:gpt-4o-mini:custom-org:version-1');

    // Anthropic: real API model IDs preserved
    expect(sanitizeModelName('anthropic', 'claude-3-7-sonnet-20250219')).toBe('claude-3-7-sonnet-20250219');
    expect(sanitizeModelName('anthropic', 'claude-3-5-sonnet-20241022')).toBe('claude-3-5-sonnet-20241022');

    // OpenRouter: any provider route preserved
    expect(sanitizeModelName('openrouter', 'deepseek/deepseek-r1')).toBe('deepseek/deepseek-r1');
    expect(sanitizeModelName('openrouter', 'qwen/qwen-2.5-72b-instruct')).toBe('qwen/qwen-2.5-72b-instruct');
  });

  it('dynamically parses Gemini models supporting generateContent without version blacklisting', () => {
    const rawGemini = [
      { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-3.0-ultra', displayName: 'Gemini 3.0 Ultra', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/text-embedding-004', displayName: 'Embedding', supportedGenerationMethods: ['embedContent'] },
      { name: 'models/imagen-3.0-generate-002', displayName: 'Imagen 3', supportedGenerationMethods: ['generateImages'] }
    ];

    const parsed = parseGeminiModelsList(rawGemini);
    expect(parsed.some((m) => m.id === 'gemini-2.5-flash')).toBe(true);
    expect(parsed.some((m) => m.id === 'gemini-3.0-ultra')).toBe(true);
    expect(parsed.some((m) => m.id.includes('embedding'))).toBe(false);
    expect(parsed.some((m) => m.id.includes('imagen'))).toBe(false);
  });

  it('dynamically parses OpenAI models allowing chatgpt-4o-latest and fine-tunes', () => {
    const rawOpenAI = [
      { id: 'chatgpt-4o-latest' },
      { id: 'gpt-4o' },
      { id: 'ft:gpt-4o-mini:user:123' },
      { id: 'text-embedding-3-small' },
      { id: 'whisper-1' },
      { id: 'dall-e-3' }
    ];

    const parsed = parseOpenAIModelsList(rawOpenAI);
    expect(parsed.some((m) => m.id === 'chatgpt-4o-latest')).toBe(true);
    expect(parsed.some((m) => m.id === 'gpt-4o')).toBe(true);
    expect(parsed.some((m) => m.id === 'ft:gpt-4o-mini:user:123')).toBe(true);
    expect(parsed.some((m) => m.id === 'text-embedding-3-small')).toBe(false);
    expect(parsed.some((m) => m.id === 'whisper-1')).toBe(false);
  });

  it('dynamically parses Anthropic models directly from API format', () => {
    const rawAnthropic = [
      { id: 'claude-3-7-sonnet-20250219', display_name: 'Claude 3.7 Sonnet', type: 'model' },
      { id: 'claude-3-5-haiku-20241022', display_name: 'Claude 3.5 Haiku', type: 'model' }
    ];

    const parsed = parseAnthropicModelsList(rawAnthropic);
    expect(parsed.length).toBe(2);
    expect(parsed[0].id).toBe('claude-3-7-sonnet-20250219');
    expect(parsed[0].label).toBe('Claude 3.7 Sonnet');
    expect(parsed[0].isRecommended).toBe(true);
  });

  it('dynamically parses OpenRouter models without vendor prefix whitelisting', () => {
    const rawOpenRouter = [
      { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', description: 'Powerful OSS model' },
      { id: 'x-ai/grok-2', name: 'Grok 2', description: 'xAI flagship' },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', description: 'Reasoning model' }
    ];

    const parsed = parseOpenRouterModelsList(rawOpenRouter);
    expect(parsed.some((m) => m.id === 'qwen/qwen-2.5-72b-instruct')).toBe(true);
    expect(parsed.some((m) => m.id === 'x-ai/grok-2')).toBe(true);
    expect(parsed.some((m) => m.id === 'deepseek/deepseek-r1')).toBe(true);
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

  it('callRawLLM automatically falls back to gemini-2.0-flash if configured model returns 404', async () => {
    const urlsCalled: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      urlsCalled.push(String(url));
      if (String(url).includes('models/gemini-2.5-flash:generateContent')) {
        return {
          ok: false,
          status: 404,
          text: async () => 'models/gemini-2.5-flash is not found'
        } as any;
      }
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '<div class="airflow"></div>' }] } }]
        })
      } as any;
    });

    const res = await callRawLLM({
      provider: 'gemini',
      apiKey: 'test-key',
      model: 'gemini-2.5-flash',
      systemPrompt: 'System',
      userPrompt: 'User prompt'
    });

    expect(res).toBe('<div class="airflow"></div>');
    expect(urlsCalled.some((u) => u.includes('gemini-2.0-flash:generateContent'))).toBe(true);
  });
});

