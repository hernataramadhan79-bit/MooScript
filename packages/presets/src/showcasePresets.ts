import type { MooShowcasePreset } from './types';

export const SHOWCASE_PRESETS: MooShowcasePreset[] = [
  {
    slug: 'kinetic-typography',
    tabLabel: {
      en: 'Kinetic Text',
      id: 'Teks Kinetik'
    },
    title: {
      en: 'Kinetic Signal Slam',
      id: 'Hentakan Tipografi Kinetik'
    },
    seoTitle: {
      en: 'Kinetic Typography Motion Graphics Template (SVG + MooTween)',
      id: 'Template Animasi Tipografi Kinetik Online (SVG + MooTween)'
    },
    summary: {
      en: 'High-impact vertical opener combining radiating SVG radar rings, continuous camera push, and word-synced kinetic typography.',
      id: 'Pembuka vertikal berenergi tinggi yang memadukan cincin radar SVG, dorongan kamera berkelanjutan, dan tipografi kinetik sinkron suara.'
    },
    howItWorks: {
      en: [
        'Frame 0 starts as a complete poster: the central lime emblem and concentric SVG rings are immediately visible at t = 0.',
        'ctx.camera({ move: "push", handoff: "zoom" }) drives the entire .moo-camera stage forward and exits cleanly in the final 0.4 seconds.',
        'ctx.draw animates radial telemetry vectors outward while ctx.kinetic slams each headline word in sync with spoken word beats.'
      ],
      id: [
        'Frame 0 langsung tampil utuh sebagai poster: emblem tengah dan cincin konsentris SVG sudah terlihat sejak t = 0.',
        'ctx.camera({ move: "push", handoff: "zoom" }) menggerakkan panggung .moo-camera maju sepanjang shot lalu melakukan transisi zoom di 0.4 detik akhir.',
        'ctx.draw menggambar garis vektor keluar sementara ctx.kinetic menghantam setiap kata judul tepat mengikuti ketukan narasi.'
      ]
    },
    targetKeywords: {
      en: ['kinetic typography template', 'programmatic text animation', 'vertical shorts opener', 'svg motion graphics'],
      id: ['template tipografi kinetik', 'animasi teks koding', 'opening youtube shorts', 'motion graphics browser']
    },
    category: 'kinetic',
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    fps: 30,
    icon: 'bolt',
    shots: [
      {
        id: 'kt-shot-1',
        durationInSeconds: 3.6,
        narration: {
          en: 'Stop rendering motion graphics on slow cloud servers.',
          id: 'Berhenti merender motion graphics di server cloud yang lambat.'
        },
        focusWords: {
          en: ['motion', 'servers'],
          id: ['motion', 'lambat']
        },
        visualIntent: {
          en: 'Radiating vector core with bold kinetic slam headline in 9:16 frame',
          id: 'Inti vektor memancar dengan judul kinetik tegas dalam bingkai 9:16'
        },
        wordTimestamps: [
          { word: 'Berhenti', start: 0.1, end: 0.55 },
          { word: 'merender', start: 0.58, end: 1.05 },
          { word: 'motion', start: 1.1, end: 1.55 },
          { word: 'graphics', start: 1.58, end: 2.05 },
          { word: 'server', start: 2.1, end: 2.65 },
          { word: 'lambat', start: 2.7, end: 3.3 }
        ],
        palette: {
          bg: '#09090b',
          primary: '#e4e4e7',
          accent: '#84cc16',
          text: '#f4f4f6'
        },
        html: `<div class="scene-kt1">
  <div class="moo-camera" data-moo-layer="camera">
    <svg class="kt1-stage" data-moo-layer="radar-svg" viewBox="0 0 1080 1920">
      <g class="kt1-spokes" stroke="var(--moo-primary, #e4e4e7)" stroke-opacity="0.22" stroke-width="3" stroke-linecap="round" fill="none">
        <path d="M540 960 L180 520" />
        <path d="M540 960 L900 520" />
        <path d="M540 960 L150 960" />
        <path d="M540 960 L930 960" />
        <path d="M540 960 L210 1410" />
        <path d="M540 960 L870 1410" />
      </g>
      <circle class="kt1-wave" cx="540" cy="960" r="140" fill="none" stroke="var(--moo-accent, #84cc16)" stroke-width="6" />
      <circle class="kt1-orbit-ring" cx="540" cy="960" r="320" fill="none" stroke="var(--moo-primary, #e4e4e7)" stroke-opacity="0.18" stroke-width="2" stroke-dasharray="18 22" />
      <g class="kt1-nodes" fill="var(--moo-accent, #84cc16)">
        <circle cx="180" cy="520" r="16" />
        <circle cx="900" cy="520" r="16" />
        <circle cx="210" cy="1410" r="16" />
        <circle cx="870" cy="1410" r="16" />
      </g>
      <g class="kt1-core" data-moo-layer="hero-core">
        <rect x="444" y="864" width="192" height="192" rx="36" fill="#111116" stroke="var(--moo-accent, #84cc16)" stroke-width="8" />
        <polygon points="512,914 586,960 512,1006" fill="var(--moo-accent, #84cc16)" />
      </g>
    </svg>
    <div class="kt1-top" data-moo-layer="headline-top"><span>ZERO</span> <span>CLOUD</span></div>
    <div class="kt1-bottom" data-moo-layer="headline-bottom"><span>60 FPS</span> <span>LOCAL</span></div>
  </div>
</div>`,
        css: `.scene-kt1 { position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--moo-bg, #09090b); }
.scene-kt1 .moo-camera { position: absolute; inset: 0; transform-origin: 50% 50%; }
.scene-kt1 .kt1-stage { position: absolute; left: 0; top: 0; width: 100%; height: 100%; overflow: visible; }
.scene-kt1 .kt1-top { position: absolute; left: 60px; top: 250px; width: 960px; text-align: center; font: 800 132px/0.94 var(--moo-font-display, 'Syne', sans-serif); letter-spacing: -0.04em; color: var(--moo-text, #f4f4f6); }
.scene-kt1 .kt1-bottom { position: absolute; left: 60px; top: 1490px; width: 960px; text-align: center; font: 800 124px/0.94 var(--moo-font-display, 'Syne', sans-serif); letter-spacing: -0.04em; color: var(--moo-accent, #84cc16); }
.scene-kt1 .kt1-top span, .scene-kt1 .kt1-bottom span { display: inline-block; }`,
        buildJs: `const hit = ctx.beat('motion', 1.15);
ctx.camera({ move: 'push', handoff: 'zoom' });
ctx.particles({ count: 20, size: [4, 9], color: 'rgba(132,204,22,0.45)' });
ctx.hero('.kt1-core');
ctx.orbit('.kt1-orbit-ring', { turns: 0.35, cx: 540, cy: 960 });
shot.travel('.kt1-wave', { scale: 0.9, opacity: 0.85, pivotPoint: '540 960' }, { scale: 3.1, opacity: 0, dur: 1.25, curve: 'rush-out', loop: 2 }, 0.1);
ctx.draw('.kt1-spokes path', { at: 0.25, dur: 0.65, cascade: 0.08 });
ctx.pop('.kt1-nodes circle', { at: 0.75, cascade: 0.09 });
ctx.kinetic('.kt1-top', { style: 'slam', by: 'words', at: 0.2 });
ctx.kinetic('.kt1-bottom', { style: 'rise', by: 'words', at: hit });
ctx.punch('.kt1-core', { at: hit, scale: 1.24 });`
      },
      {
        id: 'kt-shot-2',
        durationInSeconds: 3.4,
        narration: {
          en: 'Every frame compiles directly to MP4, transparent WebM, or GIF in your tab.',
          id: 'Setiap frame dikompilasi langsung ke MP4, WebM transparan, atau GIF di tab Anda.'
        },
        focusWords: {
          en: ['MP4', 'WebM', 'GIF'],
          id: ['MP4', 'WebM', 'GIF']
        },
        visualIntent: {
          en: 'Precision equalizer bars rising with multi-format codec lockup',
          id: 'Batang spektrum presisi naik bersama penanda format ekspor'
        },
        wordTimestamps: [
          { word: 'Setiap', start: 0.1, end: 0.5 },
          { word: 'frame', start: 0.52, end: 0.9 },
          { word: 'MP4', start: 1.35, end: 1.8 },
          { word: 'WebM', start: 1.85, end: 2.35 },
          { word: 'GIF', start: 2.4, end: 2.95 }
        ],
        palette: {
          bg: '#09090b',
          primary: '#f4f4f6',
          accent: '#84cc16',
          text: '#f4f4f6'
        },
        html: `<div class="scene-kt2">
  <div class="moo-camera" data-moo-layer="camera">
    <svg class="kt2-svg" data-moo-layer="bars-svg" viewBox="0 0 1080 1920">
      <line x1="140" y1="1260" x2="940" y2="1260" stroke="#27272a" stroke-width="6" />
      <g class="kt2-bars">
        <rect class="kt2-bar" x="180" y="880" width="96" height="380" rx="14" fill="#27272a" />
        <rect class="kt2-bar" x="330" y="720" width="96" height="540" rx="14" fill="var(--moo-accent, #84cc16)" />
        <rect class="kt2-bar" x="480" y="560" width="96" height="700" rx="14" fill="#f4f4f6" />
        <rect class="kt2-bar" x="630" y="660" width="96" height="600" rx="14" fill="var(--moo-accent, #84cc16)" />
        <rect class="kt2-bar" x="780" y="800" width="96" height="460" rx="14" fill="#27272a" />
      </g>
    </svg>
    <div class="kt2-title" data-moo-layer="codec-title"><span>MP4</span> <span>WEBM</span> <span>GIF</span></div>
  </div>
</div>`,
        css: `.scene-kt2 { position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--moo-bg, #09090b); }
.scene-kt2 .moo-camera { position: absolute; inset: 0; transform-origin: 50% 55%; }
.scene-kt2 .kt2-svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.scene-kt2 .kt2-title { position: absolute; left: 60px; top: 280px; width: 960px; text-align: center; font: 800 116px/1 var(--moo-font-display, 'Syne', sans-serif); letter-spacing: -0.04em; color: var(--moo-text, #f4f4f6); }
.scene-kt2 .kt2-title span { display: inline-block; margin: 0 12px; }`,
        buildJs: `const hit = ctx.beat('MP4', 1.35);
ctx.camera({ move: 'pull', handoff: 'whip-up' });
shot.travel('.kt2-bar', { scaleY: 0.25, pivot: '50% 100%' }, { scaleY: 1, dur: 0.85, cascade: { gap: 0.09, from: 'middle' }, curve: 'overshoot-out(1.6)' }, 0);
ctx.kinetic('.kt2-title', { style: 'rise', by: 'words', at: 0.25 });
ctx.punch('.kt2-title', { at: hit, scale: 1.12 });`
      }
    ]
  },
  {
    slug: 'data-chart-animation',
    tabLabel: {
      en: 'Data Driven',
      id: 'Grafik Data'
    },
    title: {
      en: 'Deterministic Telemetry Chart',
      id: 'Animasi Grafik Pertumbuhan Deterministik'
    },
    seoTitle: {
      en: 'Animated Data Chart Video Generator (16:9 Programmatic SVG)',
      id: 'Generator Video Animasi Grafik Data Otomatis (16:9 SVG)'
    },
    summary: {
      en: 'Widescreen financial and product telemetry chart featuring progressive SVG spline drawing, rolling counters, and callout pins.',
      id: 'Grafik telemetri layar lebar dengan penggambaran kurva SVG bertahap, penghitung angka presisi, dan penanda titik puncak.'
    },
    howItWorks: {
      en: [
        'SVG grid baselines and initial bar silhouettes sit ready on Frame 0 so thumbnails and cover PNGs are never blank.',
        'ctx.draw progressively strokes the cubic-bezier trend curve across the 1920x1080 widescreen stage.',
        'ctx.count interpolates the primary metric from 0 to +284% using deterministic frame math without setTimeout drift.'
      ],
      id: [
        'Garis dasar grafik dan siluet awal sudah siap di Frame 0 sehingga thumbnail maupun Cover PNG selalu tajam.',
        'ctx.draw menggambar kurva tren cubic-bezier secara mulus melintasi kanvas 1920x1080.',
        'ctx.count menghitung kenaikan angka dari 0 ke +284% secara deterministik per frame tanpa meleset.'
      ]
    },
    targetKeywords: {
      en: ['animated chart video generator', 'programmatic data visualization video', 'svg chart to mp4', 'financial motion graphics'],
      id: ['buat video grafik animasi', 'animasi data ke mp4', 'visualisasi data bergerak', 'grafik pertumbuhan video']
    },
    category: 'data',
    aspectRatio: '16:9',
    width: 1920,
    height: 1080,
    fps: 30,
    icon: 'bar_chart',
    shots: [
      {
        id: 'dc-shot-1',
        durationInSeconds: 4.0,
        narration: {
          en: 'Output throughput climbed two hundred eighty four percent with hardware WebCodecs.',
          id: 'Kecepatan render melonjak dua ratus delapan puluh empat persen berkat akselerasi WebCodecs.'
        },
        focusWords: {
          en: ['two', 'eighty', 'WebCodecs'],
          id: ['melonjak', 'WebCodecs']
        },
        visualIntent: {
          en: '16:9 telemetry chart with rising columns, bezier trend line, and +284% counter',
          id: 'Grafik 16:9 dengan kolom naik, garis kurva tren, dan angka berjalan +284%'
        },
        wordTimestamps: [
          { word: 'Kecepatan', start: 0.1, end: 0.6 },
          { word: 'melonjak', start: 0.9, end: 1.45 },
          { word: 'persen', start: 2.1, end: 2.6 },
          { word: 'WebCodecs', start: 3.0, end: 3.7 }
        ],
        palette: {
          bg: '#09090b',
          primary: '#38bdf8',
          accent: '#84cc16',
          text: '#f4f4f6'
        },
        html: `<div class="scene-dc1">
  <div class="moo-camera" data-moo-layer="camera">
    <svg class="dc1-chart" data-moo-layer="chart-svg" viewBox="0 0 1920 1080">
      <g stroke="#27272a" stroke-width="2">
        <line x1="220" y1="860" x2="1720" y2="860" />
        <line x1="220" y1="680" x2="1720" y2="680" stroke-dasharray="10 14" />
        <line x1="220" y1="500" x2="1720" y2="500" stroke-dasharray="10 14" />
        <line x1="220" y1="320" x2="1720" y2="320" stroke-dasharray="10 14" />
      </g>
      <g class="dc1-cols">
        <rect class="dc1-col" x="300" y="710" width="130" height="150" rx="10" fill="#181820" />
        <rect class="dc1-col" x="560" y="620" width="130" height="240" rx="10" fill="#22222d" />
        <rect class="dc1-col" x="820" y="510" width="130" height="350" rx="10" fill="#272733" />
        <rect class="dc1-col" x="1080" y="390" width="130" height="470" rx="10" fill="#3f6212" />
        <rect class="dc1-col" x="1340" y="250" width="130" height="610" rx="10" fill="var(--moo-accent, #84cc16)" />
      </g>
      <path class="dc1-line" d="M365 690 C 520 650, 625 590, 885 480 S 1210 340, 1405 220" fill="none" stroke="#f4f4f6" stroke-width="10" stroke-linecap="round" />
      <g class="dc1-dots" fill="var(--moo-accent, #84cc16)" stroke="#09090b" stroke-width="6">
        <circle cx="365" cy="690" r="16" />
        <circle cx="625" cy="595" r="16" />
        <circle cx="885" cy="480" r="16" />
        <circle cx="1145" cy="360" r="16" />
        <circle class="dc1-peak" cx="1405" cy="220" r="22" />
      </g>
    </svg>
    <div class="dc1-metric" data-moo-layer="counter">+284%</div>
    <div class="dc1-label" data-moo-layer="label">THROUGHPUT</div>
  </div>
</div>`,
        css: `.scene-dc1 { position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--moo-bg, #09090b); }
.scene-dc1 .moo-camera { position: absolute; inset: 0; transform-origin: 55% 45%; }
.scene-dc1 .dc1-chart { position: absolute; inset: 0; width: 100%; height: 100%; }
.scene-dc1 .dc1-metric { position: absolute; left: 220px; top: 130px; font: 800 148px/1 var(--moo-font-display, 'Syne', sans-serif); letter-spacing: -0.04em; color: var(--moo-accent, #84cc16); font-variant-numeric: tabular-nums; }
.scene-dc1 .dc1-label { position: absolute; left: 228px; top: 288px; font: 700 42px/1 var(--moo-font-body, 'Plus Jakarta Sans', sans-serif); letter-spacing: 0.08em; color: var(--moo-text, #f4f4f6); }`,
        buildJs: `const peakBeat = ctx.beat('WebCodecs', 2.4);
ctx.camera({ move: 'push', handoff: 'whip-left' });
shot.travel('.dc1-col', { scaleY: 0.2, pivot: '50% 100%' }, { scaleY: 1, dur: 0.9, cascade: 0.1, curve: 'overshoot-out(1.4)' }, 0);
ctx.draw('.dc1-line', { at: 0.3, dur: 1.4 });
ctx.pop('.dc1-dots circle', { at: 0.55, cascade: 0.18 });
ctx.count('.dc1-metric', { from: 0, to: 284, prefix: '+', suffix: '%', at: 0.15, dur: 1.9 });
ctx.kinetic('.dc1-label', { style: 'rise', by: 'chars', at: 0.35 });
ctx.punch('.dc1-peak', { at: peakBeat, scale: 1.5 });`
      }
    ]
  },
  {
    slug: 'ai-code-walkthrough',
    tabLabel: {
      en: 'Procedural',
      id: 'Alur Kode'
    },
    title: {
      en: 'Seek-Only Engine Pipeline',
      id: 'Arsitektur Pipeline Mesin Seek-Only'
    },
    seoTitle: {
      en: 'Code Walkthrough & Architecture Diagram Video Template',
      id: 'Template Video Penjelasan Kode & Diagram Arsitektur Teknis'
    },
    summary: {
      en: 'Technical architecture diagram illustrating frame-indexed seek(t) evaluation flowing from MooTween tracks into WebCodecs frames.',
      id: 'Diagram arsitektur teknis yang memvisualisasikan evaluasi seek(t) per frame dari track MooTween menuju enkoder WebCodecs.'
    },
    howItWorks: {
      en: [
        'Three architectural SVG stages (Prompt, MooTween seek(t), and WebCodecs Muxer) anchor the 16:9 canvas from Frame 0.',
        'ctx.draw animates signal buses connecting each module while a luminous packet travels deterministically across nodes.',
        'ctx.count increments the discrete frame readout (f = 000 to f = 120) proving zero frame-drop rendering.'
      ],
      id: [
        'Tiga modul arsitektur SVG (Prompt, MooTween seek(t), dan WebCodecs Muxer) berdiri tegas di kanvas 16:9 sejak Frame 0.',
        'ctx.draw menyambungkan jalur sinyal antar modul sementara paket cahaya bergerak deterministik melintasi node.',
        'ctx.count menjalankan pembaca indeks frame (f = 000 hingga f = 120) yang membuktikan ketiadaan frame-drop.'
      ]
    },
    targetKeywords: {
      en: ['code walkthrough video generator', 'software architecture animation', 'developer explainer video tool', 'javascript to mp4'],
      id: ['video penjelasan koding', 'animasi diagram arsitektur', 'buat video tutorial programming', 'javascript ke mp4']
    },
    category: 'code',
    aspectRatio: '16:9',
    width: 1920,
    height: 1080,
    fps: 30,
    icon: 'terminal',
    shots: [
      {
        id: 'cw-shot-1',
        durationInSeconds: 4.2,
        narration: {
          en: 'MooTween evaluates every shot purely by seeking discrete frame timestamps.',
          id: 'MooTween mengevaluasi setiap adegan murni berdasarkan indeks waktu tiap frame.'
        },
        focusWords: {
          en: ['MooTween', 'discrete', 'frame'],
          id: ['MooTween', 'indeks', 'frame']
        },
        visualIntent: {
          en: 'Three-node SVG pipeline diagram with traveling frame packet and live f(frame) readout',
          id: 'Diagram pipeline SVG tiga simpul dengan paket sinyal berjalan dan indikator frame'
        },
        wordTimestamps: [
          { word: 'MooTween', start: 0.1, end: 0.65 },
          { word: 'mengevaluasi', start: 0.7, end: 1.3 },
          { word: 'indeks', start: 2.1, end: 2.65 },
          { word: 'frame', start: 3.1, end: 3.7 }
        ],
        palette: {
          bg: '#09090b',
          primary: '#a1a1aa',
          accent: '#84cc16',
          text: '#f4f4f6'
        },
        html: `<div class="scene-cw1">
  <div class="moo-camera" data-moo-layer="camera">
    <svg class="cw1-diagram" data-moo-layer="pipeline-svg" viewBox="0 0 1920 1080">
      <g class="cw1-wires" fill="none" stroke="var(--moo-accent, #84cc16)" stroke-width="8" stroke-linecap="round">
        <path d="M560 560 L750 560" />
        <path d="M1170 560 L1360 560" />
      </g>
      <g class="cw1-node1" data-moo-layer="node-script">
        <rect x="180" y="420" width="380" height="280" rx="24" fill="#111116" stroke="#3f3f46" stroke-width="4" />
        <text x="370" y="535" text-anchor="middle" fill="#a1a1aa" font-family="JetBrains Mono, monospace" font-size="34" font-weight="700">shot.go()</text>
        <text x="370" y="605" text-anchor="middle" fill="#f4f4f6" font-family="Plus Jakarta Sans, sans-serif" font-size="44" font-weight="800">SCENE CODE</text>
      </g>
      <g class="cw1-node2" data-moo-layer="node-engine">
        <rect x="750" y="380" width="420" height="360" rx="28" fill="#141a0d" stroke="var(--moo-accent, #84cc16)" stroke-width="6" />
        <text x="960" y="520" text-anchor="middle" fill="#84cc16" font-family="JetBrains Mono, monospace" font-size="38" font-weight="700">seek(f / fps)</text>
        <text x="960" y="605" text-anchor="middle" fill="#f4f4f6" font-family="Syne, sans-serif" font-size="52" font-weight="800">MOOTWEEN</text>
      </g>
      <g class="cw1-node3" data-moo-layer="node-muxer">
        <rect x="1360" y="420" width="380" height="280" rx="24" fill="#111116" stroke="#3f3f46" stroke-width="4" />
        <text x="1550" y="535" text-anchor="middle" fill="#a1a1aa" font-family="JetBrains Mono, monospace" font-size="34" font-weight="700">VideoEncoder</text>
        <text x="1550" y="605" text-anchor="middle" fill="#f4f4f6" font-family="Plus Jakarta Sans, sans-serif" font-size="44" font-weight="800">MP4 / WEBM</text>
      </g>
      <circle class="cw1-packet" cx="560" cy="560" r="20" fill="#84cc16" />
    </svg>
    <div class="cw1-title" data-moo-layer="headline"><span>DETERMINISTIC</span> <span>PIPELINE</span></div>
    <div class="cw1-frame" data-moo-layer="frame-counter">FRAME 120</div>
  </div>
</div>`,
        css: `.scene-cw1 { position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--moo-bg, #09090b); }
.scene-cw1 .moo-camera { position: absolute; inset: 0; transform-origin: 50% 50%; }
.scene-cw1 .cw1-diagram { position: absolute; inset: 0; width: 100%; height: 100%; }
.scene-cw1 .cw1-title { position: absolute; left: 180px; top: 148px; font: 800 68px/1 var(--moo-font-display, 'Plus Jakarta Sans', sans-serif); letter-spacing: -0.03em; color: var(--moo-text, #f4f4f6); }
.scene-cw1 .cw1-title span { display: inline-block; margin-right: 18px; }
.scene-cw1 .cw1-frame { position: absolute; right: 180px; top: 158px; font: 700 44px/1 'JetBrains Mono', monospace; color: var(--moo-accent, #84cc16); font-variant-numeric: tabular-nums; }`,
        buildJs: `const beat = ctx.beat('indeks', 2.1);
ctx.camera({ move: 'pan-right', handoff: 'zoom' });
ctx.hero('.cw1-node2');
ctx.draw('.cw1-wires path', { at: 0.3, dur: 0.75, cascade: 0.35 });
shot.travel('.cw1-packet', { attrs: { cx: 560 }, opacity: 1 }, { attrs: { cx: 1360 }, opacity: 1, dur: 1.6, curve: 'smooth-inout', loop: 2 }, 0.35);
ctx.kinetic('.cw1-title', { style: 'rise', by: 'words', at: 0.15 });
ctx.count('.cw1-frame', { from: 1, to: 120, prefix: 'FRAME ', at: 0.1, dur: 3.4 });
ctx.punch('.cw1-node2', { at: beat, scale: 1.1 });`
      }
    ]
  },
  {
    slug: 'faceless-shorts-hook',
    tabLabel: {
      en: 'Shorts Hook',
      id: 'Hook Shorts'
    },
    title: {
      en: 'Three-Second Retention Hook',
      id: 'Hook Retensi Tiga Detik'
    },
    seoTitle: {
      en: 'Faceless YouTube Shorts & Reels Hook Template (9:16)',
      id: 'Template Video Edukasi Faceless YouTube Shorts & Reels (9:16)'
    },
    summary: {
      en: 'Two-shot vertical sequence built for faceless educational channels, pairing an animated precision dial with a bold comparison reveal.',
      id: 'Rangkaian vertikal dua adegan untuk kanal edukasi faceless, memadukan dial waktu presisi dengan pengungkapan fakta kontras.'
    },
    howItWorks: {
      en: [
        'Opens immediately with an oversized rotating SVG dial at t = 0 to arrest scroll velocity inside the first 500 milliseconds.',
        'Pairs procedural Auto-SFX hits (ctx.punch + ctx.pop) with spoken word timestamps for crisp audio-visual lock.',
        'Ready to layer over uploaded B-roll video or export in 9:16, 1:1, and 16:9 simultaneously via Multi-Format Queue.'
      ],
      id: [
        'Langsung dibuka dengan dial SVG besar yang berputar sejak t = 0 untuk menghentikan guliran jempol di 500 milidetik pertama.',
        'Memadukan pemicu Auto-SFX (ctx.punch + ctx.pop) dengan penanda waktu kata agar visual dan audio terkunci rapat.',
        'Siap ditumpuk di atas video B-roll atau diekspor serentak ke 9:16, 1:1, dan 16:9 melalui antrean multi-format.'
      ]
    },
    targetKeywords: {
      en: ['faceless youtube shorts generator', 'tiktok educational video template', 'retention hook animation', 'automated short video maker'],
      id: ['aplikasi pembuat video shorts faceless', 'template video fakta tiktok', 'animasi edukasi otomatis', 'bikin konten tanpa wajah']
    },
    category: 'story',
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    fps: 30,
    icon: 'movie_filter',
    shots: [
      {
        id: 'fs-shot-1',
        durationInSeconds: 3.4,
        narration: {
          en: 'Viewers decide in three seconds whether to watch or swipe away.',
          id: 'Penonton memutuskan dalam tiga detik pertama untuk lanjut menonton atau lewat.'
        },
        focusWords: {
          en: ['three', 'seconds'],
          id: ['tiga', 'detik']
        },
        visualIntent: {
          en: 'Giant rotating stopwatch ring with 3.0s focal number in vertical stage',
          id: 'Cincin stopwatch besar berputar dengan angka fokus 3.0s di panggung vertikal'
        },
        wordTimestamps: [
          { word: 'Penonton', start: 0.1, end: 0.6 },
          { word: 'tiga', start: 1.15, end: 1.55 },
          { word: 'detik', start: 1.58, end: 2.05 },
          { word: 'menonton', start: 2.3, end: 2.95 }
        ],
        palette: {
          bg: '#09090b',
          primary: '#f59e0b',
          accent: '#84cc16',
          text: '#f4f4f6'
        },
        html: `<div class="scene-fs1">
  <div class="moo-camera" data-moo-layer="camera">
    <svg class="fs1-dial" data-moo-layer="dial-svg" viewBox="0 0 1080 1920">
      <circle cx="540" cy="980" r="360" fill="none" stroke="#27272a" stroke-width="24" />
      <circle class="fs1-arc" cx="540" cy="980" r="360" fill="none" stroke="var(--moo-accent, #84cc16)" stroke-width="24" stroke-linecap="round" transform="rotate(-90 540 980)" />
      <g class="fs1-ticks" stroke="#a1a1aa" stroke-width="6">
        <line x1="540" y1="560" x2="540" y2="600" />
        <line x1="960" y1="980" x2="920" y2="980" />
        <line x1="540" y1="1400" x2="540" y2="1360" />
        <line x1="120" y1="980" x2="160" y2="980" />
      </g>
    </svg>
    <div class="fs1-num" data-moo-layer="timer-num">3.0s</div>
    <div class="fs1-head" data-moo-layer="hook-headline"><span>FIRST</span> <span>THREE</span> <span>SECONDS</span></div>
  </div>
</div>`,
        css: `.scene-fs1 { position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--moo-bg, #09090b); }
.scene-fs1 .moo-camera { position: absolute; inset: 0; transform-origin: 50% 51%; }
.scene-fs1 .fs1-dial { position: absolute; inset: 0; width: 100%; height: 100%; }
.scene-fs1 .fs1-num { position: absolute; left: 0; top: 885px; width: 1080px; text-align: center; font: 800 184px/1 var(--moo-font-display, 'Syne', sans-serif); color: var(--moo-accent, #84cc16); font-variant-numeric: tabular-nums; }
.scene-fs1 .fs1-head { position: absolute; left: 80px; top: 270px; width: 920px; text-align: center; font: 800 104px/0.98 var(--moo-font-display, 'Syne', sans-serif); letter-spacing: -0.03em; color: var(--moo-text, #f4f4f6); }
.scene-fs1 .fs1-head span { display: inline-block; margin: 0 8px; }`,
        buildJs: `const hit = ctx.beat('tiga', 1.15);
ctx.camera({ move: 'push', handoff: 'zoom' });
ctx.hero('.fs1-num');
ctx.draw('.fs1-arc', { at: 0.1, dur: 2.6 });
ctx.orbit('.fs1-ticks', { turns: 0.25, cx: 540, cy: 980 });
ctx.kinetic('.fs1-head', { style: 'slam', by: 'words', at: 0.2 });
ctx.punch('.fs1-num', { at: hit, scale: 1.22 });`
      }
    ]
  }
];

export function getShowcasePreset(slug: string): MooShowcasePreset | undefined {
  return SHOWCASE_PRESETS.find((preset) => preset.slug === slug);
}
