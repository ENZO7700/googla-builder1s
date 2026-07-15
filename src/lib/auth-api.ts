import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { AuthSubmitHandler, AuthSubmitPayload, AuthSubmitResult } from '@/lib/auth-types';

const REMEMBER_KEY = 'wpbox.auth.rememberEmail';

function toErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message: unknown }).message);
    if (message) return message;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export function persistRememberedEmail(email: string, remember: boolean): void {
  if (remember) {
    localStorage.setItem(REMEMBER_KEY, email);
  } else {
    localStorage.removeItem(REMEMBER_KEY);
  }
}

export function getRememberedEmail(): string {
  return localStorage.getItem(REMEMBER_KEY) ?? '';
}

/**
 * Handles AuthForm submissions against Supabase Auth.
 * Payload shape matches the integration contract:
 * `{ view, data: { email, password, name?, confirmPassword?, rememberMe? } }`
 */
export const handleAuthSubmit: AuthSubmitHandler = async (
  payload: AuthSubmitPayload,
): Promise<AuthSubmitResult> => {
  const { view, data } = payload;
  const email = data.email.trim();

  try {
    if (view === 'login') {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email,
        password: data.password,
      });

      if (error) {
        return { ok: false, error: toErrorMessage(error, 'Prihlásenie zlyhalo.') };
      }

      if (!authData.session?.user) {
        return {
          ok: false,
          error: 'Prihlásenie prebehlo, ale relácia sa nevytvorila. Skúste znova.',
        };
      }

      persistRememberedEmail(email, Boolean(data.rememberMe));

      return { ok: true, sessionUser: authData.session.user as User };
    }

    if (view === 'register') {
      const { data: authData, error } = await supabase.auth.signUp({
        email,
        password: data.password,
        options: {
          data: {
            full_name: data.name?.trim() ?? '',
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        return { ok: false, error: toErrorMessage(error, 'Registrácia zlyhala.') };
      }

      if (authData.session?.user) {
        persistRememberedEmail(email, Boolean(data.rememberMe));
        return {
          ok: true,
          message: 'Účet bol vytvorený a ste prihlásený.',
          sessionUser: authData.session.user as User,
        };
      }

      return {
        ok: true,
        message: 'Účet bol vytvorený. Skontrolujte e-mail pre potvrdenie.',
      };
    }

    // forgot
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      return { ok: false, error: toErrorMessage(error, 'Nepodarilo sa odoslať odkaz.') };
    }

    return {
      ok: true,
      message: 'Ak účet existuje, poslali sme odkaz na obnovenie hesla.',
    };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error, 'Operácia zlyhala.') };
  }
};
