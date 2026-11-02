import React from 'react';
import { Sheet } from './ui/Sheet';
import { useMooStore } from '../store/useMooStore';
import { L, t } from '../i18n';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const MOD = isMac ? '⌘' : 'Ctrl';

const GROUPS: { title: string; items: { keys: string[][]; label: string }[] }[] = [
  {
    title: L('Pemutaran'),
    items: [
      { keys: [['Space']], label: L('Putar / jeda') },
      { keys: [['J'], ['L']], label: L('Mundur / maju 1 detik') },
      { keys: [['K']], label: L('Jeda') },
      { keys: [['←'], ['→']], label: L('Mundur / maju 1 frame') },
      { keys: [['Home'], ['End']], label: L('Ke awal / akhir video') },
      { keys: [['Esc']], label: L('Tutup layar penuh / lepas pilihan adegan') }
    ]
  },
  {
    title: L('Timeline'),
    items: [
      { keys: [['I'], ['O']], label: L('Awal / akhir rentang putar ulang di playhead') },
      { keys: [['X']], label: L('Hapus rentang putar ulang') },
      { keys: [['M']], label: L('Tambah marker di playhead') },
      { keys: [['S']], label: L('Potong shot di playhead') },
      { keys: [[MOD, 'Scroll']], label: L('Perbesar / perkecil timeline') }
    ]
  },
  {
    title: L('Adegan'),
    items: [
      { keys: [['↑'], ['↓']], label: L('Adegan sebelumnya / berikutnya') },
      { keys: [[MOD, 'D']], label: L('Duplikat adegan aktif') },
      { keys: [['Delete']], label: L('Hapus adegan aktif') },
      { keys: [[MOD, 'Enter']], label: L('Susun adegan dari kolom ide') }
    ]
  },
  {
    title: L('Riwayat'),
    items: [
      { keys: [[MOD, 'Z']], label: L('Urungkan') },
      { keys: [[MOD, 'Y'], [MOD, 'Shift', 'Z']], label: L('Ulangi') }
    ]
  },
  {
    title: L('Bantuan'),
    items: [{ keys: [['?']], label: L('Tampilkan daftar ini') }]
  }
];

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="min-w-[26px] h-[26px] px-1.5 inline-flex items-center justify-center rounded-md bg-surface-3 border border-border-strong border-b-2 font-mono text-[11px] text-on-surface">
    {children}
  </kbd>
);

export const ShortcutsModal: React.FC = () => {
  const isOpen = useMooStore((s) => s.isShortcutsOpen);
  const setOpen = useMooStore((s) => s.setShortcutsOpen);

  return (
    <Sheet
      isOpen={isOpen}
      onClose={() => setOpen(false)}
      title={t('Shortcut Keyboard')}
      description={t('Berlaku saat kursor tidak sedang di kolom teks.')}
      maxWidth="max-w-xl"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        {GROUPS.map((group) => (
          <section key={group.title} className="flex flex-col gap-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{t(group.title)}</h3>
            <ul className="flex flex-col gap-2">
              {group.items.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-3">
                  <span className="text-[13px] text-on-surface">{t(item.label)}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    {item.keys.map((combo, i) => (
                      <React.Fragment key={combo.join('+')}>
                        {i > 0 && <span className="text-[11px] text-text-faint">/</span>}
                        {combo.map((k) => (
                          <Kbd key={k}>{k}</Kbd>
                        ))}
                      </React.Fragment>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Sheet>
  );
};
