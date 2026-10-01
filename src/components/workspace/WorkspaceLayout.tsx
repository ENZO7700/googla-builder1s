import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

interface WorkspaceLayoutProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  headerClassName?: string;
  footer?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
}

export default function WorkspaceLayout({
  title,
  description,
  icon,
  actions,
  children,
  contentClassName = '',
  headerClassName = '',
  footer,
  onBack,
  backLabel = 'Späť na Workspace',
}: WorkspaceLayoutProps) {
  return (
    <section className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-background">
      <header className={`shrink-0 border-b border-border bg-card px-4 py-3 sm:px-6 lg:px-8 ${headerClassName}`}>
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label={backLabel}
                title={backLabel}
                className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            {icon && <div className="mt-1 shrink-0 text-primary">{icon}</div>}
            <div className="min-w-0">
              <h2 className="text-2xl font-normal text-foreground">{title}</h2>
              {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
            </div>
          </div>
          {actions && <div className="min-w-0 shrink-0">{actions}</div>}
        </div>
      </header>

      <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${contentClassName}`}>
        {children}
      </div>

      {footer && <footer className="shrink-0 border-t border-border bg-card">{footer}</footer>}
    </section>
  );
}