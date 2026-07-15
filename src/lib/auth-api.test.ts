import { beforeEach, describe, expect, it, vi } from 'vitest';

const { signInWithPassword, signUp, resetPasswordForEmail } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithPassword,
      signUp,
      resetPasswordForEmail,
    },
  },
}));

import { getRememberedEmail, handleAuthSubmit, persistRememberedEmail } from '@/lib/auth-api';

describe('auth-api', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('signs in and remembers email', async () => {
    const user = { id: 'u1', email: 'a@b.sk' };
    signInWithPassword.mockResolvedValue({
      data: { session: { user } },
      error: null,
    });

    const result = await handleAuthSubmit({
      view: 'login',
      data: { email: 'a@b.sk', password: 'x', rememberMe: true },
    });

    expect(result.ok).toBe(true);
    expect(result.sessionUser).toEqual(user);
    expect(getRememberedEmail()).toBe('a@b.sk');
  });

  it('registers a new account', async () => {
    signUp.mockResolvedValue({
      data: { session: null, user: { id: 'u2' } },
      error: null,
    });

    const result = await handleAuthSubmit({
      view: 'register',
      data: {
        email: 'new@b.sk',
        password: 'secret1',
        name: 'New',
        confirmPassword: 'secret1',
      },
    });

    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/vytvorený/i);
    expect(signUp).toHaveBeenCalled();
  });

  it('sends forgot-password email', async () => {
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    const result = await handleAuthSubmit({
      view: 'forgot',
      data: { email: 'a@b.sk', password: '' },
    });

    expect(result.ok).toBe(true);
    expect(resetPasswordForEmail).toHaveBeenCalledWith(
      'a@b.sk',
      expect.objectContaining({ redirectTo: expect.stringContaining('/reset-password') }),
    );
  });

  it('clears remembered email when rememberMe is false', () => {
    persistRememberedEmail('a@b.sk', true);
    persistRememberedEmail('a@b.sk', false);
    expect(getRememberedEmail()).toBe('');
  });
});
