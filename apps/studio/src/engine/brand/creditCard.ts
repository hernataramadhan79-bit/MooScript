import type { GeneratedScene, MooProject, Scene } from '../../types';
import { extractLayersFromHtml } from '../composition/layers';
import { syncComposition } from '../composition/sync';
import { t } from '../../i18n';

/**
 * The short "made with MooScript" card at the end of an exported video. It exists only in the
 * copy handed to the exporter, so it never appears on the timeline or in the saved project.
 */

export const CREDIT_SCENE_ID = 'moo-credit';
export const CREDIT_SECONDS = 1.4;
export const MOOSCRIPT_SITE = 'mooscript.web.id';

/** On by default, except for projects that carry the creator's own brand. */
export function creditCardEnabled(project: Pick<MooProject, 'brand' | 'exportSettings'>): boolean {
  return project.exportSettings?.creditCard ?? !project.brand;
}

function compileCreditCard(): GeneratedScene {
  const html = `<div class="moo-credit-stage">
  <div class="moo-camera" data-moo-layer="camera">
    <p class="moo-credit-kicker">${t('Dibuat dengan')}</p>
    <h1 class="moo-credit-name">MooScript</h1>
    <p class="moo-credit-site">${MOOSCRIPT_SITE}</p>
  </div>
</div>`;
  const css = `.moo-credit-stage { position: relative; width: 100%; height: 100%; overflow: hidden; background: #84cc16; color: #09090b; font-family: 'Plus Jakarta Sans', sans-serif; }
.moo-credit-stage > .moo-camera { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; padding: 8%; text-align: center; }
.moo-credit-kicker { margin: 0; font-size: 46px; font-weight: 700; }
.moo-credit-name { margin: 0; font-size: 156px; font-weight: 800; line-height: 1; letter-spacing: -0.04em; }
.moo-credit-site { margin: 12px 0 0; font-family: 'JetBrains Mono', monospace; font-size: 38px; font-weight: 700; }`;
  const buildJs = `shot.travel('.moo-credit-name', { scale: 0.86, opacity: 0 }, { scale: 1, opacity: 1, dur: 0.4, curve: 'overshoot-out(1.5)' }, 0);
shot.travel('.moo-credit-kicker, .moo-credit-site', { y: 18, opacity: 0 }, { y: 0, opacity: 1, dur: 0.35, curve: 'strong-out' }, 0.12);`;
  return {
    id: CREDIT_SCENE_ID,
    beatId: CREDIT_SCENE_ID,
    duration: CREDIT_SECONDS,
    html,
    css,
    buildJs,
    editableLayers: extractLayersFromHtml(html),
    generatorVersion: 'credit-card',
    status: 'ok',
    version: 1,
    userEdited: false
  };
}

/** The project as it should be exported. A transparent export is footage for another edit: no card. */
export function withCreditCard(project: MooProject, options?: { transparent?: boolean }): MooProject {
  if (options?.transparent || !creditCardEnabled(project) || project.scenes.length === 0) return project;
  const synced = project.composition ? project : syncComposition(project);
  const scene: Scene = {
    id: CREDIT_SCENE_ID,
    narrationText: '',
    text: '',
    durationInSeconds: CREDIT_SECONDS,
    durationLocked: true,
    wordTimestamps: [],
    visualIntent: 'MooScript',
    hideSubtitles: true,
    transition: 'cut'
  };
  return syncComposition({
    ...synced,
    scenes: [...synced.scenes, scene],
    composition: { ...synced.composition!, scenes: [...synced.composition!.scenes, compileCreditCard()] }
  });
}

/** Length of the card in this export; the soundtrack is not expected to cover it. */
export function creditSeconds(project: Pick<MooProject, 'scenes'>): number {
  return project.scenes.some((s) => s.id === CREDIT_SCENE_ID) ? CREDIT_SECONDS : 0;
}

/** Ready-to-post text for sharing a finished video. */
export function shareCaption(title: string): string {
  return `${title.trim()}\n\n${t('Dibuat dengan MooScript')}: https://${MOOSCRIPT_SITE}`;
}
