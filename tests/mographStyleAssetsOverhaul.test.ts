import { describe, it, expect, beforeEach } from 'vitest';
import {
  escapeLayerAttrSelector,
  sanitizeLayerId,
  compileOverridesCss,
  compilePaletteVars,
  compileScenePaletteCss,
  getLayerText,
  setLayerText
} from '../src/engine/composition/layers';
import { buildSceneCodegenPrompt } from '../src/engine/ai/director/motionLaws';
import { useMooStore } from '../src/store/useMooStore';
import type { SceneAssetAttachment, LayerOverride } from '../src/types';

describe('Mograph, Style Tab, Layer Color/Palette & Asset Overhaul Suite', () => {
  describe('1. Layer Attribute Selector & Color Cascading (Fixes #1.1)', () => {
    it('preserves spaces and valid characters in escapeLayerAttrSelector for layer IDs like "Main Card"', () => {
      expect(escapeLayerAttrSelector('Main Card')).toBe('Main Card');
      expect(escapeLayerAttrSelector('Ambient Glow')).toBe('Ambient Glow');
      expect(escapeLayerAttrSelector('hero-title_1')).toBe('hero-title_1');
    });

    it('sanitizes dangerous CSS injection payloads in escapeLayerAttrSelector', () => {
      const malicious = 'layer1"; } body { background: red; } /*';
      const escaped = escapeLayerAttrSelector(malicious);
      expect(escaped).not.toContain('"');
      expect(escaped).not.toContain(';');
      expect(escaped).not.toContain('{');
      expect(escaped).not.toContain('}');
      expect(escaped).toBe('layer1-----body---background--red------');
    });

    it('matches [data-moo-layer="Main Card"] in compileOverridesCss for layers with spaces', () => {
      const overrides: Record<string, LayerOverride> = {
        'Main Card': { x: 50, y: -20, scale: 1.2 }
      };
      const css = compileOverridesCss('scene-1', overrides);
      expect(css).toContain('#scene-1 [data-moo-layer="Main Card"]');
      expect(css).toContain('translate: 50px -20px');
      expect(css).toContain('scale: 1.2');
    });

    it('applies cascading color rules to element and child elements in compileOverridesCss', () => {
      const overrides: Record<string, LayerOverride> = {
        'Headline Text': { color: '#84cc16' }
      };
      const css = compileOverridesCss('scene-1', overrides);
      // Main selector color
      expect(css).toContain('color: #84cc16 !important');
      // Cascading for child elements
      expect(css).toContain('[data-moo-layer="Headline Text"] *');
      expect(css).toContain('color: #84cc16 !important;');
      // Cascading for SVG paths / shapes
      expect(css).toContain('fill: #84cc16 !important; stroke: #84cc16 !important;');
      expect(css).toContain('background-color: #84cc16 !important;');
    });

    it('supports new transform properties: zIndex, hidden, flipX, flipY, fontSizeScale, textAlign, borderRadius', () => {
      const overrides: Record<string, LayerOverride> = {
        'card-layer': {
          zIndex: 15,
          hidden: true,
          scale: 1.5,
          flipX: true,
          flipY: false,
          fontSizeScale: 1.25,
          textAlign: 'center',
          borderRadius: 16
        }
      };
      const css = compileOverridesCss('scene-1', overrides);
      expect(css).toContain('display: none !important');
      expect(css).toContain('scale: -1.5 1.5');
      expect(css).toContain('z-index: 15 !important');
      expect(css).toContain('font-size: calc(100% * 1.25) !important');
      expect(css).toContain('text-align: center !important');
      expect(css).toContain('border-radius: 16px !important');
      expect(css).toContain('position: relative;');
    });
  });

  describe('2. Scene Palette Compilation & Cascading (Fixes #1.2)', () => {
    it('compiles palette CSS variables string via compilePaletteVars(palette)', () => {
      const vars = compilePaletteVars({
        bg: '#09090b',
        primary: '#ffffff',
        accent: '#84cc16',
        text: '#f4f4f5'
      });
      expect(vars).toContain('--moo-bg: #09090b');
      expect(vars).toContain('--moo-primary: #ffffff');
      expect(vars).toContain('--moo-accent: #84cc16');
      expect(vars).toContain('--moo-text: #f4f4f5');
    });

    it('compiles scoped active styling cascade via compileScenePaletteCss or compilePaletteVars(domId, palette)', () => {
      const css = compileScenePaletteCss('scene-sc-1', {
        bg: '#09090b',
        accent: '#84cc16',
        primary: '#ffffff',
        text: '#f4f4f5'
      });
      expect(css).toContain('#scene-sc-1 {');
      expect(css).toContain('background-color: var(--moo-bg) !important;');
      expect(css).toContain('#scene-sc-1 .accent, #scene-sc-1 [class*="accent"]');
      expect(css).toContain('color: var(--moo-accent) !important;');
      expect(css).toContain('border-color: var(--moo-accent) !important;');
      expect(css).toContain('#scene-sc-1 [class*="primary"], #scene-sc-1 h1, #scene-sc-1 h2 { color: var(--moo-primary) !important; }');
      expect(css).toContain('#scene-sc-1 [class*="sub"], #scene-sc-1 [class*="narration"], #scene-sc-1 p { color: var(--moo-text) !important; }');

      // Also via dual-signature compilePaletteVars(domId, palette)
      const dualCss = compilePaletteVars('scene-sc-1', {
        bg: '#09090b',
        accent: '#84cc16'
      });
      expect(dualCss).toContain('#scene-sc-1 {');
      expect(dualCss).toContain('background-color: var(--moo-bg) !important;');
    });
  });

  describe('3. Text Layer Content Preservation (Fixes #5.3)', () => {
    it('preserves single child wrapper tag like <span class="accent"> when updating layer text', () => {
      const html = '<h1 data-moo-layer="headline"><span class="accent">Original Accent</span></h1>';
      const updated = setLayerText(html, 'headline', 'Updated Text');
      expect(updated).toBe('<h1 data-moo-layer="headline"><span class="accent">Updated Text</span></h1>');
    });

    it('updates plain text without wrappers normally', () => {
      const html = '<p data-moo-layer="narration">Original Narration</p>';
      const updated = setLayerText(html, 'narration', 'New Narration');
      expect(updated).toBe('<p data-moo-layer="narration">New Narration</p>');
    });
  });

  describe('4. Scene Asset Attachment & AI Director Prompt Integration (Fixes #4.1 - #4.3)', () => {
    beforeEach(() => {
      const store = useMooStore.getState();
      store.setProject({
        id: 'test-project',
        title: 'Test',
        scenes: [
          {
            id: 'scene-test-1',
            narrationText: 'Introduction scene',
            durationInSeconds: 3.5,
            wordTimestamps: []
          }
        ],
        theme: {
          bg: '#09090b',
          textHighlight: '#84cc16',
          fontFamily: 'Jakarta',
          captionStyle: 'boxed',
          showSubtitles: true
        },
        aspectRatio: '9:16'
      });
    });

    it('assigns, updates role, and removes asset from a scene beat in project store', () => {
      const store = useMooStore.getState();
      const attachment: SceneAssetAttachment = {
        assetId: 'asset-123',
        assetName: 'Company Logo.png',
        dataUrl: 'data:image/png;base64,iVBORw0KGgo...',
        role: 'logo',
        motionGuidance: 'Pop in top right corner'
      };

      // 1. Assign
      store.assignAssetToScene('scene-test-1', attachment);
      let scene = useMooStore.getState().project.scenes.find((s) => s.id === 'scene-test-1');
      expect(scene?.assignedAssets).toHaveLength(1);
      expect(scene?.assignedAssets?.[0].assetId).toBe('asset-123');
      expect(scene?.assignedAssets?.[0].role).toBe('logo');

      // 2. Update role & guidance
      store.updateSceneAssetRole('scene-test-1', 'asset-123', 'product', 'Float in center');
      scene = useMooStore.getState().project.scenes.find((s) => s.id === 'scene-test-1');
      expect(scene?.assignedAssets?.[0].role).toBe('product');
      expect(scene?.assignedAssets?.[0].motionGuidance).toBe('Float in center');

      // 3. Remove
      store.removeAssetFromSceneBeat('scene-test-1', 'asset-123');
      scene = useMooStore.getState().project.scenes.find((s) => s.id === 'scene-test-1');
      expect(scene?.assignedAssets).toHaveLength(0);
    });

    it('includes required integration instructions in buildSceneCodegenPrompt when assets are attached', () => {
      const attachment: SceneAssetAttachment = {
        assetId: 'logo-abc',
        assetName: 'BrandLogo.png',
        dataUrl: 'data:image/png;base64,xyz123',
        role: 'logo',
        motionGuidance: 'Animasikan memantul di tengah'
      };

      const prompt = buildSceneCodegenPrompt({
        beatIndex: 0,
        totalBeats: 3,
        narration: 'MooScript adalah solusi video mograph.',
        visualIntent: 'Tampilkan identitas brand dan teknologi canggih',
        durationSec: 3.5,
        aspectRatio: '9:16',
        styleBrief: {
          palette: { bg: '#09090b', primary: '#ffffff', accent: '#84cc16', text: '#f4f4f5' },
          fontDisplay: 'Plus Jakarta Sans',
          motionSignature: 'Kinetic',
          backgroundLanguage: 'Dark Minimal'
        },
        assignedAssets: [attachment]
      });

      expect(prompt).toContain('=== ASET MEDIA DILAMPIRKAN PENGGUNA (INTEGRASI WAJIB) ===');
      expect(prompt).toContain('BrandLogo.png');
      expect(prompt).toContain('Peran: logo');
      expect(prompt).toContain('Arahan Gerak: Animasikan memantul di tengah');
      expect(prompt).toContain('data-moo-layer="asset-logo-abc"');
      expect(prompt).toContain('src="data:image/png;base64,xyz123"');
    });
  });

  describe('5. Asset Insertion Animation and Frame Presets (Fixes #4.4)', () => {
    it('embeds chosen animation preset and frame preset when insertAssetIntoScene is called', () => {
      const store = useMooStore.getState();
      const asset = {
        id: 'asset-test-1',
        projectId: 'test-project',
        name: 'ProductPhoto.png',
        mimeType: 'image/png',
        dataUrl: 'data:image/png;base64,prod_data',
        size: 1024,
        createdAt: Date.now()
      };

      store.insertAssetIntoScene(asset, 'scene-test-1', {
        animationPreset: 'slide',
        framePreset: 'bento'
      });

      const compScene = useMooStore.getState().project.composition?.scenes.find(
        (s) => s.beatId === 'scene-test-1'
      );

      expect(compScene).toBeDefined();
      expect(compScene?.html).toContain('data:image/png;base64,prod_data');
      // Frame preset check (bento card background and border radius)
      expect(compScene?.html).toContain('border-radius:24px');
      expect(compScene?.html).toContain('background:rgba(24,24,27,0.85)');
      // Animation preset check (slide up)
      expect(compScene?.buildJs).toContain('y: 100');
      expect(compScene?.buildJs).toContain('power3.out');
    });
  });
});
