import React, { useState, useRef, useEffect } from 'react';

export const DebouncedSlider: React.FC<{
  value: number;
  min: number;
  max: number;
  step: number;
  onChangeComplete: (val: number) => void;
  /** Called on every move, for a live readout while the store is only written on release. */
  onInput?: (val: number) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}> = ({ value, min, max, step, onChangeComplete, onInput, disabled, className, ariaLabel }) => {
  const [localVal, setLocalVal] = useState(value);
  const valRef = useRef(value);
  const committedRef = useRef(value);

  useEffect(() => {
    setLocalVal(value);
    valRef.current = value;
    committedRef.current = value;
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setLocalVal(v);
    valRef.current = v;
    onInput?.(v);
  };

  // One commit per gesture, and none when the thumb ends where it started (a click or a blur).
  const handleCommit = () => {
    if (valRef.current === committedRef.current) return;
    committedRef.current = valRef.current;
    onChangeComplete(valRef.current);
  };

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={localVal}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={handleChange}
      onPointerUp={handleCommit}
      onKeyUp={handleCommit}
      onBlur={handleCommit}
      className={className}
    />
  );
};

/** A labelled range whose readout follows the thumb live and whose value is committed on release. */
export const CommitSliderRow: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (val: number) => string;
  onCommit: (val: number) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}> = ({ label, value, min, max, step, format, onCommit, disabled, size = 'md' }) => {
  const [live, setLive] = useState(value);
  useEffect(() => setLive(value), [value]);
  const small = size === 'sm';
  return (
    <div className={`flex flex-col ${small ? 'gap-1' : 'gap-1.5'}`}>
      <div className={`flex items-center justify-between ${small ? 'text-[11px]' : 'text-[12px]'}`}>
        <span className={`text-text-muted ${small ? '' : 'font-medium'}`}>{label}</span>
        <span className={`font-mono text-on-surface ${small ? 'text-[10px]' : 'font-semibold'}`}>{format(live)}</span>
      </div>
      <DebouncedSlider
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        ariaLabel={label}
        onInput={setLive}
        onChangeComplete={onCommit}
        className={`w-full ${small ? 'h-1 bg-surface-3' : 'h-1.5 bg-surface-2'} rounded-lg appearance-none cursor-pointer accent-accent disabled:opacity-40 disabled:cursor-not-allowed`}
      />
    </div>
  );
};

export const DebouncedColor: React.FC<{
  value: string;
  onChangeComplete: (val: string) => void;
  className?: string;
  ariaLabel?: string;
}> = ({ value, onChangeComplete, className, ariaLabel }) => {
  const [localVal, setLocalVal] = useState(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committedRef = useRef(value);

  useEffect(() => {
    setLocalVal(value);
    committedRef.current = value;
  }, [value]);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );

  // Opening and closing the picker without choosing must not apply the color shown as default.
  const commit = (v: string) => {
    if (v.toLowerCase() === committedRef.current.toLowerCase()) return;
    committedRef.current = v;
    onChangeComplete(v);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocalVal(v);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => commit(v), 200);
  };

  const handleBlur = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    commit(localVal);
  };

  return (
    <input
      type="color"
      value={localVal}
      aria-label={ariaLabel}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
    />
  );
};

