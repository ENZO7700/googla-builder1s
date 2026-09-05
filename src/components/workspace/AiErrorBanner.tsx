import { AlertCircle, Settings } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { AiErrorCopy } from '@/lib/aiErrorCopy';
import { cn } from '@/lib/utils';

interface AiErrorBannerProps {
  error: AiErrorCopy;
  onOpenSettings?: () => void;
  className?: string;
}

export default function AiErrorBanner({ error, onOpenSettings, className }: AiErrorBannerProps) {
  return (
    <Alert variant="destructive" className={cn('border-destructive/40 bg-destructive/5', className)}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="text-sm">{error.title}</AlertTitle>
      <AlertDescription className="text-xs space-y-2">
        <p>{error.message}</p>
        <p className="font-medium text-destructive/90">{error.action}</p>
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-background px-3 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Settings size={12} />
            Otvoriť Nastavenia
          </button>
        )}
      </AlertDescription>
    </Alert>
  );
}
