import { useState } from 'react';
import { ShieldAlert, Loader2, CheckCircle2, Shield } from 'lucide-react';
import { MarkdownRenderer } from '@/lib/formatMarkdown';

interface AnalyzerViewProps {
  onAnalyze: (logs: string) => Promise<string>;
}

export default function AnalyzerView({ onAnalyze }: AnalyzerViewProps) {
  const [rawLogs, setRawLogs] = useState('');
  const [logAnalysis, setLogAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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
        <div className="mb-8">
          <h2 className="text-2xl font-normal text-foreground">Analyzátor Logov</h2>
          <p className="text-muted-foreground text-sm mt-1">Nahrajte systémové logy pre automatickú analýzu hrozieb.</p>
        </div>

        {!rawLogs && !logAnalysis && !isAnalyzing && (
          <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
            <div className="w-20 h-20 rounded-2xl bg-accent border border-border flex items-center justify-center mb-6">
              <Shield size={36} className="text-primary" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">Žiadne logy na analýzu</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Vložte systémové logy, prístupové záznamy alebo bezpečnostné udalosti do textového poľa nižšie. AI identifikuje potenciálne hrozby a anomálie.
            </p>
          </div>
        )}

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
      </div>
    </div>
  );
}
