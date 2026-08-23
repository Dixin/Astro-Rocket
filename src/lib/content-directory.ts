export function getContentDirectoryNames(): string[] {
  const contentFiles = import.meta.glob<string>('/src/content/contents/**/*', { import: 'default', eager: true });
  const contentDirectoryNames = new Set<string>(Object.keys(contentFiles).map(getContentDirectoryNameFromPath));
  return Array.from(contentDirectoryNames);
}

export const cachedContentDirectoryNames = ['blog', 'live', 'music', 'news', 'wiki'];

export const getContentDirectoryNameFromId = (id: string) => {
    const index = id.indexOf('/');
    if (index <= 0) {
        throw new Error(`Invalid content ID: ${id}. Expected format: "contentDirectoryName/.."`);
    }
    const contentDirectoryName = id.substring(0, index);
    if (!contentDirectoryName) {
        throw new Error(`Invalid content ID: ${id}. Expected format: "contentDirectoryName/.."`);
    }
    return contentDirectoryName;
};

const getContentDirectoryNameFromPath = (path: string) => {
  if(!path.startsWith('/src/content/contents/') || path.split('/').length < 5) {
    throw new Error(`Unexpected content file path: ${path}. Expected to be under /src/content/contents/`);
  }
  const segments = path.split('/');
  return segments[4];
};
