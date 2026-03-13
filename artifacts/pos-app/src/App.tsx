import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import LoginPage from "@/pages/LoginPage";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

// Pages
import Dashboard from "@/pages/Dashboard";
import Cashier from "@/pages/Cashier";
import Products from "@/pages/Products";
import Orders from "@/pages/Orders";
import ProductionBoard from "@/pages/ProductionBoard";
import ProductionSchedule from "@/pages/ProductionSchedule";
import Reports from "@/pages/Reports";
import StoreSettings from "@/pages/StoreSettings";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/cashier" component={Cashier} />
      <Route path="/products" component={Products} />
      <Route path="/orders" component={Orders} />
      <Route path="/production" component={ProductionBoard} />
      <Route path="/schedule" component={ProductionSchedule} />
      <Route path="/reports" component={Reports} />
      <Route path="/settings" component={StoreSettings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <AppLayout>
        <Router />
      </AppLayout>
    </WouterRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppContent />
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
