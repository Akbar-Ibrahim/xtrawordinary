import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TabsContent } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/user-avatar";
import { Activity as ActivityIcon } from "lucide-react";
import type { GroupActivityEntry } from "@shared/schema";
import { activityLabel, timeAgo } from "./utils";

export function ActivityTab({ activity, activityLoading }: { activity: GroupActivityEntry[] | undefined; activityLoading: boolean }) {
  return (
    <TabsContent value="activity">
      {activityLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
      ) : !activity || activity.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <ActivityIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No activity yet. Join a round to get started!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {activity.map(entry => (
            <div key={entry.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/30 border border-border/40" data-testid={`activity-${entry.id}`}>
              {entry.user?.id ? (
                <Link href={`/profile/${entry.user.id}`}>
                  <UserAvatar name={entry.user?.name ?? "?"} avatarUrl={entry.user?.avatarUrl} className="h-8 w-8 cursor-pointer" />
                </Link>
              ) : (
                <UserAvatar name={entry.user?.name ?? "?"} avatarUrl={entry.user?.avatarUrl} className="h-8 w-8" />
              )}
              <p className="text-sm flex-1">{activityLabel(entry.type, entry.metadata)}</p>
              <span className="text-xs text-muted-foreground shrink-0">{timeAgo(entry.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </TabsContent>
  );
}
