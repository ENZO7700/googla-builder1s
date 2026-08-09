import { useState } from 'react';
import { ShieldAlert, Loader2, CheckCircle2, Compass } from 'lucide-react';
import { MarkdownRenderer } from '@/lib/formatMarkdown';
import BlueprintStarter from './BlueprintStarter';
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
    <div className="flex-1 flex flex-col p-6 lg:p-12 overflow-y-auto w-full relative z-10 scrollbar-hide bg-card m-4 rounded-2xl shadow-sm border border-border">
      <div className="max-w-4xl mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-2xl font-normal text-foreground">
            {tab === 'blueprint' ? 'Startovací Blueprint' : 'Analyzátor Logov'}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {tab === 'blueprint'
              ? 'Zadajte kritériá a AI vygeneruje blueprint plus prompty od A po Z.'
              : 'Nahrajte systémové logy pre automatickú analýzu hrozieb.'}
          </p>
        </div>

        {onGenerateBlueprint && (
          <div className="flex gap-2 mb-8">
            <button
              onClick={() => setTab('blueprint')}
              aria-pressed={tab === 'blueprint'}
              className={`px-4 py-2 rounded-full text-sm border transition-colors flex items-center gap-2 ${
                tab === 'blueprint'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground'
              }`}
            >
              <Compass size={15} /> Blueprint
            </button>
            <button
              onClick={() => setTab('logs')}
              aria-pressed={tab === 'logs'}
              className={`px-4 py-2 rounded-full text-sm border transition-colors flex items-center gap-2 ${
                tab === 'logs'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground'
              }`}
            >
              <ShieldAlert size={15} /> Analýza logov
            </button>
          </div>
        )}

        {tab === 'blueprint' && onGenerateBlueprint && (
          <BlueprintStarter onGenerate={onGenerateBlueprint} onSendToChat={onSendToChat} />
        )}

        {tab === 'logs' && (
        <>


        <div className="flex flex-col gap-6">
          <textarea
            value={rawLogs}
            onChange={(e) => setRawLogs(e.target.value)}
            placeholder="Vložte text logov..."
            className="w-full h-64 bg-accent border border-border rounded-xl p-4 text-[14px] font-mono text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
          />

          <button
            onClick={handleAnalyze}
            disabled={!rawLogs.trim() || isAnalyzing}
            className="self-start px-6 py-2.5 bg-primary text-primary-foreground rounded-full hover:bg-google-blue-hover transition-colors flex items-center gap-2 font-medium disabled:opacity-50 disabled:bg-muted shadow-sm"
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
        </>
        )}
      </div>
    </div>

  );
}
