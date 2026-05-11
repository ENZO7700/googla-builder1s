// Shared types for the Site Content Manager.

export type StaticKind = 'company' | 'about' | 'header' | 'footer';
export type RepeaterKind = 'services' | 'references' | 'news' | 'members';

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
};

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
  social?: Record<string, string>;
  wp_post_id?: number | null;
}

export interface AboutInfo {
  id?: string;
  site_id: string;
  title?: string | null;
  subtitle?: string | null;
  content_html?: string | null;
  image_url?: string | null;
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
  order_index: number;
  published: boolean;
  wp_post_id?: number | null;
}

export interface ReferenceItem {
  id?: string;
  site_id: string;
  client_name?: string | null;
  project_title: string;
  description_html?: string | null;
  image_url?: string | null;
  link_url?: string | null;
  completed_at?: string | null;
  order_index: number;
  published: boolean;
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
  order_index: number;
  published: boolean;
  wp_post_id?: number | null;
}

export interface MemberItem {
  id?: string;
  site_id: string;
  name: string;
  role?: string | null;
  bio?: string | null;
  photo_url?: string | null;
  email?: string | null;
  link_url?: string | null;
  order_index: number;
  published: boolean;
}

export interface InquiryFormField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select';
  required?: boolean;
  options?: string[];
  placeholder?: string;
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
