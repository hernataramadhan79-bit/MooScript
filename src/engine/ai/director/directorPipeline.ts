import type { StoryBeat, StyleBrief, SceneModule, LLMProvider } from '../../../types';
import { validateSceneCode } from '../../composition/validator';
import { MOTION_DIRECTOR_SYSTEM_PROMPT, buildSceneCodegenPrompt } from './motionLaws';

export function parseCodeBlocks(rawText: string): { html: string; css: string; buildJs: string } {
  let html = '';
  let css = '';
  let buildJs = '';

  const htmlMatch = rawText.match(/```html\s*([\s\S]*?)\s*```/i);
  if (htmlMatch) {
    html = htmlMatch[1].trim();
  }

  const cssMatch = rawText.match(/```css\s*([\s\S]*?)\s*```/i);
  if (cssMatch) {
    css = cssMatch[1].trim();
  }

  const jsMatch = rawText.match(/```(?:javascript|js)\s*([\s\S]*?)\s*```/i);
  if (jsMatch) {
    buildJs = jsMatch[1].trim();
  }

  return { html, css, buildJs };
}

export async function generateSingleSceneModule(params: {
  beat: StoryBeat;
  index: number;
  total: number;
  styleBrief: StyleBrief;
  provider: LLMProvider;
  apiKey: string;
  model?: string;
  executeLlm: (opts: { systemPrompt: string; userPrompt: string }) => Promise<string>;
}): Promise<SceneModule> {
  const { beat, index, total, styleBrief, executeLlm } = params;

  const prompt = buildSceneCodegenPrompt({
    beatIndex: index,
    totalBeats: total,
    narration: beat.narration,
    visualIntent: beat.visualIntent,
    durationSec: beat.durationHint || 3.5,
    styleBrief: {
      palette: styleBrief.palette,
      fontDisplay: styleBrief.fontDisplay,
      motionSignature: styleBrief.motionSignature,
      backgroundLanguage: styleBrief.backgroundLanguage
    }
  });

  try {
    const rawResponse = await executeLlm({
      systemPrompt: MOTION_DIRECTOR_SYSTEM_PROMPT,
      userPrompt: prompt
    });

    const parsed = parseCodeBlocks(rawResponse);

    if (!parsed.html.trim()) {
      const title = beat.visualIntent || beat.narration || `Adegan ${index + 1}`;
      parsed.html = `<div class="scene-box">
  <div class="glow-bg"></div>
  <h1 class="headline">${title}</h1>
  <p class="caption">${beat.narration || ''}</p>
</div>`;
      parsed.css = `.scene-box {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  position: relative; overflow: hidden;
  background: ${styleBrief.palette.bg};
  color: ${styleBrief.palette.text};
  text-align: center; padding: 48px;
  font-family: '${styleBrief.fontDisplay}', sans-serif;
}
.glow-bg {
  position: absolute; width: 600px; height: 600px;
  border-radius: 50%;
  background: radial-gradient(circle, ${styleBrief.palette.accent}22 0%, transparent 70%);
  filter: blur(40px);
}
.headline {
  position: relative; z-index: 2;
  font-size: 72px; font-weight: 800; line-height: 1.1;
  color: ${styleBrief.palette.accent};
}
.caption {
  position: relative; z-index: 2;
  margin-top: 24px; font-size: 28px; color: ${styleBrief.palette.text}aa;
}`;
      parsed.buildJs = `tl.from(root.querySelector(".glow-bg"), { scale: 0.5, opacity: 0, duration: 0.8 })
  .from(root.querySelector(".headline"), { y: 40, opacity: 0, scale: 0.9, duration: 0.7, ease: "back.out(1.7)" }, "-=0.4")
  .from(root.querySelector(".caption"), { y: 20, opacity: 0, duration: 0.5 }, "-=0.2");`;
    }

    const validation = validateSceneCode(parsed);

    if (!validation.valid) {
      console.warn(`Validation issues in scene ${index + 1}:`, validation.errors);
    }

    return {
      beatId: beat.id,
      html: parsed.html,
      css: parsed.css,
      buildJs: parsed.buildJs,
      status: validation.valid ? 'ok' : 'error',
      errors: validation.errors,
      version: 1
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      beatId: beat.id,
      html: `<div class="scene-error"><p>${beat.visualIntent}</p></div>`,
      css: `.scene-error { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; color: #ef4444; font-size: 16px; }`,
      buildJs: `tl.from(root, { opacity: 0, duration: 0.5 });`,
      status: 'error',
      errors: [message],
      version: 1
    };
  }
}
