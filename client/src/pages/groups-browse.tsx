import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { motion } from "framer-motion";
import { ArrowLeft, Users, Globe, Copy, ChevronRight, Star, LogIn, X } from "lucide-react";
import type { Group } from "@shared/schema";

const ALL_TAGS = ["School", "Office", "Family", "Friends", "Gaming", "Book Club", "Other"];

interface GroupsResponse {
  myGroups: Group[];
  discover: Group[];
  featured: Group[];
}

export default function GroupsBrowse() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [authOpen, setAuthOpen] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const { data, isLoading } = useQuery<GroupsResponse>({
    queryKey: ["/api/groups", activeTag ? `?tag=${activeTag}` : ""],
    queryFn: async () => {
      const url = activeTag ? `/api/groups?tag=${encodeURIComponent(activeTag)}` : "/api/groups";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const allPublic = [...(data?.featured || []), ...(data?.discover || [])].reduce((acc: Group[], g) => {
    if (!acc.find(x => x.id === g.id)) acc.push(g);
    return acc;
  }, []);

  const featuredGroups = data?.featured || [];
  const otherGroups = allPublic.filter(g => !g.isFeatured);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Link href="/groups">
        <Button variant="ghost" className="gap-2 mb-6" data-testid="button-back-groups">
          <ArrowLeft className="h-4 w-4" />
          Groups
        </Button>
      </Link>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Browse Groups</h1>
          <p className="text-muted-foreground mt-1">Discover public groups to join</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-6">
          <button
            onClick={() => setActiveTag(null)}
            className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${!activeTag ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 border-border hover:bg-muted/70"}`}
            data-testid="tag-filter-all"
          >
            All
          </button>
          {ALL_TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${activeTag === tag ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 border-border hover:bg-muted/70"}`}
              data-testid={`tag-filter-${tag}`}
            >
              {tag}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : (
          <>
            {featuredGroups.length > 0 && (
              <section className="mb-8">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                  Featured
                </h2>
                <div className="space-y-3">
                  {featuredGroups.map(group => (
                    <BrowseGroupCard key={group.id} group={group} onJoin={isAuthenticated ? undefined : () => setAuthOpen(true)} />
                  ))}
                </div>
              </section>
            )}

            {otherGroups.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {activeTag ? `Tagged: ${activeTag}` : "All Public Groups"}
                </h2>
                <div className="space-y-3">
                  {otherGroups.map(group => (
                    <BrowseGroupCard key={group.id} group={group} onJoin={isAuthenticated ? undefined : () => setAuthOpen(true)} />
                  ))}
                </div>
              </section>
            )}

            {allPublic.length === 0 && (
              <Card>
                <CardContent className="p-10 text-center">
                  <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    {activeTag ? `No public groups tagged "${activeTag}".` : "No public groups yet. Be the first to create one!"}
                  </p>
                  {activeTag && (
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => setActiveTag(null)}>
                      <X className="h-3.5 w-3.5 mr-1.5" />Clear filter
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </motion.div>

      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}

function BrowseGroupCard({ group, onJoin }: { group: Group; onJoin?: () => void }) {
  const { toast } = useToast();

  return (
    <Card className="hover:bg-muted/30 transition-colors" data-testid={`browse-group-${group.id}`}>
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
              <Globe className="h-3 w-3 mr-1" />Public
            </Badge>
          </div>
          {group.description && <p className="text-sm text-muted-foreground truncate mt-0.5">{group.description}</p>}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {group.memberCount != null && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />{group.memberCount} member{group.memberCount !== 1 ? "s" : ""}
              </span>
            )}
            {(group.tags || []).map(tag => (
              <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground">{tag}</span>
            ))}
          </div>
        </div>
        {onJoin ? (
          <Button size="sm" variant="outline" onClick={onJoin} data-testid={`button-auth-join-${group.id}`}>
            <LogIn className="h-3.5 w-3.5 mr-1.5" />Join
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
