import { ArrowRight, Boxes } from 'lucide-react';

interface LoginScreenProps {
  onEnter: () => void;
}

export default function LoginScreen({ onEnter }: LoginScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-3xl shadow-xl border border-border p-10 text-center">
          <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Boxes size={30} />
          </div>

          <h1 className="text-2xl font-semibold text-foreground mb-2">LarsenEvans-wpBOX</h1>
          <p className="text-muted-foreground text-sm mb-8">
            Lokálny vstup do pracovného priestoru.
          </p>

          <button
            type="button"
            onClick={onEnter}
            className="w-full inline-flex items-center justify-center gap-3 rounded-full bg-primary px-6 py-3.5 text-[15px] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-google-blue-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            Vstúpte!
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
