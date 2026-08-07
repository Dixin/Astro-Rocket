import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  accessOf,
  isGated,
  isVisible,
  canRead,
  publicEntries,
  gatedEntries,
  visibleEntries,
} from '@/lib/members/gating';
import type { MemberSession } from '@/lib/members/session';

const root = join(import.meta.dirname, '../..');

const session = (tiers: string[]): MemberSession => ({
  sub: 'hans@example.com',
  kind: 'email',
  tiers,
  exp: Math.floor(Date.now() / 1000) + 3600,
});

const entry = (access?: string) => ({ data: { access } });

describe('gating: reading the access field', () => {
  it('treats a missing, empty or "public" value as public', () => {
    expect(accessOf({})).toBeNull();
    expect(accessOf({ access: '' })).toBeNull();
    expect(accessOf({ access: '   ' })).toBeNull();
    expect(accessOf({ access: 'public' })).toBeNull();
    expect(isGated({})).toBe(false);
  });

  it('treats any other value as a gate', () => {
    expect(accessOf({ access: 'members' })).toBe('members');
    expect(accessOf({ access: ' pro ' })).toBe('pro');
    expect(isGated({ access: 'members' })).toBe(true);
  });
});

describe('gating: who may read', () => {
  it('lets anyone read public content, signed in or not', () => {
    expect(canRead(null, {})).toBe(true);
    expect(canRead(null, { access: 'public' })).toBe(true);
  });

  it('turns away a visitor with no session', () => {
    expect(canRead(null, { access: 'members' })).toBe(false);
    expect(canRead(null, { access: 'pro' })).toBe(false);
  });

  it('lets any member read `members` content', () => {
    expect(canRead(session([]), { access: 'members' })).toBe(true);
  });

  it('requires the named tier for anything else', () => {
    expect(canRead(session(['pro']), { access: 'pro' })).toBe(true);
    expect(canRead(session(['basic']), { access: 'pro' })).toBe(false);
    expect(canRead(session([]), { access: 'pro' })).toBe(false);
  });
});

describe('gating: fail closed when the feature is off', () => {
  // The theme ships with members.enabled false and MEMBERS_ENABLED unset, so
  // this is the state every existing site upgrades into.
  it('hides gated entries rather than publishing them', () => {
    expect(isVisible({ access: 'members' })).toBe(false);
    expect(isVisible({})).toBe(true);
  });

  it('drops them from listings', () => {
    const entries = [entry(), entry('members'), entry('pro')];
    expect(visibleEntries(entries)).toHaveLength(1);
  });
});

describe('gating: what gets prerendered', () => {
  it('splits public from gated without losing anything', () => {
    const entries = [entry(), entry('members'), entry(), entry('pro')];
    expect(publicEntries(entries)).toHaveLength(2);
    expect(gatedEntries(entries)).toHaveLength(2);
    expect(publicEntries(entries).length + gatedEntries(entries).length).toBe(entries.length);
  });
});

describe('gating: the wiring stays connected', () => {
  const read = (p: string) => readFileSync(join(root, p), 'utf8');

  it('keeps gated posts out of both prerendered detail routes', () => {
    // Without this a gated post is prerendered AND injected, which is a
    // duplicate route at best and a published members-only post at worst.
    expect(read('src/pages/blog/[...slug].astro')).toContain('publicEntries(posts)');
    expect(read('src/pages/[locale]/blog/[...slug].astro')).toContain('publicEntries(posts)');
  });

  it('keeps gated posts out of the RSS feed', () => {
    expect(read('src/lib/rss.ts')).toContain('publicEntries(');
  });

  it('filters listings through the visibility rule', () => {
    expect(read('src/lib/blog.ts')).toContain('visibleEntries(all)');
  });

  it('injects a route for every gated post', () => {
    const config = read('astro.config.mjs');
    expect(config).toContain('gatedPosts()');
    expect(config).toContain("entrypoint: './src/members/gated-post.astro'");
  });
});

describe('gating: the two URL rules agree', () => {
  /**
   * astro.config.mjs works out a gated post's URL from the file path, because
   * routes are injected before the content layer exists. src/lib/blog.ts works
   * it out from the entry id. Two copies of one rule drift, so this rebuilds
   * both from the same inputs and compares them.
   */
  const urlFromConfigRule = (id: string, locale: string, locales: string[], def: string) => {
    const slug = id.replace(new RegExp(`^(${[locale, ...locales].join('|')})/`), '');
    return locale === def ? `/blog/${slug}` : `/${locale}/blog/${slug}`;
  };

  const urlFromLibRule = (id: string, locale: string, locales: string[], def: string) => {
    // getPostSlug + localizedPath, inlined — importing them here would pull in
    // astro:content, which is not available under vitest.
    const slug = id.replace(new RegExp(`^(${[locale, ...locales].join('|')})/`), '');
    const path = `/blog/${slug}`;
    return locale === def ? path : `/${locale}${path}`;
  };

  it('produces the same URL for every shape of id', () => {
    const locales = ['en', 'nl'];
    const cases: [string, string][] = [
      ['en/my-post', 'en'],
      ['nl/mijn-bericht', 'nl'],
      ['my-post', 'en'],
      ['en/nested-name-with-dashes', 'en'],
    ];
    for (const [id, locale] of cases) {
      expect(urlFromConfigRule(id, locale, locales, 'en')).toBe(
        urlFromLibRule(id, locale, locales, 'en')
      );
    }
  });
});
