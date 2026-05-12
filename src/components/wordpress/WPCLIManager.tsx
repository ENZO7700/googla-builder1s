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

  useEffect(() => { loadLogs(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [siteId]);

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

  const grid = useMemo(() => COMMANDS, []);

  return (
    <DashboardCard
      title="🖥️ WP-CLI cez SSH"
      description="Bezpečné, whitelistované príkazy. Vyžaduje SSH konfiguráciu na site (host, user, key/password, wp_path)."
      icon={<Terminal size={16} />}
    >
      <div className="px-6 py-5 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {grid.map(c => (
            <button
              key={c.id}
              disabled={!!running}
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
