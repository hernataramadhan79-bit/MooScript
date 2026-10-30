import { useState } from 'react';
import type { FaqItem } from '../../data/faqs';

interface Props {
  heading: string;
  items: FaqItem[];
}

export default function FaqIndex({ heading, items }: Props) {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const current = items[activeIndex] || items[0];

  return (
    <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-8">
      <div className="md:col-span-5">
        <h2 className="mb-6 text-[28px] font-bold text-[#f4f4f6] md:text-[32px]">{heading}</h2>
        <div className="flex flex-col gap-4">
          {items.map((item, idx) => {
            const selected = idx === activeIndex;
            return (
              <div key={item.question} className="flex flex-col">
                <button
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onFocus={() => setActiveIndex(idx)}
                  aria-expanded={selected}
                  className="flex min-h-[44px] cursor-pointer items-start gap-3.5 text-left transition-colors"
                >
                  <span
                    aria-hidden="true"
                    className={`mt-2.5 h-2 w-2 shrink-0 rounded-full transition-colors ${
                      selected ? 'bg-[#84cc16]' : 'bg-[#52525b]'
                    }`}
                  />
                  <span
                    className={`text-[17px] leading-[1.45] transition-colors ${
                      selected ? 'font-semibold text-[#f4f4f6]' : 'text-[#a1a1aa] hover:text-[#f4f4f6]'
                    }`}
                  >
                    {item.question}
                  </span>
                </button>

                {selected && (
                  <p className="mt-3 pl-5 text-[17px] leading-[1.6] text-[#d4d4d8] md:hidden">{item.answer}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="hidden md:col-span-6 md:col-start-7 md:block">
        <div className="sticky top-28 rounded-lg bg-[#111116] p-8">
          <p className="max-w-[36ch] text-[24px] leading-[1.42] text-[#f4f4f6] transition-opacity duration-150">
            {current?.answer}
          </p>
        </div>
      </div>
    </div>
  );
}
