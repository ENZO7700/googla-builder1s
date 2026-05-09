import { z } from 'zod';

// ==================== ENTITIES ====================

export const PostSchema = z.object({
  id: z.number(),
  title: z.object({ rendered: z.string() }),
  content: z.object({ rendered: z.string() }),
  excerpt: z.object({ rendered: z.string() }).optional(),
  status: z.enum(['publish', 'draft', 'pending', 'scheduled']),
  date: z.string().datetime(),
  modified: z.string().datetime(),
  author: z.number(),
  slug: z.string(),
  featured_media: z.number().optional(),
  categories: z.array(z.number()).optional(),
  tags: z.array(z.number()).optional(),
  link: z.string().url(),
  _links: z.any().optional(),
});

export type Post = z.infer<typeof PostSchema>;

export const PostUpdateSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  excerpt: z.string().optional(),
  status: z.enum(['publish', 'draft', 'pending', 'scheduled']).optional(),
  slug: z.string().optional(),
  featured_media: z.number().optional(),
  categories: z.array(z.number()).optional(),
  tags: z.array(z.number()).optional(),
});

export type PostUpdate = z.infer<typeof PostUpdateSchema>;

export const PageSchema = PostSchema.extend({
  parent: z.number().optional(),
  menu_order: z.number().optional(),
});

export type Page = z.infer<typeof PageSchema>;

export const UserSchema = z.object({
  id: z.number(),
  username: z.string(),
  name: z.string(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email(),
  url: z.string().url().optional(),
  description: z.string().optional(),
  link: z.string().url(),
  locale: z.string().optional(),
  nickname: z.string().optional(),
  slug: z.string(),
  roles: z.array(z.string()),
  avatar_urls: z.record(z.string()).optional(),
  _links: z.any().optional(),
});

export type User = z.infer<typeof UserSchema>;

export const CommentSchema = z.object({
  id: z.number(),
  post: z.number(),
  parent: z.number(),
  author: z.number(),
  author_name: z.string(),
  author_email: z.string().email(),
  author_url: z.string().url().optional(),
  author_avatar_urls: z.record(z.string()).optional(),
  date: z.string().datetime(),
  date_gmt: z.string().datetime(),
  content: z.object({ rendered: z.string() }),
  link: z.string().url(),
  status: z.enum(['hold', 'approved', 'spam', 'trash']),
  type: z.string(),
  author_ip: z.string().optional(),
  author_user_agent: z.string().optional(),
  _links: z.any().optional(),
});

export type Comment = z.infer<typeof CommentSchema>;

export const MediaSchema = z.object({
  id: z.number(),
  date: z.string().datetime(),
  date_gmt: z.string().datetime(),
  guid: z.object({ rendered: z.string() }),
  modified: z.string().datetime(),
  modified_gmt: z.string().datetime(),
  slug: z.string(),
  status: z.string(),
  type: z.string(),
  link: z.string().url(),
  title: z.object({ rendered: z.string() }),
  author: z.number(),
  comment_status: z.string(),
  ping_status: z.string(),
  media_type: z.enum(['image', 'video', 'audio']).optional(),
  mime_type: z.string(),
  media_details: z.object({
    width: z.number().optional(),
    height: z.number().optional(),
    file: z.string(),
    filesize: z.number().optional(),
    image_meta: z.any().optional(),
  }).optional(),
  source_url: z.string().url(),
  _links: z.any().optional(),
});

export type Media = z.infer<typeof MediaSchema>;

export const MediaUploadResponseSchema = MediaSchema.extend({
  source_url: z.string().url(),
});

export type MediaUploadResponse = z.infer<typeof MediaUploadResponseSchema>;

export const PluginSchema = z.object({
  plugin: z.string(),
  status: z.enum(['active', 'inactive', 'network-active', 'must-use']),
  name: z.string(),
  plugin_uri: z.string().url().optional(),
  description: z.object({ rendered: z.string() }).optional(),
  version: z.string(),
  requires_at_least: z.string().optional(),
  requires_php: z.string().optional(),
  author: z.object({ rendered: z.string() }).optional(),
  network: z.boolean().optional(),
  active: z.boolean(),
  update: z.boolean(),
});

export type Plugin = z.infer<typeof PluginSchema>;

export const SettingsSchema = z.object({
  title: z.string(),
  description: z.string(),
  url: z.string().url(),
  home: z.string().url(),
  gmt_offset: z.number().optional(),
  timezone_string: z.string().optional(),
  date_format: z.string().optional(),
  time_format: z.string().optional(),
  start_of_week: z.number().optional(),
  language: z.string().optional(),
  use_smilies: z.boolean().optional(),
  default_category: z.number().optional(),
  default_post_format: z.string().optional(),
  posts_per_page: z.number().optional(),
  pages_per_page: z.number().optional(),
});

export type Settings = z.infer<typeof SettingsSchema>;

// ==================== RESPONSES ====================

export const PostListResponseSchema = z.object({
  items: z.array(PostSchema),
  total: z.number(),
  total_pages: z.number(),
  page: z.number(),
  per_page: z.number(),
  _links: z.any().optional(),
});

export type PostListResponse = z.infer<typeof PostListResponseSchema>;

export const PageListResponseSchema = z.object({
  items: z.array(PageSchema),
  total: z.number(),
  total_pages: z.number(),
  page: z.number(),
  per_page: z.number(),
  _links: z.any().optional(),
});

export type PageListResponse = z.infer<typeof PageListResponseSchema>;

export const CommentListResponseSchema = z.object({
  items: z.array(CommentSchema),
  total: z.number(),
  total_pages: z.number(),
  page: z.number(),
  per_page: z.number(),
  _links: z.any().optional(),
});

export type CommentListResponse = z.infer<typeof CommentListResponseSchema>;

export const UserListResponseSchema = z.object({
  items: z.array(UserSchema),
  total: z.number(),
  total_pages: z.number(),
  page: z.number(),
  per_page: z.number(),
  _links: z.any().optional(),
});

export type UserListResponse = z.infer<typeof UserListResponseSchema>;

export const PluginListResponseSchema = z.object({
  items: z.array(PluginSchema),
  total: z.number(),
  _links: z.any().optional(),
});

export type PluginListResponse = z.infer<typeof PluginListResponseSchema>;

// ==================== EDGE FUNCTION ====================

export const EdgeFunctionRequestSchema = z.object({
  siteId: z.string().uuid(),
  method: z.enum(['GET', 'POST', 'PATCH', 'DELETE']),
  path: z.string(),
  body: z.any().optional(),
  query: z.record(z.string()).optional(),
});

export type EdgeFunctionRequest = z.infer<typeof EdgeFunctionRequestSchema>;

export const EdgeFunctionErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  status: z.number().optional(),
});

export type EdgeFunctionError = z.infer<typeof EdgeFunctionErrorSchema>;

// ==================== AUDIT LOG ====================

export const AuditLogSchema = z.object({
  id: z.string().uuid(),
  site_id: z.string().uuid(),
  user_id: z.string().uuid(),
  action: z.string(),
  resource_type: z.string().optional(),
  details: z.any().optional(),
  status: z.enum(['success', 'error', 'pending']),
  error_message: z.string().optional(),
  created_at: z.string().datetime(),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

// ==================== ERROR HANDLING ====================

export class WordPressError extends Error {
  constructor(
    public code: string,
    message: string,
    public originalError?: any,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'WordPressError';
  }
}

export const ErrorMessagesMap: Record<string, string> = {
  NETWORK_ERROR: 'Zlyhal sieťový kontakt. Skúte znova.',
  TIMEOUT: 'Požiadavka vypršala. Server reaguje pomaly.',
  UNAUTHORIZED: 'Nie ste autentifikovaný. Prihláste sa znova.',
  FORBIDDEN: 'Nemáte oprávnenie na túto operáciu.',
  NOT_FOUND: 'Požadovaný obsah nebol nájdený.',
  VALIDATION_ERROR: 'Neplatné údaje. Skontrolujte vstup.',
  CONFLICT: 'Konflikt dát. Obsah sa medzičasom zmenil.',
  RATE_LIMIT: 'Príliš veľa požiadaviek. Počkajte chvíľu.',
  SERVER_ERROR: 'Chyba servera. Skúte znova neskôr.',
  UNKNOWN_ERROR: 'Neznáma chyba. Skúte znova.',
};

// ==================== CONFIG ====================

export const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 300,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  retryableErrors: ['ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT'],
};

export const RATE_LIMIT_CONFIG = {
  maxRequestsPerMinute: 60,
  maxConcurrentRequests: 5,
  cleanupIntervalMs: 60000,
};

// ==================== REQUEST OPTIONS ====================

export interface RequestOptions {
  timeout?: number; // ms, default 30000
  retry?: boolean; // default true
  skipAudit?: boolean; // default false
  cacheTime?: number; // ms
}
</parameter>
</invoke>