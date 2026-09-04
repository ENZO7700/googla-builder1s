function placeholderImageDataUri(label = 'wpBOX Preview'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#0a0a0a"/><stop offset="1" stop-color="#d4af37"/></linearGradient></defs><rect width="1200" height="800" fill="url(#g)"/><text x="60" y="420" fill="#fff" font-family="Arial, sans-serif" font-size="56" font-weight="700">${label}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function sanitizeGeneratedHtmlForWordPress(html: string): string {
  const safeImage = placeholderImageDataUri();
  return html
    .replace(/\s(src|poster)=(['"])\{\{[^}]+\}\}\2/gi, ` $1="$${'SAFE_IMAGE'}"`)
    .replace(/\s(srcset)=(['"])[^'"]*\{\{[^}]+\}\}[^'"]*\2/gi, ` $1="$${'SAFE_IMAGE'}"`)
    .replace(/\s(href|action)=(['"])\{\{[^}]+\}\}\2/gi, ' $1="#"')
    .replace(/url\((['"]?)\{\{[^}]+\}\}\1\)/gi, 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 55%, #3a2f12 100%)')
    .replace(/\$SAFE_IMAGE/g, safeImage);
}

export interface WordPressDeployDryRun {
  ok: boolean;
  detail: string;
  payload?: {
    siteId: string;
    method: 'POST';
    path: string;
    body: { title: string; content: string; status: 'draft' };
  };
}

/** Validates deploy payload shaping without calling wordpress-proxy or creating pages. */
export function validateWordPressDeployDryRun(
  code: string,
  language: string,
  siteId = '00000000-0000-0000-0000-000000000000',
): WordPressDeployDryRun {
  if (language !== 'html') {
    return { ok: false, detail: 'Deploy podporuje len HTML bloky' };
  }
  const trimmed = code.trim();
  if (!trimmed) {
    return { ok: false, detail: 'Prázdny HTML obsah' };
  }
  const safeCode = sanitizeGeneratedHtmlForWordPress(trimmed);
  if (safeCode.includes('{{') && /\{\{[^}]+\}\}/.test(safeCode)) {
    return { ok: false, detail: 'Nebezpečné URL placeholdery v HTML' };
  }
  return {
    ok: true,
    detail: `Dry-run OK (${safeCode.length} znakov, draft)`,
    payload: {
      siteId,
      method: 'POST',
      path: '/wp/v2/pages',
      body: {
        title: 'E2E Dry Run',
        content: safeCode,
        status: 'draft',
      },
    },
  };
}
