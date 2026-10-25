import type { AspectRatio } from '../../types';

export interface TemplateScene {
  narration: string;
  focusWords: string[];
  visualIntent: string;
}

export interface ProjectTemplate {
  id: string;
  title: string;
  description: string;
  icon: string;
  aspectRatio: AspectRatio;
  scenes: TemplateScene[];
}

/** Starter storyboards. Narration is placeholder copy meant to be replaced with the user's own. */
export const PROJECT_TEMPLATES: ProjectTemplate[] = [
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

export function getProjectTemplate(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find((t) => t.id === id);
}
