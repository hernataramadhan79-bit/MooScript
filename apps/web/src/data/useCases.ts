import type { Locale } from '../config/site';
import type { FaqItem } from './faqs';

export interface UseCasePillar {
  slug: string;
  presetSlug: string;
  shortTitle: Record<Locale, string>;
  cardSummary: Record<Locale, string>;
  seoTitle: Record<Locale, string>;
  seoDescription: Record<Locale, string>;
  keywords: Record<Locale, string[]>;
  headline: Record<Locale, string>;
  lead: Record<Locale, string>;
  architectureTitle: Record<Locale, string>;
  architectureParagraphs: Record<Locale, string[]>;
  codeTitle: Record<Locale, string>;
  codeSnippet: string;
  highlightsTitle: Record<Locale, string>;
  highlights: Record<Locale, { title: string; detail: string }[]>;
  faqs: Record<Locale, FaqItem[]>;
}

export const USE_CASE_PILLARS: UseCasePillar[] = [
  {
    slug: 'code-to-video',
    presetSlug: 'ai-code-walkthrough',
    shortTitle: {
      en: 'Code to Video',
      id: 'Kode ke Video'
    },
    cardSummary: {
      en: 'Compile SVG, scoped CSS, and MooTween timelines directly to MP4 or WebM Alpha in browser.',
      id: 'Kompilasi SVG, CSS terisolasi, dan timeline MooTween langsung menjadi MP4 atau WebM Alpha.'
    },
    seoTitle: {
      en: 'Code to Video in Browser: JavaScript & SVG to MP4 | MooScript',
      id: 'Animasi Koding di Browser: Ubah Kode JavaScript & SVG ke MP4 | MooScript'
    },
    seoDescription: {
      en: 'Browser-based programmatic motion graphics studio and zero-install Remotion alternative. Write deterministic MooTween timelines and encode MP4, WebM Alpha, or GIF via WebCodecs.',
      id: 'Alternatif Remotion berbasis browser tanpa instalasi Node.js. Tulis animasi koding SVG dengan MooTween dan ekspor ke MP4, WebM Transparan, atau GIF lewat WebCodecs.'
    },
    keywords: {
      en: [
        'programmatic motion graphics',
        'javascript to mp4',
        'browser-based remotion alternative',
        'svg animation to video',
        'webcodecs video renderer'
      ],
      id: [
        'animasi koding',
        'javascript ke mp4',
        'alternatif remotion di browser',
        'motion graphics berbasis kode',
        'render video webcodecs'
      ]
    },
    headline: {
      en: 'JavaScript and SVG to MP4',
      id: 'Ubah kode SVG ke MP4'
    },
    lead: {
      en: 'Skip Node.js bundlers, headless Chromium farms, and cloud render queues. MooScript turns pure HTML, SVG, and deterministic MooTween scripts into frame-accurate MP4, WebM Alpha, and GIF masters right inside your browser.',
      id: 'Tanpa setup Node.js, instalasi FFmpeg, ataupun biaya server cloud. MooScript mengubah HTML, SVG, dan skrip deterministik MooTween menjadi video MP4, WebM Alpha, serta GIF presisi tinggi langsung di tab browser Anda.'
    },
    architectureTitle: {
      en: 'Deterministic frame math',
      id: 'Matematika frame presisi'
    },
    architectureParagraphs: {
      en: [
        'Screen recorders drop frames whenever the main thread stutters. MooScript never records real-time wall-clock playback during export. Instead, its exporter steps your MooTween timeline mathematically at exact t = frame / fps intervals, waits for vector and B-roll frames to settle, and feeds raw VideoFrame buffers to your GPU via WebCodecs.',
        'Every shot runs inside an isolated CSS scope with built-in spring physics, camera pan/zoom rigs, SVG stroke-dashoffset drawing, and automatic whoosh or impact sound effects.'
      ],
      id: [
        'Perekam layar biasa sering kehilangan frame saat beban CPU naik. MooScript tidak merekam layar secara real-time saat ekspor, melainkan memajukan posisi waktu t = frame / fps secara matematis, menggambar ulang kanvas vektor beserta B-roll, lalu mengirim VideoFrame langsung ke encoder GPU melalui WebCodecs.',
        'Setiap adegan berjalan di dalam ruang lingkup CSS tersendiri lengkap dengan fisika pegas, kamera virtual pan/zoom, animasi garis SVG, serta efek suara prosedural otomatis.'
      ]
    },
    codeTitle: {
      en: 'Pure MooTween shot module',
      id: 'Contoh modul shot MooTween'
    },
    codeSnippet: `// Runs inside (shot, root, ctx, MooTween) - zero GSAP needed
ctx.cameraMove('.moo-camera', {
  fromScale: 1.08, toScale: 1.0,
  fromY: 28, toY: 0, start: 0, dur: 3.4
});

ctx.drawPath('#trace-wire', { start: 0.1, dur: 0.85 });
shot.arrive('#node-badge', { scale: [0.7, 1], y: [32, 0], ease: 'spring(1.1, 0.7)' }, 0.25);
ctx.counter('#fps-metric', 0, 60, { start: 0.4, dur: 1.1, suffix: ' fps' });`,
    highlightsTitle: {
      en: 'Built for technical creators',
      id: 'Dirancang untuk kreator teknis'
    },
    highlights: {
      en: [
        {
          title: 'Zero-install browser runtime',
          detail: 'Open app.mooscript.web.id, edit HTML/CSS/JS live, and inspect layers without cloning a 900 MB repo.'
        },
        {
          title: 'Transparent VP9 Alpha overlays',
          detail: 'Export clean alpha-channel WebM clips ready to drop over code screencasts in DaVinci Resolve or Premiere.'
        },
        {
          title: 'Multi-format batch queue',
          detail: 'Queue 16:9 YouTube, 9:16 Shorts, and 1:1 feed masters from a single timeline in one pass.'
        }
      ],
      id: [
        {
          title: 'Langsung jalan di browser',
          detail: 'Buka app.mooscript.web.id, sunting HTML/CSS/JS secara interaktif tanpa mengunduh dependensi ratusan megabita.'
        },
        {
          title: 'Overlay transparan WebM Alpha',
          detail: 'Hasilkan video kanal alfa bersih untuk ditumpuk di atas rekaman layar koding pada DaVinci Resolve atau CapCut.'
        },
        {
          title: 'Antrean multi-format',
          detail: 'Ekspor versi 16:9 YouTube, 9:16 Shorts, dan 1:1 sekaligus dari satu proyek yang sama.'
        }
      ]
    },
    faqs: {
      en: [
        {
          question: 'How is MooScript different from Remotion?',
          answer:
            'Remotion compiles React projects via Node.js and renders through headless Chromium or AWS Lambda. MooScript runs entirely in your browser with zero CLI setup, native WebCodecs GPU encoding, offline Piper TTS, and built-in multi-track timeline editing.'
        },
        {
          question: 'Can I edit individual layers visually after writing code?',
          answer:
            'Yes. MooScript parses your DOM and SVG layers so you can drag, align, recolor, and retime entrance/exit bars on the visual stage without rewriting coordinates by hand.'
        }
      ],
      id: [
        {
          question: 'Apa bedanya MooScript dengan Remotion?',
          answer:
            'Remotion membutuhkan lingkungan Node.js, bundler React, serta FFmpeg atau server cloud. MooScript berjalan penuh di browser tanpa instalasi CLI, memakai akselerasi GPU WebCodecs lokal, memiliki TTS offline, dan dilengkapi timeline visual multi-track.'
        },
        {
          question: 'Apakah elemen kode tetap bisa digeser secara visual di panggung?',
          answer:
            'Bisa. MooScript membaca struktur layer SVG dan HTML Anda sehingga posisi, perataan, warna, dan durasi masuk/keluar tiap elemen dapat diatur langsung dari panggung dan timeline.'
        }
      ]
    }
  },
  {
    slug: 'ai-motion-graphics',
    presetSlug: 'kinetic-typography',
    shortTitle: {
      en: 'AI Motion Graphics',
      id: 'Motion Graphics AI'
    },
    cardSummary: {
      en: 'Turn Claude, ChatGPT, or Gemini prompts into validated SVG choreography with zero slide-deck slop.',
      id: 'Ubah prompt Claude, ChatGPT, atau Gemini menjadi koreografi SVG tajam bebas tampilan slide kaku.'
    },
    seoTitle: {
      en: 'AI Motion Graphics Generator: Text to Animated Video | MooScript',
      id: 'Generator Motion Graphics AI: Buat Video Animasi Pakai AI | MooScript'
    },
    seoDescription: {
      en: 'Generate crisp vector AI motion graphics instead of blurry diffusion video. Prompt any LLM or connect your API key to compile linted MooTween SVG shots in browser.',
      id: 'Buat video motion graphics vektor yang tajam dengan AI, bukan video difusi buram. Hubungkan API LLM atau salin prompt resmi MooScript untuk merender MP4 di browser.'
    },
    keywords: {
      en: [
        'ai motion graphics generator',
        'text to motion graphics script',
        'claude motion graphics prompt',
        'vector ai video generator',
        'anti-slide motion linter'
      ],
      id: [
        'buat video animasi pakai ai',
        'ai motion graphics indonesia',
        'prompt ai animasi teks',
        'generator video vektor ai',
        'teks ke video animasi gratis'
      ]
    },
    headline: {
      en: 'Vector AI motion graphics',
      id: 'Motion graphics vektor AI'
    },
    lead: {
      en: 'Pixel-diffusion AI generators garble typography, numbers, and brand logos. MooScript pairs LLMs with deterministic SVG geometry and an Anti-Slide linter so text stays razor-sharp at 1080p and 60fps.',
      id: 'Generator video AI berbasis piksel sering merusak ejaan teks, angka, dan logo brand. MooScript memadukan kecerdasan LLM dengan geometri vektor SVG dan Linter Anti-Slide agar teks selalu tajam di resolusi penuh.'
    },
    architectureTitle: {
      en: 'Guarded by an Anti-Slide linter',
      id: 'Dijaga Linter Anti-Slide'
    },
    architectureParagraphs: {
      en: [
        'Left unchecked, language models output boring HTML bullet lists that fade upward like a PowerPoint deck. MooScript inspects every generated shot across nine motion criteria: camera travel, focal hierarchy, custom SVG geometry, word-beat timing, and scene handoffs.',
        'Whenever a shot scores like a static slide or references forbidden APIs, Studio automatically triggers a structured motion rewrite before it reaches your timeline.'
      ],
      id: [
        'Tanpa pengawasan, model AI cenderung menghasilkan daftar poin kaku mirip slide presentasi. MooScript memeriksa setiap kode adegan pada sembilan aturan sinematik: pergerakan kamera, kedalaman bidang SVG, sinkronisasi kata, hingga kesinambungan antar-adegan.',
        'Jika hasil AI terdeteksi datar atau melanggar aturan keamanan sandbox, mesin otomatis meminta penulisan ulang sinematik sebelum masuk ke timeline.'
      ]
    },
    codeTitle: {
      en: 'Word-synced AI kinetic shot',
      id: 'Adegan kinetik tersinkron suara'
    },
    codeSnippet: `// Word-level timing synced to voiceover timestamps
ctx.cameraMove('.moo-camera', {
  fromScale: 1.06, toScale: 1.0,
  fromX: -18, toX: 0, start: 0, dur: 3.2
});

ctx.wordBeat('#headline-key', 'WebCodecs', { scale: 1.14, accent: true });
ctx.pop('#metric-pill', { at: 0.45, scale: 1.08 });
ctx.flash({ at: 1.15, opacity: 0.16 });`,
    highlightsTitle: {
      en: 'Two ways to prompt',
      id: 'Dua cara memakai AI'
    },
    highlights: {
      en: [
        {
          title: 'Direct BYOK inside Studio',
          detail: 'Connect Gemini, OpenAI, Anthropic, DeepSeek, Groq, or OpenRouter keys stored locally in your browser.'
        },
        {
          title: 'Copy-paste chatbot workflow',
          detail: 'Copy the Official MooScript System Prompt into free ChatGPT or Claude tabs and paste the shot straight into Studio.'
        },
        {
          title: 'Brand Kit lock',
          detail: 'Keep your brand palette, custom uploaded WOFF2/TTF fonts, watermark, and intro/outro cards consistent on every AI shot.'
        }
      ],
      id: [
        {
          title: 'Integrasi API langsung (BYOK)',
          detail: 'Hubungkan kunci API Gemini, OpenAI, Claude, DeepSeek, Groq, atau OpenRouter yang tersimpan aman di perangkat lokal.'
        },
        {
          title: 'Salin-tempel dari chatbot gratis',
          detail: 'Salin System Prompt resmi MooScript ke ChatGPT atau Claude versi web lalu tempel kodenya ke editor Studio.'
        },
        {
          title: 'Konsistensi Brand Kit',
          detail: 'Kunci palet warna, font kustom unggahan sendiri, logo watermark, serta kartu intro dan outro di semua adegan AI.'
        }
      ]
    },
    faqs: {
      en: [
        {
          question: 'Do I need a paid AI subscription to use MooScript?',
          answer:
            'No. Studio includes an instant offline procedural compiler, reusable Shot Templates, starter presets, and local Piper neural TTS so you can produce complete videos without spending a cent on API tokens.'
        },
        {
          question: 'Are my API keys sent to a MooScript backend?',
          answer:
            'Never. MooScript has no backend server. Your keys stay in browser storage and call your chosen LLM provider directly over HTTPS.'
        }
      ],
      id: [
        {
          question: 'Apakah wajib punya API key berbayar untuk memakai MooScript?',
          answer:
            'Tidak wajib. MooScript menyediakan kompilator visual instan tanpa API, koleksi Shot Templates, preset siap pakai, serta suara TTS offline Piper gratis.'
        },
        {
          question: 'Apakah kunci API saya dikirim ke server MooScript?',
          answer:
            'Tidak pernah. MooScript murni berjalan di sisi klien tanpa server perantara; panggilan API dikirim langsung dari browser Anda ke penyedia model AI.'
        }
      ]
    }
  },
  {
    slug: 'faceless-shorts-automation',
    presetSlug: 'faceless-shorts-hook',
    shortTitle: {
      en: 'Faceless Shorts',
      id: 'Otomasi Shorts & Reels'
    },
    cardSummary: {
      en: 'Pair offline neural voiceovers, 300 MB B-roll, beat-synced cuts, and kinetic captions for 9:16 channels.',
      id: 'Padukan suara neural offline, B-roll 300 MB, potong beat otomatis, dan teks kinetik untuk kanal 9:16.'
    },
    seoTitle: {
      en: 'Faceless YouTube Shorts & Reels Automation Tool | MooScript',
      id: 'Alat Otomasi Video YouTube Shorts, TikTok & Edukasi | MooScript'
    },
    seoDescription: {
      en: 'Build high-retention 9:16 faceless YouTube Shorts, TikToks, and Reels in your browser with offline Piper TTS, 300 MB B-roll, Auto-SFX, beat-synced cuts, and kinetic captions.',
      id: 'Buat video edukasi, fakta, dan YouTube Shorts tanpa wajah secara cepat di browser dengan suara TTS offline, B-roll 300 MB, Auto-SFX, dan tipografi kinetik.'
    },
    keywords: {
      en: [
        'youtube shorts automation tool',
        'kinetic typography generator online',
        'faceless video maker free',
        'tiktok educational video editor',
        'offline tts video generator'
      ],
      id: [
        'otomatis bikin video edukasi',
        'pembuat youtube shorts tanpa wajah',
        'generator tipografi kinetik online',
        'aplikasi pembuat video fakta tiktok',
        'tts bahasa indonesia gratis untuk video'
      ]
    },
    headline: {
      en: 'Faceless Shorts at 60fps',
      id: 'Otomasi Shorts tanpa wajah'
    },
    lead: {
      en: 'Turn a plain script into a retention-engineered 9:16 short: neural voice-over, word-accurate kinetic hooks, 300 MB B-roll footage, procedural whoosh/impact SFX, and beat-locked cuts.',
      id: 'Ubah naskah teks biasa menjadi video vertikal 9:16 berdaya ikat tinggi lengkap dengan narasi suara natural, kait visual detik pertama, latar B-roll 300 MB, Auto-SFX, dan potongan sesuai beat musik.'
    },
    architectureTitle: {
      en: 'Audio-first retention pipeline',
      id: 'Alur produksi berbasis ritme suara'
    },
    architectureParagraphs: {
      en: [
        'Short-form viewers swipe away within two seconds when visuals lag behind the voice. MooScript generates per-scene voiceovers (via local Piper ONNX, OpenAI, ElevenLabs, or Gemini TTS), aligns word timestamps, lets you retake or trim individual scene takes, and locks kinetic focal words to exact spoken syllables.',
        'Drop background music onto the audio rack to detect beat transients automatically, click Snap Cuts to Beat, and let Procedural Auto-SFX place subtle whooshes, pops, and impacts on every visual accent.'
      ],
      id: [
        'Penonton video pendek mudah melewati konten yang ritmenya lambat di dua detik awal. MooScript merakit narasi suara per adegan (lewat Piper ONNX offline, OpenAI, ElevenLabs, atau Gemini), memetakan ketukan kata secara presisi, dan memungkinkan rekaman ulang per kalimat.',
        'Tambahkan musik latar untuk mendeteksi garis ketukan secara otomatis, tekan Potongan ke Ketukan, lalu aktifkan Auto-SFX agar setiap transisi memiliki efek suara whoosh dan pop yang pas.'
      ]
    },
    codeTitle: {
      en: 'First-second retention hook',
      id: 'Kait visual detik pertama'
    },
    codeSnippet: `// Painted immediately at t = 0 so frame 000 hooks the viewer
shot.set('#hook-banner', { opacity: 1, scale: 1 });
ctx.punch('#hook-number', { at: 0.18, scale: 1.18 });
ctx.drawPath('#progress-arc', { start: 0.1, dur: 1.2 });
ctx.wordBeat('#cta-chip', '3Detik', { scale: 1.12, accent: true });`,
    highlightsTitle: {
      en: 'Publish everywhere in one pass',
      id: 'Siap unggah ke semua platform'
    },
    highlights: {
      en: [
        {
          title: '300 MB B-Roll under kinetic SVG',
          detail: 'Drop gameplay, nature, or archival MP4 clips behind transparent vector callouts with zero cloud upload wait.'
        },
        {
          title: '9:16 + 16:9 + 1:1 + Cover PNG',
          detail: 'Export vertical Shorts, widescreen recaps, square posts, and thumbnail PNGs from one timeline.'
        },
        {
          title: 'SRT & WebVTT subtitle files',
          detail: 'Download clean word-aligned caption tracks alongside burned-in dynamic subtitles.'
        }
      ],
      id: [
        {
          title: 'Lapisan B-Roll hingga 300 MB',
          detail: 'Pasang rekaman video latar di bawah grafis vektor transparan secara instan tanpa mengunggah ke internet.'
        },
        {
          title: 'Ekspor 9:16, 16:9, 1:1 & Cover PNG',
          detail: 'Cetak video vertikal, lanskap, persegi, sekaligus gambar sampul PNG dari satu timeline kerja.'
        },
        {
          title: 'Ekspor takarir SRT & WebVTT',
          detail: 'Unduh berkas subtitle terpisah yang sudah selaras dengan ucapan narator selain teks di dalam video.'
        }
      ]
    },
    faqs: {
      en: [
        {
          question: 'Is there any watermark on exported Shorts?',
          answer:
            'Never, unless you intentionally enable your own logo watermark inside MooScript Studio Brand Kit.'
        },
        {
          question: 'Can I re-record or trim just one scene voiceover without regenerating everything?',
          answer:
            'Yes. Each scene has independent voice retake, upload, and trim controls while keeping adjacent shots untouched.'
        }
      ],
      id: [
        {
          question: 'Apakah hasil ekspor MooScript diberi watermark paksa?',
          answer:
            'Tidak sama sekali. Watermark hanya muncul apabila Anda sendiri yang mengaktifkan logo kanal Anda melalui fitur Brand Kit.'
        },
        {
          question: 'Bisakah saya mengganti suara satu adegan saja tanpa mengulang seluruh proyek?',
          answer:
            'Bisa. Setiap adegan memiliki fitur rekam ulang dan pemangkasan suara tersendiri tanpa merusak adegan lainnya.'
        }
      ]
    }
  },
  {
    slug: 'data-visualization-video',
    presetSlug: 'data-chart-animation',
    shortTitle: {
      en: 'Data Chart Video',
      id: 'Video Grafik Data'
    },
    cardSummary: {
      en: 'Animate bar races, telemetry lines, KPI counters, and financial breakdowns with exact SVG coordinates.',
      id: 'Animasikan grafik batang, kurva telemetri, angka KPI, dan laporan finansial dengan koordinat SVG presisi.'
    },
    seoTitle: {
      en: 'Animated Chart Generator & Programmatic Data Video | MooScript',
      id: 'Generator Animasi Grafik Data & Video Statistik | MooScript'
    },
    seoDescription: {
      en: 'Create crisp 60fps animated charts, KPI counters, and programmatic data visualization videos in your browser. Export MP4, transparent WebM overlays, or GIF.',
      id: 'Buat video animasi grafik data, pertumbuhan metrik KPI, dan visualisasi statistik 60fps yang tajam langsung di browser. Ekspor ke MP4, WebM Alpha, atau GIF.'
    },
    keywords: {
      en: [
        'animated chart generator',
        'programmatic data video',
        'svg chart animation to mp4',
        'kpi counter video maker',
        'transparent chart overlay webm'
      ],
      id: [
        'animasi grafik data',
        'pembuat video statistik',
        'grafik bergerak untuk presentasi video',
        'overlay grafik transparan video',
        'visualisasi data animasi online'
      ]
    },
    headline: {
      en: 'Programmatic data charts',
      id: 'Animasi grafik data presisi'
    },
    lead: {
      en: 'Turn raw benchmarks, revenue milestones, and engineering telemetry into crisp SVG chart animations with tabular numerals, spring-driven bars, and zero compression blur.',
      id: 'Ubah angka laporan keuangan, hasil benchmark, dan statistik riset menjadi video grafik SVG 60fps dengan angka presisi, kurva halus, dan kualitas tajam.'
    },
    architectureTitle: {
      en: 'Exact coordinates, tabular figures',
      id: 'Koordinat pasti, angka sejajar'
    },
    architectureParagraphs: {
      en: [
        'Chart animations fail when numbers jitter horizontally or axes blur under raster scaling. MooScript renders real SVG paths, polylines, and tabular-numeral counters inside a 1080p coordinate grid before encoding straight to H.264 MP4 or VP9 Alpha.',
        'Need to drop an animated chart over a talking-head interview? Toggle Transparent WebM export and bring the alpha-channel chart straight into your NLE timeline.'
      ],
      id: [
        'Animasi grafik sering terlihat amatir saat digit angka bergeser-geser atau garis sumbu tampak pecah. MooScript menggambar jalur SVG murni dan penghitung angka berlebar tetap di ruang koordinat penuh sebelum dikodekan ke MP4 atau WebM Alpha.',
        'Ingin menaruh grafik bergerak di samping wajah pembicara? Ekspor sebagai WebM Transparan dan tempel langsung di atas video wawancara pada aplikasi edit Anda.'
      ]
    },
    codeTitle: {
      en: 'Telemetry line & KPI counter',
      id: 'Kurva telemetri & angka KPI'
    },
    codeSnippet: `// Staggered bar growth + stroke reveal + tabular counter
shot.stagger('.rev-bar', {
  scaleY: [0, 1], opacity: [0.2, 1],
  dur: 0.65, stagger: 0.1, ease: 'outExpo'
}, 0.15);

ctx.drawPath('#trend-curve', { start: 0.35, dur: 1.1 });
ctx.counter('#arr-total', 12, 94, { start: 0.3, dur: 1.25, prefix: '$', suffix: 'M' });`,
    highlightsTitle: {
      en: 'Designed for analysts & storytellers',
      id: 'Untuk analis, jurnalis & kreator'
    },
    highlights: {
      en: [
        {
          title: 'Live ctx.counter() & ctx.drawPath()',
          detail: 'Built-in helpers animate numeric readouts, currencies, percentages, and SVG trend lines in two lines of code.'
        },
        {
          title: 'Animated GIF for docs & newsletters',
          detail: 'Export quantized LZW GIFs directly alongside MP4 for Substack posts, GitHub READMEs, and release notes.'
        },
        {
          title: '100% private confidential numbers',
          detail: 'Pre-announcement financial metrics and internal benchmarks never leave your local browser memory.'
        }
      ],
      id: [
        {
          title: 'Helper ctx.counter() & ctx.drawPath()',
          detail: 'Fungsi bawaan untuk menganimasikan mata uang, persentase, dan garis tren SVG cukup dalam dua baris kode.'
        },
        {
          title: 'Ekspor GIF untuk artikel & README',
          detail: 'Hasilkan berkas GIF terkompresi rapi untuk dokumentasi GitHub, buletin email, maupun laporan produk.'
        },
        {
          title: 'Data rahasia tetap di perangkat lokal',
          detail: 'Angka laporan internal tidak pernah diunggah ke server pihak ketiga karena perenderan berlangsung 100% lokal.'
        }
      ]
    },
    faqs: {
      en: [
        {
          question: 'Can I paste a CSV or JSON table into an LLM to generate a MooScript chart?',
          answer:
            'Yes. Copy the Official MooScript AI System Prompt together with your JSON or CSV rows, and the LLM will output a proportional SVG chart with synchronized counters.'
        },
        {
          question: 'Does MooScript support 16:9 widescreen for decks and YouTube essays?',
          answer:
            'Yes. Switch between 9:16, 16:9, and 1:1 in Studio or batch-export all three aspect ratios in a single queue.'
        }
      ],
      id: [
        {
          question: 'Bisakah saya menempel data CSV atau JSON ke AI untuk dibuatkan grafik MooScript?',
          answer:
            'Bisa. Gabungkan System Prompt resmi MooScript dengan baris data CSV/JSON Anda, lalu AI akan merakit koordinat grafik SVG proporsional beserta animasi angkanya.'
        },
        {
          question: 'Apakah mendukung format lanskap 16:9 untuk YouTube dan presentasi?',
          answer:
            'Tentu. Anda bebas memilih kanvas 16:9, 9:16, atau 1:1 sejak awal proyek maupun mengekspor ketiganya sekaligus lewat antrean multi-format.'
        }
      ]
    }
  }
];

export function getUseCaseBySlug(slug: string): UseCasePillar | undefined {
  return USE_CASE_PILLARS.find((item) => item.slug === slug);
}
