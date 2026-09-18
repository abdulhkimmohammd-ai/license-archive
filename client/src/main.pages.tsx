import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import ErrorBoundary from "./components/ErrorBoundary";
import SupabaseDevelopmentOfflineManager from "./components/SupabaseDevelopmentOfflineManager";
import PwaStatusBar from "./components/PwaStatusBar";
import { ThemeProvider } from "./contexts/ThemeContext";
import IndependentApp from "./IndependentApp";
import "./index.css";
import { registerPwaServiceWorker } from "./lib/pwa";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

void registerPwaServiceWorker();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <ThemeProvider defaultTheme="light">
      <QueryClientProvider client={queryClient}>
        <PwaStatusBar />
        <SupabaseDevelopmentOfflineManager />
        <IndependentApp />
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>,
);
