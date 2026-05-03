import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { SoundProvider } from "@/lib/sound-provider";
import { AuthProvider } from "@/lib/auth-context";
import { DuelNotificationsProvider } from "@/lib/duel-notifications-context";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
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
import Profile from "@/pages/profile";
import Friends from "@/pages/friends";
import Groups from "@/pages/groups";
import GroupsBrowse from "@/pages/groups-browse";
import GroupDetail from "@/pages/group-detail";
import GroupRoundPlay from "@/pages/group-round-play";
import QuizPlay from "@/pages/quiz-play";
import QuizResults from "@/pages/quiz-results";
import CreateQuiz from "@/pages/create-quiz";
import MyQuizzes from "@/pages/my-quizzes";
import DuelRoom from "@/pages/duel-room";
import DuelLobby from "@/pages/duel-lobby";
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
      <Route path="/profile/:id" component={Profile} />
      <Route path="/friends" component={Friends} />
      <Route path="/groups" component={Groups} />
      <Route path="/groups/browse" component={GroupsBrowse} />
      <Route path="/groups/:id" component={GroupDetail} />
      <Route path="/groups/:id/rounds/:roundId/play" component={GroupRoundPlay} />
      <Route path="/quiz/:code/results" component={QuizResults} />
      <Route path="/quiz/:code" component={QuizPlay} />
      <Route path="/create-quiz" component={CreateQuiz} />
      <Route path="/my-quizzes" component={MyQuizzes} />
      <Route path="/duels" component={DuelLobby} />
      <Route path="/duel/:roomCode" component={DuelRoom} />
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
            <DuelNotificationsProvider>
            <TooltipProvider>
            <div className="min-h-screen bg-background flex flex-col">
              <Navigation />
              <main className="flex-1">
                <Router />
              </main>
              <Footer />
            </div>
            <Toaster />
            </TooltipProvider>
            </DuelNotificationsProvider>
          </SoundProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
