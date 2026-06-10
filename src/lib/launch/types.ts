// Launch Readiness Auditor – domain model.
// Adapted from the LaunchGuard / PWA-CH3CK3R prototype.

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type Dimension = 'security' | 'performance' | 'accessibility' | 'pwa' | 'privacy';

export type AppType =
  | 'ecommerce' | 'saas' | 'marketing' | 'blog' | 'portfolio' | 'internal-tool' | 'other';

export interface Finding {
  id: string;
  dimension: Dimension;
  severity: Severity;
  title: string;
  explanation: string;
  whyItMatters: string;
  recommendedFix: string;
  /** Ready-to-paste prompt for the in-app builder / Lovable AI. */
  builderPrompt: string;
  source: 'real' | 'demo';
}

export interface ScoreSet {
  overall: number;
  security: number;
  performance: number;
  accessibility: number;
  pwa: number;
  privacy: number;
}

export interface Scan {
  id: string;
  projectId: string;
  createdAt: string;
  scores: ScoreSet;
  findings: Finding[];
  sources: Record<Dimension, 'real' | 'demo'>;
  summary: string;
}

export interface ProjectConfig {
  collectsPersonalData: boolean;
  usesPayments: boolean;
  hasAuth: boolean;
  storesUserContent: boolean;
}

export interface LaunchProject {
  id: string;
  name: string;
  url: string;
  appType: AppType;
  config: ProjectConfig;
  createdAt: string;
  isDemo?: boolean;
}

export const DIMENSION_LABEL: Record<Dimension, string> = {
  security: 'Security',
  performance: 'Performance',
  accessibility: 'Accessibility',
  pwa: 'PWA',
  privacy: 'Privacy',
};

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
