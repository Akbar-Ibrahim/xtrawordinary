import { PageSEO } from "@/components/page-seo";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { PremiumBanner } from "@/components/premium-banner";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { motion } from "framer-motion";
import { Users, Plus, LogIn, Globe, Lock, Copy, ChevronRight, Star, Search, Trophy, BarChart3, X } from "lucide-react";
import type { Group } from "@shared/schema";

const SIGNUP_PERKS = [
  { icon: Users, label: "Create or join groups", desc: "Start your own crew or use an invite code to join one." },
  { icon: Trophy, label: "Compete in group rounds", desc: "Play shared game rounds and see how you stack up against your group." },
  { icon: BarChart3, label: "Track group leaderboards", desc: "Follow everyone's scores and climb the rankings over time." },
  { icon: Plus, label: "Invite anyone with a code", desc: "Share a private invite link — no account needed to get started." },
];

const ALL_TAGS = ["School", "Office", "Family", "Friends", "Gaming", "Book Club", "Other"];

interface GroupsResponse {
  myGroups: Group[];
  discover: Group[];
  featured: Group[];
}

export default function Groups() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [authOpen, setAuthOpen] = useState(false);
  const [authInitialTab, setAuthInitialTab] = useState<"signin" | "signup">("signup");
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createPublic, setCreatePublic] = useState(false);
  const [createTags, setCreateTags] = useState<string[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [discoverSearch, setDiscoverSearch] = useState("");
  const [discoverFilter, setDiscoverFilter] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDiscoverFilter(discoverSearch.trim()), 300);
    return () => clearTimeout(timer);
  }, [discoverSearch]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      setJoinCode(code.toUpperCase());
      setJoinOpen(true);
    }
  }, []);

  const { data, isLoading } = useQuery<GroupsResponse>({
    queryKey: ["/api/groups"],
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/groups", { name: createName, description: createDesc, isPublic: createPublic, tags: createTags }),
    onSuccess: async (res) => {
      const group = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setCreateOpen(false);
      setCreateName("");
      setCreateDesc("");
      setCreatePublic(false);
      setCreateTags([]);
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

  function openAuth(tab: "signin" | "signup") {
    setAuthInitialTab(tab);
    setAuthOpen(true);
  }

  function requireAuthThen(action: () => void) {
    if (!isAuthenticated) {
      openAuth("signup");
    } else {
      action();
    }
  }

  function toggleCreateTag(tag: string) {
    setCreateTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag].slice(0, 3));
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <PageSEO title="Groups" description="Join or create word game groups, compete in group rounds, and climb your group's leaderboard." path="/groups" />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold">Groups</h1>
            <p className="text-muted-foreground mt-1">Compete with your crew in shared game rounds</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/groups/browse">
              <Button variant="outline" data-testid="button-browse-groups">
                <Search className="h-4 w-4 mr-2" />
                Browse
              </Button>
            </Link>
            <Button variant="outline" onClick={() => requireAuthThen(() => setJoinOpen(true))} data-testid="button-join-group">
              <LogIn className="h-4 w-4 mr-2" />
              Join
            </Button>
            <Button onClick={() => requireAuthThen(() => setCreateOpen(true))} data-testid="button-create-group">
              <Plus className="h-4 w-4 mr-2" />
              Create
            </Button>
          </div>
        </div>

        {!isAuthenticated && (
          <div className="space-y-4 mb-6">
            <Card className="border-primary/30 dark:border-primary/40 bg-primary/5 dark:bg-primary/10" data-testid="card-guest-signup-cta">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Play with your crew</p>
                    <p className="text-xs text-muted-foreground">Create a free account to unlock the full groups experience.</p>
                  </div>
                </div>

                <ul className="space-y-2.5 mb-5">
                  {SIGNUP_PERKS.map(({ icon: Icon, label, desc }) => (
                    <li key={label} className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="h-3 w-3 text-primary" />
                      </div>
                      <div>
                        <span className="text-sm font-medium">{label}</span>
                        <span className="text-xs text-muted-foreground ml-1.5">{desc}</span>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="flex gap-2">
                  <Button
                    className="flex-1 gap-2"
                    onClick={() => openAuth("signup")}
                    data-testid="button-guest-create-account"
                  >
                    <Star className="h-4 w-4" />
                    Create Free Account
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => openAuth("signin")}
                    data-testid="button-guest-signin"
                  >
                    Sign In
                  </Button>
                </div>
              </CardContent>
            </Card>

            <PremiumBanner variant="card" />
          </div>
        )}

        {isAuthenticated && !user?.isPremium && (
          <div className="mb-6">
            <PremiumBanner variant="banner" />
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : (
          <>
            {isAuthenticated && (
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
            )}

            {(data?.featured?.length ?? 0) > 0 && (
              <section className="mb-8">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                  Featured Groups
                </h2>
                <div className="space-y-3">
                  {data?.featured.map(group => (
                    <GroupCard
                      key={group.id}
                      group={group}
                      isDiscover
                      onJoin={() => requireAuthThen(() => {
                        setJoinCode(group.inviteCode);
                        setJoinOpen(true);
                      })}
                    />
                  ))}
                </div>
              </section>
            )}

            {(data?.discover.length ?? 0) > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Discover Public Groups</h2>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search groups..."
                    value={discoverSearch}
                    onChange={e => setDiscoverSearch(e.target.value)}
                    className="pl-9 pr-9"
                    data-testid="input-discover-search"
                  />
                  {discoverSearch && (
                    <button
                      onClick={() => { setDiscoverSearch(""); setDiscoverFilter(""); }}
                      className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                      data-testid="button-clear-discover-search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {(() => {
                  const lowerSearch = discoverFilter.toLowerCase();
                  const filtered = (data?.discover ?? []).filter(g =>
                    !lowerSearch ||
                    g.name.toLowerCase().includes(lowerSearch) ||
                    (g.description ?? "").toLowerCase().includes(lowerSearch)
                  );
                  if (!filtered.length) {
                    return (
                      <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-discover-results">
                        No groups found for "{discoverSearch}"
                      </p>
                    );
                  }
                  return (
                    <div className="space-y-3">
                      {filtered.map(group => (
                        <GroupCard
                          key={group.id}
                          group={group}
                          isDiscover
                          onJoin={() => requireAuthThen(() => {
                            setJoinCode(group.inviteCode);
                            setJoinOpen(true);
                          })}
                        />
                      ))}
                    </div>
                  );
                })()}
              </section>
            )}

            {(data?.discover.length ?? 0) === 0 && !isAuthenticated && (
              <Card>
                <CardContent className="p-8 text-center">
                  <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No public groups yet. Sign in to create the first one!</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </motion.div>

      <AuthModal open={authOpen} onOpenChange={setAuthOpen} initialTab={authInitialTab} />

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
                aria-pressed={createPublic}
                data-testid="switch-group-public"
              />
              <Label htmlFor="group-public" className="cursor-pointer">
                {createPublic ? <span className="flex items-center gap-1"><Globe className="h-4 w-4" /> Public</span> : <span className="flex items-center gap-1"><Lock className="h-4 w-4" /> Private</span>}
              </Label>
            </div>
            {createPublic && (
              <div className="space-y-2">
                <Label>Tags <span className="text-muted-foreground font-normal text-xs">(optional, up to 3)</span></Label>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tags">
                  {ALL_TAGS.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleCreateTag(tag)}
                      aria-pressed={createTags.includes(tag)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${createTags.includes(tag) ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 border-border hover:bg-muted/70"}`}
                      data-testid={`create-tag-${tag}`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
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

function GroupCard({ group, isDiscover, onJoin }: { group: Group; isDiscover?: boolean; onJoin?: () => void }) {
  const { toast } = useToast();

  function copyInviteCode() {
    const url = `${window.location.origin}/groups?code=${group.inviteCode}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Invite link copied!" });
  }

  return (
    <Card className="hover:bg-muted/30 transition-colors" data-testid={`card-group-${group.id}`}>
      <CardContent className="p-4 flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 relative">
          <Users className="h-6 w-6 text-primary" />
          {group.isFeatured && (
            <Star className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold truncate">{group.name}</span>
            <Badge variant="outline" className="text-xs shrink-0">
              {group.isPublic ? <><Globe className="h-3 w-3 mr-1" />Public</> : <><Lock className="h-3 w-3 mr-1" />Private</>}
            </Badge>
          </div>
          {group.description && <p className="text-sm text-muted-foreground truncate mt-0.5">{group.description}</p>}
          {(group.tags || []).length > 0 && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              {(group.tags || []).map(tag => (
                <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground">{tag}</span>
              ))}
            </div>
          )}
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
        {isDiscover && onJoin ? (
          <Button size="sm" variant="outline" onClick={onJoin} data-testid={`button-join-discover-${group.id}`}>
            Join
          </Button>
        ) : (
          <Link href={`/groups/${group.id}`}>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
