/** Match the server's distinction between written text and objective selections. */
export function hasAnswerValue(value: string | undefined, type: 'single' | 'multiple' | 'written' | undefined): boolean {
  if (!value || !type) return false;
  if (type === 'written') return value.trim().length > 0;
  try {
    const selected: unknown = JSON.parse(value);
    return Array.isArray(selected) && selected.length > 0 && selected.every(v => typeof v === 'string');
  } catch {
    return false;
  }
}
