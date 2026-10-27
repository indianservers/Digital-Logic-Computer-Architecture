import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
const SeoRouter=lazy(()=>import("./seo/SeoRouter"));
import { registerSW } from "virtual:pwa-register";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "./design-system/material";
import { App } from "./App";
import { ErrorBoundary } from "./layout/ErrorBoundary";
import { PrefsProvider } from "./store/prefs";
import "./styles/global.css";

registerSW({ immediate: true });

const root = document.getElementById("root");
if (!root) throw new Error("Root element missing");

createRoot(root).render(
  <StrictMode>
    <PrefsProvider>
      <Suspense fallback={<div className="card">Loading LogicLab…</div>}><SeoRouter>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </SeoRouter></Suspense>
    </PrefsProvider>
  </StrictMode>,
);
