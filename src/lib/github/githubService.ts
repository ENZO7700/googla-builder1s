import type {
  GitHubConnection,
  Repository,
  WorkflowRun,
  PullRequest,
  AuditEvent,
} from './types';

/**
 * GitHub service abstraction.
 *
 * Currently returns mock data. When wiring real GitHub access:
 *
 *   1. Create a Supabase Edge Function (e.g. `supabase/functions/github-proxy`)
 *      that holds the GitHub App / PAT token in `Deno.env` and proxies REST calls.
 *      NEVER expose the token to the client.
 *
 *   2. Replace the mock implementations below with `supabase.functions.invoke('github-proxy', { body: { op: '...' } })`
 *      calls. The return shapes must match the typed models in `./types.ts`
 *      so no UI changes are required.
 *
 *   3. For per-user OAuth, store the user's GitHub access token in a
 *      `github_tokens` table protected by RLS (`auth.uid() = user_id`)
 *      and read it server-side from the edge function only.
 */

export interface GitHubService {
  getConnection(): Promise<GitHubConnection>;
  connect(): Promise<GitHubConnection>;
  disconnect(): Promise<void>;
  listRepositories(): Promise<Repository[]>;
  syncRepository(repoId: string): Promise<Repository>;
  listWorkflowRuns(): Promise<WorkflowRun[]>;
  listPullRequests(): Promise<PullRequest[]>;
  reviewPullRequestWithAI(prId: string): Promise<{ summary: string }>;
  listAuditEvents(): Promise<AuditEvent[]>;
}

// ── Mock data ────────────────────────────────────────────────────────────────

const now = Date.now();
const iso = (msAgo: number) => new Date(now - msAgo).toISOString();

const MOCK_CONNECTION: GitHubConnection = {
  status: 'connected',
  account: {
    login: 'h4ck3d-ent',
    name: 'H4CK3D Enterprise',
    avatarUrl: 'https://avatars.githubusercontent.com/u/9919?v=4',
    type: 'Organization',
  },
  scopes: ['repo', 'workflow', 'read:org'],
  connectedAt: iso(1000 * 60 * 60 * 24 * 12),
  lastSyncAt: iso(1000 * 60 * 4),
  webhookHealthy: true,
};

const MOCK_REPOS: Repository[] = [
  {
    id: 'r1',
    name: 'enterprise-core',
    fullName: 'h4ck3d-ent/enterprise-core',
    url: 'https://github.com/h4ck3d-ent/enterprise-core',
    visibility: 'private',
    defaultBranch: 'main',
    description: 'Hlavné API a doménové služby.',
    lastCommit: {
      sha: 'a3f1c7e',
      message: 'feat(auth): pridať MFA challenge pre admin endpointy',
      author: 'martin.k',
      date: iso(1000 * 60 * 23),
    },
    lastActivityAt: iso(1000 * 60 * 23),
    openIssues: 7,
    openPRs: 3,
  },
  {
    id: 'r2',
    name: 'web-dashboard',
    fullName: 'h4ck3d-ent/web-dashboard',
    url: 'https://github.com/h4ck3d-ent/web-dashboard',
    visibility: 'private',
    defaultBranch: 'main',
    description: 'React + Vite frontend pre administračný panel.',
    lastCommit: {
      sha: '9c0b22d',
      message: 'fix(table): empty state pre filtrované riadky',
      author: 'eva.s',
      date: iso(1000 * 60 * 60 * 2),
    },
    lastActivityAt: iso(1000 * 60 * 60 * 2),
    openIssues: 12,
    openPRs: 1,
  },
  {
    id: 'r3',
    name: 'infra-terraform',
    fullName: 'h4ck3d-ent/infra-terraform',
    url: 'https://github.com/h4ck3d-ent/infra-terraform',
    visibility: 'private',
    defaultBranch: 'main',
    description: 'IaC moduly pre AWS účty.',
    lastCommit: {
      sha: '4421ea0',
      message: 'chore(eks): bump node group AMI',
      author: 'tom.r',
      date: iso(1000 * 60 * 60 * 26),
    },
    lastActivityAt: iso(1000 * 60 * 60 * 26),
    openIssues: 2,
    openPRs: 0,
  },
  {
    id: 'r4',
    name: 'docs',
    fullName: 'h4ck3d-ent/docs',
    url: 'https://github.com/h4ck3d-ent/docs',
    visibility: 'public',
    defaultBranch: 'main',
    description: 'Verejná dokumentácia produktu.',
    lastCommit: {
      sha: 'f102abc',
      message: 'docs: aktualizácia rate-limit sekcie',
      author: 'eva.s',
      date: iso(1000 * 60 * 60 * 50),
    },
    lastActivityAt: iso(1000 * 60 * 60 * 50),
    openIssues: 0,
    openPRs: 2,
  },
];

const MOCK_RUNS: WorkflowRun[] = [
  {
    id: 'w1', repoFullName: 'h4ck3d-ent/enterprise-core', workflowName: 'CI · build & test',
    status: 'success', branch: 'main', commitSha: 'a3f1c7e',
    commitMessage: 'feat(auth): pridať MFA challenge pre admin endpointy',
    triggeredBy: 'martin.k', startedAt: iso(1000 * 60 * 21), durationSec: 184,
    url: 'https://github.com/h4ck3d-ent/enterprise-core/actions/runs/1',
  },
  {
    id: 'w2', repoFullName: 'h4ck3d-ent/web-dashboard', workflowName: 'CI · lint+test',
    status: 'running', branch: 'feat/charts', commitSha: 'b71fe09',
    commitMessage: 'wip: dashboard charts',
    triggeredBy: 'eva.s', startedAt: iso(1000 * 60 * 3), durationSec: 0,
    url: 'https://github.com/h4ck3d-ent/web-dashboard/actions/runs/2',
  },
  {
    id: 'w3', repoFullName: 'h4ck3d-ent/infra-terraform', workflowName: 'plan',
    status: 'failed', branch: 'main', commitSha: '4421ea0',
    commitMessage: 'chore(eks): bump node group AMI',
    triggeredBy: 'tom.r', startedAt: iso(1000 * 60 * 60 * 25), durationSec: 92,
    url: 'https://github.com/h4ck3d-ent/infra-terraform/actions/runs/3',
  },
  {
    id: 'w4', repoFullName: 'h4ck3d-ent/enterprise-core', workflowName: 'Deploy · staging',
    status: 'queued', branch: 'release/2026.04', commitSha: 'cc12a99',
    commitMessage: 'release: 2026.04 candidate',
    triggeredBy: 'github-actions', startedAt: iso(1000 * 60 * 1), durationSec: 0,
    url: 'https://github.com/h4ck3d-ent/enterprise-core/actions/runs/4',
  },
  {
    id: 'w5', repoFullName: 'h4ck3d-ent/docs', workflowName: 'Deploy · pages',
    status: 'success', branch: 'main', commitSha: 'f102abc',
    commitMessage: 'docs: aktualizácia rate-limit sekcie',
    triggeredBy: 'eva.s', startedAt: iso(1000 * 60 * 60 * 49), durationSec: 47,
    url: 'https://github.com/h4ck3d-ent/docs/actions/runs/5',
  },
];

const MOCK_PRS: PullRequest[] = [
  {
    id: 'pr1', number: 482, repoFullName: 'h4ck3d-ent/enterprise-core',
    title: 'feat(auth): MFA challenge endpoint',
    author: { login: 'martin.k', avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4' },
    branch: 'feat/mfa', baseBranch: 'main',
    checks: 'passing', review: 'review_required',
    additions: 412, deletions: 88,
    createdAt: iso(1000 * 60 * 60 * 5),
    url: 'https://github.com/h4ck3d-ent/enterprise-core/pull/482',
  },
  {
    id: 'pr2', number: 113, repoFullName: 'h4ck3d-ent/web-dashboard',
    title: 'wip: dashboard charts',
    author: { login: 'eva.s', avatarUrl: 'https://avatars.githubusercontent.com/u/2?v=4' },
    branch: 'feat/charts', baseBranch: 'main',
    checks: 'pending', review: 'changes_requested',
    additions: 1240, deletions: 12,
    createdAt: iso(1000 * 60 * 60 * 9),
    url: 'https://github.com/h4ck3d-ent/web-dashboard/pull/113',
  },
  {
    id: 'pr3', number: 21, repoFullName: 'h4ck3d-ent/docs',
    title: 'docs: rate-limit + auth examples',
    author: { login: 'eva.s', avatarUrl: 'https://avatars.githubusercontent.com/u/2?v=4' },
    branch: 'docs/rate-limit', baseBranch: 'main',
    checks: 'passing', review: 'approved',
    additions: 78, deletions: 4,
    createdAt: iso(1000 * 60 * 60 * 30),
    url: 'https://github.com/h4ck3d-ent/docs/pull/21',
  },
];

const MOCK_AUDIT: AuditEvent[] = [
  { id: 'a1', type: 'repo_sync', message: 'Sync 4 repozitárov', actor: 'system', status: 'success', timestamp: iso(1000 * 60 * 4) },
  { id: 'a2', type: 'pipeline_check', message: 'plan zlyhal — terraform validate', actor: 'github-actions', target: 'h4ck3d-ent/infra-terraform', status: 'error', timestamp: iso(1000 * 60 * 60 * 25) },
  { id: 'a3', type: 'pr_review', message: 'AI review odoslaná pre PR #482', actor: 'h4ck3d-bot', target: 'h4ck3d-ent/enterprise-core#482', status: 'info', timestamp: iso(1000 * 60 * 60 * 4) },
  { id: 'a4', type: 'webhook_event', message: 'webhook ping OK', actor: 'github', status: 'success', timestamp: iso(1000 * 60 * 60 * 12) },
  { id: 'a5', type: 'connection_change', message: 'Pripojené org h4ck3d-ent', actor: 'admin@h4ck3d.dev', status: 'success', timestamp: iso(1000 * 60 * 60 * 24 * 12) },
];

// ── Mock implementation ──────────────────────────────────────────────────────

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

let connectionState: GitHubConnection = MOCK_CONNECTION;

class MockGitHubService implements GitHubService {
  async getConnection(): Promise<GitHubConnection> {
    await wait(200);
    return connectionState;
  }

  async connect(): Promise<GitHubConnection> {
    await wait(600);
    // TODO: replace with real OAuth/App install flow.
    connectionState = { ...MOCK_CONNECTION, status: 'connected', connectedAt: new Date().toISOString() };
    return connectionState;
  }

  async disconnect(): Promise<void> {
    await wait(300);
    // TODO: revoke token server-side and remove DB record.
    connectionState = { status: 'disconnected' };
  }

  async listRepositories(): Promise<Repository[]> {
    await wait(350);
    if (connectionState.status !== 'connected') return [];
    return MOCK_REPOS;
  }

  async syncRepository(repoId: string): Promise<Repository> {
    await wait(500);
    const repo = MOCK_REPOS.find(r => r.id === repoId);
    if (!repo) throw new Error('Repo not found');
    repo.lastActivityAt = new Date().toISOString();
    return repo;
  }

  async listWorkflowRuns(): Promise<WorkflowRun[]> {
    await wait(300);
    if (connectionState.status !== 'connected') return [];
    return MOCK_RUNS;
  }

  async listPullRequests(): Promise<PullRequest[]> {
    await wait(300);
    if (connectionState.status !== 'connected') return [];
    return MOCK_PRS;
  }

  async reviewPullRequestWithAI(prId: string): Promise<{ summary: string }> {
    await wait(700);
    // TODO: call edge function that pulls PR diff and runs Lovable AI gateway.
    const pr = MOCK_PRS.find(p => p.id === prId);
    return {
      summary: pr
        ? `AI review pre "${pr.title}" — žiadne kritické nálezy, 2 návrhy na refaktor.`
        : 'PR sa nenašiel.',
    };
  }

  async listAuditEvents(): Promise<AuditEvent[]> {
    await wait(250);
    return MOCK_AUDIT;
  }
}

export const githubService: GitHubService = new MockGitHubService();
