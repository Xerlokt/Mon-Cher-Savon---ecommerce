/** Parses what the seller types ("18", "18,5", "R$ 1.234,56") into cents. Returns null when invalid. */
export function parsePriceToCents(input: string): number | null {
  const cleaned = input.replace(/R\$|\s/g, '');
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$|^\d+\.\d{1,2}$/.test(cleaned)) return null;
  const normalized = /,/.test(cleaned)
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(\.\d{3})+$/.test(cleaned)
      ? cleaned.replace(/\./g, '')
      : cleaned;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isFinite(cents) && cents > 0 ? cents : null;
}

/** 1850 -> "18,50" (for editing inside a text field). */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}
