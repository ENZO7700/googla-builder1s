// Shared types for the Site Content Manager.

import type {
  CtaButton,
  MediaRef,
  SeoMeta,
  SocialLink,
  SyncStatus,
} from '@/lib/wordpress/registry/types';

export type StaticKind = 'company' | 'about' | 'header' | 'footer';
export type RepeaterKind =
  | 'services'
  | 'references'
  | 'news'
  | 'members'
  | 'service_categories'
  | 'faq'
  | 'gallery';

export const STATIC_TABLE: Record<StaticKind, string> = {
  company: 'wp_company_info',
  about: 'wp_about',
  header: 'wp_header',
  footer: 'wp_footer',
};

export const REPEATER_TABLE: Record<RepeaterKind, string> = {
  services: 'wp_services',
  references: 'wp_references',
  news: 'wp_news',
  members: 'wp_members',
  service_categories: 'wp_service_categories',
  faq: 'wp_faq',
  gallery: 'wp_galleries',
};

export type MemberPosition = 'founder' | 'ceo' | 'manager' | 'employee' | 'other';

export interface CompanyInfo {
  id?: string;
  site_id: string;
  name?: string | null;
  tagline?: string | null;
  description?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  vat_id?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
  social?: Record<string, string> | SocialLink[];
  seo?: SeoMeta | null;
  sync_status?: SyncStatus;
  wp_post_id?: number | null;
}

export interface AboutInfo {
  id?: string;
  site_id: string;
  title?: string | null;
  subtitle?: string | null;
  content_html?: string | null;
  image_url?: string | null;
  seo?: SeoMeta | null;
  sync_status?: SyncStatus;
  wp_post_id?: number | null;
}

export interface MenuLink {
  label: string;
  url: string;
  order: number;
}

export interface HeaderData {
  id?: string;
  site_id: string;
  logo_url?: string | null;
  menu?: MenuLink[];
  cta_label?: string | null;
  cta_url?: string | null;
  cta?: CtaButton | null;
  sync_status?: SyncStatus;
}

export interface FooterColumn {
  title: string;
  links: { label: string; url: string }[];
}

export interface FooterData {
  id?: string;
  site_id: string;
  logo_url?: string | null;
  copyright?: string | null;
  columns?: FooterColumn[];
  legal_links?: { label: string; url: string }[];
  social?: SocialLink[];
  sync_status?: SyncStatus;
}

export interface ServiceItem {
  id?: string;
  site_id: string;
  title: string;
  slug?: string | null;
  excerpt?: string | null;
  description_html?: string | null;
  icon?: string | null;
  image_url?: string | null;
  price?: string | null;
  link_url?: string | null;
  category_id?: string | null;
  order_index: number;
  published: boolean;
  featured?: boolean;
  seo?: SeoMeta | null;
  sync_status?: SyncStatus;
  content_hash?: string | null;
  wp_modified_at?: string | null;
  last_synced_at?: string | null;
  last_sync_error?: string | null;
  wp_post_id?: number | null;
}

export interface ReferenceItem {
  id?: string;
  site_id: string;
  client_name?: string | null;
  project_title: string;
  description_html?: string | null;
  image_url?: string | null;
  logo_alt?: string | null;
  link_url?: string | null;
  completed_at?: string | null;
  order_index: number;
  published: boolean;
  featured?: boolean;
  seo?: SeoMeta | null;
  sync_status?: SyncStatus;
  wp_post_id?: number | null;
}

export interface NewsItem {
  id?: string;
  site_id: string;
  title: string;
  slug?: string | null;
  excerpt?: string | null;
  content_html?: string | null;
  cover_url?: string | null;
  published_at?: string | null;
  author_member_id?: string | null;
  tags?: string[];
  order_index: number;
  published: boolean;
  featured?: boolean;
  seo?: SeoMeta | null;
  sync_status?: SyncStatus;
  wp_post_id?: number | null;
}

export interface MemberItem {
  id?: string;
  site_id: string;
  name: string;
  role?: string | null;
  position?: MemberPosition | null;
  bio?: string | null;
  photo_url?: string | null;
  email?: string | null;
  link_url?: string | null;
  social?: SocialLink[] | Record<string, string>;
  order_index: number;
  published: boolean;
}

export interface ServiceCategory {
  id?: string;
  site_id: string;
  name: string;
  slug: string;
  description?: string | null;
  order_index: number;
  seo?: SeoMeta | null;
  sync_status?: SyncStatus;
  wp_term_id?: number | null;
}

export interface FaqItem {
  id?: string;
  site_id: string;
  question: string;
  answer: string;
  category_id?: string | null;
  order_index: number;
  published: boolean;
  seo?: SeoMeta | null;
  sync_status?: SyncStatus;
  wp_post_id?: number | null;
}

export interface GalleryItem {
  id?: string;
  site_id: string;
  title: string;
  description?: string | null;
  order_index: number;
  images?: MediaRef[];
  published: boolean;
  sync_status?: SyncStatus;
}

export interface InquiryFormField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox' | 'file';
  required?: boolean;
  options?: string[];
  placeholder?: string;
  accept?: string;
  maxSize?: number;
}

export interface InquiryFileRef {
  path: string;
  name: string;
  size: number;
  mime: string;
}

export interface InquiryForm {
  id?: string;
  site_id: string;
  slug: string;
  name: string;
  fields: InquiryFormField[];
  recipient_email?: string | null;
  success_message?: string | null;
}

export interface Inquiry {
  id: string;
  site_id: string;
  form_slug: string;
  payload: Record<string, unknown>;
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  message?: string | null;
  source_url?: string | null;
  ip_hash?: string | null;
  user_agent?: string | null;
  read: boolean;
  created_at: string;
}

export const DEFAULT_INQUIRY_FIELDS: InquiryFormField[] = [
  { key: 'name', label: 'Meno', type: 'text', required: true },
  { key: 'email', label: 'E-mail', type: 'email', required: true },
  { key: 'phone', label: 'Telefón', type: 'tel' },
  { key: 'message', label: 'Správa', type: 'textarea', required: true },
];

// Re-export registry embedded types for content editors.
export type { CtaButton, MediaRef, SeoMeta, SocialLink, SyncStatus } from '@/lib/wordpress/registry/types';
