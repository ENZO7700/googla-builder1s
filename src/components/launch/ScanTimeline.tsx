import type { Scan } from '@/lib/launch/types';
import { diffArrow, formatDate, scoreColor } from '@/lib/launch/utils';

interface Props { scans: Scan[]; activeId?: string; onSelect?: (id: string) => void; }

export function ScanTimeline({ scans, activeId, onSelect }: Props) {
  if (scans.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        Zatiaľ žiadne skeny.
      </div>
    );
  }
  const ordered = [...scans].reverse();
  const newestId = scans[scans.length - 1]?.id;

  return (
    <ol className="relative space-y-4 border-l border-border pl-6">
      {ordered.map((scan, idx) => {
        const prev = scans[scans.length - 2 - idx];
        const delta = prev ? scan.scores.overall - prev.scores.overall : 0;
        const arrow = diffArrow(delta);
        const colors = scoreColor(scan.scores.overall);
        const isActive = (activeId ?? newestId) === scan.id;
        return (
          <li key={scan.id} className="relative">
            <span className={`absolute left-[-1.65rem] top-2 h-3 w-3 rounded-full ${
              isActive ? 'bg-primary ring-4 ring-primary/20' : 'bg-border'
            }`} aria-hidden />
            <button onClick={() => onSelect?.(scan.id)}
              className={`block w-full rounded-lg border px-4 py-3 text-left transition ${
                isActive ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/30 hover:bg-accent'
              }`}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-foreground">{formatDate(scan.createdAt)}</div>
                <div className="flex items-center gap-2 text-sm tabular-nums">
                  <span className={`font-semibold ${colors.text}`}>{scan.scores.overall}</span>
                  <span className={arrow.className}>
                    {arrow.symbol}{prev ? ` ${delta > 0 ? '+' : ''}${delta}` : ' new'}
                  </span>
                </div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{scan.summary}</div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
