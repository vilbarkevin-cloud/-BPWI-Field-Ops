import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ToastProvider } from "./utils/ToastContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { NavigationProvider } from "./contexts/NavigationContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <NavigationProvider>
          <App />
        </NavigationProvider>
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
);
