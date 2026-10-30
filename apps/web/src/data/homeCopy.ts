import type { Locale } from '../config/site';

export interface ComparisonRow {
  criterion: string;
  mooscript: string;
  afterEffects: string;
  remotion: string;
}

export interface StageStep {
  name: string;
  clause: string;
  note: string;
}

export interface FeatureField {
  phrase: string;
  body: string;
}

export interface StatBlock {
  figure: string;
  label: string;
}

export interface HomeCopy {
  seoTitle: string;
  seoDescription: string;
  nav: {
    how: string;
    templates: string;
    useCases: string;
    github: string;
    launchStudio: string;
    menu: string;
    close: string;
    home: string;
  };
  hero: {
    lineOne: string;
    lineTwoBefore: string;
    lineTwoAfter: string;
    subheadline: string;
    primaryCta: string;
    secondaryCta: string;
    specLine: string;
    railPlay: string;
    railPause: string;
    railLabel: string;
    railFrame: string;
    mastersLabel: string;
    masters: string[];
    slotAlt: string;
  };
  ticker: string[];
  showcase: {
    heading: string;
    lead: string;
    brollOn: string;
    brollOff: string;
    openPreset: string;
    viewBreakdown: string;
    allTemplates: string;
    stageLabel: string;
  };
  how: {
    heading: string;
    sliderLabel: string;
    copyPrompt: string;
    copiedPrompt: string;
    steps: StageStep[];
    formats: string[];
  };
  features: FeatureField[];
  compare: {
    heading: string;
    lead: string;
    colMetric: string;
    colMoo: string;
    colAe: string;
    colRemotion: string;
    rows: ComparisonRow[];
    stats: StatBlock[];
    photoAlt: string;
    photoCaption: string;
  };
  guides: {
    heading: string;
    lead: string;
    open: string;
    all: string;
  };
  faqHeading: string;
  cta: {
    heading: string;
    body: string;
    primary: string;
    secondary: string;
    after: string;
    photoAlt: string;
  };
  footer: {
    invite: string;
    tagline: string;
    product: string;
    guides: string;
    project: string;
    privacy: string;
    studio: string;
    mediaCredits: string;
    madeIn: string;
  };
}

export const HOME_COPY: Record<Locale, HomeCopy> = {
  en: {
    seoTitle: 'MooScript: Programmatic Motion Graphics in Browser (WebCodecs & AI)',
    seoDescription:
      'Open-source programmatic motion graphics studio in your browser. Write or AI-generate MooTween SVG shots, layer 300 MB B-roll, and export MP4, WebM Alpha, and GIF via WebCodecs.',
    nav: {
      how: 'How it works',
      templates: 'Templates',
      useCases: 'Use cases',
      github: 'GitHub',
      launchStudio: 'Launch Studio',
      menu: 'Menu',
      close: 'Close',
      home: 'MooScript home'
    },
    hero: {
      lineOne: 'Motion graphics',
      lineTwoBefore: 'from',
      lineTwoAfter: 'code',
      subheadline:
        'Write a shot or prompt it. MooScript plays SVG scenes over your B-roll, then encodes MP4, transparent WebM or GIF on your own GPU, in one browser tab.',
      primaryCta: 'Launch Studio',
      secondaryCta: 'Browse templates',
      specLine: 'No install. No sign-up. Nothing leaves your device.',
      railPlay: 'Play',
      railPause: 'Pause',
      railLabel: 'Drag the playhead. All four stages above run live MooTween code.',
      railFrame: 'frame',
      mastersLabel: 'One engine, three masters',
      masters: ['9:16 Short opener', '16:9 Data chart', '9:16 Hook'],
      slotAlt: 'Live MooTween shot playing over night sky footage'
    },
    ticker: ['MP4', 'WebM Alpha', 'GIF', 'Cover PNG', 'SRT', '9:16', '16:9', '1:1'],
    showcase: {
      heading: 'Four shots. Every pixel is code.',
      lead: 'Pick a shot and it plays live in your browser, the same MooTween code the Studio renders. Switch the B-roll underlay to see the SVG layer stay transparent over real footage.',
      brollOn: 'B-roll underlay on',
      brollOff: 'B-roll underlay off',
      openPreset: 'Customize in Studio',
      viewBreakdown: 'Read the breakdown',
      allTemplates: 'All templates',
      stageLabel: 'Live stage'
    },
    how: {
      heading: 'Prompt to file',
      sliderLabel: 'Production stage',
      copyPrompt: 'Copy the official AI prompt',
      copiedPrompt: 'Prompt copied',
      steps: [
        {
          name: 'Prompt',
          clause: 'Hand any AI the shot contract.',
          note: 'Claude, ChatGPT or Gemini writes MooTween code from one system prompt.'
        },
        {
          name: 'Lint',
          clause: 'The linter rejects slide decks.',
          note: 'Static layouts fail. Camera travel is required and layers are extracted.'
        },
        {
          name: 'Beat-sync',
          clause: 'Every cut snaps to the music.',
          note: 'Shot boundaries lock to BGM transients on a multi-track timeline.'
        },
        {
          name: 'Render',
          clause: 'Three ratios, one GPU queue.',
          note: '9:16, 16:9 and 1:1 masters encode locally, side by side.'
        }
      ],
      formats: ['MP4 (H.264 + AAC)', 'WebM (VP9 + Alpha)', 'Animated GIF', 'Cover PNG']
    },
    features: [
      {
        phrase: 'Zero install',
        body: 'Open a tab and the studio is running. No 4 GB download, no Node, no FFmpeg, no account to create.'
      },
      {
        phrase: 'Your GPU renders',
        body: 'WebCodecs encodes H.264 MP4, transparent VP9 WebM and animated GIF on the machine you are using. No render farm, no cloud bill, no upload.'
      },
      {
        phrase: 'Cuts on the beat',
        body: 'Procedural whoosh and impact sound, offline Piper voice-over, and shot cuts that snap to your music.'
      },
      {
        phrase: 'Free and open',
        body: 'AGPLv3, with a clean-room seek(t) engine. No GSAP license, no watermark, no price per render.'
      }
    ],
    compare: {
      heading: 'Why not After Effects or Remotion?',
      lead: 'Same destination, a different road: browser-native WebCodecs against a desktop keyframer and a Node video framework.',
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
      ],
      stats: [
        { figure: '0 s', label: 'to the first frame' },
        { figure: '300 MB', label: 'of local B-roll' },
        { figure: '3', label: 'ratios in one queue' },
        { figure: '$0', label: 'per render' }
      ],
      photoAlt: 'Satellite night view of aurora ribbons and city lights',
      photoCaption: 'Aurora over the night side of Earth. NASA Earth Observatory, public domain.'
    },
    guides: {
      heading: 'Four ways to make video from code',
      lead: 'Each guide pairs a real template with the code behind it.',
      open: 'Open guide',
      all: 'All use cases'
    },
    faqHeading: 'Technical questions',
    cta: {
      heading: 'Render your first shot',
      body: 'Open the studio in this browser. No sign-up, no install, full local GPU encoding.',
      primary: 'Launch Studio',
      secondary: 'Browse templates',
      after: 'Either way, your files stay on your device.',
      photoAlt: 'Green aurora over the mountains of Glacier Bay at night'
    },
    footer: {
      invite: 'Make it move.',
      tagline: 'MooScript Open Motion Studio',
      product: 'Product',
      guides: 'Guides',
      project: 'Project',
      privacy: 'Privacy',
      studio: 'Studio',
      mediaCredits:
        'Night sky imagery: NPS, NASA EO (Public Domain), and ESO/B. Tafreshi (CC BY 4.0).',
      madeIn: 'Open source under AGPLv3'
    }
  },
  id: {
    seoTitle: 'MooScript: Studio Motion Graphics Koding & AI di Browser (WebCodecs)',
    seoDescription:
      'Aplikasi motion graphics open-source berbasis kode dan AI langsung di browser. Tulis animasi SVG MooTween, tumpuk B-roll 300 MB, dan ekspor MP4, WebM Alpha, serta GIF via WebCodecs.',
    nav: {
      how: 'Cara kerja',
      templates: 'Template',
      useCases: 'Kegunaan',
      github: 'GitHub',
      launchStudio: 'Buka Studio',
      menu: 'Menu',
      close: 'Tutup',
      home: 'Beranda MooScript'
    },
    hero: {
      lineOne: 'Motion graphics',
      lineTwoBefore: 'lewat',
      lineTwoAfter: 'kode',
      subheadline:
        'Tulis adegan atau minta AI membuatnya. MooScript memutar adegan SVG di atas B-roll, lalu mengekspor MP4, WebM transparan atau GIF lewat GPU Anda sendiri, cukup di satu tab browser.',
      primaryCta: 'Buka Studio',
      secondaryCta: 'Lihat template',
      specLine: 'Tanpa instalasi. Tanpa daftar akun. Tidak ada yang keluar dari perangkat Anda.',
      railPlay: 'Putar',
      railPause: 'Jeda',
      railLabel: 'Geser playhead. Keempat panggung di atas menjalankan kode MooTween sungguhan.',
      railFrame: 'frame',
      mastersLabel: 'Satu mesin, tiga master',
      masters: ['9:16 Pembuka Shorts', '16:9 Grafik data', '9:16 Hook'],
      slotAlt: 'Adegan MooTween langsung diputar di atas video langit malam'
    },
    ticker: ['MP4', 'WebM Alpha', 'GIF', 'Cover PNG', 'SRT', '9:16', '16:9', '1:1'],
    showcase: {
      heading: 'Empat adegan. Setiap piksel adalah kode.',
      lead: 'Pilih satu adegan dan ia langsung berputar di browser, dengan kode MooTween yang sama dengan yang dirender Studio. Aktifkan lapisan B-roll untuk melihat SVG tetap transparan di atas video asli.',
      brollOn: 'Lapisan B-roll aktif',
      brollOff: 'Lapisan B-roll mati',
      openPreset: 'Kustomisasi di Studio',
      viewBreakdown: 'Baca bedah kode',
      allTemplates: 'Semua template',
      stageLabel: 'Panggung langsung'
    },
    how: {
      heading: 'Dari prompt ke file jadi',
      sliderLabel: 'Tahap produksi',
      copyPrompt: 'Salin prompt AI resmi',
      copiedPrompt: 'Prompt tersalin',
      steps: [
        {
          name: 'Prompt',
          clause: 'Beri AI kontrak adegannya.',
          note: 'Claude, ChatGPT atau Gemini menulis kode MooTween dari satu system prompt.'
        },
        {
          name: 'Lint',
          clause: 'Linter menolak gaya slide.',
          note: 'Layout statis gagal. Gerak kamera wajib dan layer diekstrak otomatis.'
        },
        {
          name: 'Beat-sync',
          clause: 'Setiap cut menempel ke musik.',
          note: 'Batas adegan terkunci ke transien BGM di timeline multi-track.'
        },
        {
          name: 'Render',
          clause: 'Tiga rasio, satu antrean GPU.',
          note: 'Master 9:16, 16:9 dan 1:1 dikodekan lokal, berdampingan.'
        }
      ],
      formats: ['MP4 (H.264 + AAC)', 'WebM (VP9 + Alpha)', 'GIF Animasi', 'Cover PNG']
    },
    features: [
      {
        phrase: 'Tanpa instalasi',
        body: 'Buka satu tab dan studionya langsung jalan. Tanpa unduhan 4 GB, tanpa Node, tanpa FFmpeg, tanpa akun.'
      },
      {
        phrase: 'GPU Anda merender',
        body: 'WebCodecs mengekspor MP4 H.264, WebM VP9 transparan dan GIF di mesin yang Anda pakai. Tanpa render farm, tanpa tagihan cloud, tanpa unggah.'
      },
      {
        phrase: 'Cut tepat di beat',
        body: 'Efek whoosh dan impact prosedural, suara Piper offline, dan potongan adegan yang menempel ke musik.'
      },
      {
        phrase: 'Gratis dan terbuka',
        body: 'AGPLv3 dengan mesin seek(t) buatan sendiri. Tanpa lisensi GSAP, tanpa watermark, tanpa biaya per render.'
      }
    ],
    compare: {
      heading: 'Kenapa bukan After Effects atau Remotion?',
      lead: 'Tujuannya sama, jalannya berbeda: WebCodecs di browser melawan aplikasi keyframe desktop dan framework video Node.js.',
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
      ],
      stats: [
        { figure: '0 dtk', label: 'sampai frame pertama' },
        { figure: '300 MB', label: 'B-roll lokal' },
        { figure: '3', label: 'rasio dalam satu antrean' },
        { figure: 'Rp0', label: 'per render' }
      ],
      photoAlt: 'Citra satelit malam hari dengan pita aurora dan lampu kota',
      photoCaption: 'Aurora di sisi malam Bumi. NASA Earth Observatory, domain publik.'
    },
    guides: {
      heading: 'Empat cara membuat video dari kode',
      lead: 'Setiap panduan memasangkan template asli dengan kode di baliknya.',
      open: 'Buka panduan',
      all: 'Semua kegunaan'
    },
    faqHeading: 'Pertanyaan teknis',
    cta: {
      heading: 'Render adegan pertama Anda',
      body: 'Buka studio di browser ini. Tanpa daftar, tanpa instalasi, ekspor penuh lewat GPU lokal.',
      primary: 'Buka Studio',
      secondary: 'Lihat template',
      after: 'Mana pun pilihannya, file Anda tetap di perangkat Anda.',
      photoAlt: 'Aurora hijau di atas pegunungan Glacier Bay pada malam hari'
    },
    footer: {
      invite: 'Buat ia bergerak.',
      tagline: 'MooScript Open Motion Studio',
      product: 'Produk',
      guides: 'Panduan',
      project: 'Proyek',
      privacy: 'Privasi',
      studio: 'Studio',
      mediaCredits: 'Citra langit malam: NPS, NASA EO (Domain Publik), dan ESO/B. Tafreshi (CC BY 4.0).',
      madeIn: 'Open source di bawah AGPLv3'
    }
  }
};
