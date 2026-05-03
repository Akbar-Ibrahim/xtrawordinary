import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToastAction } from "@/components/ui/toast";
import { useTheme } from "@/lib/theme-provider";
import { useSound } from "@/lib/sound-provider";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { Sun, Moon, Home, Volume2, VolumeX, BarChart3, Award, Calendar, Trophy, LogIn, LogOut, User, Shield, Users, Crown, GraduationCap, Swords, BookOpen, Bell, CheckCheck } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { PremiumBanner } from "@/components/premium-banner";
import { useToast } from "@/hooks/use-toast";
import { useDuelNotifications } from "@/lib/duel-notifications-context";

function slugToTitle(slug: string): string {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

type IncomingDuelChallenge = {
  id: number;
  status: string;
  gameSlug: string;
  challengerId: number;
  challengerName: string | null;
  challengerAvatarUrl: string | null;
  roomCode: string | null;
};

export function Navigation() {
  const [location, navigate] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { soundEnabled, toggleSound } = useSound();
  const { user, isAuthenticated, logout } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const suppressNextDropdownOpen = useRef(false);
  const { toast } = useToast();
  const { unseenChallenges, unseenCount, newlyAccepted, dismiss: dismissDuelNotification } = useDuelNotifications();

  const { data: unreadData } = useQuery<{ count: number; resultCount: number; pendingCount: number }>({
    queryKey: ["/api/challenges/unread-count"],
    enabled: isAuthenticated,
    refetchInterval: 60000,
  });
  const unreadCount = unreadData?.count ?? 0;

  const { data: openDuelCountData } = useQuery<{ count: number }>({
    queryKey: ["/api/duels/open/count"],
    enabled: isAuthenticated,
    refetchInterval: 60000,
  });
  const openDuelCount = openDuelCountData?.count ?? 0;

  const { data: incomingDuels = [] } = useQuery<IncomingDuelChallenge[]>({
    queryKey: ["/api/duels/challenges/incoming"],
    queryFn: async () => {
      const res = await fetch("/api/duels/challenges?type=incoming", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json() as IncomingDuelChallenge[];
      return data.filter((d) => d.status === "pending");
    },
    enabled: isAuthenticated,
    refetchInterval: 10000,
  });
  const incomingDuelCount = incomingDuels.length;

  const prevToastedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!isAuthenticated) {
      prevToastedRef.current.clear();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    for (const c of newlyAccepted) {
      if (!prevToastedRef.current.has(c.id)) {
        prevToastedRef.current.add(c.id);
        const gameName = slugToTitle(c.gameSlug);
        const opponentName = c.challengeeName ?? "Someone";
        const roomCode = c.roomCode;
        toast({
          title: `${opponentName} accepted your ${gameName} challenge!`,
          description: "Your duel room is ready.",
          action: (
            <ToastAction
              altText="Go to Room"
              onClick={() => {
                dismissDuelNotification(c.id);
                navigate(`/duel/${roomCode}`);
              }}
            >
              Go to Room
            </ToastAction>
          ),
        });
      }
    }
  }, [newlyAccepted]);

  const totalNotificationCount = unreadCount + incomingDuelCount + unseenCount;

  const firstUnseenRoom: string | null =
    unseenCount > 0
      ? (unseenChallenges.find((c) => c.roomCode != null)?.roomCode ?? null)
      : null;

  function handleUserMenuClick() {
    if (firstUnseenRoom) {
      suppressNextDropdownOpen.current = true;
      const match = unseenChallenges.find((c) => c.roomCode === firstUnseenRoom);
      if (match) dismissDuelNotification(match.id);
      navigate(`/duel/${firstUnseenRoom}`);
    }
  }

  function handleDropdownOpenChange(open: boolean) {
    if (suppressNextDropdownOpen.current && open) {
      suppressNextDropdownOpen.current = false;
      return;
    }
    setDropdownOpen(open);
  }

  const friendsHref =
    firstUnseenRoom
      ? `/duel/${firstUnseenRoom}`
      : unreadCount > 0
      ? "/friends?tab=challenges"
      : incomingDuelCount > 0
      ? "/friends?tab=duels"
      : "/friends";

  const navLinks = [
    { href: "/", label: "Home", icon: Home },
    { href: "/daily", label: "Daily", icon: Calendar },
    { href: "/duels", label: "Duels", icon: Swords },
    { href: "/leaderboard", label: "Ranks", icon: Trophy },
    { href: "/stats", label: "Stats", icon: BarChart3 },
    { href: "/achievements", label: "Badges", icon: Award },
  ];

  return (
    <>
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md"
      >
        <nav className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <Link href="/">
            <div
              className="flex items-center gap-2 cursor-pointer hover-elevate rounded-md px-2 py-1"
              data-testid="link-home-logo"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg overflow-hidden bg-primary">
                <img src="/favicon.png" alt="xtraWordinary logo" className="h-9 w-9 object-cover" />
              </div>
              <span className="text-xl font-bold tracking-tight">xtraWordinary</span>
            </div>
          </Link>

          <div className="flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = location === link.href;
              const Icon = link.icon;
              const isDuels = link.href === "/duels";
              return (
                <Link key={link.href} href={link.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className="gap-2 relative"
                    data-testid={`link-nav-${link.label.toLowerCase()}`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{link.label}</span>
                    {isDuels && openDuelCount > 0 && (
                      <span
                        className="ml-0.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none"
                        data-testid="badge-open-duels-count"
                      >
                        {openDuelCount > 99 ? "99+" : openDuelCount}
                      </span>
                    )}
                  </Button>
                </Link>
              );
            })}
            {isAuthenticated && (
              <Link href="/create-quiz">
                <Button
                  variant={location === "/create-quiz" ? "secondary" : "ghost"}
                  className="gap-2"
                  data-testid="link-nav-create-quiz"
                >
                  <GraduationCap className="h-4 w-4" />
                  <span className="hidden sm:inline">Create Quiz</span>
                </Button>
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSound}
              aria-label={soundEnabled ? "Mute sound effects" : "Enable sound effects"}
              data-testid="button-sound-toggle"
            >
              {soundEnabled ? (
                <Volume2 className="h-5 w-5" />
              ) : (
                <VolumeX className="h-5 w-5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
              data-testid="button-theme-toggle"
            >
              {theme === "light" ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
            </Button>

            {isAuthenticated && (
              <Popover open={bellOpen} onOpenChange={setBellOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative"
                    aria-label={`Notifications${totalNotificationCount > 0 ? ` (${totalNotificationCount})` : ""}`}
                    data-testid="button-notifications-bell"
                  >
                    <Bell className="h-5 w-5" />
                    {totalNotificationCount > 0 && (
                      <span
                        className="absolute top-1 right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none"
                        data-testid="badge-notification-count"
                      >
                        {totalNotificationCount > 99 ? "99+" : totalNotificationCount}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0" data-testid="panel-notifications">
                  <div className="flex items-center justify-between px-4 py-3 border-b">
                    <span className="font-semibold text-sm">Notifications</span>
                    {totalNotificationCount > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {totalNotificationCount} new
                      </span>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {totalNotificationCount === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                        <CheckCheck className="h-8 w-8 opacity-40" />
                        <p className="text-sm">You're all caught up!</p>
                      </div>
                    ) : (
                      <div className="py-1">
                        {incomingDuels.length > 0 && (
                          <div>
                            <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Duel Challenges
                            </p>
                            {incomingDuels.map((challenge) => (
                              <button
                                key={challenge.id}
                                className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors flex items-start gap-3"
                                onClick={() => {
                                  setBellOpen(false);
                                  navigate("/friends?tab=duels");
                                }}
                                data-testid={`notification-duel-challenge-${challenge.id}`}
                              >
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/10">
                                  <Swords className="h-4 w-4 text-violet-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium leading-snug">
                                    {challenge.challengerName ?? "Someone"} challenged you
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {slugToTitle(challenge.gameSlug)} · Tap to view
                                  </p>
                                </div>
                                <span className="shrink-0 mt-0.5 h-2 w-2 rounded-full bg-red-500" />
                              </button>
                            ))}
                          </div>
                        )}

                        {unseenChallenges.length > 0 && (
                          <div>
                            <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Duel Rooms Ready
                            </p>
                            {unseenChallenges.map((c) => (
                              <button
                                key={c.id}
                                className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors flex items-start gap-3"
                                onClick={() => {
                                  dismissDuelNotification(c.id);
                                  setBellOpen(false);
                                  navigate(`/duel/${c.roomCode}`);
                                }}
                                data-testid={`notification-duel-room-${c.id}`}
                              >
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
                                  <Swords className="h-4 w-4 text-accent" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium leading-snug">
                                    {c.challengeeName ?? "Someone"} accepted your challenge
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {slugToTitle(c.gameSlug)} · Room is ready
                                  </p>
                                </div>
                                <span className="shrink-0 mt-0.5 h-2 w-2 rounded-full bg-red-500" />
                              </button>
                            ))}
                          </div>
                        )}

                        {unreadCount > 0 && (
                          <div>
                            <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Friend Challenges
                            </p>
                            <button
                              className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors flex items-start gap-3"
                              onClick={() => {
                                setBellOpen(false);
                                navigate("/friends?tab=challenges");
                              }}
                              data-testid="notification-friend-challenges"
                            >
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                                <Trophy className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium leading-snug">
                                  {unreadCount} unread challenge {unreadCount === 1 ? "result" : "results"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Tap to see how you did
                                </p>
                              </div>
                              <span className="shrink-0 mt-0.5 h-2 w-2 rounded-full bg-red-500" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            <PremiumBanner variant="nav" />

            {isAuthenticated && user ? (
              <DropdownMenu open={dropdownOpen} onOpenChange={handleDropdownOpenChange}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="gap-2 relative"
                    data-testid="button-user-menu"
                    onClick={handleUserMenuClick}
                  >
                    <UserAvatar name={user.name} avatarUrl={user.avatarUrl} className="h-6 w-6 text-[10px]" />
                    <span className="hidden sm:inline max-w-[100px] truncate">{user.name}</span>
                    {user.isPremium && (
                      <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-amber-500 shrink-0" data-testid="badge-premium-nav">
                        <Crown className="h-3 w-3" />
                        Premium
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-sm text-muted-foreground" disabled>
                    {user.email}
                  </DropdownMenuItem>
                  <Link href={`/profile/${user.id}`}>
                    <DropdownMenuItem className="cursor-pointer" data-testid="link-profile">
                      <User className="h-4 w-4 mr-2" />
                      My Profile
                    </DropdownMenuItem>
                  </Link>
                  <Link href={friendsHref}>
                    <DropdownMenuItem className="cursor-pointer" data-testid="link-friends">
                      <Users className="h-4 w-4 mr-2" />
                      Friends
                      {(unreadCount > 0 || incomingDuelCount > 0 || unseenCount > 0) && (
                        <span className="ml-auto h-2 w-2 rounded-full bg-red-500" data-testid="dot-friends-menu-notification" />
                      )}
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/my-quizzes">
                    <DropdownMenuItem className="cursor-pointer" data-testid="link-my-quizzes">
                      <BookOpen className="h-4 w-4 mr-2" />
                      My Quizzes
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/groups">
                    <DropdownMenuItem className="cursor-pointer" data-testid="link-groups">
                      <Users className="h-4 w-4 mr-2" />
                      Groups
                    </DropdownMenuItem>
                  </Link>
                  {user.isAdmin && (
                    <Link href="/admin">
                      <DropdownMenuItem className="cursor-pointer" data-testid="link-admin">
                        <Shield className="h-4 w-4 mr-2" />
                        Admin Dashboard
                      </DropdownMenuItem>
                    </Link>
                  )}
                  <DropdownMenuItem className="cursor-pointer" onClick={logout} data-testid="button-signout">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setAuthOpen(true)} data-testid="button-signin">
                <LogIn className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Sign In</span>
              </Button>
            )}
          </div>
        </nav>
      </motion.header>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </>
  );
}
