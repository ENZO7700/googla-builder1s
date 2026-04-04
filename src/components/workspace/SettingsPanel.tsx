import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Sun, Moon, Cpu } from 'lucide-react';
import { useState, useEffect } from 'react';

const AI_MODELS = [
  { id: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash (rýchly)', desc: 'Vyvážená rýchlosť a kvalita' },
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', desc: 'Dobrý multimodálny model' },
  { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', desc: 'Najsilnejší pre komplexné úlohy' },
  { id: 'openai/gpt-5-mini', label: 'GPT-5 Mini', desc: 'Nízke náklady, silný výkon' },
  { id: 'openai/gpt-5', label: 'GPT-5', desc: 'Najvyššia presnosť a nuansa' },
];

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dark: boolean;
  onToggleDark: () => void;
}

export default function SettingsPanel({ open, onOpenChange, dark, onToggleDark }: SettingsPanelProps) {
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('ai-model') || 'google/gemini-3-flash-preview');

  useEffect(() => {
    localStorage.setItem('ai-model', selectedModel);
  }, [selectedModel]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[360px] sm:w-[400px] bg-card border-border">
        <SheetHeader>
          <SheetTitle className="text-foreground">Nastavenia</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-8">
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
