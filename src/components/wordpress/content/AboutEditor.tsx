import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import DashboardCard from '@/components/dashboard/DashboardCard';
import { LoadingState } from '@/components/dashboard/States';
import { useStatic } from '@/lib/wordpress/content/useSiteContent';
import type { AboutInfo } from '@/lib/wordpress/content/types';
import ImageUpload from './ImageUpload';

export default function AboutEditor({ siteId }: { siteId: string }) {
  const { data, isLoading, upsert, upserting } = useStatic<AboutInfo>(siteId, 'about');
  const [form, setForm] = useState<Partial<AboutInfo>>({});
  useEffect(() => { if (data) setForm(data); }, [data]);
  const set = <K extends keyof AboutInfo>(k: K, v: AboutInfo[K]) => setForm((p) => ({ ...p, [k]: v }));

  if (isLoading) return <LoadingState />;
  return (
    <DashboardCard title="📖 About" description="Stránka O nás – sync sa robí ako WP Page.">
      <div className="px-6 py-5 space-y-4">
        <div><Label className="text-xs text-muted-foreground">Title</Label><Input value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} /></div>
        <div><Label className="text-xs text-muted-foreground">Subtitle</Label><Input value={form.subtitle ?? ''} onChange={(e) => set('subtitle', e.target.value)} /></div>
        <div><Label className="text-xs text-muted-foreground">Obsah (HTML)</Label><Textarea rows={10} value={form.content_html ?? ''} onChange={(e) => set('content_html', e.target.value)} /></div>
        <ImageUpload siteId={siteId} label="Cover obrázok" value={form.image_url} onChange={(url) => set('image_url', url)} />
        <div className="flex justify-end"><Button onClick={() => upsert(form)} disabled={upserting} className="gap-2"><Save size={14} /> {upserting ? 'Ukladám…' : 'Uložiť'}</Button></div>
      </div>
    </DashboardCard>
  );
}
