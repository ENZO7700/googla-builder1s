import { useState } from 'react';
import { ArrowDown, ArrowUp, CloudUpload, Plus, Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import DashboardCard from '@/components/dashboard/DashboardCard';
import { LoadingState, EmptyState } from '@/components/dashboard/States';
import ImageUpload from './ImageUpload';
import { useRepeater, syncToWordPress } from '@/lib/wordpress/content/useSiteContent';
import type { RepeaterKind } from '@/lib/wordpress/content/types';
import { toast } from 'sonner';

export type FieldDef = {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'image' | 'url' | 'date';
  full?: boolean;
};

interface Props {
  siteId: string;
  kind: RepeaterKind;
  title: string;
  description?: string;
  fields: FieldDef[];
  primaryKey?: string; // field used as title in row preview
  syncEntity?: 'service' | 'reference' | 'news';
}

type Item = Record<string, unknown> & { id?: string; order_index: number; published: boolean; wp_post_id?: number | null };

export default function RepeaterManager({ siteId, kind, title, description, fields, primaryKey = 'title', syncEntity }: Props) {
  const { items, isLoading, create, update, remove, reorder, creating } = useRepeater<Item>(siteId, kind);
  const [editing, setEditing] = useState<Item | null>(null);

  const startNew = () => {
    const blank: Item = { order_index: items.length, published: true } as Item;
    fields.forEach((f) => { (blank as Record<string, unknown>)[f.key] = ''; });
    setEditing(blank);
  };

  const save = () => {
    if (!editing) return;
    if (editing.id) update({ id: editing.id, values: editing });
    else create(editing);
    setEditing(null);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...items];
    const t = idx + dir;
    if (t < 0 || t >= next.length) return;
    [next[idx], next[t]] = [next[t], next[idx]];
    reorder(next.map((i) => i.id!).filter(Boolean));
  };

  const handleSync = async (id: string) => {
    if (!syncEntity) return;
    try {
      await syncToWordPress({ siteId, entity: syncEntity, recordId: id });
      toast.success('Synchronizované do WordPressu');
    } catch (e) {
      toast.error('Sync zlyhal', { description: (e as Error).message });
    }
  };

  return (
    <DashboardCard
      title={title}
      description={description}
      actions={
        <Button size="sm" onClick={startNew} className="gap-2"><Plus size={14} /> Pridať</Button>
      }
    >
      <div className="px-6 py-4">
        {isLoading ? <LoadingState /> : items.length === 0 ? (
          <EmptyState title="Zatiaľ nič" description="Pridaj prvú položku tlačidlom hore." />
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-3 p-3 border border-border rounded-lg bg-card">
                <div className="flex flex-col">
                  <button className="p-0.5 text-muted-foreground hover:text-foreground" onClick={() => move(idx, -1)} aria-label="Hore"><ArrowUp size={12} /></button>
                  <button className="p-0.5 text-muted-foreground hover:text-foreground" onClick={() => move(idx, 1)} aria-label="Dole"><ArrowDown size={12} /></button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{String(item[primaryKey] ?? '—')}</div>
                  <div className="flex items-center gap-2 mt-1">
                    {item.published ? <Badge variant="secondary" className="text-[10px]">Publikované</Badge> : <Badge variant="outline" className="text-[10px]">Skryté</Badge>}
                    {item.wp_post_id ? <Badge className="text-[10px]">WP #{item.wp_post_id}</Badge> : null}
                  </div>
                </div>
                <Switch checked={!!item.published} onCheckedChange={(v) => update({ id: item.id!, values: { published: v } as Partial<Item> })} />
                {syncEntity && (
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => handleSync(item.id!)}>
                    <CloudUpload size={12} /> Sync
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setEditing(item)}>Upraviť</Button>
                <Button variant="ghost" size="icon" onClick={() => { if (confirm('Zmazať?')) remove(item.id!); }}><Trash2 size={14} /></Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <div className="border-t border-border bg-muted/30 px-6 py-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">{editing.id ? 'Upraviť položku' : 'Nová položka'}</h3>
            <Button variant="ghost" size="icon" onClick={() => setEditing(null)}><X size={14} /></Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map((f) => (
              <div key={f.key} className={f.full ? 'md:col-span-2' : ''}>
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                {f.type === 'textarea' ? (
                  <Textarea rows={5} value={String(editing[f.key] ?? '')} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} />
                ) : f.type === 'image' ? (
                  <ImageUpload siteId={siteId} value={editing[f.key] as string | null} onChange={(url) => setEditing({ ...editing, [f.key]: url })} />
                ) : f.type === 'date' ? (
                  <Input type="date" value={String(editing[f.key] ?? '').slice(0, 10)} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value || null })} />
                ) : (
                  <Input type={f.type === 'url' ? 'url' : 'text'} value={String(editing[f.key] ?? '')} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} />
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              <Switch checked={!!editing.published} onCheckedChange={(v) => setEditing({ ...editing, published: v })} />
              <Label className="text-xs">Publikované</Label>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Zrušiť</Button>
              <Button onClick={save} disabled={creating} className="gap-2"><Save size={14} /> Uložiť</Button>
            </div>
          </div>
        </div>
      )}
    </DashboardCard>
  );
}
