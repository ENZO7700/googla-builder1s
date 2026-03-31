import { CheckCircle2, AlertCircle } from 'lucide-react';

export interface Toast {
  id: number;
  message: string;
  type: 'info' | 'success' | 'error';
}

export default function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-primary-foreground animate-in fade-in slide-in-from-bottom-4 duration-300 ${
            toast.type === 'error' ? 'bg-destructive' : toast.type === 'success' ? 'bg-success' : 'bg-foreground'
          }`}
        >
          {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          {toast.message}
        </div>
      ))}
    </div>
  );
}
