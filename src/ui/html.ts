/**
 * The only way this app builds HTML strings. Every interpolated value is escaped unless it is
 * itself a SafeHtml produced by this module. Scraped source text never reaches the DOM as HTML:
 * it is normalised into typed data first and then rendered through these templates.
 */
const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export class SafeHtml {
  readonly value: string;
  constructor(value: string) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]!);

function renderValue(v: unknown): string {
  if (v instanceof SafeHtml) return v.value;
  if (Array.isArray(v)) return v.map(renderValue).join('');
  if (v == null || v === false) return '';
  return escapeHtml(String(v));
}

export function html(strings: TemplateStringsArray, ...values: unknown[]): SafeHtml {
  let out = strings[0]!;
  for (let i = 0; i < values.length; i++) out += renderValue(values[i]) + strings[i + 1]!;
  return new SafeHtml(out);
}

/** Only absolute https URLs or same-site relative paths pass; anything else becomes '#'. */
export function safeUrl(url: string | null | undefined): string {
  if (!url) return '#';
  // Same-site path only: reject protocol-relative `//host` and `/\host`, which browsers treat as a host.
  if (/^\/(?![/\\])/.test(url)) return url;
  try {
    return new URL(url).protocol === 'https:' ? url : '#';
  } catch {
    return '#';
  }
}

/** JSON for an inline <script type="application/json">: "<" escaped, so data can never close the tag. */
export const inlineJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

/** The single DOM sink for template output. */
export function setHtml(el: Element, content: SafeHtml) {
  el.innerHTML = content.value;
}
