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

  return (
    <div className="flex flex-col gap-6">
      {/* Intro */}
      {!result && !isRunning && (
        <div className="flex flex-col items-center justify-center py-10 text-center animate-fade-in">
          <div className="w-20 h-20 rounded-2xl bg-accent border border-border flex items-center justify-center mb-6">
            <Compass size={36} className="text-primary" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">Startovací blueprint</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Zadajte kritériá projektu a AI vygeneruje architektúru, dátový model, milestony a sadu
            promptov od A po Z, ktoré stačí kopírovať do builder-a.
          </p>
        </div>
      )}

      {/* Criteria form */}
      <div className="bg-accent border border-border rounded-xl p-5 flex flex-col gap-5">
        <Field label="Názov / cieľ projektu">
          <input
            value={criteria.goal}
            onChange={(e) => set('goal', e.target.value)}
            placeholder="napr. Rezervačný systém pre kaderníctvo"
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Typ projektu">
            <ChipRow
              options={PROJECT_TYPES}
              active={[criteria.type]}
              onSelect={(v) => set('type', v)}
            />
          </Field>
          <Field label="Stack">
            <ChipRow options={STACKS} active={[criteria.stack]} onSelect={(v) => set('stack', v)} />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Jazyk výstupu">
            <ChipRow
              options={['SK', 'EN']}
              active={[criteria.language]}
              onSelect={(v) => set('language', v as 'SK' | 'EN')}
            />
          </Field>
          <Field label="Hĺbka prompt packu">
            <ChipRow
              options={DEPTHS.map(String)}
              active={[String(criteria.depth)]}
              onSelect={(v) => set('depth', Number(v) as BlueprintDepth)}
            />
          </Field>
        </div>

        <Field label="Priority">
          <ChipRow options={PRIORITIES} active={criteria.priorities} onSelect={togglePriority} />
        </Field>

        <Field label="Poznámky / obmedzenia">
          <textarea
            value={criteria.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="napr. bez platieb v prvej verzii, dôraz na mobil…"
            className="w-full h-24 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none resize-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </Field>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={run}
            disabled={isRunning}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-full hover:bg-google-blue-hover transition-colors flex items-center gap-2 font-medium disabled:opacity-50 disabled:bg-muted shadow-sm"
          >
            {isRunning ? <Loader2 size={18} className="animate-spin" /> : <Compass size={18} />}
            Vytvoriť blueprint
          </button>
          <button
            onClick={() =>
              setCriteria(RANDOM_PRESETS[Math.floor(Math.random() * RANDOM_PRESETS.length)])
            }
            disabled={isRunning}
            className="px-4 py-2.5 border border-border rounded-full text-sm text-foreground hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Shuffle size={16} /> Náhodné kritériá
          </button>
          <button
            onClick={() => {
              setCriteria(DEFAULT_CRITERIA);
              setResult('');
            }}
            disabled={isRunning}
            className="px-4 py-2.5 border border-border rounded-full text-sm text-muted-foreground hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Trash2 size={16} /> Vymazať
          </button>
        </div>
      </div>

      {/* Prompt pack */}
      {pack.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <h3 className="text-foreground font-medium text-lg">
              Prompt pack — {pack.length} promptov
            </h3>
            <button
              onClick={() =>
                copy(pack.map((p) => `${p.label}) ${p.title}\n${p.prompt}`).join('\n\n---\n\n'), 'all')
              }
              className="px-3 py-1.5 border border-border rounded-full text-xs text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
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
                      className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
                        className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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

      {/* Full blueprint */}
      {result && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="text-foreground font-medium mb-4 text-lg">Blueprint</h3>
          <div className="text-foreground text-sm">
            <MarkdownRenderer content={result} />
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
            className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
              on
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground'
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
