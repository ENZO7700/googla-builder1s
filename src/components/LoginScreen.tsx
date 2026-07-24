import type { User } from '@supabase/supabase-js';
import AuthForm from '@/components/AuthForm';
import { wpboxAuthConfig } from '@/lib/auth-config';
import { getRememberedEmail, handleAuthSubmit } from '@/lib/auth-api';

interface LoginScreenProps {
  onEnter: () => void;
  onAuthSuccess?: (user: User) => void;
}

export default function LoginScreen({ onEnter, onAuthSuccess }: LoginScreenProps) {
  return (
    <main className="wpbox-auth-shell">
      <div className="wpbox-auth-shell__glow" aria-hidden="true" />
      <div className="wpbox-auth-shell__grid" aria-hidden="true" />
      <AuthForm
        config={wpboxAuthConfig}
        onSubmit={handleAuthSubmit}
        initialEmail={getRememberedEmail()}
        onAuthSuccess={(user) => onAuthSuccess?.(user as User)}
        onLocalDemo={onEnter}
      />
    </main>
  );
}
