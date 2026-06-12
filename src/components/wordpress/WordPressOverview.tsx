import { useQuery } from '@tanstack/react-query';
import DashboardCard from '@/components/dashboard/DashboardCard';
import { Settings } from 'lucide-react';
import { LoadingState } from '@/components/dashboard/States';
import { getPublicWordPressStats } from '@/lib/wordpress/publicWordPressApi';

interface WPSite {
  id: string;
  label: string;
  base_url: string;
  site_type: 'com' | 'self';
}

export default function WordPressOverview({ site }: { site: WPSite }) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['wp_stats', site.id],
    queryFn: () => getPublicWordPressStats(site.base_url, site.id),
  });

  if (isLoading) return <LoadingState />;

  return (
    <>
      <DashboardCard
        title="📊 Overview"
        description={`${site.label} – ${site.base_url}`}
        icon={<Settings size={16} />}
      >
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 px-6 py-5">
          <StatTile label="Posty" value={stats?.posts} icon="📝" />
          <StatTile label="Stránky" value={stats?.pages} icon="📄" />
          <StatTile label="Komentáre" value={stats?.comments} icon="💬" />
          <StatTile label="Používatelia" value={stats?.users} icon="👥" />
          <StatTile label="Médiá" value={stats?.media} icon="🖼️" />
          <StatTile label="Custom API" value={stats?.customNamespaces.length ?? 0} icon="🔌" />
        </div>
      </DashboardCard>
    </>
  );
}

function StatTile({ label, value, icon }: { label: string; value: number | string | undefined; icon: string }) {
  return (
    <div className="p-4 rounded-lg bg-muted/30 border border-border">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-[11px] text-muted-foreground uppercase font-medium">{label}</div>
      <div className="text-lg font-semibold text-foreground mt-1">{value}</div>
    </div>
  );
}
