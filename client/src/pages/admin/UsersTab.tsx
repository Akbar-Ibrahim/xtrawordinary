import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Ban, ShieldCheck, Loader2, Star } from "lucide-react";

export function UsersTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/users"] });

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

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <Card>
      <CardHeader><CardTitle>All Users ({users?.length ?? 0})</CardTitle></CardHeader>
      <CardContent>
        {!users?.length ? (
          <p className="text-muted-foreground text-center py-8" data-testid="text-no-users">No users yet.</p>
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
                {users.map((u: any) => (
                  <tr key={u.id} className="border-b hover:bg-muted/50" data-testid={`user-row-${u.id}`}>
                    <td className="py-3 px-2 font-medium">{u.name}</td>
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
