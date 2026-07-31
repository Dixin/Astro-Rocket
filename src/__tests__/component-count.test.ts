/**
 * Keeps the component count in the marketing copy tied to the registry.
 *
 * The number used to be 57, which came from another theme's documentation
 * rather than from this one. Nothing checked it, so it survived in six places
 * while the page's own badge said 50+ and the README broke 57 down into
 * categories that summed to 59.
 *
 * `component-registry.json` is the source of truth: the curated set a user
 * installs or copies. These tests fail when a component is added or removed
 * without the copy following, so the claim cannot drift again.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import registry from '../../component-registry.json';
import en from '../i18n/en.json';
import siteConfig from '../config/site.config';

const COUNT = Object.keys(registry.components).length;
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('component count', () => {
  it('the registry is the number the copy quotes', () => {
    expect(COUNT).toBe(44);
  });

  it('every file the registry lists exists', () => {
    for (const [name, entry] of Object.entries(registry.components)) {
      for (const file of entry.files) {
        expect(() => readFileSync(join(process.cwd(), file)), `${name} → ${file}`).not.toThrow();
      }
    }
  });

  it('site.config quotes it', () => {
    expect(siteConfig.description).toContain(`${COUNT} designed components`);
  });

  it('the English dictionary quotes it', () => {
    const json = JSON.stringify(en);
    expect(json).toContain(`${COUNT} designed components`);
    // Nothing should still be carrying the old figure.
    expect(json).not.toMatch(/\b57\+? (designed )?[Cc]omponents/);
    expect(json).not.toMatch(/\b50\+ production components/);
  });

  it('the showcase page and its post quote it', () => {
    expect(read('src/pages/components.astro')).toContain(`${COUNT} production components`);
    expect(read('src/content/blog/en/component-library.mdx')).toContain(`${COUNT} Components Ready to Use`);
  });

  it('the README quotes it, and its category breakdown adds up', () => {
    const readme = read('README.md');
    expect(readme).toContain(`**${COUNT} Components**`);

    // Second table cell only — the first holds the total, which would be
    // counted as part of its own breakdown.
    const row = readme.split('\n').find((l) => l.includes(`**${COUNT} Components**`)) ?? '';
    const breakdown = row.split('|')[2] ?? '';
    const parts = [...breakdown.matchAll(/(\d+)\s+[A-Za-z]/g)].map((m) => Number(m[1]));
    expect(parts.length, 'no category counts found in the README row').toBeGreaterThan(0);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(COUNT);
  });
});
