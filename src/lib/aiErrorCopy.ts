export type AiErrorKind = '401' | '402' | '429' | '5xx' | 'network' | 'timeout' | 'unknown';

export interface AiErrorCopy {
  kind: AiErrorKind;
  title: string;
  message: string;
  action: string;
}

export interface AiErrorInput {
  status?: number;
  message?: string;
  name?: string;
}

const COPY: Record<AiErrorKind, Omit<AiErrorCopy, 'kind'>> = {
  '401': {
    title: 'Neautorizovaný prístup',
    message: 'Supabase session alebo JWT token nie je platný.',
    action: 'Odhláste sa a prihláste znova cez Google Sign-In.',
  },
  '402': {
    title: 'Nedostatok kreditov / AI gateway',
    message: 'Mistral API vrátilo HTTP 402 — pravdepodobne vyčerpané kredity alebo chýbajúci AI gateway secret.',
    action: 'Otvorte Nastavenia → AI Model, skontrolujte kredit u Mistral a v Supabase edge secrets nastavte MISTRAL_API_KEY.',
  },
  '429': {
    title: 'Rate limit',
    message: 'AI gateway dočasne obmedzil počet požiadaviek.',
    action: 'Počkajte 30–60 sekúnd a skúste znova, prípadne zvoľte lacnejší model v Nastaveniach.',
  },
  '5xx': {
    title: 'Chyba AI servera',
    message: 'Edge funkcia chat alebo upstream AI gateway vrátila serverovú chybu.',
    action: 'Skúste znova o chvíľu. Ak problém pretrváva, skontrolujte Supabase logy funkcie chat.',
  },
  network: {
    title: 'Sieťové spojenie zlyhalo',
    message: 'Nepodarilo sa nadviazať spojenie s AI backendom.',
    action: 'Skontrolujte internetové pripojenie a obnovte stránku.',
  },
  timeout: {
    title: 'Časový limit vypršal',
    message: 'AI backend neodpovedal v stanovenom čase (15 s).',
    action: 'Skúste kratší prompt alebo zvoľte rýchlejší model v Nastaveniach → AI Model.',
  },
  unknown: {
    title: 'AI požiadavka zlyhala',
    message: 'Neočakávaná chyba pri volaní AI backendu.',
    action: 'Skúste znova. Pri opakovaní otvorte Nastavenia → Diagnostika a spustite E2E test.',
  },
};

export function resolveAiErrorKind(input: AiErrorInput): AiErrorKind {
  const status = input.status;
  const msg = (input.message ?? '').toLowerCase();
  const name = input.name ?? '';

  if (name === 'AbortError' || msg.includes('časový limit') || msg.includes('timeout') || msg.includes('aborted')) {
    return 'timeout';
  }
  if (status === 401) return '401';
  if (status === 402) return '402';
  if (status === 429) return '429';
  if (status !== undefined && status >= 500) return '5xx';
  if (
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('spojenie zlyhalo') ||
    msg.includes('load failed')
  ) {
    return 'network';
  }
  if (status !== undefined && status >= 400 && status < 500) return 'unknown';
  return 'unknown';
}

export function getAiErrorCopy(input: AiErrorInput): AiErrorCopy {
  const kind = resolveAiErrorKind(input);
  const base = COPY[kind];
  return { kind, ...base };
}

/** Parse status from thrown errors like "HTTP 402" or Error with status property. */
export function parseAiErrorInput(err: unknown): AiErrorInput {
  if (err && typeof err === 'object') {
    const e = err as { status?: number; message?: string; name?: string };
    const statusFromMsg = /HTTP\s+(\d{3})/i.exec(e.message ?? '')?.[1];
    return {
      status: e.status ?? (statusFromMsg ? Number(statusFromMsg) : undefined),
      message: e.message,
      name: e.name,
    };
  }
  if (typeof err === 'string') {
    const statusFromMsg = /HTTP\s+(\d{3})/i.exec(err)?.[1];
    return { message: err, status: statusFromMsg ? Number(statusFromMsg) : undefined };
  }
  return {};
}

export function getAiErrorCopyFromError(err: unknown): AiErrorCopy {
  return getAiErrorCopy(parseAiErrorInput(err));
}

export function formatAiErrorForChat(copy: AiErrorCopy): string {
  return `⚠️ **${copy.title}**\n\n${copy.message}\n\n**Čo urobiť:** ${copy.action}`;
}

export function formatAiErrorForSurface(copy: AiErrorCopy): string {
  return `${copy.title}. ${copy.action}`;
}

/** E2E / SystemMonitor detail for Streaming AI step failures. */
export function formatStreamingAiDiagnosticDetail(status: number, bodyMessage?: string): string {
  if (status === 402) {
    return '402 — nedostatok kreditov / AI gateway (Mistral kredit alebo MISTRAL_API_KEY v Supabase)';
  }
  if (status === 401) {
    return '401 — neplatná session (prihláste sa znova)';
  }
  if (status === 429) {
    return '429 — rate limit AI gateway (počkajte a skúste znova)';
  }
  if (status >= 500) {
    return `${status} — chyba AI servera (skontrolujte Supabase logy chat)`;
  }
  if (bodyMessage?.trim()) {
    return `HTTP ${status}: ${bodyMessage.trim()}`;
  }
  return `HTTP ${status}`;
}
