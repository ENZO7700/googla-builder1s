import { severityCounts } from '@/lib/launch/demoData';
import type { Finding } from '@/lib/launch/types';
import { SEVERITY_ORDER } from '@/lib/launch/types';
import { severityClasses } from '@/lib/launch/utils';

export function SeverityChart({ findings }: { findings: Finding[] }) {
  const counts = severityCounts(findings);
  const total = findings.length;
  const max = Math.max(1, ...Object.values(counts));

  if (total === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Žiadne nálezy.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {total} {total === 1 ? 'nález' : 'nálezov'} celkom
      </div>
      <div className="space-y-2">
        {SEVERITY_ORDER.map(sev => {
          const c = counts[sev];
          const cls = severityClasses(sev);
          return (
            <div key={sev} className="flex items-center gap-3">
              <div className="w-20 text-xs font-medium text-foreground">{cls.label}</div>
              <div className="relative h-5 flex-1 overflow-hidden rounded bg-accent">
                <div className={`h-full ${cls.bar} transition-all`} style={{ width: `${(c / max) * 100}%` }} />
              </div>
              <div className="w-8 text-right text-sm tabular-nums text-foreground">{c}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
