import React, { useEffect, useState } from 'react';
import { buildScriptRequest, looksLikeScript } from '../../engine/ai/instantStoryboard';
import { t } from '../../i18n';

const FREE_CHATS = [
  { name: 'ChatGPT', href: 'https://chatgpt.com/' },
  { name: 'Gemini', href: 'https://gemini.google.com/' },
  { name: 'Claude', href: 'https://claude.ai/' }
];

/** Gets a real script from a free AI chat, with no API key: copy the request, paste the answer back. */
export const FreeAiHelper: React.FC<{ topic: string; onCopied?: () => void }> = ({ topic, onCopied }) => {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  // Pasting the answer changes the field, which finishes this step.
  useEffect(() => {
    setCopied(false);
    setFailed(false);
  }, [topic]);

  if (!topic.trim() || looksLikeScript(topic)) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(buildScriptRequest(topic));
      setCopied(true);
      setFailed(false);
      onCopied?.();
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 text-[11px] leading-relaxed text-text-muted">
      <button
        type="button"
        onClick={copy}
        className="self-start min-h-[32px] inline-flex items-center gap-1.5 font-medium text-accent hover:underline underline-offset-2"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[15px]">content_copy</span>
        {t('Mau isi yang lebih bagus? Minta naskah ke AI gratis')}
      </button>
      {copied && (
        <p role="status">
          {t('Permintaan disalin. Tempel di')}{' '}
          {FREE_CHATS.map((chat, i) => (
            <React.Fragment key={chat.name}>
              {i > 0 && ', '}
              <a href={chat.href} target="_blank" rel="noopener noreferrer" className="underline hover:text-on-surface">
                {chat.name}
              </a>
            </React.Fragment>
          ))}
          {t(', lalu tempel jawabannya di kolom ini.')}
        </p>
      )}
      {failed && (
        <>
          <p role="alert">{t('Browser menolak menyalin. Salin teks ini secara manual:')}</p>
          {/* In-app browsers often block the clipboard, so the request stays reachable. */}
          <textarea
            readOnly
            rows={4}
            value={buildScriptRequest(topic)}
            onFocus={(e) => e.target.select()}
            aria-label={t('Permintaan naskah untuk AI')}
            className="w-full rounded-lg border border-border bg-surface-2 p-2 text-[11px] text-text resize-none focus:outline-none focus:border-accent"
          />
        </>
      )}
    </div>
  );
};
