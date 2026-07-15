import type { APIRoute, GetStaticPaths } from 'astro';
import { renderOgSvg } from '@/lib/og';
import { getContentSlug, getContentDirectoryNames, getPublishedContents } from '@/lib/contents';
import { defaultLocale } from '@/i18n';

export const getStaticPaths: GetStaticPaths = async () => {
  const paths: {
    params: { content: string; slug: string };
    props: { title: string; description: string; contentDirectoryName: string };
  }[] = [];
  for (const contentDirectoryName of getContentDirectoryNames()) {
    const contents = await getPublishedContents(contentDirectoryName);
    for (const content of contents) {
      paths.push({
        params: {
          content: contentDirectoryName,
          slug: getContentSlug(contentDirectoryName, content.id, content.data.locale),
        },
        props: {
          title: content.data.title,
          description: content.data.description,
          contentDirectoryName,
        },
      });
    }
  }

  return paths;
};

export const GET: APIRoute = ({ props }) => {
  const svg = renderOgSvg({
    title: props.title as string,
    subtitle: props.description as string | undefined,
    kind: (props.contentDirectoryName as string).toUpperCase(),
  });
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
