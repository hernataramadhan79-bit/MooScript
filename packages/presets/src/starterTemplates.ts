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
