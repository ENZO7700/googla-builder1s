import { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DashboardCard from '@/components/dashboard/DashboardCard';
import { LoadingState } from '@/components/dashboard/States';
import { useStatic } from '@/lib/wordpress/content/useSiteContent';
import type { FooterColumn, FooterData } from '@/lib/wordpress/content/types';
import ImageUpload from './ImageUpload';

export default function FooterEditor({ siteId }: { siteId: string }) {
  const { data, isLoading, upsert, upserting } = useStatic<FooterData>(siteId, 'footer');
  const [form, setForm] = useState<Partial<FooterData>>({ columns: [], legal_links: [] });
  useEffect(() => { if (data) setForm({ ...data, columns: data.columns ?? [], legal_links: data.legal_links ?? [] }); }, [data]);

  const setCol = (i: number, patch: Partial<FooterColumn>) =>
    setForm((p) => ({ ...p, columns: (p.columns ?? []).map((c, idx) => idx === i ? { ...c, ...patch } : c) }));
  const setLink = (ci: number, li: number, patch: Partial<FooterColumn['links'][number]>) =>
    setForm((p) => ({
      ...p,
      columns: (p.columns ?? []).map((c, idx) =>
        idx === ci ? { ...c, links: c.links.map((l, j) => j === li ? { ...l, ...patch } : l) } : c,
      ),
    }));

  if (isLoading) return <LoadingState />;
  return (
    <DashboardCard title="🦶 Footer" description="Stĺpce s odkazmi, copyright a logo.">
      <div className="px-6 py-5 space-y-5">
        <ImageUpload siteId={siteId} label="Logo" value={form.logo_url} onChange={(url) => setForm((p) => ({ ...p, logo_url: url }))} />
        <div><Label className="text-xs text-muted-foreground">Copyright</Label><Input value={form.copyright ?? ''} onChange={(e) => setForm((p) => ({ ...p, copyright: e.target.value }))} /></div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs text-muted-foreground">Stĺpce</Label>
            <Button variant="outline" size="sm" onClick={() => setForm((p) => ({ ...p, columns: [...(p.columns ?? []), { title: '', links: [] }] }))} className="gap-1 h-7"><Plus size={12} /> Stĺpec</Button>
          </div>
          <div className="space-y-3">
            {(form.columns ?? []).map((col, ci) => (
              <div key={ci} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex gap-2">
                  <Input placeholder="Názov stĺpca" value={col.title} onChange={(e) => setCol(ci, { title: e.target.value })} />
                  <Button variant="ghost" size="icon" onClick={() => setForm((p) => ({ ...p, columns: (p.columns ?? []).filter((_, i) => i !== ci) }))}><Trash2 size={14} /></Button>
                </div>
                {col.links.map((l, li) => (
                  <div key={li} className="flex gap-2 ml-4">
                    <Input placeholder="Label" value={l.label} onChange={(e) => setLink(ci, li, { label: e.target.value })} />
                    <Input placeholder="/url" value={l.url} onChange={(e) => setLink(ci, li, { url: e.target.value })} />
                    <Button variant="ghost" size="icon" onClick={() => setCol(ci, { links: col.links.filter((_, j) => j !== li) })}><Trash2 size={14} /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="ml-4 h-7" onClick={() => setCol(ci, { links: [...col.links, { label: '', url: '' }] })}>+ Link</Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end"><Button onClick={() => upsert(form)} disabled={upserting} className="gap-2"><Save size={14} /> {upserting ? 'Ukladám…' : 'Uložiť'}</Button></div>
      </div>
    </DashboardCard>
  );
}
