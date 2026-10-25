/**
 * Build for f1-stories.gr/tyres/, assembled by f1StoriesPage next to the site and the other tools: base path and
 * canonical site URL, same-origin shell links, no source maps, then the social cards and panel images.
 * `npm run build` (standalone GitHub Pages) is unchanged.
 *
 *   npm run build:f1stories
 */
import { spawnSync } from 'node:child_process';

const env = {
  ...process.env,
  BASE_PATH: '/tyres/',
  SITE_URL: 'https://f1-stories.gr/tyres/',
  F1STORIES_BUILD: 'true',
};
const run = (...args: string[]) => {
  const result = spawnSync(args[0]!, args.slice(1), { stdio: 'inherit', env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};
run('npm', 'run', 'build');
// Playwright's own Chromium for this lockfile; the host installs system libraries (`--with-deps`) if it needs them.
run('npx', 'playwright', 'install', 'chromium');
run('npm', 'run', 'og');
