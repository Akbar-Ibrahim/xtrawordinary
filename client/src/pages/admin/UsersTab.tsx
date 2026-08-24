import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Ban, ShieldCheck, Loader2, Star, Search } from "lucide-react";
import { Link } from "wouter";
import type { User } from "@shared/schema/users";

export function UsersTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: users, isLoading } = useQuery<User[]>({ queryKey: ["/api/admin/users"] });

  const banMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/admin/users/${id}/ban`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }); toast({ title: "User updated" }); },
    onError: () => toast({ title: "Failed to update user", variant: "destructive" }),
  });

  const adminMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/admin/users/${id}/admin`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }); toast({ title: "User updated" }); },
    onError: () => toast({ title: "Failed to update user", variant: "destructive" }),
  });

  const premiumMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/admin/users/${id}/premium`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }); toast({ title: "User updated" }); },
    onError: () => toast({ title: "Failed to update user", variant: "destructive" }),
  });

  const q = search.trim().toLowerCase();
  const filtered = (users ?? []).filter(u =>
    !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
  );

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle>All Users ({filtered.length}{q ? ` of ${users?.length ?? 0}` : ""})</CardTitle>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm w-64"
              data-testid="input-user-search"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!filtered.length ? (
          <p className="text-muted-foreground text-center py-8" data-testid="text-no-users">
            {q ? "No users match your search." : "No users yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2">Name</th>
                  <th className="text-left py-3 px-2">Email</th>
                  <th className="text-left py-3 px-2">Joined</th>
                  <th className="text-left py-3 px-2">Status</th>
                  <th className="text-right py-3 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b hover:bg-muted/50" data-testid={`user-row-${u.id}`}>
                    <td className="py-3 px-2 font-medium">
                      <Link
                        href={`/profile/${u.id}`}
                        className="hover:text-primary hover:underline"
                        data-testid={`link-user-${u.id}`}
                      >
                        {u.name}
                      </Link>
                    </td>
                    <td className="py-3 px-2 text-muted-foreground">{u.email}</td>
                    <td className="py-3 px-2 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-2">
                      <div className="flex gap-1 flex-wrap">
                        {u.isAdmin && <Badge variant="default" data-testid={`badge-admin-${u.id}`}>Admin</Badge>}
                        {u.isPremium && <Badge className="bg-amber-500 text-white" data-testid={`badge-premium-${u.id}`}>Premium</Badge>}
                        {u.isBanned && <Badge variant="destructive" data-testid={`badge-banned-${u.id}`}>Banned</Badge>}
                        {!u.isAdmin && !u.isPremium && !u.isBanned && <Badge variant="secondary">User</Badge>}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant={u.isBanned ? "outline" : "destructive"} onClick={() => banMutation.mutate(u.id)} disabled={banMutation.isPending} data-testid={`button-ban-${u.id}`}>
                          <Ban className="h-3 w-3 mr-1" />{u.isBanned ? "Unban" : "Ban"}
                        </Button>
                        <Button size="sm" variant={u.isAdmin ? "outline" : "secondary"} onClick={() => adminMutation.mutate(u.id)} disabled={adminMutation.isPending} data-testid={`button-admin-${u.id}`}>
                          <ShieldCheck className="h-3 w-3 mr-1" />{u.isAdmin ? "Remove Admin" : "Make Admin"}
                        </Button>
                        <Button size="sm" variant={u.isPremium ? "outline" : "secondary"} onClick={() => premiumMutation.mutate(u.id)} disabled={premiumMutation.isPending} data-testid={`button-premium-${u.id}`}>
                          <Star className="h-3 w-3 mr-1" />{u.isPremium ? "Remove Premium" : "Make Premium"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
