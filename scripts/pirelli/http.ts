/**
 * Polite build-time HTTP for press.pirelli.com:
 * identifying User-Agent, ≥ 5 s between requests (robots.txt Crawl-delay), conditional requests
 * with a small on-disk cache, bounded retries with exponential backoff, and a request timeout.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const USER_AGENT =
  process.env.PIRELLI_USER_AGENT ??
  'F1StoriesTyreIntel/1.0 (+https://github.com/georgiosbalatzis; unofficial fan visualisation; build-time only)';

const ALLOWED_HOSTS = new Set(['press.pirelli.com', 'www.pirelli.com', 'content.presspage.com']);
/** The press sitemap is ~8 MB; anything far larger is not what we expect and is not parsed. */
const MAX_BYTES = 25 * 1024 * 1024;

function assertAllowed(url: URL) {
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname))
    throw new Error(`Refusing to fetch ${url.href}`);
}

/** Follows at most 5 redirects, re-checking every hop against the https host allow-list. */
async function fetchWithinAllowList(url: string, headers: Record<string, string>, timeoutMs: number) {
  let current = new URL(url);
  for (let hop = 0; hop <= 5; hop++) {
    assertAllowed(current);
    const res = await fetch(current, { headers, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && res.status !== 304 && location) {
      current = new URL(location, current);
      continue;
    }
    return res;
  }
  throw new Error(`Too many redirects for ${url}`);
}

export interface PoliteFetchOptions {
  cacheDir: string;
  delayMs?: number;
  retries?: number;
  timeoutMs?: number;
}

export function createPoliteFetch({
  cacheDir,
  delayMs = 5000,
  retries = 3,
  timeoutMs = 20000,
}: PoliteFetchOptions) {
  let last = 0;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  return async function politeFetch(
    url: string,
  ): Promise<{ status: number; body: string; fromCache: boolean }> {
    assertAllowed(new URL(url));
    const key = createHash('sha1').update(url).digest('hex');
    const metaFile = path.join(cacheDir, `${key}.json`);
    const bodyFile = path.join(cacheDir, `${key}.body`);
    await mkdir(cacheDir, { recursive: true });
    const meta = await readFile(metaFile, 'utf8')
      .then((t) => JSON.parse(t) as { etag?: string; lastModified?: string })
      .catch(() => null);

    for (let attempt = 0; ; attempt++) {
      const wait = last + delayMs - Date.now();
      if (wait > 0) await sleep(wait);
      last = Date.now();
      const headers: Record<string, string> = {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xml;q=0.9,*/*;q=0.5',
      };
      if (meta?.etag) headers['If-None-Match'] = meta.etag;
      if (meta?.lastModified) headers['If-Modified-Since'] = meta.lastModified;
      try {
        const res = await fetchWithinAllowList(url, headers, timeoutMs);
        if (res.status === 304)
          return { status: 200, body: await readFile(bodyFile, 'utf8'), fromCache: true };
        if ((res.status === 429 || res.status >= 500) && attempt < retries) {
          const retryAfter = Number(res.headers.get('retry-after'));
          await sleep(
            Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : delayMs * 2 ** (attempt + 1),
          );
          continue;
        }
        const declared = Number(res.headers.get('content-length'));
        if (declared > MAX_BYTES) throw new Error(`Response too large (${declared} bytes)`);
        const body = await res.text();
        if (body.length > MAX_BYTES) throw new Error('Response too large');
        if (res.ok) {
          await writeFile(bodyFile, body);
          await writeFile(
            metaFile,
            JSON.stringify({
              url,
              etag: res.headers.get('etag') ?? undefined,
              lastModified: res.headers.get('last-modified') ?? undefined,
            }),
          );
        }
        return { status: res.status, body, fromCache: false };
      } catch (err) {
        if (attempt >= retries) throw err;
        await sleep(delayMs * 2 ** (attempt + 1));
      }
    }
  };
}
