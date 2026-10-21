import DOMPurify from 'dompurify';

/**
 * Sanitizes article HTML content using DOMPurify with safe defaults.
 * Allows necessary semantic article tags (h1-h6, p, ul, ol, li, table, a, img, code, pre, etc.)
 * while stripping script tags, javascript: URLs, and malicious event handlers.
 * 
 * Works seamlessly in both browser environments (via DOMPurify) and Node test runner environments.
 */
export const sanitizeArticleHtml = (dirtyHtml) => {
  if (!dirtyHtml) return '';

  if (typeof window !== 'undefined') {
    const purify = typeof DOMPurify?.sanitize === 'function' ? DOMPurify : (typeof DOMPurify === 'function' ? DOMPurify(window) : null);
    if (purify && typeof purify.sanitize === 'function') {
      return purify.sanitize(dirtyHtml, {
        USE_PROFILES: { html: true },
        ALLOWED_TAGS: [
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'strong', 'em', 'b', 'i', 'u',
          'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
          'blockquote', 'code', 'pre', 'hr', 'br', 'a', 'div', 'img', 'time'
        ],
        ALLOWED_ATTR: [
          'id', 'class', 'href', 'title', 'target', 'rel', 'src', 'alt', 'width', 'height', 'datetime'
        ],
        ALLOW_DATA_ATTR: false,
      });
    }
  }

  // Fallback for non-browser / Node.js test environments without JSDOM
  return dirtyHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '')
    .replace(/href\s*=\s*(['"])\s*javascript:[^'"]*\1/gi, 'href="#"')
    .replace(/href\s*=\s*javascript:[^\s>]+/gi, 'href="#"');
};

export default sanitizeArticleHtml;
