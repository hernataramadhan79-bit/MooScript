import React from 'react';
import { MOO_API_EXAMPLE, MOO_API_GUIDE } from '../../engine/composition/runtime/mooApiGuide';

/** The MooScript scene API, shown next to the code editor for people writing their own scene code. */
export const MooApiGuidePanel: React.FC = () => (
  <div className="h-[26rem] overflow-y-auto p-3 flex flex-col gap-3 font-sans text-[12px] text-on-surface">
    <p className="text-text-muted leading-relaxed">
      Kode animasi scene ditulis dengan API MooScript dan dijalankan oleh mesin MooTween. Setiap gerak ditaruh di{' '}
      <code className="text-accent">shot</code>; helper <code className="text-accent">ctx.*</code> menyediakan gerak siap pakai.
    </p>
    {MOO_API_GUIDE.map((section, i) => (
      <details key={section.id} open={i < 2} className="rounded-lg border border-border bg-surface-2/60">
        <summary className="cursor-pointer select-none px-3 py-2 font-semibold text-[12px]">{section.title}</summary>
        <div className="px-3 pb-3 flex flex-col gap-1.5">
          {section.intro && <p className="text-text-muted leading-relaxed">{section.intro}</p>}
          {section.entries.map((entry) => (
            <div key={entry.use} className="grid grid-cols-[minmax(0,15rem)_1fr] gap-x-3 gap-y-0.5 max-sm:grid-cols-1">
              <code className="font-mono text-[11.5px] text-amber-300 break-words">{entry.use}</code>
              <span className="text-text-muted leading-snug">{entry.does}</span>
            </div>
          ))}
        </div>
      </details>
    ))}
    <div className="rounded-lg border border-border bg-[#050508]">
      <div className="px-3 pt-2 text-[11px] font-semibold text-text-muted">Contoh lengkap</div>
      <pre className="p-3 font-mono text-[11.5px] text-amber-300 whitespace-pre-wrap break-words">{MOO_API_EXAMPLE}</pre>
    </div>
  </div>
);
