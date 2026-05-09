import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { wordpressService } from './wordpressService';
import { ErrorMessagesMap } from './types';
import type {
  Post,
  PostUpdate,
  PostListResponse,
  Page,
  PageListResponse,
  Comment,
  CommentListResponse,
  User,
  UserListResponse,
  Plugin,
  PluginListResponse,
  Media,
  Settings,
} from './types';

export interface UseWordPressServiceReturn {
  // Posts
  posts: Post[];
  postsLoading: boolean;
  postsError: Error | null;
  postsPage: number;
  setPostsPage: (page: number) => void;
  postsSearch: string;
  setPostsSearch: (search: string) => void;

  // Pages
  pages: Page[];
  pagesLoading: boolean;
  pagesError: Error | null;

  // Comments
  comments: Comment[];
  commentsLoading: boolean;
  commentsError: Error | null;
  commentsPage: number;
  setCommentsPage: (page: number) => void;
  selectedCommentPostId: number | null;
  setSelectedCommentPostId: (id: number | null) => void;

  // Users
  users: User[];
  usersLoading: boolean;
  usersError: Error | null;

  // Plugins
  plugins: Plugin[];
  pluginsLoading: boolean;
  pluginsError: Error | null;

  // Settings
  settings: Settings | null;
  settingsLoading: boolean;
  settingsError: Error | null;

  // Mutations
  updatePost: (data: { postId: number; data: PostUpdate }) => void;
  updatePostLoading: boolean;
  deletePost: (postId: number) => void;
  deletePostLoading: boolean;
  uploadMedia: (file: File) => void;
  uploadMediaLoading: boolean;
  approveComment: (commentId: number) => void;
  approveCommentLoading: boolean;
  activatePlugin: (plugin: string) => void;
  activatePluginLoading: boolean;
  deactivatePlugin: (plugin: string) => void;
  deactivatePluginLoading: boolean;
  updateSettings: (settings: Partial<Settings>) => void;
  updateSettingsLoading: boolean;

  // Utilities
  refetchAll: () => Promise<void>;
}

export function useWordPressService(siteId: string): UseWordPressServiceReturn {
  const queryClient = useQueryClient();
  const [postsPage, setPostsPage] = React.useState(1);
  const [postsSearch, setPostsSearch] = React.useState('');
  const [commentsPage, setCommentsPage] = React.useState(1);
  const [selectedCommentPostId, setSelectedCommentPostId] = React.useState<number | null>(null);

  // ==================== QUERIES ====================

  const { data: postsData, isLoading: postsLoading, error: postsError } = useQuery<PostListResponse>({
    queryKey: ['wp_posts', siteId, postsPage, postsSearch],
    queryFn: () =>
      wordpressService.getPostsPreview(siteId, postsPage, postsSearch || undefined),
    enabled: !!siteId,
  });

  const { data: pagesData, isLoading: pagesLoading, error: pagesError } = useQuery<PageListResponse>({
    queryKey: ['wp_pages', siteId],
    queryFn: () => wordpressService.getPagesList(siteId),
    enabled: !!siteId,
  });

  const { data: commentsData, isLoading: commentsLoading, error: commentsError } = useQuery<CommentListResponse>({
    queryKey: ['wp_comments', siteId, selectedCommentPostId, commentsPage],
    queryFn: () =>
      selectedCommentPostId
        ? wordpressService.getComments(siteId, selectedCommentPostId, commentsPage)
        : Promise.resolve({ items: [], total: 0, total_pages: 0, page: 1, per_page: 10 }),
    enabled: !!siteId && !!selectedCommentPostId,
  });

  const { data: usersData, isLoading: usersLoading, error: usersError } = useQuery<UserListResponse>({
    queryKey: ['wp_users', siteId],
    queryFn: () => wordpressService.getUsers(siteId),
    enabled: !!siteId,
  });

  const { data: pluginsData, isLoading: pluginsLoading, error: pluginsError } = useQuery<PluginListResponse>({
    queryKey: ['wp_plugins', siteId],
    queryFn: () => wordpressService.getPlugins(siteId),
    enabled: !!siteId,
  });

  const { data: settingsData, isLoading: settingsLoading, error: settingsError } = useQuery<Settings>({
    queryKey: ['wp_settings', siteId],
    queryFn: () => wordpressService.getSettings(siteId),
    enabled: !!siteId,
  });

  // ==================== MUTATIONS ====================

  const updatePostMutation = useMutation({
    mutationFn: ({ postId, data }: { postId: number; data: PostUpdate }) =>
      wordpressService.updatePost(siteId, postId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wp_posts', siteId] });
      toast.success('Post aktualizovaný');
    },
    onError: (error: any) => {
      toast.error('Chyba pri update', {
        description: error.message || ErrorMessagesMap.UNKNOWN_ERROR,
      });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: (postId: number) => wordpressService.deletePost(siteId, postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wp_posts', siteId] });
      toast.success('Post zmazaný');
    },
    onError: (error: any) => {
      toast.error('Chyba pri zmazaní', {
        description: error.message || ErrorMessagesMap.UNKNOWN_ERROR,
      });
    },
  });

  const uploadMediaMutation = useMutation({
    mutationFn: (file: File) => wordpressService.uploadMedia(siteId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wp_media', siteId] });
      toast.success('Obrázok nahraný');
    },
    onError: (error: any) => {
      toast.error('Chyba pri nahrátí', {
        description: error.message || ErrorMessagesMap.UNKNOWN_ERROR,
      });
    },
  });

  const approveCommentMutation = useMutation({
    mutationFn: (commentId: number) =>
      wordpressService.approveComment(siteId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wp_comments', siteId] });
      toast.success('Komentár schválený');
    },
    onError: (error: any) => {
      toast.error('Chyba pri schválení', {
        description: error.message || ErrorMessagesMap.UNKNOWN_ERROR,
      });
    },
  });

  const activatePluginMutation = useMutation({
    mutationFn: (plugin: string) => wordpressService.activatePlugin(siteId, plugin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wp_plugins', siteId] });
      toast.success('Plugin aktivovaný');
    },
    onError: (error: any) => {
      toast.error('Chyba pri aktivácii', {
        description: error.message || ErrorMessagesMap.UNKNOWN_ERROR,
      });
    },
  });

  const deactivatePluginMutation = useMutation({
    mutationFn: (plugin: string) => wordpressService.deactivatePlugin(siteId, plugin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wp_plugins', siteId] });
      toast.success('Plugin deaktivovaný');
    },
    onError: (error: any) => {
      toast.error('Chyba pri deaktivácii', {
        description: error.message || ErrorMessagesMap.UNKNOWN_ERROR,
      });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (settings: Partial<Settings>) =>
      wordpressService.updateSettings(siteId, settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wp_settings', siteId] });
      toast.success('Nastavenia aktualizované');
    },
    onError: (error: any) => {
      toast.error('Chyba pri update', {
        description: error.message || ErrorMessagesMap.UNKNOWN_ERROR,
      });
    },
  });

  // ==================== UTILITIES ====================

  const refetchAll = async () => {
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['wp_posts', siteId] }),
      queryClient.refetchQueries({ queryKey: ['wp_pages', siteId] }),
      queryClient.refetchQueries({ queryKey: ['wp_comments', siteId] }),
      queryClient.refetchQueries({ queryKey: ['wp_users', siteId] }),
      queryClient.refetchQueries({ queryKey: ['wp_plugins', siteId] }),
      queryClient.refetchQueries({ queryKey: ['wp_settings', siteId] }),
    ]);
  };

  return {
    // Posts
    posts: postsData?.items || [],
    postsLoading,
    postsError: postsError as Error | null,
    postsPage,
    setPostsPage,
    postsSearch,
    setPostsSearch,

    // Pages
    pages: pagesData?.items || [],
    pagesLoading,
    pagesError: pagesError as Error | null,

    // Comments
    comments: commentsData?.items || [],
    commentsLoading,
    commentsError: commentsError as Error | null,
    commentsPage,
    setCommentsPage,
    selectedCommentPostId,
    setSelectedCommentPostId,

    // Users
    users: usersData?.items || [],
    usersLoading,
    usersError: usersError as Error | null,

    // Plugins
    plugins: pluginsData?.items || [],
    pluginsLoading,
    pluginsError: pluginsError as Error | null,

    // Settings
    settings: settingsData || null,
    settingsLoading,
    settingsError: settingsError as Error | null,

    // Mutations
    updatePost: (data) => updatePostMutation.mutate(data),
    updatePostLoading: updatePostMutation.isPending,
    deletePost: (postId) => deletePostMutation.mutate(postId),
    deletePostLoading: deletePostMutation.isPending,
    uploadMedia: (file) => uploadMediaMutation.mutate(file),
    uploadMediaLoading: uploadMediaMutation.isPending,
    approveComment: (commentId) => approveCommentMutation.mutate(commentId),
    approveCommentLoading: approveCommentMutation.isPending,
    activatePlugin: (plugin) => activatePluginMutation.mutate(plugin),
    activatePluginLoading: activatePluginMutation.isPending,
    deactivatePlugin: (plugin) => deactivatePluginMutation.mutate(plugin),
    deactivatePluginLoading: deactivatePluginMutation.isPending,
    updateSettings: (settings) => updateSettingsMutation.mutate(settings),
    updateSettingsLoading: updateSettingsMutation.isPending,

    // Utilities
    refetchAll,
  };
}