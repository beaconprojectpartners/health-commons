import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";

const dsn =
  (window as any).__SENTRY_DSN__ ||
  (typeof __SENTRY_DSN__ !== "undefined" ? __SENTRY_DSN__ : "");
if (dsn) {
  Sentry.init({
    dsn,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 1.0,
  });
}

createRoot(document.getElementById("root")!).render(<App />);
