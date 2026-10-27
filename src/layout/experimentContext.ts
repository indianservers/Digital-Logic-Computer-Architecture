import tabMetadata from "../theory/tabMetadata.json";

const defaults = new Map(tabMetadata.map((studio) => [studio.path, studio.tabs[0]?.id]));
// These studios intentionally start on a tab other than their first navigation item.
defaults.set("/studios/multicore", "mesi");
defaults.set("/studios/io", "mapped");

/** A bare studio URL and its default tab must share the same experiment record. */
export function experimentSearch(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  const fallback = defaults.get(pathname);
  if (!params.has("tab") && !params.has("device") && fallback) params.set("tab", fallback);
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}
