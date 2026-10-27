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
so reading content is present before JavaScript runs. Simulator pages also contain a visible learning guide, diagram, worked example,
common mistakes, FAQs, and crawlable lesson navigation before the app mounts.

The default production origin is `https://digital.aimersociety.com`. Builds always
produce absolute canonical/social URLs and `sitemap.xml`, even when no environment
variable is configured. Override `VITE_SITE_URL` only when publishing a different
public origin. Browser metadata uses the same configured public origin. Personal
notes are marked `noindex,follow` and excluded from the sitemap.

All public learning pages include Organization, WebSite, BreadcrumbList, and page
metadata. Theory uses LearningResource. FAQPage answers are generated from exactly
the same data rendered visibly in the page, including expandable answers. Schema
is descriptive and does not guarantee a rich result or AI recommendation.

The build publishes `/robots.txt`, `/llms.txt`, and `/llms/*.txt` studio indexes.
The optional LLM indexes link to every canonical lesson and simulator. They are
navigation aids, not instructions to models or substitutes for sitemap/indexing.
The existing wildcard crawler permission remains unchanged; named search and
user-directed retrieval agents are explicitly permitted. This does not change
hosting firewalls, authenticate bots, or guarantee model training/inclusion.

## Hosting

### Vercel

The root `vercel.json` selects the full `npm run build` pipeline and publishes
`dist`, including the generated textbook pages. Routing Middleware uses the same
public URL mapping as the browser to issue HTTP 308 redirects before filesystem
routing, including legacy `tab`, `view`, and `article` query strings. Canonical
static pages and assets are served directly. The fallback function resolves
remaining legacy paths or returns HTTP 404 with `noindex`; unknown pages do not
silently return the home page with status 200. The preview server has equivalent
canonical redirects, static-page selection, and HTML 404 handling.

Redeploy the Vercel project after changing this configuration; local Vite routing
does not change an already published deployment. In Project Settings, the Root
Directory must be the directory containing this `vercel.json` and `package.json`.

After deployment, open `/architecture/builder/builder` in a new browser tab and
refresh it. Also verify a textbook URL and a JavaScript asset to confirm that
generated lesson HTML and assets still take precedence over the SPA fallback.

### Other static hosts

Serve generated `dist/**/index.html` for clean paths, without adding a trailing
slash redirect. Configure legacy redirects before filesystem routing; serve `dist/404.html` with
HTTP 404 for unknown URLs.
Vite development and preview servers issue HTTP 301 redirects for old URLs.
On other hosting platforms, configure equivalent permanent redirects before the
SPA fallback; `dist/seo-redirects.json` lists the catalogue migrations. Query-string
matching is host-specific: match the `tab` and `view` parameters regardless of order,
and preserve unrelated simulator settings. The client also normalizes bookmarks
when an unconfigured static host serves them.

When adding or renaming labs, run `npm run seo:routes` and commit the regenerated
index. `npm test -- src/seo/urls.test.ts` checks every lab/theory mapping for unique
slugs, round-trip routing, and preserved settings.

## Verification and release

- `npm run build`: typecheck, bundle, prerender, and exhaustive static SEO audit.
- `npm test -- --testTimeout=30000`: simulator, curriculum, URL, and lesson tests.
- `npm run preview -- --port 7566 --strictPort`: inspect production HTML locally.
- `node scripts/seo/check-http.mjs http://localhost:7566`: crawl all published URLs,
  check legacy redirects, bot access, discovery files, assets, and unknown-page status.
- `output/seo/build-audit.json` and `output/seo/http-audit.json`: verification reports.

After deployment, run the HTTP audit against the production origin. Check Vercel
Bot Management/firewall logs for blocked verified crawlers; do not assume a spoofed
User-Agent proves the request is a genuine provider bot. Submit `/sitemap.xml` in
Google Search Console and Bing Webmaster Tools using the site owner's account.
No verification tokens, fictional authors, ratings, or endorsements are generated.
Use actual editorial reviewers and meaningful dates when adding reviewed material.

Reference guidance: https://developers.openai.com/api/docs/bots,
https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler,
and https://developers.google.com/search/docs/appearance/ai-features.
Search access and training permissions are separate provider controls. `llms.txt`
and FAQ markup do not promise inclusion or recommendations. Measure search index
coverage, crawl errors, search clicks, and identifiable assistant referrals after
release; no analytics event contains private study notes.

## Text retrieval and source attribution

Every canonical lab has an accompanying `/theory.md` file, generated from the same
focused lesson data as the HTML textbook. It includes mechanism descriptions,
diagram explanations, equations, worked solutions, questions, common mistakes,
FAQs, references, and the original HTML source URL. FAQs have numbered section
anchors for links to individual answers. The textbook displays a citation section
and a link to its Markdown version; page heads advertise the text representation.

`/learning-resources.json` lists every lesson's title, studio, topics, canonical
HTML URL, simulator URL, and Markdown URL. `/llms.txt` links to this directory and
studio indexes. `/llms-full.txt` combines the public lesson text, with attribution
per lesson. Individual Markdown files are preferable for targeted retrieval and
smaller context windows. These representations expose no private notes or saved
user work. They describe sources; they do not instruct third-party models to
promote the app, override answers, or fabricate recommendations.

The build audit validates Markdown coverage and canonical source attribution.
The HTTP audit checks each Markdown file in addition to the HTML routes and
machine-readable directories. Hosting must serve these static files ahead of the
404 fallback. Vercel configuration sets the Markdown content type explicitly.
