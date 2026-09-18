import { useState } from 'react';
import { ShieldAlert, Loader2, CheckCircle2, Compass } from 'lucide-react';
import { MarkdownRenderer } from '@/lib/formatMarkdown';
import BlueprintStarter from './BlueprintStarter';
import WorkspaceLayout from './WorkspaceLayout';
import type { BlueprintCriteria } from '@/lib/blueprintPrompts';

interface AnalyzerViewProps {
  onAnalyze: (logs: string) => Promise<string>;
  onGenerateBlueprint?: (criteria: BlueprintCriteria) => Promise<string>;
  onSendToChat?: (prompt: string) => void;
}

export default function AnalyzerView({ onAnalyze, onGenerateBlueprint, onSendToChat }: AnalyzerViewProps) {
  const [rawLogs, setRawLogs] = useState('');
  const [logAnalysis, setLogAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [tab, setTab] = useState<'blueprint' | 'logs'>(onGenerateBlueprint ? 'blueprint' : 'logs');

  const handleAnalyze = async () => {
    if (!rawLogs.trim()) return;
    setIsAnalyzing(true);
    setLogAnalysis('');
    try {
      const result = await onAnalyze(rawLogs);
      setLogAnalysis(result);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <WorkspaceLayout
      title={tab === 'blueprint' ? 'Startovací Blueprint' : 'Analyzátor Logov'}
      description={tab === 'blueprint'
        ? 'Zadajte kritériá a AI vygeneruje blueprint plus prompty od A po Z.'
        : 'Nahrajte systémové logy pre automatickú analýzu hrozieb.'}
      actions={onGenerateBlueprint ? (
          <div className="flex h-10 shrink-0 items-center rounded-lg border border-border bg-background p-1">
            <button
              onClick={() => setTab('blueprint')}
              aria-pressed={tab === 'blueprint'}
              className={`flex h-8 items-center gap-2 rounded-md px-3 text-sm transition-colors ${
                tab === 'blueprint'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Compass size={15} /> Blueprint
            </button>
            <button
              onClick={() => setTab('logs')}
              aria-pressed={tab === 'logs'}
              className={`flex h-8 items-center gap-2 rounded-md px-3 text-sm transition-colors ${
                tab === 'logs'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <ShieldAlert size={15} /> Analýza logov
            </button>
          </div>
      ) : undefined}
    >

        {tab === 'blueprint' && onGenerateBlueprint && (
          <div className="flex-1 min-h-0">
            <BlueprintStarter onGenerate={onGenerateBlueprint} onSendToChat={onSendToChat} />
          </div>
        )}

        {tab === 'logs' && (
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <textarea
            value={rawLogs}
            onChange={(e) => setRawLogs(e.target.value)}
            placeholder="Vložte text logov..."
            className="w-full h-64 bg-accent border border-border rounded-xl p-4 text-[14px] font-mono text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
          />

          <button
            onClick={handleAnalyze}
            disabled={!rawLogs.trim() || isAnalyzing}
            className="self-start h-11 px-6 bg-primary text-primary-foreground rounded-lg hover:bg-google-blue-hover transition-colors flex items-center gap-2 font-medium disabled:opacity-50 disabled:bg-muted shadow-sm"
          >
            {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <ShieldAlert size={18} />}
            Spustiť Analýzu
          </button>

          {logAnalysis && (
            <div className="mt-8 p-6 bg-card border border-border rounded-xl shadow-sm">
              <h3 className="text-foreground font-medium mb-4 flex items-center gap-2 text-lg">
                <CheckCircle2 size={20} className="text-success" /> Výsledok analýzy
              </h3>
              <div className="text-foreground text-sm">
                <MarkdownRenderer content={logAnalysis} />
              </div>
            </div>
          )}
        </div>
        </div>
        )}
    </WorkspaceLayout>
  );
}
