import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/fonts.css";
import "./styles/global.css";
import type { Deck } from "../shared/types";
import { browserEnv, keepFresh } from "./api/fresh";
import { App } from "./app/App";
import { FONTS } from "./card/fit";

// The fonts start loading now, alongside the deck. A card is measured only once they are in, and nothing else asks
// for them before the first card mounts: it would show blank for a frame.
for (const font of FONTS) document.fonts.load(font).catch(() => {});

const queryClient = new QueryClient();

// The service worker registers once the page has loaded, so its precaching never competes with the first load.
addEventListener("load", () => keepFresh(browserEnv(() => queryClient.getQueryData<Deck>(["deck"])?.version)), {
  once: true,
});

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );
}
