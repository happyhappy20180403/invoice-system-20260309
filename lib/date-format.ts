/**
 * Date formatting utilities for Malaysian locale (DD/MM/YYYY)
 */

/** Convert YYYY-MM-DD to DD/MM/YYYY for display */
export function formatDateMY(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/** Convert DD/MM/YYYY to YYYY-MM-DD for storage */
export function parseDateMY(displayDate: string): string {
  if (!displayDate) return '';
  const parts = displayDate.split('/');
  if (parts.length !== 3) return displayDate;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}
