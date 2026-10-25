// Legacy github.io compatibility site. GitHub Pages cannot send HTTP 301s, so every page the f1-stories.gr build
// publishes becomes a small page that sends readers, with query and hash, to the same page on f1-stories.gr (a
// client-side redirect plus a canonical, not an HTTP redirect). Every other file (images, data, figures) is kept,
// so existing links to them still work. Other old paths are handled by 404.html.
// Usage: node scripts/legacy-redirects.ts <f1-stories.gr build dir> <out dir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LEGACY_BASE = '/Tyres/';
export const TARGET = 'https://f1-stories.gr/tyres/';

export interface Route {
  route: string;
  noindex: boolean;
}

const attr = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const text = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function files(dir: string, rel = ''): string[] {
  return fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).flatMap((entry) => {
    const name = path.posix.join(rel, entry.name);
    return entry.isDirectory() ? files(dir, name) : entry.isFile() ? [name] : [];
  });
}

/** Pages of the f1-stories.gr build: route ('' = landing page, 'a/b/' = nested) and whether it is noindex. */
export function routes(dir: string): Route[] {
  return files(dir)
    .filter((rel) => rel === 'index.html' || rel.endsWith('/index.html'))
    .map((rel) => rel.slice(0, -'index.html'.length))
    .sort()
    .map((route) => ({
      route,
      noindex: /<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(
        fs.readFileSync(path.join(dir, route, 'index.html'), 'utf8'),
      ),
    }));
}

// The destination is always clamped to this tool on f1-stories.gr, so no input can make it an open redirect.
const navigate = (expression: string) =>
  `<script>(function(){var d=${expression};if(d.indexOf(${JSON.stringify(TARGET)})!==0)d=${JSON.stringify(TARGET)};` +
  'location.replace(d);document.addEventListener("DOMContentLoaded",function(){var a=document.getElementById("destination");a.href=d;a.textContent=d;});})();</script>';

const page = ({
  target,
  noindex,
  script,
  message,
}: {
  target: string;
  noindex: boolean;
  script: string;
  message: string;
}) => `<!doctype html>
<html lang="el">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Μεταφέρθηκε στο F1 Stories</title>
<link rel="canonical" href="${attr(target)}">${noindex ? '\n<meta name="robots" content="noindex">' : ''}
${script}
<noscript><meta http-equiv="refresh" content="0;url=${attr(target)}"></noscript>
</head>
<body>
<p>${text(message)}</p>
<p><a id="destination" href="${attr(target)}">${text(target)}</a></p>
</body>
</html>
`;

/** The page for one route: same path, query and hash on f1-stories.gr. */
export function pageFor({ route, noindex }: Route): string {
  const target = TARGET + route;
  return page({
    target,
    noindex,
    script: navigate(`${JSON.stringify(target)}+location.search+location.hash`),
    message: 'Αυτή η σελίδα μεταφέρθηκε στο F1 Stories:',
  });
}

/** Any other old path: the same page on f1-stories.gr when it exists there (any case, with or without the
 *  trailing slash), otherwise the tool's landing page; query and hash kept. */
export function notFoundPage(known: Pick<Route, 'route'>[]): string {
  const lookup = JSON.stringify(known.map(({ route }) => route.toLowerCase()));
  const expression =
    `(function(){var p=location.pathname.toLowerCase(),b=${JSON.stringify(LEGACY_BASE.toLowerCase())},r=p.indexOf(b)===0?p.slice(b.length):"",k=${lookup};` +
    'if(r&&r.slice(-1)!=="/"&&k.indexOf(r+"/")!==-1)r+="/";' +
    `return ${JSON.stringify(TARGET)}+(k.indexOf(r)!==-1?r:"")+location.search+location.hash;})()`;
  return page({
    target: TARGET,
    noindex: true,
    script: navigate(expression),
    message: 'Αυτή η εφαρμογή μεταφέρθηκε στο F1 Stories:',
  });
}

/** Writes the compatibility site: build files minus HTML, one page per route, 404.html and .nojekyll. */
export function writeSite(build: string, out: string): { pages: number; files: number } {
  const known = routes(build);
  if (!known.some(({ route }) => route === ''))
    throw new Error(`${build}: no landing page; build for f1-stories.gr first`);
  fs.rmSync(out, { recursive: true, force: true });
  for (const rel of files(build)) {
    if (rel.endsWith('.html') || rel.endsWith('.map')) continue;
    fs.mkdirSync(path.dirname(path.join(out, rel)), { recursive: true });
    fs.copyFileSync(path.join(build, rel), path.join(out, rel));
  }
  for (const entry of known) {
    fs.mkdirSync(path.join(out, entry.route), { recursive: true });
    fs.writeFileSync(path.join(out, entry.route, 'index.html'), pageFor(entry));
  }
  fs.writeFileSync(path.join(out, '404.html'), notFoundPage(known));
  fs.writeFileSync(path.join(out, '.nojekyll'), '');
  return { pages: known.length, files: files(out).length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [build, out] = process.argv.slice(2);
  if (!build || !out) throw new Error('Usage: node scripts/legacy-redirects.ts <build dir> <out dir>');
  const result = writeSite(path.resolve(build), path.resolve(out));
  console.log(
    `Legacy compatibility site: ${result.pages} pages (+ 404.html) → ${TARGET}, ${result.files} files in ${out}`,
  );
}
