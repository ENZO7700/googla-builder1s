/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardCard from '@/components/dashboard/DashboardCard';
import { Terminal, Play, RefreshCw, Settings2, ChevronDown, ChevronUp, Save, KeyRound, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

const DESTRUCTIVE_COMMANDS = new Set([
  'cron-run-due',
  'cache-flush',
  'rewrite-flush',
  'transient-del',
  'maint-on',
  'maint-off',
]);

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

interface SshConfig {
  ssh_host: string | null;
  ssh_port: number | null;
  ssh_username: string | null;
  ssh_password_encrypted: string | null;
  ssh_private_key_encrypted: string | null;
  wp_path: string | null;
}

export default function WPCLIManager({ siteId }: { siteId: string }) {
  const [running, setRunning] = useState<string | null>(null);
  const [output, setOutput] = useState<string>('');
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);

  // SSH config state
  const [showSshForm, setShowSshForm] = useState(false);
  const [existingSshConfig, setExistingSshConfig] = useState<SshConfig | null>(null);
  const [sshHost, setSshHost] = useState('');
  const [sshPort, setSshPort] = useState('22');
  const [sshUsername, setSshUsername] = useState('');
  const [authMethod, setAuthMethod] = useState<'password' | 'key'>('password');
  const [sshPassword, setSshPassword] = useState('');
  const [sshPrivateKey, setSshPrivateKey] = useState('');
  const [wpPath, setWpPath] = useState('');
  const [savingSSH, setSavingSSH] = useState(false);

  const loadSshConfig = async () => {
    const { data, error } = await supabase
      .from('wp_sites')
      .select('ssh_host, ssh_port, ssh_username, ssh_password_encrypted, ssh_private_key_encrypted, wp_path')
      .eq('id', siteId)
      .single();
    if (error || !data) return;
    const cfg = data as SshConfig;
    setExistingSshConfig(cfg);
    setSshHost(cfg.ssh_host ?? '');
    setSshPort(String(cfg.ssh_port ?? 22));
    setSshUsername(cfg.ssh_username ?? '');
    setWpPath(cfg.wp_path ?? '');
    // Detect which method was used
    if (cfg.ssh_private_key_encrypted) {
      setAuthMethod('key');
    } else {
      setAuthMethod('password');
    }
    // Never pre-fill password/key fields – keep them blank
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

  useEffect(() => {
    loadLogs();
    void loadSshConfig();
  }, [siteId]);

  const requestRun = (command: string) => {
    if (DESTRUCTIVE_COMMANDS.has(command)) {
      setPendingCommand(command);
      return;
    }
    void run(command);
  };

  const run = async (command: string) => {
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

  const handleSaveSSH = async () => {
    if (!sshHost.trim() || !sshUsername.trim()) {
      toast.error('SSH Host a Username sú povinné');
      return;
    }

    setSavingSSH(true);
    try {
      const updates: Record<string, unknown> = {
        ssh_host: sshHost.trim() || null,
        ssh_port: parseInt(sshPort, 10) || 22,
        ssh_username: sshUsername.trim() || null,
        wp_path: wpPath.trim() || null,
      };

      // Only update credential fields if the user entered something new
      if (authMethod === 'password') {
        if (sshPassword.trim()) {
          updates.ssh_password_encrypted = btoa(sshPassword);
          updates.ssh_private_key_encrypted = null; // clear old key if switching
        }
      } else {
        if (sshPrivateKey.trim()) {
          updates.ssh_private_key_encrypted = btoa(sshPrivateKey);
          updates.ssh_password_encrypted = null; // clear old password if switching
        }
      }

      const { error } = await supabase
        .from('wp_sites')
        .update(updates)
        .eq('id', siteId);

      if (error) throw error;

      // Clear sensitive fields from form after save
      setSshPassword('');
      setSshPrivateKey('');
      await loadSshConfig();
      toast.success('SSH nastavenia uložené');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Chyba pri ukladaní SSH', { description: msg });
    } finally {
      setSavingSSH(false);
    }
  };

  const hasExistingSSH = Boolean(existingSshConfig?.ssh_host);
  const hasExistingCred = Boolean(
    existingSshConfig?.ssh_password_encrypted || existingSshConfig?.ssh_private_key_encrypted
  );

  const grid = useMemo(() => COMMANDS, []);

  return (
    <DashboardCard
      title="🖥️ WP-CLI cez SSH"
      description="Bezpečné, whitelistované príkazy. Vyžaduje SSH konfiguráciu na site (host, user, key/password, wp_path)."
      icon={<Terminal size={16} />}
    >
      <div className="px-6 py-5 space-y-4">

        {/* SSH Configuration Section */}
        <div className="rounded-xl border border-border bg-muted/20">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/40 transition rounded-xl"
            onClick={() => setShowSshForm(v => !v)}
          >
            <span className="flex items-center gap-2">
              <Settings2 size={14} className="text-primary" />
              SSH Konfigurácia
              {hasExistingSSH && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 border border-green-500/30 px-2 py-0.5 text-[10px] font-medium text-green-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                  {existingSshConfig?.ssh_username}@{existingSshConfig?.ssh_host}:{existingSshConfig?.ssh_port ?? 22}
                </span>
              )}
              {hasExistingCred && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                  <Lock size={10} />
                  {existingSshConfig?.ssh_private_key_encrypted ? 'Kľúč' : 'Heslo'} uložené
                </span>
              )}
            </span>
            {showSshForm ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {showSshForm && (
            <div className="px-4 pb-4 pt-1 space-y-4 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Údaje sú zakódované pred uložením. Ak necháte pole hesla/kľúča prázdne, existujúce prihlásenie zostane zachované.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* SSH Host */}
                <div className="space-y-1.5">
                  <Label htmlFor="ssh-host" className="text-xs">SSH Host</Label>
                  <Input
                    id="ssh-host"
                    value={sshHost}
                    onChange={e => setSshHost(e.target.value)}
                    placeholder="example.com alebo 123.45.67.89"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>

                {/* SSH Port */}
                <div className="space-y-1.5">
                  <Label htmlFor="ssh-port" className="text-xs">Port</Label>
                  <Input
                    id="ssh-port"
                    value={sshPort}
                    onChange={e => setSshPort(e.target.value)}
                    placeholder="22"
                    type="number"
                    min={1}
                    max={65535}
                  />
                </div>

                {/* SSH Username */}
                <div className="space-y-1.5">
                  <Label htmlFor="ssh-username" className="text-xs">SSH Username</Label>
                  <Input
                    id="ssh-username"
                    value={sshUsername}
                    onChange={e => setSshUsername(e.target.value)}
                    placeholder="root alebo deploy"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>

                {/* WP Path */}
                <div className="space-y-1.5">
                  <Label htmlFor="wp-path" className="text-xs">Cesta k WordPress</Label>
                  <Input
                    id="wp-path"
                    value={wpPath}
                    onChange={e => setWpPath(e.target.value)}
                    placeholder="/var/www/html alebo /home/user/public_html"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              </div>

              {/* Auth method toggle */}
              <div className="space-y-2">
                <Label className="text-xs">Metóda overenia</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAuthMethod('password')}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                      authMethod === 'password'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted/40'
                    }`}
                  >
                    <Lock size={12} />
                    Heslo
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMethod('key')}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                      authMethod === 'key'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted/40'
                    }`}
                  >
                    <KeyRound size={12} />
                    Privátny kľúč
                  </button>
                </div>
              </div>

              {/* Password or Private Key input */}
              {authMethod === 'password' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="ssh-password" className="text-xs">
                    Heslo
                    {existingSshConfig?.ssh_password_encrypted && (
                      <span className="ml-2 text-muted-foreground font-normal">(prázdne = zachovať existujúce)</span>
                    )}
                  </Label>
                  <Input
                    id="ssh-password"
                    type="password"
                    value={sshPassword}
                    onChange={e => setSshPassword(e.target.value)}
                    placeholder={existingSshConfig?.ssh_password_encrypted ? '••••••••' : 'SSH heslo'}
                    autoComplete="off"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="ssh-private-key" className="text-xs">
                    Privátny kľúč (PEM)
                    {existingSshConfig?.ssh_private_key_encrypted && (
                      <span className="ml-2 text-muted-foreground font-normal">(prázdne = zachovať existujúci)</span>
                    )}
                  </Label>
                  <Textarea
                    id="ssh-private-key"
                    value={sshPrivateKey}
                    onChange={e => setSshPrivateKey(e.target.value)}
                    placeholder={existingSshConfig?.ssh_private_key_encrypted
                      ? '••••••••  (kľúč je uložený, vložte nový len ak chcete zmeniť)'
                      : '-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----'}
                    className="font-mono text-[11px] min-h-[120px]"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              )}

              {/* Save button */}
              <Button
                onClick={handleSaveSSH}
                disabled={savingSSH || !sshHost.trim() || !sshUsername.trim()}
                className="w-full rounded-lg"
                size="sm"
              >
                {savingSSH ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <Save size={13} />
                )}
                Uložiť SSH nastavenia
              </Button>
            </div>
          )}
        </div>

        {/* No SSH config warning */}
        {!hasExistingSSH && (
          <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-xs text-muted-foreground">
            ⚠️ SSH nie je nakonfigurované pre tento web. Vyplňte SSH nastavenia vyššie, aby mohli príkazy fungovať.
          </div>
        )}

        {/* Command Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {grid.map(c => (
            <button
              key={c.id}
              disabled={!!running || !hasExistingSSH}
              onClick={() => requestRun(c.id)}
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

        {pendingCommand && (
          <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
            <p className="text-sm font-medium text-foreground">
              Potvrdiť WP-CLI príkaz: {pendingCommand}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tento príkaz môže ovplyvniť cache, rewrite rules, maintenance režim alebo cron na produkcii.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  const cmd = pendingCommand;
                  setPendingCommand(null);
                  void run(cmd);
                }}
                className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
              >
                Potvrdiť a spustiť
              </button>
              <button
                onClick={() => setPendingCommand(null)}
                className="rounded-full border border-border px-4 py-2 text-xs font-medium"
              >
                Zrušiť
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardCard>
  );
}
