import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: false });

/**
 * Markdown → sanitized HTML with `[n]` citations turned into clickable
 * superscripts (`<sup class="cite" data-n="n">`).
 */
export function renderMarkdown(md: string): string {
  const withCites = md.replace(/\[(\d{1,2})\]/g, (_, n: string) => `<sup class="cite" data-n="${n}" role="button" tabindex="0" title="Show source ${n}">${n}</sup>`);
  const html = marked.parse(withCites, { async: false }) as string;
  return DOMPurify.sanitize(html, { ADD_ATTR: ['role', 'tabindex', 'title'] });
}
