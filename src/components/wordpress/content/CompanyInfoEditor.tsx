import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import DashboardCard from '@/components/dashboard/DashboardCard';
import { LoadingState } from '@/components/dashboard/States';
import { useStatic } from '@/lib/wordpress/content/useSiteContent';
import type { CompanyInfo } from '@/lib/wordpress/content/types';
import ImageUpload from './ImageUpload';

export default function CompanyInfoEditor({ siteId }: { siteId: string }) {
  const { data, isLoading, upsert, upserting } = useStatic<CompanyInfo>(siteId, 'company');
  const [form, setForm] = useState<Partial<CompanyInfo>>({});

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const set = <K extends keyof CompanyInfo>(k: K, v: CompanyInfo[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const setSocial = (k: string, v: string) =>
    setForm((p) => ({ ...p, social: { ...(p.social ?? {}), [k]: v } }));

  if (isLoading) return <LoadingState />;

  return (
    <DashboardCard title="🏢 Company info" description="Hlavné firemné údaje – jeden záznam per site.">
      <div className="px-6 py-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Názov firmy"><Input value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Tagline"><Input value={form.tagline ?? ''} onChange={(e) => set('tagline', e.target.value)} /></Field>
          <Field label="E-mail"><Input type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
          <Field label="Telefón"><Input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label="Adresa" className="md:col-span-2"><Input value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} /></Field>
          <Field label="IČO / VAT"><Input value={form.vat_id ?? ''} onChange={(e) => set('vat_id', e.target.value)} /></Field>
        </div>

        <Field label="Popis"><Textarea rows={3} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} /></Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ImageUpload siteId={siteId} label="Logo" value={form.logo_url} onChange={(url) => set('logo_url', url)} />
          <ImageUpload siteId={siteId} label="Cover obrázok" value={form.cover_url} onChange={(url) => set('cover_url', url)} />
        </div>

        <div>
          <Label className="text-xs font-medium text-muted-foreground">Sociálne siete</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
            {(['facebook', 'instagram', 'linkedin', 'youtube'] as const).map((k) => (
              <Input
                key={k}
                placeholder={`https://${k}.com/...`}
                value={form.social?.[k] ?? ''}
                onChange={(e) => setSocial(k, e.target.value)}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={() => upsert(form)} disabled={upserting} className="gap-2">
            <Save size={14} /> {upserting ? 'Ukladám…' : 'Uložiť'}
          </Button>
        </div>
      </div>
    </DashboardCard>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</Label>
      {children}
    </div>
  );
}
