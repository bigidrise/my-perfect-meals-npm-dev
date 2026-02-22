import "@/lib/fetch-credentials-patch";
import App from "./App";
import "./index.css";
import { GlobalErrorBoundary, setupGlobalErrorHandling } from './components/GlobalErrorBoundary';
import { useEffect } from "react";

// Register service worker for PWA functionality and offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('[SW] Service Worker registered:', registration.scope);
      })
      .catch(error => {
        console.error('[SW] Registration failed:', error);
      });
  });
}

export function AppEntry() {
  useEffect(() => {
    setupGlobalErrorHandling();
  }, []);

  return (
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  );
}
