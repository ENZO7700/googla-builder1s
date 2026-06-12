import { useState } from 'react';
import { ArrowRight, Boxes, Loader2 } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const LOCAL_ACCESS_KEY = 'wpbox.localAccess';

interface LoginScreenProps {
  onEnter: () => void;
  onAuthSuccess?: (user: User) => void;
}

export default function LoginScreen({ onEnter, onAuthSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        if (data.session?.user) {
          localStorage.removeItem(LOCAL_ACCESS_KEY);
          onAuthSuccess?.(data.session.user);
          return;
        }
        setError('Účet vytvorený. Skúste sa prihlásiť — ak to nejde, potvrďte e-mail v schránke.');
        setMode('signin');
        return;
      }
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      if (!data.session?.user) {
        throw new Error('Prihlásenie prebehlo, ale relácia sa nevytvorila. Skúste znova.');
      }
      localStorage.removeItem(LOCAL_ACCESS_KEY);
      onAuthSuccess?.(data.session.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prihlásenie zlyhalo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-3xl shadow-xl border border-border p-10">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Boxes size={30} />
          </div>

          <h1 className="text-2xl font-semibold text-foreground mb-1 text-center">LarsenEvans-wpBOX</h1>
          <p className="text-muted-foreground text-sm mb-6 text-center">
            Prihlásenie cez Supabase (potrebné pre WordPress REST API). Demo režim WordPress proxy nepodporuje.
          </p>
          {!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? (
            <p className="text-xs text-destructive mb-4 text-center">
              Chýba Supabase konfigurácia v .env — reštartujte dev server po úprave .env.
            </p>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail"
              required
              autoComplete="email"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Heslo"
              required
              minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm"
            />
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-[15px] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-google-blue-hover disabled:opacity-60"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {mode === 'signup' ? 'Vytvoriť účet' : 'Prihlásiť sa'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <button
            type="button"
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}
            className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            {mode === 'signin' ? 'Nemáte účet? Zaregistrujte sa' : 'Už máte účet? Prihláste sa'}
          </button>

          <div className="my-6 border-t border-border" />

          {import.meta.env.DEV ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={onEnter}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full border-2 border-primary/20 bg-primary/5 px-6 py-3 text-[15px] font-semibold text-primary transition-colors hover:bg-primary/10"
              >
                Dev-Free-Entry (Ostré testovanie)
              </button>
              <button
                type="button"
                onClick={onEnter}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
              >
                Demo režim (bez WordPress proxy)
              </button>
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Na produkcii je potrebné Supabase prihlásenie pre WordPress proxy a uloženie Application Password.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
