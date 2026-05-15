import { useState } from 'react';
import { Mail, MailOpen, Trash2, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import DashboardCard from '@/components/dashboard/DashboardCard';
import { LoadingState, EmptyState } from '@/components/dashboard/States';
import { useInquiries } from '@/lib/wordpress/content/useInquiries';
import type { Inquiry, InquiryFileRef } from '@/lib/wordpress/content/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

function isFileRef(v: unknown): v is InquiryFileRef {
  return !!v && typeof v === 'object' && typeof (v as { path?: unknown }).path === 'string';
}

async function openAttachment(ref: InquiryFileRef) {
  const { data, error } = await supabase.storage.from('inquiry-attachments').createSignedUrl(ref.path, 300);
  if (error || !data?.signedUrl) { toast.error('Nepodarilo sa vygenerovať odkaz.'); return; }
  window.open(data.signedUrl, '_blank', 'noopener');
}

export default function InquiryInbox({ siteId }: { siteId: string }) {
  const { inquiries, isLoading, markRead, remove } = useInquiries(siteId);
  const [open, setOpen] = useState<Inquiry | null>(null);

  const exportCsv = () => {
    if (!inquiries.length) return;
    const rows = [
      ['date', 'name', 'email', 'phone', 'message', 'source_url'],
      ...inquiries.map((i) => [i.created_at, i.name ?? '', i.email ?? '', i.phone ?? '', (i.message ?? '').replace(/\n/g, ' '), i.source_url ?? '']),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `inquiries-${siteId}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardCard
      title="✉️ Dopyty"
      description="Submissions z verejného formulára."
      actions={<Button size="sm" variant="outline" onClick={exportCsv} disabled={!inquiries.length}>Export CSV</Button>}
    >
      <div className="px-6 py-4">
        {isLoading ? <LoadingState /> : inquiries.length === 0 ? (
          <EmptyState title="Zatiaľ žiadne dopyty" description="Po prvých submissions sa tu zobrazia." icon={<Mail size={20} />} />
        ) : (
          <div className="space-y-2">
            {inquiries.map((i) => (
              <div key={i.id} className={`flex items-start gap-3 p-3 border rounded-lg ${i.read ? 'border-border bg-card' : 'border-primary/40 bg-primary/5'}`}>
                <button onClick={() => markRead({ id: i.id, read: !i.read })} aria-label="Toggle read">
                  {i.read ? <MailOpen size={16} className="text-muted-foreground" /> : <Mail size={16} className="text-primary" />}
                </button>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setOpen(i); if (!i.read) markRead({ id: i.id, read: true }); }}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{i.name || i.email || '—'}</span>
                    {i.email && <span className="text-xs text-muted-foreground truncate">{i.email}</span>}
                    {!i.read && <Badge className="text-[10px]">nové</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{i.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(i.created_at).toLocaleString()}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { if (confirm('Zmazať?')) remove(i.id); }}><Trash2 size={14} /></Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur flex items-center justify-center p-4" onClick={() => setOpen(null)}>
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold">{open.name || open.email}</h3>
            <div className="text-xs text-muted-foreground space-y-0.5">
              {open.email && <div><b>Email:</b> {open.email}</div>}
              {open.phone && <div><b>Telefón:</b> {open.phone}</div>}
              {open.source_url && <div><b>Zdroj:</b> {open.source_url}</div>}
              <div><b>Dátum:</b> {new Date(open.created_at).toLocaleString()}</div>
            </div>
            <pre className="text-xs whitespace-pre-wrap bg-muted p-3 rounded">{open.message}</pre>
            {(() => {
              const attachments = Object.entries(open.payload ?? {}).filter(([, v]) => isFileRef(v)) as [string, InquiryFileRef][];
              if (!attachments.length) return null;
              return (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Prílohy</div>
                  {attachments.map(([key, ref]) => (
                    <button key={key} onClick={() => openAttachment(ref)} className="flex items-center gap-2 text-xs text-primary hover:underline">
                      <Paperclip size={12} /> {ref.name} <span className="text-muted-foreground">({Math.round((ref.size ?? 0) / 1024)} KB)</span>
                    </button>
                  ))}
                </div>
              );
            })()}
            {Object.keys(open.payload ?? {}).length > 0 && (
              <details><summary className="text-xs cursor-pointer">Plný payload</summary>
                <pre className="text-[10px] bg-muted p-2 rounded mt-2 overflow-auto">{JSON.stringify(open.payload, null, 2)}</pre>
              </details>
            )}
            <div className="flex justify-end"><Button variant="outline" onClick={() => setOpen(null)}>Zavrieť</Button></div>
          </div>
        </div>
      )}
    </DashboardCard>
  );
}
