import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, LockKeyhole, RefreshCw, XCircle } from 'lucide-react';
import DashboardCard from '@/components/dashboard/DashboardCard';
import StatusBadge from '@/components/dashboard/StatusBadge';
import { LoadingState } from '@/components/dashboard/States';
import { runPublicWordPressChecks, type PublicWpCheck } from '@/lib/wordpress/publicWordPressApi';

export default function WordPressApiTester({ baseUrl, siteId }: { baseUrl: string, siteId?: string }) {
  const { data = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['wp_public_checks', baseUrl, siteId],
    queryFn: () => runPublicWordPressChecks(baseUrl, siteId),
    enabled: !!baseUrl,
  });

  const summary = useMemo(() => {
    const ok = data.filter(item => item.status === 'ok').length;
    const protectedCount = data.filter(item => item.status === 'protected').length;
    const errors = data.filter(item => item.status === 'error').length;
    return { ok, protectedCount, errors, total: data.length };
  }, [data]);

  return (
    <DashboardCard
      title="WordPress REST API test"
      description="Bezpečné read-only kontroly verejných endpointov. Chránené admin endpointy sa len overia, nemažú ani nemenia dáta."
      icon={<CheckCircle2 size={16} />}
      actions={
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
          Re-test
        </button>
      }
    >
      {isLoading ? (
        <LoadingState label="Testujem WordPress REST API..." />
      ) : (
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={summary.errors ? 'error' : 'success'} label={`${summary.ok} OK`} />
            <StatusBadge tone="warning" label={`${summary.protectedCount} chránené OK`} />
            <StatusBadge tone="muted" label={`${summary.total} spolu`} />
          </div>

          <div className="grid gap-2">
            {data.map(check => (
              <CheckRow key={check.endpoint} check={check} />
            ))}
          </div>
        </div>
      )}
    </DashboardCard>
  );
}

function CheckRow({ check }: { check: PublicWpCheck }) {
  const icon = check.status === 'ok'
    ? <CheckCircle2 size={14} className="text-success" />
    : check.status === 'protected'
      ? <LockKeyhole size={14} className="text-warning" />
      : <XCircle size={14} className="text-destructive" />;

  const badge = check.status === 'ok'
    ? <StatusBadge tone="success" label={`HTTP ${check.httpStatus}`} />
    : check.status === 'protected'
      ? <StatusBadge tone="warning" label={`HTTP ${check.httpStatus} OK`} />
      : <StatusBadge tone="error" label={check.httpStatus ? `HTTP ${check.httpStatus}` : 'Network'} />;

  return (
    <div className="rounded-xl border border-border bg-background/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 shrink-0">{icon}</span>
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">{check.label}</div>
            <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{check.endpoint}</div>
            <div className="mt-1 text-xs text-muted-foreground">{check.detail}</div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {badge}
          <span className="font-mono text-[10px] text-muted-foreground">{check.durationMs} ms</span>
        </div>
      </div>
    </div>
  );
}
