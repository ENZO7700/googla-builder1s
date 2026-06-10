import { AlertCircle, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import type { WorkflowRun, WorkflowStep } from '@/lib/workflow';

interface WorkflowRibbonProps {
  workflowRun: WorkflowRun | null;
}

export default function WorkflowRibbon({ workflowRun }: WorkflowRibbonProps) {
  if (!workflowRun) return null;

  const activeStep = workflowRun.steps.find(step => step.status === 'running');

  return (
    <div className="border-b border-border bg-background/85 px-4 py-2 backdrop-blur-xl lg:px-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <span className={`h-2 w-2 rounded-full ${workflowRun.status === 'error' ? 'bg-destructive' : workflowRun.status === 'done' ? 'bg-success' : 'bg-google-blue animate-pulse'}`} />
              <span>{workflowRun.label}</span>
              <span className="hidden text-muted-foreground sm:inline">/ {activeStep?.detail ?? workflowRun.lastEvent}</span>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            {workflowRun.progress}%
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {workflowRun.steps.map((step, index) => (
            <div key={step.id} className="flex shrink-0 items-center gap-2">
              <StepPill step={step} />
              {index < workflowRun.steps.length - 1 && (
                <div className={`h-px w-5 ${step.status === 'done' || step.status === 'skipped' ? 'bg-success/40' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepPill({ step }: { step: WorkflowStep }) {
  const statusClass =
    step.status === 'done' ? 'border-success/30 bg-success/10 text-success'
    : step.status === 'running' ? 'border-google-blue/30 bg-google-blue/10 text-google-blue'
    : step.status === 'error' ? 'border-destructive/30 bg-destructive/10 text-destructive'
    : step.status === 'skipped' ? 'border-border bg-muted/70 text-muted-foreground'
    : 'border-border bg-card text-muted-foreground';

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${statusClass}`}>
      {step.status === 'done' ? <CheckCircle2 size={12} />
        : step.status === 'running' ? <Loader2 size={12} className="animate-spin" />
        : step.status === 'error' ? <AlertCircle size={12} />
        : <Circle size={10} />}
      <span>{step.label}</span>
      {step.status === 'running' && typeof step.progress === 'number' && (
        <span className="font-mono text-[10px] opacity-80">{Math.round(step.progress)}%</span>
      )}
    </div>
  );
}

