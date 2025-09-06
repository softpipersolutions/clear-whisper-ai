import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AuthGate from "./components/auth/AuthGate";
import Index from "./pages/Index";
import Chat from "./pages/Chat";
import SignIn from "./pages/SignIn";
import Account from "./pages/Account";
import Recharge from "./pages/Recharge";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/chat" element={
              <AuthGate>
                <Chat />
              </AuthGate>
            } />
            <Route path="/account" element={
              <AuthGate>
                <Account />
              </AuthGate>
            } />
            <Route path="/recharge" element={
              <AuthGate>
                <Recharge />
              </AuthGate>
            } />
            <Route path="/admin" element={
              <AuthGate>
                <Admin />
              </AuthGate>
            } />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
