import { describe, it, expect, beforeEach } from 'vitest';
import { useMooStore } from '../src/store/useMooStore';
import {
  BUILTIN_THEMES,
  resolveTheme,
  migrateLegacyScene,
  type MotionNode,
  type ThemeTokens
} from '../src/types';
import { runWorkerRenderPipeline } from '../src/engine/export/mp4Exporter';
import { normalizeMotionNode } from '../src/engine/ai/llm';
import { normalizeProject } from '../src/db/mooDb';

describe('Atomic Scene Graph & Theme Studio (Phases 1-5)', () => {
  beforeEach(() => {
    useMooStore.setState({
      project: {
        id: 'atomic-test-proj',
        title: 'Atomic Test',
        aspectRatio: '9:16',
        fps: 30,
        width: 1080,
        height: 1920,
        theme: {
          bg: '#0d0d0e',
          textPrimary: '#f4f4f5',
          textHighlight: '#84cc16',
          fontFamily: 'Jakarta',
          captionStyle: 'boxed',
          captionPosition: 'center'
        },
        themeTokens: BUILTIN_THEMES[0],
        scenes: [
          {
            id: 'scene-1',
            layout: 'KINETIC_QUOTE',
            narrationText: 'Hello world narration',
            text: 'Hello world text',
            durationInSeconds: 3.0,
            background: { type: 'dot_grid' },
            nodes: [
              {
                id: 'node-root-1',
                type: 'container',
                transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 },
                style: { fillToken: 'surface' },
                animation: { enter: { type: 'spring_pop', startAtSecond: 0, duration: 0.6 } },
                children: [
                  {
                    id: 'node-child-1',
                    type: 'text',
                    content: 'Child text element',
                    transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 },
                    style: { fillToken: 'text', fontSize: 32 },
                    animation: {}
                  }
                ]
              }
            ]
          },
          {
            id: 'scene-2',
            layout: 'METRIC_COUNTER',
            narrationText: 'Scene 2',
            text: 'Scene 2',
            durationInSeconds: 2.0,
            visualData: { metricValue: '100%', metricLabel: 'Speed' }
          }
        ],
        audioDuration: 5.0
      },
      selectedNodeId: null
    });
  });

  it('migrateLegacyScene automatically builds atomic nodes for all 5 legacy layouts', () => {
    const legacyMetric = {
      id: 'sc-metric',
      layout: 'METRIC_COUNTER' as const,
      text: 'Performance Metric',
      durationInSeconds: 3.0,
      visualData: { metricValue: '99.9%', metricLabel: 'Uptime' }
    };

    function findNodeByType(nodes: MotionNode[], type: string): MotionNode | undefined {
      for (const n of nodes) {
        if (n.type === type) return n;
        if (n.children) {
          const found = findNodeByType(n.children, type);
          if (found) return found;
        }
      }
      return undefined;
    }

    const migrated = migrateLegacyScene(legacyMetric as any);
    expect(migrated.nodes).toBeDefined();
    expect(migrated.nodes!.length).toBeGreaterThan(0);
    const metricNode = findNodeByType(migrated.nodes!, 'metric');
    expect(metricNode).toBeDefined();
    expect(metricNode?.content).toBe('99.9%');
    expect(migrated.background?.type).toBe('bento_card');

    const legacyTerminal = {
      id: 'sc-term',
      layout: 'TERMINAL_MOCKUP' as const,
      text: 'Code Terminal',
      durationInSeconds: 3.0,
      visualData: { codeSnippet: 'console.log("hi");' }
    };
    const migratedTerm = migrateLegacyScene(legacyTerminal as any);
    const codeNode = findNodeByType(migratedTerm.nodes!, 'code');
    expect(codeNode).toBeDefined();
    expect(codeNode?.content).toBe('console.log("hi");');

    const legacyVs = {
      id: 'sc-vs',
      layout: 'VS_COMPARISON' as const,
      text: 'Comparison',
      durationInSeconds: 3.0,
      visualData: { leftTitle: 'OLD', rightTitle: 'NEW' }
    };
    const migratedVs = migrateLegacyScene(legacyVs as any);
    expect(migratedVs.nodes!.length).toBeGreaterThanOrEqual(2);

    const legacyList = {
      id: 'sc-list',
      layout: 'LIST_STAGGER' as const,
      text: 'Item 1. Item 2. Item 3',
      durationInSeconds: 3.0,
      visualData: { bulletItems: ['Item 1', 'Item 2', 'Item 3'] }
    };
    const migratedList = migrateLegacyScene(legacyList as any);
    expect(migratedList.nodes!.length).toBeGreaterThanOrEqual(3);
  });

  it('resolveTheme prioritizes scene theme tokens over project theme tokens over defaults', () => {
    const projectWithTheme = useMooStore.getState().project;
    const sceneNoOverride = projectWithTheme.scenes[0];
    const resolvedProj = resolveTheme(projectWithTheme, sceneNoOverride);
    expect(resolvedProj.id).toBe(BUILTIN_THEMES[0].id);

    const customTokens: ThemeTokens = {
      id: 'custom-editorial',
      name: 'Custom Editorial',
      bg: '#112233',
      surface: '#223344',
      primary: '#ff0055',
      accent: '#ff5599',
      text: '#ffffff',
      muted: '#888888'
    };

    const sceneWithOverride = {
      ...sceneNoOverride,
      themeTokens: customTokens
    };
    const resolvedOverride = resolveTheme(projectWithTheme, sceneWithOverride);
    expect(resolvedOverride.id).toBe('custom-editorial');
    expect(resolvedOverride.primary).toBe('#ff0055');
  });

  it('shufflePalette cycles through BUILTIN_THEMES on project level and scene level', () => {
    const { shufflePalette } = useMooStore.getState();

    // 1. Project level shuffle
    expect(useMooStore.getState().project.themeTokens?.id).toBe(BUILTIN_THEMES[0].id);
    shufflePalette();
    expect(useMooStore.getState().project.themeTokens?.id).toBe(BUILTIN_THEMES[1].id);
    expect(useMooStore.getState().project.theme.bg).toBe(BUILTIN_THEMES[1].bg);
    expect(useMooStore.getState().project.theme.textHighlight).toBe(BUILTIN_THEMES[1].primary);

    // 2. Scene level shuffle
    shufflePalette('scene-1');
    const scene1 = useMooStore.getState().project.scenes.find((s) => s.id === 'scene-1');
    expect(scene1?.themeTokens?.id).toBe(BUILTIN_THEMES[2].id);
  });

  it('setThemeTokens updates whole token palette and updateThemeToken updates single tokens', () => {
    const { setThemeTokens, updateThemeToken } = useMooStore.getState();
    const neonTokens = BUILTIN_THEMES[3]; // neo-cyber

    setThemeTokens(neonTokens);
    expect(useMooStore.getState().project.themeTokens?.id).toBe(neonTokens.id);

    // Update single token on project
    updateThemeToken('accent', '#00ffcc');
    expect(useMooStore.getState().project.themeTokens?.accent).toBe('#00ffcc');

    // Update single token on scene
    updateThemeToken('primary', '#ff00aa', 'scene-1');
    const scene1 = useMooStore.getState().project.scenes.find((s) => s.id === 'scene-1');
    expect(scene1?.themeTokens?.primary).toBe('#ff00aa');
  });

  it('updateSceneNode recursively updates root and child node properties', () => {
    const { updateSceneNode } = useMooStore.getState();

    // Update root container
    updateSceneNode('scene-1', 'node-root-1', {
      transform: { x: 75, y: 80, scale: 1.2, rotation: 10, opacity: 0.9 }
    });

    let scene1 = useMooStore.getState().project.scenes.find((s) => s.id === 'scene-1');
    let rootNode = scene1?.nodes?.find((n) => n.id === 'node-root-1');
    expect(rootNode?.transform.x).toBe(75);
    expect(rootNode?.transform.scale).toBe(1.2);

    // Update nested child node text and fontSize
    updateSceneNode('scene-1', 'node-child-1', {
      content: 'Updated child caption text',
      style: { fontSize: 48, fillToken: 'accent' }
    });

    scene1 = useMooStore.getState().project.scenes.find((s) => s.id === 'scene-1');
    rootNode = scene1?.nodes?.find((n) => n.id === 'node-root-1');
    const childNode = rootNode?.children?.find((c) => c.id === 'node-child-1');
    expect(childNode?.content).toBe('Updated child caption text');
    expect(childNode?.style.fontSize).toBe(48);
    expect(childNode?.style.fillToken).toBe('accent');
  });

  it('selectedNodeId state can be selected and cleared', () => {
    const { setSelectedNodeId } = useMooStore.getState();
    expect(useMooStore.getState().selectedNodeId).toBeNull();

    setSelectedNodeId('node-child-1');
    expect(useMooStore.getState().selectedNodeId).toBe('node-child-1');

    setSelectedNodeId(null);
    expect(useMooStore.getState().selectedNodeId).toBeNull();
  });

  it('runWorkerRenderPipeline throws cleanly when Worker is not supported in environment', async () => {
    await expect(
      runWorkerRenderPipeline(
        useMooStore.getState().project,
        1080,
        1920,
        30,
        30,
        6_000_000
      )
    ).rejects.toThrow();
  });

  it('normalizeMotionNode safely normalizes enterType, missing transforms, and recursive children', () => {
    const rawNode = {
      type: 'container',
      animation: { enterType: 'spring_pop' },
      children: [
        {
          id: 'raw-child-1',
          type: 'text',
          content: 'Child text'
        }
      ]
    };

    const normalized = normalizeMotionNode(rawNode);
    expect(normalized.animation.enter).toBeDefined();
    expect(normalized.animation.enter?.type).toBe('spring_pop');
    expect(normalized.animation.enter?.startAtSecond).toBe(0);
    expect(normalized.animation.enter?.duration).toBe(0.6);

    expect(normalized.transform).toBeDefined();
    expect(normalized.transform.x).toBe(50);
    expect(normalized.transform.scale).toBe(1.0);

    expect(normalized.children).toBeDefined();
    expect(normalized.children!.length).toBe(1);
    const child = normalized.children![0];
    expect(child.transform).toBeDefined();
    expect(child.transform.x).toBe(50);
    expect(child.style.fontSize).toBe(32);
    expect(child.content).toBe('Child text');
  });

  it('normalizeProject auto-migrates scenes without atomic nodes and assigns themeTokens', () => {
    const legacyProject = {
      id: 'legacy-proj-1',
      title: 'Legacy Project',
      scenes: [
        {
          id: 'sc-legacy-1',
          layout: 'METRIC_COUNTER' as const,
          narrationText: 'Metric Scene',
          visualData: { metricValue: '85%', metricLabel: 'Efficiency' },
          durationInSeconds: 3.0
        }
      ]
    };

    const normalized = normalizeProject(legacyProject as any);
    expect(normalized.themeTokens).toBeDefined();
    expect(normalized.themeTokens?.primary).toBe('#84cc16');
    expect(normalized.scenes[0].nodes).toBeDefined();
    expect(normalized.scenes[0].nodes!.length).toBeGreaterThan(0);
    expect(normalized.scenes[0].background?.type).toBe('bento_card');
  });

  it('updateSceneNode auto-migrates a scene on-demand if it does not yet have nodes', () => {
    // Scene 2 in beforeEach had no nodes (legacy layout METRIC_COUNTER)
    const { updateSceneNode } = useMooStore.getState();
    const scene2Before = useMooStore.getState().project.scenes.find((s) => s.id === 'scene-2');
    expect(scene2Before?.nodes).toBeUndefined();

    // Call updateSceneNode on scene-2
    updateSceneNode('scene-2', 'scene-2-metric', {
      content: '999%'
    });

    const scene2After = useMooStore.getState().project.scenes.find((s) => s.id === 'scene-2');
    expect(scene2After?.nodes).toBeDefined();
    expect(scene2After?.nodes!.length).toBeGreaterThan(0);
  });
});
