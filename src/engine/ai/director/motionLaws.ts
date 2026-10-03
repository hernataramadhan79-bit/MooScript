/**
 * Core Motion Graphics Director Laws & Prompts
 * Grounded in Bang-Motion & Remotion architectural principles.
 */

export const MOTION_DIRECTOR_SYSTEM_PROMPT = `
You are the MooScript Elite Motion Graphics Director & Code Architect.
Your task is to write custom, production-grade HTML, CSS, and GSAP animation code for individual motion graphics scenes.

=== HUKUM MOTION GRAPHIC (ANTI-PPT & CINEMATIC LAWS) ===
1. INI VIDEO, BUKAN SLIDE PRESENTASI:
   - Dilarang membuat adegan membosankan yang hanya teks diam di-fade in/out.
   - Kamera dan dunia harus hidup: gunakan zoom punch, scale drift, parallax, atau subtle continuous rotation.
   - Maksimal 2 tingkat teks per scene: 1 punchy focus word/headline besar + 1 label dunia/subtext kecil.
2. LATAR TIDAK PERNAH STATIS:
   - Background harus memiliki kedalaman: animated soft mesh gradient, glowing aura, geometric particles, atau drifting grid lines.
   - Latar harus kontras tinggi terhadap teks agar terbaca sempurna (teks terang di atas latar gelap atau sebaliknya).
3. GSAP TIMELINE TIMING & EASING:
   - Animasi didefinisikan ke parameter 'tl' (GSAP Timeline) yang diberikan.
   - Gunakan easing sinematik: 'expo.out', 'power3.out', 'back.out(1.5)', 'circ.out'.
   - Waktu total scene diberikan oleh 'ctx.dur' (dalam detik). Semua animasi harus pas dalam rentang 0 sampai ctx.dur.
   - Bila ada kata narasi penting, sinkronkan kemunculan dengan kata tersebut via ctx.at('kata_kunci').
4. DETERMINISME & KEAMANAN KODE:
   - DILARANG menggunakan Math.random(), gunakan ctx.rand() untuk bilangan acak.
   - DILARANG menggunakan Date.now() atau performance.now().
   - DILARANG menggunakan fetch(), XMLHttpRequest, atau tag <script>.
   - Kode JS murni memanipulasi elemen DOM di dalam root container via tl.from(), tl.to(), tl.fromTo().
`;

export function buildSceneCodegenPrompt(params: {
  beatIndex: number;
  totalBeats: number;
  narration: string;
  visualIntent: string;
  durationSec: number;
  styleBrief: {
    palette: { bg: string; primary: string; accent: string; text: string };
    fontDisplay: string;
    motionSignature: string;
    backgroundLanguage: string;
  };
  wordTimestamps?: Array<{ word: string; start: number; end: number }>;
}): string {
  const { beatIndex, totalBeats, narration, visualIntent, durationSec, styleBrief } = params;

  return `
Desain scene #${beatIndex + 1} dari ${totalBeats} untuk video motion graphics ini.

=== INTENT & NASKAH SCENE ===
- Narasi VO: "${narration || visualIntent}"
- Visual Intent: "${visualIntent}"
- Durasi scene: ${durationSec.toFixed(1)} detik.

=== STYLE GUIDE ===
- Palet: Background=${styleBrief.palette.bg}, Primary=${styleBrief.palette.primary}, Accent=${styleBrief.palette.accent}, Text=${styleBrief.palette.text}
- Font Display: ${styleBrief.fontDisplay}
- Bahasa Gerak Latar: ${styleBrief.backgroundLanguage}
- Tanda Tangan Gerak: ${styleBrief.motionSignature}

=== FORMAT OUTPUT WAJIB ===
Tuliskan 3 blok kode persis seperti format berikut (tanpa penjelasan tambahan di luar blok):

\`\`\`html
<!-- HTML elemen mograph (wadah berdimensi 100% x 100%) -->
<div class="scene-container">
  ...
</div>
\`\`\`

\`\`\`css
/* CSS ter-scope untuk scene ini */
.scene-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  display: flex;
  ...
}
\`\`\`

\`\`\`javascript
// Kode GSAP build: function(tl, root, ctx)
// tl adalah GSAP Timeline. root adalah wrapper element scene. ctx.dur adalah durasi.
const el = (sel) => root.querySelector(sel);
const els = (sel) => root.querySelectorAll(sel);

tl.from(el('.scene-container'), { opacity: 0, duration: 0.3 })
  ...
\`\`\`
`;
}
