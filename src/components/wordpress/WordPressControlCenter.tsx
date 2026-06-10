import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CloudCog,
  KeyRound,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Terminal,
} from 'lucide-react';
import DashboardCard from '@/components/dashboard/DashboardCard';
import StatusBadge from '@/components/dashboard/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveValidatedWordPressConnection } from '@/lib/wordpress/connectionService';
import {
  testWordPressApplicationPassword,
  type AuthenticatedWpConnectionResult,
} from '@/lib/wordpress/publicWordPressApi';
import { toast } from 'sonner';

interface WPSite {
  id: string;
  label: string;
  base_url: string;
  site_type: 'com' | 'self';
}

interface CapabilityItem {
  name: string;
  detail: string;
  status: 'ready' | 'auth' | 'edge' | 'confirm';
}

interface CapabilityGroup {
  title: string;
  description: string;
  icon: JSX.Element;
  items: CapabilityItem[];
}

const CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    title: 'Funguje verejne',
    description: 'Bez hesla čítame bezpečné REST dáta.',
    icon: <CheckCircle2 size={16} />,
    items: [
      { name: 'Posts, pages, media', detail: 'GET cez /wp/v2 funguje priamo z browsera.', status: 'ready' },
      { name: 'Comments, users, types', detail: 'Read-only endpointy vracajú reálne dáta.', status: 'ready' },
      { name: 'Custom namespace', detail: '/webdo24h/v1 odpovedá a je pripravený na ďalšie mapovanie.', status: 'ready' },
    ],
  },
  {
    title: 'Po Application Password',
    description: 'Overenie účtu a bezpečné admin čítanie.',
    icon: <KeyRound size={16} />,
    items: [
      { name: '/users/me', detail: 'Testuje username + Application Password bez uloženia secretu.', status: 'auth' },
      { name: 'Settings a plugins', detail: 'Čítanie je dostupné až po WP admin oprávnení.', status: 'auth' },
      { name: 'Upload media', detail: 'Service už má uploadMedia cez wordpress-proxy.', status: 'auth' },
    ],
  },
  {
    title: 'Cez Supabase Edge Function',
    description: 'Serverová vrstva pre uložené site pripojenia.',
    icon: <CloudCog size={16} />,
    items: [
      { name: 'wordpress-proxy', detail: 'GET/POST/PATCH/DELETE do /wp/v2 s audit logom.', status: 'edge' },
      { name: 'wordpress-sync', detail: 'Sync about/service/reference/news z databázy do WordPressu.', status: 'edge' },
      { name: 'wordpress-cli', detail: 'Whitelist WP-CLI príkazov cez SSH, nie voľný shell.', status: 'edge' },
    ],
  },
  {
    title: 'Rizikové akcie (s potvrdením)',
    description: 'Dostupné v záložke Admin a WP-CLI po explicitnom confirm dialógu.',
    icon: <LockKeyhole size={16} />,
    items: [
      { name: 'Delete post', detail: 'Záložka Admin → zmazanie príspevku cez wordpress-proxy.', status: 'confirm' },
      { name: 'Update settings', detail: 'Záložka Admin → PATCH nastavení webu (title, popis, posts_per_page).', status: 'confirm' },
      { name: 'Plugin activate/deactivate', detail: 'Záložka Admin → prepínanie pluginov s potvrdením.', status: 'confirm' },
      { name: 'WP-CLI maintenance/cache', detail: 'Záložka WP-CLI → destructive príkazy vyžadujú confirm.', status: 'confirm' },
    ],
  },
];

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? 'qytsiddrksybwpqldjfj';
const DEPLOYMENT_STEPS = [
  {
    label: 'Secret pre šifrovanie',
    status: 'required',
    command: `supabase secrets set WORDPRESS_CREDENTIALS_KEY="<aspon-24-znakovy-random-secret>" --project-ref ${SUPABASE_PROJECT_ID}`,
  },
  {
    label: 'Connection endpoint',
    status: 'deploy',
    command: `supabase functions deploy wordpress-connection --project-ref ${SUPABASE_PROJECT_ID}`,
  },
  {
    label: 'Proxy + sync s dešifrovaním',
    status: 'deploy',
    command: `supabase functions deploy wordpress-proxy --project-ref ${SUPABASE_PROJECT_ID}`,
  },
  {
    label: 'Content sync',
    status: 'deploy',
    command: `supabase functions deploy wordpress-sync --project-ref ${SUPABASE_PROJECT_ID}`,
  },
  {
    label: 'WP-CLI whitelist',
    status: 'optional',
    command: `supabase functions deploy wordpress-cli --project-ref ${SUPABASE_PROJECT_ID}`,
  },
] as const;

export default function WordPressControlCenter({
  site,
  isLocalDemo,
  onSaved,
}: {
  site: WPSite;
  isLocalDemo: boolean;
  onSaved?: () => void;
}) {
  const [baseUrl, setBaseUrl] = useState(site.base_url);
  const [username, setUsername] = useState('');
  const [applicationPassword, setApplicationPassword] = useState('');
  const [result, setResult] = useState<AuthenticatedWpConnectionResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    setBaseUrl(site.base_url);
    setResult(null);
    setUsername('');
    setApplicationPassword('');
    setSaveMessage(null);
  }, [site.base_url, site.id]);

  const canTest = useMemo(
    () => baseUrl.trim() && username.trim() && applicationPassword.trim() && !testing,
    [applicationPassword, baseUrl, testing, username],
  );
  const canSave = Boolean(result?.ok && !isLocalDemo && !saving && applicationPassword.trim());

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTesting(true);
    setResult(null);
    setSaveMessage(null);
    try {
      const nextResult = await testWordPressApplicationPassword({
        baseUrl,
        username,
        applicationPassword,
      });
      setResult(nextResult);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!result?.ok) return;

    setSaving(true);
    setSaveMessage(null);
    try {
      await saveValidatedWordPressConnection({
        siteId: isLocalDemo ? undefined : site.id,
        label: site.label,
        baseUrl,
        username,
        applicationPassword,
      });
      setApplicationPassword('');
      setSaveMessage('Pripojenie je uložené v Supabase. Application Password bol vymazaný z formulára.');
      onSaved?.();
      toast.success('WordPress pripojenie uložené');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nepodarilo sa uložiť WordPress pripojenie.';
      setSaveMessage(message);
      toast.error('Uloženie zlyhalo', { description: message });
    } finally {
      setSaving(false);
    }
  };

  const resetSensitiveFields = () => {
    setBaseUrl(site.base_url);
    setUsername('');
    setApplicationPassword('');
    setResult(null);
    setSaveMessage(null);
  };

  return (
    <DashboardCard
      title="WordPress Control Center"
      description="Mapa toho, čo už beží, čo potrebuje prihlasovacie údaje a čo ostáva bezpečne zamknuté."
      icon={<ShieldCheck size={16} />}
      actions={
        <div className="flex flex-wrap justify-end gap-2">
          <StatusBadge tone="success" label="Public REST OK" />
          <StatusBadge tone={isLocalDemo ? 'warning' : 'info'} label={isLocalDemo ? 'Local only' : 'Supabase mode'} />
        </div>
      }
    >
      <div className="grid gap-6 p-5 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {CAPABILITY_GROUPS.map(group => (
              <div key={group.title} className="rounded-2xl border border-border bg-background/60 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full border border-border bg-card p-2 text-primary">
                    {group.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{group.description}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {group.items.map(item => (
                    <div key={`${group.title}-${item.name}`} className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-card/60 px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground">{item.name}</div>
                        <div className="mt-0.5 text-xs leading-5 text-muted-foreground">{item.detail}</div>
                      </div>
                      <CapabilityBadge status={item.status} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-background/70 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full border border-border bg-card p-2 text-primary">
              <KeyRound size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">Safe Connection Setup</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Testuje iba `/wp/v2/users/me`. Údaje sa neukladajú, neposielajú do Supabase a neobjavia sa v konzole.
              </p>
            </div>
          </div>

          <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="wp-url" className="text-xs">WordPress URL</Label>
              <Input
                id="wp-url"
                value={baseUrl}
                onChange={event => {
                  setBaseUrl(event.target.value);
                  setResult(null);
                }}
                placeholder="https://example.com"
                autoComplete="url"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wp-username" className="text-xs">Username</Label>
              <Input
                id="wp-username"
                value={username}
                onChange={event => {
                  setUsername(event.target.value);
                  setResult(null);
                }}
                placeholder="wp-admin-user"
                autoComplete="username"
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wp-app-password" className="text-xs">Application Password</Label>
              <Input
                id="wp-app-password"
                type="password"
                value={applicationPassword}
                onChange={event => {
                  setApplicationPassword(event.target.value);
                  setResult(null);
                }}
                placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="submit" disabled={!canTest} className="rounded-full">
                {testing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Test connection
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleSave}
                disabled={!canSave}
                className="rounded-full"
                title={isLocalDemo ? 'Lokálny demo režim nemá reálnu Supabase session.' : 'Uložiť validované pripojenie'}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                Uložiť do Supabase
              </Button>
              <Button type="button" variant="outline" onClick={resetSensitiveFields} className="rounded-full">
                Vymazať údaje
              </Button>
            </div>
          </form>

          <ConnectionResult result={result} />
          {saveMessage && (
            <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
              {saveMessage}
            </div>
          )}

          <div className="mt-4 rounded-xl border border-warning/20 bg-warning/10 p-3 text-xs leading-5 text-muted-foreground">
            <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
              <AlertTriangle size={13} className="text-warning" />
              Bezpečný ďalší krok
            </div>
            Po úspešnom teste vie Supabase uložiť pripojenie cez `wordpress-connection`. Rizikové write akcie sú v záložke Admin s confirm dialógom.
          </div>

          <DeploymentReadiness isLocalDemo={isLocalDemo} />
        </section>
      </div>
    </DashboardCard>
  );
}

function CapabilityBadge({ status }: { status: CapabilityItem['status'] }) {
  if (status === 'ready') return <StatusBadge tone="success" label="ready" />;
  if (status === 'auth') return <StatusBadge tone="warning" label="needs auth" />;
  if (status === 'edge') return <StatusBadge tone="info" label="edge" />;
  return <StatusBadge tone="warning" label="confirm" />;
}

function DeploymentReadiness({ isLocalDemo }: { isLocalDemo: boolean }) {
  return (
    <div className="mt-4 rounded-2xl border border-border bg-card/70 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-full border border-border bg-background p-2 text-primary">
          <Terminal size={15} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Deploy readiness</h3>
            <StatusBadge tone={isLocalDemo ? 'warning' : 'info'} label={isLocalDemo ? 'needs Supabase auth' : 'ready to save'} />
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Toto je serverová časť potrebná na bezpečné uloženie Application Password. Reálny secret sem nikdy nepíšeme.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {DEPLOYMENT_STEPS.map(step => (
          <div key={step.label} className="rounded-xl border border-border bg-background/70 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-foreground">{step.label}</span>
              <StatusBadge
                tone={step.status === 'required' ? 'warning' : step.status === 'optional' ? 'muted' : 'info'}
                label={step.status}
              />
            </div>
            <code className="block overflow-x-auto rounded-lg bg-muted/60 px-3 py-2 font-mono text-[10px] leading-5 text-muted-foreground">
              {step.command}
            </code>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConnectionResult({ result }: { result: AuthenticatedWpConnectionResult | null }) {
  if (!result) {
    return (
      <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
        Čakám na test. Formulár drží údaje iba v pamäti tejto stránky.
      </div>
    );
  }

  if (!result.ok) {
    return (
      <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-destructive">
          <AlertTriangle size={14} />
          Spojenie neprešlo
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {result.message} {result.httpStatus ? `HTTP ${result.httpStatus}.` : ''}
        </p>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">{result.durationMs} ms</p>
      </div>
    );
  }

  const { user } = result;
  const previewCapabilities = user.capabilities.slice(0, 6);

  return (
    <div className="mt-4 rounded-xl border border-success/20 bg-success/10 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-success">
        <Sparkles size={14} />
        Spojenie funguje
      </div>
      <div className="mt-3 flex items-start gap-3">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="h-10 w-10 rounded-full border border-success/20" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-success/20 bg-card text-sm font-semibold text-success">
            {user.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">{user.name}</div>
          <div className="text-xs text-muted-foreground">{user.slug || 'WordPress account'}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {user.roles.length > 0 ? (
              user.roles.map(role => <StatusBadge key={role} tone="success" label={role} />)
            ) : (
              <StatusBadge tone="muted" label="no role exposed" />
            )}
            <StatusBadge tone="info" label={`${user.capabilities.length} capabilities`} />
          </div>
        </div>
      </div>
      {previewCapabilities.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {previewCapabilities.map(capability => (
            <span key={capability} className="rounded-full border border-success/20 bg-background/70 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
              {capability}
            </span>
          ))}
        </div>
      )}
      <p className="mt-2 font-mono text-[10px] text-muted-foreground">HTTP {result.httpStatus} · {result.durationMs} ms</p>
    </div>
  );
}
