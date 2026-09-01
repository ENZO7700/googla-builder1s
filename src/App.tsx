import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, FutureConfig } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index.tsx";

const futureConfig: FutureConfig = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const GitHubDashboard = lazy(() => import("./pages/GitHubDashboard.tsx"));
const LaunchDashboard = lazy(() => import("./pages/LaunchDashboard.tsx"));
const WordPressDashboard = lazy(() => import("./pages/WordPressDashboard.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter future={futureConfig}>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard/github" element={<GitHubDashboard />} />
              <Route path="/dashboard/launch" element={<LaunchDashboard />} />
              <Route path="/dashboard/wordpress" element={<WordPressDashboard />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
