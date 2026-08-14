/**
 * Keeps interface text out of the component source and inside the locale files.
 *
 * The theme already translated everything you can see. It did not translate
 * what a screen reader announces: `aria-label`, `alt`, `placeholder` and
 * `title` carried English literals in the component library, so a Dutch site
 * built on this theme said "Close dialog" and "Previous page" to anyone using
 * one — invisible to a sighted reviewer, which is why it survived a
 * deliberate i18n sweep that got the same attribute right in 24 other places.
 *
 * `AGENTS.md` said "any visible interface text", and an `aria-label` is not
 * visible. The rule permitted it. Both the rule and these checks now name the
 * attributes, because three manual sweeps of this produced three different
 * counts and the fourth would have too.
 *
 * Scope is `src/components/` and `src/layouts/` — the library that ships into
 * every site built on this theme. `src/pages/components.astro` is deliberately
 * outside it: its strings are demo fixtures ("Sarah Chen", "Build failed")
 * shown to demonstrate a component, and a showcase page is the first thing
 * most people delete. Whether that page should be available in other
 * languages is a question about the demo, not a defect in the library.
 *
 * There is no exception list on purpose. A string that is the same in every
 * language — a product name like "Google Maps" — belongs in the locale files
 * with the same value in each, not in an allowlist here. An allowlist is
 * where the next violation would hide.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import en from '../i18n/en.json';
import nl from '../i18n/nl.json';

const ROOT = process.cwd();
const SCANNED = ['src/components', 'src/layouts'];
const EXTENSIONS = ['.astro', '.tsx', '.ts'];

/** Attributes and identifiers whose value is read aloud or shown to a reader. */
const PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  ['attribute', /(?:aria-label|alt|placeholder|title)="([^"{}]+)"/g],
  ['attribute expression', /(?:aria-label|alt|placeholder|title)=\{\s*['"]([^'"]+)['"]\s*\}/g],
  // Any literal on a line that resolves an ariaLabel. Narrower patterns that
  // required `=` or `??` immediately before the quote missed
  // `label ?? (hasVisibleLabel ? undefined : 'Progress')`.
  ['prop default or fallback', /\bariaLabel\b[^\n]*?['"]([^'"]{2,})['"]/g],
  ['setAttribute', /setAttribute\(\s*['"]aria-label['"]\s*,\s*[`'"]([^`'"]+)/g],
];

/**
 * Prose, rather than a token. Two words, or one capitalised word of three
 * letters or more — enough to catch "Dismiss" and "Close dialog" while
 * leaving `alt=""`, `title={title}` and CSS-ish values alone.
 *
 * Interpolation is stripped first: `Theme: ${mode}` is English prose built in
 * a client script, and reads aloud as English however the variable resolves.
 */
const isProse = (value: string) => {
  const text = value
    .replace(/\$\{[^}]*\}/g, '')
    .replace(/[:—–-]\s*$/, '')
    .trim();
  return (
    /^[A-Za-z][A-Za-z'’-]*(?:[ ][A-Za-z'’-]+)+$/.test(text) || /^[A-Z][a-z]{2,}$/.test(text)
  );
};

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (EXTENSIONS.some((ext) => entry.endsWith(ext))) out.push(path);
  }
  return out;
}

export function findHardcodedStrings(roots: string[] = SCANNED) {
  const found: { file: string; line: number; kind: string; value: string }[] = [];
  for (const root of roots) {
    for (const file of walk(join(ROOT, root))) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        // Usage examples in a component's own header comment are not rendered.
        if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
        for (const [kind, pattern] of PATTERNS) {
          for (const match of line.matchAll(new RegExp(pattern))) {
            if (isProse(match[1])) {
              found.push({ file: relative(ROOT, file), line: index + 1, kind, value: match[1] });
            }
          }
        }
      });
    }
  }
  return found;
}

const flatten = (value: unknown, prefix = ''): string[] =>
  typeof value !== 'object' || value === null
    ? [prefix]
    : Object.entries(value).flatMap(([key, child]) =>
        flatten(child, prefix ? `${prefix}.${key}` : key)
      );

describe('interface text lives in the locale files', () => {
  it('no component hard-codes a string a screen reader would announce', () => {
    const found = findHardcodedStrings();
    const report = found
      .map((f) => `  ${f.file}:${f.line}  ${f.kind}  "${f.value}"`)
      .join('\n');
    expect(found, `\n${report}\n\nMove these into src/i18n/*.json and read them through t().\n`).toEqual([]);
  });
});

describe('every locale carries every key', () => {
  const locales = { nl };

  for (const [name, dictionary] of Object.entries(locales)) {
    it(`${name}.json has no key missing against en.json`, () => {
      const expected = flatten(en);
      const actual = new Set(flatten(dictionary));
      // A missing key falls back to the default locale silently, so the page
      // renders English in place of the translation and nothing reports it —
      // exactly the failure this theme shipped in its own aria-labels.
      expect(expected.filter((key) => !actual.has(key))).toEqual([]);
    });

    it(`${name}.json has no key that en.json does not`, () => {
      const expected = new Set(flatten(en));
      expect(flatten(dictionary).filter((key) => !expected.has(key))).toEqual([]);
    });
  }
});
