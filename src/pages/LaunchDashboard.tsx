import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, ShieldCheck, Zap, Eye, Smartphone, Lock, Trash2,
  ExternalLink, Play, Sparkles, Loader2, Download,
} from 'lucide-react';
import { toast } from 'sonner';
import DashboardCard from '@/components/dashboard/DashboardCard';
import StatusBadge from '@/components/dashboard/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/dashboard/States';
import { CircularScore } from '@/components/launch/CircularScore';
import { FindingCard } from '@/components/launch/FindingCard';
import { ScanTimeline } from '@/components/launch/ScanTimeline';
import { SeverityChart } from '@/components/launch/SeverityChart';
import { useAdminAuth } from '@/lib/admin';
import { runMockAudit, runRealAudit } from '@/lib/launch/audit';
import { exportScanPdf } from '@/lib/launch/pdfReport';
import {
  deleteProject, getProject, listProjects, listScans, saveProject, saveScan,
} from '@/lib/launch/storage';
import type { AppType, LaunchProject, Scan } from '@/lib/launch/types';
import { DIMENSION_LABEL } from '@/lib/launch/types';
import { dimensionKeys, formatDate, scoreColor, uid } from '@/lib/launch/utils';

const APP_TYPES: { value: AppType; label: string }[] = [
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'saas', label: 'SaaS' },
  { value: 'marketing', label: 'Marketing site' },
  { value: 'blog', label: 'Blog' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'internal-tool', label: 'Internal tool' },
  { value: 'other', label: 'Iné' },
];

const DIM_ICON = {
  security: ShieldCheck, performance: Zap, accessibility: Eye, pwa: Smartphone, privacy: Lock,
} as const;

export default function LaunchDashboard() {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAdminAuth();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') ?? 'overview';
  const projectId = params.get('project');

  const [projects, setProjects] = useState<LaunchProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/'); return; }
    if (!isAdmin) return;
    try { setProjects(listProjects()); } catch (e) { setError(String(e)); }
  }, [authLoading, user, isAdmin, navigate]);

  if (authLoading) return <LoadingState label="Overujem oprávnenia…" />;
  if (!user) return null;
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <ErrorState message="Launch Readiness dashboard je dostupný len pre adminov. Pridaj svoj email do whitelistu v src/lib/admin.ts." />
      </div>
    );
  }

  const setView = (next: string, extra?: Record<string, string>) => {
    const p = new URLSearchParams();
    if (next !== 'overview') p.set('view', next);
    if (extra) Object.entries(extra).forEach(([k, v]) => p.set(k, v));
    setParams(p);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2 -ml-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
              <Sparkles size={16} className="text-primary" /> Launch Readiness Auditor
            </h1>
            <p className="text-xs text-muted-foreground">Audituj security, performance, a11y, PWA &amp; privacy pred launchom.</p>
          </div>
          <StatusBadge tone="success" label="Admin" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {error && <ErrorState message={error} />}
        {projects === null ? (
          <LoadingState label="Načítavam projekty…" />
        ) : view === 'create' ? (
          <CreateView
            onCreated={(p) => { setProjects(listProjects()); setView('project', { project: p.id }); }}
            onCancel={() => setView('overview')}
          />
        ) : view === 'project' && projectId ? (
          <ProjectView
            projectId={projectId}
            onBack={() => setView('overview')}
            onChanged={() => setProjects(listProjects())}
          />
        ) : (
          <OverviewView projects={projects} onCreate={() => setView('create')}
            onOpen={(id) => setView('project', { project: id })} />
        )}
      </main>
    </div>
  );
}

// ----- OVERVIEW -----

function OverviewView({ projects, onCreate, onOpen }: {
  projects: LaunchProject[]; onCreate: () => void; onOpen: (id: string) => void;
}) {
  if (projects.length === 0) {
    return (
      <DashboardCard title="Projekty" description="Spravuj audit-readiness pre svoje appky" icon={<Sparkles size={16} />}>
        <div className="p-8">
          <EmptyState title="Žiadne projekty" description="Vytvor prvý projekt a spusti audit." action={<button onClick={onCreate} className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:opacity-90 transition-opacity">Pridať projekt</button>} />
        </div>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard
      title="Projekty"
      description={`${projects.length} ${projects.length === 1 ? 'projekt' : 'projektov'}`}
      icon={<Sparkles size={16} />}
      actions={
        <button onClick={onCreate} className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:opacity-90 transition-opacity">
          <Plus size={14} /> Nový projekt
        </button>
      }
    >
      <ul className="divide-y divide-border">
        {projects.map(p => {
          const scans = listScans(p.id);
          const last = scans[scans.length - 1];
          const overall = last?.scores.overall ?? 0;
          const colors = scoreColor(overall);
          return (
            <li key={p.id}>
              <button onClick={() => onOpen(p.id)} className="w-full flex items-center gap-4 px-6 py-4 hover:bg-accent text-left transition-colors">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors.bg}`}>
                  <span className={`text-base font-semibold ${colors.text}`}>{last ? overall : '—'}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground truncate">{p.name}</h3>
                    {p.isDemo && <StatusBadge tone="info" label="Demo" />}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{p.url}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-muted-foreground">{scans.length} {scans.length === 1 ? 'scan' : 'scanov'}</div>
                  {last && <div className="text-[11px] text-muted-foreground mt-0.5">{formatDate(last.createdAt)}</div>}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </DashboardCard>
  );
}

// ----- CREATE -----

function CreateView({ onCreated, onCancel }: { onCreated: (p: LaunchProject) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [appType, setAppType] = useState<AppType>('saas');
  const [config, setConfig] = useState({ collectsPersonalData: true, usesPayments: false, hasAuth: true, storesUserContent: false });
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validUrl(v: string) {
    try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError('Zadaj názov projektu (min. 2 znaky).');
    if (!validUrl(url)) return setError('URL musí začínať https:// alebo http://');
    if (!authorized) return setError('Musíš potvrdiť, že máš oprávnenie auditovať túto appku.');
    setBusy(true);
    try {
      const project: LaunchProject = {
        id: uid('proj'), name: name.trim(), url: url.trim(), appType, config,
        createdAt: new Date().toISOString(),
      };
      saveProject(project);
      let scan: Scan;
      try {
        scan = await runRealAudit(project);
        toast.success('Real audit dokončený');
      } catch (err) {
        toast.warning('Real scan zlyhal — používam demo audit', { description: (err as Error).message });
        scan = runMockAudit(project);
      }
      saveScan(scan);
      onCreated(project);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <DashboardCard title="Nový projekt" description="Audit sa spustí hneď po uložení" icon={<Plus size={16} />}>
      <form onSubmit={submit} className="p-6 space-y-5">
        <Field label="Názov" htmlFor="lg-name">
          <input id="lg-name" type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="Moja appka" className={inputCls} required />
        </Field>
        <Field label="Live URL" htmlFor="lg-url" hint="Vrátane https://">
          <input id="lg-url" type="url" value={url} onChange={e => setUrl(e.target.value)}
            placeholder="https://example.com" className={inputCls} required />
        </Field>
        <Field label="Typ appky" htmlFor="lg-type">
          <select id="lg-type" value={appType} onChange={e => setAppType(e.target.value as AppType)} className={inputCls}>
            {APP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Charakteristika</legend>
          <Toggle label="Zbiera osobné údaje" checked={config.collectsPersonalData} onChange={v => setConfig({ ...config, collectsPersonalData: v })} />
          <Toggle label="Spracúva platby" checked={config.usesPayments} onChange={v => setConfig({ ...config, usesPayments: v })} />
          <Toggle label="Má autentifikáciu" checked={config.hasAuth} onChange={v => setConfig({ ...config, hasAuth: v })} />
          <Toggle label="Ukladá user-generated content" checked={config.storesUserContent} onChange={v => setConfig({ ...config, storesUserContent: v })} />
        </fieldset>

        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={authorized} onChange={e => setAuthorized(e.target.checked)} className="mt-0.5" />
          <span>Potvrdzujem, že mám oprávnenie auditovať túto URL adresu.</span>
        </label>

        {error && <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">{error}</div>}

        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Vytvoriť &amp; spustiť audit
          </button>
          <button type="button" onClick={onCancel}
            className="rounded-full border border-border px-4 py-2 text-sm hover:bg-accent transition-colors">
            Zrušiť
          </button>
        </div>
      </form>
    </DashboardCard>
  );
}

// ----- PROJECT DETAIL -----

function ProjectView({ projectId, onBack, onChanged }: {
  projectId: string; onBack: () => void; onChanged: () => void;
}) {
  const [project, setProject] = useState<LaunchProject | undefined>(() => getProject(projectId));
  const [scans, setScans] = useState<Scan[]>(() => listScans(projectId));
  const [activeScanId, setActiveScanId] = useState<string | undefined>(() => listScans(projectId).slice(-1)[0]?.id);
  const [running, setRunning] = useState(false);

  const [scanMode, setScanMode] = useState<'real' | 'demo'>('real');
  const [exporting, setExporting] = useState(false);

  const active = useMemo(() => scans.find(s => s.id === activeScanId) ?? scans[scans.length - 1], [scans, activeScanId]);

  async function rescan() {
    if (!project) return;
    setRunning(true);
    try {
      let fresh: Scan;
      if (scanMode === 'real') {
        try { fresh = await runRealAudit(project); }
        catch (err) {
          toast.warning('Real scan zlyhal — fallback na demo', { description: (err as Error).message });
          fresh = runMockAudit(project);
        }
      } else {
        fresh = runMockAudit(project);
      }
      saveScan(fresh);
      const updated = listScans(projectId);
      setScans(updated);
      setActiveScanId(fresh.id);
    } finally {
      setRunning(false);
    }
  }

  async function downloadPdf() {
    if (!project || !active) return;
    setExporting(true);
    try { exportScanPdf(project, active, scans); toast.success('PDF report stiahnutý'); }
    catch (err) { toast.error('PDF export zlyhal', { description: (err as Error).message }); }
    finally { setExporting(false); }
  }

  function remove() {
    if (!project) return;
    if (!confirm(`Naozaj zmazať projekt "${project.name}" a všetky jeho skeny?`)) return;
    deleteProject(project.id);
    onChanged();
    onBack();
  }

  if (!project) {
    return <ErrorState message="Projekt sa nenašiel. Vráť sa späť na zoznam." />;
  }
  if (!active) {
    return (
      <DashboardCard title={project.name}>
        <div className="p-8">
          <EmptyState title="Žiadne skeny" description="Spusti prvý audit pre tento projekt." action={<button onClick={rescan} className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:opacity-90 transition-opacity">Spustiť audit</button>} />
        </div>
      </DashboardCard>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardCard
        title={project.name}
        description={project.url}
        icon={<Sparkles size={16} />}
        actions={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="inline-flex rounded-full border border-border p-0.5 text-[11px]">
              <button onClick={() => setScanMode('real')}
                className={`px-2.5 py-1 rounded-full transition-colors ${scanMode === 'real' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                Real
              </button>
              <button onClick={() => setScanMode('demo')}
                className={`px-2.5 py-1 rounded-full transition-colors ${scanMode === 'demo' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                Demo
              </button>
            </div>
            <a href={project.url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-accent transition-colors">
              <ExternalLink size={12} /> Otvoriť
            </a>
            <button onClick={downloadPdf} disabled={exporting}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50 transition-colors">
              {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Export PDF
            </button>
            <button onClick={rescan} disabled={running}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
              {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Re-scan
            </button>
            {!project.isDemo && (
              <button onClick={remove} className="p-1.5 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                <Trash2 size={14} />
              </button>
            )}
            <button onClick={onBack} className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-accent transition-colors">Späť</button>
          </div>
        }
      >
        <div className="p-6 grid gap-8 md:grid-cols-[auto_1fr] items-center">
          <CircularScore value={active.scores.overall} label="Overall" size={140} emphasize />
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {dimensionKeys().map(dim => {
              const Icon = DIM_ICON[dim];
              return (
                <div key={dim} className="text-center">
                  <Icon size={16} className="mx-auto mb-2 text-muted-foreground" />
                  <CircularScore value={active.scores[dim]} label={DIMENSION_LABEL[dim]} size={84} />
                </div>
              );
            })}
          </div>
        </div>
      </DashboardCard>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <DashboardCard title="Nálezy" description={active.summary}>
          <div className="p-6 space-y-3">
            {active.findings.length === 0 ? (
              <EmptyState title="Žiadne nálezy" description="Tento sken je čistý — môžeš launchnúť. 🚀" />
            ) : (
              active.findings.map((f, i) => <FindingCard key={f.id} finding={f} defaultOpen={i === 0} />)
            )}
          </div>
        </DashboardCard>

        <div className="space-y-6">
          <DashboardCard title="Severity">
            <div className="p-6"><SeverityChart findings={active.findings} /></div>
          </DashboardCard>

          <DashboardCard title="História scanov" description={`${scans.length} ${scans.length === 1 ? 'záznam' : 'záznamov'}`}>
            <div className="p-6">
              <ScanTimeline scans={scans} activeId={active.id} onSelect={setActiveScanId} />
            </div>
          </DashboardCard>
        </div>
      </div>
    </div>
  );
}

// ----- form atoms -----

const inputCls =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors';

function Field({ label, htmlFor, hint, children }: {
  label: string; htmlFor: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors">
      <span className="text-foreground">{label}</span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="h-4 w-4 accent-[hsl(var(--primary))]" />
    </label>
  );
}
