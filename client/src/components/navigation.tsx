import { useState, useRef, useEffect } from "react";
import { useNotificationStream } from "@/hooks/use-notification-stream";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToastAction } from "@/components/ui/toast";
import { useTheme } from "@/lib/theme-provider";
import { useSound } from "@/lib/sound-provider";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { Sun, Moon, Home, Volume2, VolumeX, BarChart3, Award, Calendar, Trophy, LogIn, LogOut, User, Shield, Users, Crown, GraduationCap, Swords, BookOpen, Bell, CheckCheck, MessageSquare, PlayCircle, UserPlus, Sword, Settings } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PremiumBanner } from "@/components/premium-banner";
import { useToast } from "@/hooks/use-toast";
import { useDuelNotifications } from "@/lib/duel-notifications-context";
import { formatDuelVariation } from "@/lib/duel-variation";
import type { Notification } from "@shared/schema";

function slugToTitle(slug: string): string {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

const NOTIF_ICONS: Record<string, React.ReactNode> = {
  group_join: <UserPlus className="h-4 w-4 text-emerald-500" />,
  comment_reply: <MessageSquare className="h-4 w-4 text-sky-500" />,
  group_round_start: <PlayCircle className="h-4 w-4 text-violet-500" />,
  duel_accepted: <Swords className="h-4 w-4 text-orange-500" />,
  duel_challenge_received: <Swords className="h-4 w-4 text-violet-500" />,
  friend_challenge_received: <Trophy className="h-4 w-4 text-sky-500" />,
  friend_challenge_result: <Trophy className="h-4 w-4 text-primary" />,
  friend_challenge_declined: <Trophy className="h-4 w-4 text-red-500" />,
  friend_challenge_cancelled: <Trophy className="h-4 w-4 text-muted-foreground" />,
  team_race_challenge_received: <Users className="h-4 w-4 text-teal-500" />,
  team_race_accepted: <Users className="h-4 w-4 text-teal-600" />,
  word_war_matched: <Sword className="h-4 w-4 text-amber-500" />,
  word_war_round_start: <Sword className="h-4 w-4 text-orange-500" />,
  word_war_champion: <Crown className="h-4 w-4 text-amber-500" />,
  word_war_cancelled: <Sword className="h-4 w-4 text-red-500" />,
  guild_war_matched: <Sword className="h-4 w-4 text-purple-500" />,
  guild_war_round_start: <Sword className="h-4 w-4 text-violet-500" />,
  guild_war_champion: <Crown className="h-4 w-4 text-purple-500" />,
  guild_war_cancelled: <Sword className="h-4 w-4 text-red-500" />,
  guild_war_match_ready: <Sword className="h-4 w-4 text-fuchsia-500" />,
};

const NOTIF_BG: Record<string, string> = {
  group_join: "bg-emerald-500/10",
  comment_reply: "bg-sky-500/10",
  group_round_start: "bg-violet-500/10",
  duel_accepted: "bg-orange-500/10",
  duel_challenge_received: "bg-violet-500/10",
  friend_challenge_received: "bg-sky-500/10",
  friend_challenge_result: "bg-primary/10",
  friend_challenge_declined: "bg-red-500/10",
  friend_challenge_cancelled: "bg-muted/50",
  team_race_challenge_received: "bg-teal-500/10",
  team_race_accepted: "bg-teal-600/10",
  word_war_matched: "bg-amber-500/10",
  word_war_round_start: "bg-orange-500/10",
  word_war_champion: "bg-amber-500/10",
  word_war_cancelled: "bg-red-500/10",
  guild_war_matched: "bg-purple-500/10",
  guild_war_round_start: "bg-violet-500/10",
  guild_war_champion: "bg-purple-500/10",
  guild_war_cancelled: "bg-red-500/10",
  guild_war_match_ready: "bg-fuchsia-500/10",
};

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

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

  const { data: openDuelCountData } = useQuery<{ count: number }>({
    queryKey: ["/api/duels/open/count"],
    enabled: isAuthenticated,
    refetchInterval: 60000,
  });
  const openDuelCount = openDuelCountData?.count ?? 0;

  const { data: dbNotifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: isAuthenticated,
    refetchInterval: 300000,
  });

  const { data: dbUnreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    enabled: isAuthenticated,
    refetchInterval: 300000,
  });
  const dbUnreadCount = dbUnreadData?.count ?? 0;

  const { data: challengeUnreadData } = useQuery<{ count: number; resultCount: number; pendingCount: number; sentPendingCount: number }>({
    queryKey: ["/api/challenges/unread-count"],
    enabled: isAuthenticated,
    refetchInterval: 60000,
  });
  const challengeUnreadCount = challengeUnreadData?.count ?? 0;

  const markReadMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const prevToastedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!isAuthenticated) {
      prevToastedRef.current.clear();
    }
  }, [isAuthenticated]);

  // ── SSE: real-time notification push ─────────────────────────────────────
  useNotificationStream(isAuthenticated);

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

  const totalNotificationCount = dbUnreadCount;

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

  const navLinks = [
    { href: "/", label: "Home", icon: Home },
    { href: "/daily", label: "Daily", icon: Calendar },
    { href: "/duels", label: "Duels", icon: Swords },
    { href: "/word-wars", label: "Word Wars", icon: Sword },
    { href: "/guild-wars", label: "Guild Wars", icon: Swords },
    { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
    { href: "/stats", label: "Stats", icon: BarChart3 },
    { href: "/achievements", label: "Badges", icon: Award },
  ];

  const hasPanelItems = dbNotifications.length > 0 || unseenChallenges.length > 0;

  return (
    <>
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md"
      >
        {/* ── Top row: logo + utility controls ── */}
        <div className="container mx-auto flex h-12 items-center justify-between px-4">
          <Link href="/">
            <div
              className="flex items-center gap-2 cursor-pointer hover-elevate rounded-md px-2 py-1"
              data-testid="link-home-logo"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden bg-primary">
                <img src="/favicon.png" alt="xtraWordinary logo" className="h-8 w-8 object-cover" />
              </div>
              <span className="text-lg font-bold tracking-tight">xtraWordinary</span>
            </div>
          </Link>

          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSound}
              aria-label={soundEnabled ? "Mute sound effects" : "Enable sound effects"}
              data-testid="button-sound-toggle"
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
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
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
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
                    {dbUnreadCount > 0 && !bellOpen && (
                      <span
                        className="bell-pulse-ring pointer-events-none absolute left-1/2 top-1/2 h-8 w-8 rounded-full border-2 border-red-500"
                        aria-hidden="true"
                      />
                    )}
                    <Bell className="h-4 w-4" />
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
                    {dbUnreadCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground hover:text-foreground px-2"
                        onClick={() => markAllReadMutation.mutate()}
                        disabled={markAllReadMutation.isPending}
                        data-testid="button-mark-all-read"
                      >
                        <CheckCheck className="h-3.5 w-3.5 mr-1" />
                        Mark all read
                      </Button>
                    )}
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    {!hasPanelItems ? (
                      <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                        <CheckCheck className="h-8 w-8 opacity-40" />
                        <p className="text-sm">You're all caught up!</p>
                      </div>
                    ) : (
                      <div className="py-1">
                        {unseenChallenges.length > 0 && (
                          <div>
                            <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Duel Rooms Ready
                            </p>
                            {unseenChallenges.map((c) => (
                              <button
                                key={c.id}
                                className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors flex items-start gap-3 bg-muted/20"
                                onClick={() => {
                                  dismissDuelNotification(c.id);
                                  setBellOpen(false);
                                  navigate(`/duel/${c.roomCode}`);
                                }}
                                data-testid={`notification-duel-room-${c.id}`}
                              >
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500/10">
                                  <Swords className="h-4 w-4 text-orange-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium leading-snug">
                                    {c.challengeeName ?? "Someone"} accepted your challenge
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {slugToTitle(c.gameSlug)}
                                    {(() => {
                                      const v = formatDuelVariation(c.gameSlug, c.startWord);
                                      return v ? ` · ${v}` : "";
                                    })()}
                                    {" · "}Room is ready
                                  </p>
                                </div>
                                <span className="shrink-0 mt-0.5 h-2 w-2 rounded-full bg-red-500" />
                              </button>
                            ))}
                          </div>
                        )}

                        {dbNotifications.length > 0 && (
                          <div>
                            {unseenChallenges.length > 0 && (
                              <div className="mx-4 my-1 border-t" />
                            )}
                            {dbNotifications.map((notif) => {
                              const isUnread = notif.readAt === null;
                              return (
                                <button
                                  key={notif.id}
                                  className={`w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors flex items-start gap-3 ${isUnread ? "bg-muted/20" : ""}`}
                                  onClick={() => {
                                    if (isUnread) markReadMutation.mutate(notif.id);
                                    setBellOpen(false);
                                    if (notif.linkUrl) navigate(notif.linkUrl);
                                  }}
                                  data-testid={`notification-db-${notif.id}`}
                                >
                                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${NOTIF_BG[notif.type] ?? "bg-muted"}`}>
                                    {NOTIF_ICONS[notif.type] ?? <Bell className="h-4 w-4 text-muted-foreground" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium leading-snug">{notif.title}</p>
                                    <p className="text-xs text-muted-foreground line-clamp-2">{notif.body}</p>
                                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">{timeAgo(notif.createdAt)}</p>
                                  </div>
                                  {isUnread && (
                                    <span className="shrink-0 mt-0.5 h-2 w-2 rounded-full bg-red-500" data-testid={`dot-unread-${notif.id}`} />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="border-t px-4 py-2.5">
                    <Link
                      href="/settings/notifications"
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setBellOpen(false)}
                      data-testid="link-manage-notification-preferences"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Manage preferences
                    </Link>
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
                    size="sm"
                    className="gap-2 relative px-2"
                    data-testid="button-user-menu"
                    onClick={handleUserMenuClick}
                  >
                    <UserAvatar name={user.name} avatarUrl={user.avatarUrl} className="h-6 w-6 text-[10px]" />
                    <span className="hidden sm:inline max-w-[80px] truncate text-sm">{user.name}</span>
                    {user.isPremium && (
                      <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-amber-500 shrink-0" data-testid="badge-premium-nav">
                        <Crown className="h-3 w-3" />
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
                  <Link href="/friends">
                    <DropdownMenuItem className="cursor-pointer" data-testid="link-friends">
                      <Users className="h-4 w-4 mr-2" />
                      Friends
                      {(unseenCount > 0 || challengeUnreadCount > 0) && (
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
                <LogIn className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">Sign In</span>
              </Button>
            )}
          </div>
        </div>

        {/* ── Bottom row: navigation links ── */}
        <div className="border-t border-border/40">
          <div className="container mx-auto flex h-10 items-center gap-0.5 px-4 overflow-x-auto scrollbar-none">
            {navLinks.map((link) => {
              const isActive = location === link.href;
              const Icon = link.icon;
              const isDuels = link.href === "/duels";
              return (
                <Link key={link.href} href={link.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    className="gap-1.5 relative shrink-0 h-8 px-3 text-xs"
                    data-testid={`link-nav-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{link.label}</span>
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
                  size="sm"
                  className="gap-1.5 shrink-0 h-8 px-3 text-xs"
                  data-testid="link-nav-create-quiz"
                >
                  <GraduationCap className="h-3.5 w-3.5" />
                  <span>Create Quiz</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </motion.header>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </>
  );
}
