/**
 * Typed data models for the GitHub dashboard.
 * Keep these in sync with whatever `githubService.ts` returns —
 * when wiring the real API, the same shapes should be returned
 * so the UI does not need to change.
 */

export type ConnectionStatus = 'connected' | 'disconnected' | 'error';

export interface GitHubConnection {
  status: ConnectionStatus;
  account?: {
    login: string;
    name: string;
    avatarUrl: string;
    type: 'User' | 'Organization';
  };
  scopes?: string[];
  connectedAt?: string; // ISO date
  lastSyncAt?: string;  // ISO date
  webhookHealthy?: boolean;
}

export type RepoVisibility = 'public' | 'private' | 'internal';

export interface Repository {
  id: string;
  name: string;
  fullName: string;       // org/name
  url: string;
  visibility: RepoVisibility;
  defaultBranch: string;
  description?: string;
  lastCommit?: {
    sha: string;
    message: string;
    author: string;
    date: string;          // ISO
  };
  lastActivityAt: string;  // ISO
  openIssues: number;
  openPRs: number;
}

export type WorkflowRunStatus = 'success' | 'failed' | 'running' | 'queued' | 'cancelled';

export interface WorkflowRun {
  id: string;
  repoFullName: string;
  workflowName: string;
  status: WorkflowRunStatus;
  branch: string;
  commitSha: string;
  commitMessage: string;
  triggeredBy: string;
  startedAt: string;       // ISO
  durationSec: number;
  url: string;
}

export type PRChecksStatus = 'passing' | 'failing' | 'pending' | 'none';
export type PRReviewStatus = 'approved' | 'changes_requested' | 'review_required' | 'commented';

export interface PullRequest {
  id: string;
  number: number;
  repoFullName: string;
  title: string;
  author: {
    login: string;
    avatarUrl: string;
  };
  branch: string;          // head branch
  baseBranch: string;
  checks: PRChecksStatus;
  review: PRReviewStatus;
  additions: number;
  deletions: number;
  createdAt: string;       // ISO
  url: string;
}

export type AuditEventType =
  | 'repo_sync'
  | 'pr_review'
  | 'pipeline_check'
  | 'connection_change'
  | 'webhook_event';

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  message: string;
  actor: string;
  target?: string;
  status: 'success' | 'warning' | 'error' | 'info';
  timestamp: string;       // ISO
}
