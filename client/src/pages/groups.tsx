import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { motion } from "framer-motion";
import { Users, Plus, LogIn, Globe, Lock, Copy, ChevronRight } from "lucide-react";
import type { Group } from "@shared/schema";

interface GroupsResponse {
  myGroups: Group[];
  discover: Group[];
}

export default function Groups() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [authOpen, setAuthOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createPublic, setCreatePublic] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  const { data, isLoading } = useQuery<GroupsResponse>({
    queryKey: ["/api/groups"],
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/groups", { name: createName, description: createDesc, isPublic: createPublic }),
    onSuccess: async (res) => {
      const group = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setCreateOpen(false);
      setCreateName("");
      setCreateDesc("");
      setCreatePublic(false);
      navigate(`/groups/${group.id}`);
    },
    onError: () => {
      toast({ title: "Failed to create group", variant: "destructive" });
    },
  });

  const joinMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/groups/join", { inviteCode: joinCode }),
    onSuccess: async (res) => {
      const group = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setJoinOpen(false);
      setJoinCode("");
      navigate(`/groups/${group.id}`);
    },
    onError: () => {
      toast({ title: "Invalid invite code", variant: "destructive" });
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-16 text-center max-w-md">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-6">
          <Users className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold mb-3">Groups</h1>
        <p className="text-muted-foreground mb-8">
          Create or join a group, challenge friends with shared rounds, and compete on your group's leaderboard.
        </p>
        <Button size="lg" onClick={() => setAuthOpen(true)} data-testid="button-signin-groups">
          <LogIn className="h-4 w-4 mr-2" />
          Sign In to Get Started
        </Button>
        <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold">Groups</h1>
            <p className="text-muted-foreground mt-1">Compete with your crew in shared game rounds</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setJoinOpen(true)} data-testid="button-join-group">
              <LogIn className="h-4 w-4 mr-2" />
              Join
            </Button>
            <Button onClick={() => setCreateOpen(true)} data-testid="button-create-group">
              <Plus className="h-4 w-4 mr-2" />
              Create
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : (
          <>
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">My Groups</h2>
              {data?.myGroups.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">You're not in any groups yet.</p>
                    <div className="flex justify-center gap-2 mt-4">
                      <Button variant="outline" size="sm" onClick={() => setJoinOpen(true)}>Join with code</Button>
                      <Button size="sm" onClick={() => setCreateOpen(true)}>Create group</Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {data?.myGroups.map(group => (
                    <GroupCard key={group.id} group={group} />
                  ))}
                </div>
              )}
            </section>

            {(data?.discover.length ?? 0) > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Discover Public Groups</h2>
                <div className="space-y-3">
                  {data?.discover.map(group => (
                    <GroupCard key={group.id} group={group} isDiscover />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </motion.div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                placeholder="e.g. Word Nerds"
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                data-testid="input-group-name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="group-desc">Description (optional)</Label>
              <Textarea
                id="group-desc"
                placeholder="What's this group about?"
                value={createDesc}
                onChange={e => setCreateDesc(e.target.value)}
                rows={2}
                data-testid="input-group-desc"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="group-public"
                checked={createPublic}
                onCheckedChange={setCreatePublic}
                data-testid="switch-group-public"
              />
              <Label htmlFor="group-public" className="cursor-pointer">
                {createPublic ? <span className="flex items-center gap-1"><Globe className="h-4 w-4" /> Public</span> : <span className="flex items-center gap-1"><Lock className="h-4 w-4" /> Private</span>}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || createName.trim().length < 2}
              data-testid="button-create-group-submit"
            >
              {createMutation.isPending ? "Creating..." : "Create Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join a Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="invite-code">Invite Code</Label>
              <Input
                id="invite-code"
                placeholder="e.g. ABCD-1234"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                data-testid="input-invite-code"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJoinOpen(false)}>Cancel</Button>
            <Button
              onClick={() => joinMutation.mutate()}
              disabled={joinMutation.isPending || joinCode.trim().length < 4}
              data-testid="button-join-group-submit"
            >
              {joinMutation.isPending ? "Joining..." : "Join Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GroupCard({ group, isDiscover }: { group: Group; isDiscover?: boolean }) {
  const { toast } = useToast();

  function copyInviteCode() {
    navigator.clipboard.writeText(group.inviteCode);
    toast({ title: "Invite code copied!" });
  }

  return (
    <Link href={`/groups/${group.id}`}>
      <Card className="cursor-pointer hover:bg-muted/50 transition-colors" data-testid={`card-group-${group.id}`}>
        <CardContent className="p-4 flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold truncate">{group.name}</span>
              <Badge variant="outline" className="text-xs shrink-0">
                {group.isPublic ? <><Globe className="h-3 w-3 mr-1" />Public</> : <><Lock className="h-3 w-3 mr-1" />Private</>}
              </Badge>
            </div>
            {group.description && <p className="text-sm text-muted-foreground truncate mt-0.5">{group.description}</p>}
            {!isDiscover && (
              <button
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-1"
                onClick={e => { e.preventDefault(); copyInviteCode(); }}
                data-testid={`button-copy-invite-${group.id}`}
              >
                <Copy className="h-3 w-3" />
                {group.inviteCode}
              </button>
            )}
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </CardContent>
      </Card>
    </Link>
  );
}
