import { useEffect, useState } from 'react';
import { Plus, Save, Trash2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import DashboardCard from '@/components/dashboard/DashboardCard';
import { LoadingState } from '@/components/dashboard/States';
import { useInquiryForm } from '@/lib/wordpress/content/useInquiries';
import type { InquiryFormField } from '@/lib/wordpress/content/types';
import { toast } from 'sonner';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export default function InquiryFormBuilder({ siteId }: { siteId: string }) {
  const { form, isLoading, upsert, saving, defaultFields } = useInquiryForm(siteId);
  const [fields, setFields] = useState<InquiryFormField[]>(defaultFields);
  const [name, setName] = useState('Default');
  const [recipient, setRecipient] = useState('');
  const [success, setSuccess] = useState('Ďakujeme, ozveme sa.');

  useEffect(() => {
    if (form) {
      setFields(form.fields ?? defaultFields);
      setName(form.name ?? 'Default');
      setRecipient(form.recipient_email ?? '');
      setSuccess(form.success_message ?? 'Ďakujeme, ozveme sa.');
    }
  }, [form, defaultFields]);

  const snippet = `<div data-lvb-form="default" data-site="${siteId}"></div>
<script src="${SUPABASE_URL}/storage/v1/object/public/wp-content-images/embed/inquiry-embed.js" defer></script>
<!-- alebo hostuj inquiry-embed.js sám -->`;

  const copy = () => { navigator.clipboard.writeText(snippet); toast.success('Skopírované'); };

  if (isLoading) return <LoadingState />;
  return (
    <DashboardCard title="📝 Formulár dopytov" description="Definuj polia a získaj embed snippet.">
      <div className="px-6 py-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label className="text-xs text-muted-foreground">Názov</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label className="text-xs text-muted-foreground">Notifikačný e-mail</Label><Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="info@firma.sk" /></div>
          <div className="md:col-span-2"><Label className="text-xs text-muted-foreground">Success správa</Label><Input value={success} onChange={(e) => setSuccess(e.target.value)} /></div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs text-muted-foreground">Polia</Label>
            <Button size="sm" variant="outline" className="gap-1 h-7" onClick={() => setFields([...fields, { key: `field_${fields.length}`, label: 'Nové pole', type: 'text' }])}>
              <Plus size={12} /> Pridať pole
            </Button>
          </div>
          <div className="space-y-2">
            {fields.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input className="w-32" value={f.key} onChange={(e) => setFields(fields.map((x, j) => j === i ? { ...x, key: e.target.value } : x))} placeholder="key" />
                <Input value={f.label} onChange={(e) => setFields(fields.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Label" />
                <select
                  className="border border-input bg-background h-9 px-2 rounded-md text-sm"
                  value={f.type}
                  onChange={(e) => setFields(fields.map((x, j) => j === i ? { ...x, type: e.target.value as InquiryFormField['type'] } : x))}
                >
                  <option value="text">text</option>
                  <option value="email">email</option>
                  <option value="tel">tel</option>
                  <option value="textarea">textarea</option>
                </select>
                <div className="flex items-center gap-1"><Switch checked={!!f.required} onCheckedChange={(v) => setFields(fields.map((x, j) => j === i ? { ...x, required: v } : x))} /><span className="text-[10px] text-muted-foreground">povinné</span></div>
                <Button variant="ghost" size="icon" onClick={() => setFields(fields.filter((_, j) => j !== i))}><Trash2 size={14} /></Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => upsert({ name, fields, recipient_email: recipient || null, success_message: success })} disabled={saving} className="gap-2">
            <Save size={14} /> {saving ? 'Ukladám…' : 'Uložiť'}
          </Button>
        </div>

        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs text-muted-foreground">Embed snippet</Label>
            <Button size="sm" variant="outline" onClick={copy} className="gap-1 h-7"><Copy size={12} /> Skopírovať</Button>
          </div>
          <pre className="text-[11px] bg-muted p-3 rounded-lg overflow-auto whitespace-pre-wrap">{snippet}</pre>
        </div>
      </div>
    </DashboardCard>
  );
}
