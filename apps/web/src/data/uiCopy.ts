import type { Locale } from '../config/site';

/** Accessible names, image text and the product-panel labels in the How slider. */
export interface UiCopy {
  mainNav: string;
  mobileNav: string;
  footerNav: string;
  language: string;
  breadcrumb: string;
  engine: string;
  playhead: string;
  timelineScrubber: string;
  templateStage: string;
  auroraStage: string;
  auroraPhoto: string;
  how: {
    promptTitle: string;
    lintTitle: string;
    lintScore: string;
    lintRows: Array<[string, string, boolean]>;
    beatTitle: string;
    beatLocked: string;
    shot: string;
    beatNote: string;
    renderTitle: string;
    renderWhere: string;
    done: string;
  };
}

export const UI_COPY: Record<Locale, UiCopy> = {
  en: {
    mainNav: 'Main navigation',
    mobileNav: 'Mobile navigation',
    footerNav: 'Footer',
    language: 'Language',
    breadcrumb: 'Breadcrumb',
    engine: 'MooScript engine',
    playhead: 'Playhead',
    timelineScrubber: 'Template timeline',
    templateStage: 'MooScript template stage',
    auroraStage: 'Transparent MooTween shot over aurora footage',
    auroraPhoto: 'Satellite view of orbital aurora ribbons and night city lights',
    how: {
      promptTitle: 'System prompt',
      lintTitle: 'Anti-Slide Linter',
      lintScore: 'Score 0 · PASS',
      lintRows: [
        ['Static slide layout', 'rejected', false],
        ['Frame 0 is a full poster', 'pass', true],
        ['Camera travel', 'push 1.08x to 1.00x', true],
        ['Word beats', '6 synced', true],
        ['Editable layers', '7 extracted', true]
      ],
      beatTitle: 'Beat-sync timeline',
      beatLocked: 'Locked 124 BPM',
      shot: 'Shot',
      beatNote: 'Auto-SFX on · whoosh at 0.00s · impact at 2.50s',
      renderTitle: 'WebCodecs export queue',
      renderWhere: 'GPU · local',
      done: 'Done'
    }
  },
  id: {
    mainNav: 'Navigasi utama',
    mobileNav: 'Navigasi seluler',
    footerNav: 'Navigasi kaki halaman',
    language: 'Bahasa',
    breadcrumb: 'Jejak halaman',
    engine: 'Mesin MooScript',
    playhead: 'Penanda waktu',
    timelineScrubber: 'Timeline template',
    templateStage: 'Panggung template MooScript',
    auroraStage: 'Adegan MooTween transparan di atas rekaman aurora',
    auroraPhoto: 'Pemandangan satelit pita aurora dan lampu kota di malam hari',
    how: {
      promptTitle: 'System prompt',
      lintTitle: 'Linter Anti-Slide',
      lintScore: 'Skor 0 · LOLOS',
      lintRows: [
        ['Layout slide statis', 'ditolak', false],
        ['Frame 0 sudah berupa poster', 'lolos', true],
        ['Gerak kamera', 'push 1.08x ke 1.00x', true],
        ['Ketukan kata', '6 tersinkron', true],
        ['Layer yang bisa diedit', '7 diekstrak', true]
      ],
      beatTitle: 'Timeline beat-sync',
      beatLocked: 'Terkunci 124 BPM',
      shot: 'Adegan',
      beatNote: 'Auto-SFX aktif · whoosh di 0.00s · impact di 2.50s',
      renderTitle: 'Antrean ekspor WebCodecs',
      renderWhere: 'GPU · lokal',
      done: 'Selesai'
    }
  }
};
