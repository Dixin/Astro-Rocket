import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const siteUrl = site?.toString() || 'https://example.com';

  const robotsTxt = `
User-agent: *
Allow: /

# Block API routes
Disallow: /api/

# Plain-Markdown map of this site for language models — see https://llmstxt.org
# LLM map: ${siteUrl}llms.txt

Sitemap: ${siteUrl}sitemap-index.xml
`.trim();

  return new Response(robotsTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
