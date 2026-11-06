import { publicUrl } from '../src/seo/urls';

export async function onRequest(context: {
  request: Request;
  next: () => Promise<Response>;
}) {
  const request = context.request;
  if (request.method !== 'GET' && request.method !== 'HEAD') return context.next();
  const url = new URL(request.url);
  const input = url.pathname + url.search;
  const canonical = publicUrl(input);
  // Pages serves generated directory/index.html pages with a trailing slash.
  // Treat that slash as equivalent, while retaining query-based legacy redirects.
  const comparable = (url.pathname.replace(/\/+$/, '') || '/') + url.search;
  if (canonical !== comparable) {
    return new Response(null, { status: 308, headers: { Location: canonical } });
  }
  return context.next();
}
