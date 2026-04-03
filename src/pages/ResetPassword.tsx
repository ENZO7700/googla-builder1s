import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check for recovery session from URL hash
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setValidSession(true);
    }

    // Also check if there's an active session (user clicked the recovery link)
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setValidSession(true);
      }
    });

    // Give it a moment to process the hash
    setTimeout(() => setChecking(false), 1000);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Heslá sa nezhodujú.');
      return;
    }

    if (password.length < 6) {
      setError('Heslo musí mať minimálne 6 znakov.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => navigate('/'), 3000);
    } catch (err: any) {
      setError(err.message || 'Nastala chyba pri zmene hesla.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-3xl shadow-xl border border-border p-10 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-8">
            <div className="w-3 h-3 rounded-full bg-google-blue" />
            <div className="w-3 h-3 rounded-full bg-google-red" />
            <div className="w-3 h-3 rounded-full bg-google-yellow" />
            <div className="w-3 h-3 rounded-full bg-google-green" />
          </div>

          <h1 className="text-2xl font-normal text-foreground mb-1">Nové heslo</h1>
          <p className="text-muted-foreground text-sm mb-8">Zadajte nové heslo pre váš účet</p>

          {success ? (
            <div className="py-6 flex flex-col items-center gap-3">
              <CheckCircle2 className="text-green-500" size={40} />
              <p className="text-sm text-foreground font-medium">Heslo bolo úspešne zmenené!</p>
              <p className="text-xs text-muted-foreground">Budete presmerovaný na prihlásenie...</p>
            </div>
          ) : !validSession ? (
            <div className="py-6 flex flex-col items-center gap-3">
              <AlertCircle className="text-destructive" size={40} />
              <p className="text-sm text-foreground">Neplatný alebo expirovaný odkaz na obnovenie hesla.</p>
              <button
                onClick={() => navigate('/')}
                className="mt-4 text-sm text-primary hover:underline font-medium"
              >
                Späť na prihlásenie
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5 ml-1">Nové heslo</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full bg-card border border-border rounded-lg px-4 py-3.5 text-[15px] text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground disabled:opacity-50"
                  placeholder="Minimálne 6 znakov"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5 ml-1">Potvrdiť heslo</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  className="w-full bg-card border border-border rounded-lg px-4 py-3.5 text-[15px] text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground disabled:opacity-50"
                  placeholder="Zopakujte heslo"
                  required
                  minLength={6}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm px-1">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-2.5 bg-primary text-primary-foreground rounded-full hover:bg-google-blue-hover transition-colors font-medium disabled:opacity-50 shadow-sm"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : 'Zmeniť heslo'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
