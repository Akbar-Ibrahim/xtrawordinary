import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { SoundProvider } from "@/lib/sound-provider";
import { AuthProvider } from "@/lib/auth-context";
import { Navigation } from "@/components/navigation";
import Home from "@/pages/home";
import GameDetail from "@/pages/game-detail";
import Stats from "@/pages/stats";
import Achievements from "@/pages/achievements";
import DailyChallenge from "@/pages/daily-challenge";
import Leaderboard from "@/pages/leaderboard";
import VerifyEmail from "@/pages/verify-email";
import ResetPassword from "@/pages/reset-password";
import About from "@/pages/about";
import Admin from "@/pages/admin";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/game/:slug" component={GameDetail} />
      <Route path="/stats" component={Stats} />
      <Route path="/achievements" component={Achievements} />
      <Route path="/daily" component={DailyChallenge} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/about" component={About} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <SoundProvider>
            <TooltipProvider>
            <div className="min-h-screen bg-background">
              <Navigation />
              <main>
                <Router />
              </main>
            </div>
            <Toaster />
            </TooltipProvider>
          </SoundProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
