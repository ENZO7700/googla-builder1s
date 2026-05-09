import { supabase } from '@/integrations/supabase/client';
import {
  WordPressError,
  ErrorMessagesMap,
  RETRY_CONFIG,
  RATE_LIMIT_CONFIG,
  PostSchema,
  CommentSchema,
  PluginSchema,
  PostUpdateSchema,
  PostListResponseSchema,
  PageListResponseSchema,
  CommentListResponseSchema,
  UserListResponseSchema,
  PluginListResponseSchema,
  MediaUploadResponseSchema,
  SettingsSchema,
  type Post,
  type PostUpdate,
  type PostListResponse,
  type Page,
  type PageListResponse,
  type Comment,
  type CommentListResponse,
  type User,
  type UserListResponse,
  type Plugin,
  type PluginListResponse,
  type Media,
  type Settings,
  type RequestOptions,
} from './types';

// ==================== RATE LIMITER ====================

class RateLimiter {
  private requestTimestamps: number[] = [];
  private concurrentRequests = 0;

  constructor(
    private maxRequestsPerMinute: number,
    private maxConcurrent: number
  ) {}

  async acquire(): Promise<void> {
    // Wait for concurrent slot
    while (this.concurrentRequests >= this.maxConcurrent) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Clean old timestamps (> 60s)
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      ts => now - ts < 60000
    );

    // Wait if rate limit reached
    if (this.requestTimestamps.length >= this.maxRequestsPerMinute) {
      const oldestTimestamp = this.requestTimestamps[0];
      const waitTime = 60000 - (now - oldestTimestamp);
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    this.requestTimestamps.push(Date.now());
    this.concurrentRequests++;
  }

  release(): void {
    this.concurrentRequests--;
  }
}

const rateLimiter = new RateLimiter(
  RATE_LIMIT_CONFIG.maxRequestsPerMinute,
  RATE_LIMIT_CONFIG.maxConcurrentRequests
);

// ==================== WORDPRESS SERVICE ====================

class WordPressService {
  private edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wordpress-proxy`;

  private async getAuthToken(): Promise<string> {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      throw new WordPressError(
        'UNAUTHORIZED',
        ErrorMessagesMap.UNAUTHORIZED
      );
    }
    return session.access_token;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private calculateBackoff(attempt: number): number {
    const delay = RETRY_CONFIG.initialDelayMs * 
      Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1);
    return Math.min(delay, RETRY_CONFIG.maxDelayMs);
  }

  private shouldRetry(statusCode?: number, error?: any): boolean {
    if (!statusCode && error?.code) {
      return RETRY_CONFIG.retryableErrors.includes(error.code);
    }
    if (statusCode) {
      return RETRY_CONFIG.retryableStatusCodes.includes(statusCode);
    }
    return false;
  }

  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    options: RequestOptions = {}
  ): Promise<T> {
    const { retry = true } = options;
    let lastError: any;

    for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;

        const shouldRetryAttempt = retry && 
          this.shouldRetry(error.statusCode, error.originalError) && 
          attempt < RETRY_CONFIG.maxRetries;

        if (shouldRetryAttempt) {
          const backoffMs = this.calculateBackoff(attempt);
          console.log(`Retry attempt ${attempt}/${RETRY_CONFIG.maxRetries} after ${backoffMs}ms`);
          await this.delay(backoffMs);
        } else {
          throw error;
        }
      }
    }

    throw lastError;
  }

  private async callEdgeFunction<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    siteId: string,
    path: string,
    body?: any,
    query?: Record<string, string>,
    options: RequestOptions = {}
  ): Promise<T> {
    await rateLimiter.acquire();

    try {
      const token = await this.getAuthToken();

      return await this.executeWithRetry(
        async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(
            () => controller.abort(),
            options.timeout || 30000
          );

          try {
            const response = await fetch(this.edgeFunctionUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                siteId,
                method,
                path,
                body,
                query,
              }),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            const data = await response.json();

            if (!response.ok) {
              const statusCode = response.status;
              const errorCode = this.getErrorCode(statusCode);
              const message = data.error || ErrorMessagesMap[errorCode] || ErrorMessagesMap.UNKNOWN_ERROR;
              throw new WordPressError(errorCode, message, data, statusCode);
            }

            return data as T;
          } catch (error: any) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
              throw new WordPressError(
                'TIMEOUT',
                ErrorMessagesMap.TIMEOUT,
                error,
                408
              );
            }

            if (error instanceof WordPressError) {
              throw error;
            }

            throw new WordPressError(
              'NETWORK_ERROR',
              ErrorMessagesMap.NETWORK_ERROR,
              error
            );
          }
        },
        options
      );
    } finally {
      rateLimiter.release();
    }
  }

  private getErrorCode(statusCode: number): string {
    switch (statusCode) {
      case 400:
      case 422:
        return 'VALIDATION_ERROR';
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      case 429:
        return 'RATE_LIMIT';
      case 500:
      case 502:
      case 503:
      case 504:
        return 'SERVER_ERROR';
      default:
        return 'UNKNOWN_ERROR';
    }
  }

  // ==================== POST METHODS ====================

  async getPostsPreview(
    siteId: string,
    page: number = 1,
    search?: string,
    options?: RequestOptions
  ): Promise<PostListResponse> {
    const query: Record<string, string> = {
      page: page.toString(),
      per_page: '10',
      orderby: 'date',
      order: 'desc',
    };

    if (search) {
      query.search = search;
    }

    const data = await this.callEdgeFunction<any>(
      'GET',
      siteId,
      'posts',
      undefined,
      query,
      options
    );

    return PostListResponseSchema.parse({
      items: Array.isArray(data) ? data : [data],
      total: parseInt(data.total || '0'),
      total_pages: parseInt(data.total_pages || '1'),
      page,
      per_page: 10,
    });
  }

  async getPagesList(
    siteId: string,
    options?: RequestOptions
  ): Promise<PageListResponse> {
    const data = await this.callEdgeFunction<any>(
      'GET',
      siteId,
      'pages',
      undefined,
      { per_page: '100', orderby: 'date', order: 'desc' },
      options
    );

    return PageListResponseSchema.parse({
      items: Array.isArray(data) ? data : [data],
      total: parseInt(data.total || '0'),
      total_pages: 1,
      page: 1,
      per_page: 100,
    });
  }

  async updatePost(
    siteId: string,
    postId: number,
    data: PostUpdate,
    options?: RequestOptions
  ): Promise<Post> {
    const validated = PostUpdateSchema.parse(data);

    const response = await this.callEdgeFunction<Post>(
      'PATCH',
      siteId,
      `posts/${postId}`,
      validated,
      undefined,
      options
    );

    return PostSchema.parse(response);
  }

  async deletePost(
    siteId: string,
    postId: number,
    options?: RequestOptions
  ): Promise<void> {
    await this.callEdgeFunction<void>(
      'DELETE',
      siteId,
      `posts/${postId}`,
      undefined,
      { force: 'true' },
      options
    );
  }

  // ==================== MEDIA METHODS ====================

  async uploadMedia(
    siteId: string,
    file: File,
    options?: RequestOptions
  ): Promise<Media> {
    if (!file.type.startsWith('image/')) {
      throw new WordPressError(
        'VALIDATION_ERROR',
        'Iba obrázky sú povolené',
        { file }
      );
    }

    const response = await this.callEdgeFunction<Media>(
      'POST',
      siteId,
      'media',
      {
        file: await file.arrayBuffer(),
        filename: file.name,
      },
      undefined,
      options
    );

    return MediaUploadResponseSchema.parse(response);
  }

  // ==================== COMMENT METHODS ====================

  async getComments(
    siteId: string,
    postId: number,
    page: number = 1,
    options?: RequestOptions
  ): Promise<CommentListResponse> {
    const data = await this.callEdgeFunction<any>(
      'GET',
      siteId,
      'comments',
      undefined,
      {
        post: postId.toString(),
        page: page.toString(),
        per_page: '10',
        orderby: 'date',
        order: 'desc',
      },
      options
    );

    return CommentListResponseSchema.parse({
      items: Array.isArray(data) ? data : [data],
      total: parseInt(data.total || '0'),
      total_pages: parseInt(data.total_pages || '1'),
      page,
      per_page: 10,
    });
  }

  async approveComment(
    siteId: string,
    commentId: number,
    options?: RequestOptions
  ): Promise<Comment> {
    const response = await this.callEdgeFunction<any>(
      'PATCH',
      siteId,
      `comments/${commentId}`,
      { status: 'approved' },
      undefined,
      options
    );

    return CommentSchema.parse(response);
  }

  // ==================== USER METHODS ====================

  async getUsers(
    siteId: string,
    options?: RequestOptions
  ): Promise<UserListResponse> {
    const data = await this.callEdgeFunction<any>(
      'GET',
      siteId,
      'users',
      undefined,
      { per_page: '100' },
      options
    );

    return UserListResponseSchema.parse({
      items: Array.isArray(data) ? data : [data],
      total: parseInt(data.total || '0'),
      total_pages: 1,
      page: 1,
      per_page: 100,
    });
  }

  // ==================== SETTINGS METHODS ====================

  async getSettings(
    siteId: string,
    options?: RequestOptions
  ): Promise<Settings> {
    const response = await this.callEdgeFunction<any>(
      'GET',
      siteId,
      'settings',
      undefined,
      undefined,
      options
    );

    return SettingsSchema.parse(response);
  }

  async updateSettings(
    siteId: string,
    settings: Partial<Settings>,
    options?: RequestOptions
  ): Promise<Settings> {
    const response = await this.callEdgeFunction<any>(
      'PATCH',
      siteId,
      'settings',
      settings,
      undefined,
      options
    );

    return SettingsSchema.parse(response);
  }

  // ==================== PLUGIN METHODS ====================

  async getPlugins(
    siteId: string,
    options?: RequestOptions
  ): Promise<PluginListResponse> {
    const data = await this.callEdgeFunction<any>(
      'GET',
      siteId,
      'plugins',
      undefined,
      undefined,
      options
    );

    return PluginListResponseSchema.parse({
      items: Array.isArray(data) ? data : [data],
      total: (Array.isArray(data) ? data.length : 1),
    });
  }

  async activatePlugin(
    siteId: string,
    plugin: string,
    options?: RequestOptions
  ): Promise<Plugin> {
    const response = await this.callEdgeFunction<Plugin>(
      'PATCH',
      siteId,
      `plugins/${plugin}`,
      { status: 'active' },
      undefined,
      options
    );

    return PluginSchema.parse(response);
  }

  async deactivatePlugin(
    siteId: string,
    plugin: string,
    options?: RequestOptions
  ): Promise<Plugin> {
    const response = await this.callEdgeFunction<Plugin>(
      'PATCH',
      siteId,
      `plugins/${plugin}`,
      { status: 'inactive' },
      undefined,
      options
    );

    return PluginSchema.parse(response);
  }
}

export const wordpressService = new WordPressService();