import React from 'react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  'aria-label': string; // Wajib untuk aksesibilitas
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  badge?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  'aria-label': ariaLabel,
  variant = 'ghost',
  size = 'md',
  badge = false,
  className = '',
  disabled,
  ...props
}) => {
  const sizeClasses =
    size === 'md'
      ? 'w-11 h-11 min-w-[44px] min-h-[44px] text-[20px]'
      : 'w-9 h-9 min-w-[36px] min-h-[36px] text-[18px]';

  const variantClasses = {
    primary: 'bg-accent text-on-accent hover:bg-primary-fixed',
    secondary: 'bg-surface-2 text-on-surface border border-border hover:bg-surface-3',
    ghost: 'bg-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-2',
    danger: 'bg-accent-danger/15 text-red-400 border border-red-500/20 hover:bg-accent-danger/25'
  }[variant];

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      disabled={disabled}
      className={`relative inline-flex items-center justify-center rounded-lg transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:pointer-events-none select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      <span className="material-symbols-outlined">{icon}</span>
      {badge && (
        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent animate-pulse ring-2 ring-background" />
      )}
    </button>
  );
};
