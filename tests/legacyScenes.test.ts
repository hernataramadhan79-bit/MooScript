import { describe, expect, it } from 'vitest';
import { flagScenesNeedingRepair, repairStateFor, sceneHasRenderableCode } from '../src/engine/composition/legacyScenes';
import { normalizeProject } from '../src/db/mooDb';
import { parseProjectBackup, serializeProjectBackup } from '../src/db/projectBackup';
import { buildCompositionDocument } from '../src/engine/composition/buildDocument';
import { buildSceneRepairPrompt } from '../src/engine/ai/director/motionLaws';
import { DEMO_PROJECT, DEMO_PROJECT_MOOTWEEN } from './fixtures/demoProject';
import type { GeneratedScene, MooProject } from '../src/types';

const LEGACY_JS = `gsap.registerPlugin(ScrollTrigger);
tl.from(root.querySelector(".sc1-badge"), { y: -30, opacity: 0, duration: 0.6 });`;

function withLegacyScene(): MooProject {
  const project = structuredClone(DEMO_PROJECT_MOOTWEEN);
  project.composition!.scenes[0].buildJs = LEGACY_JS;
  return project;
}

describe('legacy scenes that need repair', () => {
  it('flags scenes that are not written in the MooScript API and never touches their code', () => {
    const flagged = flagScenesNeedingRepair(withLegacyScene());
    const scene = flagged.composition!.scenes[0];
    expect(scene.status).toBe('needs-repair');
    expect(scene.buildJs).toBe(LEGACY_JS);
    expect(scene.errors).toEqual([
      expect.stringMatching(/^Bukan API MooScript: tl — .*tl.from → shot.arrive/),
      expect.stringMatching(/^Bukan API MooScript: gsap — /),
      expect.stringMatching(/^Bukan API MooScript: plugin — /),
      expect.stringMatching(/^Bukan API MooScript: duration — ganti duration → dur/)
    ]);
    expect(flagged.composition!.scenes.slice(1).map((s) => s.status)).toEqual(['ok', 'ok']);
  });

  it('leaves projects written in the MooScript API untouched', () => {
    const project = structuredClone(DEMO_PROJECT_MOOTWEEN);
    expect(flagScenesNeedingRepair(project)).toBe(project);
  });

  it('flags every scene of the demo that past builds stored in GSAP style', () => {
    const flagged = flagScenesNeedingRepair(structuredClone(DEMO_PROJECT));
    expect(flagged.composition!.scenes.map((s) => s.status)).toEqual(['needs-repair', 'needs-repair', 'needs-repair']);
  });

  it('clears the flag once the code is in the MooScript API, and ignores pending or error scenes', () => {
    const base = DEMO_PROJECT_MOOTWEEN.composition!.scenes[0];
    const repaired: GeneratedScene = { ...base, status: 'needs-repair', errors: ['old'] };
    expect(repairStateFor(repaired)).toEqual({ status: 'ok', errors: undefined });
    expect(repairStateFor({ ...base, status: 'error', buildJs: LEGACY_JS })).toBeNull();
    expect(repairStateFor({ ...base, status: 'pending', buildJs: LEGACY_JS })).toBeNull();
  });

  it('flags on load and on backup import', () => {
    expect(normalizeProject(withLegacyScene()).composition!.scenes[0].status).toBe('needs-repair');
    const imported = parseProjectBackup(serializeProjectBackup(withLegacyScene()));
    expect(imported.composition!.scenes[0].status).toBe('needs-repair');
    expect(imported.composition!.scenes[0].buildJs).toBe(LEGACY_JS);
  });

  it('keeps rendering the scene with its own code', () => {
    const project = flagScenesNeedingRepair(withLegacyScene());
    expect(sceneHasRenderableCode(project.composition!.scenes[0])).toBe(true);
    const doc = buildCompositionDocument(project);
    expect(doc).toContain('gsap.registerPlugin(ScrollTrigger)');
    expect(doc).not.toContain('data-moo-placeholder');
  });

  it('names each API and its replacement in the repair prompt', () => {
    const scene = flagScenesNeedingRepair(withLegacyScene()).composition!.scenes[0];
    const prompt = buildSceneRepairPrompt({
      originalCode: { html: scene.html, css: scene.css, buildJs: scene.buildJs },
      errors: scene.errors || [],
      visualIntent: 'Badge muncul',
      durationSec: 3
    });
    expect(prompt).toContain('Bukan API MooScript: plugin');
    expect(prompt).toContain('pertahankan desain, layout, warna, dan timing aslinya');
    expect(prompt).toContain(LEGACY_JS);
  });
});
