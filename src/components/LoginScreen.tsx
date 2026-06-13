import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const LOCAL_ACCESS_KEY = 'wpbox.localAccess';

interface LoginScreenProps {
  onEnter: () => void;
  onAuthSuccess?: (user: User) => void;
}

export default function LoginScreen({ onAuthSuccess }: LoginScreenProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'email' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  const runLoginFlow = async () => {
    setError(null);

    if (step === 'email') {
      if (!email.trim()) {
        setError('Zadajte e-mail.');
        return;
      }
      setStep('password');
      return;
    }

    if (!password) {
      setError('Zadajte heslo.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) throw signInError;
      if (!data.session?.user) {
        throw new Error('Prihlásenie prebehlo, ale relácia sa nevytvorila. Skúste znova.');
      }

      setPassword('');
      localStorage.removeItem(LOCAL_ACCESS_KEY);
      onAuthSuccess?.(data.session.user);
    } catch (err) {
      setPassword('');
      setError(err instanceof Error ? err.message : 'Prihlásenie zlyhalo.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void runLoginFlow();
  };

  const currentValue = step === 'email' ? email : password;
  const setCurrentValue = step === 'email' ? setEmail : setPassword;

  return (
    <main className="wpbox-minimal-login-shell">
      <div className="wpbox-minimal-login-noise" aria-hidden="true" />
      <form className="wpbox-minimal-login-form" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="wpbox-login-field">
          {step === 'email' ? 'E-mail' : 'Heslo'}
        </label>
        <div className="wpbox-minimal-login-bar">
          <input
            ref={inputRef}
            id="wpbox-login-field"
            type={step === 'email' ? 'email' : 'password'}
            inputMode={step === 'email' ? 'email' : 'text'}
            autoComplete={step === 'email' ? 'email' : 'current-password'}
            value={currentValue}
            onChange={(event) => setCurrentValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !loading) {
                event.preventDefault();
                void runLoginFlow();
              }
              if (event.key === 'Escape' && step === 'password') {
                setPassword('');
                setError(null);
                setStep('email');
              }
            }}
            placeholder={step === 'email' ? 'Email' : 'Password'}
            disabled={loading}
            className="wpbox-minimal-login-input"
          />
          <button
            type="submit"
            disabled={loading}
            className="wpbox-minimal-login-submit"
            aria-label={step === 'email' ? 'Pokračovať na heslo' : 'Prihlásiť sa'}
          >
            {loading ? <Loader2 size={28} className="animate-spin" /> : <ArrowRight size={30} />}
          </button>
        </div>

        {error ? <p className="wpbox-minimal-login-error">{error}</p> : null}
      </form>
    </main>
  );
}
