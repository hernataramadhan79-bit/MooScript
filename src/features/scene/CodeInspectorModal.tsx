import React, { useState } from 'react';
import { useMooStore } from '../../store/useMooStore';
import { Sheet } from '../../components/ui/Sheet';
import { Button } from '../../components/ui/Button';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import {
  findForeignApis,
  foreignApiMessage,
  validateSceneCode
} from '../../engine/composition/validator';
import { extractLayersFromHtml } from '../../engine/composition/layers';
import type { SceneModule, Composition } from '../../types';
import { MooApiGuidePanel } from './MooApiGuidePanel';

interface CodeInspectorModalProps {
  beatId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

/** Starting point for a scene that has no code of its own yet. */
const STARTER_CODE = {
  html: '<div class="scene-box">\n  <h1 class="headline" data-moo-layer="headline">Judul Adegan</h1>\n</div>',
  css: '.scene-box {\n  width: 100%;\n  height: 100%;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}\n.headline {\n  font-size: 72px;\n  color: var(--moo-accent, #38bdf8);\n}',
  buildJs: 'shot.arrive(".headline", {\n  scale: 0.5,\n  opacity: 0,\n  dur: 0.8,\n  curve: "overshoot-out(1.7)"\n}, 0);'
};

function initialCode(scene: SceneModule | undefined): { html: string; css: string; buildJs: string } {
  if (!scene || (!scene.html?.trim() && !scene.buildJs?.trim())) return STARTER_CODE;
  return { html: scene.html || '', css: scene.css || '', buildJs: scene.buildJs || '' };
}

export const CodeInspectorModal: React.FC<CodeInspectorModalProps> = ({ beatId, isOpen, onClose }) => {
  const project = useMooStore((s) => s.project);
  const addToast = useMooStore((s) => s.addToast);

  // Find target scene module in composition
  const currentScene: SceneModule | undefined = project.composition?.scenes?.find(
    (s) => s.beatId === beatId
  );

  // The editor is mounted per scene and seeded once: background saves (audio finishing, AI work on
  // other shots) re-create composition objects and must never wipe code that is being typed.
  const [activeTab, setActiveTab] = useState<'html' | 'css' | 'js' | 'guide'>('html');
  const [htmlCode, setHtmlCode] = useState(() => initialCode(currentScene).html);
  const [cssCode, setCssCode] = useState(() => initialCode(currentScene).css);
  const [jsCode, setJsCode] = useState(() => initialCode(currentScene).buildJs);
  const [errors, setErrors] = useState<string[]>([]);

  const handleApplyChanges = async () => {
    const validation = validateSceneCode({ html: htmlCode, css: cssCode, buildJs: jsCode });
    if (!validation.valid) {
      setErrors(validation.errors);
      addToast('Perubahan memiliki error validasi determinisme/keamanan', 'error');
      return;
    }
    const unsupported = findForeignApis(jsCode);
    if (unsupported.length > 0) {
      setErrors(unsupported.map(foreignApiMessage));
      addToast('Kode belum memakai API MooScript; lihat petunjuk di atas atau tab Panduan API', 'error');
      return;
    }

    setErrors([]);

    const totalCompDur = project.scenes.reduce((acc, s) => acc + s.durationInSeconds, 0);
    const existingComp: Composition = project.composition || {
      id: `comp-${project.id}`,
      width: project.width || 1080,
      height: project.height || 1920,
      fps: project.fps || 30,
      duration: totalCompDur,
      globalCss: '',
      scenes: [],
      createdAt: Date.now()
    };

    const targetBeatId = beatId || 'default-beat';
    if (!project.scenes.some((s) => s.id === targetBeatId)) {
      addToast('Adegan ini sudah dihapus, perubahan kode tidak diterapkan.', 'warning');
      onClose();
      return;
    }
    const sceneDuration = project.scenes.find((s) => s.id === targetBeatId)?.durationInSeconds || 3;
    // Layer overrides and the scene palette are kept: they apply on top of whatever code runs.
    const updatedScene: SceneModule = {
      ...currentScene,
      id: currentScene?.id || targetBeatId,
      beatId: targetBeatId,
      duration: sceneDuration,
      html: htmlCode,
      css: cssCode,
      buildJs: jsCode,
      editableLayers: extractLayersFromHtml(htmlCode),
      status: 'ok',
      errors: undefined,
      version: (currentScene?.version || 1) + 1,
      userEdited: true
    };

    const existingIdx = existingComp.scenes.findIndex((s: SceneModule) => s.beatId === targetBeatId);
    const updatedScenes = [...existingComp.scenes];
    if (existingIdx >= 0) {
      updatedScenes[existingIdx] = updatedScene;
    } else {
      updatedScenes.push(updatedScene);
    }

    const updatedProject = {
      ...project,
      renderMode: 'composition' as const,
      composition: {
        ...existingComp,
        duration: existingComp.duration || totalCompDur,
        scenes: updatedScenes,
        updatedAt: Date.now()
      }
    };

    useMooStore.getState().setProject(updatedProject, { keepStale: true, preserveHistory: true });

    addToast('Perubahan kode mograph berhasil diterapkan!', 'success');
    onClose();
  };

  const tabs = [
    { value: 'html' as const, label: 'HTML Markup', icon: 'code' },
    { value: 'css' as const, label: 'CSS Styling', icon: 'css' },
    { value: 'js' as const, label: 'Animasi (shot)', icon: 'javascript' },
    { value: 'guide' as const, label: 'Panduan API', icon: 'menu_book' }
  ];

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Code Inspector: Mograph Editor"
      description="Edit langsung struktur DOM, style CSS, dan animasi scene ini. Animasi ditulis dengan API MooScript; lihat tab Panduan API."
      maxWidth="max-w-3xl"
    >
      <div className="flex flex-col gap-4">
        <SegmentedControl
          options={tabs}
          value={activeTab}
          onChange={(val) => setActiveTab(val)}
          size="sm"
        />

        {errors.length > 0 && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px] flex flex-col gap-1">
            {errors.map((err, i) => (
              <span key={i}>• {err}</span>
            ))}
          </div>
        )}

        {/* Code Editor Area */}
        <div className="rounded-xl border border-border bg-[#050508] p-1 font-mono text-[13px]">
          {activeTab === 'html' && (
            <textarea
              rows={12}
              value={htmlCode}
              onChange={(e) => setHtmlCode(e.target.value)}
              className="w-full h-72 bg-transparent p-3 text-emerald-400 focus:outline-none resize-none font-mono text-[13px] leading-relaxed"
              placeholder="<!-- Masukkan HTML scene... -->"
            />
          )}
          {activeTab === 'css' && (
            <textarea
              rows={12}
              value={cssCode}
              onChange={(e) => setCssCode(e.target.value)}
              className="w-full h-72 bg-transparent p-3 text-cyan-400 focus:outline-none resize-none font-mono text-[13px] leading-relaxed"
              placeholder="/* Masukkan CSS ter-scope scene... */"
            />
          )}
          {activeTab === 'js' && (
            <textarea
              rows={12}
              value={jsCode}
              onChange={(e) => setJsCode(e.target.value)}
              className="w-full h-72 bg-transparent p-3 text-amber-300 focus:outline-none resize-none font-mono text-[13px] leading-relaxed"
              placeholder="// Gerak di shot: shot.go / shot.arrive / shot.travel / shot.pin, atau helper ctx.* (lihat Panduan API)"
            />
          )}
          {activeTab === 'guide' && <MooApiGuidePanel />}
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" icon="check" onClick={handleApplyChanges}>
            Terapkan Perubahan
          </Button>
        </div>
      </div>
    </Sheet>
  );
};
