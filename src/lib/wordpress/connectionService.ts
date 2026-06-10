import { supabase } from '@/integrations/supabase/client';

export interface SaveWordPressConnectionInput {
  siteId?: string;
  label: string;
  baseUrl: string;
  username: string;
  applicationPassword: string;
}

export interface SavedWordPressConnection {
  id: string;
  label: string;
  base_url: string;
  site_type: string;
  username: string | null;
  last_sync_at: string | null;
  created_at: string;
}

interface SaveWordPressConnectionResponse {
  ok?: boolean;
  error?: string;
  httpStatus?: number;
  site?: SavedWordPressConnection;
  wpUser?: {
    id: number;
    name: string;
    slug: string;
    roles: string[];
    capabilities: string[];
  };
}

export async function saveValidatedWordPressConnection(input: SaveWordPressConnectionInput) {
  const { data, error } = await supabase.functions.invoke<SaveWordPressConnectionResponse>('wordpress-connection', {
    body: {
      action: 'save',
      siteId: input.siteId,
      label: input.label,
      baseUrl: input.baseUrl,
      username: input.username,
      appPassword: input.applicationPassword,
    },
  });

  if (error) {
    const ctx = (error as { context?: Response }).context;
    if (ctx) {
      try {
        const body = await ctx.json() as SaveWordPressConnectionResponse;
        if (body?.error) {
          throw new Error(body.error);
        }
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message !== error.message) {
          throw parseError;
        }
      }
    }
    throw new Error(error.message || 'Nepodarilo sa uložiť WordPress pripojenie.');
  }

  if (!data?.ok || !data.site) {
    const suffix = data?.httpStatus ? ` HTTP ${data.httpStatus}.` : '';
    throw new Error(`${data?.error ?? 'Nepodarilo sa uložiť WordPress pripojenie.'}${suffix}`);
  }

  return data;
}
