export interface BarItem {
  label: string;
  value: number;
  /** The number written next to the bar (never hidden behind hover). */
  valueLabel: string;
}

/**
 * Horizontal bars for people who are not used to charts: one hue, thin marks, and the number
 * is always printed beside each bar, so the list is also its own table view.
 */
export function BarList({
  items,
  ariaLabel,
  emptyText,
}: {
  items: BarItem[];
  ariaLabel: string;
  emptyText: string;
}) {
  const max = Math.max(0, ...items.map((i) => i.value));
  if (items.length === 0 || max === 0) return <p>{emptyText}</p>;

  return (
    <ul aria-label={ariaLabel} className="space-y-3">
      {items.map((item) => {
        const width = item.value > 0 ? Math.max(2, Math.round((item.value / max) * 100)) : 0;
        return (
          <li key={item.label} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-ink-900">{item.label}</span>
              <span className="shrink-0 font-semibold text-ink-900">{item.valueLabel}</span>
            </div>
            <div aria-hidden className="h-3 rounded-full bg-clay-100">
              <div
                data-testid="bar"
                className="h-3 rounded-full bg-sage-700"
                style={{ width: `${width}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
