import { CheckCircle2, Circle, Loader2, MinusCircle, XCircle } from 'lucide-react';
import type { E2EResult, E2ESummary } from '@/lib/e2eTest';
import { E2E_STEP_LABELS, formatE2ESummaryLine, summarizeE2EResults } from '@/lib/e2eTest';
import { cn } from '@/lib/utils';

interface DiagnosticsChecklistProps {
  results: E2EResult[] | null;
  running: boolean;
  className?: string;
}

function statusIcon(result: E2EResult | undefined, running: boolean) {
  if (running && !result) {
    return <Loader2 size={14} className="animate-spin text-muted-foreground" aria-hidden />;
  }
  if (!result) {
    return <Circle size={14} className="text-muted-foreground/50" aria-hidden />;
  }
  if (!result.passed) {
    return <XCircle size={14} className="text-destructive" aria-hidden />;
  }
  if (result.skipped) {
    return <MinusCircle size={14} className="text-warning" aria-hidden />;
  }
  return <CheckCircle2 size={14} className="text-success" aria-hidden />;
}

function resultForStep(results: E2EResult[] | null, step: string): E2EResult | undefined {
  return results?.find(r => r.step === step);
}

function getDiagnosticsSummary(results: E2EResult[] | null): E2ESummary | null {
  if (!results?.length) return null;
  return summarizeE2EResults(results);
}

export default function DiagnosticsChecklist({ results, running, className }: DiagnosticsChecklistProps) {
  const summary = getDiagnosticsSummary(results);

  return (
    <div className={cn('space-y-3', className)}>
      {summary && (
        <p
          className={cn(
            'text-xs font-medium',
            summary.failed === 0 ? 'text-success' : 'text-destructive',
          )}
          role="status"
          aria-live="polite"
        >
          {formatE2ESummaryLine(summary)}
        </p>
      )}

      <ul
        className="grid grid-cols-2 gap-x-3 gap-y-2"
        aria-label="E2E diagnostické kroky"
      >
        {E2E_STEP_LABELS.map(step => {
          const result = resultForStep(results, step);
          const label = result?.skipped ? `${step} (preskočené)` : step;
          return (
            <li key={step} className="flex items-center gap-2 text-xs text-foreground">
              {statusIcon(result, running && !result)}
              <span className={cn(!result && 'text-muted-foreground')}>{label}</span>
            </li>
          );
        })}
      </ul>

      {running && !results?.length && (
        <p className="text-xs text-muted-foreground">Prebieha overovanie služieb…</p>
      )}

      {results?.some(r => !r.passed) && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-2 text-[11px] text-destructive space-y-1">
          {results.filter(r => !r.passed).map(r => (
            <p key={r.step}><span className="font-medium">{r.step}:</span> {r.detail}</p>
          ))}
        </div>
      )}
    </div>
  );
}
