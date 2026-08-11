import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The LetterGlitch tutorial publishes the component's whole source in a code
 * block, so a reader following it copies that block into their own project.
 *
 * Between May and August 2026 the component was fixed twice and the post was
 * not, so the code being handed to readers was two versions behind the code
 * shipping in the theme — including a performance fault that was reported as
 * a bug (#646). Nothing failed, because nothing compared them.
 *
 * This does. The block has to be the file, character for character.
 */
const COMPONENT = fileURLToPath(
  new URL('../components/effects/LetterGlitch.tsx', import.meta.url)
);
const POST = fileURLToPath(
  new URL('../content/blog/en/letter-glitch-astro-7.mdx', import.meta.url)
);

/** The first ```tsx block in the post. */
function publishedSource(markdown: string): string | null {
  const match = /^```tsx\n([\s\S]*?)^```$/m.exec(markdown);
  return match ? match[1] : null;
}

describe('the LetterGlitch tutorial', () => {
  const post = readFileSync(POST, 'utf8');
  const component = readFileSync(COMPONENT, 'utf8');

  it('publishes a tsx block', () => {
    expect(publishedSource(post)).not.toBeNull();
  });

  it('publishes exactly the component the theme ships', () => {
    expect(publishedSource(post)).toBe(component);
  });

  it('does not tell readers the loop is unthrottled', () => {
    // The post used to say "No throttling beyond requestAnimationFrame",
    // which stopped being true when the IntersectionObserver was added.
    expect(post).not.toMatch(/No throttling beyond/i);
  });
});
