import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/lib/admin';
import { useQuery } from '@tanstack/react-query';
import { 
  FileText, Plus, ArrowLeft, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import DashboardCard from '@/components/dashboard/DashboardCard';
import { LoadingState, EmptyState } from '@/components/dashboard/States';
import WordPressSiteSelector from '@/components/wordpress/WordPressSiteSelector';
import AddSiteDialog from '@/components/wordpress/AddSiteDialog';
import WordPressOverview from '@/components/wordpress/WordPressOverview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CompanyInfoEditor from '@/components/wordpress/content/CompanyInfoEditor';
import AboutEditor from '@/components/wordpress/content/AboutEditor';
import HeaderEditor from '@/components/wordpress/content/HeaderEditor';
import FooterEditor from '@/components/wordpress/content/FooterEditor';
import ServicesManager from '@/components/wordpress/content/ServicesManager';
import ReferencesManager from '@/components/wordpress/content/ReferencesManager';
import NewsManager from '@/components/wordpress/content/NewsManager';
import MembersManager from '@/components/wordpress/content/MembersManager';
import InquiryInbox from '@/components/wordpress/content/InquiryInbox';
import InquiryFormBuilder from '@/components/wordpress/content/InquiryFormBuilder';

interface WPSite {
  id: string;
  label: string;
  base_url: string;
  site_type: 'com' | 'self';
}

export default function WordPressDashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAdminAuth();
  
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [showAddSite, setShowAddSite] = useState(false);

  // Auth gate – any signed-in user can access
  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate('/', { replace: true });
  }, [authLoading, user, navigate]);

  // Load sites
  const { data: sites = [], isLoading: sitesLoading, refetch } = useQuery<WPSite[]>({
    queryKey: ['wp_sites', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wp_sites')
        .select('id, label, base_url, site_type')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as WPSite[];
    },
    enabled: !!user,
  });


  useEffect(() => {
    if (sites.length > 0 && !selectedSiteId) {
      setSelectedSiteId(sites[0].id);
    }
  }, [sites, selectedSiteId]);

  const selectedSite = sites.find(s => s.id === selectedSiteId);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition"
              title="Späť"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <FileText size={18} className="text-blue-500" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-foreground">WordPress Manager</h1>
              <p className="text-[11px] text-muted-foreground">Správa WP stránok a obsahu</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddSite(true)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-full text-xs font-medium hover:opacity-90"
          >
            <Plus size={14} /> Pripojiť WP site
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {sitesLoading ? (
          <LoadingState />
        ) : sites.length === 0 ? (
          <EmptyState
            title="Žiadne WordPress sites"
            description="Pripojte svoj prvý WordPress.com alebo self-hosted WordPress."
            icon={<FileText size={24} />}
          />
        ) : (
          <>
            <WordPressSiteSelector
              sites={sites}
              selectedSiteId={selectedSiteId}
              onSelect={setSelectedSiteId}
              onDelete={() => refetch()}
              onAddNew={() => setShowAddSite(true)}
            />

            {selectedSite && (
              <>
                <WordPressOverview site={selectedSite} />
                <Tabs defaultValue="company" className="w-full">
                  <TabsList className="flex flex-wrap h-auto">
                    <TabsTrigger value="company">Company</TabsTrigger>
                    <TabsTrigger value="about">About</TabsTrigger>
                    <TabsTrigger value="header">Header</TabsTrigger>
                    <TabsTrigger value="footer">Footer</TabsTrigger>
                    <TabsTrigger value="services">Services</TabsTrigger>
                    <TabsTrigger value="references">References</TabsTrigger>
                    <TabsTrigger value="news">News</TabsTrigger>
                    <TabsTrigger value="members">Members</TabsTrigger>
                    <TabsTrigger value="inquiries">Inquiries</TabsTrigger>
                    <TabsTrigger value="form">Form & Embed</TabsTrigger>
                    <TabsTrigger value="wpcli">WP-CLI</TabsTrigger>
                  </TabsList>
                  <TabsContent value="company"><CompanyInfoEditor siteId={selectedSite.id} /></TabsContent>
                  <TabsContent value="about"><AboutEditor siteId={selectedSite.id} /></TabsContent>
                  <TabsContent value="header"><HeaderEditor siteId={selectedSite.id} /></TabsContent>
                  <TabsContent value="footer"><FooterEditor siteId={selectedSite.id} /></TabsContent>
                  <TabsContent value="services"><ServicesManager siteId={selectedSite.id} /></TabsContent>
                  <TabsContent value="references"><ReferencesManager siteId={selectedSite.id} /></TabsContent>
                  <TabsContent value="news"><NewsManager siteId={selectedSite.id} /></TabsContent>
                  <TabsContent value="members"><MembersManager siteId={selectedSite.id} /></TabsContent>
                  <TabsContent value="inquiries"><InquiryInbox siteId={selectedSite.id} /></TabsContent>
                  <TabsContent value="form"><InquiryFormBuilder siteId={selectedSite.id} /></TabsContent>
                  <TabsContent value="wpcli"><WPCLIManager siteId={selectedSite.id} /></TabsContent>
                </Tabs>
              </>
            )}
          </>
        )}
      </main>

      {/* Add Site Dialog */}
      <AddSiteDialog
        open={showAddSite}
        onOpenChange={setShowAddSite}
        onSuccess={() => {
          setShowAddSite(false);
          refetch();
          toast.success('WordPress site pripojený');
        }}
      />
    </div>
  );
}