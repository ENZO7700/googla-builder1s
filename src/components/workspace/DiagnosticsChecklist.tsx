import { CheckCircle2, Circle, Loader2, MinusCircle, XCircle } from 'lucide-react';
import type { E2EResult, E2ESummary } from '@/lib/e2eTest';
import {
  E2E_STEP_DISPLAY_LABELS,
  E2E_STEP_LABELS,
  formatE2ESummaryLine,
  summarizeE2EResults,
} from '@/lib/e2eTest';
import { cn } from '@/lib/utils';

interface DiagnosticsChecklistProps {
  results: E2EResult[] | null;
  running: boolean;
  className?: string;
}

function statusIcon(result: E2EResult | undefined, running: boolean) {
  if (running && !result) {
    return <Loader2 size={14} className="animate-spin text-muted-foreground shrink-0" aria-hidden />;
  }
  if (!result) {
    return <Circle size={14} className="text-muted-foreground/50 shrink-0" aria-hidden />;
  }
  if (!result.passed) {
    return <XCircle size={14} className="text-destructive shrink-0" aria-hidden />;
  }
  if (result.skipped) {
    return <MinusCircle size={14} className="text-warning shrink-0" aria-hidden />;
  }
  return <CheckCircle2 size={14} className="text-success shrink-0" aria-hidden />;
}

function resultForStep(results: E2EResult[] | null, step: string): E2EResult | undefined {
  return results?.find(r => r.step === step);
}

function displayLabel(step: string, result?: E2EResult): string {
  const base = E2E_STEP_DISPLAY_LABELS[step as keyof typeof E2E_STEP_DISPLAY_LABELS] ?? step;
  return result?.skipped ? `${base} (preskočené)` : base;
}

export default function DiagnosticsChecklist({ results, running, className }: DiagnosticsChecklistProps) {
  const summary: E2ESummary | null = results?.length ? summarizeE2EResults(results) : null;
  const completedCount = results?.length ?? 0;

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
        className="max-h-[280px] overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 pr-1"
        aria-label="E2E diagnostické kroky"
      >
        {E2E_STEP_LABELS.map(step => {
          const result = resultForStep(results, step);
          const pending = running && completedCount > 0 && !result;
          return (
            <li key={step} className="flex items-center gap-2 text-xs text-foreground min-w-0">
              {statusIcon(result, pending || (running && !results?.length))}
              <span className={cn('truncate', !result && 'text-muted-foreground')} title={result?.detail}>
                {displayLabel(step, result)}
              </span>
            </li>
          );
        })}
      </ul>

      {running && !results?.length && (
        <p className="text-xs text-muted-foreground">
          Prebieha overovanie služieb a modulov workspace…
        </p>
      )}

      {!running && !results?.length && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          Spustite test pre overenie auth, databázy, AI, WordPress, modulov workspace a nastavení.
          Kroky bez pripojenia alebo v demo režime sa označia ako preskočené.
        </p>
      )}

      {results?.some(r => !r.passed) && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-2 text-[11px] text-destructive space-y-1">
          <p className="font-medium">Zlyhané kroky:</p>
          {results.filter(r => !r.passed).map(r => (
            <p key={r.step}>
              {displayLabel(r.step)}: {r.detail}
            </p>
          ))}
        </div>
      )}

      {results?.some(r => r.skipped) && !results.some(r => !r.passed) && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Niektoré kroky boli preskočené (Local Demo, chýbajúca WP stránka alebo neprepojený GitHub) — to je očakávané.
        </p>
      )}
    </div>
  );
}
