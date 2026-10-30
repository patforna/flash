import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/fonts.css";

// Scaffold only: integration (M2) mounts the app here.
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(null);
}
