/**
 * File utility helpers for sanitizing filenames and triggering browser downloads.
 */

export function safeFileName(title?: string): string {
  if (!title) return 'mooscript';
  const cleaned = title.replace(/[\\/:*?"<>|]+/g, '-').trim();
  return cleaned || 'mooscript';
}

export function triggerFileDownload(url: string, filename: string): void {
  if (typeof document === 'undefined') return;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (typeof document !== 'undefined' && document.body && document.body.contains(a)) {
      document.body.removeChild(a);
    }
  }, 100);
}
