/**
 * Core Motion Graphics Director Laws & Prompts
 * 
 * Grounded in generative cinematic motion design principles.
 * The AI generates bespoke HTML structure, SVG paths, scoped CSS, and GSAP timeline animations
 * based on the concept and narrative — NEVER constrained by fixed slide or text templates.
 */

export const MOTION_DIRECTOR_SYSTEM_PROMPT = `
You are the MooScript Elite Motion Graphics Director & Code Architect.
Your task is to invent and write custom, production-grade HTML (with SVGs/shapes/diagrams), scoped CSS, and GSAP animation code for individual motion graphics scenes.

=== 8 CORE MOTION DESIGN PRINCIPLES (ANTI-PPT & VISUAL-FIRST) ===
1. VISUAL FOLLOWS INFORMATION:
   - Invent visual representations tailored to the subject: physical mechanisms, airflow streamlines, electromagnetic fields, heatmaps, code terminals, geometric graphs, architectural schematics, spatial relationships, or abstract kinetic forms.
   - Never treat scenes as slide decks.

2. NOT EVERY SCENE NEEDS TEXT:
   - A scene can be completely visual, diagrammatic, or animated metaphor.
   - Text is merely one explanatory layer (or absent entirely if visual carries the story).

3. TEXT IS ONE LAYER, NOT THE PRODUCT:
   - When text exists, it should support the visuals, not dominate as a giant static card.
   - Keep typography clean, crisp, and secondary to the visual motion.

4. PREFER VISUAL EXPLANATION:
   - For science, technology, physics, processes, or comparisons: use SVG paths, animated vectors, directional arrows, particles, and geometric layers to visualize causality.

5. CONTINUOUS LIFE & CINEMATIC MOTION:
   - Visuals must never be static. Use subtle scale drift, camera tracking, parallax, floating particles, or flowing paths.
   - Avoid pointless clutter; every movement must serve understanding.

6. SEMANTIC MOTION:
   - Motion communicates relationship: cause and effect, focus of attention, transformation, and hierarchy.

7. COMPOSITION MUST BE BESPOKE & EDITABLE:
   - Build completely custom DOM/SVG layers.
   - Tag major editable visual elements with stable identifiers: \`data-moo-layer="layer-id"\` (e.g. \`data-moo-layer="airplane"\`, \`data-moo-layer="airflow"\`, \`data-moo-layer="metric"\`, \`data-moo-layer="main-title"\`).

8. CONTINUITY:
   - Harmonize typography, color tokens, and motion personality with the surrounding scenes.

=== GSAP TIMELINE TIMING & EASING ===
- Animate elements through parameter 'tl' (GSAP Timeline) provided directly by the runtime.
- DO NOT redeclare 'tl', 'root', 'ctx', or 'gsap' (DO NOT write \`const tl = gsap.timeline()\` or \`const root = ...\`).
- DO NOT use \`import\` or \`export default\`. DO NOT wrap in \`function(...) { ... }\` or \`DOMContentLoaded\`. Write direct GSAP calls.
- Target elements inside 'root' using \`root.querySelector()\` or \`root.querySelectorAll()\`.
- Use cinematic easings: 'power3.out', 'expo.out', 'back.out(1.5)', 'circ.out', 'sine.inOut'.
- Total scene duration is \`ctx.dur\` (in seconds). All animations must complete cleanly within [0, ctx.dur].
- Sync animations with spoken keywords via \`ctx.at('keyword')\` if voiceover timestamps are available.

=== DETERMINISM & CODE SECURITY LAWS ===
- NEVER use \`Math.random()\`. Use \`ctx.rand()\` for deterministic pseudo-random values.
- NEVER read \`Date.now()\`, \`performance.now()\`, or \`new Date()\`.
- NEVER call \`fetch()\`, \`XMLHttpRequest\`, \`WebSocket\`, or inject \`<script>\` / \`<iframe>\` tags.
- NEVER access \`window.parent\`, \`window.top\`, \`globalThis\`, \`localStorage\`, or \`document.cookie\`.
- All CSS must be self-contained; use CSS variables: \`var(--moo-bg)\`, \`var(--moo-primary)\`, \`var(--moo-accent)\`, \`var(--moo-text)\`.
`;

export interface SceneCodegenParams {
  beatIndex: number;
  totalBeats: number;
  narration?: string;
  visualIntent: string;
  visualConcept?: string;
  visualElements?: string[];
  motionIntent?: string;
  cameraIntent?: string;
  durationSec: number;
  aspectRatio: string;
  previousSceneSummary?: string;
  nextSceneSummary?: string;
  styleBrief: {
    palette: { bg: string; primary: string; accent: string; text: string };
    fontDisplay: string;
    motionSignature: string;
    backgroundLanguage: string;
  };
  wordTimestamps?: Array<{ word: string; start: number; end: number }>;
}

export function buildSceneCodegenPrompt(params: SceneCodegenParams): string {
  const {
    beatIndex,
    totalBeats,
    narration,
    visualIntent,
    visualConcept,
    visualElements,
    motionIntent,
    cameraIntent,
    durationSec,
    aspectRatio,
    previousSceneSummary,
    nextSceneSummary,
    styleBrief
  } = params;

  const elementsList = visualElements && visualElements.length > 0 ? visualElements.join(', ') : 'Custom geometric & illustrative elements';

  let contextSnippet = '';
  if (previousSceneSummary) {
    contextSnippet += `- Scene Sebelumnya (#${beatIndex}): "${previousSceneSummary}"\n`;
  }
  if (nextSceneSummary) {
    contextSnippet += `- Scene Berikutnya (#${beatIndex + 2}): "${nextSceneSummary}"\n`;
  }

  return `
Desain dan kodekan SCENE #${beatIndex + 1} dari ${totalBeats} untuk video motion graphics ini.

=== INFORMASI & INTENT SCENE ===
- Narasi (VO): "${narration || '(Scene visual murni tanpa teks narasi)'}"
- Visual Intent: "${visualIntent}"
${visualConcept ? `- Konsep Visual: "${visualConcept}"\n` : ''}
- Elemen Visual Utama: ${elementsList}
${motionIntent ? `- Arahan Gerak (Motion Intent): "${motionIntent}"\n` : ''}
${cameraIntent ? `- Arahan Kamera: "${cameraIntent}"\n` : ''}
- Durasi scene: ${durationSec.toFixed(1)} detik.
- Aspek Rasio: ${aspectRatio}

${contextSnippet ? `=== KONTINUITAS DENGAN SCENE LAIN ===\n${contextSnippet}\n` : ''}
=== STYLE TOKENS ===
- Background: var(--moo-bg, ${styleBrief.palette.bg})
- Primary Accent: var(--moo-primary, ${styleBrief.palette.primary})
- Highlight Accent: var(--moo-accent, ${styleBrief.palette.accent})
- Text Color: var(--moo-text, ${styleBrief.palette.text})
- Font Display: var(--moo-font-display, '${styleBrief.fontDisplay}')
- Motion Signature: ${styleBrief.motionSignature}
- Atmosphere: ${styleBrief.backgroundLanguage}

=== PERSYARATAN ELEMEN & KODE ===
1. Buat komposisi visual custom yang menggambarkan konsep secara langsung (diagram, SVG grafis, bentuk, objek bergerak, atau metafora visual).
2. Tandai elemen-elemen penting dengan atribut \`data-moo-layer="layer-id"\` (misal \`data-moo-layer="airplane"\`, \`data-moo-layer="airflow"\`, \`data-moo-layer="title"\`).
3. Wadah utama harus berukuran 100% x 100% dan ter-scope dengan class \`.scene-s${beatIndex + 1}\`.
4. Kode GSAP dieksekusi langsung di runtime dengan parameter (tl, root, ctx, gsap). JANGAN deklarasikan ulang 'const tl = gsap.timeline()' atau 'const root = ...'. JANGAN gunakan 'export default' atau membungkus dalam function. Langsung panggil \`tl.to(...)\`, \`tl.from(...)\`, atau \`tl.fromTo(...)\` dalam durasi maksimal \`ctx.dur\`.
5. EFISIENSI & KECEPATAN TINGGI: Tuliskan kode yang bersih, padat, dan elegan (~30-60 baris total). Hindari string path SVG yang terlalu panjang atau kode boilerplate yang bertele-tele. Cukup hasilkan 3 blok kode murni tanpa kata pembuka atau penutup tambahan.

=== FORMAT OUTPUT WAJIB ===
Tuliskan HANYA 3 blok kode persis seperti format berikut (tanpa penjelasan tambahan di luar blok):

\`\`\`html
<div class="scene-s${beatIndex + 1}">
  <!-- Elemen visual custom, SVG, diagram, dsb dengan data-moo-layer -->
  ...
</div>
\`\`\`

\`\`\`css
.scene-s${beatIndex + 1} {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  display: flex;
  ...
}
\`\`\`

\`\`\`javascript
// Function signature: (tl, root, ctx, gsap)
// root adalah elemen wadah scene. ctx.dur adalah durasi (${durationSec.toFixed(1)}s).
tl.from(root.querySelector(".scene-s${beatIndex + 1}"), { opacity: 0, duration: 0.3 })
  ...
\`\`\`
`;
}

export function buildSceneRepairPrompt(params: {
  originalCode: { html: string; css: string; buildJs: string };
  errors: string[];
  visualIntent: string;
  narration?: string;
  durationSec: number;
}): string {
  const hasOriginalHtml = Boolean(params.originalCode.html && params.originalCode.html.trim());

  if (!hasOriginalHtml) {
    return `
Generasi sebelumnya GAGAL menghasilkan blok kode HTML yang valid.
Visual Intent: "${params.visualIntent}"
${params.narration ? `Narasi: "${params.narration}"\n` : ''}Durasi scene: ${params.durationSec.toFixed(1)}s

TUGAS ANDA:
Segera tuliskan 3 blok kode lengkap (html, css, javascript) yang valid:
1. Blok html: wadah <div class="scene-s1"> dengan elemen data-moo-layer="..."
2. Blok css: styling ter-scope untuk scene
3. Blok javascript: timeline GSAP (tl.from / tl.to) mengontrol animasi visual

PENTING:
- Keluarkan HANYA 3 blok kode (\`\`\`html, \`\`\`css, \`\`\`javascript).
- Dilarang menulis teks pembuka/penutup atau penjelasan. Langsung berikan blok kode!
`;
  }

  return `
Kode scene motion graphics sebelumnya memiliki error validasi:
${params.errors.map((e) => `- ${e}`).join('\n')}

Visual Intent Scene: "${params.visualIntent}"
${params.narration ? `Narasi: "${params.narration}"\n` : ''}Durasi: ${params.durationSec.toFixed(1)}s

Perbaiki kode di bawah ini sehingga mematuhi seluruh aturan:
1. Tidak ada Math.random(), gunakan ctx.rand()
2. Tidak ada Date.now() atau performance.now()
3. Tidak ada fetch/script/eval/Function
4. Pastikan buildJs menganimasikan elemen via timeline tl
5. JANGAN deklarasikan ulang const/let tl atau const/let root (langsung panggil tl.to / tl.from)
6. JANGAN gunakan import atau export default
7. Keluarkan HANYA 3 blok kode (html, css, javascript) yang valid dan bersih tanpa penjelasan tambahan di luarnya.

Kode Asli yang Bermasalah:
\`\`\`html
${params.originalCode.html}
\`\`\`

\`\`\`css
${params.originalCode.css}
\`\`\`

\`\`\`javascript
${params.originalCode.buildJs}
\`\`\`
`;
}

