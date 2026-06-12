/**
 * useCctServices — TanStack Query hook for JetEngine CCT services
 *
 * All calls go through Supabase Edge Function `wordpress-cct-proxy`.
 * No direct WordPress API calls from the frontend.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ServiceCctItemSchema } from '@/lib/wordpress/cct/services.schema';
import type { ServiceCctItem } from '@/lib/wordpress/cct/services.types';
import {
  normalizeCctProxyErrorPayload,
  normalizeCctProxyInvokeError,
} from '@/lib/wordpress/cct/proxyErrors';

const CCT_FUNCTION = 'wordpress-cct-proxy';
const CCT_SLUG = 'services' as const;

// ==================== PROXY CALLER ====================

interface CctProxyArgs {
  siteId: string;
  action: 'list' | 'get' | 'create' | 'update' | 'delete';
  itemId?: number;
  payload?: Record<string, unknown>;
  confirm?: boolean;
}

async function callCctProxy<T = unknown>(args: CctProxyArgs): Promise<T> {
  const { data, error } = await supabase.functions.invoke(CCT_FUNCTION, {
    body: { cct: CCT_SLUG, ...args },
  });

  if (error) {
    throw new Error(await normalizeCctProxyInvokeError(error));
  }

  // Edge function returns { ok: false, error } on validation errors
  if (data && typeof data === 'object' && 'ok' in data && data.ok === false) {
    throw new Error(normalizeCctProxyErrorPayload(data, 'Unknown proxy error'));
  }

  return data as T;
}

// ==================== QUERY KEY ====================

function cctQueryKey(siteId: string | null) {
  return ['cct_services', siteId] as const;
}

function cctDetailKey(siteId: string | null, itemId: number) {
  return ['cct_services', siteId, itemId] as const;
}

// ==================== HOOKS ====================

export function useCctServicesList(siteId: string | null) {
  return useQuery({
    queryKey: cctQueryKey(siteId),
    queryFn: async () => {
      if (!siteId) return [];
      const raw = await callCctProxy<unknown[]>({ siteId, action: 'list' });
      // JetEngine may return an object with data key or a plain array
      const items = Array.isArray(raw) ? raw : [];
      // Parse each item through Zod for type safety
      return items.map((item) => ServiceCctItemSchema.parse(item)) as ServiceCctItem[];
    },
    enabled: !!siteId,
  });
}

export function useCctServiceDetail(siteId: string | null, itemId: number | null) {
  return useQuery({
    queryKey: cctDetailKey(siteId, itemId ?? 0),
    queryFn: async () => {
      if (!siteId || !itemId) return null;
      const raw = await callCctProxy({ siteId, action: 'get', itemId });
      return ServiceCctItemSchema.parse(raw) as ServiceCctItem;
    },
    enabled: !!siteId && !!itemId,
  });
}

export function useCctServiceCreate(siteId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (!siteId) throw new Error('No site selected');
      return callCctProxy({ siteId, action: 'create', payload });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cctQueryKey(siteId) });
    },
  });
}

export function useCctServiceUpdate(siteId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, payload }: { itemId: number; payload: Record<string, unknown> }) => {
      if (!siteId) throw new Error('No site selected');
      return callCctProxy({ siteId, action: 'update', itemId, payload });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cctQueryKey(siteId) });
    },
  });
}

export function useCctServiceDelete(siteId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: number) => {
      if (!siteId) throw new Error('No site selected');
      return callCctProxy({ siteId, action: 'delete', itemId, confirm: true });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cctQueryKey(siteId) });
    },
  });
}

export function useCctServiceGenerateDraft(siteId: string | null) {
  return useMutation({
    mutationFn: async ({
      brief,
      mode,
      locale,
      existing,
    }: {
      brief: string;
      mode: 'create' | 'rewrite' | 'seo';
      locale: string;
      existing?: Record<string, unknown>;
    }) => {
      if (!siteId) throw new Error('No site selected');

      const { data, error } = await supabase.functions.invoke('wordpress-cct-draft', {
        body: { siteId, brief, mode, locale, existing },
      });

      if (error) {
        throw new Error(error.message || 'Draft generation failed');
      }

      if (data && typeof data === 'object' && 'ok' in data && data.ok === false) {
        throw new Error((data as { error?: string }).error || 'Draft generation error');
      }

      return data as {
        ok: true;
        draft: Record<string, unknown>;
        meta: { model: string; mode: string };
      };
    },
  });
}
