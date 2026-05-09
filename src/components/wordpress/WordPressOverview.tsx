import { useQuery } from '@tanstack/react-query';
import DashboardCard from '@/components/dashboard/DashboardCard';
import { FileText, Users, MessageSquare, Settings } from 'lucide-react';
import { LoadingState } from '@/components/dashboard/States';

interface WPSite {
  id: string;
  label: string;
  base_url: string;
  site_type: 'com' | 'self';
}

export default function WordPressOverview({ site }: { site: WPSite }) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['wp_stats', site.id],
    queryFn: async () => {
      // Mock data – nahraďte skutočným edge function call
      return {
        posts: 24,
        drafts: 3,
        comments: 156,
        users: 5,
        plugins: 12,
        wpVersion: '6.4.2',
      };
    },
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
          <StatTile label="Drafty" value={stats?.drafts} icon="✏️" />
          <StatTile label="Komentáre" value={stats?.comments} icon="💬" />
          <StatTile label="Používatelia" value={stats?.users} icon="👥" />
          <StatTile label="Pluginy" value={stats?.plugins} icon="🧩" />
          <StatTile label="WP verzia" value={stats?.wpVersion} icon="🔧" />
        </div>
      </DashboardCard>
    </>
  );
}

function StatTile({ label, value, icon }: { label: string; value: any; icon: string }) {
  return (
    <div className="p-4 rounded-lg bg-muted/30 border border-border">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-[11px] text-muted-foreground uppercase font-medium">{label}</div>
      <div className="text-lg font-semibold text-foreground mt-1">{value}</div>
    </div>
  );
}