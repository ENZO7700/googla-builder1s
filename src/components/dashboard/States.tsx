import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      {icon && <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-muted-foreground mb-3">{icon}</div>}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="text-xs text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = 'Načítavam...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs py-12">
      <Loader2 size={14} className="animate-spin" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-6">
      <p className="text-sm font-medium text-destructive">Chyba pri načítaní</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-4 py-2 bg-card border border-border rounded-full text-xs font-medium text-foreground hover:bg-accent"
        >
          Skúsiť znova
        </button>
      )}
    </div>
  );
}
