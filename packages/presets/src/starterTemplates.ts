import type { StarterProjectTemplate } from './types';
import { SHOWCASE_PRESETS } from './showcasePresets';

/**
 * Legacy storyboard starter templates preserved 100% for Studio compatibility,
 * followed by pre-compiled MooTween showcase presets shared with mooscript.web.id.
 */
export const LEGACY_STARTER_TEMPLATES: StarterProjectTemplate[] = [
  {
    id: 'three-facts',
    title: 'Tiga Fakta Cepat',
    description: 'Hook, tiga fakta singkat, lalu ajakan bertindak.',
    icon: 'format_list_numbered',
    aspectRatio: '9:16',
    scenes: [
      {
        narration: 'Tiga fakta yang jarang orang tahu tentang topik ini.',
        focusWords: ['tiga', 'fakta'],
        visualIntent: 'Judul besar yang mengundang rasa penasaran dengan angka 3 sebagai fokus'
      },
      {
        narration: 'Fakta pertama: tulis poin paling mengejutkan di sini.',
        focusWords: ['pertama'],
        visualIntent: 'Angka 1 besar dengan satu kalimat pendukung'
      },
      {
        narration: 'Fakta kedua: tambahkan data atau contoh nyata.',
        focusWords: ['kedua'],
        visualIntent: 'Angka 2 besar dengan satu kalimat pendukung'
      },
      {
        narration: 'Fakta ketiga: tutup dengan poin yang paling mudah diingat.',
        focusWords: ['ketiga'],
        visualIntent: 'Angka 3 besar dengan satu kalimat pendukung'
      },
      {
        narration: 'Ikuti untuk fakta menarik lainnya setiap hari.',
        focusWords: ['ikuti'],
        visualIntent: 'Ajakan bertindak yang jelas dengan tombol atau badge menonjol'
      }
    ]
  },
  {
    id: 'before-after',
    title: 'Sebelum dan Sesudah',
    description: 'Masalah, solusi, hasil. Cocok untuk produk atau tips.',
    icon: 'compare',
    aspectRatio: '9:16',
    scenes: [
      {
        narration: 'Ini masalah yang sering kamu hadapi setiap hari.',
        focusWords: ['masalah'],
        visualIntent: 'Tampilan kacau atau suram yang menggambarkan kondisi sebelum'
      },
      {
        narration: 'Dengan cara ini, semuanya jadi lebih sederhana.',
        focusWords: ['sederhana'],
        visualIntent: 'Transisi bersih ke tampilan rapi yang menggambarkan solusi'
      },
      {
        narration: 'Hasilnya terlihat dalam hitungan hari. Coba sekarang.',
        focusWords: ['hasilnya', 'sekarang'],
        visualIntent: 'Metrik atau hasil akhir yang menonjol dengan ajakan mencoba'
      }
    ]
  },
  {
    id: 'tutorial-steps',
    title: 'Tutorial Langkah demi Langkah',
    description: 'Pengantar, tiga langkah, dan ringkasan.',
    icon: 'checklist',
    aspectRatio: '16:9',
    scenes: [
      {
        narration: 'Dalam video ini kamu akan belajar satu hal baru dalam tiga langkah.',
        focusWords: ['tiga', 'langkah'],
        visualIntent: 'Judul tutorial dengan daftar singkat apa yang akan dipelajari'
      },
      {
        narration: 'Langkah satu: siapkan semua yang dibutuhkan.',
        focusWords: ['satu', 'siapkan'],
        visualIntent: 'Langkah 1 dengan ikon alat atau bahan'
      },
      {
        narration: 'Langkah dua: jalankan proses utamanya dengan hati-hati.',
        focusWords: ['dua', 'proses'],
        visualIntent: 'Langkah 2 dengan potongan kode atau ilustrasi proses'
      },
      {
        narration: 'Langkah tiga: periksa hasilnya dan rapikan.',
        focusWords: ['tiga', 'periksa'],
        visualIntent: 'Langkah 3 dengan tanda centang hasil akhir'
      },
      {
        narration: 'Itu dia. Simpan video ini supaya mudah dicari lagi.',
        focusWords: ['simpan'],
        visualIntent: 'Ringkasan tiga langkah dalam satu daftar dan ajakan menyimpan'
      }
    ]
  },
  {
    id: 'quote-promo',
    title: 'Kutipan Pendek',
    description: 'Satu kutipan kuat dengan penutup merek, untuk 1:1.',
    icon: 'format_quote',
    aspectRatio: '1:1',
    scenes: [
      {
        narration: 'Tulis kutipan atau pernyataan utama kamu di sini.',
        focusWords: ['kutipan'],
        visualIntent: 'Kutipan besar dengan kata kunci disorot sebagai fokus tipografi'
      },
      {
        narration: 'Nama kamu atau merek kamu.',
        focusWords: ['nama'],
        visualIntent: 'Penutup sederhana dengan nama atau logo merek'
      }
    ]
  },
  {
    id: 'myth-vs-fact',
    title: 'Mitos vs Fakta',
    description: 'Bantah satu anggapan populer dengan fakta.',
    icon: 'compare_arrows',
    aspectRatio: '9:16',
    scenes: [
      {
        narration: 'Banyak orang percaya hal ini, padahal keliru.',
        focusWords: ['keliru'],
        visualIntent: 'Pernyataan pembuka yang memancing rasa penasaran'
      },
      {
        narration: 'Mitosnya: tulis anggapan populer di sini.',
        focusWords: ['mitosnya'],
        visualIntent: 'Anggapan populer ditampilkan lalu dicoret'
      },
      {
        narration: 'Faktanya: tulis kenyataan yang benar di sini.',
        focusWords: ['faktanya'],
        visualIntent: 'Fakta muncul besar dengan warna aksen'
      },
      {
        narration: 'Tambahkan sumber atau contoh yang bisa dicek.',
        focusWords: ['sumber'],
        visualIntent: 'Bukti singkat sebagai penguat'
      },
      {
        narration: 'Mitos apa lagi yang pernah kamu percaya?',
        focusWords: ['mitos'],
        visualIntent: 'Ajakan berkomentar yang jelas'
      }
    ]
  },
  {
    id: 'did-you-know',
    title: 'Tahukah Kamu',
    description: 'Satu fakta unik yang dijelaskan singkat.',
    icon: 'psychology',
    aspectRatio: '9:16',
    scenes: [
      {
        narration: 'Tahukah kamu tentang hal ini?',
        focusWords: ['tahukah'],
        visualIntent: 'Pertanyaan besar sebagai pembuka'
      },
      {
        narration: 'Tulis fakta unik yang ingin kamu bagikan.',
        focusWords: ['fakta'],
        visualIntent: 'Fakta utama sebagai fokus'
      },
      {
        narration: 'Jelaskan alasan di balik fakta itu.',
        focusWords: ['alasan'],
        visualIntent: 'Penjelasan sebab dan akibat'
      },
      {
        narration: 'Bagikan ke teman yang belum tahu.',
        focusWords: ['bagikan'],
        visualIntent: 'Ajakan membagikan video'
      }
    ]
  },
  {
    id: 'three-mistakes',
    title: 'Tiga Kesalahan',
    description: 'Kesalahan umum dan cara menghindarinya.',
    icon: 'local_fire_department',
    aspectRatio: '9:16',
    scenes: [
      {
        narration: 'Tiga kesalahan ini sering tidak disadari.',
        focusWords: ['kesalahan'],
        visualIntent: 'Angka tiga sebagai pemancing perhatian'
      },
      {
        narration: 'Kesalahan pertama: tulis di sini.',
        focusWords: ['pertama'],
        visualIntent: 'Nomor satu dengan kesalahan singkat'
      },
      {
        narration: 'Kesalahan kedua: tulis di sini.',
        focusWords: ['kedua'],
        visualIntent: 'Nomor dua dengan kesalahan singkat'
      },
      {
        narration: 'Kesalahan ketiga: tulis di sini.',
        focusWords: ['ketiga'],
        visualIntent: 'Nomor tiga dengan kesalahan singkat'
      },
      {
        narration: 'Mulai perbaiki satu saja hari ini.',
        focusWords: ['perbaiki'],
        visualIntent: 'Penutup dengan satu langkah nyata'
      }
    ]
  },
  {
    id: 'mini-story',
    title: 'Cerita Singkat',
    description: 'Awal, masalah, titik balik, dan pelajaran.',
    icon: 'star',
    aspectRatio: '9:16',
    scenes: [
      {
        narration: 'Semuanya berubah pada hari itu.',
        focusWords: ['berubah'],
        visualIntent: 'Pembuka cerita yang menggantung'
      },
      {
        narration: 'Ceritakan keadaan awal di sini.',
        focusWords: ['awal'],
        visualIntent: 'Latar cerita yang tenang'
      },
      {
        narration: 'Lalu muncul masalah besar: tulis di sini.',
        focusWords: ['masalah'],
        visualIntent: 'Ketegangan meningkat'
      },
      {
        narration: 'Titik baliknya datang saat tulis di sini.',
        focusWords: ['titik'],
        visualIntent: 'Momen perubahan yang kuat'
      },
      {
        narration: 'Pelajarannya: tulis satu kalimat yang berkesan.',
        focusWords: ['pelajarannya'],
        visualIntent: 'Penutup yang mudah diingat'
      }
    ]
  },
  {
    id: 'honest-review',
    title: 'Ulasan Jujur',
    description: 'Kelebihan, kekurangan, dan kesimpulan produk.',
    icon: 'star',
    aspectRatio: '9:16',
    scenes: [
      {
        narration: 'Apakah produk ini layak dibeli?',
        focusWords: ['layak'],
        visualIntent: 'Pertanyaan pembuka dengan nama produk'
      },
      {
        narration: 'Yang saya suka: tulis kelebihannya.',
        focusWords: ['suka'],
        visualIntent: 'Kelebihan utama'
      },
      {
        narration: 'Yang kurang: tulis kekurangannya dengan jujur.',
        focusWords: ['kurang'],
        visualIntent: 'Kekurangan utama'
      },
      {
        narration: 'Cocok untuk: tulis siapa yang butuh.',
        focusWords: ['cocok'],
        visualIntent: 'Sasaran pengguna yang jelas'
      },
      {
        narration: 'Kesimpulan saya: tulis pendapat akhirmu.',
        focusWords: ['kesimpulan'],
        visualIntent: 'Putusan akhir yang tegas'
      }
    ]
  },
  {
    id: 'daily-tip',
    title: 'Tips Harian',
    description: 'Satu tips praktis untuk feed persegi.',
    icon: 'share',
    aspectRatio: '1:1',
    scenes: [
      {
        narration: 'Tips hari ini: tulis judul singkat.',
        focusWords: ['tips'],
        visualIntent: 'Judul tips yang tegas'
      },
      {
        narration: 'Lakukan langkah ini: tulis caranya.',
        focusWords: ['langkah'],
        visualIntent: 'Satu langkah praktis'
      },
      {
        narration: 'Simpan supaya tidak lupa besok.',
        focusWords: ['simpan'],
        visualIntent: 'Ajakan menyimpan'
      }
    ]
  }
];

/** English versions of the legacy starters, same ids and scene order as LEGACY_STARTER_TEMPLATES. */
export const LEGACY_STARTER_TEMPLATES_EN: StarterProjectTemplate[] = [
  {
    id: "three-facts",
    title: "Three Quick Facts",
    description: "A hook, three short facts, then a call to action.",
    icon: "format_list_numbered",
    aspectRatio: "9:16",
    scenes: [
      {
        narration: "Three facts few people know about this topic.",
        focusWords: ["three", "facts"],
        visualIntent: "A big, curiosity-sparking title with the number 3 as the focus"
      },
      {
        narration: "Fact one: write the most surprising point here.",
        focusWords: ["one"],
        visualIntent: "A big number 1 with one supporting sentence"
      },
      {
        narration: "Fact two: add real data or an example.",
        focusWords: ["two"],
        visualIntent: "A big number 2 with one supporting sentence"
      },
      {
        narration: "Fact three: close with the easiest point to remember.",
        focusWords: ["three"],
        visualIntent: "A big number 3 with one supporting sentence"
      },
      {
        narration: "Follow for more interesting facts every day.",
        focusWords: ["follow"],
        visualIntent: "A clear call to action with a prominent button or badge"
      }
    ]
  },
  {
    id: "before-after",
    title: "Before and After",
    description: "Problem, solution, result. Great for products or tips.",
    icon: "compare",
    aspectRatio: "9:16",
    scenes: [
      {
        narration: "This is the problem you face every day.",
        focusWords: ["problem"],
        visualIntent: "A messy or gloomy look that shows the before state"
      },
      {
        narration: "With this approach, everything gets simpler.",
        focusWords: ["simpler"],
        visualIntent: "A clean transition to a tidy look that shows the solution"
      },
      {
        narration: "You will see results within days. Try it now.",
        focusWords: ["results", "now"],
        visualIntent: "A prominent metric or final result with a call to try it"
      }
    ]
  },
  {
    id: "tutorial-steps",
    title: "Step-by-Step Tutorial",
    description: "An intro, three steps, and a recap.",
    icon: "checklist",
    aspectRatio: "16:9",
    scenes: [
      {
        narration: "In this video you will learn one new thing in three steps.",
        focusWords: ["three", "steps"],
        visualIntent: "A tutorial title with a short list of what will be learned"
      },
      {
        narration: "Step one: get everything you need ready.",
        focusWords: ["one", "ready"],
        visualIntent: "Step 1 with a tool or ingredient icon"
      },
      {
        narration: "Step two: carry out the main process carefully.",
        focusWords: ["two", "process"],
        visualIntent: "Step 2 with a code snippet or a process illustration"
      },
      {
        narration: "Step three: check the result and tidy up.",
        focusWords: ["three", "check"],
        visualIntent: "Step 3 with a checkmark for the final result"
      },
      {
        narration: "That's it. Save this video so it is easy to find again.",
        focusWords: ["save"],
        visualIntent: "A recap of the three steps in one list and a call to save"
      }
    ]
  },
  {
    id: "quote-promo",
    title: "Short Quote",
    description: "One strong quote with a brand sign-off, for 1:1.",
    icon: "format_quote",
    aspectRatio: "1:1",
    scenes: [
      {
        narration: "Write your main quote or statement here.",
        focusWords: ["quote"],
        visualIntent: "A large quote with the keyword highlighted as the typographic focus"
      },
      {
        narration: "Your name or your brand.",
        focusWords: ["name"],
        visualIntent: "A simple sign-off with the brand name or logo"
      }
    ]
  },
  {
    id: "myth-vs-fact",
    title: "Myth vs Fact",
    description: "Debunk one popular belief with a fact.",
    icon: "compare_arrows",
    aspectRatio: "9:16",
    scenes: [
      {
        narration: "Many people believe this, and they are wrong.",
        focusWords: ["wrong"],
        visualIntent: "An opening statement that sparks curiosity"
      },
      {
        narration: "The myth: write the popular belief here.",
        focusWords: ["myth"],
        visualIntent: "The popular belief shown, then crossed out"
      },
      {
        narration: "The fact: write what is actually true here.",
        focusWords: ["fact"],
        visualIntent: "The fact appears large in the accent color"
      },
      {
        narration: "Add a source or an example people can check.",
        focusWords: ["source"],
        visualIntent: "Short proof as support"
      },
      {
        narration: "What other myth did you once believe?",
        focusWords: ["myth"],
        visualIntent: "A clear call to comment"
      }
    ]
  },
  {
    id: "did-you-know",
    title: "Did You Know",
    description: "One surprising fact, explained briefly.",
    icon: "psychology",
    aspectRatio: "9:16",
    scenes: [
      {
        narration: "Did you know about this?",
        focusWords: ["know"],
        visualIntent: "A large question as the opening"
      },
      {
        narration: "Write the surprising fact you want to share.",
        focusWords: ["fact"],
        visualIntent: "The main fact as the focus"
      },
      {
        narration: "Explain the reason behind that fact.",
        focusWords: ["reason"],
        visualIntent: "A short cause and effect"
      },
      {
        narration: "Share this with a friend who has no idea.",
        focusWords: ["share"],
        visualIntent: "A call to share the video"
      }
    ]
  },
  {
    id: "three-mistakes",
    title: "Three Mistakes",
    description: "Common mistakes and how to avoid them.",
    icon: "local_fire_department",
    aspectRatio: "9:16",
    scenes: [
      {
        narration: "Most people never notice these three mistakes.",
        focusWords: ["mistakes"],
        visualIntent: "The number three as the hook"
      },
      {
        narration: "Mistake one: write it here.",
        focusWords: ["one"],
        visualIntent: "Number one with a short mistake"
      },
      {
        narration: "Mistake two: write it here.",
        focusWords: ["two"],
        visualIntent: "Number two with a short mistake"
      },
      {
        narration: "Mistake three: write it here.",
        focusWords: ["three"],
        visualIntent: "Number three with a short mistake"
      },
      {
        narration: "Start by fixing just one today.",
        focusWords: ["fixing"],
        visualIntent: "A closing with one concrete step"
      }
    ]
  },
  {
    id: "mini-story",
    title: "Mini Story",
    description: "A start, a problem, a turning point, and a lesson.",
    icon: "star",
    aspectRatio: "9:16",
    scenes: [
      {
        narration: "Everything changed that day.",
        focusWords: ["changed"],
        visualIntent: "An opening that leaves a question"
      },
      {
        narration: "Describe how things were at the start.",
        focusWords: ["start"],
        visualIntent: "A calm story setting"
      },
      {
        narration: "Then a big problem appeared: write it here.",
        focusWords: ["problem"],
        visualIntent: "Rising tension"
      },
      {
        narration: "The turning point came when: write it here.",
        focusWords: ["turning"],
        visualIntent: "A strong moment of change"
      },
      {
        narration: "The lesson: write one memorable sentence.",
        focusWords: ["lesson"],
        visualIntent: "An easy-to-remember closing"
      }
    ]
  },
  {
    id: "honest-review",
    title: "Honest Review",
    description: "A product's pros, cons, and verdict.",
    icon: "star",
    aspectRatio: "9:16",
    scenes: [
      {
        narration: "Is this product worth buying?",
        focusWords: ["worth"],
        visualIntent: "An opening question with the product name"
      },
      {
        narration: "What I like: write the best part.",
        focusWords: ["like"],
        visualIntent: "The main strength"
      },
      {
        narration: "What falls short: be honest here.",
        focusWords: ["short"],
        visualIntent: "The main weakness"
      },
      {
        narration: "Best for: write who really needs it.",
        focusWords: ["best"],
        visualIntent: "A clear target user"
      },
      {
        narration: "My verdict: write your final opinion.",
        focusWords: ["verdict"],
        visualIntent: "A firm final call"
      }
    ]
  },
  {
    id: "daily-tip",
    title: "Daily Tip",
    description: "One practical tip for a square feed.",
    icon: "share",
    aspectRatio: "1:1",
    scenes: [
      {
        narration: "Today's tip: write a short title.",
        focusWords: ["tip"],
        visualIntent: "A bold tip title"
      },
      {
        narration: "Do this: write the step here.",
        focusWords: ["step"],
        visualIntent: "One practical step"
      },
      {
        narration: "Save this so you remember tomorrow.",
        focusWords: ["save"],
        visualIntent: "A call to save"
      }
    ]
  }
];

export type StarterLocale = "en" | "id";

/** The showcase presets as starters, written in the given language. */
export function showcaseAsStarterTemplates(locale: StarterLocale = "id"): StarterProjectTemplate[] {
  return SHOWCASE_PRESETS.map((preset) => ({
    id: preset.slug,
    presetSlug: preset.slug,
    title: preset.title[locale],
    description: preset.summary[locale],
    icon: preset.icon,
    aspectRatio: preset.aspectRatio,
    scenes: preset.shots.map((shot) => ({
      narration: shot.narration[locale],
      focusWords: shot.focusWords[locale],
      visualIntent: shot.visualIntent[locale]
    }))
  }));
}

export const SHOWCASE_AS_STARTER_TEMPLATES: StarterProjectTemplate[] = showcaseAsStarterTemplates("id");

export const ALL_STARTER_TEMPLATES: StarterProjectTemplate[] = [
  ...LEGACY_STARTER_TEMPLATES,
  ...SHOWCASE_AS_STARTER_TEMPLATES
];

/** Every starter template in one language. Indonesian is the default and matches ALL_STARTER_TEMPLATES. */
export function getStarterTemplates(locale: StarterLocale = "id"): StarterProjectTemplate[] {
  if (locale === "id") return ALL_STARTER_TEMPLATES;
  return [...LEGACY_STARTER_TEMPLATES_EN, ...showcaseAsStarterTemplates(locale)];
}

export function findStarterTemplate(idOrSlug: string, locale: StarterLocale = "id"): StarterProjectTemplate | undefined {
  return getStarterTemplates(locale).find((tpl) => tpl.id === idOrSlug || tpl.presetSlug === idOrSlug);
}
