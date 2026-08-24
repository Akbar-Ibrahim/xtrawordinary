import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserPlus, Globe, Lock, ChevronRight } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import type { FriendEntry, GroupSummary } from "./types";

interface Props {
  myFriends: FriendEntry[];
  myGroups: GroupSummary[];
  friendsLoading: boolean;
}

export function SocialTab({ myFriends, myGroups, friendsLoading }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm flex items-center gap-1.5">
            <Users className="h-4 w-4 text-primary" /> Friends
            {myFriends.length > 0 && <Badge variant="secondary" className="text-xs">{myFriends.length}</Badge>}
          </h3>
          <Link href="/friends">
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground text-xs h-7 px-2" data-testid="link-all-friends">
              View all <ChevronRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
        {friendsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
          </div>
        ) : myFriends.length === 0 ? (
          <div className="text-center py-5 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No friends yet</p>
            <Link href="/friends">
              <Button variant="outline" size="sm" className="mt-3 gap-1" data-testid="button-find-friends">
                <UserPlus className="h-3.5 w-3.5" /> Find Friends
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-1.5">
            {myFriends.slice(0, 5).map(f => (
              <div key={f.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors" data-testid={`row-friend-${f.friendUser.id}`}>
                <div className="flex items-center gap-2.5">
                  <UserAvatar name={f.friendUser.name} avatarUrl={f.friendUser.avatarUrl} className="h-7 w-7 text-xs shrink-0" />
                  <span className="text-sm font-medium">{f.friendUser.name}</span>
                </div>
                <Link href={`/u/${f.friendUser.username}`}>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" data-testid={`link-friend-profile-${f.friendUser.id}`}>
                    Profile <ChevronRight className="h-3 w-3 ml-0.5" />
                  </Button>
                </Link>
              </div>
            ))}
            {myFriends.length > 5 && (
              <Link href="/friends">
                <p className="text-xs text-center text-muted-foreground hover:text-foreground cursor-pointer py-1" data-testid="link-more-friends">
                  +{myFriends.length - 5} more — view all
                </p>
              </Link>
            )}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm flex items-center gap-1.5">
            <Users className="h-4 w-4 text-primary" /> Groups
            {myGroups.length > 0 && <Badge variant="secondary" className="text-xs">{myGroups.length}</Badge>}
          </h3>
          <Link href="/groups">
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground text-xs h-7 px-2" data-testid="link-all-groups">
              View all <ChevronRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
        {myGroups.length === 0 ? (
          <div className="text-center py-5 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No groups yet</p>
            <Link href="/groups">
              <Button variant="outline" size="sm" className="mt-3 gap-1" data-testid="button-find-groups">
                <Users className="h-3.5 w-3.5" /> Browse Groups
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-1.5">
            {myGroups.slice(0, 5).map(g => (
              <Link key={g.id} href={`/groups/${g.id}`}>
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer" data-testid={`row-group-${g.id}`}>
                  <div className="flex items-center gap-2.5">
                    {g.isPublic
                      ? <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                      : <Lock className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <div>
                      <p className="text-sm font-medium leading-tight">{g.name}</p>
                      <p className="text-xs text-muted-foreground">{g.memberCount} {g.memberCount === 1 ? "member" : "members"}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
            {myGroups.length > 5 && (
              <Link href="/groups">
                <p className="text-xs text-center text-muted-foreground hover:text-foreground cursor-pointer py-1" data-testid="link-more-groups">
                  +{myGroups.length - 5} more — view all
                </p>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
