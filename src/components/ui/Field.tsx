import React from 'react';

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export const Field: React.FC<FieldProps> = ({ label, hint, error, children, className = '' }) => {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-[13px] font-medium text-on-surface-variant flex items-center justify-between">
          <span>{label}</span>
          {hint && <span className="text-[12px] text-text-faint">{hint}</span>}
        </label>
      )}
      {children}
      {error && <span className="text-[12px] text-red-400">{error}</span>}
    </div>
  );
};

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`w-full min-h-[44px] px-3.5 py-2 text-[14px] rounded-lg bg-surface-2 text-on-surface placeholder:text-text-faint border ${
          error ? 'border-red-500/50 focus:border-red-500' : 'border-border focus:border-accent'
        } focus:outline-none transition-colors disabled:opacity-50 disabled:bg-surface-1 ${className}`}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', error, rows = 3, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={`w-full p-3 text-[14px] leading-relaxed rounded-lg bg-surface-2 text-on-surface placeholder:text-text-faint border ${
          error ? 'border-red-500/50 focus:border-red-500' : 'border-border focus:border-accent'
        } focus:outline-none transition-colors resize-none disabled:opacity-50 disabled:bg-surface-1 ${className}`}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';
