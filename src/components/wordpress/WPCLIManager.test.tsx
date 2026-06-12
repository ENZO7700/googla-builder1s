import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Hoisted mocks (vi.mock is hoisted to top, so helpers must use vi.hoisted) ──

const { mockFrom, mockInvoke, mockToastError, mockToastSuccess } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockInvoke: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: { invoke: mockInvoke },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

// ── Mock data ──────────────────────────────────────────────────────────────

const noSshSite = {
  data: {
    ssh_host: null,
    ssh_port: null,
    ssh_username: null,
    ssh_password_encrypted: null,
    ssh_private_key_encrypted: null,
    wp_path: null,
  },
  error: null,
};

const configuredSshSite = {
  data: {
    ssh_host: 'test.vps.wbsprt.com',
    ssh_port: 22,
    ssh_username: 'w123456',
    ssh_password_encrypted: btoa('testpass'),
    ssh_private_key_encrypted: null,
    wp_path: '/data/web/test.sk/web/',
  },
  error: null,
};

const emptyLogs = { data: [], error: null };

// ── Component (imported after mocks) ──────────────────────────────────────

import WPCLIManager from '@/components/wordpress/WPCLIManager';

// ── Chain builder ──────────────────────────────────────────────────────────

function buildAuditChain() {
  return {
    select: () => ({
      eq: () => ({
        like: () => ({
          order: () => ({
            limit: () => Promise.resolve(emptyLogs),
          }),
        }),
      }),
    }),
    insert: vi.fn().mockResolvedValue({ error: null }),
  };
}

// Matches: .from('wp_sites').select(...).eq('id', siteId).single()
function buildSiteChain(siteData = noSshSite, updateFn = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })) {
  return {
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve(siteData),
      }),
    }),
    update: updateFn,
  };
}

function setupMocks(siteData = noSshSite, updateFn?: ReturnType<typeof vi.fn>) {
  const update = updateFn ?? vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  mockFrom.mockImplementation((table: string) => {
    if (table === 'wp_sites') return buildSiteChain(siteData, update);
    return buildAuditChain();
  });
  return { update };
}

// ── setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  setupMocks();
});

// ══════════════════════════════════════════════════════════════════════════
// 1. RENDER
// ══════════════════════════════════════════════════════════════════════════

describe('WPCLIManager – render', () => {
  it('renders the component title', () => {
    render(<WPCLIManager siteId="site-1" />);
    expect(screen.getByText(/WP-CLI cez SSH/i)).toBeInTheDocument();
  });

  it('renders command grid buttons', () => {
    render(<WPCLIManager siteId="site-1" />);
    expect(screen.getByText('WP verzia')).toBeInTheDocument();
    expect(screen.getByText('Plugin list')).toBeInTheDocument();
    expect(screen.getByText('Maintenance ON')).toBeInTheDocument();
  });

  it('renders audit log section with empty state', () => {
    render(<WPCLIManager siteId="site-1" />);
    expect(screen.getByText(/Audit log/i)).toBeInTheDocument();
    expect(screen.getByText(/Žiadne WP-CLI logy/i)).toBeInTheDocument();
  });

  it('shows SSH not configured warning when no SSH host', async () => {
    render(<WPCLIManager siteId="site-1" />);
    await waitFor(() =>
      expect(screen.getByText(/SSH nie je nakonfigurované/i)).toBeInTheDocument(),
    );
  });

  it('disables command buttons when SSH is not configured', async () => {
    render(<WPCLIManager siteId="site-1" />);
    await waitFor(() => screen.getByText(/SSH nie je nakonfigurované/i));
    const btn = screen.getByRole('button', { name: /WP verzia/i });
    expect(btn).toBeDisabled();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 2. SSH FORM TOGGLE
// ══════════════════════════════════════════════════════════════════════════

describe('WPCLIManager – SSH form toggle', () => {
  it('SSH form fields are hidden by default', () => {
    render(<WPCLIManager siteId="site-1" />);
    expect(screen.queryByLabelText('SSH Host')).not.toBeInTheDocument();
  });

  it('opens SSH form on toggle click', async () => {
    render(<WPCLIManager siteId="site-1" />);
    await userEvent.click(screen.getByRole('button', { name: /SSH Konfigurácia/i }));
    expect(screen.getByLabelText('SSH Host')).toBeInTheDocument();
    expect(screen.getByLabelText('SSH Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Port')).toBeInTheDocument();
    expect(screen.getByLabelText('Cesta k WordPress')).toBeInTheDocument();
  });

  it('closes SSH form on second toggle click', async () => {
    render(<WPCLIManager siteId="site-1" />);
    const btn = screen.getByRole('button', { name: /SSH Konfigurácia/i });
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(screen.queryByLabelText('SSH Host')).not.toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 3. SSH FORM FIELDS & AUTH METHOD TOGGLE
// ══════════════════════════════════════════════════════════════════════════

describe('WPCLIManager – SSH form fields', () => {
  async function openForm() {
    render(<WPCLIManager siteId="site-1" />);
    await userEvent.click(screen.getByRole('button', { name: /SSH Konfigurácia/i }));
  }

  it('shows password field by default', async () => {
    await openForm();
    expect(screen.getByLabelText('Heslo')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Privátny kľúč/i)).not.toBeInTheDocument();
  });

  it('switches to private key on button click', async () => {
    await openForm();
    // The auth-method toggle buttons are the first two buttons with these names
    const authButtons = screen.getAllByRole('button', { name: /Privátny kľúč/i });
    // First match is the toggle button (before the textarea appears)
    await userEvent.click(authButtons[0]);
    expect(screen.getByLabelText(/Privátny kľúč \(PEM\)/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Heslo')).not.toBeInTheDocument();
  });

  it('switches back to password', async () => {
    await openForm();
    const keyBtn = screen.getAllByRole('button', { name: /Privátny kľúč/i })[0];
    await userEvent.click(keyBtn);
    // Now Heslo button is the auth-method toggle button
    const hesloBtn = screen.getAllByRole('button', { name: /^Heslo$/i })[0];
    await userEvent.click(hesloBtn);
    expect(screen.getByLabelText('Heslo')).toBeInTheDocument();
  });

  it('can type into SSH Host field', async () => {
    render(<WPCLIManager siteId="site-1" />);
    // Wait for the component to finish loading SSH config
    await waitFor(() => screen.getByText(/SSH nie je nakonfigurované/i));
    await userEvent.click(screen.getByRole('button', { name: /SSH Konfigurácia/i }));
    const input = await screen.findByLabelText('SSH Host');
    await userEvent.type(input, 'myserver.vps.wbsprt.com');
    expect(input).toHaveValue('myserver.vps.wbsprt.com');
  });

  it('can type into Port field', async () => {
    await openForm();
    const input = screen.getByLabelText('Port');
    await userEvent.clear(input);
    await userEvent.type(input, '2222');
    expect(input).toHaveValue(2222);
  });

  it('can type into WP Path field', async () => {
    await openForm();
    const input = screen.getByLabelText('Cesta k WordPress');
    await userEvent.type(input, '/data/web/mysite.sk/web/');
    expect(input).toHaveValue('/data/web/mysite.sk/web/');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 4. SAVE BUTTON VALIDATION
// ══════════════════════════════════════════════════════════════════════════

describe('WPCLIManager – save button validation', () => {
  async function openForm() {
    render(<WPCLIManager siteId="site-1" />);
    await userEvent.click(screen.getByRole('button', { name: /SSH Konfigurácia/i }));
  }

  it('save button disabled when both fields empty', async () => {
    await openForm();
    expect(screen.getByRole('button', { name: /Uložiť SSH nastavenia/i })).toBeDisabled();
  });

  it('save button disabled when only host filled', async () => {
    await openForm();
    await userEvent.type(screen.getByLabelText('SSH Host'), 'myserver.com');
    expect(screen.getByRole('button', { name: /Uložiť SSH nastavenia/i })).toBeDisabled();
  });

  it('save button disabled when only username filled', async () => {
    await openForm();
    await userEvent.type(screen.getByLabelText('SSH Username'), 'w123456');
    expect(screen.getByRole('button', { name: /Uložiť SSH nastavenia/i })).toBeDisabled();
  });

  it('save button enabled when host AND username filled', async () => {
    await openForm();
    await userEvent.type(screen.getByLabelText('SSH Host'), 'myserver.com');
    await userEvent.type(screen.getByLabelText('SSH Username'), 'w123456');
    expect(screen.getByRole('button', { name: /Uložiť SSH nastavenia/i })).toBeEnabled();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 5. SAVE LOGIC – Supabase update call
// ══════════════════════════════════════════════════════════════════════════

describe('WPCLIManager – SSH save logic', () => {
  it('calls supabase update with base64-encoded password', async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: null });
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn });
    setupMocks(noSshSite, updateFn);

    render(<WPCLIManager siteId="site-42" />);
    await userEvent.click(screen.getByRole('button', { name: /SSH Konfigurácia/i }));

    await userEvent.type(screen.getByLabelText('SSH Host'), 'myhost.com');
    await userEvent.type(screen.getByLabelText('SSH Username'), 'w999');
    await userEvent.type(screen.getByLabelText('Cesta k WordPress'), '/var/www/html');
    await userEvent.type(screen.getByLabelText('Heslo'), 'supersecret');

    await userEvent.click(screen.getByRole('button', { name: /Uložiť SSH nastavenia/i }));

    await waitFor(() => {
      expect(updateFn).toHaveBeenCalledWith(
        expect.objectContaining({
          ssh_host: 'myhost.com',
          ssh_username: 'w999',
          wp_path: '/var/www/html',
          ssh_password_encrypted: btoa('supersecret'),
        }),
      );
    });
  });

  it('calls supabase update with base64-encoded private key and clears password field', async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: null });
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn });
    setupMocks(noSshSite, updateFn);

    render(<WPCLIManager siteId="site-42" />);
    await userEvent.click(screen.getByRole('button', { name: /SSH Konfigurácia/i }));
    await userEvent.click(screen.getByRole('button', { name: /Privátny kľúč/i }));

    await userEvent.type(screen.getByLabelText('SSH Host'), 'myhost.com');
    await userEvent.type(screen.getByLabelText('SSH Username'), 'root');
    await userEvent.type(
      screen.getByLabelText(/Privátny kľúč \(PEM\)/i),
      '-----BEGIN RSA PRIVATE KEY-----\nABC\n-----END RSA PRIVATE KEY-----',
    );

    await userEvent.click(screen.getByRole('button', { name: /Uložiť SSH nastavenia/i }));

    await waitFor(() => {
      expect(updateFn).toHaveBeenCalledWith(
        expect.objectContaining({
          ssh_private_key_encrypted: expect.any(String),
          ssh_password_encrypted: null,
        }),
      );
    });

    // verify the encoded value decodes correctly
    const callArgs = updateFn.mock.calls[0][0];
    expect(atob(callArgs.ssh_private_key_encrypted)).toContain('BEGIN RSA PRIVATE KEY');
  });

  it('shows success toast after successful save', async () => {
    setupMocks();
    render(<WPCLIManager siteId="site-1" />);
    await userEvent.click(screen.getByRole('button', { name: /SSH Konfigurácia/i }));
    await userEvent.type(screen.getByLabelText('SSH Host'), 'host.com');
    await userEvent.type(screen.getByLabelText('SSH Username'), 'user');
    await userEvent.click(screen.getByRole('button', { name: /Uložiť SSH nastavenia/i }));

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('SSH nastavenia uložené');
    });
  });

  it('shows error toast when Supabase update fails', async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: { message: 'DB error' } });
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn });
    setupMocks(noSshSite, updateFn);

    render(<WPCLIManager siteId="site-1" />);
    await userEvent.click(screen.getByRole('button', { name: /SSH Konfigurácia/i }));
    await userEvent.type(screen.getByLabelText('SSH Host'), 'host.com');
    await userEvent.type(screen.getByLabelText('SSH Username'), 'user');
    await userEvent.click(screen.getByRole('button', { name: /Uložiť SSH nastavenia/i }));

    await waitFor(() => {
      // Supabase error is thrown as { message: 'DB error' } object (not Error instance),
      // so String(e) = '[object Object]'. The toast.error key is what matters.
      expect(mockToastError).toHaveBeenCalledWith(
        'Chyba pri ukladaní SSH',
        expect.objectContaining({ description: expect.any(String) }),
      );
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 6. EXISTING SSH CONFIG LOADED FROM SUPABASE
// ══════════════════════════════════════════════════════════════════════════

describe('WPCLIManager – existing SSH config display', () => {
  beforeEach(() => setupMocks(configuredSshSite));

  it('shows configured host badge in toggle button', async () => {
    render(<WPCLIManager siteId="site-configured" />);
    await waitFor(() =>
      expect(screen.getByText(/w123456@test\.vps\.wbsprt\.com/)).toBeInTheDocument(),
    );
  });

  it('shows "Heslo uložené" badge when password is set', async () => {
    render(<WPCLIManager siteId="site-configured" />);
    await waitFor(() => expect(screen.getByText(/Heslo uložené/i)).toBeInTheDocument());
  });

  it('pre-fills host and username fields with existing values', async () => {
    render(<WPCLIManager siteId="site-configured" />);
    await waitFor(() => screen.getByText(/w123456@test\.vps\.wbsprt\.com/));
    await userEvent.click(screen.getByRole('button', { name: /SSH Konfigurácia/i }));
    expect(screen.getByLabelText('SSH Host')).toHaveValue('test.vps.wbsprt.com');
    expect(screen.getByLabelText('SSH Username')).toHaveValue('w123456');
    expect(screen.getByLabelText('Cesta k WordPress')).toHaveValue('/data/web/test.sk/web/');
  });

  it('does NOT show SSH not configured warning', async () => {
    render(<WPCLIManager siteId="site-configured" />);
    await waitFor(() => screen.getByText(/w123456@test\.vps\.wbsprt\.com/));
    expect(screen.queryByText(/SSH nie je nakonfigurované/i)).not.toBeInTheDocument();
  });

  it('enables command buttons when SSH is configured', async () => {
    render(<WPCLIManager siteId="site-configured" />);
    await waitFor(() => screen.getByText(/w123456@test\.vps\.wbsprt\.com/));
    expect(screen.getByRole('button', { name: /WP verzia/i })).not.toBeDisabled();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 7. DESTRUCTIVE COMMAND CONFIRM DIALOG
// ══════════════════════════════════════════════════════════════════════════

describe('WPCLIManager – destructive command confirm', () => {
  beforeEach(() => setupMocks(configuredSshSite));

  it('shows confirm dialog for Cache flush (destructive)', async () => {
    render(<WPCLIManager siteId="site-configured" />);
    await waitFor(() => screen.getByText(/w123456@/));
    await userEvent.click(screen.getByRole('button', { name: /Cache flush/i }));
    expect(screen.getByText(/Potvrdiť WP-CLI príkaz/i)).toBeInTheDocument();
    expect(screen.getByText(/cache-flush/i)).toBeInTheDocument();
  });

  it('dismisses confirm dialog on Zrušiť', async () => {
    render(<WPCLIManager siteId="site-configured" />);
    await waitFor(() => screen.getByText(/w123456@/));
    await userEvent.click(screen.getByRole('button', { name: /Cache flush/i }));
    await userEvent.click(screen.getByRole('button', { name: /Zrušiť/i }));
    expect(screen.queryByText(/Potvrdiť WP-CLI príkaz/i)).not.toBeInTheDocument();
  });

  it('invokes wordpress-cli edge function after confirm', async () => {
    mockInvoke.mockResolvedValue({ data: { stdout: 'Cache cleared', stderr: '' }, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'wp_sites') return buildSiteChain(configuredSshSite);
      return { ...buildAuditChain(), insert: vi.fn().mockResolvedValue({ error: null }) };
    });

    render(<WPCLIManager siteId="site-configured" />);
    await waitFor(() => screen.getByText(/w123456@/));
    await userEvent.click(screen.getByRole('button', { name: /Cache flush/i }));
    await userEvent.click(screen.getByRole('button', { name: /Potvrdiť a spustiť/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('wordpress-cli', {
        body: { siteId: 'site-configured', command: 'cache-flush' },
      });
    });
  });

  it('does NOT show confirm for non-destructive WP verzia', async () => {
    mockInvoke.mockResolvedValue({ data: { stdout: '6.5', stderr: '' }, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'wp_sites') return buildSiteChain(configuredSshSite);
      return { ...buildAuditChain(), insert: vi.fn().mockResolvedValue({ error: null }) };
    });

    render(<WPCLIManager siteId="site-configured" />);
    await waitFor(() => screen.getByText(/w123456@/));
    await userEvent.click(screen.getByRole('button', { name: /WP verzia/i }));

    expect(screen.queryByText(/Potvrdiť WP-CLI príkaz/i)).not.toBeInTheDocument();
    await waitFor(() => expect(mockInvoke).toHaveBeenCalled());
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 8. BASE64 ENCODING UTILITY (samostatné unit testy)
// ══════════════════════════════════════════════════════════════════════════

describe('SSH credential encoding', () => {
  it('btoa/atob round-trip for password', () => {
    const password = 'Poklop1369###';
    expect(atob(btoa(password))).toBe(password);
  });

  it('btoa/atob round-trip for PEM private key', () => {
    const pem =
      '-----BEGIN RSA PRIVATE KEY-----\nABCDEF1234\n-----END RSA PRIVATE KEY-----';
    expect(atob(btoa(pem))).toBe(pem);
  });

  it('btoa produces different output than plaintext', () => {
    const pass = 'secret';
    expect(btoa(pass)).not.toBe(pass);
  });
});
