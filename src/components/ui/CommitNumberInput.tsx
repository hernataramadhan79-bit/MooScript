import React, { useState, useEffect } from 'react';

export interface CommitNumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number;
  onCommit: (nextValue: number) => void;
  fallbackValue?: number;
  min?: number;
  max?: number;
  step?: number | string;
  ariaLabel?: string;
}

export const CommitNumberInput: React.FC<CommitNumberInputProps> = ({
  value,
  onCommit,
  fallbackValue = 0,
  min,
  max,
  step = 'any',
  ariaLabel,
  className,
  onBlur,
  onKeyDown,
  ...rest
}) => {
  const [localStr, setLocalStr] = useState<string>(String(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalStr(String(value));
    }
  }, [value, isFocused]);

  const commit = (raw: string) => {
    const parsed = parseFloat(raw);
    let finalVal = Number.isFinite(parsed) ? parsed : fallbackValue;
    if (min !== undefined && finalVal < min) finalVal = min;
    if (max !== undefined && finalVal > max) finalVal = max;
    setLocalStr(String(finalVal));
    if (finalVal !== value) {
      onCommit(finalVal);
    }
  };

  return (
    <input
      {...rest}
      aria-label={ariaLabel || rest['aria-label']}
      type="number"
      step={step}
      min={min}
      max={max}
      value={localStr}
      onFocus={(e) => {
        setIsFocused(true);
        rest.onFocus?.(e);
      }}
      onChange={(e) => {
        setLocalStr(e.target.value);
      }}
      onBlur={(e) => {
        setIsFocused(false);
        commit(e.target.value);
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
        onKeyDown?.(e);
      }}
      className={className}
    />
  );
};
