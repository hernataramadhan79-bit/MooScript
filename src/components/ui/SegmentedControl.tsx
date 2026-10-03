import React from 'react';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
  icon?: string;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'md' | 'sm';
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  className = '',
  size = 'md'
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      className={`inline-flex p-1 rounded-xl bg-surface-1 border border-border ${className}`}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        const paddingClass = size === 'md' ? 'min-h-[38px] px-3.5 py-1.5 text-[13px]' : 'min-h-[32px] px-2.5 py-1 text-[12px]';

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(option.value)}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-150 select-none ${paddingClass} ${
              isSelected
                ? 'bg-surface-3 text-on-surface shadow-sm font-semibold'
                : 'text-text-muted hover:text-on-surface hover:bg-surface-2'
            }`}
          >
            {option.icon && (
              <span className="material-symbols-outlined text-[16px]">{option.icon}</span>
            )}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
