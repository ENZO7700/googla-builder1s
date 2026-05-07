import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, AlertCircle, Wand2 } from 'lucide-react';
import type { Finding } from '@/lib/launch/types';
import { DIMENSION_LABEL } from '@/lib/launch/types';
import { severityClasses } from '@/lib/launch/utils';
import { DIMENSION_LABEL } from '@/lib/launch/types';
import { severityClasses } from '@/lib/launch/utils';

export function CopyPromptButton({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied'); setTimeout(() => setState('idle'), 2000);
    } catch {
      setState('error'); setTimeout(() => setState('idle'), 2500);
    }
  }
  return (
    <button onClick={copy}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
        state === 'copied' ? 'bg-success text-success-foreground'
        : state === 'error' ? 'bg-destructive text-destructive-foreground'
        : 'bg-foreground text-background hover:opacity-90'
      }`}>
      {state === 'copied' ? <Check size={14} /> : state === 'error' ? <AlertCircle size={14} /> : <Copy size={14} />}
      {state === 'copied' ? 'Skopírované' : state === 'error' ? 'Chyba' : 'Kopírovať fix prompt'}
    </button>
  );
}

export function FindingCard({ finding, defaultOpen }: { finding: Finding; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const sev = severityClasses(finding.severity);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="flex w-full items-start gap-3 p-4 text-left hover:bg-accent transition-colors">
        <span className={`mt-0.5 inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${sev.badge}`}>
          {sev.label}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h3 className="truncate text-sm font-semibold text-foreground">{finding.title}</h3>
            <span className="shrink-0 text-xs text-muted-foreground">{DIMENSION_LABEL[finding.dimension]}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{finding.explanation}</p>
        </div>
        <span className={`ml-2 mt-1 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>▾</span>
      </button>
      {open && (
        <div className="border-t border-border p-4 text-sm space-y-3">
          <Section title="Prečo to záleží">{finding.whyItMatters}</Section>
          <Section title="Odporúčaná oprava">{finding.recommendedFix}</Section>
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Builder fix prompt
              </div>
              <CopyPromptButton text={finding.builderPrompt} />
            </div>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-accent p-3 font-mono text-xs leading-relaxed text-foreground">
{finding.builderPrompt}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <p className="mt-1 text-sm text-foreground/90">{children}</p>
    </div>
  );
}
