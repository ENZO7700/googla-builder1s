import { describe, expect, it } from 'vitest';
import {
  PluginListResponseSchema,
  PluginSchema,
  PostListResponseSchema,
  PostSchema,
  SettingsSchema,
} from './types';
import samples from './__fixtures__/wp-api-samples.json';

describe('WordPress REST Zod schemas (real API shapes)', () => {
  it('parses web24 post', () => {
    const post = PostSchema.parse(samples.post);
    expect(post.id).toBe(1);
    expect(post.title.rendered).toContain('Ahoj');
  });

  it('parses post list response', () => {
    const list = PostListResponseSchema.parse({
      items: [samples.post],
      total: 1,
      total_pages: 1,
      page: 1,
      per_page: 10,
    });
    expect(list.items).toHaveLength(1);
  });

  it('parses settings without url/home (multisite web24)', () => {
    const settings = SettingsSchema.parse(samples.settings);
    expect(settings.title).toBe('LEE | web24');
    expect(settings.posts_per_page).toBe(10);
    expect(settings.url).toBeUndefined();
  });

  it('parses plugin with string author and no active flag', () => {
    const plugin = PluginSchema.parse(samples.plugin);
    expect(plugin.name).toBe('Admin Menu Editor Pro');
    expect(plugin.author).toEqual({ rendered: 'Janis Elsts' });
    expect(plugin.active).toBe(false);
    expect(plugin.update).toBe(false);
  });

  it('parses plugin list', () => {
    const list = PluginListResponseSchema.parse({
      items: [PluginSchema.parse(samples.plugin)],
      total: 1,
    });
    expect(list.total).toBe(1);
  });
});
