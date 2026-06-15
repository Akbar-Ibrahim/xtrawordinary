import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Bell, Users, Swords, Trophy, ChevronLeft } from "lucide-react";
import type { NotificationType } from "@shared/schema";
import { NOTIFICATION_TYPE_LABELS } from "@shared/schema";

const NOTIFICATION_CATEGORIES: { label: string; icon: typeof Bell; types: NotificationType[] }[] = [
  {
    label: "Social",
    icon: Users,
    types: ["group_join", "comment_reply", "group_round_start", "friend_challenge_result"],
  },
  {
    label: "Duels & Huddles",
    icon: Swords,
    types: ["duel_accepted", "duel_challenge_received", "huddle_challenge_received", "huddle_accepted"],
  },
  {
    label: "Group Battles",
    icon: Users,
    types: ["team_race_challenge_received", "team_race_accepted"],
  },
  {
    label: "Word Wars",
    icon: Trophy,
    types: ["word_war_matched", "word_war_round_start", "word_war_champion", "word_war_cancelled"],
  },
  {
    label: "Guild Wars",
    icon: Trophy,
    types: ["guild_war_matched", "guild_war_round_start", "guild_war_champion", "guild_war_cancelled", "guild_war_match_ready"],
  },
];

const ALL_TYPES: NotificationType[] = NOTIFICATION_CATEGORIES.flatMap((c) => c.types);

export default function NotificationSettings() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const { data: notifPrefs, isLoading } = useQuery<Record<NotificationType, boolean>>({
    queryKey: ["/api/notification-preferences"],
    queryFn: async () => {
      const res = await fetch("/api/notification-preferences", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch preferences");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const updateNotifPref = useMutation({
    mutationFn: ({ type, enabled }: { type: NotificationType; enabled: boolean }) =>
      apiRequest("PATCH", `/api/notification-preferences/${type}`, { enabled }),
    onMutate: async ({ type, enabled }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/notification-preferences"] });
      const previous = queryClient.getQueryData<Record<NotificationType, boolean>>(["/api/notification-preferences"]);
      queryClient.setQueryData<Record<NotificationType, boolean>>(["/api/notification-preferences"], (old) =>
        old ? { ...old, [type]: enabled } : old
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(["/api/notification-preferences"], ctx.previous);
      }
      toast({ title: "Failed to update preference", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-preferences"] });
    },
  });

  const updateAllNotifPrefs = useMutation({
    mutationFn: (enabled: boolean) =>
      apiRequest("PATCH", "/api/notification-preferences", { enabled }),
    onMutate: async (enabled) => {
      await queryClient.cancelQueries({ queryKey: ["/api/notification-preferences"] });
      const previous = queryClient.getQueryData<Record<NotificationType, boolean>>(["/api/notification-preferences"]);
      queryClient.setQueryData<Record<NotificationType, boolean>>(["/api/notification-preferences"], (old) => {
        if (!old) return old;
        const updated = { ...old };
        for (const type of ALL_TYPES) updated[type] = enabled;
        return updated;
      });
      return { previous };
    },
    onError: (_err, _enabled, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(["/api/notification-preferences"], ctx.previous);
      }
      toast({ title: "Failed to update preferences", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-preferences"] });
    },
  });

  const allEnabled = notifPrefs ? ALL_TYPES.every((t) => notifPrefs[t]) : true;
  const someEnabled = notifPrefs ? ALL_TYPES.some((t) => notifPrefs[t]) : true;

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" />
        <p className="text-muted-foreground">Sign in to manage your notification preferences.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        {user && (
          <Link href={`/profile/${user.id}`}>
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" data-testid="link-back-to-profile">
              <ChevronLeft className="h-4 w-4" />
              Profile
            </Button>
          </Link>
        )}
      </div>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-notification-settings">
          <Bell className="h-6 w-6" />
          Notification Preferences
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose which in-app notifications you receive. All types are enabled by default.
        </p>
      </div>

      <Card data-testid="card-master-toggle">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">All notifications</p>
              <p className="text-sm text-muted-foreground">
                {allEnabled ? "All notifications are on" : someEnabled ? "Some notifications are off" : "All notifications are off"}
              </p>
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-11 rounded-full" />
            ) : (
              <Switch
                checked={allEnabled}
                onCheckedChange={(checked) => updateAllNotifPrefs.mutate(checked)}
                disabled={updateAllNotifPrefs.isPending}
                data-testid="switch-all-notifications"
                aria-label="Toggle all notifications"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {NOTIFICATION_CATEGORIES.map(({ label, icon: Icon, types }) => {
        const allCatEnabled = notifPrefs ? types.every((t) => notifPrefs[t]) : true;
        const someCatEnabled = notifPrefs ? types.some((t) => notifPrefs[t]) : true;
        return (
          <Card key={label} data-testid={`card-category-${label.toLowerCase().replace(/\s+/g, "-")}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {label}
                </CardTitle>
                {!isLoading && (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => {
                      for (const type of types) {
                        updateNotifPref.mutate({ type, enabled: !allCatEnabled });
                      }
                    }}
                    data-testid={`button-category-toggle-${label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {allCatEnabled ? "Mute all" : someCatEnabled ? "Enable all" : "Enable all"}
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                <>
                  {types.map((t) => (
                    <div key={t} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-6 w-11 rounded-full" />
                    </div>
                  ))}
                </>
              ) : (
                types.map((type) => {
                  const enabled = notifPrefs ? notifPrefs[type] : true;
                  return (
                    <div
                      key={type}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      data-testid={`row-notif-pref-${type}`}
                    >
                      <span className="text-sm font-medium">{NOTIFICATION_TYPE_LABELS[type]}</span>
                      <Switch
                        checked={enabled}
                        onCheckedChange={(checked) => updateNotifPref.mutate({ type, enabled: checked })}
                        data-testid={`switch-notif-pref-${type}`}
                        aria-label={`Toggle ${NOTIFICATION_TYPE_LABELS[type]}`}
                      />
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
