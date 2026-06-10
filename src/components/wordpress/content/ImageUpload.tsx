import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { uploadSiteImage } from '@/lib/wordpress/content/useSiteContent';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  siteId: string;
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  className?: string;
}

export default function ImageUpload({ siteId, value, onChange, label, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nie ste prihlásený');
      if (file.size > 5 * 1024 * 1024) throw new Error('Max 5 MB');
      if (!file.type.startsWith('image/')) throw new Error('Iba obrázky');
      const url = await uploadSiteImage(user.id, siteId, file);
      onChange(url);
    } catch (e) {
      toast.error('Upload zlyhal', { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      {label && <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>}
      <div className="flex items-start gap-3">
        {value ? (
          <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-border bg-muted">
            <img src={value} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute top-1 right-1 p-1 rounded-full bg-background/80 hover:bg-background"
              aria-label="Odstrániť"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="w-24 h-24 rounded-lg border border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-foreground transition"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
            <span className="text-[10px]">Nahrať</span>
          </button>
        )}
        {value && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            {busy ? 'Nahrávam…' : 'Zmeniť'}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
