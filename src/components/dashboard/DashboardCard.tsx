import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DashboardCardProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function DashboardCard({ title, description, icon, actions, children, className }: DashboardCardProps) {
  return (
    <section className={cn('bg-card border border-border rounded-2xl shadow-sm overflow-hidden', className)}>
      <header className="flex items-start justify-between gap-4 px-6 py-5 border-b border-border">
        <div className="flex items-start gap-3 min-w-0">
          {icon && <div className="text-primary mt-0.5 shrink-0">{icon}</div>}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground tracking-tight">{title}</h2>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </header>
      {children}
    </section>
  );
}
