import { useState, useRef } from 'react';
import { ArrowLeft, Menu, ShieldAlert, Loader2, Shield, Upload, FileText } from 'lucide-react';
import { MarkdownRenderer } from '@/lib/formatMarkdown';
import AiErrorBanner from '@/components/workspace/AiErrorBanner';
import type { AiErrorCopy } from '@/lib/aiErrorCopy';

const SAMPLE_LOG = `[2026-03-04 14:22:01] WARN  auth: failed login user=admin ip=203.0.113.44
[2026-03-04 14:22:03] WARN  auth: failed login user=admin ip=203.0.113.44
[2026-03-04 14:22:05] WARN  auth: failed login user=root ip=203.0.113.44
[2026-03-04 14:22:08] ERROR wp-json: GET /wp/v2/users?per_page=100 → 401 Unauthorized
[2026-03-04 14:22:12] INFO  nginx: 203.0.113.44 - "POST /xmlrpc.php" 403
[2026-03-04 14:22:15] WARN  auth: brute-force pattern detected ip=203.0.113.44 (6 attempts / 30s)`;

interface AnalyzerViewProps {
  onAnalyze: (logs: string) => Promise<string>;
  onBack: () => void;
  onOpenMobileMenu?: () => void;
  aiError?: AiErrorCopy | null;
  onOpenSettings?: () => void;
}

export default function AnalyzerView({
  onAnalyze,
  onBack,
  onOpenMobileMenu,
  aiError,
  onOpenSettings,
}: AnalyzerViewProps) {
  const [rawLogs, setRawLogs] = useState('');
  const [logAnalysis, setLogAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisFailed, setAnalysisFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAnalyze = async () => {
    if (!rawLogs.trim()) return;
    setIsAnalyzing(true);
    setLogAnalysis('');
    setAnalysisFailed(false);
    try {
      const result = await onAnalyze(rawLogs);
      setLogAnalysis(result);
    } catch {
      setAnalysisFailed(true);
      setLogAnalysis('');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.toLowerCase();
    if (!/\.(log|txt|json)$/.test(ext)) {
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setRawLogs(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const loadSample = () => {
    setRawLogs(SAMPLE_LOG);
    setLogAnalysis('');
    setAnalysisFailed(false);
  };

  return (
    <div className="flex-1 flex flex-col p-6 lg:p-12 overflow-y-auto w-full relative z-10 scrollbar-hide bg-card m-4 rounded-2xl shadow-sm border border-border">
      <div className="max-w-4xl mx-auto w-full">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-normal text-foreground">Analyzátor Logov</h2>
            <p className="text-muted-foreground text-sm mt-1">Nahrajte systémové logy pre automatickú analýzu hrozieb.</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            {onOpenMobileMenu && (
              <button
                type="button"
                onClick={onOpenMobileMenu}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent lg:hidden"
              >
                <Menu size={16} />
                Nástroje
              </button>
            )}
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
            >
              <ArrowLeft size={16} />
              Späť
            </button>
          </div>
        </div>

        {!rawLogs && !logAnalysis && !isAnalyzing && !analysisFailed && (
          <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
            <div className="w-20 h-20 rounded-2xl bg-accent border border-border flex items-center justify-center mb-6">
              <Shield size={36} className="text-primary" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">Žiadne logy na analýzu</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-4">
              Vložte systémové logy, prístupové záznamy alebo bezpečnostné udalosti. AI identifikuje potenciálne hrozby a anomálie.
            </p>
            <button
              type="button"
              onClick={loadSample}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              <FileText size={16} />
              Načítať ukážkový log
            </button>
          </div>
        )}

        <div className="flex flex-col gap-6">
          {aiError && (analysisFailed || !isAnalyzing) && (
            <AiErrorBanner error={aiError} onOpenSettings={onOpenSettings} />
          )}

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".log,.txt,.json"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground rounded-full text-sm font-medium hover:bg-accent transition-colors shadow-sm"
            >
              <Upload size={16} />
              Nahrať súbor (.log, .txt, .json)
            </button>
            <button
              type="button"
              onClick={loadSample}
              className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border text-muted-foreground rounded-full text-sm font-medium hover:bg-accent hover:text-foreground transition-colors shadow-sm"
            >
              <FileText size={16} />
              Ukážka logu
            </button>
            <span className="text-xs text-muted-foreground">alebo vložte logy nižšie</span>
          </div>

          <textarea
            value={rawLogs}
            onChange={(e) => setRawLogs(e.target.value)}
            placeholder={SAMPLE_LOG.split('\n')[0] + '…'}
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

          {logAnalysis && !analysisFailed && (
            <div className="mt-8 p-6 bg-card border border-border rounded-xl shadow-sm">
              <h3 className="text-foreground font-medium mb-4 flex items-center gap-2 text-lg">
                <Shield size={20} className="text-success" /> Výsledok analýzy
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
