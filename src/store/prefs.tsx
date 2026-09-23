import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface Prefs {
  bitWidth: 4 | 8 | 16 | 32;
  simSpeed: number;
  explain: boolean;
  bookmarks: string[];
  notes: string;
  badges: string[];
  challenges: string[];
  lastPath: string;
}

const KEY = "logiclab.prefs.v1";

const DEFAULTS: Prefs = {
  bitWidth: 8,
  simSpeed: 1,
  explain: true,
  bookmarks: [],
  notes: "",
  badges: [],
  challenges: [],
  lastPath: "/",
};

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    return DEFAULTS;
  }
}

interface PrefsApi {
  prefs: Prefs;
  update: (patch: Partial<Prefs>) => void;
  earn: (id: string) => void;
  toggleBookmark: (id: string) => void;
}

const Ctx = createContext<PrefsApi | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(() => load());
  useEffect(() => localStorage.setItem(KEY, JSON.stringify(prefs)), [prefs]);
  const update = useCallback((patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      return next.bitWidth === prev.bitWidth
        && next.simSpeed === prev.simSpeed
        && next.explain === prev.explain
        && next.notes === prev.notes
        && next.lastPath === prev.lastPath
        && next.bookmarks === prev.bookmarks
        && next.badges === prev.badges
        && next.challenges === prev.challenges
        ? prev
        : next;
    });
  }, []);
  const earn = useCallback((id: string) => {
    setPrefs((prev) => (prev.badges.includes(id) && prev.challenges.includes(id) ? prev : {
      ...prev,
      badges: prev.badges.includes(id) ? prev.badges : [...prev.badges, id],
      challenges: prev.challenges.includes(id) ? prev.challenges : [...prev.challenges, id],
    }));
  }, []);
  const toggleBookmark = useCallback((id: string) => {
    setPrefs((prev) => ({
      ...prev,
      bookmarks: prev.bookmarks.includes(id) ? prev.bookmarks.filter((item) => item !== id) : [...prev.bookmarks, id],
    }));
  }, []);
  const api = useMemo<PrefsApi>(() => ({ prefs, update, earn, toggleBookmark }), [prefs, update, earn, toggleBookmark]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function usePrefs(): PrefsApi {
  const value = useContext(Ctx);
  if (!value) throw new Error("PrefsProvider is missing");
  return value;
}
