import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  isLoading?: boolean;
  icon?: string;
  iconPosition?: 'left' | 'right';
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  isLoading = false,
  icon,
  iconPosition = 'left',
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses =
    'relative inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';

  const sizeClasses =
    size === 'md'
      ? 'min-h-[44px] px-4 py-2 text-[14px] gap-2'
      : 'min-h-[36px] px-3 py-1.5 text-[13px] gap-1.5';

  const variantClasses = {
    primary: 'bg-accent text-on-accent font-semibold hover:bg-primary-fixed shadow-sm',
    secondary: 'bg-surface-2 text-on-surface border border-border hover:bg-surface-3 hover:border-border-strong',
    ghost: 'bg-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-2',
    danger: 'bg-accent-danger/15 text-red-400 border border-red-500/20 hover:bg-accent-danger/25'
  }[variant];

  return (
    <button
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <span className="material-symbols-outlined animate-spin text-[18px]">
          progress_activity
        </span>
      )}
      {!isLoading && icon && iconPosition === 'left' && (
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      )}
      {children && <span>{children}</span>}
      {!isLoading && icon && iconPosition === 'right' && (
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      )}
    </button>
  );
};
