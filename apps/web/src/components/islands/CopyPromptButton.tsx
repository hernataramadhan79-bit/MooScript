import { useState } from 'react';
import { getOfficialMooScriptPrompt } from '@mooscript/presets';
import type { Locale } from '../../config/site';
import { HOME_COPY } from '../../data/homeCopy';

interface Props {
  locale: Locale;
  tone?: 'quiet' | 'dark';
}

export default function CopyPromptButton({ locale, tone = 'quiet' }: Props) {
  const copy = HOME_COPY[locale].how;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(getOfficialMooScriptPrompt(locale));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2600);
    }
  };

  return (
    <button type="button" onClick={handleCopy} className={`btn ${tone === 'dark' ? 'btn-dark' : 'btn-quiet'}`}>
      {copied ? copy.copiedPrompt : copy.copyPrompt}
    </button>
  );
}
