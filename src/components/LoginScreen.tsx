import { useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

interface LoginScreenProps {
  onLogin: () => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [authStage, setAuthStage] = useState(0);
  const [loginId, setLoginId] = useState('');
  const [loginKey, setLoginKey] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthStage(1);
    setLoginError('');

    setTimeout(() => {
      if (loginId === 'root_admin' && loginKey === '88888888') {
        setAuthStage(2);
        setTimeout(() => onLogin(), 1200);
      } else {
        setLoginError('Nesprávne prihlasovacie údaje. Skúste to znova.');
        setAuthStage(0);
      }
    }, 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-3xl shadow-xl border border-border p-10 text-center">
          {/* Logo dots */}
          <div className="flex items-center justify-center gap-1.5 mb-8">
            <div className="w-3 h-3 rounded-full bg-google-blue" />
            <div className="w-3 h-3 rounded-full bg-google-red" />
            <div className="w-3 h-3 rounded-full bg-google-yellow" />
            <div className="w-3 h-3 rounded-full bg-google-green" />
          </div>

          <h1 className="text-2xl font-normal text-foreground mb-1">Prihláste sa</h1>
          <p className="text-muted-foreground text-sm mb-8">Pokračujte do H4CK3D Enterprise</p>

          {authStage === 2 ? (
            <div className="py-8 flex flex-col items-center gap-4">
              <Loader2 size={32} className="text-primary animate-spin" />
              <div>
                <p className="text-foreground font-medium">Overovanie pracovného priestoru...</p>
                <p className="text-muted-foreground text-sm mt-1">SSO & IAM Kontrola</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5 ml-1">Identifikátor</label>
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  disabled={authStage === 1}
                  className="w-full bg-card border border-border rounded-lg px-4 py-3.5 text-[15px] text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground disabled:opacity-50"
                  placeholder="E-mail alebo ID"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5 ml-1">Bezpečnostný kľúč</label>
                <input
                  type="password"
                  value={loginKey}
                  onChange={(e) => setLoginKey(e.target.value)}
                  disabled={authStage === 1}
                  className="w-full bg-card border border-border rounded-lg px-4 py-3.5 text-[15px] text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground disabled:opacity-50"
                  placeholder="Heslo"
                  required
                />
              </div>

              {loginError && (
                <div className="flex items-center gap-2 text-destructive text-sm px-1">
                  <AlertCircle size={16} />
                  {loginError}
                </div>
              )}

              <div className="flex items-center justify-between pt-4">
                <button type="button" className="text-sm text-primary hover:underline font-medium">
                  Zabudli ste heslo?
                </button>
                <button
                  type="submit"
                  disabled={authStage === 1}
                  className="px-8 py-2.5 bg-primary text-primary-foreground rounded-full hover:bg-google-blue-hover transition-colors font-medium disabled:opacity-50 shadow-sm"
                >
                  {authStage === 1 ? <Loader2 size={18} className="animate-spin" /> : 'Ďalej'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
