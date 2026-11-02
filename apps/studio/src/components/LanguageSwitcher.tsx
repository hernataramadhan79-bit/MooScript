import React from 'react';
import { LOCALES, setLocale, t, useLocale } from '../i18n';

interface LanguageSwitcherProps {
  /** Two-letter chips for the header; the full variant spells the language out. */
  variant?: 'compact' | 'full';
  className?: string;
}

/** Switches the interface language. The choice is remembered and overrides the automatic default. */
export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ variant = 'compact', className = '' }) => {
  const locale = useLocale();

  return (
    <div
      role="group"
      aria-label={t('Bahasa antarmuka')}
      className={`inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-2 border border-border ${className}`}
    >
      {variant === 'compact' && (
        <span aria-hidden="true" className="material-symbols-outlined text-[15px] text-text-faint pl-1.5 pr-0.5">
          translate
        </span>
      )}
      {LOCALES.map((l) => {
        const selected = l.id === locale;
        return (
          <button
            key={l.id}
            type="button"
            lang={l.id}
            aria-pressed={selected}
            title={l.native}
            onClick={() => setLocale(l.id)}
            className={`rounded-md font-semibold transition-colors ${
              variant === 'compact' ? 'h-7 min-w-[30px] px-1.5 text-[11px]' : 'min-h-[36px] flex-1 px-3 text-[13px]'
            } ${selected ? 'bg-surface-3 text-accent' : 'text-text-muted hover:text-on-surface'}`}
          >
            {variant === 'compact' ? l.label : l.native}
          </button>
        );
      })}
    </div>
  );
};
