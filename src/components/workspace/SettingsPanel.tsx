import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Sun, Moon, Cpu, Stethoscope, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { runE2ETest } from '@/lib/e2eTest';

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
}

export default function SettingsPanel({ open, onOpenChange, dark, onToggleDark }: SettingsPanelProps) {
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('ai-model') || 'mistral-large-latest');
  const [running, setRunning] = useState(false);

  useEffect(() => {
    localStorage.setItem('ai-model', selectedModel);
  }, [selectedModel]);

  const handleRunTest = async () => {
    setRunning(true);
    try {
      await runE2ETest();
    } finally {
      setRunning(false);
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
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-border bg-card hover:bg-accent text-sm font-medium text-foreground transition-all disabled:opacity-50"
            >
              {running ? <><Loader2 size={16} className="animate-spin" /> Spúšťam test...</> : 'Spustiť E2E test'}
            </button>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Overí auth, databázu, AI streaming, storage a voice API. Výsledky uvidíte v konzole prehliadača (F12).
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
