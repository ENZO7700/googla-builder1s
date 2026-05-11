import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_INQUIRY_FIELDS, type Inquiry, type InquiryForm, type InquiryFormField } from './types';

export function useInquiries(siteId: string | null) {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ['wp_inquiries', siteId],
    queryFn: async () => {
      if (!siteId) return [] as Inquiry[];
      const { data, error } = await supabase
        .from('wp_inquiries')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Inquiry[];
    },
    enabled: !!siteId,
  });

  const markRead = useMutation({
    mutationFn: async ({ id, read }: { id: string; read: boolean }) => {
      const { error } = await supabase.from('wp_inquiries').update({ read }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wp_inquiries', siteId] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('wp_inquiries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['wp_inquiries', siteId] }); toast.success('Zmazané'); },
  });

  return {
    inquiries: list.data ?? [],
    isLoading: list.isLoading,
    markRead: markRead.mutate,
    remove: remove.mutate,
  };
}

export function useInquiryForm(siteId: string | null, slug = 'default') {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['wp_inquiry_form', siteId, slug],
    queryFn: async () => {
      if (!siteId) return null;
      const { data, error } = await supabase
        .from('wp_inquiry_forms')
        .select('*')
        .eq('site_id', siteId)
        .eq('slug', slug)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as InquiryForm | null;
    },
    enabled: !!siteId,
  });

  const upsert = useMutation({
    mutationFn: async (values: Partial<InquiryForm>) => {
      if (!siteId) throw new Error('No site selected');
      const payload = {
        site_id: siteId,
        slug,
        name: values.name ?? 'Default',
        fields: (values.fields ?? DEFAULT_INQUIRY_FIELDS) as unknown as never,
        recipient_email: values.recipient_email ?? null,
        success_message: values.success_message ?? null,
      };
      const { data, error } = await supabase
        .from('wp_inquiry_forms')
        .upsert(payload as never, { onConflict: 'site_id,slug' })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as InquiryForm;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['wp_inquiry_form', siteId, slug] }); toast.success('Formulár uložený'); },
    onError: (e: Error) => toast.error('Chyba', { description: e.message }),
  });

  return {
    form: query.data ?? null,
    isLoading: query.isLoading,
    upsert: upsert.mutate,
    saving: upsert.isPending,
    defaultFields: DEFAULT_INQUIRY_FIELDS as InquiryFormField[],
  };
}
