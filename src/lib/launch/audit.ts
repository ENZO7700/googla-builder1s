import { fallbackFindingsLibrary } from './demoData';
import type { Finding, LaunchProject, Scan, ScoreSet } from './types';
import { dimensionKeys, uid } from './utils';

// Deterministic PRNG seeded by URL → same URL yields comparable scores.
function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
  return h;
}
function rng(seed: number) {
  let x = seed || 1;
  return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 1000) / 1000; };
}
const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));

/**
 * Generate a fully-mocked audit scan for a project.
 * No real PageSpeed/Headers/PWA plugins are wired yet, so every dimension uses
 * the demo fallback library and is marked source: 'demo'. TODO: replace with
 * a Supabase edge function that calls real scanners.
 */
export function runMockAudit(project: LaunchProject, opts?: { jitter?: number }): Scan {
  const seed = hashSeed(project.url);
  const rand = rng(seed + (Date.now() % 7919));
  const jitter = opts?.jitter ?? 12;

  const baseSec = 60 - (project.config.usesPayments ? 8 : 0);
  const basePriv = 65 - (project.config.collectsPersonalData ? 10 : 0);

  const scores: ScoreSet = {
    overall: 0,
    security: clamp(baseSec + (rand() - 0.5) * jitter * 2),
    performance: clamp(65 + (rand() - 0.5) * jitter * 2),
    accessibility: clamp(70 + (rand() - 0.5) * jitter * 2),
    pwa: clamp(55 + (rand() - 0.5) * jitter * 2),
    privacy: clamp(basePriv + (rand() - 0.5) * jitter * 2),
  };

  const w = {
    security: project.config.usesPayments ? 1.4 : 1.1,
    performance: 1.0, accessibility: 1.0, pwa: 0.7,
    privacy: project.config.collectsPersonalData ? 1.3 : 1.0,
  };
  const num = scores.security * w.security + scores.performance * w.performance
    + scores.accessibility * w.accessibility + scores.pwa * w.pwa + scores.privacy * w.privacy;
  scores.overall = clamp(num / Object.values(w).reduce((a, b) => a + b, 0));

  const findings: Finding[] = [];
  for (const dim of dimensionKeys()) {
    if (scores[dim] < 75) {
      for (const tmpl of fallbackFindingsLibrary[dim]) {
        findings.push({ ...tmpl, id: uid('find'), source: 'demo' });
      }
    }
  }

  return {
    id: uid('scan'),
    projectId: project.id,
    createdAt: new Date().toISOString(),
    scores,
    findings,
    sources: { security: 'demo', performance: 'demo', accessibility: 'demo', pwa: 'demo', privacy: 'demo' },
    summary: findings.length === 0
      ? 'Clean scan — no findings detected.'
      : `Generated ${findings.length} findings across ${new Set(findings.map(x => x.dimension)).size} dimensions.`,
  };
}

import { supabase } from '@/integrations/supabase/client';
import type { LaunchProject as _LaunchProject } from './types';

/**
 * Real audit: calls the `launch-audit` edge function which performs server-side
 * probes (security headers, HTTPS redirect, manifest, HTML heuristics).
 * Throws on transport errors so the caller can fall back to mock.
 */
export async function runRealAudit(project: _LaunchProject): Promise<Scan> {
  const { data, error } = await supabase.functions.invoke('launch-audit', {
    body: { url: project.url, projectId: project.id },
  });
  if (error) throw new Error(error.message ?? 'launch-audit failed');
  if (!data?.scan) throw new Error(data?.error ?? 'No scan returned');
  // Normalize: server returns its own ids/timestamp; keep as-is but ensure projectId.
  return { ...data.scan, projectId: project.id } as Scan;
}
