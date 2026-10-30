import type { Locale } from '../config/site';

export interface ComparisonRow {
  criterion: string;
  mooscript: string;
  afterEffects: string;
  remotion: string;
}

export interface InspectorNote {
  id: string;
  side: 'left' | 'right';
  title: string;
  body: string;
}

export interface HomeCopy {
  seoTitle: string;
  seoDescription: string;
  nav: {
    features: string;
    aiWorkflow: string;
    useCases: string;
    templates: string;
    github: string;
    launchStudio: string;
  };
  hero: {
    headline: string;
    subheadline: string;
    primaryCta: string;
    secondaryCta: string;
    specLine: string;
  };
  playground: {
    codeTab: string;
    stageTab: string;
    playLabel: string;
    pauseLabel: string;
    openInStudio: string;
    frameReadout: string;
    pointerReadout: string;
  };
  showcase: {
    heading: string;
    lead: string;
    brollToggleOn: string;
    brollToggleOff: string;
    openPreset: string;
    viewBreakdown: string;
  };
  aiWorkflow: {
    heading: string;
    stepOneLead: string;
    stepOneCodeCaption: string;
    copyPromptBtn: string;
    copiedPromptBtn: string;
    stepTwoLead: string;
    stepTwoResponseTitle: string;
    stepTwoResponseDetail: string;
    stepThreeLead: string;
    stepThreeFormats: string[];
  };
  enginePlate: {
    heading: string;
    lead: string;
    notes: InspectorNote[];
  };
  comparison: {
    heading: string;
    lead: string;
    colMetric: string;
    colMoo: string;
    colAe: string;
    colRemotion: string;
    rows: ComparisonRow[];
  };
  silos: {
    heading: string;
    lead: string;
    readGuide: string;
  };
  cta: {
    heading: string;
    body: string;
    button: string;
  };
  footer: {
    tagline: string;
    privacy: string;
    mediaCredits: string;
  };
}

export const HOME_COPY: Record<Locale, HomeCopy> = {
  en: {
    seoTitle: 'MooScript: Programmatic Motion Graphics in Browser (WebCodecs & AI)',
    seoDescription:
      'Open-source programmatic motion graphics studio in your browser. Write or AI-generate MooTween SVG shots, layer 300 MB B-roll, and export MP4, WebM Alpha, and GIF via WebCodecs.',
    nav: {
      features: 'Engine',
      aiWorkflow: 'AI Workflow',
      useCases: 'Use Cases',
      templates: 'Templates',
      github: 'GitHub',
      launchStudio: 'Launch Studio'
    },
    hero: {
      headline: 'Motion graphics from code',
      subheadline:
        'Write or prompt SVG scenes in your browser, layer B-roll footage, sync cuts to music beats, and encode MP4, WebM Alpha, or GIF on your GPU via WebCodecs.',
      primaryCta: 'Launch Studio',
      secondaryCta: 'Browse Templates',
      specLine: 'Zero install. Pure MooTween engine. 100% local rendering.'
    },
    playground: {
      codeTab: 'Shot Script',
      stageTab: 'Live 60fps Stage',
      playLabel: 'Play',
      pauseLabel: 'Pause',
      openInStudio: 'Open & Edit in Studio',
      frameReadout: 'Frame',
      pointerReadout: 'Pointer'
    },
    showcase: {
      heading: 'Shots built in code',
      lead: 'Select a preset to inspect live MooTween choreography, or composite transparent SVG layers directly over real B-roll footage.',
      brollToggleOn: 'B-Roll Underlay: Active',
      brollToggleOff: 'B-Roll Underlay: Off',
      openPreset: 'Customize in Studio',
      viewBreakdown: 'Read Shot Breakdown'
    },
    aiWorkflow: {
      heading: 'Prompt to hardware render',
      stepOneLead: 'First, hand Claude, ChatGPT, or Gemini the MooScript shot contract.',
      stepOneCodeCaption: 'Official MooTween + SVG system prompt',
      copyPromptBtn: 'Copy Official MooScript AI Prompt',
      copiedPromptBtn: 'System Prompt Copied',
      stepTwoLead: 'Then paste or compile the shot through the Anti-Slide linter and multi-track timeline.',
      stepTwoResponseTitle: 'Anti-Slide Linter & Beat-Sync Timeline',
      stepTwoResponseDetail:
        'Rejects static deck layouts, enforces camera travel, extracts editable layers, and snaps shot cuts to BGM transients.',
      stepThreeLead: 'Finally, encode 9:16, 16:9, and 1:1 masters locally on your GPU in one queue.',
      stepThreeFormats: ['MP4 (H.264 + AAC)', 'WebM (VP9 + Alpha)', 'Animated GIF', 'Cover PNG']
    },
    enginePlate: {
      heading: 'Inside the Studio rack',
      lead: 'Every control runs locally in IndexedDB and Web Workers. Hover or tap a note to inspect its live module.',
      notes: [
        {
          id: 'mootween',
          side: 'left',
          title: 'Deterministic MooTween',
          body: 'Custom seek(t) timeline engine with spring physics and zero GSAP license lock-in.'
        },
        {
          id: 'codecs',
          side: 'left',
          title: 'WebCodecs MP4, Alpha & GIF',
          body: 'Hardware H.264 MP4, transparent VP9 WebM overlays for NLEs, and quantized LZW GIFs.'
        },
        {
          id: 'queue',
          side: 'left',
          title: 'Multi-Format Export Queue',
          body: 'Render 9:16, 16:9, and 1:1 simultaneously via center-crop or blurred-fit framing.'
        },
        {
          id: 'broll',
          side: 'right',
          title: '300 MB B-Roll & Brand Kit',
          body: 'Decode local video under transparent SVG shots with saved brand logos, fonts, and cards.'
        },
        {
          id: 'audio',
          side: 'right',
          title: 'Auto-SFX, Beats & Offline TTS',
          body: 'Procedural whoosh/impact SFX, music beat snapping, and in-browser Piper ONNX voice.'
        },
        {
          id: 'privacy',
          side: 'right',
          title: 'Client-Side Privacy',
          body: 'Zero cloud render bills or asset uploads. Scripts, voices, and footage stay on device.'
        }
      ]
    },
    comparison: {
      heading: 'Technical comparison',
      lead: 'Objective architecture breakdown across browser-native WebCodecs, desktop keyframing, and Node.js video frameworks.',
      colMetric: 'Parameter',
      colMoo: 'MooScript Studio',
      colAe: 'After Effects',
      colRemotion: 'Remotion',
      rows: [
        {
          criterion: 'Setup time',
          mooscript: '0 sec in browser (PWA)',
          afterEffects: '4+ GB Creative Cloud install',
          remotion: 'Node.js, Chromium & FFmpeg CLI'
        },
        {
          criterion: 'AI scriptability',
          mooscript: 'Native HTML/SVG + MooTween + Linter',
          afterEffects: 'Fragile ExtendScript panels',
          remotion: 'React TSX + bundler build step'
        },
        {
          criterion: 'Rendering engine',
          mooscript: 'WebCodecs local GPU (mediabunny)',
          afterEffects: 'CPU/RAM frame cache',
          remotion: 'Headless Chromium + Lambda cost'
        },
        {
          criterion: 'Output formats',
          mooscript: 'MP4, WebM VP9 Alpha, GIF, PNG, SRT',
          afterEffects: 'MOV ProRes, MP4 via Media Encoder',
          remotion: 'MP4, WebM, GIF via FFmpeg'
        },
        {
          criterion: 'Multi-ratio batch',
          mooscript: 'Built-in 9:16 + 16:9 + 1:1 queue',
          afterEffects: 'Manual comp duplication',
          remotion: 'Separate composition renders'
        },
        {
          criterion: 'Voice, SFX & B-roll',
          mooscript: 'Offline Piper TTS, Auto-SFX, 300 MB B-roll',
          afterEffects: 'External plugins & manual mixing',
          remotion: 'External TTS APIs & coded audio'
        },
        {
          criterion: 'License & render cost',
          mooscript: '100% Free & Open Source (AGPLv3)',
          afterEffects: 'Paid monthly subscription',
          remotion: 'Free solo, paid company + cloud'
        }
      ]
    },
    silos: {
      heading: 'Production workflows',
      lead: 'Explore dedicated guides for code-driven video, AI motion scripts, faceless Shorts, and animated data charts.',
      readGuide: 'Open Workflow Guide'
    },
    cta: {
      heading: 'Render your first shot now',
      body: 'Open MooScript Studio in your browser with zero sign-up, zero install, and full local GPU encoding.',
      button: 'Launch Studio'
    },
    footer: {
      tagline: 'MooScript Open Motion Studio',
      privacy: 'Privacy',
      mediaCredits: 'Night sky imagery: NPS, NASA EO (Public Domain), and ESO/B. Tafreshi (CC BY 4.0).'
    }
  },
  id: {
    seoTitle: 'MooScript: Studio Motion Graphics Koding & AI di Browser (WebCodecs)',
    seoDescription:
      'Aplikasi motion graphics open-source berbasis kode dan AI langsung di browser. Tulis animasi SVG MooTween, tumpuk B-roll 300 MB, dan ekspor MP4, WebM Alpha, serta GIF via WebCodecs.',
    nav: {
      features: 'Mesin',
      aiWorkflow: 'Alur AI',
      useCases: 'Kegunaan',
      templates: 'Template',
      github: 'GitHub',
      launchStudio: 'Buka Studio'
    },
    hero: {
      headline: 'Motion graphics lewat kode',
      subheadline:
        'Tulis atau prompt adegan SVG di browser, tumpuk video B-roll, selaraskan potongan ke ketukan musik, lalu ekspor MP4, WebM Alpha, atau GIF lewat GPU lokal.',
      primaryCta: 'Buka Studio',
      secondaryCta: 'Lihat Template',
      specLine: 'Tanpa instalasi. Mesin murni MooTween. Render 100% lokal.'
    },
    playground: {
      codeTab: 'Kode Shot',
      stageTab: 'Panggung 60fps',
      playLabel: 'Putar',
      pauseLabel: 'Jeda',
      openInStudio: 'Buka & Edit di Studio',
      frameReadout: 'Frame',
      pointerReadout: 'Kursor'
    },
    showcase: {
      heading: 'Adegan murni dari kode',
      lead: 'Pilih preset untuk menguji koreografi MooTween secara langsung, atau aktifkan lapisan B-roll untuk melihat transparansi SVG di atas video asli.',
      brollToggleOn: 'Lapisan B-Roll: Aktif',
      brollToggleOff: 'Lapisan B-Roll: Nonaktif',
      openPreset: 'Kustomisasi di Studio',
      viewBreakdown: 'Baca Bedah Kode'
    },
    aiWorkflow: {
      heading: 'Dari prompt ke MP4 GPU',
      stepOneLead: 'Pertama, berikan kontrak sistem MooScript ke Claude, ChatGPT, atau Gemini.',
      stepOneCodeCaption: 'System prompt resmi MooTween + SVG',
      copyPromptBtn: 'Salin System Prompt AI MooScript',
      copiedPromptBtn: 'System Prompt Tersalin',
      stepTwoLead: 'Kedua, tempel atau kompilasi adegan melewati Linter Anti-Slide dan timeline multi-track.',
      stepTwoResponseTitle: 'Linter Anti-Slide & Timeline Ketukan Musik',
      stepTwoResponseDetail:
        'Menolak tata letak ala slide presentasi, mewajibkan gerak kamera, mengekstrak layer visual, dan mengunci cut ke beat BGM.',
      stepThreeLead: 'Terakhir, ekspor serentak rasio 9:16, 16:9, dan 1:1 lewat antrean GPU lokal.',
      stepThreeFormats: ['MP4 (H.264 + AAC)', 'WebM (VP9 + Alpha)', 'GIF Animasi', 'Cover PNG']
    },
    enginePlate: {
      heading: 'Panel mesin Studio',
      lead: 'Seluruh modul berjalan lokal di IndexedDB dan Web Worker. Arahkan kursor pada catatan tepi untuk menyorot modulnya.',
      notes: [
        {
          id: 'mootween',
          side: 'left',
          title: 'MooTween Deterministik',
          body: 'Mesin timeline seek(t) mandiri dengan fisika pegas tanpa ketergantungan lisensi GSAP.'
        },
        {
          id: 'codecs',
          side: 'left',
          title: 'WebCodecs MP4, Alpha & GIF',
          body: 'Ekspor H.264 MP4 via GPU, overlay transparan WebM VP9 untuk editor video, serta GIF LZW.'
        },
        {
          id: 'queue',
          side: 'left',
          title: 'Antrean Multi-Rasio',
          body: 'Render 9:16, 16:9, dan 1:1 sekaligus dengan opsi potong tengah atau latar kabur.'
        },
        {
          id: 'broll',
          side: 'right',
          title: 'B-Roll 300 MB & Brand Kit',
          body: 'Putar video lokal di belakang grafis SVG lengkap dengan logo, palet, font, dan kartu intro.'
        },
        {
          id: 'audio',
          side: 'right',
          title: 'Auto-SFX, Beat & TTS Offline',
          body: 'Efek suara prosedural otomatis, snap potongan ke beat musik, dan suara lokal Piper ONNX.'
        },
        {
          id: 'privacy',
          side: 'right',
          title: 'Privasi Sisi Klien',
          body: 'Tanpa biaya server cloud atau unggah aset. Naskah, suara, dan B-roll tetap di perangkat Anda.'
        }
      ]
    },
    comparison: {
      heading: 'Komparasi teknis',
      lead: 'Perbandingan objektif antara WebCodecs di browser, aplikasi desktop tradisional, dan framework video berbasis Node.js.',
      colMetric: 'Parameter',
      colMoo: 'MooScript Studio',
      colAe: 'After Effects',
      colRemotion: 'Remotion',
      rows: [
        {
          criterion: 'Waktu persiapan',
          mooscript: '0 detik di browser (PWA)',
          afterEffects: 'Instalasi 4+ GB Creative Cloud',
          remotion: 'Setup Node.js, Chromium & FFmpeg'
        },
        {
          criterion: 'Kemudahan skrip AI',
          mooscript: 'HTML/SVG murni + MooTween + Linter',
          afterEffects: 'Skrip ExtendScript sulit diotomasi',
          remotion: 'Komponen TSX + proses bundler'
        },
        {
          criterion: 'Mesin perender',
          mooscript: 'GPU lokal via WebCodecs (mediabunny)',
          afterEffects: 'Cache RAM & CPU berat',
          remotion: 'Headless Chromium + biaya server'
        },
        {
          criterion: 'Format keluaran',
          mooscript: 'MP4, WebM VP9 Alpha, GIF, PNG, SRT',
          afterEffects: 'MOV ProRes, MP4 via Media Encoder',
          remotion: 'MP4, WebM, GIF via FFmpeg'
        },
        {
          criterion: 'Ekspor multi-rasio',
          mooscript: 'Antrean 9:16 + 16:9 + 1:1 sekaligus',
          afterEffects: 'Duplikasi komposisi manual',
          remotion: 'Render komposisi terpisah'
        },
        {
          criterion: 'Suara, SFX & B-roll',
          mooscript: 'TTS Piper Offline, Auto-SFX, B-roll 300 MB',
          afterEffects: 'Plugin tambahan & mixing manual',
          remotion: 'API TTS eksternal & audio via kode'
        },
        {
          criterion: 'Lisensi & biaya',
          mooscript: '100% Gratis & Open Source (AGPLv3)',
          afterEffects: 'Langganan bulanan berbayar',
          remotion: 'Gratis individu, berbayar tim + cloud'
        }
      ]
    },
    silos: {
      heading: 'Pilar alur produksi',
      lead: 'Pelajari panduan teknis untuk video berbasis kode, generator motion AI, otomasi Shorts tanpa wajah, dan animasi grafik data.',
      readGuide: 'Baca Panduan Alur'
    },
    cta: {
      heading: 'Mulai render adegan pertama',
      body: 'Buka MooScript Studio langsung di browser tanpa daftar akun, tanpa instalasi, dan tanpa batas watermark.',
      button: 'Buka Studio'
    },
    footer: {
      tagline: 'MooScript Open Motion Studio',
      privacy: 'Privasi',
      mediaCredits: 'Citra langit malam: NPS, NASA EO (Domain Publik), dan ESO/B. Tafreshi (CC BY 4.0).'
    }
  }
};
