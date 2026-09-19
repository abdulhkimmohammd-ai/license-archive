import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";

import ErrorBoundary from "./client/src/components/ErrorBoundary";
import SupabaseDevelopmentOfflineManager from "./client/src/components/SupabaseDevelopmentOfflineManager";
import PwaStatusBar from "./client/src/components/PwaStatusBar";
import { ThemeProvider } from "./client/src/contexts/ThemeContext";
import App from "./client/src/App";
import "./client/src/index.css";
import { registerPwaServiceWorker } from "./client/src/lib/pwa";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

void registerPwaServiceWorker();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <ThemeProvider defaultTheme="light">
      <QueryClientProvider client={queryClient}>
        <PwaStatusBar />
        <SupabaseDevelopmentOfflineManager />
        <App />
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>,
);
