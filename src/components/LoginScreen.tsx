import { useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function LoginScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setSuccessMsg('Registrácia úspešná! Skontrolujte email pre overenie účtu.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message || 'Nastala chyba.');
    } finally {
      setLoading(false);
    }
  };

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

          <h1 className="text-2xl font-normal text-foreground mb-1">
            {isSignUp ? 'Vytvoriť účet' : 'Prihláste sa'}
          </h1>
          <p className="text-muted-foreground text-sm mb-8">
            {isSignUp ? 'Zaregistrujte sa do H4CK3D Enterprise' : 'Pokračujte do H4CK3D Enterprise'}
          </p>

          {successMsg ? (
            <div className="py-6 text-success text-sm font-medium">{successMsg}</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5 ml-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="w-full bg-card border border-border rounded-lg px-4 py-3.5 text-[15px] text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground disabled:opacity-50"
                  placeholder="vas@email.com"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5 ml-1">Heslo</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full bg-card border border-border rounded-lg px-4 py-3.5 text-[15px] text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground disabled:opacity-50"
                  placeholder={isSignUp ? 'Minimálne 6 znakov' : 'Heslo'}
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

              <div className="flex items-center justify-between pt-4">
                <button
                  type="button"
                  onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccessMsg(''); }}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  {isSignUp ? 'Už mám účet' : 'Vytvoriť účet'}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-2.5 bg-primary text-primary-foreground rounded-full hover:bg-google-blue-hover transition-colors font-medium disabled:opacity-50 shadow-sm"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : isSignUp ? 'Registrovať' : 'Prihlásiť'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
