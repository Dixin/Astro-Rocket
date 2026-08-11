import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The LetterGlitch tutorial publishes two whole files in code blocks — the
 * React canvas component and the Astro wrapper around it — so a reader
 * following it copies both into their own project.
 *
 * Both had drifted. The component was two versions behind, carrying the fault
 * reported as #646 and a per-frame layout read fixed before that. The wrapper
 * was missing a `maxWidth` prop and the whole shadow treatment. Nothing
 * failed, because nothing compared them.
 *
 * This does. Each block has to be its file, character for character.
 */
const files = {
  component: '../components/effects/LetterGlitch.tsx',
  wrapper: '../components/patterns/LetterGlitchBand.astro',
} as const;

const POST = fileURLToPath(
  new URL('../content/blog/en/letter-glitch-astro-7.mdx', import.meta.url)
);

/** The first fenced block of a given language in the post. */
function publishedSource(markdown: string, lang: string): string | null {
  const fence = new RegExp(`^\`\`\`${lang}\\n([\\s\\S]*?)^\`\`\`$`, 'm');
  const match = fence.exec(markdown);
  return match ? match[1] : null;
}

describe('the LetterGlitch tutorial', () => {
  const post = readFileSync(POST, 'utf8');
  const read = (rel: string) =>
    readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

  it('publishes exactly the component the theme ships', () => {
    expect(publishedSource(post, 'tsx')).toBe(read(files.component));
  });

  it('publishes exactly the wrapper the theme ships', () => {
    expect(publishedSource(post, 'astro')).toBe(read(files.wrapper));
  });

  it('does not tell readers the loop is unthrottled', () => {
    // The post used to say "No throttling beyond requestAnimationFrame",
    // which stopped being true when the IntersectionObserver was added.
    expect(post).not.toMatch(/No throttling beyond/i);
  });
});
