import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

/**
 * Hardcoded admin/owner email whitelist.
 * Add or remove emails here to grant/revoke access to the GitHub dashboard
 * and other admin-only routes.
 *
 * NOTE: This is a lightweight gate suitable for a small team / internal tool.
 * For multi-tenant or production-scale apps, migrate to a `user_roles` table
 * with a `has_role()` SECURITY DEFINER function (see Supabase RLS docs).
 */
export const ADMIN_EMAILS: readonly string[] = [
  // TODO: Replace with real admin emails. Lowercase only.
  // 'you@example.com',
];

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  // Fail-closed: if no admins configured, no one is admin.
  // NOTE: This is a client-side gate for UX only. Any sensitive admin
  // operation MUST be enforced server-side (edge function + user_roles table).
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export interface AdminAuthState {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
}

/**
 * Hook that resolves the current user and whether they are an admin.
 * Subscribes to auth changes and tears down on unmount.
 */
export function useAdminAuth(): AdminAuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  return {
    user,
    isAdmin: isAdminEmail(user?.email),
    loading,
  };
}
