export function normalizeRequestPath(path: string): string | null {
  const trimmed = path.trim();
  if (!trimmed) return null;
  if (trimmed.includes('..') || trimmed.includes('\\') || /^https?:\/\//i.test(trimmed)) {
    return null;
  }

  if (trimmed === '/' || trimmed === '/wp-json' || trimmed === '/wp-json/') {
    return '/';
  }

  if (trimmed.startsWith('/wp-json/')) {
    return trimmed.slice('/wp-json'.length);
  }

  if (trimmed.startsWith('wp-json/')) {
    return `/${trimmed.slice('wp-json/'.length)}`;
  }

  if (trimmed.startsWith('wp/v2/')) {
    return `/${trimmed}`;
  }

  return trimmed;
}
