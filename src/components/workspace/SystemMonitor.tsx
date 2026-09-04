import { Activity, AlertCircle, Bot, CheckCircle2, Globe2, Loader2, MinusCircle, PanelsTopLeft, UploadCloud, XCircle, Zap } from 'lucide-react';
import { useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { WorkflowRun, WorkflowStepStatus } from '@/lib/workflow';
import type { E2EResult } from '@/lib/e2eTest';

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
  workflowRun?: WorkflowRun | null;
  attachments?: Array<{ name: string; progress?: number; uploading?: boolean; error?: string; url?: string }>;
  hasPreviewCode?: boolean;
  e2eResults?: E2EResult[] | null;
}

export default function SystemMonitor({
  isLoading,
  messageCount,
  attachmentCount,
  logs,
  diagnostics,
  workflowRun,
  attachments = [],
  hasPreviewCode,
  e2eResults,
}: SystemMonitorProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const wpE2E = e2eResults?.find(r => r.step === 'WordPress Proxy');
  const wpStatus = wpE2E
    ? wpE2E.passed
      ? wpE2E.skipped ? 'waiting' : 'done'
      : 'error'
    : 'waiting';
  const wpValue = wpE2E
    ? wpE2E.skipped ? 'Preskočené' : wpE2E.passed ? 'OK' : 'Chyba'
    : 'Proxy ready';
  const wpDetail = wpE2E?.detail ?? 'wordpress-proxy + wp-json/wp/v2';
  const wpProgress = wpE2E
    ? wpE2E.passed ? (wpE2E.skipped ? 40 : 100) : 8
    : 28;

  return (
    <aside className="w-[300px] bg-card border-l border-border flex flex-col hidden xl:flex shrink-0 z-10">
      <div className="p-6 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Activity size={16} className="text-primary" /> Live Workflows
        </h3>
        <p className="mt-1 text-[11px] text-muted-foreground">Kroky, progres a posledné udalosti.</p>
      </div>

      <div className="space-y-3 border-b border-border p-4">
        <WorkCard
          icon={<Bot size={14} />}
          title="AI Pipeline"
          status={workflowRun?.status === 'error' ? 'error' : isLoading || workflowRun?.status === 'running' ? 'running' : workflowRun?.status === 'done' ? 'done' : 'waiting'}
          value={workflowRun ? `${workflowRun.progress}%` : isLoading ? 'Aktívne' : 'Idle'}
          detail={workflowRun?.lastEvent ?? 'Čaká na prompt'}
          progress={workflowRun?.progress ?? (isLoading ? 42 : 12)}
        />

        <WorkCard
          icon={<UploadCloud size={14} />}
          title="Files"
          status={fileStatus(attachments)}
          value={attachments.length ? `${fileProgress(attachments)}%` : `${attachmentCount} súb.`}
          detail={fileDetail(attachments)}
          progress={attachments.length ? fileProgress(attachments) : Math.min(attachmentCount * 18, 100)}
        />

        <WorkCard
          icon={<PanelsTopLeft size={14} />}
          title="Preview"
          status={stepStatus(workflowRun, 'preview', hasPreviewCode ? 'done' : 'waiting')}
          value={hasPreviewCode ? 'Ready' : 'Idle'}
          detail={hasPreviewCode ? 'Sandbox má posledný HTML výstup' : 'Čaká na HTML blok'}
          progress={hasPreviewCode ? 100 : stepStatus(workflowRun, 'preview') === 'running' ? 64 : 0}
        />

        <WorkCard
          icon={<Globe2 size={14} />}
          title="WordPress"
          status={wpStatus}
          value={wpValue}
          detail={wpDetail}
          progress={wpProgress}
        />
      </div>

      {/* E2E snapshot (compact on xl screens) */}
      {e2eResults && e2eResults.length > 0 && (
        <div className="px-6 py-4 border-b border-border">
          <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-2 uppercase tracking-wide">
            <CheckCircle2 size={12} className="text-primary" /> Diagnostika
          </h4>
          <ul className="space-y-1 text-[11px]">
            {e2eResults.slice(0, 4).map(r => (
              <li key={r.step} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground truncate">{r.step}</span>
                {!r.passed ? (
                  <XCircle size={12} className="text-destructive shrink-0" />
                ) : r.skipped ? (
                  <MinusCircle size={12} className="text-warning shrink-0" />
                ) : (
                  <CheckCircle2 size={12} className="text-success shrink-0" />
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-muted-foreground">Úplný zoznam v Nastaveniach → Diagnostika.</p>
        </div>
      )}

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

function WorkCard({
  icon,
  title,
  status,
  value,
  detail,
  progress,
}: {
  icon: ReactNode;
  title: string;
  status: WorkflowStepStatus | 'running' | 'done' | 'error';
  value: string;
  detail: string;
  progress: number;
}) {
  const tone =
    status === 'error' ? 'text-destructive'
    : status === 'running' ? 'text-google-blue'
    : status === 'done' ? 'text-success'
    : 'text-muted-foreground';

  return (
    <div className="rounded-2xl border border-border bg-background/60 p-3 shadow-[0_1px_2px_rgba(60,64,67,0.08)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full bg-card ${tone}`}>
            {status === 'running' ? <Loader2 size={14} className="animate-spin" />
              : status === 'done' ? <CheckCircle2 size={14} />
              : status === 'error' ? <AlertCircle size={14} />
              : icon}
          </span>
          <div>
            <p className="text-xs font-medium text-foreground">{title}</p>
            <p className="max-w-[180px] truncate text-[10px] text-muted-foreground">{detail}</p>
          </div>
        </div>
        <span className={`text-[11px] font-semibold ${tone}`}>{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-500 ${status === 'error' ? 'bg-destructive' : status === 'done' ? 'bg-success' : 'bg-google-blue'}`}
          style={{ width: `${Math.max(4, Math.min(progress, 100))}%` }}
        />
      </div>
    </div>
  );
}

function stepStatus(run: WorkflowRun | null | undefined, id: string, fallback: WorkflowStepStatus = 'waiting') {
  return run?.steps.find(step => step.id === id)?.status ?? fallback;
}

function fileStatus(attachments: SystemMonitorProps['attachments'] = []): WorkflowStepStatus {
  if (attachments.some(file => file.error)) return 'error';
  if (attachments.some(file => file.uploading)) return 'running';
  if (attachments.some(file => file.url)) return 'done';
  return 'waiting';
}

function fileProgress(attachments: SystemMonitorProps['attachments'] = []) {
  if (!attachments.length) return 0;
  const total = attachments.reduce((sum, file) => sum + (file.error ? 100 : file.progress ?? (file.url ? 100 : 0)), 0);
  return Math.round(total / attachments.length);
}

function fileDetail(attachments: SystemMonitorProps['attachments'] = []) {
  const active = attachments.find(file => file.uploading);
  const error = attachments.find(file => file.error);
  if (error) return error.error ?? 'Upload zlyhal';
  if (active) return `Nahrávam ${active.name}`;
  if (attachments.length) return `${attachments.length} súbor(ov) pripravených`;
  return 'Žiadne súbory v fronte';
}
