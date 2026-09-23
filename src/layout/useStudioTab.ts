import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export function resolveTab(raw: string | null, ids: readonly string[], fallback: string): string {
  return raw && ids.includes(raw) ? raw : fallback;
}

export function useStudioTab(tabs: Array<{ id: string }>, fallback: string): [string, (id: string) => void] {
  const [params, setParams] = useSearchParams();
  const ids = tabs.map((item) => item.id);
  const raw = params.get("tab");
  const tab = resolveTab(raw, ids, fallback);

  useEffect(() => {
    if (raw !== null && raw !== tab) {
      const next = new URLSearchParams(params);
      next.set("tab", tab);
      setParams(next, { replace: true });
    }
  }, [params, raw, setParams, tab]);

  function setTab(id: string) {
    const next = new URLSearchParams(params);
    next.set("tab", id);
    setParams(next);
  }

  return [tab, setTab];
}
