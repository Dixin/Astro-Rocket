import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { renderOgPng } from '@/lib/og';
import { getPostSlug } from '@/lib/blog';
import { defaultLocale } from '@/i18n';

export const prerender = true;

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getCollection('blog', ({ data }) => {
    return data.locale === defaultLocale && (import.meta.env.PROD ? data.draft !== true : true);
  });
  return posts.map((post) => ({
    params: { slug: getPostSlug(post.id, post.data.locale) },
    props: {
      title: post.data.title,
      description: post.data.description,
    },
  }));
};

export const GET: APIRoute = async ({ props }) => {
  const png = await renderOgPng({
    title: props.title as string,
    subtitle: props.description as string | undefined,
    kind: 'BLOG',
  });
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
