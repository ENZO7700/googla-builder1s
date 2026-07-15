import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthForm from '@/components/AuthForm';
import { wpboxAuthConfig } from '@/lib/auth-config';

describe('AuthForm', () => {
  it('renders brand and login fields', () => {
    render(
      <AuthForm
        config={wpboxAuthConfig}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText('wpBOX')).toBeInTheDocument();
    expect(screen.getByText('WordPress workspace na jednom mieste')).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByLabelText('Heslo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prihlásiť sa' })).toBeInTheDocument();
  });

  it('switches to register and forgot views', async () => {
    const user = userEvent.setup();
    render(<AuthForm config={wpboxAuthConfig} onSubmit={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Registrácia' }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Vytvoriť účet' })).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Meno')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Prihlásiť sa' }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Prihlásenie' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Zabudli ste heslo?' }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Obnovenie hesla' })).toBeInTheDocument();
    });
    expect(screen.queryByLabelText('Heslo')).not.toBeInTheDocument();
  });

  it('calls onSubmit with login payload', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({ ok: true, sessionUser: { id: '1' } });
    const onAuthSuccess = vi.fn();

    render(
      <AuthForm
        config={wpboxAuthConfig}
        onSubmit={onSubmit}
        onAuthSuccess={onAuthSuccess}
      />,
    );

    await user.type(screen.getByLabelText('E-mail'), 'erik@example.com');
    await user.type(screen.getByLabelText('Heslo'), 'secret12');
    await user.click(screen.getByRole('button', { name: 'Prihlásiť sa' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        view: 'login',
        data: expect.objectContaining({
          email: 'erik@example.com',
          password: 'secret12',
        }),
      });
    });

    await waitFor(() => {
      expect(onAuthSuccess).toHaveBeenCalled();
    });
  });

  it('exposes local demo action when enabled', async () => {
    const user = userEvent.setup();
    const onLocalDemo = vi.fn();

    render(
      <AuthForm
        config={wpboxAuthConfig}
        onSubmit={vi.fn()}
        onLocalDemo={onLocalDemo}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Pokračovať v demo režime' }));
    expect(onLocalDemo).toHaveBeenCalled();
  });
});
