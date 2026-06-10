import { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DashboardCard from '@/components/dashboard/DashboardCard';
import { LoadingState } from '@/components/dashboard/States';
import { useStatic } from '@/lib/wordpress/content/useSiteContent';
import type { HeaderData, MenuLink } from '@/lib/wordpress/content/types';
import ImageUpload from './ImageUpload';

export default function HeaderEditor({ siteId }: { siteId: string }) {
  const { data, isLoading, upsert, upserting } = useStatic<HeaderData>(siteId, 'header');
  const [form, setForm] = useState<Partial<HeaderData>>({ menu: [] });
  useEffect(() => { if (data) setForm({ ...data, menu: data.menu ?? [] }); }, [data]);

  const updateMenu = (idx: number, patch: Partial<MenuLink>) =>
    setForm((p) => ({ ...p, menu: (p.menu ?? []).map((m, i) => i === idx ? { ...m, ...patch } : m) }));
  const addMenu = () => setForm((p) => ({ ...p, menu: [...(p.menu ?? []), { label: '', url: '', order: (p.menu ?? []).length }] }));
  const removeMenu = (idx: number) => setForm((p) => ({ ...p, menu: (p.menu ?? []).filter((_, i) => i !== idx) }));

  if (isLoading) return <LoadingState />;
  return (
    <DashboardCard title="🧭 Header" description="Logo, menu a CTA tlačidlo.">
      <div className="px-6 py-5 space-y-5">
        <ImageUpload siteId={siteId} label="Logo" value={form.logo_url} onChange={(url) => setForm((p) => ({ ...p, logo_url: url }))} />

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs text-muted-foreground">Menu položky</Label>
            <Button variant="outline" size="sm" onClick={addMenu} className="gap-1 h-7"><Plus size={12} /> Pridať</Button>
          </div>
          <div className="space-y-2">
            {(form.menu ?? []).map((m, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input placeholder="Label" value={m.label} onChange={(e) => updateMenu(i, { label: e.target.value })} />
                <Input placeholder="/url" value={m.url} onChange={(e) => updateMenu(i, { url: e.target.value })} />
                <Button variant="ghost" size="icon" onClick={() => removeMenu(i)}><Trash2 size={14} /></Button>
              </div>
            ))}
            {(form.menu ?? []).length === 0 && <p className="text-xs text-muted-foreground">Žiadne položky.</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs text-muted-foreground">CTA label</Label><Input value={form.cta_label ?? ''} onChange={(e) => setForm((p) => ({ ...p, cta_label: e.target.value }))} /></div>
          <div><Label className="text-xs text-muted-foreground">CTA URL</Label><Input value={form.cta_url ?? ''} onChange={(e) => setForm((p) => ({ ...p, cta_url: e.target.value }))} /></div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => upsert({ ...form, menu: (form.menu ?? []).map((m, i) => ({ ...m, order: i })) })} disabled={upserting} className="gap-2">
            <Save size={14} /> {upserting ? 'Ukladám…' : 'Uložiť'}
          </Button>
        </div>
      </div>
    </DashboardCard>
  );
}
