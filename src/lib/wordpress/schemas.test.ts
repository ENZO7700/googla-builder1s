import { describe, expect, it } from 'vitest';
import {
  PluginListResponseSchema,
  PluginSchema,
  PostListResponseSchema,
  PostSchema,
  SettingsSchema,
  UserSchema,
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

  it('parses users/me from web24 (administrator)', () => {
    const user = UserSchema.parse(samples.userMe);
    expect(user.roles).toContain('administrator');
    expect(user.username).toBe('magnusevans');
  });

  it('derives active=true from status when active flag is missing', () => {
    const plugin = PluginSchema.parse(samples.pluginActive);
    expect(plugin.active).toBe(true);
    expect(plugin.status).toBe('active');
  });
});

describe('WordPress REST contract guards', () => {
  it('rejects post without slug (API regression)', () => {
    const broken = { ...samples.post, slug: undefined };
    expect(() => PostSchema.parse(broken)).toThrow();
  });

  it('rejects settings when posts_per_page is non-numeric string', () => {
    const broken = { ...samples.settings, posts_per_page: 'ten' };
    expect(() => SettingsSchema.parse(broken)).toThrow();
  });

  it('rejects plugin without version', () => {
    const { version: _v, ...broken } = samples.plugin;
    expect(() => PluginSchema.parse(broken)).toThrow();
  });

  it('rejects users/me without roles array', () => {
    const broken = { ...samples.userMe, roles: undefined };
    expect(() => UserSchema.parse(broken)).toThrow();
  });
});
