import type { BrandKit, GeneratedScene, MooProject, ProjectBrand, Scene, WatermarkPosition } from '../../types';
import { assetRef } from '../composition/assetRefs';
import { extractLayersFromHtml } from '../composition/layers';
import { syncComposition } from '../composition/sync';

export const BRAND_LOGO_ASSET_ID = 'brand-logo';
export const BRAND_FONT_ID = 'brand-font';
const INTRO_ID = 'brand-intro';
const OUTRO_ID = 'brand-outro';
const CARD_SECONDS = 2.2;

export const DEFAULT_BRAND_KIT: BrandKit = {
  name: '',
  palette: { bg: '#0b1020', primary: '#f8fafc', accent: '#f59e0b', text: '#f8fafc' },
  watermark: { enabled: true, position: 'bottom-right', opacity: 0.85, size: 14 },
  intro: false,
  outro: { enabled: false, text: 'Ikuti untuk konten berikutnya' }
};

function escapeHtml(raw: string): string {
  return (raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** The logo / name card that opens or closes the film. */
export function compileBrandCard(kind: 'intro' | 'outro', id: string, brand: ProjectBrand, text: string, duration: number): GeneratedScene {
  const sid = `bc_${kind}`;
  const logo = brand.logoAssetId
    ? `\n    <img data-moo-layer="Logo" class="${sid}-logo" src="${assetRef(brand.logoAssetId)}" alt="${escapeHtml(brand.name || 'Logo')}" />`
    : '';
  const title = text.trim() ? `\n    <h1 data-moo-layer="Headline" class="${sid}-title">${escapeHtml(text.trim())}</h1>` : '';
  const html = `<div class="${sid}-stage">
  <div class="moo-camera" data-moo-layer="camera">${logo}${title}
  </div>
</div>`;
  const css = `.${sid}-stage { position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--moo-bg, #09090b); }
.${sid}-stage > .moo-camera { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 48px; padding: 8%; }
.${sid}-logo { max-width: 46%; max-height: 34%; object-fit: contain; }
.${sid}-title { margin: 0; max-width: 88%; text-align: center; font-family: var(--moo-font-display, sans-serif); font-weight: 800; font-size: 72px; line-height: 1.1; color: var(--moo-text, #ffffff); }`;
  const steps = [
    `ctx.camera({ move: '${kind === 'intro' ? 'pull' : 'push'}' });`,
    logo ? `shot.travel('.${sid}-logo', { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, dur: 0.7, curve: 'overshoot-out(1.6)' }, 0.05);` : '',
    title ? `shot.travel('.${sid}-title', { y: 40, opacity: 0 }, { y: 0, opacity: 1, dur: 0.6, curve: 'strong-out' }, ${logo ? 0.35 : 0.05});` : ''
  ].filter(Boolean);
  return {
    id,
    beatId: id,
    duration,
    html,
    css,
    buildJs: steps.join('\n'),
    editableLayers: extractLayersFromHtml(html),
    generatorVersion: 'brand-card',
    status: 'ok',
    version: 1,
    userEdited: false
  };
}

function brandCardScene(id: string, kind: 'intro' | 'outro'): Scene {
  return {
    id,
    narrationText: '',
    text: '',
    durationInSeconds: CARD_SECONDS,
    durationLocked: true,
    wordTimestamps: [],
    visualIntent: kind === 'intro' ? 'Pembuka brand' : 'Penutup brand',
    brandCard: kind,
    hideSubtitles: true,
    transition: 'flow'
  };
}

/** The project's intro / outro cards placed again from its brand (or removed when switched off). */
export function withBrandCards(project: MooProject): MooProject {
  const brand = project.brand;
  const core = project.scenes.filter((s) => !s.brandCard);
  const modules = (project.composition?.scenes || []).filter((m) => m.beatId !== INTRO_ID && m.beatId !== OUTRO_ID);
  const scenes: Scene[] = [];
  const extra: GeneratedScene[] = [];
  if (brand?.intro && core.length > 0) {
    scenes.push(brandCardScene(INTRO_ID, 'intro'));
    extra.push(compileBrandCard('intro', INTRO_ID, brand, brand.name, CARD_SECONDS));
  }
  scenes.push(...core);
  if (brand?.outro.enabled && core.length > 0) {
    scenes.push(brandCardScene(OUTRO_ID, 'outro'));
    extra.push(compileBrandCard('outro', OUTRO_ID, brand, brand.outro.text || brand.name, CARD_SECONDS));
  }
  const synced = syncComposition({
    ...project,
    scenes,
    composition: project.composition ? { ...project.composition, scenes: [...modules, ...extra] } : undefined
  });
  return synced;
}

/**
 * The project in the brand's look: palette (also kept when the AI writes a new storyboard), logo
 * watermark, typeface and the intro / outro cards. The kit is copied in, so the project exports
 * and backs up on its own.
 */
export function applyBrandKit(project: MooProject, kit: BrandKit): MooProject {
  const assetData = { ...(project.assetData || {}) };
  if (kit.logoDataUrl) assetData[BRAND_LOGO_ASSET_ID] = kit.logoDataUrl;
  else delete assetData[BRAND_LOGO_ASSET_ID];

  const fonts = (project.customFonts || []).filter((f) => f.id !== BRAND_FONT_ID);
  if (kit.font) fonts.push({ ...kit.font, id: BRAND_FONT_ID });

  const brand: ProjectBrand = {
    name: kit.name,
    palette: { ...kit.palette },
    logoAssetId: kit.logoDataUrl ? BRAND_LOGO_ASSET_ID : undefined,
    fontFamily: kit.font?.family,
    watermark: { ...kit.watermark },
    intro: kit.intro,
    outro: { ...kit.outro }
  };

  const branded: MooProject = {
    ...project,
    brand,
    assetData,
    customFonts: fonts,
    theme: { ...project.theme, bg: kit.palette.bg, textHighlight: kit.palette.accent, textPrimary: kit.palette.text },
    styleBrief: {
      ...(project.styleBrief || { adjectives: [], fontDisplay: '', fontBody: '', backgroundLanguage: '', motionSignature: '' }),
      palette: { ...kit.palette, source: 'brand-kit' }
    }
  };
  return withBrandCards(branded);
}

/** Takes the brand off a project: its watermark, cards, logo and typeface (the palette stays). */
export function removeBrand(project: MooProject): MooProject {
  const assetData = { ...(project.assetData || {}) };
  delete assetData[BRAND_LOGO_ASSET_ID];
  return withBrandCards({
    ...project,
    brand: undefined,
    assetData,
    customFonts: (project.customFonts || []).filter((f) => f.id !== BRAND_FONT_ID)
  });
}

const CORNER: Record<WatermarkPosition, string> = {
  'top-left': 'top:3.5%;left:4%;',
  'top-right': 'top:3.5%;right:4%;',
  'bottom-left': 'bottom:3.5%;left:4%;',
  'bottom-right': 'bottom:3.5%;right:4%;'
};

/** Logo watermark markup that sits above every shot (empty when there is none). */
export function watermarkHtml(project: Pick<MooProject, 'brand' | 'assetData'>): string {
  const brand = project.brand;
  if (!brand?.watermark.enabled || !brand.logoAssetId || !project.assetData?.[brand.logoAssetId]) return '';
  const w = brand.watermark;
  const size = Math.max(4, Math.min(40, w.size || 14));
  const opacity = Math.max(0.1, Math.min(1, w.opacity ?? 0.85));
  return `<img id="moo-watermark" src="${assetRef(brand.logoAssetId)}" alt="" style="position:absolute;${CORNER[w.position] || CORNER['bottom-right']}width:${size}%;height:auto;opacity:${opacity};z-index:60;pointer-events:none;" />`;
}
