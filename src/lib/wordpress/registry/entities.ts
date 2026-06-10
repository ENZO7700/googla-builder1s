import businessWebManifest from './manifests/business-web.json';
import type { BlueprintManifest, EntityDefinition } from './types';

/** Entity keys included in each base pack (extends targets). */
export const BASE_PACK_ENTITIES: Record<string, string[]> = {
  'base-core': ['company', 'header', 'footer', 'about', 'inquiry_forms'],
  'base-content': [
    'services',
    'service_categories',
    'news',
    'members',
    'references',
    'faq',
    'gallery',
  ],
};

export const BASE_ENTITIES: Record<string, EntityDefinition> = {
  company: {
    table: 'wp_company_info',
    kind: 'singleton',
    blueprints: ['business-web'],
    family: 'core',
    embedded: { social: 'jsonb', seo: 'jsonb' },
    sync: { strategy: 'supabase-wins', auto: true },
  },
  header: {
    table: 'wp_header',
    kind: 'singleton',
    blueprints: ['business-web'],
    family: 'core',
    embedded: { cta: 'jsonb' },
    sync: { strategy: 'supabase-wins', auto: true },
  },
  footer: {
    table: 'wp_footer',
    kind: 'singleton',
    blueprints: ['business-web'],
    family: 'core',
    embedded: { social: 'jsonb' },
    sync: { strategy: 'supabase-wins', auto: true },
  },
  about: {
    table: 'wp_about',
    kind: 'singleton',
    blueprints: ['business-web'],
    family: 'core',
    embedded: { seo: 'jsonb' },
    wp: { cpt: 'page', custom: 'about' },
    sync: { strategy: 'supabase-wins', auto: true },
  },
  inquiry_forms: {
    table: 'wp_inquiry_forms',
    kind: 'repeater',
    blueprints: ['business-web'],
    family: 'core',
    sync: { strategy: 'none', auto: false },
  },
  services: {
    table: 'wp_services',
    kind: 'repeater',
    blueprints: ['business-web', 'industrial-catalog', 'booking-system'],
    family: 'content',
    relations: { category_id: 'wp_service_categories' },
    embedded: { seo: 'jsonb' },
    wp: { cpt: 'services', taxonomy: 'service_category' },
    sync: { strategy: 'newest-wins', auto: true },
    publicRead: true,
  },
  service_categories: {
    table: 'wp_service_categories',
    kind: 'repeater',
    blueprints: ['business-web', 'industrial-catalog'],
    family: 'content',
    embedded: { seo: 'jsonb' },
    wp: { taxonomy: 'service_category' },
    sync: { strategy: 'newest-wins', auto: true },
    publicRead: true,
  },
  news: {
    table: 'wp_news',
    kind: 'repeater',
    blueprints: ['business-web', 'news-magazine'],
    family: 'content',
    relations: { author_member_id: 'wp_members' },
    embedded: { seo: 'jsonb', tags: 'text[]' },
    wp: { cpt: 'post' },
    sync: { strategy: 'newest-wins', auto: true },
    publicRead: true,
  },
  members: {
    table: 'wp_members',
    kind: 'repeater',
    blueprints: ['business-web'],
    family: 'content',
    embedded: { social: 'jsonb', position: 'enum' },
    wp: { cpt: 'team-member' },
    sync: { strategy: 'newest-wins', auto: true },
    publicRead: true,
  },
  references: {
    table: 'wp_references',
    kind: 'repeater',
    blueprints: ['business-web', 'portfolio'],
    family: 'content',
    embedded: { seo: 'jsonb' },
    wp: { cpt: 'reference' },
    sync: { strategy: 'newest-wins', auto: true },
    publicRead: true,
  },
  faq: {
    table: 'wp_faq',
    kind: 'repeater',
    blueprints: ['business-web', 'knowledge-base'],
    family: 'content',
    relations: { category_id: 'wp_service_categories' },
    embedded: { seo: 'jsonb' },
    wp: { cpt: 'faq' },
    sync: { strategy: 'newest-wins', auto: true },
    publicRead: true,
  },
  gallery: {
    table: 'wp_galleries',
    kind: 'repeater',
    blueprints: ['business-web', 'portfolio'],
    family: 'content',
    embedded: { images: 'jsonb' },
    sync: { strategy: 'newest-wins', auto: true },
    publicRead: true,
  },
};

export const BLUEPRINT_MANIFESTS: Record<string, BlueprintManifest> = {
  'business-web': businessWebManifest as BlueprintManifest,
};

/** Resolve entity keys for a blueprint from its manifest (extends + entities). */
export function getEntitiesForBlueprint(blueprintId: string): string[] {
  const manifest = BLUEPRINT_MANIFESTS[blueprintId];
  if (manifest) {
    const fromExtends = (manifest.extends ?? []).flatMap(
      (pack) => BASE_PACK_ENTITIES[pack] ?? [],
    );
    return [...new Set([...fromExtends, ...manifest.entities])];
  }

  return Object.entries(BASE_ENTITIES)
    .filter(([, def]) => def.blueprints.includes(blueprintId))
    .map(([key]) => key);
}

/** Look up entity definition by registry key. */
export function getEntityDefinition(entityKey: string): EntityDefinition | undefined {
  return BASE_ENTITIES[entityKey];
}
