import { describe, it, expect, vi, beforeEach } from 'vitest';
import { githubService } from './githubService';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => {
  const invokeFn = vi.fn();
  return {
    supabase: {
      functions: {
        invoke: invokeFn,
      },
    },
  };
});

describe('githubService (RealGitHubService wrapper)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getConnection calls github-connection edge function with get_connection action', async () => {
    const mockData = { status: 'connected', username: 'tester' };
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: mockData,
      error: null,
    });

    const result = await githubService.getConnection();

    expect(supabase.functions.invoke).toHaveBeenCalledWith('github-connection', {
      body: { action: 'get_connection' },
    });
    expect(result).toEqual(mockData);
  });

  it('connect calls github-connection edge function with connect action and token', async () => {
    const mockData = { status: 'connected', username: 'tester' };
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: mockData,
      error: null,
    });

    const result = await githubService.connect('ghp_test_token');

    expect(supabase.functions.invoke).toHaveBeenCalledWith('github-connection', {
      body: { action: 'connect', token: 'ghp_test_token' },
    });
    expect(result).toEqual(mockData);
  });

  it('disconnect calls github-connection edge function with disconnect action', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { ok: true },
      error: null,
    });

    await githubService.disconnect();

    expect(supabase.functions.invoke).toHaveBeenCalledWith('github-connection', {
      body: { action: 'disconnect' },
    });
  });

  it('listRepositories calls github-connection edge function with list_repositories action', async () => {
    const mockRepos = [{ id: '1', name: 'repo1', fullName: 'test/repo1' }];
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: mockRepos,
      error: null,
    });

    const result = await githubService.listRepositories();

    expect(supabase.functions.invoke).toHaveBeenCalledWith('github-connection', {
      body: { action: 'list_repositories' },
    });
    expect(result).toEqual(mockRepos);
  });

  it('listWorkflowRuns calls github-connection edge function with list_workflow_runs action', async () => {
    const mockRuns = [{ id: 'w1', status: 'success' }];
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: mockRuns,
      error: null,
    });

    const result = await githubService.listWorkflowRuns();

    expect(supabase.functions.invoke).toHaveBeenCalledWith('github-connection', {
      body: { action: 'list_workflow_runs' },
    });
    expect(result).toEqual(mockRuns);
  });

  it('listPullRequests calls github-connection edge function with list_prs action', async () => {
    const mockPRs = [{ id: 'pr1', number: 123 }];
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: mockPRs,
      error: null,
    });

    const result = await githubService.listPullRequests();

    expect(supabase.functions.invoke).toHaveBeenCalledWith('github-connection', {
      body: { action: 'list_prs' },
    });
    expect(result).toEqual(mockPRs);
  });

  it('reviewPullRequestWithAI calls github-connection edge function with review_pr action and prId', async () => {
    const mockReview = { summary: 'Looks good' };
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: mockReview,
      error: null,
    });

    const result = await githubService.reviewPullRequestWithAI('pr123');

    expect(supabase.functions.invoke).toHaveBeenCalledWith('github-connection', {
      body: { action: 'review_pr', prId: 'pr123' },
    });
    expect(result).toEqual(mockReview);
  });

  it('listAuditEvents calls github-connection edge function with list_audit_log action', async () => {
    const mockAudit = [{ id: 'a1', type: 'repo_sync' }];
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: mockAudit,
      error: null,
    });

    const result = await githubService.listAuditEvents();

    expect(supabase.functions.invoke).toHaveBeenCalledWith('github-connection', {
      body: { action: 'list_audit_log' },
    });
    expect(result).toEqual(mockAudit);
  });

  it('syncRepository calls sync_repository action and refetches repositories', async () => {
    const mockRepos = [{ id: 'repo123', name: 'repo1', fullName: 'test/repo1' }];
    
    // First invoke for sync_repository, second invoke for list_repositories
    vi.mocked(supabase.functions.invoke)
      .mockResolvedValueOnce({ data: { ok: true }, error: null })
      .mockResolvedValueOnce({ data: mockRepos, error: null });

    const result = await githubService.syncRepository('repo123');

    expect(supabase.functions.invoke).toHaveBeenNthCalledWith(1, 'github-connection', {
      body: { action: 'sync_repository', repoId: 'repo123' },
    });
    expect(supabase.functions.invoke).toHaveBeenNthCalledWith(2, 'github-connection', {
      body: { action: 'list_repositories' },
    });
    expect(result).toEqual(mockRepos[0]);
  });

  it('handles edge function error response', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { error: 'Invalid API Key' },
      error: null,
    });

    await expect(githubService.getConnection()).rejects.toThrow('Invalid API Key');
  });

  it('handles transport error response', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: { message: 'Network Timeout' } as any,
    });

    await expect(githubService.getConnection()).rejects.toThrow('Network Timeout');
  });
});
