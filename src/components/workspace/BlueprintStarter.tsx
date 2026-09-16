import { useState } from 'react';
import { Compass, Loader2, Shuffle, Trash2, Copy, CopyCheck, Send } from 'lucide-react';
import { MarkdownRenderer } from '@/lib/formatMarkdown';
import {
  BlueprintCriteria,
  BlueprintDepth,
  DEFAULT_CRITERIA,
  DEPTHS,
  PRIORITIES,
  PROJECT_TYPES,
  RANDOM_PRESETS,
  STACKS,
  extractPromptPack,
} from '@/lib/blueprintPrompts';

interface BlueprintStarterProps {
  onGenerate: (criteria: BlueprintCriteria) => Promise<string>;
  onSendToChat?: (prompt: string) => void;
}

export default function BlueprintStarter({ onGenerate, onSendToChat }: BlueprintStarterProps) {
  const [criteria, setCriteria] = useState<BlueprintCriteria>(DEFAULT_CRITERIA);
  const [result, setResult] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const set = <K extends keyof BlueprintCriteria>(key: K, value: BlueprintCriteria[K]) =>
    setCriteria((c) => ({ ...c, [key]: value }));

  const togglePriority = (p: string) =>
    setCriteria((c) => ({
      ...c,
      priorities: c.priorities.includes(p)
        ? c.priorities.filter((x) => x !== p)
        : [...c.priorities, p],
    }));

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(key);
    setTimeout(() => setCopied((k) => (k === key ? null : k)), 1600);
  };

  const run = async () => {
    setIsRunning(true);
    setResult('');
    try {
      setResult(await onGenerate(criteria));
    } finally {
      setIsRunning(false);
    }
  };

  const pack = result ? extractPromptPack(result) : [];
  const hasOutput = Boolean(result) || isRunning;

  return (
    <div className="grid h-full min-h-0 w-full overflow-y-auto bg-background lg:grid-cols-[minmax(380px,460px)_minmax(0,1fr)] lg:overflow-hidden">
      {/* ── Left: criteria form ── */}
      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-b border-border bg-accent lg:border-b-0 lg:border-r">
        {/* Scrollable form body */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 [scrollbar-gutter:stable] sm:p-5">
          {!hasOutput && (
            <div className="flex flex-col items-center py-2 text-center animate-fade-in">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card">
                <Compass size={26} className="text-primary" />
              </div>
              <h3 className="text-base font-medium text-foreground mb-1">Startovací blueprint</h3>
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                Zadajte kritériá a AI vygeneruje architektúru, dátový model, milestony a prompty od
                A po Z.
              </p>
            </div>
          )}

          {/* Group 1: basics */}
          <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
            <GroupLabel step="1" title="Základy" />
            <Field label="Názov / cieľ projektu">
              <input
                value={criteria.goal}
                onChange={(e) => set('goal', e.target.value)}
                placeholder="napr. Rezervačný systém pre kaderníctvo"
                className="w-full h-10 bg-background border border-border rounded-lg px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </Field>
            <Field label="Typ projektu">
              <ChipRow
                options={PROJECT_TYPES}
                active={[criteria.type]}
                onSelect={(v) => set('type', v)}
              />
            </Field>
          </section>

          {/* Group 2: configuration */}
          <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
            <GroupLabel step="2" title="Konfigurácia" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Stack">
                <ChipRow options={STACKS} active={[criteria.stack]} onSelect={(v) => set('stack', v)} />
              </Field>
              <Field label="Jazyk výstupu">
                <ChipRow
                  options={['SK', 'EN']}
                  active={[criteria.language]}
                  onSelect={(v) => set('language', v as 'SK' | 'EN')}
                />
              </Field>
            </div>
            <Field label="Hĺbka prompt packu">
              <ChipRow
                options={DEPTHS.map(String)}
                active={[String(criteria.depth)]}
                onSelect={(v) => set('depth', Number(v) as BlueprintDepth)}
              />
            </Field>
            <Field label="Priority">
              <ChipRow options={PRIORITIES} active={criteria.priorities} onSelect={togglePriority} />
            </Field>
          </section>

          {/* Group 3: notes */}
          <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
            <GroupLabel step="3" title="Poznámky" />
            <Field label="Poznámky / obmedzenia">
              <textarea
                value={criteria.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="napr. bez platieb v prvej verzii, dôraz na mobil…"
                className="w-full h-20 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none resize-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </Field>
          </section>
        </div>

        {/* Sticky action bar — uniform buttons, pixel-aligned */}
        <div className="sticky bottom-0 z-10 shrink-0 border-t border-border bg-card p-4 lg:static">
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-stretch">
            <button
              onClick={run}
              disabled={isRunning}
              className="h-11 px-5 bg-primary text-primary-foreground rounded-lg hover:bg-google-blue-hover transition-colors flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50 disabled:bg-muted shadow-sm"
            >
              {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Compass size={16} />}
              {isRunning ? 'Generujem…' : 'Vytvoriť blueprint'}
            </button>
            <button
              onClick={() =>
                setCriteria(RANDOM_PRESETS[Math.floor(Math.random() * RANDOM_PRESETS.length)])
              }
              disabled={isRunning}
              aria-label="Náhodné kritériá"
              title="Náhodné kritériá"
              className="h-11 w-11 border border-border rounded-lg text-foreground hover:bg-muted transition-colors flex items-center justify-center disabled:opacity-50"
            >
              <Shuffle size={16} />
            </button>
            <button
              onClick={() => {
                setCriteria(DEFAULT_CRITERIA);
                setResult('');
              }}
              disabled={isRunning}
              aria-label="Vymazať formulár"
              title="Vymazať"
              className="h-11 w-11 border border-border rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive transition-colors flex items-center justify-center disabled:opacity-50"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Right: output ── */}
      <div className="flex min-h-[320px] min-w-0 flex-col gap-4 overflow-y-auto p-4 [scrollbar-gutter:stable] sm:p-5 lg:min-h-0 lg:p-6">
        {pack.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <h3 className="text-foreground font-medium text-base">
                Prompt pack — {pack.length} promptov
              </h3>
              <button
                onClick={() =>
                  copy(pack.map((p) => `${p.label}) ${p.title}\n${p.prompt}`).join('\n\n---\n\n'), 'all')
                }
                className="h-9 px-4 border border-border rounded-lg text-xs text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
              >
                {copied === 'all' ? <CopyCheck size={14} className="text-success" /> : <Copy size={14} />}
                Kopírovať všetky
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {pack.map((p) => (
                <div key={p.label} className="border border-border rounded-lg p-4 bg-accent">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 shrink-0 rounded-md bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">
                        {p.label}
                      </span>
                      <span className="text-sm font-medium text-foreground truncate">{p.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => copy(p.prompt, p.label)}
                        aria-label={`Kopírovať prompt ${p.label}`}
                        className="h-8 w-8 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center"
                      >
                        {copied === p.label ? (
                          <CopyCheck size={14} className="text-success" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                      {onSendToChat && (
                        <button
                          onClick={() => onSendToChat(p.prompt)}
                          aria-label={`Poslať prompt ${p.label} do chatu`}
                          className="h-8 w-8 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center"
                        >
                          <Send size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <pre className="text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed">
                    {p.prompt}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}

        {result && (
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <h3 className="text-foreground font-medium mb-4 text-base">Blueprint</h3>
            <div className="text-foreground text-sm">
              <MarkdownRenderer content={result} />
            </div>
          </div>
        )}

        {!result && !isRunning && (
          <div className="hidden min-h-full lg:flex flex-col items-center justify-center border border-dashed border-border rounded-lg py-20 text-center text-muted-foreground">
            <Compass size={28} className="mb-3 opacity-40" />
            <p className="text-sm">Tu sa zobrazí vygenerovaný blueprint a prompt pack.</p>
          </div>
        )}

        {isRunning && (
          <div className="flex flex-col items-center justify-center border border-border rounded-xl bg-card py-20 text-center">
            <Loader2 size={28} className="animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground">AI generuje blueprint…</p>
          </div>
        )}
      </div>
    </div>
  );
}

function GroupLabel({ step, title }: { step: string; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-5 h-5 rounded-md bg-primary/10 text-primary text-[11px] font-semibold flex items-center justify-center">
        {step}
      </span>
      <span className="text-sm font-semibold text-foreground">{title}</span>
      <span className="flex-1 h-px bg-border" aria-hidden />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

function ChipRow({
  options,
  active,
  onSelect,
}: {
  options: string[];
  active: string[];
  onSelect: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = active.includes(o);
        return (
          <button
            key={o}
            onClick={() => onSelect(o)}
            aria-pressed={on}
            className={`h-8 px-3 rounded-lg text-xs border transition-colors ${
              on
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground'
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
