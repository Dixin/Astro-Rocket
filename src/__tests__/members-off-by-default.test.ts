import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import membersConfig from '@/config/members.config';

const root = join(import.meta.dirname, '../..');

/**
 * The members area must ship off, and off has to mean absent rather than
 * hidden. An existing site that upgrades and changes nothing should get the
 * build it had before: no member routes, and no serverless function where it
 * had none.
 *
 * These are cheap structural checks. Step 4 of the plan adds the build-level
 * proof — compiling with the flag off and asserting the output.
 */
describe('members area: off by default', () => {
  it('ships disabled', () => {
    expect(membersConfig.enabled).toBe(false);
  });

  it('ships with demo sign-in disabled', () => {
    // demo: true is an open door — anyone who posts to /demo-login is signed
    // in. It exists for astrorocket.dev and must never ship enabled.
    expect(membersConfig.demo).toBe(false);
  });

  it('ships no members, so an accidental enable grants nobody access', () => {
    expect(membersConfig.members).toHaveLength(0);
  });

  it('keeps the member pages out of src/pages, so nothing auto-routes', () => {
    // Anything under src/pages with `prerender = false` becomes an on-demand
    // route whatever the config says at runtime. The pages live in
    // src/members/ and are injected by the integration only when enabled.
    const config = readFileSync(join(root, 'astro.config.mjs'), 'utf8');
    expect(config).toContain("entrypoint: `./src/members/${entry}`");
    expect(config).toContain('if (!enabled) return;');
  });

  it('reads the prefix from config rather than hard-coding it', () => {
    const config = readFileSync(join(root, 'astro.config.mjs'), 'utf8');
    expect(config).toContain('membersConfig.prefix');
  });
});
