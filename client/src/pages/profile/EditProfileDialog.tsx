import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { UserAvatar } from "@/components/user-avatar";
import { useUsernameAvailability } from "@/hooks/use-username-availability";
import {
  AVATAR_UPLOAD_MIME_TYPES,
  MAX_AVATAR_UPLOAD_BYTES,
} from "@shared/avatar";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileUser: { username: string; name: string; avatarUrl: string | null; bio?: string | null; hideActivity?: boolean };
  onSave: (
    data: { username?: string; name?: string; avatarUrl?: string | null; bio?: string | null; hideActivity?: boolean },
    avatarFile?: File,
  ) => Promise<void>;
  onCancelUpload: () => void;
  isPending: boolean;
  isUploadingAvatar: boolean;
  avatarUploadProgress: number | null;
}

export function EditProfileDialog({
  open,
  onOpenChange,
  profileUser,
  onSave,
  onCancelUpload,
  isPending,
  isUploadingAvatar,
  avatarUploadProgress,
}: Props) {
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [editBio, setEditBio] = useState("");
  const [hideActivity, setHideActivity] = useState(false);
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarFileError, setAvatarFileError] = useState("");
  const hasInitializedOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      hasInitializedOpenRef.current = false;
      return;
    }
    if (hasInitializedOpenRef.current) return;

    hasInitializedOpenRef.current = true;
    setEditName(profileUser.name);
    setEditUsername(profileUser.username);
    setEditAvatarUrl(profileUser.avatarUrl ?? "");
    setEditBio(profileUser.bio ?? "");
    setHideActivity(profileUser.hideActivity ?? false);
    setEditAvatarFile(null);
    setAvatarFileError("");
  }, [open, profileUser]);

  useEffect(() => {
    if (!editAvatarFile) {
      setAvatarPreviewUrl(null);
      return;
    }

    const previewUrl = URL.createObjectURL(editAvatarFile);
    setAvatarPreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [editAvatarFile]);

  const usernameAvailability = useUsernameAvailability(editUsername);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) onCancelUpload();
    onOpenChange(nextOpen);
  }

  async function handleSave() {
    const data: { username?: string; name?: string; avatarUrl?: string | null; bio?: string | null; hideActivity?: boolean } = {};
    if (editName.trim() && editName.trim() !== profileUser.name) data.name = editName.trim();
    if (editUsername.trim() && editUsername.trim() !== profileUser.username) data.username = editUsername.trim();
    if (!editAvatarFile) {
      const url = editAvatarUrl.trim() || null;
      if (url !== (profileUser.avatarUrl ?? null)) data.avatarUrl = url;
    }
    const bioVal = editBio.trim() || null;
    if (bioVal !== (profileUser.bio ?? null)) data.bio = bioVal;
    if (hideActivity !== (profileUser.hideActivity ?? false)) data.hideActivity = hideActivity;
    if (Object.keys(data).length === 0 && !editAvatarFile) {
      handleOpenChange(false);
      return;
    }
    await onSave(data, editAvatarFile ?? undefined);
  }

  const previewName = editName.trim() || profileUser.name;
  const previewUrl = avatarPreviewUrl ?? (editAvatarUrl.trim() || null);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden"
        data-testid="dialog-edit-profile"
      >
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        <div
          className="min-h-0 space-y-5 overflow-y-auto py-2"
          data-testid="edit-profile-content"
        >
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
            <Input
              id="edit-avatar"
              value={editAvatarUrl}
              onChange={e => {
                setEditAvatarUrl(e.target.value);
                setEditAvatarFile(null);
                setAvatarFileError("");
              }}
              placeholder="https://example.com/photo.jpg"
              data-testid="input-edit-avatar-url"
            />
            <p className="text-xs text-muted-foreground">Paste a link to your photo. Leave blank to use your initials.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-avatar-file">Or upload a photo</Label>
            <Input
              id="edit-avatar-file"
              type="file"
              accept={AVATAR_UPLOAD_MIME_TYPES.join(",")}
              onChange={event => {
                const file = event.currentTarget.files?.[0] ?? null;
                event.currentTarget.value = "";
                setAvatarFileError("");
                if (!file) return;
                if (!AVATAR_UPLOAD_MIME_TYPES.includes(file.type as typeof AVATAR_UPLOAD_MIME_TYPES[number])) {
                  setAvatarFileError("Choose a PNG, JPEG, or WebP image.");
                  return;
                }
                if (file.size > MAX_AVATAR_UPLOAD_BYTES) {
                  setAvatarFileError("Choose an image no larger than 5 MB.");
                  return;
                }
                setEditAvatarFile(file);
              }}
              data-testid="input-edit-avatar-file"
            />
            <p className="text-xs text-muted-foreground">PNG, JPEG, or WebP · up to 5 MB. Uploaded photos are cropped to a square.</p>
            {avatarFileError && <p className="text-xs text-destructive" role="alert">{avatarFileError}</p>}
            {isUploadingAvatar && (
              <div className="space-y-1" role="status" aria-live="polite" data-testid="avatar-upload-progress">
                <p className="text-xs text-muted-foreground">
                  {avatarUploadProgress === null
                    ? "Uploading photo…"
                    : `Uploading photo… ${avatarUploadProgress}%`}
                </p>
                <progress
                  className="h-2 w-full"
                  aria-label="Photo upload progress"
                  max={100}
                  value={avatarUploadProgress ?? undefined}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onCancelUpload}
                  data-testid="button-cancel-avatar-upload"
                >
                  Cancel upload
                </Button>
              </div>
            )}
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
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div className="space-y-1">
              <Label htmlFor="edit-show-activity" className="cursor-pointer">Show my activity to friends</Label>
              <p className="text-xs text-muted-foreground">Turn this off to hide when you were last active.</p>
            </div>
            <Switch
              id="edit-show-activity"
              checked={!hideActivity}
              onCheckedChange={(showActivity) => setHideActivity(!showActivity)}
              data-testid="switch-show-activity"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-cancel-edit">Cancel</Button>
          <Button onClick={() => void handleSave()} disabled={isPending || usernameAvailability.checking || usernameAvailability.available === false || Boolean(avatarFileError)} data-testid="button-save-profile">
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
