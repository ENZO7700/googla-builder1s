import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardCard from '@/components/dashboard/DashboardCard';
import { Terminal, Play, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const COMMANDS: { id: string; label: string; description: string }[] = [
  { id: 'core-version',  label: 'WP verzia',          description: 'wp core version' },
  { id: 'core-check',    label: 'Kontrola updatov',   description: 'wp core check-update' },
  { id: 'cron-status',   label: 'Cron events',        description: 'wp cron event list' },
  { id: 'cron-run-due',  label: 'Spustiť due cron',   description: 'wp cron event run --due-now' },
  { id: 'cache-flush',   label: 'Cache flush',        description: 'wp cache flush' },
  { id: 'rewrite-flush', label: 'Rewrite flush',      description: 'wp rewrite flush' },
  { id: 'transient-del', label: 'Zmazať transients',  description: 'wp transient delete --all' },
  { id: 'plugin-status', label: 'Plugin updaty',      description: 'wp plugin status' },
  { id: 'plugin-list',   label: 'Plugin list',        description: 'wp plugin list' },
  { id: 'theme-list',    label: 'Theme list',         description: 'wp theme list' },
  { id: 'db-size',       label: 'DB veľkosť',         description: 'wp db size --tables' },
  { id: 'maint-on',      label: 'Maintenance ON',     description: 'wp maintenance-mode activate' },
  { id: 'maint-off',     label: 'Maintenance OFF',    description: 'wp maintenance-mode deactivate' },
];

interface AuditRow {
  id: string;
  action: string;
  status: string | null;
  error_message: string | null;
  created_at: string;
  details: Record<string, unknown> | null;
}

export default function WPCLIManager({ siteId }: { siteId: string }) {
  const [running, setRunning] = useState<string | null>(null);
  const [output, setOutput] = useState<string>('');
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [sshReady, setSshReady] = useState<boolean | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [savingSsh, setSavingSsh] = useState(false);
  const [authMode, setAuthMode] = useState<'password' | 'key'>('password');
  const [sshForm, setSshForm] = useState({
    ssh_host: '',
    ssh_port: 22,
    ssh_username: '',
    ssh_password: '',
    ssh_private_key: '',
    wp_path: '',
  });

  const checkSsh = async () => {
    const { data } = await supabase
      .from('wp_sites')
      .select('ssh_host, ssh_port, ssh_username, ssh_password_encrypted, ssh_private_key_encrypted, wp_path')
      .eq('id', siteId)
      .maybeSingle();
    const ok = !!(data?.ssh_host && data?.ssh_username && (data?.ssh_password_encrypted || data?.ssh_private_key_encrypted));
    setSshReady(ok);
    setSshForm(f => ({
      ...f,
      ssh_host: data?.ssh_host ?? '',
      ssh_port: data?.ssh_port ?? 22,
      ssh_username: data?.ssh_username ?? '',
      wp_path: data?.wp_path ?? '',
    }));
  };

  const saveSsh = async () => {
    if (!sshForm.ssh_host || !sshForm.ssh_username) {
      toast.error('Vyplňte host a username');
      return;
    }
    if (authMode === 'password' && !sshForm.ssh_password && !sshReady) {
      toast.error('Vyplňte heslo');
      return;
    }
    if (authMode === 'key' && !sshForm.ssh_private_key && !sshReady) {
      toast.error('Vložte privátny kľúč');
      return;
    }
    setSavingSsh(true);
    try {
      const payload: Record<string, unknown> = {
        id: siteId,
        ssh_host: sshForm.ssh_host,
        ssh_port: Number(sshForm.ssh_port) || 22,
        ssh_username: sshForm.ssh_username,
        wp_path: sshForm.wp_path || undefined,
      };
      if (authMode === 'password' && sshForm.ssh_password) payload.ssh_password = sshForm.ssh_password;
      if (authMode === 'key' && sshForm.ssh_private_key) payload.ssh_private_key = sshForm.ssh_private_key;

      const { data, error } = await supabase.functions.invoke('wp-sites-create', { body: payload });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast.success('SSH uložené');
      setSshForm(f => ({ ...f, ssh_password: '', ssh_private_key: '' }));
      setShowForm(false);
      await checkSsh();
    } catch (e) {
      toast.error('Chyba ukladania', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSavingSsh(false);
    }
  };

  const loadLogs = async () => {
    setLoadingLogs(true);
    const { data, error } = await supabase
      .from('wp_audit_log')
      .select('id, action, status, error_message, created_at, details')
      .eq('site_id', siteId)
      .like('action', 'wpcli:%')
      .order('created_at', { ascending: false })
      .limit(30);
    setLoadingLogs(false);
    if (error) { toast.error('Nepodarilo sa načítať logy'); return; }
    setLogs((data ?? []) as AuditRow[]);
  };

  useEffect(() => { loadLogs(); checkSsh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [siteId]);

  const run = async (command: string) => {
    if (sshReady === false) {
      toast.error('SSH nie je nakonfigurované', { description: 'Doplňte SSH host, username a heslo/kľúč pre túto site.' });
      return;
    }
    setRunning(command);
    setOutput('');
    try {
      const { data, error } = await supabase.functions.invoke('wordpress-cli', {
        body: { siteId, command },
      });
      if (error) throw error;
      const stdout = (data as { stdout?: string }).stdout ?? '';
      const stderr = (data as { stderr?: string }).stderr ?? '';
      setOutput(stdout + (stderr ? `\n--- stderr ---\n${stderr}` : ''));
      toast.success(`OK: ${command}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setOutput(`Error: ${msg}`);
      toast.error('Chyba WP-CLI', { description: msg });
    } finally {
      setRunning(null);
      loadLogs();
    }
  };

  const grid = useMemo(() => COMMANDS, []);

  return (
    <DashboardCard
      title="🖥️ WP-CLI cez SSH"
      description="Bezpečné, whitelistované príkazy. Vyžaduje SSH konfiguráciu na site (host, user, key/password, wp_path)."
      icon={<Terminal size={16} />}
    >
      <div className="px-6 py-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            SSH stav: {sshReady === null ? '…' : sshReady ? <span className="text-green-500">nakonfigurované</span> : <span className="text-amber-400">nenastavené</span>}
          </div>
          <button
            onClick={() => setShowForm(v => !v)}
            className="text-xs px-3 py-1.5 rounded-md border border-border bg-muted/40 hover:bg-muted"
          >
            {showForm ? 'Zavrieť' : sshReady ? 'Upraviť SSH' : 'Nastaviť SSH'}
          </button>
        </div>

        {showForm && (
          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="text-xs space-y-1 md:col-span-2">
                <span className="text-muted-foreground">SSH host</span>
                <input
                  type="text"
                  value={sshForm.ssh_host}
                  onChange={e => setSshForm(f => ({ ...f, ssh_host: e.target.value }))}
                  placeholder="ssh.example.com"
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm"
                />
              </label>
              <label className="text-xs space-y-1">
                <span className="text-muted-foreground">Port</span>
                <input
                  type="number"
                  value={sshForm.ssh_port}
                  onChange={e => setSshForm(f => ({ ...f, ssh_port: Number(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm"
                />
              </label>
              <label className="text-xs space-y-1">
                <span className="text-muted-foreground">SSH username</span>
                <input
                  type="text"
                  value={sshForm.ssh_username}
                  onChange={e => setSshForm(f => ({ ...f, ssh_username: e.target.value }))}
                  placeholder="root"
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm"
                />
              </label>
              <label className="text-xs space-y-1 md:col-span-2">
                <span className="text-muted-foreground">WordPress cesta (wp_path)</span>
                <input
                  type="text"
                  value={sshForm.wp_path}
                  onChange={e => setSshForm(f => ({ ...f, wp_path: e.target.value }))}
                  placeholder="/var/www/html"
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm"
                />
              </label>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Autentifikácia:</span>
              <button
                type="button"
                onClick={() => setAuthMode('password')}
                className={`px-2 py-1 rounded border ${authMode === 'password' ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}
              >
                Heslo
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('key')}
                className={`px-2 py-1 rounded border ${authMode === 'key' ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}
              >
                Privátny kľúč
              </button>
            </div>

            {authMode === 'password' ? (
              <label className="text-xs space-y-1 block">
                <span className="text-muted-foreground">SSH heslo {sshReady && <em>(nechajte prázdne, ak nemeníte)</em>}</span>
                <input
                  type="password"
                  value={sshForm.ssh_password}
                  onChange={e => setSshForm(f => ({ ...f, ssh_password: e.target.value }))}
                  autoComplete="new-password"
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm"
                />
              </label>
            ) : (
              <label className="text-xs space-y-1 block">
                <span className="text-muted-foreground">Privátny kľúč (PEM) {sshReady && <em>(nechajte prázdne, ak nemeníte)</em>}</span>
                <textarea
                  value={sshForm.ssh_private_key}
                  onChange={e => setSshForm(f => ({ ...f, ssh_private_key: e.target.value }))}
                  rows={6}
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-xs font-mono"
                />
              </label>
            )}

            <p className="text-[11px] text-muted-foreground">
              Citlivé údaje sa šifrujú AES-256-GCM serverovo a nikdy sa nevracajú späť do prehliadača.
            </p>

            <div className="flex gap-2">
              <button
                onClick={saveSsh}
                disabled={savingSsh}
                className="text-xs px-4 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
              >
                {savingSsh ? 'Ukladám…' : 'Uložiť SSH'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="text-xs px-4 py-2 rounded-md border border-border"
              >
                Zrušiť
              </button>
            </div>
          </div>
        )}

        {sshReady === false && !showForm && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-200 text-xs px-3 py-2">
            SSH pre túto site nie je nastavené. Kliknite na <strong>Nastaviť SSH</strong> a vyplňte prístupy.
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {grid.map(c => (
            <button
              key={c.id}
              disabled={!!running || sshReady === false}
              onClick={() => run(c.id)}
              className="flex flex-col items-start gap-1 p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted text-left disabled:opacity-50 transition"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                {running === c.id ? (
                  <RefreshCw size={12} className="animate-spin" />
                ) : (
                  <Play size={12} />
                )}
                {c.label}
              </span>
              <code className="text-[10px] text-muted-foreground">{c.description}</code>
            </button>
          ))}
        </div>

        {output && (
          <pre className="text-[11px] bg-zinc-950 text-zinc-100 p-4 rounded-lg overflow-auto max-h-80 whitespace-pre-wrap font-mono">
            {output}
          </pre>
        )}

        <div className="pt-3 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">Audit log (posledných 30)</h3>
            <button onClick={loadLogs} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <RefreshCw size={11} className={loadingLogs ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
          <div className="space-y-1 max-h-72 overflow-auto">
            {logs.length === 0 && (
              <div className="text-xs text-muted-foreground italic py-3">Žiadne WP-CLI logy.</div>
            )}
            {logs.map(l => {
              const det = l.details as { duration_ms?: number; exit_code?: number | null } | null;
              return (
                <div key={l.id} className="flex items-center justify-between gap-2 text-xs px-3 py-2 rounded border border-border">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${l.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                    <code className="font-mono truncate">{l.action.replace('wpcli:', '')}</code>
                    {det?.exit_code != null && (
                      <span className="text-muted-foreground">exit {det.exit_code}</span>
                    )}
                    {det?.duration_ms != null && (
                      <span className="text-muted-foreground">{det.duration_ms}ms</span>
                    )}
                    {l.error_message && (
                      <span className="text-red-500 truncate">{l.error_message}</span>
                    )}
                  </div>
                  <span className="text-muted-foreground shrink-0">{new Date(l.created_at).toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardCard>
  );
}
