import { MoreVertical, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WPSite {
  id: string;
  label: string;
  base_url: string;
  site_type: 'com' | 'self';
}

export default function WordPressSiteSelector({
  sites,
  selectedSiteId,
  onSelect,
  onDelete,
  onAddNew,
}: {
  sites: WPSite[];
  selectedSiteId: string | null;
  onSelect: (id: string) => void;
  onDelete: () => void;
  onAddNew: () => void;
}) {
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Naozaj chcete odstrániť toto pripojenie?')) return;
    
    setDeleting(id);
    try {
      const { error } = await supabase.from('wp_sites').delete().eq('id', id);
      if (error) throw error;
      toast.success('Site odstránený');
      onDelete();
      onSelect(sites.find(s => s.id !== id)?.id || '');
    } catch (err: any) {
      toast.error('Chyba pri zmazaní', { description: err.message });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="flex gap-2 flex-wrap">
      {sites.map(site => (
        <div
          key={site.id}
          onClick={() => onSelect(site.id)}
          className={`flex-1 min-w-[200px] max-w-xs px-4 py-3 rounded-lg border-2 cursor-pointer transition ${
            selectedSiteId === site.id
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium text-sm text-foreground truncate">
                {site.label}
              </div>
              <div className="text-xs text-muted-foreground truncate mt-1">
                {site.base_url}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1.5">
                {site.site_type === 'com' ? '📘 WordPress.com' : '🖥️ Self-hosted'}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 hover:bg-accent rounded transition shrink-0">
                  <MoreVertical size={14} className="text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => handleDelete(site.id)}
                  disabled={deleting === site.id}
                  className="text-destructive"
                >
                  <Trash2 size={12} className="mr-2" /> 
                  {deleting === site.id ? 'Mazem...' : 'Odstrániť'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ))}
      <button
        onClick={onAddNew}
        className="flex-1 min-w-[200px] max-w-xs px-4 py-3 rounded-lg border-2 border-dashed border-border hover:border-primary text-muted-foreground hover:text-foreground transition text-sm font-medium"
      >
        + Pripojiť ďalší site
      </button>
    </div>
  );
}