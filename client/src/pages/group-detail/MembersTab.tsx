import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TabsContent } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/user-avatar";
import { Crown, Shield, Swords, UserX } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import type { MemberWithUser } from "./types";

export function MembersTab({
  members,
  membersLoading,
  currentUserId,
  isAdmin,
  isOwner,
  changeRoleMutation,
  removeMemberMutation,
  onChallenge,
}: {
  members: MemberWithUser[] | undefined;
  membersLoading: boolean;
  currentUserId: number | undefined;
  isAdmin: boolean;
  isOwner: boolean;
  changeRoleMutation: UseMutationResult<any, any, { userId: number; role: string }>;
  removeMemberMutation: UseMutationResult<any, any, number>;
  onChallenge: (target: { id: number; name: string; avatarUrl: string | null }) => void;
}) {
  return (
    <TabsContent value="members">
      {membersLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
      ) : (
        <div className="space-y-2">
          {members?.map(member => (
            <Card key={member.id} data-testid={`card-member-${member.userId}`}>
              <CardContent className="p-4 flex items-center gap-4">
                <Link href={`/profile/${member.userId}`}>
                  <UserAvatar name={member.user.name} avatarUrl={member.user.avatarUrl} className="h-9 w-9 cursor-pointer" />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/profile/${member.userId}`}>
                    <p className="font-semibold truncate hover:underline cursor-pointer">{member.user.name}</p>
                  </Link>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {member.role === "owner" && <Crown className="h-3.5 w-3.5 text-yellow-500" />}
                    {member.role === "admin" && <Shield className="h-3.5 w-3.5 text-blue-500" />}
                    <span className="text-xs text-muted-foreground capitalize">{member.role}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {currentUserId && member.userId !== currentUserId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-violet-600 hover:text-violet-700 gap-1"
                      onClick={() => onChallenge({ id: member.user.id, name: member.user.name, avatarUrl: member.user.avatarUrl })}
                      data-testid={`button-challenge-${member.userId}`}
                    >
                      <Swords className="h-4 w-4" />
                    </Button>
                  )}
                  {isAdmin && member.userId !== currentUserId && member.role !== "owner" && (
                    <>
                      {isOwner && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => changeRoleMutation.mutate({ userId: member.userId, role: member.role === "admin" ? "member" : "admin" })}
                          data-testid={`button-role-${member.userId}`}
                        >
                          {member.role === "admin" ? "Demote" : "Make Admin"}
                        </Button>
                      )}
                      {(isOwner || member.role === "member") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeMemberMutation.mutate(member.userId)}
                          data-testid={`button-remove-${member.userId}`}
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </TabsContent>
  );
}
