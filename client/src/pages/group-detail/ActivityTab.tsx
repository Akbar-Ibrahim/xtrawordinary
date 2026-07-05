import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TabsContent } from "@/components/ui/tabs";
import { Activity as ActivityIcon } from "lucide-react";
import type { GroupActivityEntry } from "@shared/schema";
import { activityLabel, timeAgo } from "./utils";

export function ActivityTab({ activity, activityLoading }: { activity: GroupActivityEntry[] | undefined; activityLoading: boolean }) {
  return (
    <TabsContent value="activity">
      {activityLoading ? (
        <div className="space-y-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
      ) : !activity || activity.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <ActivityIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No activity yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5" data-testid="list-activity">
          {activity.map(entry => (
            <div key={entry.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/30" data-testid={`activity-${entry.id}`}>
              <ActivityIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-sm flex-1">{activityLabel(entry.type, entry.metadata)}</p>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(entry.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </TabsContent>
  );
}
