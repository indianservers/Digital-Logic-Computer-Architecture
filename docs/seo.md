# SEO URLs and deployment

All catalogue studios and labs have a readable public path, and each textbook lesson
uses that path followed by `/theory`. The home textbook is `/textbook`.

Examples:

- `/studios/number-systems/hamming-code`
- `/studios/number-systems/hamming-code/theory`
- `/studios/fetch-decode-execute/register-transfers/theory`

Existing `?tab=`, `?view=theory`, and encyclopedia `?article=` bookmarks remain
supported. The central router maps public paths to the simulator's existing route
IDs, preserving simulator settings and back/forward navigation. All React Router
links expose public paths in their hrefs.

## Build

Run `npm run build`. This regenerates `src/seo/routes.json` from the textbook
catalogue, type-checks and bundles the app, and writes static HTML for all public
pages. Textbook HTML contains the actual lesson, diagrams, examples, and questions,
so reading content is present before JavaScript runs. Other pages include an
introductory heading and crawlable lesson navigation before the app mounts.

Set `VITE_SITE_URL=https://your-real-domain.com` in `.env.production.local` or the
build environment. This produces absolute canonical/social URLs and `sitemap.xml`,
and adds the sitemap to `robots.txt`. No placeholder production domain is emitted.
Client navigation uses that same origin, falling back to the current browser origin
for local development. Personal notes are marked `noindex,follow`.

## Hosting

Serve generated `dist/**/index.html` for clean paths, without adding a trailing
slash redirect. Serve `dist/index.html` as the SPA fallback for legacy query URLs.
Vite development and preview servers issue HTTP 301 redirects for old URLs.
On other hosting platforms, configure equivalent permanent redirects before the
SPA fallback; `dist/seo-redirects.json` lists the catalogue migrations. Query-string
matching is host-specific: match the `tab` and `view` parameters regardless of order,
and preserve unrelated simulator settings. The client also normalizes bookmarks
when an unconfigured static host serves them.

When adding or renaming labs, run `npm run seo:routes` and commit the regenerated
index. `npm test -- src/seo/urls.test.ts` checks every lab/theory mapping for unique
slugs, round-trip routing, and preserved settings.
