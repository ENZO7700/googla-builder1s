import { useState, type CSSProperties } from 'react';
import { ArrowRight, Boxes, KeyRound, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const LOCAL_ACCESS_KEY = 'wpbox.localAccess';
const AUTH_PARTICLES: CSSProperties[] = [
  { left: '10%', top: '14%', width: '10px', color: 'rgba(0, 188, 212, 0.82)', animationDuration: '12s' },
  { left: '78%', top: '18%', width: '7px', color: 'rgba(255, 255, 255, 0.68)', animationDuration: '10s', animationDelay: '1.5s' },
  { left: '64%', top: '64%', width: '12px', color: 'rgba(66, 133, 244, 0.56)', animationDuration: '14s', animationDelay: '0.7s' },
  { left: '22%', top: '74%', width: '8px', color: 'rgba(255, 255, 255, 0.48)', animationDuration: '11s', animationDelay: '2.4s' },
  { left: '42%', top: '28%', width: '6px', color: 'rgba(52, 168, 83, 0.62)', animationDuration: '9s', animationDelay: '1.1s' },
];

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
    <div className="wpbox-auth-shell">
      <div className="wpbox-auth-grid" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-[8%] top-[10%] h-52 w-52 rounded-full bg-cyan-400/12 blur-3xl sm:h-72 sm:w-72" />
        <div className="absolute bottom-[8%] right-[6%] h-64 w-64 rounded-full bg-blue-500/10 blur-3xl sm:h-80 sm:w-80" />
        <div className="absolute left-1/2 top-1/2 h-[24rem] w-[24rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-[140px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="wpbox-glass-card grid w-full max-w-6xl gap-4 overflow-hidden rounded-[32px] p-3 sm:p-4 xl:grid-cols-[1.15fr_0.85fr] xl:gap-6 xl:p-6">
          <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.035] px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
            <div className="wpbox-ambient-field" aria-hidden="true">
              {AUTH_PARTICLES.map((style, index) => (
                <span
                  key={`${style.left}-${style.top}-${index}`}
                  className="wpbox-ambient-particle"
                  style={style}
                />
              ))}
            </div>

            <div className="relative z-10 flex h-full flex-col">
              <div className="mb-8 flex items-center justify-between gap-3">
                <div className="wpbox-auth-chip">
                  <Sparkles size={14} />
                  AI builder for WordPress delivery
                </div>
                <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-white/60 sm:flex">
                  Production ready
                </div>
              </div>

              <div className="max-w-2xl">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[20px] border border-white/12 bg-white/10 text-white shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
                  <Boxes size={30} />
                </div>
                <p className="mb-3 text-xs font-medium uppercase tracking-[0.32em] text-cyan-200/80">
                  Larsen Evans secure workspace
                </p>
                <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  LarsenEvans-wpBOX
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72 sm:text-base">
                  Bezpečný AI workspace pre generovanie, kontrolu a WordPress deployment.
                  Produkčný prístup zostáva chránený cez Supabase session, aby WordPress proxy
                  a uložené Application Password fungovali spoľahlivo.
                </p>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="wpbox-auth-feature-card">
                  <ShieldCheck size={18} className="text-cyan-200" />
                  <h2 className="mt-3 text-sm font-semibold text-white">Protected sessions</h2>
                  <p className="mt-2 text-sm leading-6 text-white/64">
                    Produkčný WordPress flow ide iba cez aktívnu Supabase reláciu.
                  </p>
                </div>
                <div className="wpbox-auth-feature-card">
                  <KeyRound size={18} className="text-cyan-200" />
                  <h2 className="mt-3 text-sm font-semibold text-white">REST ready</h2>
                  <p className="mt-2 text-sm leading-6 text-white/64">
                    Prihlásenie drží proxy vrstvu pripravenú pre WP REST API a Application Password.
                  </p>
                </div>
                <div className="wpbox-auth-feature-card">
                  <Sparkles size={18} className="text-cyan-200" />
                  <h2 className="mt-3 text-sm font-semibold text-white">Builder focus</h2>
                  <p className="mt-2 text-sm leading-6 text-white/64">
                    Po vstupe pokračujete rovno do AI builderu bez zmeny dnešnej logiky.
                  </p>
                </div>
              </div>

              <div className="mt-8 rounded-[24px] border border-white/10 bg-black/20 p-5 backdrop-blur-xl sm:mt-auto">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.24em] text-white/48">
                      Session contract
                    </p>
                    <p className="mt-2 text-sm text-white/72">
                      Vizuál je nový, ale produkčné prihlasovanie a WordPress session kontrakt ostávajú bezo zmeny.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-100">
                    <span className="h-2 w-2 rounded-full bg-emerald-300" />
                    Supabase auth active
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="wpbox-auth-panel rounded-[28px] p-5 sm:p-7 lg:p-8">
            <div className="mx-auto flex h-full w-full max-w-md flex-col justify-center">
              <div className="mb-6">
                <p className="text-xs font-medium uppercase tracking-[0.28em] text-cyan-200/85">
                  Secure sign in
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  {mode === 'signup' ? 'Vytvoriť nový prístup' : 'Prihlásiť sa do workspace'}
                </h2>
                <p className="mt-3 text-sm leading-6 text-white/68">
                  Prihlásenie cez Supabase je potrebné pre WordPress proxy, uložené site spojenia a bezpečný deploy flow.
                </p>
              </div>

              {!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? (
                <p className="mb-4 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-xs leading-6 text-red-100">
                  Chýba Supabase konfigurácia v <code>.env</code>. Po doplnení premenných reštartujte dev server.
                </p>
              ) : null}

              <form onSubmit={handleSubmit} className="space-y-3">
                <label className="block">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-[0.22em] text-white/46">
                    E-mail
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="meno@firma.sk"
                    required
                    autoComplete="email"
                    className="wpbox-auth-input"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-[0.22em] text-white/46">
                    Heslo
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Zadajte heslo"
                    required
                    minLength={6}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    className="wpbox-auth-input"
                  />
                </label>
                {error ? (
                  <p className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-xs leading-6 text-red-100">
                    {error}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={loading}
                  className="wpbox-auth-submit"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                  {mode === 'signup' ? 'Vytvoriť účet' : 'Prihlásiť sa'}
                  {!loading ? <ArrowRight size={18} /> : null}
                </button>
              </form>

              <button
                type="button"
                onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}
                className="mt-4 text-left text-sm text-white/62 transition-colors hover:text-white"
              >
                {mode === 'signin' ? 'Nemáte účet? Zaregistrujte sa' : 'Už máte účet? Prihláste sa'}
              </button>

              <div className="my-6 h-px w-full bg-white/10" />

              {import.meta.env.DEV ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={onEnter}
                    className="wpbox-auth-secondary-button"
                  >
                    Dev-Free-Entry (Ostré testovanie)
                  </button>
                  <button
                    type="button"
                    onClick={onEnter}
                    className="w-full text-center text-xs font-medium text-white/56 transition-colors hover:text-white"
                  >
                    Demo režim (bez WordPress proxy)
                  </button>
                </div>
              ) : (
                <p className="rounded-2xl border border-white/8 bg-white/[0.035] px-4 py-3 text-sm leading-6 text-white/62">
                  Na produkcii je potrebné Supabase prihlásenie pre WordPress proxy a uloženie Application Password.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
