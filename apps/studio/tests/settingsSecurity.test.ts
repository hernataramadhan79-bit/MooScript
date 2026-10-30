import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { db, type AssetRecord } from '../src/db/mooDb';
import { useMooStore } from '../src/store/useMooStore';
import { compileOverridesCss, compilePaletteVars } from '../src/engine/composition/layers';
import { DEFAULT_SETTINGS } from '../src/store/slices/settingsSlice';

class MockStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

describe('Agent A: Security, DB Integrity & Sanitasi', () => {
  let mockSessionStorage: MockStorage;

  beforeEach(async () => {
    vi.restoreAllMocks();
    mockSessionStorage = new MockStorage();
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true,
      configurable: true
    });

    await db.settings.clear();
    await db.assets.clear();

    useMooStore.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        apiKeys: { ...DEFAULT_SETTINGS.apiKeys }
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. SEC-002: Settings API Key Storage Lifecycle (session vs persistent)', () => {
    it('stores keys in sessionStorage and excludes keys from IndexedDB when apiKeyStorage is session', async () => {
      const setItemSpy = vi.spyOn(mockSessionStorage, 'setItem');

      await useMooStore.getState().updateSettings({
        apiKeyStorage: 'session',
        apiKeys: {
          ...DEFAULT_SETTINGS.apiKeys,
          gemini: 'test-gemini-session-key',
          openai: 'test-openai-session-key'
        }
      });

      expect(setItemSpy).toHaveBeenCalledWith(
        'mooscript_session_keys',
        expect.stringContaining('test-gemini-session-key')
      );

      const sessionRaw = mockSessionStorage.getItem('mooscript_session_keys');
      expect(sessionRaw).not.toBeNull();
      const parsed = JSON.parse(sessionRaw!);
      expect(parsed.gemini).toBe('test-gemini-session-key');
      expect(parsed.openai).toBe('test-openai-session-key');

      expect(useMooStore.getState().settings.apiKeys.gemini).toBe('test-gemini-session-key');

      const persisted = await db.settings.get('current');
      expect(persisted).toBeDefined();
      expect(persisted?.data.apiKeyStorage).toBe('session');
      expect(persisted?.data.apiKeys).toEqual({});
    });

    it('stores key in sessionStorage when updateApiKey is called in session mode', async () => {
      await useMooStore.getState().updateSettings({ apiKeyStorage: 'session' });

      const setItemSpy = vi.spyOn(mockSessionStorage, 'setItem');

      await useMooStore.getState().updateApiKey('groq', 'groq-session-key-456');

      expect(setItemSpy).toHaveBeenCalledWith(
        'mooscript_session_keys',
        expect.stringContaining('groq-session-key-456')
      );

      const sessionRaw = mockSessionStorage.getItem('mooscript_session_keys');
      const parsed = JSON.parse(sessionRaw!);
      expect(parsed.groq).toBe('groq-session-key-456');

      const persisted = await db.settings.get('current');
      expect(persisted?.data.apiKeys).toEqual({});
    });

    it('removes sessionStorage keys and persists to IndexedDB when switching to persistent mode via updateSettings', async () => {
      await useMooStore.getState().updateSettings({
        apiKeyStorage: 'session',
        apiKeys: {
          ...DEFAULT_SETTINGS.apiKeys,
          anthropic: 'claude-secret-key-789'
        }
      });
      expect(mockSessionStorage.getItem('mooscript_session_keys')).not.toBeNull();

      const removeItemSpy = vi.spyOn(mockSessionStorage, 'removeItem');

      await useMooStore.getState().updateSettings({
        apiKeyStorage: 'persistent'
      });

      expect(removeItemSpy).toHaveBeenCalledWith('mooscript_session_keys');
      expect(mockSessionStorage.getItem('mooscript_session_keys')).toBeNull();

      const persisted = await db.settings.get('current');
      expect(persisted?.data.apiKeyStorage).toBe('persistent');
      expect(persisted?.data.apiKeys.anthropic).toBe('claude-secret-key-789');
    });

    it('removes sessionStorage keys when updateApiKey is called in persistent mode', async () => {
      await useMooStore.getState().updateSettings({ apiKeyStorage: 'persistent' });
      mockSessionStorage.setItem('mooscript_session_keys', JSON.stringify({ stale: 'stale-key' }));

      const removeItemSpy = vi.spyOn(mockSessionStorage, 'removeItem');

      await useMooStore.getState().updateApiKey('elevenlabs', 'eleven-persistent-key-999');

      expect(removeItemSpy).toHaveBeenCalledWith('mooscript_session_keys');
      expect(mockSessionStorage.getItem('mooscript_session_keys')).toBeNull();

      const persisted = await db.settings.get('current');
      expect(persisted?.data.apiKeys.elevenlabs).toBe('eleven-persistent-key-999');
    });

    it('initStore cleans up leftover sessionStorage keys when stored mode is persistent', async () => {
      mockSessionStorage.setItem('mooscript_session_keys', JSON.stringify({ leaked: 'should-be-removed' }));

      await db.settings.put({
        id: 'current',
        data: {
          ...DEFAULT_SETTINGS,
          apiKeyStorage: 'persistent',
          apiKeys: { ...DEFAULT_SETTINGS.apiKeys, openai: 'db-openai-key' }
        }
      });

      const removeItemSpy = vi.spyOn(mockSessionStorage, 'removeItem');

      await useMooStore.getState().initStore();

      expect(removeItemSpy).toHaveBeenCalledWith('mooscript_session_keys');
      expect(mockSessionStorage.getItem('mooscript_session_keys')).toBeNull();
      expect(useMooStore.getState().settings.apiKeys.openai).toBe('db-openai-key');
    });

    it('initStore restores keys from sessionStorage when stored mode is session', async () => {
      mockSessionStorage.setItem(
        'mooscript_session_keys',
        JSON.stringify({ gemini: 'restored-session-gemini' })
      );

      await db.settings.put({
        id: 'current',
        data: {
          ...DEFAULT_SETTINGS,
          apiKeyStorage: 'session',
          apiKeys: {} as any
        }
      });

      await useMooStore.getState().initStore();

      expect(useMooStore.getState().settings.apiKeys.gemini).toBe('restored-session-gemini');
    });
  });

  describe('2. DATA-001: Dexie db.assets Integrity & Type-Safety', () => {
    it('allows storing, reading, and querying AssetRecord in db.assets type-safely', async () => {
      const mockBlob = new Blob(['sample-image-content'], { type: 'image/png' });
      const assetRecord: AssetRecord = {
        id: 'asset-101',
        projectId: 'project-xyz',
        name: 'intro-logo.png',
        mimeType: 'image/png',
        blob: mockBlob,
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        createdAt: 1712345678000
      };

      await db.assets.put(assetRecord);

      const retrieved = await db.assets.get('asset-101');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('asset-101');
      expect(retrieved?.projectId).toBe('project-xyz');
      expect(retrieved?.name).toBe('intro-logo.png');
      expect(retrieved?.mimeType).toBe('image/png');
      expect(retrieved?.dataUrl).toBe(assetRecord.dataUrl);
      expect(retrieved?.createdAt).toBe(1712345678000);
      expect(retrieved?.blob).toBeDefined();
      expect(retrieved?.blob?.size).toBe(mockBlob.size);
    });

    it('supports indexed queries by projectId and records deletion', async () => {
      const asset1: AssetRecord = {
        id: 'asset-1',
        projectId: 'proj-alpha',
        name: 'bg.jpg',
        mimeType: 'image/jpeg',
        createdAt: 1000
      };
      const asset2: AssetRecord = {
        id: 'asset-2',
        projectId: 'proj-alpha',
        name: 'overlay.png',
        mimeType: 'image/png',
        createdAt: 2000
      };
      const asset3: AssetRecord = {
        id: 'asset-3',
        projectId: 'proj-beta',
        name: 'other.svg',
        mimeType: 'image/svg+xml',
        createdAt: 3000
      };

      await db.assets.bulkPut([asset1, asset2, asset3]);

      const alphaAssets = await db.assets.where('projectId').equals('proj-alpha').toArray();
      expect(alphaAssets).toHaveLength(2);
      expect(alphaAssets.map((a) => a.id).sort()).toEqual(['asset-1', 'asset-2']);

      await db.assets.delete('asset-1');
      const remainingAlpha = await db.assets.where('projectId').equals('proj-alpha').toArray();
      expect(remainingAlpha).toHaveLength(1);
      expect(remainingAlpha[0].id).toBe('asset-2');

      await db.assets.clear();
      const count = await db.assets.count();
      expect(count).toBe(0);
    });
  });

  describe('3. SEC-003: CSS Sanitization & Injection Prevention in layers.ts', () => {
    it('sanitizes sceneDomId and layerId to prevent CSS rule breakout and HTML injection in compileOverridesCss', () => {
      const maliciousSceneId = 'scene-1</style><script>alert("xss")</script>';
      const maliciousLayerId = 'layer1"; } body { background: red; } /*';

      const css = compileOverridesCss(maliciousSceneId, {
        [maliciousLayerId]: { scale: 1.5 }
      });

      expect(css).not.toContain('<script>');
      expect(css).not.toContain('</style>');
      expect(css).not.toContain('<');
      expect(css).not.toContain('>');
      expect(css).not.toContain('body { background: red; }');
      expect(css).not.toContain('alert(');

      expect(css).toContain('#scene-1--style--script-alert--xss----script-');
      expect(css).toContain('[data-moo-layer="layer1-----body---background--red------"]');
      expect(css).toContain('scale: 1.5');
    });

    it('strictly validates colors in compileOverridesCss and rejects injection payloads', () => {
      const dangerousColors = [
        'red; } </style><script>alert(1)</script>',
        '#fff; background: red',
        'rgba(0,0,0,1); display: none',
        'javascript:alert(1)',
        'expression(alert(1))',
        'url("https://evil.com/leak")',
        '/* comment */ #00ff00',
        '#xyz',
        'red',
        'blue !important'
      ];

      for (const badColor of dangerousColors) {
        const css = compileOverridesCss('scene-test', {
          layerA: { color: badColor }
        });
        expect(css).not.toContain(badColor);
        expect(css).not.toContain('color:');
        expect(css).not.toContain('fill:');
      }
    });

    it('accepts valid hex, rgb, rgba, hsl, and hsla color formats in compileOverridesCss', () => {
      const validColors = [
        '#fff',
        '#123456',
        '#12345678',
        'rgb(255, 0, 0)',
        'rgba(0, 128, 255, 0.5)',
        'hsl(120, 100%, 50%)',
        'hsla(200, 50%, 40%, 0.9)'
      ];

      for (const goodColor of validColors) {
        const css = compileOverridesCss('scene-test', {
          layerA: { color: goodColor }
        });
        expect(css).toContain(`color: ${goodColor} !important`);
        expect(css).toContain(`fill: ${goodColor} !important`);
      }
    });

    it('ignores non-finite and string injection in numeric transform properties', () => {
      const css = compileOverridesCss('scene-test', {
        layerA: {
          x: '100px; evil-prop: 1' as any,
          y: NaN as any,
          scale: Infinity as any,
          rotation: undefined,
          opacity: '0.5; } evil {' as any
        }
      });

      expect(css).toBe('');

      const validCss = compileOverridesCss('scene-test', {
        layerA: {
          x: 20,
          y: -15,
          scale: 1.2,
          rotation: 45,
          opacity: 0.75
        }
      });
      expect(validCss).toContain('translate: 20px -15px');
      expect(validCss).toContain('scale: 1.2');
      expect(validCss).toContain('rotate: 45deg');
      expect(validCss).toContain('filter: opacity(0.75)');
    });

    it('rejects injection strings and unsafe tags in compilePaletteVars', () => {
      const dangerousPalette = {
        bg: 'red; } </style><script>alert("xss")</script>',
        primary: '#fff; --moo-injected: evil',
        accent: 'rgba(0,0,0,1); display: none',
        text: 'url("javascript:alert(1)")'
      };

      const vars = compilePaletteVars(dangerousPalette);
      expect(vars).toBe('');
    });

    it('compiles safe hex, rgb, rgba, hsl, and hsla colors into CSS variables in compilePaletteVars', () => {
      const safePalette = {
        bg: '#09090b',
        primary: 'rgb(244, 244, 245)',
        accent: 'rgba(132, 204, 22, 0.8)',
        text: 'hsla(0, 0%, 100%, 0.9)'
      };

      const vars = compilePaletteVars(safePalette);
      expect(vars).toContain('--moo-bg: #09090b');
      expect(vars).toContain('--moo-primary: rgb(244, 244, 245)');
      expect(vars).toContain('--moo-accent: rgba(132, 204, 22, 0.8)');
      expect(vars).toContain('--moo-text: hsla(0, 0%, 100%, 0.9)');
    });

    it('handles undefined or empty overrides and palette gracefully without throwing', () => {
      expect(compileOverridesCss('scene-1', undefined)).toBe('');
      expect(compileOverridesCss('scene-1', {})).toBe('');
      expect(compilePaletteVars(undefined)).toBe('');
      expect(compilePaletteVars({})).toBe('');
    });
  });
});
