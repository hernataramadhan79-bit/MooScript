import { escapeHtml } from '../../../utils/textUtils';
import type { SceneAssetAttachment } from '../../../types';

/**
 * Core Motion Graphics Director Laws & Prompts
 * 
 * Grounded in generative cinematic motion design principles.
 * The AI generates bespoke HTML structure, SVG paths, scoped CSS, and MooTween timeline code
 * based on the concept and narrative — NEVER constrained by fixed slide or text templates.
 */

/**
 * MooTween is MooScript's own seek-only animation engine. This is the part of its timeline API the
 * model may use; anything outside it is rejected by the validator with a repair message.
 */
export const MOOTWEEN_RUNTIME_RULES = `=== MOOTWEEN TIMELINE (MooScript animation engine) ===
- Animate through the provided 'tl' (a MooTween timeline). Signature: (tl, root, ctx, MooTween).
- DO NOT redeclare 'tl', 'root', 'ctx', or 'MooTween'. No import/export, no function wrapper, no DOMContentLoaded.
- Target elements with root.querySelector() / root.querySelectorAll(), or selector strings in tl calls
  (they only match inside this shot). Never use document.querySelector / getElementById.
- Total shot duration is ctx.dur seconds; every tween must finish within [0, ctx.dur].
- Supported:
  tl.to / tl.from / tl.fromTo / tl.set / tl.add / tl.addLabel / tl.call, chained or with a position:
    seconds (1.2), '+=0.3' / '-=0.3', '<' / '>' (start / end of the previous tween), '<0.2', a label ('hit+=0.1').
  vars: duration, delay, ease, stagger (number or { each | amount, from: 'start'|'center'|'end'|'edges'|index }),
    repeat (-1 loops for the whole shot), yoyo, repeatDelay, keyframes: [{...}, {...}], immediateRender,
    onStart / onUpdate / onComplete.
  eases: 'none', power1-4 / quad / cubic / quart / quint / sine / expo / circ with .in .out .inOut,
    'back.out(1.7)', 'elastic.out(1, 0.3)', 'bounce.out', 'steps(5)'.
  properties: x, y (px or '%'), xPercent, yPercent, scale, scaleX, scaleY, rotation, rotationX, rotationY,
    skewX, skewY, transformOrigin, svgOrigin (SVG, viewBox units), transformPerspective, opacity, autoAlpha,
    numeric CSS (width, height, left, top, fontSize, letterSpacing, borderRadius ...), colors (hex, rgb, hsl,
    var(--moo-*)), clipPath, filter, boxShadow (same shape at start and end), strokeDasharray,
    strokeDashoffset, fill, stroke, attr: { cx, cy, r, d (same point count) }, relative '+=' / '-=' values,
    plain objects for counters ({ v: 0 }).
  helpers: MooTween.utils.clamp / interpolate / mapRange / wrap / toArray.
- Not available (use the ctx helpers instead): plugins and registerPlugin (ScrollTrigger, MotionPath,
  MorphSVG, SplitText, DrawSVG, Draggable, Text), ticker, context, matchMedia, quickTo, quickSetter.
  Split text with ctx.kinetic / ctx.split, draw strokes with ctx.draw, move along a circle with ctx.orbit.`;

/**
 * Reference scene shown to the model. It demonstrates the motion grammar (poster-ready frame 0,
 * camera life, stroke draws, overshoot pops, word-synced accent, hand-off) — not a layout to copy.
 */
export const REFERENCE_SCENE_EXAMPLE = `
Topik contoh: "Satu ide kecil menyebar ke banyak orang" — 9:16, panggung 1080x1920, durasi 4.0s.

\`\`\`html
<div class="scene-ex">
  <div class="moo-camera" data-moo-layer="camera">
    <div class="ex-glow" data-moo-layer="bg-glow"></div>
    <svg class="ex-net" data-moo-layer="network" viewBox="0 0 1080 1920">
      <g class="ex-links" fill="none" stroke="var(--moo-primary, #38bdf8)" stroke-width="5" stroke-linecap="round">
        <path d="M540 1060 C 420 900, 300 820, 230 700" />
        <path d="M540 1060 C 680 920, 780 820, 860 660" />
        <path d="M540 1060 C 420 1220, 330 1330, 260 1440" />
        <path d="M540 1060 C 690 1210, 790 1320, 850 1460" />
      </g>
      <g class="ex-nodes" fill="var(--moo-text, #f8fafc)">
        <circle cx="230" cy="700" r="28" /><circle cx="860" cy="660" r="28" />
        <circle cx="260" cy="1440" r="28" /><circle cx="850" cy="1460" r="28" />
      </g>
      <circle class="ex-ring" cx="540" cy="1060" r="80" fill="none" stroke="var(--moo-accent, #f59e0b)" stroke-width="6" />
      <circle class="ex-core" data-moo-layer="core" cx="540" cy="1060" r="80" fill="var(--moo-accent, #f59e0b)" />
    </svg>
    <div class="ex-word" data-moo-layer="headline"><span>SATU</span> <span>IDE</span></div>
  </div>
</div>
\`\`\`

\`\`\`css
.scene-ex { position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--moo-bg, #0b1020); }
.scene-ex .moo-camera { position: absolute; inset: 0; transform-origin: 50% 55%; }
.scene-ex .ex-glow { position: absolute; left: 140px; top: 660px; width: 800px; height: 800px; border-radius: 50%;
  background: radial-gradient(circle, var(--moo-primary, #38bdf8) 0%, transparent 65%); opacity: 0.22; }
.scene-ex .ex-net { position: absolute; left: 0; top: 0; width: 100%; height: 100%; overflow: visible; }
.scene-ex .ex-word { position: absolute; left: 0; top: 320px; width: 100%; text-align: center; white-space: nowrap;
  font: 900 160px/1 var(--moo-font-display, 'Syne'); letter-spacing: -0.04em; color: var(--moo-text, #f8fafc); }
.scene-ex .ex-word span { display: inline-block; }
\`\`\`

\`\`\`javascript
const hit = ctx.beat('ide', 1.2);

// Kamera hidup sepanjang shot + hand-off zoom-through di 0.4s terakhir
ctx.camera({ move: 'roll', handoff: 'zoom' });
ctx.drift('.ex-glow', { amount: 30 });
ctx.particles({ count: 18, size: [3, 7] });

// Frame 0 sudah jadi poster: inti terlihat sejak awal lalu mengembang, gelombang memancar
ctx.hero('.ex-core');
tl.fromTo('.ex-ring', { scale: 1, opacity: 0.9, transformOrigin: '50% 50%' },
  { scale: 4, opacity: 0, duration: 1.2, ease: 'expo.out', repeat: 2 }, 0.15);

// Detail sekunder masuk: garis digambar keluar dari inti, node meletup di ujung garis
ctx.draw('.ex-links path', { at: 0.4, duration: 0.7, stagger: 0.12 });
ctx.pop('.ex-nodes circle', { at: 0.95, stagger: 0.12 });

// Kata kunci menghantam tepat saat diucapkan, inti ikut berdenyut
ctx.kinetic('.ex-word', { style: 'rise', at: hit - 0.15 });
ctx.punch('.ex-core', { at: hit, scale: 1.35 });
\`\`\`
`;

export const MOTION_DIRECTOR_SYSTEM_PROMPT = `
You are the MooScript Elite Motion Graphics Director & Code Architect.
You write one SHOT of a motion graphics film as HTML (mostly SVG), scoped CSS, and a MooTween timeline.
It is a film frame rendered to MP4 — NOT a web page, NOT a slide, NOT a landing-page section.

=== STAGE CONTRACT (WAJIB) ===
1. The scene is a fixed frame of W x H pixels (given per scene). Compose in absolute stage coordinates:
   every element uses position:absolute with px left/top, or lives inside an <svg viewBox="0 0 W H">.
2. Structure:
   <div class="scene-sN">                                  ← root, 100% x 100%, overflow hidden, background
     <div class="moo-camera" data-moo-layer="camera">      ← wraps EVERYTHING; the camera moves the world
       background layer (gradients, grids, atmosphere)
       mid layer (SVG objects, paths, diagrams, characters)
       foreground layer (1-3 big kinetic words, or nothing)
     </div>
   </div>
3. FORBIDDEN (these make it look like a slide/web page):
   - display:flex / display:grid used for composition, margin:auto centering
   - cards / panels / glassmorphism: rounded boxes with background + shadow, backdrop-filter
   - <p>, <ul>, <li>, <button>, <nav>, badges/pills, bullet lists, paragraphs
   - pasting the narration as on-screen text. Narration is spoken AND captioned separately.
4. Text is optional. Max 6 words visible at once, max ~12 words for the whole scene. Big and graphic
   (≥ 120px on 9:16 / 1:1, ≥ 96px on 16:9), split into <span> per word or letter so it can be animated.
5. The subject must be SHOWN: build the actual objects, mechanisms, data shapes or metaphors in SVG.

=== MOTION GRAMMAR (WAJIB) ===
1. CAMERA: move .moo-camera for the whole shot with ctx.camera({ move }) (push-in, pull-out, pan, roll).
2. FRAME 0 IS A POSTER: the editor shows t=0 as the scene's still. At t=0 the background, the camera and
   the main subject are already VISIBLE and composed, and already moving. Never hide the camera, the root
   or the hero object at t=0 (no opacity:0 / scale:0 start for them); grow the hero from a visible state
   (e.g. fromTo scale 0.55 → 1). Only secondary details (labels, nodes, lines, words) may enter from nothing.
3. NO HOLDS: no moment longer than ~0.8s where nothing changes. Keep elements alive (drift, rotate, pulse, draw).
4. ENTRANCE VOCABULARY — plain opacity/x/y fade-ups are the slide look. Prefer:
   scale from 0 with overshoot (back.out), strokeDashoffset line draws, clip-path/mask reveals,
   per-letter rotation/yPercent snaps, shape morphs, counters, objects flying in along a path.
5. SYNC TO VOICE: place accents at ctx.beat('kata', <fallback>) (seconds within this shot).
   Focus words get a punch (ctx.punch, ctx.flash, ctx.shake, color hit).
6. HAND-OFF: the last ~0.4s (position ctx.dur - 0.4) is an exit (ctx.camera does this via its handoff option) — whip, zoom-through, wipe, or objects
   leaving frame — so the cut into the next shot feels continuous.
7. EASING CONTRAST: expo.out / back.out for snaps and pops, sine.inOut for drifts, power4.in for exits.
   Absolute positions (seconds) on tl are preferred over long '-=0.3' chains.

=== MOGRAPH KIT (ctx helpers — PREFER these over hand-written tweens) ===
Every helper adds tweens to tl, accepts a selector / element / list, and keeps everything inside [0, ctx.dur].
- ctx.camera({ move, handoff, from, to })   move: 'push' | 'pull' | 'pan-left' | 'pan-right' | 'pan-up' | 'pan-down' | 'roll'
                                            moves .moo-camera for the whole shot, then runs the hand-off (default 'zoom';
                                            'whip-left' | 'whip-right' | 'whip-up' | 'drop' | 'spin' | false). Call it in EVERY shot.
- ctx.beat('kata', fallbackSec)             time of a spoken word inside this shot (fallback when unknown). Use for every accent.
- ctx.hero(target)                          main subject: visible on frame 0 at scale 0.55, grows with overshoot, then breathes.
- ctx.draw(paths, { at, duration, stagger, from })   SVG stroke draw (path / line / circle / polyline).
- ctx.pop(targets, { at, stagger, from })   overshoot scale pop for secondary details (from 0 by default).
- ctx.kinetic(textEl, { style, by, at })    splits text and animates it. style: 'rise' | 'slam' | 'flip' | 'drop' | 'type'; by: 'words' | 'chars'.
- ctx.count(el, { from, to, at, duration, decimals, prefix, suffix })   animated number counter.
- ctx.reveal(targets, { dir, at })          clip-path wipe. dir: 'left' | 'right' | 'up' | 'down' | 'circle'.
- ctx.punch(target, { at, scale })  ctx.shake(target, { at, strength })  ctx.flash({ at, color })   accents for focus words.
- ctx.drift(targets, { amount, rotate })    slow float for the whole shot (nothing holds still).
- ctx.orbit(targets, { turns, cx, cy })     spin around a point (cx/cy in SVG viewBox units).
- ctx.particles({ count, size: [min, max], color, rise })   ambient particles behind the content, visible from frame 0.
- ctx.stage = { w, h }                      stage size in px.
Raw tl.to / tl.from / tl.fromTo stay available for anything the kit does not cover (morphing shapes, custom paths).

=== REFERENCE SHOT (acuan tata bahasa gerak — JANGAN tiru topik, bentuk, atau warnanya) ===
${REFERENCE_SCENE_EXAMPLE}

=== PALETTE & USER INTENT (CRITICAL) ===
- 100% OBEY USER INTENT: narration, visual intent, visual concept and focus words are your supreme instructions.
- NEVER FORCE A GREEN/LIME PALETTE: Dilarang memaksakan warna hijau limau (#84cc16) kecuali topik adegan secara spesifik meminta tanaman/alam!
- Choose lighting and color organically from the subject (ocean: deep cyan/navy; fire: vermilion/amber; tech: slate/ice-blue; finance: charcoal/gold).
- Wrap colors in scoped CSS variables with your contextual colors as fallback:
  var(--moo-bg, <bg>), var(--moo-text, <text>), var(--moo-accent, <accent>), var(--moo-primary, <primary>).
- Tag major editable elements with data-moo-layer="layer-id" (e.g. "camera", "airplane", "airflow", "headline").

${MOOTWEEN_RUNTIME_RULES}

=== DETERMINISM & CODE SECURITY LAWS ===
- NEVER use Math.random(). Use ctx.rand() for deterministic pseudo-random values.
- NEVER read Date.now(), performance.now(), or new Date().
- NEVER call fetch(), XMLHttpRequest, WebSocket, or inject <script> / <iframe> tags.
- NEVER access window.parent, window.top, globalThis, localStorage, or document.cookie.
- All CSS must be self-contained and scoped under the scene class.
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
  focusWords?: string[];
  /** The one subject of this shot; it must be visible on frame 0 (ctx.hero). */
  heroObject?: string;
  /** How this shot hands off into the next one. */
  matchCut?: string;
  /** How the previous shot handed off, i.e. what this shot must open on. */
  incomingMatchCut?: string;
  styleBrief: {
    palette: { bg: string; primary: string; accent: string; text: string };
    fontDisplay: string;
    motionSignature: string;
    backgroundLanguage: string;
    motif?: string;
  };
  wordTimestamps?: Array<{ word: string; start: number; end: number }>;
  assignedAssets?: SceneAssetAttachment[];
}

const STAGE_SIZES: Record<string, { w: number; h: number }> = {
  '9:16': { w: 1080, h: 1920 },
  '16:9': { w: 1920, h: 1080 },
  '1:1': { w: 1080, h: 1080 }
};

export function stageSizeFor(aspectRatio: string): { w: number; h: number } {
  return STAGE_SIZES[aspectRatio] || STAGE_SIZES['9:16'];
}

/** Renders scene-relative word timings as `kata@1.32s` tokens for the prompt. */
export function formatWordTimestamps(
  wordTimestamps: Array<{ word: string; start: number; end: number }> | undefined,
  limit = 80
): string {
  if (!wordTimestamps || wordTimestamps.length === 0) return '';
  return wordTimestamps
    .slice(0, limit)
    .map((w) => `${String(w.word).replace(/[^\p{L}\p{N}%'-]/gu, '')}@${Math.max(0, w.start).toFixed(2)}s`)
    .filter((t) => !t.startsWith('@'))
    .join(' ');
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
    focusWords,
    heroObject,
    matchCut,
    incomingMatchCut,
    styleBrief
  } = params;
  const stage = stageSizeFor(aspectRatio);
  const timingLine = formatWordTimestamps(params.wordTimestamps);
  const assignedAssets = params.assignedAssets || [];
  let assetsSnippet = '';
  if (assignedAssets.length > 0) {
    assetsSnippet = `\n=== ASET MEDIA DILAMPIRKAN PENGGUNA (INTEGRASI WAJIB) ===\nPengguna melampirkan aset gambar untuk adegan ini yang WAJIB dimasukkan ke dalam layout dan animasi:\n` +
      assignedAssets.map((asset, i) =>
`- Aset ${i + 1}: "${asset.assetName}" (Peran: ${asset.role})
  Arahan Gerak: ${asset.motionGuidance || 'Animasikan secara natural menyatu dengan penceritaan'}
  Aturan Integrasi:
  1. Masukkan elemen HTML:
     <div class="moo-asset-frame" data-moo-layer="asset-${asset.assetId}">
       <img src="${asset.dataUrl}" alt="${escapeHtml(asset.assetName || 'Asset')}" class="moo-asset-img" />
     </div>
  2. Berikan CSS styling yang kohesif pada .moo-asset-frame dan .moo-asset-img (misal: potongan transparan, mask bentuk, frame bercahaya, ukuran proporsional; posisikan absolut di panggung, bukan kartu).
  3. Animasikan dengan timeline MooTween (tl.from / tl.to) terkoordinasi dengan teks dan grafik adegan!`
      ).join('\n') + '\n';
  }

  const elementsList = visualElements && visualElements.length > 0 ? visualElements.join(', ') : 'Elemen visual geometris & ilustratif custom';

  let contextSnippet = '';
  if (previousSceneSummary) {
    contextSnippet += `- Scene Sebelumnya (#${beatIndex}): "${previousSceneSummary}"\n`;
  }
  if (nextSceneSummary) {
    contextSnippet += `- Scene Berikutnya (#${beatIndex + 2}): "${nextSceneSummary}"\n`;
  }

  const focusList = focusWords && focusWords.length > 0 ? focusWords.join(', ') : '';

  let worldSnippet = '';
  if (styleBrief.motif) worldSnippet += `- Motif berulang (benang merah film): "${styleBrief.motif}" — munculkan di shot ini bila menyambung cerita.\n`;
  if (styleBrief.backgroundLanguage) worldSnippet += `- Bahasa visual: "${styleBrief.backgroundLanguage}"\n`;
  if (styleBrief.motionSignature) worldSnippet += `- Gaya kamera: "${styleBrief.motionSignature}"\n`;

  let cutSnippet = '';
  if (incomingMatchCut) {
    cutSnippet += `- Shot ini DIBUKA dari hand-off shot sebelumnya: "${incomingMatchCut}". Frame 0 menampilkan elemen itu (bentuk/warna/posisi menyambung), lalu berkembang menjadi subjek shot ini.\n`;
  }
  if (matchCut) {
    cutSnippet += `- Shot ini DITUTUP dengan: "${matchCut}". Hand-off di ctx.dur - 0.4 mengarah ke elemen itu; pilih ctx.camera({ handoff }) yang cocok (zoom masuk ke bentuk, whip searah gerak, dsb).\n`;
  }

  return `
Desain dan kodekan SCENE #${beatIndex + 1} dari ${totalBeats} untuk video motion graphics ini.

=== ARAHAN UTAMA: 100% PATUH PADA IDE & INTENT PENGGUNA ===
- Narasi (Voiceover — DIUCAPKAN & di-caption terpisah, JANGAN ditulis ulang di layar): "${narration || '(Scene visual murni tanpa teks narasi)'}"
- Visual Intent (Apa yang digambar/dimunculkan): "${visualIntent}"
${heroObject ? `- Subjek utama shot (wajib terlihat di frame 0, pakai ctx.hero): "${heroObject}"\n` : ''}${visualConcept ? `- Konsep / Metafora Visual: "${visualConcept}"\n` : ''}
${focusList ? `- Kata Kunci Sorotan (Focus Words): "${focusList}" (Wajib berikan highlight aksen/punch kinetik saat kata ini muncul)\n` : ''}
- Elemen Visual: ${elementsList}
${motionIntent ? `- Arahan Gerak: "${motionIntent}"\n` : ''}
${cameraIntent ? `- Arahan Kamera: "${cameraIntent}"\n` : ''}
- Durasi shot: ${durationSec.toFixed(1)} detik (ctx.dur).
- Aspek Rasio: ${aspectRatio} — panggung ${stage.w}x${stage.h}px. Gunakan koordinat absolut dan <svg viewBox="0 0 ${stage.w} ${stage.h}">.
${timingLine ? `
=== TIMING SUARA (detik di dalam shot ini) ===
${timingLine}
- Jatuhkan aksen/punch tepat di waktu kata kunci dengan ctx.beat('kata', <detik-di-atas>).
- Gerakan utama mengikuti ritme kata, bukan menumpuk di awal.
` : ''}${assetsSnippet}

${worldSnippet ? `=== DUNIA FILM (sama di semua shot) ===\n${worldSnippet}\n` : ''}${contextSnippet || cutSnippet ? `=== KONTINUITAS & MATCH CUT ===\n${contextSnippet}${cutSnippet}\n` : ''}
=== PALET WARNA & ATMOSFER (BEBAS SESUAI TOPIK — JANGAN DEFAULT HIJAU) ===
- Rancang atmosfer latar belakang, gradien, pencahayaan, dan warna yang SEPENUHNYA COCOK dan ORGANIK dengan topik cerita di atas.
- DILARANG memaksakan warna hijau limau (#84cc16) kecuali topik cerita Anda memang tentang botani/lingkungan hidup!
- Untuk fleksibilitas editing pasca-generasi, bungkus warna dengan CSS variables menggunakan warna tematik pilihan Anda sebagai fallback:
  * Background: var(--moo-bg, ${styleBrief.palette.bg || '#09090b'})
  * Text Color: var(--moo-text, ${styleBrief.palette.text || '#ffffff'})
  * Accent Highlight: var(--moo-accent, ${styleBrief.palette.accent && styleBrief.palette.accent !== '#84cc16' ? styleBrief.palette.accent : 'pilih-warna-aksen-tematik-sesuai-topik'})
  * Primary: var(--moo-primary, ${styleBrief.palette.primary && styleBrief.palette.primary !== '#84cc16' ? styleBrief.palette.primary : 'pilih-warna-primer-tematik'})
  * Font Display: var(--moo-font-display, '${styleBrief.fontDisplay || 'Plus Jakarta Sans'}')

=== PERSYARATAN ELEMEN & KODE ===
1. Ikuti STAGE CONTRACT & MOTION GRAMMAR di system prompt. Ini satu shot film, bukan slide atau halaman web.
2. Tunjukkan subjeknya secara visual (objek SVG, mekanisme, bentuk data, metafora). Teks maksimal 6 kata sekaligus, hanya kata kunci.
3. Root .scene-s${beatIndex + 1} berukuran 100% x 100%; semua isi berada di dalam <div class="moo-camera" data-moo-layer="camera">.
4. Minimal 3 lapisan kedalaman bertanda data-moo-layer (latar, objek tengah, depan).
5. Frame 0 = poster: latar, kamera, dan subjek utama SUDAH terlihat di t=0 (jangan mulai dari opacity 0 / scale 0). Kamera bergerak sepanjang ctx.dur, tidak ada jeda diam > 0.8s, dan ada aksi keluar di ctx.dur - 0.4.
6. Kode timeline MooTween dieksekusi langsung dengan parameter (tl, root, ctx, MooTween). JANGAN deklarasikan ulang 'tl' atau 'root'. Hasilkan HANYA 3 blok kode tanpa kata pembuka atau penutup.

=== FORMAT OUTPUT WAJIB ===
Tuliskan HANYA 3 blok kode persis seperti format berikut (tanpa penjelasan tambahan di luar blok):

\`\`\`html
<div class="scene-s${beatIndex + 1}">
  <div class="moo-camera" data-moo-layer="camera">
    <!-- latar, <svg viewBox="0 0 ${stage.w} ${stage.h}"> objek, teks kinetik pendek; semua dengan data-moo-layer -->
    ...
  </div>
</div>
\`\`\`

\`\`\`css
.scene-s${beatIndex + 1} {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: var(--moo-bg, ...);
}
.scene-s${beatIndex + 1} .moo-camera { position: absolute; inset: 0; }
/* Elemen lain: position:absolute dengan koordinat px panggung */
\`\`\`

\`\`\`javascript
// Function signature: (tl, root, ctx, MooTween)
// root adalah elemen wadah scene. ctx.dur adalah durasi (${durationSec.toFixed(1)}s).
ctx.camera({ move: 'push', handoff: 'zoom' });   // kamera + hand-off
ctx.hero('.subjek-utama');                        // terlihat di frame 0
// ...ctx.draw / ctx.pop / ctx.kinetic / ctx.count, aksen di ctx.beat('kata', 1.2)...
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
3. Blok javascript: timeline MooTween (tl.from / tl.to) mengontrol animasi visual

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
8. Pastikan sintaks JavaScript valid dan tidak ada kurung atau tanda petik yang terpotong. Langsung gunakan tl.to() atau tl.from().

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

/**
 * Second-pass prompt for scenes that are valid code but read as a slide / web page
 * (see lintMographQuality). Asks for a rewrite, not a patch, against the stage contract.
 */
export function buildSceneQualityRepairPrompt(params: {
  originalCode: { html: string; css: string; buildJs: string };
  issues: string[];
  beatIndex: number;
  visualIntent: string;
  narration?: string;
  durationSec: number;
  aspectRatio: string;
  wordTimestamps?: Array<{ word: string; start: number; end: number }>;
}): string {
  const stage = stageSizeFor(params.aspectRatio);
  const timingLine = formatWordTimestamps(params.wordTimestamps);
  return `
Kode shot #${params.beatIndex + 1} di bawah ini valid, tetapi hasilnya masih terasa seperti SLIDE / HALAMAN WEB, bukan motion graphics.
Masalah yang terdeteksi:
${params.issues.map((i) => `- ${i}`).join('\n')}

Visual Intent: "${params.visualIntent}"
${params.narration ? `Narasi (diucapkan, JANGAN ditulis di layar): "${params.narration}"\n` : ''}Durasi: ${params.durationSec.toFixed(1)}s (ctx.dur) — panggung ${params.aspectRatio}, ${stage.w}x${stage.h}px.
${timingLine ? `Timing suara: ${timingLine}\n` : ''}
TUGAS: TULIS ULANG shot ini dari awal mengikuti STAGE CONTRACT dan MOTION GRAMMAR di system prompt.
- Pertahankan ide visual dan id data-moo-layer yang masih relevan, buang kartu/paragraf/layout web.
- Semua isi di dalam <div class="moo-camera" data-moo-layer="camera">, kamera bergerak sepanjang shot (ctx.camera).
- Pakai MOGRAPH KIT (ctx.camera, ctx.hero, ctx.draw, ctx.pop, ctx.kinetic, ctx.count, ctx.beat) daripada tween fade manual.
- Frame 0 = poster: latar, kamera, dan subjek utama sudah terlihat di t=0.
- Objek SVG yang menunjukkan subjek, maksimal 6 kata di layar, aksi keluar di ctx.dur - 0.4.
- Root tetap class .scene-s${params.beatIndex + 1}.
- Keluarkan HANYA 3 blok kode (\`\`\`html, \`\`\`css, \`\`\`javascript) tanpa penjelasan.

Kode saat ini:
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
