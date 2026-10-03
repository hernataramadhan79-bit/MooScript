import React, { useEffect, useRef } from 'react';

export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  side?: 'center' | 'right' | 'bottom';
  maxWidth?: string;
}

export const Sheet: React.FC<SheetProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  side = 'center',
  maxWidth = 'max-w-lg'
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const rect = dialog.getBoundingClientRect();
    const isInDialog =
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width;

    if (!isInDialog) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className={`fixed inset-0 z-50 p-0 m-auto bg-transparent backdrop:bg-black/70 backdrop:backdrop-blur-sm text-on-surface overflow-visible ${
        side === 'right'
          ? 'mr-0 h-full max-h-screen w-full sm:w-[480px] rounded-l-2xl'
          : side === 'bottom'
            ? 'mb-0 w-full rounded-t-2xl'
            : `w-[calc(100%-2rem)] ${maxWidth} rounded-2xl`
      }`}
    >
      <div className="flex flex-col bg-surface-1 border border-border rounded-[inherit] max-h-[90vh] shadow-2xl overflow-hidden">
        {/* Header */}
        {(title || description) && (
          <div className="flex items-start justify-between p-4 sm:p-5 border-b border-border/80 bg-surface-1/90 backdrop-blur-md">
            <div>
              {title && <h2 className="text-[17px] font-semibold text-on-surface tracking-tight">{title}</h2>}
              {description && <p className="text-[13px] text-text-muted mt-0.5">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup dialog"
              className="w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-text-muted hover:text-on-surface hover:bg-surface-2 transition-colors -mr-1"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </dialog>
  );
};
