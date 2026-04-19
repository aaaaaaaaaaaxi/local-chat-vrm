import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/globals.css";
import TestPage from "./test";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TestPage />
  </StrictMode>
);
