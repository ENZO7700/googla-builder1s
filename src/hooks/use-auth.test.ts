import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuthForm } from '@/hooks/use-auth';
import type { AuthSubmitHandler } from '@/lib/auth-types';

describe('useAuthForm', () => {
  it('validates email before submit', async () => {
    const onSubmit = vi.fn<AuthSubmitHandler>();
    const { result } = renderHook(() => useAuthForm({ onSubmit }));

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: () => undefined } as never);
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Zadajte platný e-mail.');
  });

  it('submits login payload and surfaces session user', async () => {
    const user = { id: 'u1', email: 'a@b.sk' };
    const onSubmit = vi.fn<AuthSubmitHandler>().mockResolvedValue({
      ok: true,
      sessionUser: user,
    });
    const onAuthSuccess = vi.fn();

    const { result } = renderHook(() => useAuthForm({ onSubmit, onAuthSuccess }));

    act(() => {
      result.current.setField('email', 'a@b.sk');
      result.current.setField('password', 'secret1');
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: () => undefined } as never);
    });

    expect(onSubmit).toHaveBeenCalledWith({
      view: 'login',
      data: expect.objectContaining({
        email: 'a@b.sk',
        password: 'secret1',
      }),
    });
    expect(onAuthSuccess).toHaveBeenCalledWith(user);
  });

  it('requires matching passwords on register', async () => {
    const onSubmit = vi.fn<AuthSubmitHandler>();
    const { result } = renderHook(() => useAuthForm({ onSubmit }));

    act(() => {
      result.current.setView('register');
      result.current.setField('email', 'a@b.sk');
      result.current.setField('name', 'Erik');
      result.current.setField('password', 'secret1');
      result.current.setField('confirmPassword', 'other');
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: () => undefined } as never);
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Heslá sa nezhodujú.');
  });
});
