import type { Dimension, ScoreSet, Severity } from './types';

/** Maps a 0–100 score to semantic-token classes (text + bg + ring + band). */
export function scoreColor(score: number): {
  text: string; ring: string; bg: string; band: 'green' | 'yellow' | 'orange' | 'red';
} {
  if (score >= 80) return { text: 'text-success', ring: 'stroke-[hsl(var(--success))]', bg: 'bg-success/10', band: 'green' };
  if (score >= 60) return { text: 'text-warning', ring: 'stroke-[hsl(var(--warning))]', bg: 'bg-warning/10', band: 'yellow' };
  if (score >= 40) return { text: 'text-warning', ring: 'stroke-[hsl(var(--warning))]', bg: 'bg-warning/10', band: 'orange' };
  return { text: 'text-destructive', ring: 'stroke-[hsl(var(--destructive))]', bg: 'bg-destructive/10', band: 'red' };
}

export function severityClasses(sev: Severity): { badge: string; bar: string; label: string } {
  switch (sev) {
    case 'critical': return { badge: 'bg-destructive text-destructive-foreground', bar: 'bg-destructive', label: 'Critical' };
    case 'high':     return { badge: 'bg-warning text-warning-foreground', bar: 'bg-warning', label: 'High' };
    case 'medium':   return { badge: 'bg-warning/70 text-warning-foreground', bar: 'bg-warning/70', label: 'Medium' };
    case 'low':      return { badge: 'bg-primary text-primary-foreground', bar: 'bg-primary', label: 'Low' };
    case 'info':     return { badge: 'bg-muted text-muted-foreground', bar: 'bg-muted-foreground/40', label: 'Info' };
  }
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function diffArrow(delta: number) {
  if (delta > 0) return { symbol: '▲', className: 'text-success' };
  if (delta < 0) return { symbol: '▼', className: 'text-destructive' };
  return { symbol: '•', className: 'text-muted-foreground' };
}

export function dimensionKeys(): Dimension[] {
  return ['security', 'performance', 'accessibility', 'pwa', 'privacy'];
}

export function emptyScores(): ScoreSet {
  return { overall: 0, security: 0, performance: 0, accessibility: 0, pwa: 0, privacy: 0 };
}
