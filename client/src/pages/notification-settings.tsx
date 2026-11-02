import { useQuery, useMutation } from "@tanstack/react-query";
import { useRef } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { AuthLoadingState } from "@/components/auth-loading-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Bell, Users, Swords, Trophy, ChevronLeft } from "lucide-react";
import type { NotificationPreferenceType, NotificationType } from "@shared/schema";
import { NOTIFICATION_TYPE_LABELS } from "@shared/schema";

const FRIEND_CHALLENGE_TYPES: NotificationType[] = [
  "friend_challenge_received",
  "friend_challenge_result",
  "friend_challenge_declined",
  "friend_challenge_cancelled",
];

const NOTIFICATION_CATEGORIES: { label: string; icon: typeof Bell; types: NotificationType[]; subcategories?: { label: string; types: NotificationType[] }[] }[] = [
  {
    label: "Social",
    icon: Users,
    types: ["group_join", "comment_reply", "comment_mention", "group_round_start", "friend_request_received", "achievement_unlocked", "comment_liked", "streak_at_risk", "leaderboard_overtaken"],
    subcategories: [
      {
        label: "Friend Challenges",
        types: FRIEND_CHALLENGE_TYPES,
      },
    ],
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

const ALL_TYPES: NotificationType[] = NOTIFICATION_CATEGORIES.flatMap((c) => [
  ...c.types,
  ...(c.subcategories?.flatMap((s) => s.types) ?? []),
]);

export default function NotificationSettings() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const preferenceRequestVersions = useRef(new Map<NotificationPreferenceType, number>());
  const bulkPreferenceSave = useRef<Promise<unknown> | null>(null);
  const preferencesChangedDuringBulkSave = useRef(new Set<NotificationPreferenceType>());

  const { data: notifPrefs, isLoading } = useQuery<Record<NotificationPreferenceType, boolean>>({
    queryKey: ["/api/notification-preferences"],
    queryFn: async () => {
      const res = await fetch("/api/notification-preferences", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch preferences");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const updateNotifPref = useMutation({
    mutationFn: async ({ type, enabled }: { type: NotificationPreferenceType; enabled: boolean }) => {
      const pendingBulkSave = bulkPreferenceSave.current;
      if (pendingBulkSave) await pendingBulkSave;
      return apiRequest("PATCH", `/api/notification-preferences/${type}`, { enabled });
    },
    onMutate: async ({ type, enabled }) => {
      const requestVersion = (preferenceRequestVersions.current.get(type) ?? 0) + 1;
      preferenceRequestVersions.current.set(type, requestVersion);
      const queuedBehindBulkSave = Boolean(bulkPreferenceSave.current);
      if (queuedBehindBulkSave) preferencesChangedDuringBulkSave.current.add(type);
      await queryClient.cancelQueries({ queryKey: ["/api/notification-preferences"] });
      const previous = queryClient.getQueryData<Record<NotificationPreferenceType, boolean>>(["/api/notification-preferences"]);
      queryClient.setQueryData<Record<NotificationPreferenceType, boolean>>(["/api/notification-preferences"], (old) =>
        old ? { ...old, [type]: enabled } : old
      );
      return { previousValue: previous?.[type], requestVersion, queuedBehindBulkSave };
    },
    onError: (_err, vars, ctx) => {
      const isLatestRequest = ctx?.requestVersion === preferenceRequestVersions.current.get(vars.type);
      if (isLatestRequest) {
        if (typeof ctx?.previousValue === "boolean") {
          queryClient.setQueryData<Record<NotificationPreferenceType, boolean>>(
            ["/api/notification-preferences"],
            (current) => current ? { ...current, [vars.type]: ctx.previousValue! } : current,
          );
        }
        toast({ title: "Failed to update preference", variant: "destructive" });
      }
    },
    onSettled: (_data, _error, vars, ctx) => {
      if (ctx && ctx.requestVersion === preferenceRequestVersions.current.get(vars.type)) {
        if (ctx.queuedBehindBulkSave) {
          preferencesChangedDuringBulkSave.current.delete(vars.type);
        }
        if (preferencesChangedDuringBulkSave.current.size === 0) {
          queryClient.invalidateQueries({ queryKey: ["/api/notification-preferences"] });
        }
      }
    },
  });

  const updateAllNotifPrefs = useMutation({
    mutationFn: (enabled: boolean) =>
      apiRequest("PATCH", "/api/notification-preferences", { enabled }),
    onMutate: async (enabled) => {
      await queryClient.cancelQueries({ queryKey: ["/api/notification-preferences"] });
      const previous = queryClient.getQueryData<Record<NotificationPreferenceType, boolean>>(["/api/notification-preferences"]);
      const previousRequestVersions = new Map(preferenceRequestVersions.current);
      queryClient.setQueryData<Record<NotificationPreferenceType, boolean>>(["/api/notification-preferences"], (old) => {
        if (!old) return old;
        const updated = { ...old };
        for (const type of ALL_TYPES) updated[type] = enabled;
        return updated;
      });
      return { previous, previousRequestVersions };
    },
    onError: (_err, _enabled, ctx) => {
      const previous = ctx?.previous;
      if (previous) {
        const previousRequestVersions = ctx.previousRequestVersions;
        queryClient.setQueryData<Record<NotificationPreferenceType, boolean>>(
          ["/api/notification-preferences"],
          (current) => {
            const restored: Record<NotificationPreferenceType, boolean> = { ...previous };
            for (const type of ALL_TYPES) {
              if (
                preferenceRequestVersions.current.get(type) !== previousRequestVersions.get(type) &&
                typeof current?.[type] === "boolean"
              ) {
                restored[type] = current[type];
              }
            }
            return restored;
          },
        );
      }
      toast({ title: "Failed to update preferences", variant: "destructive" });
    },
    onSettled: () => {
      if (preferencesChangedDuringBulkSave.current.size === 0) {
        queryClient.invalidateQueries({ queryKey: ["/api/notification-preferences"] });
      }
    },
  });

  const allEnabled = notifPrefs ? ALL_TYPES.every((t) => notifPrefs[t]) : true;
  const someEnabled = notifPrefs ? ALL_TYPES.some((t) => notifPrefs[t]) : true;

  if (authLoading) {
    return <AuthLoadingState />;
  }

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
                onCheckedChange={(checked) => {
                  const save = updateAllNotifPrefs.mutateAsync(checked);
                  bulkPreferenceSave.current = save;
                  const clearBulkSave = () => {
                    if (bulkPreferenceSave.current === save) bulkPreferenceSave.current = null;
                  };
                  void save.then(clearBulkSave, clearBulkSave);
                }}
                disabled={updateAllNotifPrefs.isPending}
                data-testid="switch-all-notifications"
                aria-label="Toggle all notifications"
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-achievement-sharing">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Achievement sharing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="pr-4">
              <p className="text-sm font-medium">Share your achievement updates with friends</p>
              <p className="text-sm text-muted-foreground">Friends will be notified when you unlock a new achievement.</p>
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-11 rounded-full" />
            ) : (
              <Switch
                checked={notifPrefs?.share_achievement_unlocked ?? true}
                onCheckedChange={(enabled) => updateNotifPref.mutate({ type: "share_achievement_unlocked", enabled })}
                disabled={updateNotifPref.isPending}
                data-testid="switch-share-achievement-updates"
                aria-label="Share your achievement updates with friends"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {NOTIFICATION_CATEGORIES.map(({ label, icon: Icon, types, subcategories }) => {
        const allDirectTypes = types;
        const allCatTypes = [...types, ...(subcategories?.flatMap((s) => s.types) ?? [])];
        const allCatEnabled = notifPrefs ? allCatTypes.every((t) => notifPrefs[t]) : true;
        const someCatEnabled = notifPrefs ? allCatTypes.some((t) => notifPrefs[t]) : true;
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
                      for (const type of allCatTypes) {
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
                  {allCatTypes.map((t) => (
                    <div key={t} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-6 w-11 rounded-full" />
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {allDirectTypes.map((type) => {
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
                  })}
                  {subcategories?.map((sub) => {
                    const allSubEnabled = notifPrefs ? sub.types.every((t) => notifPrefs[t]) : true;
                    const someSubEnabled = notifPrefs ? sub.types.some((t) => notifPrefs[t]) : true;
                    return (
                      <div key={sub.label} className="mt-3" data-testid={`subcategory-${sub.label.toLowerCase().replace(/\s+/g, "-")}`}>
                        <div className="flex items-center justify-between px-1 pb-1 mb-1 border-b border-border/50">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {sub.label}
                          </span>
                          <button
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => {
                              for (const type of sub.types) {
                                updateNotifPref.mutate({ type, enabled: !allSubEnabled });
                              }
                            }}
                            data-testid={`button-subcategory-toggle-${sub.label.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            {allSubEnabled ? "Mute all" : someSubEnabled ? "Enable all" : "Enable all"}
                          </button>
                        </div>
                        <div className="space-y-2">
                          {sub.types.map((type) => {
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
                          })}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
