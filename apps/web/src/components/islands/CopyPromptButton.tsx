import { useState } from 'react';
import { getOfficialMooScriptPrompt } from '@mooscript/presets';
import type { Locale } from '../../config/site';
import { HOME_COPY } from '../../data/homeCopy';

interface Props {
  locale: Locale;
}

export default function CopyPromptButton({ locale }: Props) {
  const copy = HOME_COPY[locale].aiWorkflow;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const promptText = getOfficialMooScriptPrompt(locale);
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2600);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-md bg-[#84cc16] px-4 text-[15px] font-bold text-[#0e1e00] transition-colors hover:bg-[#9be022]"
    >
      {copied ? copy.copiedPromptBtn : copy.copyPromptBtn}
    </button>
  );
}
