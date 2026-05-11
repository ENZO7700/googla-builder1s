import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  STATIC_TABLE,
  REPEATER_TABLE,
  type StaticKind,
  type RepeaterKind,
} from './types';

// ============= STATIC (singleton) =============

export function useStatic<T extends Record<string, unknown>>(siteId: string | null, kind: StaticKind) {
  const qc = useQueryClient();
  const table = STATIC_TABLE[kind];

  const query = useQuery({
    queryKey: ['wp_static', kind, siteId],
    queryFn: async () => {
      if (!siteId) return null;
      const { data, error } = await supabase
        .from(table as never)
        .select('*')
        .eq('site_id', siteId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as T | null;
    },
    enabled: !!siteId,
  });

  const upsert = useMutation({
    mutationFn: async (values: Partial<T>) => {
      if (!siteId) throw new Error('No site selected');
      const payload = { ...values, site_id: siteId } as Record<string, unknown>;
      const { data, error } = await supabase
        .from(table as never)
        .upsert(payload as never, { onConflict: 'site_id' })
        .select()
        .single();
      if (error) throw error;
      return data as T;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wp_static', kind, siteId] });
      toast.success('Uložené');
    },
    onError: (e: Error) => toast.error('Chyba pri ukladaní', { description: e.message }),
  });

  return { ...query, upsert: upsert.mutate, upserting: upsert.isPending };
}

// ============= REPEATER =============

export function useRepeater<T extends { id?: string; order_index: number }>(
  siteId: string | null,
  kind: RepeaterKind,
) {
  const qc = useQueryClient();
  const table = REPEATER_TABLE[kind];

  const query = useQuery({
    queryKey: ['wp_repeater', kind, siteId],
    queryFn: async () => {
      if (!siteId) return [] as T[];
      const { data, error } = await supabase
        .from(table as never)
        .select('*')
        .eq('site_id', siteId)
        .order('order_index', { ascending: true });
      if (error) throw error;
      return (data ?? []) as T[];
    },
    enabled: !!siteId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['wp_repeater', kind, siteId] });

  const create = useMutation({
    mutationFn: async (values: Partial<T>) => {
      if (!siteId) throw new Error('No site selected');
      const payload = { ...values, site_id: siteId } as Record<string, unknown>;
      const { data, error } = await supabase
        .from(table as never)
        .insert(payload as never)
        .select()
        .single();
      if (error) throw error;
      return data as T;
    },
    onSuccess: () => { invalidate(); toast.success('Pridané'); },
    onError: (e: Error) => toast.error('Chyba', { description: e.message }),
  });

  const update = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<T> }) => {
      const { data, error } = await supabase
        .from(table as never)
        .update(values as never)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as T;
    },
    onSuccess: () => { invalidate(); toast.success('Uložené'); },
    onError: (e: Error) => toast.error('Chyba', { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table as never).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Zmazané'); },
    onError: (e: Error) => toast.error('Chyba', { description: e.message }),
  });

  const reorder = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      // Sequential update; for small lists this is fine.
      await Promise.all(
        orderedIds.map((id, idx) =>
          supabase.from(table as never).update({ order_index: idx } as never).eq('id', id),
        ),
      );
    },
    onSuccess: () => invalidate(),
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    create: create.mutate,
    update: update.mutate,
    remove: remove.mutate,
    reorder: reorder.mutate,
    creating: create.isPending,
    updating: update.isPending,
    removing: remove.isPending,
  };
}

// ============= IMAGE UPLOAD =============

export async function uploadSiteImage(
  userId: string,
  siteId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'bin';
  const path = `${userId}/${siteId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('wp-content-images')
    .upload(path, file, { upsert: false, cacheControl: '3600' });
  if (error) throw error;
  const { data } = supabase.storage.from('wp-content-images').getPublicUrl(path);
  return data.publicUrl;
}

// ============= SYNC TO WP =============

export async function syncToWordPress(args: {
  siteId: string;
  entity: 'about' | 'service' | 'reference' | 'news';
  recordId: string;
}): Promise<{ wp_post_id: number }> {
  const { data, error } = await supabase.functions.invoke('wordpress-sync', { body: args });
  if (error) throw new Error(error.message);
  return data as { wp_post_id: number };
}
