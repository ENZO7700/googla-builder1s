import { Activity, Zap } from 'lucide-react';
import { useRef, useEffect } from 'react';

export interface StreamDiagnostics {
  ttft: number;
  total: number;
  chunks: number;
  model: string;
  error?: string;
  timestamp: Date;
}

interface SystemMonitorProps {
  isLoading: boolean;
  messageCount: number;
  attachmentCount: number;
  logs: string[];
  diagnostics?: StreamDiagnostics | null;
}

export default function SystemMonitor({ isLoading, messageCount, attachmentCount, logs, diagnostics }: SystemMonitorProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <aside className="w-[300px] bg-card border-l border-border flex flex-col hidden xl:flex shrink-0 z-10">
      <div className="p-6 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Activity size={16} className="text-primary" /> Stav Služieb
        </h3>
      </div>

      <div className="p-6 space-y-8 border-b border-border">
        <div>
          <div className="flex justify-between text-xs mb-2 font-medium text-muted-foreground">
            <span>Vyťaženie AI</span>
            <span className="text-foreground">{isLoading ? 'Aktívne' : 'Nečinné'}</span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div className={`h-full bg-primary transition-all duration-1000 ease-out ${isLoading ? 'w-full' : 'w-[15%]'}`} />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs mb-2 font-medium text-muted-foreground">
            <span>Pamäť Kontextu</span>
            <span className="text-foreground">{(2.4 + messageCount * 0.15 + attachmentCount * 1.2).toFixed(1)} GB</span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-success transition-all duration-500"
              style={{ width: `${Math.min(10 + messageCount * 2 + attachmentCount * 10, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Streaming diagnostics */}
      <div className="px-6 py-5 border-b border-border">
        <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2 uppercase tracking-wide">
          <Zap size={12} className="text-primary" /> Streaming diagnostika
        </h4>
        {diagnostics ? (
          <div className="space-y-1.5 text-xs">
            <DiagRow label="Čas do 1. tokenu" value={`${diagnostics.ttft.toFixed(0)} ms`} />
            <DiagRow label="Celkový čas" value={`${(diagnostics.total / 1000).toFixed(2)} s`} />
            <DiagRow label="Chunkov" value={String(diagnostics.chunks)} />
            <DiagRow label="Model" value={diagnostics.model.split('/').pop() || diagnostics.model} mono />
            <div className="flex justify-between pt-1.5 mt-1.5 border-t border-border">
              <span className="text-muted-foreground">Status</span>
              {diagnostics.error ? (
                <span className="text-destructive font-medium">❌ {diagnostics.error.substring(0, 30)}</span>
              ) : (
                <span className="text-success font-medium">✅ OK</span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">Žiadne dáta — pošlite správu.</p>
        )}
      </div>

      {/* Console */}
      <div className="flex-1 flex flex-col bg-console m-4 rounded-xl shadow-inner overflow-hidden border border-console-border">
        <div className="px-4 py-2 bg-console-header border-b border-console-border flex items-center">
          <span className="text-[10px] font-mono text-console-text uppercase tracking-widest">Cloud Shell</span>
        </div>
        <div className="p-4 font-mono text-[11px] overflow-y-auto flex flex-col flex-1 scrollbar-hide">
          <div className="mt-auto">
            {logs.map((log, i) => (
              <div
                key={i}
                className={`mb-1.5 leading-relaxed ${
                  log.includes('[WARN]') ? 'text-warning'
                  : log.includes('[ERROR]') ? 'text-destructive'
                  : log.includes('[API]') ? 'text-primary'
                  : log.includes('[SYSTEM]') ? 'text-success'
                  : 'text-console-text'
                }`}
              >
                {log}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </aside>
  );
}

function DiagRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-foreground ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</span>
    </div>
  );
}
