import type { APIRoute, GetStaticPaths } from 'astro';
import { collectTags, getPublishedContents, tagToSlug, getContentDirectoryNames } from '@/lib/contents';
import { renderOgSvg } from '@/lib/og';

export const getStaticPaths: GetStaticPaths = async () => {
  const paths: { params: { tag: string; content: string }; props: { tag: string; count: number; contentDirectoryName: string } }[] = [];
  for (const contentDirectoryName of getContentDirectoryNames()) {
    const contents = await getPublishedContents(contentDirectoryName);
    const tags = collectTags(contents);
    for (const tag of tags) {
      const count = contents.filter((content) => content.data.tags.includes(tag)).length;
      paths.push({
        params: { tag: tagToSlug(tag), content: contentDirectoryName },
        props: { tag, count, contentDirectoryName },
      });
    }
  }
  return paths;
};

export const GET: APIRoute = ({ props }) => {
  const tag = props.tag as string;
  const count = props.count as number;
  const svg = renderOgSvg({
    title: `#${tag}`,
    subtitle: `${count} content${count === 1 ? '' : 's'} on ${props.contentDirectoryName}`,
    kind: 'TAG',
  });
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
