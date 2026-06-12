import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Hoisted mocks (vi.mock is hoisted to top, so helpers must use vi.hoisted) ──

const { mockFrom, mockInvoke, mockToastError, mockToastSuccess } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockInvoke: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
}));

const originalConsoleError = console.error;

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const [first] = args;
    if (typeof first === 'string' && first.includes('not wrapped in act(...)')) {
      return;
    }

    originalConsoleError(...(args as Parameters<typeof console.error>));
  });
});

afterAll(() => {
  vi.restoreAllMocks();
});

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

// ── Helpers ───────────────────────────────────────────────────────────────

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};

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
// 1. RENDER & ACCESSIBILITY
// ══════════════════════════════════════════════════════════════════════════

describe('WPCLIManager – render & a11y', () => {
  it('renders the component title', () => {
    renderWithProviders(<WPCLIManager siteId="site-1" />);
    expect(screen.getByText(/WP-CLI cez SSH/i)).toBeInTheDocument();
  });

  it('passes accessibility checks', async () => {
    const { container } = renderWithProviders(<WPCLIManager siteId="site-1" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 15_000);

  it('renders command grid buttons', () => {
    renderWithProviders(<WPCLIManager siteId="site-1" />);
    expect(screen.getByText('WP verzia')).toBeInTheDocument();
    expect(screen.getByText('Plugin list')).toBeInTheDocument();
    expect(screen.getByText('Maintenance ON')).toBeInTheDocument();
  });

  it('renders audit log section with empty state', () => {
    renderWithProviders(<WPCLIManager siteId="site-1" />);
    expect(screen.getByText(/Audit log/i)).toBeInTheDocument();
    expect(screen.getByText(/Žiadne WP-CLI logy/i)).toBeInTheDocument();
  });

  it('shows SSH not configured warning when no SSH host', async () => {
    renderWithProviders(<WPCLIManager siteId="site-1" />);
    await waitFor(() =>
      expect(screen.getByText(/SSH nie je nakonfigurované/i)).toBeInTheDocument(),
    );
  });

  it('disables command buttons when SSH is not configured', async () => {
    renderWithProviders(<WPCLIManager siteId="site-1" />);
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
    renderWithProviders(<WPCLIManager siteId="site-1" />);
    expect(screen.queryByLabelText('SSH Host')).not.toBeInTheDocument();
  });

  it('opens SSH form on toggle click', async () => {
    renderWithProviders(<WPCLIManager siteId="site-1" />);
    await userEvent.click(screen.getByRole('button', { name: /SSH Konfigurácia/i }));
    expect(screen.getByLabelText('SSH Host')).toBeInTheDocument();
    expect(screen.getByLabelText('SSH Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Port')).toBeInTheDocument();
    expect(screen.getByLabelText('Cesta k WordPress')).toBeInTheDocument();
  });

  it('closes SSH form on second toggle click', async () => {
    renderWithProviders(<WPCLIManager siteId="site-1" />);
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
    renderWithProviders(<WPCLIManager siteId="site-1" />);
    await userEvent.click(screen.getByRole('button', { name: /SSH Konfigurácia/i }));
  }

  it('shows password field by default', async () => {
    await openForm();
    expect(screen.getByLabelText('Heslo')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Privátny kľúč/i)).not.toBeInTheDocument();
  });

  it('switches to private key on button click', async () => {
    await openForm();
    const authButtons = screen.getAllByRole('button', { name: /Privátny kľúč/i });
    await userEvent.click(authButtons[0]);
    expect(screen.getByLabelText(/Privátny kľúč \(PEM\)/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Heslo')).not.toBeInTheDocument();
  });

  it('switches back to password', async () => {
    await openForm();
    const keyBtn = screen.getAllByRole('button', { name: /Privátny kľúč/i })[0];
    await userEvent.click(keyBtn);
    const hesloBtn = screen.getAllByRole('button', { name: /^Heslo$/i })[0];
    await userEvent.click(hesloBtn);
    expect(screen.getByLabelText('Heslo')).toBeInTheDocument();
  });

  describe.each([
    { label: 'SSH Host', value: 'myserver.com' },
    { label: 'SSH Username', value: 'w123456' },
    { label: 'Cesta k WordPress', value: '/var/www/html' },
  ])('Field validation: $label', ({ label, value }) => {
    it(`can type "${value}" into ${label} field`, async () => {
      await openForm();
      const input = screen.getByLabelText(label);
      await userEvent.type(input, value);
      expect(input).toHaveValue(value);
    });
  });

  it('can type into Port field', async () => {
    await openForm();
    const input = screen.getByLabelText('Port');
    await userEvent.clear(input);
    await userEvent.type(input, '2222');
    expect(input).toHaveValue(2222);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 4. SAVE BUTTON VALIDATION & KEYBOARD
// ══════════════════════════════════════════════════════════════════════════

describe('WPCLIManager – save button validation & keyboard', () => {
  async function openForm() {
    renderWithProviders(<WPCLIManager siteId="site-1" />);
    await userEvent.click(screen.getByRole('button', { name: /SSH Konfigurácia/i }));
  }

  it('save button disabled when both fields empty', async () => {
    await openForm();
    expect(screen.getByRole('button', { name: /Uložiť SSH nastavenia/i })).toBeDisabled();
  });

  it('save button enabled when host AND username filled', async () => {
    await openForm();
    await userEvent.type(screen.getByLabelText('SSH Host'), 'myserver.com');
    await userEvent.type(screen.getByLabelText('SSH Username'), 'w123456');
    expect(screen.getByRole('button', { name: /Uložiť SSH nastavenia/i })).toBeEnabled();
  });

  it('supports keyboard navigation (Tab)', async () => {
    await openForm();
    const hostInput = screen.getByLabelText('SSH Host');
    hostInput.focus();
    expect(hostInput).toHaveFocus();

    await userEvent.tab();
    expect(screen.getByLabelText('Port')).toHaveFocus();

    await userEvent.tab();
    expect(screen.getByLabelText('SSH Username')).toHaveFocus();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 5. SAVE LOGIC – Payload Validation & Error Handling
// ══════════════════════════════════════════════════════════════════════════

describe('WPCLIManager – SSH save logic', () => {
  it('calls supabase update with exact payload (password)', async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: null });
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn });
    setupMocks(noSshSite, updateFn);

    renderWithProviders(<WPCLIManager siteId="site-42" />);
    await userEvent.click(screen.getByRole('button', { name: /SSH Konfigurácia/i }));

    await userEvent.type(screen.getByLabelText('SSH Host'), 'myhost.com');
    await userEvent.type(screen.getByLabelText('SSH Username'), 'w999');
    await userEvent.type(screen.getByLabelText('Heslo'), 'supersecret');

    await userEvent.click(screen.getByRole('button', { name: /Uložiť SSH nastavenia/i }));

    await waitFor(() => {
      expect(updateFn).toHaveBeenCalledWith({
        ssh_host: 'myhost.com',
        ssh_port: 22,
        ssh_username: 'w999',
        wp_path: null,
        ssh_password_encrypted: btoa('supersecret'),
        ssh_private_key_encrypted: null,
      });
    });
  });

  it('calls supabase update with exact payload (private key)', async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: null });
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn });
    setupMocks(noSshSite, updateFn);

    renderWithProviders(<WPCLIManager siteId="site-42" />);
    await userEvent.click(screen.getByRole('button', { name: /SSH Konfigurácia/i }));
    await userEvent.click(screen.getAllByRole('button', { name: /Privátny kľúč/i })[0]);

    const pem = '-----BEGIN RSA PRIVATE KEY-----\nABC\n-----END RSA PRIVATE KEY-----';
    await userEvent.type(screen.getByLabelText('SSH Host'), 'myhost.com');
    await userEvent.type(screen.getByLabelText('SSH Username'), 'root');
    await userEvent.type(screen.getByLabelText(/Privátny kľúč \(PEM\)/i), pem);

    await userEvent.click(screen.getByRole('button', { name: /Uložiť SSH nastavenia/i }));

    await waitFor(() => {
      expect(updateFn).toHaveBeenCalledWith({
        ssh_host: 'myhost.com',
        ssh_port: 22,
        ssh_username: 'root',
        wp_path: null,
        ssh_password_encrypted: null,
        ssh_private_key_encrypted: btoa(pem),
      });
    });
  });

  it('handles network timeout gracefully', async () => {
    const eqFn = vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ error: null }), 100)));
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn });
    setupMocks(noSshSite, updateFn);

    renderWithProviders(<WPCLIManager siteId="site-1" />);
    await userEvent.click(screen.getByRole('button', { name: /SSH Konfigurácia/i }));
    await userEvent.type(screen.getByLabelText('SSH Host'), 'host.com');
    await userEvent.type(screen.getByLabelText('SSH Username'), 'user');
    
    await userEvent.click(screen.getByRole('button', { name: /Uložiť SSH nastavenia/i }));

    await waitFor(() => {
      expect(updateFn).toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalled();
    });
  });

  it('prevents double submission', async () => {
    const eqFn = vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ error: null }), 50)));
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn });
    setupMocks(noSshSite, updateFn);

    renderWithProviders(<WPCLIManager siteId="site-1" />);
    await userEvent.click(screen.getByRole('button', { name: /SSH Konfigurácia/i }));
    await userEvent.type(screen.getByLabelText('SSH Host'), 'host.com');
    await userEvent.type(screen.getByLabelText('SSH Username'), 'user');
    
    const saveBtn = screen.getByRole('button', { name: /Uložiť SSH nastavenia/i });
    // Click twice rapidly
    await userEvent.click(saveBtn);
    await userEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateFn).toHaveBeenCalledTimes(1);
    });
  });

  it('submits form on Enter key in input field', async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: null });
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn });
    setupMocks(noSshSite, updateFn);

    renderWithProviders(<WPCLIManager siteId="site-1" />);
    await userEvent.click(screen.getByRole('button', { name: /SSH Konfigurácia/i }));
    await userEvent.type(screen.getByLabelText('SSH Host'), 'myhost.com');
    await userEvent.type(screen.getByLabelText('SSH Username'), 'user');
    await userEvent.type(screen.getByLabelText('SSH Username'), '{enter}');

    await waitFor(() => {
      expect(updateFn).toHaveBeenCalled();
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 6. EXISTING SSH CONFIG LOADED FROM SUPABASE
// ══════════════════════════════════════════════════════════════════════════

describe('WPCLIManager – existing SSH config display', () => {
  beforeEach(() => setupMocks(configuredSshSite));

  it('shows configured host badge in toggle button', async () => {
    renderWithProviders(<WPCLIManager siteId="site-configured" />);
    await waitFor(() =>
      expect(screen.getByText(/w123456@test\.vps\.wbsprt\.com/)).toBeInTheDocument(),
    );
  });

  it('shows "Heslo uložené" badge when password is set', async () => {
    renderWithProviders(<WPCLIManager siteId="site-configured" />);
    await waitFor(() => expect(screen.getByText(/Heslo uložené/i)).toBeInTheDocument());
  });

  it('pre-fills host and username fields with existing values', async () => {
    renderWithProviders(<WPCLIManager siteId="site-configured" />);
    await waitFor(() => screen.getByText(/w123456@test\.vps\.wbsprt\.com/));
    await userEvent.click(screen.getByRole('button', { name: /SSH Konfigurácia/i }));
    expect(screen.getByLabelText('SSH Host')).toHaveValue('test.vps.wbsprt.com');
    expect(screen.getByLabelText('SSH Username')).toHaveValue('w123456');
    expect(screen.getByLabelText('Cesta k WordPress')).toHaveValue('/data/web/test.sk/web/');
  });

  it('does NOT show SSH not configured warning', async () => {
    renderWithProviders(<WPCLIManager siteId="site-configured" />);
    await waitFor(() => screen.getByText(/w123456@test\.vps\.wbsprt\.com/));
    expect(screen.queryByText(/SSH nie je nakonfigurované/i)).not.toBeInTheDocument();
  });

  it('enables command buttons when SSH is configured', async () => {
    renderWithProviders(<WPCLIManager siteId="site-configured" />);
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
    renderWithProviders(<WPCLIManager siteId="site-configured" />);
    await waitFor(() => screen.getByText(/w123456@/));
    await userEvent.click(screen.getByRole('button', { name: /Cache flush/i }));
    expect(screen.getByText(/Potvrdiť WP-CLI príkaz/i)).toBeInTheDocument();
    expect(screen.getByText(/cache-flush/i)).toBeInTheDocument();
  });

  it('dismisses confirm dialog on Zrušiť', async () => {
    renderWithProviders(<WPCLIManager siteId="site-configured" />);
    await waitFor(() => screen.getByText(/w123456@/));
    await userEvent.click(screen.getByRole('button', { name: /Cache flush/i }));
    await userEvent.click(screen.getByRole('button', { name: /Zrušiť/i }));
    expect(screen.queryByText(/Potvrdiť WP-CLI príkaz/i)).not.toBeInTheDocument();
  });

  it('invokes wordpress-cli edge function with correct payload', async () => {
    mockInvoke.mockResolvedValue({ data: { stdout: 'Cache cleared', stderr: '' }, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'wp_sites') return buildSiteChain(configuredSshSite);
      return { ...buildAuditChain(), insert: vi.fn().mockResolvedValue({ error: null }) };
    });

    renderWithProviders(<WPCLIManager siteId="site-configured" />);
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

    renderWithProviders(<WPCLIManager siteId="site-configured" />);
    await waitFor(() => screen.getByText(/w123456@/));
    await userEvent.click(screen.getByRole('button', { name: /WP verzia/i }));

    expect(screen.queryByText(/Potvrdiť WP-CLI príkaz/i)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('wordpress-cli', {
        body: { siteId: 'site-configured', command: 'core-version' },
      });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 8. BASE64 ENCODING UTILITY
// ══════════════════════════════════════════════════════════════════════════

describe('SSH credential encoding', () => {
  it('btoa produces valid base64 matching actual data', () => {
    const password = 'test';
    const encoded = btoa(password);
    expect(encoded).toBe('dGVzdA==');
    expect(atob(encoded)).toBe(password);
  });

  it('btoa handles PEM kľúč correctly', () => {
    const pem = 'KEY';
    expect(btoa(pem)).toBe('S0VZ');
  });
});
