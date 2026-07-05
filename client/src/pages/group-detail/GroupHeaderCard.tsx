import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, Copy, Globe, Lock, Swords, X, Megaphone, Star, Edit2, Zap } from "lucide-react";
import type { Group, GroupMember } from "@shared/schema";

export function GroupHeaderCard({
  group,
  membership,
  isAdmin,
  isOwner,
  onEdit,
  onBattle,
  onTeamRace,
  onLeave,
  onDelete,
  onCopyInvite,
}: {
  group: Group;
  membership: GroupMember | null;
  isAdmin: boolean;
  isOwner: boolean;
  onEdit: () => void;
  onBattle: () => void;
  onTeamRace: () => void;
  onLeave: () => void;
  onDelete: () => void;
  onCopyInvite: () => void;
}) {
  return (
    <>
      <Card className="mb-4">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Users className="h-7 w-7 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold">{group.name}</h1>
                  {group.isFeatured && <span title="Featured group"><Star className="h-5 w-5 text-yellow-500 fill-yellow-500" /></span>}
                </div>
                {group.description && <p className="text-muted-foreground text-sm mt-0.5">{group.description}</p>}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {group.isPublic ? <><Globe className="h-3 w-3 mr-1" />Public</> : <><Lock className="h-3 w-3 mr-1" />Private</>}
                  </Badge>
                  {membership && (
                    <Badge variant="secondary" className="text-xs capitalize">{membership.role}</Badge>
                  )}
                  {(group.tags || []).map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs bg-muted/40">{tag}</Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={onEdit} data-testid="button-edit-group">
                  <Edit2 className="h-4 w-4 mr-1.5" />Edit
                </Button>
              )}
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={onBattle} data-testid="button-huddle-challenge">
                  <Zap className="h-4 w-4 mr-1.5" />Battle
                </Button>
              )}
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={onTeamRace} data-testid="button-team-race-challenge">
                  <Users className="h-4 w-4 mr-1.5" />Team Race
                </Button>
              )}
              {membership && !isOwner && (
                <Button variant="outline" size="sm" onClick={onLeave} data-testid="button-leave-group">
                  <X className="h-4 w-4 mr-1.5" />Leave
                </Button>
              )}
              {isOwner && (
                <Button variant="outline" size="sm" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={onDelete} data-testid="button-delete-group">
                  Delete
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={onCopyInvite} data-testid="button-copy-invite">
                <Copy className="h-4 w-4 mr-1.5" />
                {group.inviteCode}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {group.pinnedAnnouncement && (
        <Card className="mb-4 border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="p-4 flex items-start gap-3">
            <Megaphone className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">{group.pinnedAnnouncement}</p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
