import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { UserAvatar } from "@/components/user-avatar";
import { useUsernameAvailability } from "@/hooks/use-username-availability";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileUser: { username: string; name: string; avatarUrl: string | null; bio?: string | null };
  onSave: (data: { name?: string; avatarUrl?: string | null; bio?: string | null }) => void;
  isPending: boolean;
}

export function EditProfileDialog({ open, onOpenChange, profileUser, onSave, isPending }: Props) {
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [editBio, setEditBio] = useState("");

  useEffect(() => {
    if (open) {
      setEditName(profileUser.name);
      setEditUsername(profileUser.username);
      setEditAvatarUrl(profileUser.avatarUrl ?? "");
      setEditBio(profileUser.bio ?? "");
    }
  }, [open, profileUser]);

  const usernameAvailability = useUsernameAvailability(editUsername);

  function handleSave() {
    const data: { username?: string; name?: string; avatarUrl?: string | null; bio?: string | null } = {};
    if (editName.trim() && editName.trim() !== profileUser.name) data.name = editName.trim();
    if (editUsername.trim() && editUsername.trim() !== profileUser.username) data.username = editUsername.trim();
    const url = editAvatarUrl.trim() || null;
    if (url !== (profileUser.avatarUrl ?? null)) data.avatarUrl = url;
    const bioVal = editBio.trim() || null;
    if (bioVal !== (profileUser.bio ?? null)) data.bio = bioVal;
    if (Object.keys(data).length === 0) { onOpenChange(false); return; }
    onSave(data);
  }

  const previewName = editName.trim() || profileUser.name;
  const previewUrl = editAvatarUrl.trim() || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-edit-profile">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div className="flex justify-center">
            <UserAvatar name={previewName} avatarUrl={previewUrl} className="h-20 w-20 text-2xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-name">Display name</Label>
            <Input id="edit-name" value={editName} onChange={e => setEditName(e.target.value)} maxLength={50} placeholder="Your name" data-testid="input-edit-name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-username">Username</Label>
            <Input id="edit-username" value={editUsername} onChange={e => setEditUsername(e.target.value)} minLength={3} maxLength={20} autoCapitalize="none" placeholder="word_player" data-testid="input-edit-username" />
            <p className={`text-xs ${usernameAvailability.available === false ? "text-destructive" : "text-muted-foreground"}`}>
              {usernameAvailability.checking ? "Checking availability…" : usernameAvailability.message || "3–20 lowercase letters, numbers, or underscores."}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-avatar">Avatar URL <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input id="edit-avatar" value={editAvatarUrl} onChange={e => setEditAvatarUrl(e.target.value)} placeholder="https://example.com/photo.jpg" data-testid="input-edit-avatar-url" />
            <p className="text-xs text-muted-foreground">Paste a link to your photo. Leave blank to use your initials.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-bio">Bio <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <textarea
              id="edit-bio"
              value={editBio}
              onChange={e => setEditBio(e.target.value)}
              maxLength={200}
              placeholder="A short tagline or description about you…"
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              data-testid="input-edit-bio"
            />
            <p className="text-xs text-muted-foreground text-right">{editBio.length}/200</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-edit">Cancel</Button>
          <Button onClick={handleSave} disabled={isPending || usernameAvailability.checking || usernameAvailability.available === false} data-testid="button-save-profile">
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
