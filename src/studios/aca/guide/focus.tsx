import { createContext, useContext, useState, type ReactNode } from "react";

const GuideFocusContext = createContext<{ id: string; setId: (id: string) => void }>({
  id: "",
  setId: () => undefined,
});

export function GuideFocusProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState("");
  return <GuideFocusContext.Provider value={{ id, setId }}>{children}</GuideFocusContext.Provider>;
}

export function useGuideFocus() {
  return useContext(GuideFocusContext);
}
