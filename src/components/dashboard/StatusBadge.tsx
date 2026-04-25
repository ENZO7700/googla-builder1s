import { cn } from '@/lib/utils';

type Tone = 'success' | 'error' | 'warning' | 'info' | 'muted' | 'running';

interface StatusBadgeProps {
  tone: Tone;
  label: string;
  pulse?: boolean;
}

const TONE_CLASSES: Record<Tone, string> = {
  success: 'bg-success/10 text-success border-success/20',
  error: 'bg-destructive/10 text-destructive border-destructive/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  info: 'bg-primary/10 text-primary border-primary/20',
  muted: 'bg-muted text-muted-foreground border-border',
  running: 'bg-primary/10 text-primary border-primary/30',
};

export default function StatusBadge({ tone, label, pulse }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap',
        TONE_CLASSES[tone],
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', {
        'bg-success': tone === 'success',
        'bg-destructive': tone === 'error',
        'bg-warning': tone === 'warning',
        'bg-primary animate-pulse': tone === 'info' || tone === 'running' || pulse,
        'bg-muted-foreground': tone === 'muted',
      })} />
      {label}
    </span>
  );
}
