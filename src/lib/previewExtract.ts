/** Extract deployable HTML from a markdown fenced block (same logic as workspace preview). */
export function extractHtmlFromMarkdown(text: string): string | null {
  if (!text) return null;
  const parts = text.split('```');
  for (let i = 1; i < parts.length; i += 2) {
    const block = parts[i];
    if (block.toLowerCase().startsWith('html') || block.toLowerCase().startsWith('xml')) {
      return block.substring(block.indexOf('\n') + 1).trim();
    }
  }
  return null;
}

export const SAMPLE_HTML_MARKDOWN = `\`\`\`html
<!-- wp:paragraph -->
<p>E2E náhľad</p>
<!-- /wp:paragraph -->
\`\`\``;
