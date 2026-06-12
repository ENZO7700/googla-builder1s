import { supabase } from '@/integrations/supabase/client';
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
 * Connects to the server-side Supabase Edge Function 'github-connection'
 * to execute all operations securely, protecting credentials and preventing
 * raw API tokens from exposing to the client.
 */

export interface GitHubService {
  getConnection(): Promise<GitHubConnection>;
  connect(token: string): Promise<GitHubConnection>;
  disconnect(): Promise<void>;
  listRepositories(): Promise<Repository[]>;
  syncRepository(repoId: string): Promise<Repository>;
  listWorkflowRuns(): Promise<WorkflowRun[]>;
  listPullRequests(): Promise<PullRequest[]>;
  reviewPullRequestWithAI(prId: string): Promise<{ summary: string }>;
  listAuditEvents(): Promise<AuditEvent[]>;
}

class RealGitHubService implements GitHubService {
  private async callEdgeFunction<T>(action: string, bodyExtra?: Record<string, any>): Promise<T> {
    const { data, error } = await supabase.functions.invoke('github-connection', {
      body: { action, ...bodyExtra },
    });
    if (error) throw new Error(error.message || `Chyba pri GitHub operácii: ${action}`);
    if (data?.error) throw new Error(data.error);
    return data as T;
  }

  async getConnection(): Promise<GitHubConnection> {
    return this.callEdgeFunction<GitHubConnection>('get_connection');
  }

  async connect(token: string): Promise<GitHubConnection> {
    return this.callEdgeFunction<GitHubConnection>('connect', { token });
  }

  async disconnect(): Promise<void> {
    await this.callEdgeFunction<void>('disconnect');
  }

  async listRepositories(): Promise<Repository[]> {
    return this.callEdgeFunction<Repository[]>('list_repositories');
  }

  async syncRepository(repoId: string): Promise<Repository> {
    // Note: sync_repository returns a simple { ok: true } from edge function,
    // so we return a dummy Repository or let it be handled.
    await this.callEdgeFunction<any>('sync_repository', { repoId });
    const repos = await this.listRepositories();
    const updated = repos.find(r => r.id === repoId);
    if (!updated) throw new Error('Repozitár sa nenašiel po synchronizácii');
    return updated;
  }

  async listWorkflowRuns(): Promise<WorkflowRun[]> {
    return this.callEdgeFunction<WorkflowRun[]>('list_workflow_runs');
  }

  async listPullRequests(): Promise<PullRequest[]> {
    return this.callEdgeFunction<PullRequest[]>('list_prs');
  }

  async reviewPullRequestWithAI(prId: string): Promise<{ summary: string }> {
    return this.callEdgeFunction<{ summary: string }>('review_pr', { prId });
  }

  async listAuditEvents(): Promise<AuditEvent[]> {
    return this.callEdgeFunction<AuditEvent[]>('list_audit_log');
  }
}

export const githubService: GitHubService = new RealGitHubService();
