import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/fonts.css";
import "./styles/global.css";
import { App } from "./app/App";
import { FONTS } from "./card/fit";

// Both faces start loading now, alongside the deck. A card is measured only once they are in, and nothing would ask
// for Radon (code and the counter) before the first card mounts: it would show blank for a frame.
for (const font of FONTS) document.fonts.load(font).catch(() => {});

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={new QueryClient()}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );
}
