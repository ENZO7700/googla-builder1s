import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Github, ArrowLeft, Plug, Unplug, RefreshCw, ExternalLink, Search,
  GitPullRequest, GitBranch, Activity, Shield, Sparkles, ScrollText,
  CheckCircle2, XCircle, Clock, PlayCircle, FileWarning, Webhook, Copy, Bot,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAdminAuth } from '@/lib/admin';
import { githubService } from '@/lib/github/githubService';
import type {
  GitHubConnection, Repository, WorkflowRun, PullRequest,
  AuditEvent, WorkflowRunStatus, RepoVisibility, PRChecksStatus, PRReviewStatus,
} from '@/lib/github/types';
import DashboardCard from '@/components/dashboard/DashboardCard';
import StatusBadge from '@/components/dashboard/StatusBadge';
import { EmptyState, LoadingState, ErrorState } from '@/components/dashboard/States';

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return 'práve';
  if (m < 60) return `pred ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `pred ${h} h`;
  const days = Math.floor(h / 24);
  return `pred ${days} d`;
}

function formatDuration(sec: number): string {
  if (!sec) return '—';
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

const RUN_TONE: Record<WorkflowRunStatus, { tone: 'success' | 'error' | 'running' | 'warning' | 'muted'; label: string }> = {
  success: { tone: 'success', label: 'Success' },
  failed: { tone: 'error', label: 'Failed' },
  running: { tone: 'running', label: 'Running' },
  queued: { tone: 'warning', label: 'Queued' },
  cancelled: { tone: 'muted', label: 'Cancelled' },
};

const VIS_TONE: Record<RepoVisibility, { tone: 'muted' | 'info' | 'warning'; label: string }> = {
  public: { tone: 'info', label: 'Public' },
  private: { tone: 'muted', label: 'Private' },
  internal: { tone: 'warning', label: 'Internal' },
};

const CHECKS_TONE: Record<PRChecksStatus, { tone: 'success' | 'error' | 'warning' | 'muted'; label: string }> = {
  passing: { tone: 'success', label: 'Checks ✓' },
  failing: { tone: 'error', label: 'Checks ✗' },
  pending: { tone: 'warning', label: 'Checks ...' },
  none: { tone: 'muted', label: 'No checks' },
};

const REVIEW_TONE: Record<PRReviewStatus, { tone: 'success' | 'error' | 'warning' | 'muted' | 'info'; label: string }> = {
  approved: { tone: 'success', label: 'Approved' },
  changes_requested: { tone: 'error', label: 'Changes req.' },
  review_required: { tone: 'warning', label: 'Review req.' },
  commented: { tone: 'info', label: 'Commented' },
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function GitHubDashboard() {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAdminAuth();

  const [connection, setConnection] = useState<GitHubConnection | null>(null);
  const [connLoading, setConnLoading] = useState(true);
  const [connBusy, setConnBusy] = useState(false);

  const [repos, setRepos] = useState<Repository[]>([]);
  const [reposLoading, setReposLoading] = useState(true);
  const [reposError, setReposError] = useState<string | null>(null);
  const [repoQuery, setRepoQuery] = useState('');
  const [repoVisibility, setRepoVisibility] = useState<'all' | RepoVisibility>('all');

  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);

  const [prs, setPrs] = useState<PullRequest[]>([]);
  const [prsLoading, setPrsLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);

  // Auth gate
  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate('/', { replace: true });
  }, [authLoading, user, navigate]);

  // Load all data
  const loadAll = async () => {
    try {
      setConnLoading(true);
      const c = await githubService.getConnection();
      setConnection(c);
    } finally {
      setConnLoading(false);
    }

    setReposLoading(true);
    setReposError(null);
    githubService.listRepositories()
      .then(setRepos)
      .catch(e => setReposError(e?.message ?? 'Neznáma chyba'))
      .finally(() => setReposLoading(false));

    setRunsLoading(true);
    githubService.listWorkflowRuns()
      .then(setRuns).finally(() => setRunsLoading(false));

    setPrsLoading(true);
    githubService.listPullRequests()
      .then(setPrs).finally(() => setPrsLoading(false));

    setAuditLoading(true);
    githubService.listAuditEvents()
      .then(setAudit).finally(() => setAuditLoading(false));
  };

  useEffect(() => {
    if (user && isAdmin) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin]);

  const handleConnect = async () => {
    setConnBusy(true);
    try {
      const c = await githubService.connect();
      setConnection(c);
      toast.success('GitHub pripojený', { description: 'Načítavam repozitáre a runs...' });
      await loadAll();
    } catch (e: any) {
      toast.error('Pripojenie zlyhalo', { description: e?.message });
    } finally {
      setConnBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Naozaj chcete odpojiť GitHub? Tokeny budú zneplatnené.')) return;
    setConnBusy(true);
    try {
      await githubService.disconnect();
      setConnection({ status: 'disconnected' });
      setRepos([]); setRuns([]); setPrs([]);
      toast.success('GitHub odpojený');
    } finally {
      setConnBusy(false);
    }
  };

  const handleSyncRepo = async (repoId: string, name: string) => {
    try {
      await githubService.syncRepository(repoId);
      toast.success(`Sync hotový: ${name}`);
      const refreshed = await githubService.listRepositories();
      setRepos(refreshed);
    } catch (e: any) {
      toast.error('Sync zlyhal', { description: e?.message });
    }
  };

  const handleAIReview = async (prId: string, title: string) => {
    setReviewingId(prId);
    try {
      const { summary } = await githubService.reviewPullRequestWithAI(prId);
      toast.success(`AI Review: ${title}`, { description: summary, duration: 8000 });
    } finally {
      setReviewingId(null);
    }
  };

  const filteredRepos = useMemo(() => {
    return repos.filter(r => {
      if (repoVisibility !== 'all' && r.visibility !== repoVisibility) return false;
      if (repoQuery && !r.fullName.toLowerCase().includes(repoQuery.toLowerCase())) return false;
      return true;
    });
  }, [repos, repoQuery, repoVisibility]);

  // ── Auth states ────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center bg-card border border-border rounded-2xl p-8 shadow-sm">
          <Shield size={32} className="text-warning mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-foreground">Prístup zamietnutý</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Tento dashboard je dostupný iba administrátorom. Ak si myslíte, že ide o chybu,
            kontaktujte vlastníka workspace-u.
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-6 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium"
          >
            Späť do aplikácie
          </button>
        </div>
      </div>
    );
  }

  const isConnected = connection?.status === 'connected';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition"
              title="Späť"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="w-9 h-9 rounded-xl bg-foreground/90 flex items-center justify-center">
              <Github size={18} className="text-background" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-foreground tracking-tight truncate">GitHub Control Center</h1>
              <p className="text-[11px] text-muted-foreground truncate">Repozitáre, CI/CD, PR & audit log</p>
            </div>
          </div>
          <button
            onClick={loadAll}
            className="hidden sm:flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-full text-xs font-medium text-foreground hover:bg-accent transition"
          >
            <RefreshCw size={14} /> Obnoviť
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* 1. Connection */}
        <DashboardCard
          title="GitHub pripojenie"
          description="Stav inštalácie GitHub App / OAuth pre tento workspace."
          icon={<Plug size={16} />}
        >
          {connLoading ? (
            <LoadingState />
          ) : isConnected && connection?.account ? (
            <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
              <div className="flex items-center gap-4 min-w-0">
                <img
                  src={connection.account.avatarUrl}
                  alt={connection.account.login}
                  className="w-12 h-12 rounded-xl border border-border"
                  loading="lazy"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">{connection.account.name}</span>
                    <StatusBadge tone="success" label="Connected" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    @{connection.account.login} · {connection.account.type} · pripojené {connection.connectedAt ? timeAgo(connection.connectedAt) : '—'}
                  </p>
                  {connection.scopes && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {connection.scopes.map(s => (
                        <span key={s} className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={connBusy}
                className="flex items-center gap-2 px-4 py-2 bg-card border border-destructive/30 text-destructive rounded-full text-xs font-medium hover:bg-destructive/5 disabled:opacity-50 shrink-0 transition"
              >
                <Unplug size={14} /> Odpojiť
              </button>
            </div>
          ) : (
            <div className="px-6 py-8 text-center">
              <Github size={32} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">GitHub nie je pripojený</p>
              <p className="text-xs text-muted-foreground mt-1 mb-5 max-w-md mx-auto">
                Pripojte GitHub aby ste získali prístup k repozitárom, CI/CD pipelines a kódovým review.
              </p>
              <button
                onClick={handleConnect}
                disabled={connBusy}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background rounded-full text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
              >
                <Github size={16} /> {connBusy ? 'Pripájam...' : 'Pripojiť GitHub'}
              </button>
            </div>
          )}
        </DashboardCard>

        {/* 2. Repositories */}
        <DashboardCard
          title="Repozitáre"
          description="Sledované repozitáre a ich aktivita."
          icon={<GitBranch size={16} />}
          actions={
            isConnected && (
              <div className="flex items-center gap-2">
                <div className="relative hidden sm:block">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={repoQuery}
                    onChange={e => setRepoQuery(e.target.value)}
                    placeholder="Hľadať..."
                    className="bg-card border border-border rounded-lg pl-7 pr-3 py-1.5 text-xs text-foreground outline-none focus:border-primary w-44"
                  />
                </div>
                <select
                  value={repoVisibility}
                  onChange={e => setRepoVisibility(e.target.value as any)}
                  className="bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                >
                  <option value="all">Všetky</option>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                  <option value="internal">Internal</option>
                </select>
              </div>
            )
          }
        >
          {!isConnected ? (
            <EmptyState icon={<Plug size={20} />} title="Najprv pripojte GitHub" description="Po pripojení sa tu zobrazia vaše repozitáre." />
          ) : reposLoading ? (
            <LoadingState />
          ) : reposError ? (
            <ErrorState message={reposError} onRetry={loadAll} />
          ) : filteredRepos.length === 0 ? (
            <EmptyState title="Žiadne repozitáre" description="Skúste zmeniť filter alebo vyhľadávanie." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                    <th className="text-left font-medium px-6 py-3">Repozitár</th>
                    <th className="text-left font-medium px-3 py-3">Visibility</th>
                    <th className="text-left font-medium px-3 py-3 hidden md:table-cell">Default branch</th>
                    <th className="text-left font-medium px-3 py-3 hidden lg:table-cell">Posledný commit</th>
                    <th className="text-left font-medium px-3 py-3">Aktivita</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredRepos.map(r => {
                    const v = VIS_TONE[r.visibility];
                    return (
                      <tr key={r.id} className="border-b border-border last:border-0 hover:bg-accent/40 transition">
                        <td className="px-6 py-4">
                          <div className="font-medium text-foreground">{r.name}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-xs">{r.description ?? r.fullName}</div>
                        </td>
                        <td className="px-3 py-4"><StatusBadge tone={v.tone} label={v.label} /></td>
                        <td className="px-3 py-4 hidden md:table-cell">
                          <span className="font-mono text-xs text-muted-foreground">{r.defaultBranch}</span>
                        </td>
                        <td className="px-3 py-4 hidden lg:table-cell">
                          {r.lastCommit ? (
                            <div className="text-xs">
                              <div className="text-foreground truncate max-w-xs">{r.lastCommit.message}</div>
                              <div className="text-muted-foreground font-mono text-[10px] mt-0.5">
                                {r.lastCommit.sha} · {r.lastCommit.author}
                              </div>
                            </div>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-4 text-xs text-muted-foreground whitespace-nowrap">{timeAgo(r.lastActivityAt)}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleSyncRepo(r.id, r.name)}
                              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
                              title="Sync repo"
                            >
                              <RefreshCw size={14} />
                            </button>
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
                              title="Otvoriť repo"
                            >
                              <ExternalLink size={14} />
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </DashboardCard>

        {/* 3. CI/CD Pipelines */}
        <DashboardCard
          title="CI/CD Pipelines"
          description="Posledné workflow runs naprieč repozitármi."
          icon={<Activity size={16} />}
        >
          {!isConnected ? (
            <EmptyState icon={<Plug size={20} />} title="Najprv pripojte GitHub" />
          ) : runsLoading ? (
            <LoadingState />
          ) : runs.length === 0 ? (
            <EmptyState title="Žiadne workflow runs" description="Po prvom CI behu sa tu zobrazia záznamy." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                    <th className="text-left font-medium px-6 py-3">Workflow</th>
                    <th className="text-left font-medium px-3 py-3">Status</th>
                    <th className="text-left font-medium px-3 py-3 hidden md:table-cell">Branch</th>
                    <th className="text-left font-medium px-3 py-3 hidden lg:table-cell">Commit</th>
                    <th className="text-left font-medium px-3 py-3">Trvanie</th>
                    <th className="text-left font-medium px-3 py-3 hidden md:table-cell">Spustil</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {runs.map(run => {
                    const t = RUN_TONE[run.status];
                    return (
                      <tr key={run.id} className="border-b border-border last:border-0 hover:bg-accent/40 transition">
                        <td className="px-6 py-4">
                          <div className="font-medium text-foreground">{run.workflowName}</div>
                          <div className="text-xs text-muted-foreground">{run.repoFullName}</div>
                        </td>
                        <td className="px-3 py-4"><StatusBadge tone={t.tone} label={t.label} /></td>
                        <td className="px-3 py-4 hidden md:table-cell">
                          <span className="font-mono text-xs text-muted-foreground truncate max-w-[140px] inline-block">{run.branch}</span>
                        </td>
                        <td className="px-3 py-4 hidden lg:table-cell">
                          <div className="text-xs">
                            <div className="font-mono text-muted-foreground">{run.commitSha}</div>
                            <div className="text-foreground truncate max-w-[200px]">{run.commitMessage}</div>
                          </div>
                        </td>
                        <td className="px-3 py-4 text-xs text-foreground whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {run.status === 'running' ? <PlayCircle size={12} className="text-primary animate-pulse" /> :
                             run.status === 'success' ? <CheckCircle2 size={12} className="text-success" /> :
                             run.status === 'failed' ? <XCircle size={12} className="text-destructive" /> :
                             <Clock size={12} className="text-muted-foreground" />}
                            {formatDuration(run.durationSec)}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(run.startedAt)}</div>
                        </td>
                        <td className="px-3 py-4 hidden md:table-cell">
                          <span className="text-xs text-muted-foreground font-mono">{run.triggeredBy}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <a
                            href={run.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                          >
                            Detail <ExternalLink size={12} />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </DashboardCard>

        {/* 4. Pull Requests */}
        <DashboardCard
          title="Pull Requests & Code Review"
          description="Otvorené PR-y a ich stav kontrol."
          icon={<GitPullRequest size={16} />}
        >
          {!isConnected ? (
            <EmptyState icon={<Plug size={20} />} title="Najprv pripojte GitHub" />
          ) : prsLoading ? (
            <LoadingState />
          ) : prs.length === 0 ? (
            <EmptyState title="Žiadne otvorené PR-y" description="Všetko je zmergované 🎉" />
          ) : (
            <ul className="divide-y divide-border">
              {prs.map(pr => {
                const checks = CHECKS_TONE[pr.checks];
                const review = REVIEW_TONE[pr.review];
                const isReviewing = reviewingId === pr.id;
                return (
                  <li key={pr.id} className="px-6 py-4 hover:bg-accent/40 transition">
                    <div className="flex items-start gap-4">
                      <img
                        src={pr.author.avatarUrl}
                        alt={pr.author.login}
                        className="w-9 h-9 rounded-full border border-border shrink-0"
                        loading="lazy"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 flex-wrap">
                          <span className="font-medium text-foreground text-sm">{pr.title}</span>
                          <span className="text-xs text-muted-foreground font-mono">#{pr.number}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                          <span className="font-mono">{pr.repoFullName}</span>
                          <span className="opacity-50">·</span>
                          <span><span className="font-mono">{pr.branch}</span> → <span className="font-mono">{pr.baseBranch}</span></span>
                          <span className="opacity-50">·</span>
                          <span>@{pr.author.login}</span>
                          <span className="opacity-50">·</span>
                          <span>{timeAgo(pr.createdAt)}</span>
                          <span className="opacity-50">·</span>
                          <span className="text-success">+{pr.additions}</span>
                          <span className="text-destructive">−{pr.deletions}</span>
                        </div>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          <StatusBadge tone={checks.tone} label={checks.label} />
                          <StatusBadge tone={review.tone} label={review.label} />
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleAIReview(pr.id, pr.title)}
                          disabled={isReviewing}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-medium hover:bg-primary/15 disabled:opacity-50 transition"
                        >
                          <Sparkles size={12} /> {isReviewing ? 'Reviewing...' : 'Review with AI'}
                        </button>
                        <a
                          href={pr.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-full text-xs font-medium text-foreground hover:bg-accent transition"
                        >
                          Otvoriť <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </DashboardCard>


        {/* 4b. AI PR Review – Webhook setup */}
        <PRReviewWebhookCard />

        {/* 5. Security & Audit */}
        <DashboardCard
          title="Security & Audit"
          description="Zdravie integrácie a denník udalostí."
          icon={<Shield size={16} />}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-6 py-5 border-b border-border">
            <SummaryTile
              label="Posledný sync"
              value={connection?.lastSyncAt ? timeAgo(connection.lastSyncAt) : '—'}
              tone={connection?.lastSyncAt ? 'success' : 'muted'}
            />
            <SummaryTile
              label="Webhook"
              value={connection?.webhookHealthy ? 'Healthy' : isConnected ? 'Degraded' : 'Inactive'}
              tone={connection?.webhookHealthy ? 'success' : isConnected ? 'warning' : 'muted'}
            />
            <SummaryTile
              label="Tokeny"
              value="Server-side"
              tone="info"
              hint="Tokeny nie sú v prehliadači — žijú iba v secrets backendu."
            />
          </div>

          <div className="px-6 py-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
              <ScrollText size={14} /> Audit log
            </div>
            {auditLoading ? (
              <LoadingState label="Načítavam audit log..." />
            ) : audit.length === 0 ? (
              <EmptyState icon={<FileWarning size={18} />} title="Žiadne udalosti" />
            ) : (
              <ul className="divide-y divide-border">
                {audit.map(ev => {
                  const tone =
                    ev.status === 'success' ? 'success' :
                    ev.status === 'error' ? 'error' :
                    ev.status === 'warning' ? 'warning' : 'info';
                  return (
                    <li key={ev.id} className="py-3 flex items-start gap-3 text-sm">
                      <StatusBadge tone={tone} label={ev.type.replace('_', ' ')} />
                      <div className="flex-1 min-w-0">
                        <div className="text-foreground">{ev.message}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                          {ev.actor}{ev.target ? ` → ${ev.target}` : ''} · {timeAgo(ev.timestamp)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DashboardCard>

        {/* Footer note */}
        <p className="text-[11px] text-muted-foreground text-center pb-6 leading-relaxed">
          Dáta sú aktuálne mockované. Pripojenie reálneho GitHub-u prebieha cez backend
          (Edge Function + secrets), nikdy nie z prehliadača.
        </p>
      </main>
    </div>
  );
}

function SummaryTile({ label, value, tone, hint }: { label: string; value: string; tone: 'success' | 'warning' | 'muted' | 'info'; hint?: string }) {
  const ring =
    tone === 'success' ? 'ring-success/20 bg-success/5' :
    tone === 'warning' ? 'ring-warning/20 bg-warning/5' :
    tone === 'info' ? 'ring-primary/20 bg-primary/5' :
    'ring-border bg-muted/30';
  return (
    <div className={`rounded-xl p-4 ring-1 ${ring}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
      <div className="text-lg font-semibold text-foreground mt-1">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{hint}</div>}
    </div>
  );
}

function PRReviewWebhookCard() {
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/github-pr-review`;
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const copy = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const runTest = async () => {
    setTesting(true);
    setPreview(null);
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-dry-run': 'true',
        },
        body: JSON.stringify({
          repo: 'h4ck3d-ent/web-dashboard',
          prNumber: 999,
          prTitle: 'Test PR – dry run',
          author: 'tester',
          diff: `diff --git a/src/lib/admin.ts b/src/lib/admin.ts
@@ -10,3 +10,4 @@
-export const ADMIN_EMAILS: readonly string[] = [];
+export const ADMIN_EMAILS: readonly string[] = [];
+console.log('admin emails loaded');`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setPreview(data.review ?? '(empty response)');
      toast.success('AI review vygenerované');
    } catch (e: any) {
      toast.error('Test zlyhal', { description: e?.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <DashboardCard
      title="AI PR Review – Webhook"
      description="Automatický AI review pre každý nový/aktualizovaný Pull Request."
      icon={<Bot size={16} />}
      actions={
        <button
          onClick={runTest}
          disabled={testing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-medium hover:bg-primary/15 disabled:opacity-50 transition"
        >
          <Sparkles size={12} /> {testing ? 'Generujem...' : 'Otestovať review'}
        </button>
      }
    >
      <div className="px-6 py-5 space-y-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <Webhook size={12} /> Webhook URL
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate font-mono text-xs bg-muted text-foreground px-3 py-2 rounded-lg border border-border">
              {webhookUrl}
            </code>
            <button
              onClick={copy}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-card border border-border rounded-lg text-xs font-medium text-foreground hover:bg-accent transition shrink-0"
            >
              <Copy size={12} /> {copied ? 'Skopírované' : 'Kopírovať'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
            <div className="font-semibold text-foreground">Setup v GitHub</div>
            <ol className="list-decimal pl-4 space-y-1 text-muted-foreground leading-relaxed">
              <li>Repo → <span className="font-mono">Settings → Webhooks → Add webhook</span></li>
              <li>Payload URL: vložte URL vyššie</li>
              <li>Content type: <span className="font-mono">application/json</span></li>
              <li>Secret: zhodný s <span className="font-mono">GITHUB_WEBHOOK_SECRET</span></li>
              <li>Events: <span className="font-mono">Pull requests</span> (opened / synchronize / reopened)</li>
            </ol>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
            <div className="font-semibold text-foreground">Bezpečnosť</div>
            <ul className="list-disc pl-4 space-y-1 text-muted-foreground leading-relaxed">
              <li>HMAC SHA-256 podpis je <strong>povinný</strong> (fail-closed).</li>
              <li>Tokeny žijú iba v secrets backendu, nie v klientovi.</li>
              <li>Diff je orezaný na 120 KB pre AI kontext.</li>
              <li>Spracujú sa iba akcie: <span className="font-mono">opened</span>, <span className="font-mono">synchronize</span>, <span className="font-mono">reopened</span>.</li>
            </ul>
          </div>
        </div>

        {preview && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Náhľad AI review (dry run)</div>
            <pre className="text-[11px] font-mono whitespace-pre-wrap bg-muted text-foreground p-4 rounded-xl border border-border max-h-80 overflow-auto">
              {preview}
            </pre>
          </div>
        )}
      </div>
    </DashboardCard>
  );
}
