export type WorkflowStepId = 'input' | 'files' | 'ai' | 'stream' | 'preview' | 'save';
export type WorkflowStepStatus = 'waiting' | 'running' | 'done' | 'error' | 'skipped';
export type WorkflowRunStatus = 'running' | 'done' | 'error';

export interface WorkflowStep {
  id: WorkflowStepId;
  label: string;
  status: WorkflowStepStatus;
  detail?: string;
  progress?: number;
  startedAt?: number;
  finishedAt?: number;
}

export interface WorkflowRun {
  id: string;
  label: string;
  status: WorkflowRunStatus;
  startedAt: number;
  finishedAt?: number;
  progress: number;
  lastEvent: string;
  steps: WorkflowStep[];
}

const workflowSteps: Array<Pick<WorkflowStep, 'id' | 'label'>> = [
  { id: 'input', label: 'Input' },
  { id: 'files', label: 'Files' },
  { id: 'ai', label: 'AI Core' },
  { id: 'stream', label: 'Streaming' },
  { id: 'preview', label: 'Preview' },
  { id: 'save', label: 'Saved' },
];

export function createWorkflowRun(label = 'AI pipeline'): WorkflowRun {
  return {
    id: `workflow_${Date.now()}`,
    label,
    status: 'running',
    startedAt: Date.now(),
    progress: 0,
    lastEvent: 'Workflow pripravený',
    steps: workflowSteps.map(step => ({ ...step, status: 'waiting' })),
  };
}

export function updateWorkflowStep(
  run: WorkflowRun,
  stepId: WorkflowStepId,
  update: Partial<Omit<WorkflowStep, 'id' | 'label'>>
): WorkflowRun {
  const now = Date.now();
  const steps = run.steps.map(step => {
    if (step.id !== stepId) return step;
    const status = update.status ?? step.status;
    return {
      ...step,
      ...update,
      status,
      startedAt: status === 'running' && !step.startedAt ? now : step.startedAt,
      finishedAt: ['done', 'error', 'skipped'].includes(status) ? now : step.finishedAt,
    };
  });

  const hasError = steps.some(step => step.status === 'error');
  const allSettled = steps.every(step => ['done', 'skipped'].includes(step.status));
  const progress = calculateWorkflowProgress(steps);

  return {
    ...run,
    steps,
    progress,
    status: hasError ? 'error' : allSettled ? 'done' : 'running',
    finishedAt: hasError || allSettled ? now : run.finishedAt,
    lastEvent: update.detail ?? run.lastEvent,
  };
}

export function finishWorkflowRun(run: WorkflowRun, status: WorkflowRunStatus, lastEvent: string): WorkflowRun {
  return {
    ...run,
    status,
    progress: status === 'done' ? 100 : run.progress,
    finishedAt: Date.now(),
    lastEvent,
  };
}

function calculateWorkflowProgress(steps: WorkflowStep[]): number {
  const weight = 100 / steps.length;
  const progress = steps.reduce((total, step) => {
    if (step.status === 'done' || step.status === 'skipped') return total + weight;
    if (step.status === 'running') return total + weight * ((step.progress ?? 50) / 100);
    return total;
  }, 0);
  return Math.min(100, Math.round(progress));
}

