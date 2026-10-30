import React from 'react';
import { Sheet } from './Sheet';
import { Button } from './Button';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  icon?: string;
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Lanjutkan',
  cancelLabel = 'Batal',
  variant = 'primary',
  icon = 'warning',
  isLoading = false
}) => {
  return (
    <Sheet isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3.5">
          {icon && (
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                variant === 'danger'
                  ? 'bg-rose-500/15 text-rose-400'
                  : variant === 'warning'
                    ? 'bg-amber-500/15 text-amber-400'
                    : 'bg-accent/15 text-accent'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">{icon}</span>
            </div>
          )}
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-on-surface">{title}</h3>
            <p className="text-[13px] text-text-muted leading-relaxed">{description}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/60">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="sm"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Sheet>
  );
};
