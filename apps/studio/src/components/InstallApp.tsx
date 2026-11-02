import React, { useEffect } from 'react';
import { t, useLocale } from '../i18n';
import {
  closeInstallDialog,
  getInstallPlatform,
  openInstallDialog,
  promptInstall,
  useInstallState
} from '../pwa/install';
import { Button } from './ui/Button';
import { Sheet } from './ui/Sheet';

/** Starts installation: the browser's own prompt when it offers one, the how-to dialog otherwise. */
function startInstall(canPrompt: boolean) {
  if (canPrompt) {
    void promptInstall().then((accepted) => {
      if (!accepted) openInstallDialog();
    });
  } else {
    openInstallDialog();
  }
}

interface InstallAppButtonProps {
  className?: string;
  /** `compact` is the header chip; `full` is a wide button for menus and drawers. */
  variant?: 'compact' | 'full';
}

/** Tells people the studio can be installed as an app. Hidden once it is installed. */
export const InstallAppButton: React.FC<InstallAppButtonProps> = ({ className = '', variant = 'compact' }) => {
  const { canPrompt, isInstalled } = useInstallState();
  if (isInstalled) return null;

  if (variant === 'full') {
    return (
      <Button variant="secondary" icon="download" onClick={() => startInstall(canPrompt)} className={className}>
        {t('Pasang Aplikasi')}
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => startInstall(canPrompt)}
      title={t('Pasang MooScript Studio sebagai aplikasi')}
      aria-label={t('Pasang aplikasi')}
      className={`inline-flex items-center justify-center gap-1.5 h-8 px-2 sm:px-2.5 rounded-lg border border-accent/40 bg-accent/10 text-accent text-[12px] font-semibold hover:bg-accent/20 active:scale-95 transition-all ${className}`}
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
        download
      </span>
      <span className="hidden sm:inline">{t('Pasang')}</span>
    </button>
  );
};

function steps(platform: ReturnType<typeof getInstallPlatform>): string[] {
  switch (platform) {
    case 'ios-device':
      return [
        t('Ketuk tombol Bagikan di bilah Safari.'),
        t('Pilih "Tambahkan ke Layar Utama".'),
        t('Ketuk Tambah. Ikon MooScript muncul di layar utama.')
      ];
    case 'android-device':
      return [
        t('Buka menu browser (⋮) di pojok kanan atas.'),
        t('Pilih "Pasang aplikasi" atau "Tambahkan ke layar utama".'),
        t('Konfirmasi dengan mengetuk Pasang.')
      ];
    case 'desktop-chromium':
      return [
        t('Klik ikon pasang di ujung kanan bilah alamat, atau buka menu (⋮).'),
        t('Pilih "Pasang MooScript Studio".'),
        t('Konfirmasi dengan mengklik Pasang.')
      ];
    default:
      return [t('Browser ini belum mendukung pemasangan aplikasi web. Buka MooScript Studio di Chrome atau Edge untuk memasangnya.')];
  }
}

/** The install explainer. Opens from the install button, or on arrival with `?install=1` from the website. */
export const InstallDialog: React.FC = () => {
  useLocale();
  const { canPrompt, isInstalled, dialogOpen } = useInstallState();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (!params.has('install')) return;
      params.delete('install');
      const query = params.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
      if (!isInstalled) openInstallDialog();
    } catch {
      // A malformed URL only skips the auto-open.
    }
    // Reads the URL once on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const howTo = steps(getInstallPlatform());
  const benefits = [
    { icon: 'smartphone', text: t('Buka dari layar utama atau menu aplikasi, tanpa tab browser.') },
    { icon: 'cloud_done', text: t('Tetap bisa dipakai tanpa internet setelah terpasang.') },
    { icon: 'check_circle', text: t('Proyek tetap tersimpan di perangkat ini, tanpa akun.') }
  ];

  return (
    <Sheet
      isOpen={dialogOpen}
      onClose={closeInstallDialog}
      title={t('Pasang MooScript Studio')}
      description={t('Pakai sebagai aplikasi (PWA) di perangkat Anda.')}
      maxWidth="max-w-md"
    >
      {isInstalled ? (
        <p className="flex items-center gap-2 text-[13px] text-text">
          <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-accent">
            check_circle
          </span>
          {t('Aplikasi sudah terpasang.')}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-2.5">
            {benefits.map((b) => (
              <li key={b.icon} className="flex items-start gap-2.5 text-[13px] text-text-muted leading-snug">
                <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-accent shrink-0">
                  {b.icon}
                </span>
                <span>{b.text}</span>
              </li>
            ))}
          </ul>

          {canPrompt ? (
            <Button
              variant="primary"
              icon="download"
              onClick={() => {
                void promptInstall();
              }}
            >
              {t('Pasang Sekarang')}
            </Button>
          ) : (
            <div className="flex flex-col gap-2 p-3 rounded-xl bg-surface-2/60 border border-border/60">
              <p className="text-[12px] font-semibold text-on-surface">{howTo.length > 1 ? t('Cara memasang') : t('Belum didukung')}</p>
              {howTo.length > 1 ? (
                <ol className="flex flex-col gap-1.5 text-[13px] text-text-muted leading-snug list-decimal pl-5">
                  {howTo.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              ) : (
                <p className="text-[13px] text-text-muted leading-snug">{howTo[0]}</p>
              )}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
};
