import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Sun, Moon, Cpu, Stethoscope, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { runE2ETest, type E2EResult } from '@/lib/e2eTest';
import DiagnosticsChecklist from '@/components/workspace/DiagnosticsChecklist';

function loadStoredE2E(): { results: E2EResult[] | null; ranAt: number | null } {
  try {
    const raw = sessionStorage.getItem('wpbox.e2eResults');
    if (!raw) return { results: null, ranAt: null };
    const parsed = JSON.parse(raw) as { results?: E2EResult[]; at?: number };
    return { results: parsed.results ?? null, ranAt: parsed.at ?? null };
  } catch {
    return { results: null, ranAt: null };
  }
}

const AI_MODELS = [
  { id: 'mistral-large-latest', label: 'Mistral Large', desc: 'Vlajková loď, najlepší reasoning' },
  { id: 'mistral-medium', label: 'Mistral Medium', desc: 'Vysoký výkon, multilingválny' },
  { id: 'mistral-small', label: 'Mistral Small', desc: 'Vyvážený výkon a cena' },
  { id: 'mistral-tiny', label: 'Mistral Tiny', desc: 'Ultra-rýchly a nákladovo efektívny' },
  { id: 'mixtral-8x7b-latest', label: 'Mixtral 8x7B', desc: 'Open-weight, vysoký výkon (MoE)' },
  { id: 'codestral-latest', label: 'Codestral', desc: 'Špecializovaný na kódovanie' },
  { id: 'pixtral-12b-latest', label: 'Pixtral 12B', desc: 'Multimodálny (Text + Vision)' },
];

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dark: boolean;
  onToggleDark: () => void;
  onE2EResults?: (results: E2EResult[], ranAt: number) => void;
  e2eResults?: E2EResult[] | null;
  e2eRanAt?: number | null;
  e2eRunning?: boolean;
  onRunE2E?: () => Promise<void>;
}

export default function SettingsPanel({
  open,
  onOpenChange,
  dark,
  onToggleDark,
  onE2EResults,
  e2eResults: e2eResultsProp,
  e2eRanAt: e2eRanAtProp,
  e2eRunning: e2eRunningProp,
  onRunE2E,
}: SettingsPanelProps) {
  const stored = loadStoredE2E();
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('ai-model') || 'mistral-large-latest');
  const [runningLocal, setRunningLocal] = useState(false);
  const [e2eResultsLocal, setE2eResultsLocal] = useState<E2EResult[] | null>(stored.results);
  const [e2eRanAtLocal, setE2eRanAtLocal] = useState<number | null>(stored.ranAt);

  const e2eResults = e2eResultsProp ?? e2eResultsLocal;
  const e2eRanAt = e2eRanAtProp ?? e2eRanAtLocal;
  const running = e2eRunningProp ?? runningLocal;

  useEffect(() => {
    localStorage.setItem('ai-model', selectedModel);
  }, [selectedModel]);

  const handleRunTest = async () => {
    if (onRunE2E) {
      await onRunE2E();
      return;
    }
    setRunningLocal(true);
    setE2eResultsLocal(null);
    setE2eRanAtLocal(null);
    try {
      const results = await runE2ETest();
      const ranAt = Date.now();
      setE2eResultsLocal(results);
      setE2eRanAtLocal(ranAt);
      onE2EResults?.(results, ranAt);
    } finally {
      setRunningLocal(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[360px] sm:w-[400px] bg-card border-border overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-foreground">Nastavenia</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-8 pb-10">
          {/* Theme */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Vzhľad</h3>
            <div className="flex gap-3">
              <button
                onClick={() => { if (dark) onToggleDark(); }}
                className={`flex-1 flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${!dark ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}
              >
                <Sun size={16} /> Svetlý
              </button>
              <button
                onClick={() => { if (!dark) onToggleDark(); }}
                className={`flex-1 flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${dark ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}
              >
                <Moon size={16} /> Tmavý
              </button>
            </div>
          </div>

          {/* AI Model */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Cpu size={16} /> AI Model
            </h3>
            <div className="space-y-2">
              {AI_MODELS.map(model => (
                <button
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  className={`w-full text-left p-3 rounded-xl border text-sm transition-all ${
                    selectedModel === model.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  <div className="font-medium text-foreground">{model.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{model.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Diagnostics */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Stethoscope size={16} /> Diagnostika
            </h3>
            <button
              onClick={handleRunTest}
              disabled={running}
              aria-busy={running}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-border bg-card hover:bg-accent text-sm font-medium text-foreground transition-all disabled:opacity-50"
            >
              {running ? (
                <><Loader2 size={16} className="animate-spin" /> Spúšťam test...</>
              ) : e2eResults?.length ? (
                'Spustiť znova'
              ) : (
                'Spustiť E2E test'
              )}
            </button>
            <DiagnosticsChecklist
              results={e2eResults}
              running={running}
              ranAt={e2eRanAt}
              onRerun={handleRunTest}
              className="mt-3"
            />
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Overí auth, databázu, relácie, AI streaming, storage, WordPress, moduly workspace (Generátor, Analyzátor, Náhľad, GitHub, Launch) a nastavenia.
              Podrobnosti sú aj v konzole prehliadača (F12).
            </p>
          </div>

          {/* Keyboard shortcuts */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Klávesové skratky</h3>
            <div className="space-y-2 text-sm">
              {[
                ['Ctrl + K', 'Nová relácia'],
                ['Ctrl + /', 'Focus na vstup'],
                ['Enter', 'Odoslať správu'],
                ['Shift + Enter', 'Nový riadok'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between py-1.5">
                  <span className="text-muted-foreground">{desc}</span>
                  <kbd className="px-2 py-1 bg-muted text-foreground rounded text-xs font-mono">{key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
