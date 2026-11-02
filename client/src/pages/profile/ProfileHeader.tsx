import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Calendar, UserPlus, UserCheck, Crown, Swords } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { UserActivityStatus } from "@/components/user-activity-status";
import type { PublicProfile } from "./types";
import { ProfileSafetyActions } from "./ProfileSafetyActions";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  profile: PublicProfile;
  lastActiveAt?: string | null;
  isOwnProfile: boolean;
  isAuthenticated: boolean;
  championships: Array<{ id: number; tournamentId: number; createdAt: string; tournamentName: string }>;
  guildWarsChampionships: Array<{ id: number }>;
  friendship: any;
  sendRequestPending: boolean;
  onSendFriendRequest: (note: string) => void;
  downgradePremiumPending: boolean;
  onDowngradePremium: () => void;
  onOpenEdit: () => void;
  onOpenChallenge: () => void;
}

export function ProfileHeader({
  profile,
  lastActiveAt,
  isOwnProfile,
  isAuthenticated,
  championships,
  guildWarsChampionships,
  friendship,
  sendRequestPending,
  onSendFriendRequest,
  downgradePremiumPending,
  onDowngradePremium,
  onOpenEdit,
  onOpenChallenge,
}: Props) {
  const [friendRequestDialogOpen, setFriendRequestDialogOpen] = useState(false);
  const [friendRequestNote, setFriendRequestNote] = useState("");

  return (
    <Card>
      <Dialog open={friendRequestDialogOpen} onOpenChange={setFriendRequestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send a friend request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label htmlFor="friend-request-note" className="text-sm font-medium">Add a note (optional)</label>
            <Textarea
              id="friend-request-note"
              value={friendRequestNote}
              onChange={(event) => setFriendRequestNote(event.target.value)}
              placeholder="Let them know why you'd like to connect..."
              maxLength={200}
              rows={3}
              data-testid="input-friend-request-note"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFriendRequestDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  onSendFriendRequest(friendRequestNote);
                  setFriendRequestNote("");
                  setFriendRequestDialogOpen(false);
                }}
                disabled={sendRequestPending}
                data-testid="button-send-friend-request"
              >
                Send request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <UserAvatar name={profile.user.name} avatarUrl={profile.user.avatarUrl} className="h-16 w-16 text-xl" />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold" data-testid="text-profile-name">{profile.user.name}</h1>
              {profile.user.isPremium && (
                <Badge className="gap-1 bg-amber-500 hover:bg-amber-500 text-white border-0" data-testid="badge-premium-profile">
                  <Crown className="h-3 w-3" /> Premium
                </Badge>
              )}
              {championships.length > 0 && (
                <Badge className="gap-1 bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-400/40 hover:bg-amber-400/25" data-testid="badge-word-wars-champion">
                  <Crown className="h-3 w-3 fill-current" />
                  Word Wars Champion{championships.length > 1 ? ` ×${championships.length}` : ""}
                </Badge>
              )}
              {guildWarsChampionships.length > 0 && (
                <Badge className="gap-1 bg-purple-400/20 text-purple-700 dark:text-purple-300 border border-purple-400/40 hover:bg-purple-400/25" data-testid="badge-guild-wars-champion">
                  <Swords className="h-3 w-3" />
                  Guild Wars Champion{guildWarsChampionships.length > 1 ? ` ×${guildWarsChampionships.length}` : ""}
                </Badge>
              )}
              {isOwnProfile && (
                <button onClick={onOpenEdit} className="text-muted-foreground hover:text-foreground transition-colors" data-testid="button-edit-profile" aria-label="Edit profile">
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="text-sm text-muted-foreground" data-testid="text-profile-username">@{profile.user.username}</p>
            {!isOwnProfile && (
              <UserActivityStatus
                lastActiveAt={lastActiveAt !== undefined ? lastActiveAt : profile.user.lastActiveAt}
                className="mt-1"
              />
            )}
            {isOwnProfile && profile.user.isPremium && (
              <Button variant="ghost" size="sm" className="mt-1 h-7 px-2 text-xs text-muted-foreground hover:text-destructive" onClick={onDowngradePremium} disabled={downgradePremiumPending} data-testid="button-downgrade-premium">
                Remove Premium (testing)
              </Button>
            )}
            {(profile.user as any).bio && (
              <p className="text-sm text-muted-foreground mt-0.5 max-w-md" data-testid="text-profile-bio">{(profile.user as any).bio}</p>
            )}
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Joined {new Date(profile.user.createdAt).toLocaleDateString()}
            </p>
          </div>
          {isAuthenticated && !isOwnProfile && (
            <div className="flex items-center gap-2 flex-wrap">
              {friendship ? (
                <Badge variant="secondary" className="gap-1" data-testid="badge-friend">
                  <UserCheck className="h-3 w-3" /> Friends
                </Badge>
              ) : (
                <Button size="sm" onClick={() => setFriendRequestDialogOpen(true)} disabled={sendRequestPending} data-testid="button-add-friend">
                  <UserPlus className="h-4 w-4 mr-1" /> Add Friend
                </Button>
              )}
              <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white gap-1" onClick={onOpenChallenge} data-testid="button-open-challenge">
                <Swords className="h-4 w-4" /> Challenge
              </Button>
              <ProfileSafetyActions targetUser={profile.user} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
