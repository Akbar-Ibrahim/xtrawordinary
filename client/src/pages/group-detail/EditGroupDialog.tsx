import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Globe, Lock } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import { ALL_TAGS } from "./constants";

export function EditGroupDialog({
  open,
  onOpenChange,
  editName,
  setEditName,
  editDesc,
  setEditDesc,
  editPublic,
  setEditPublic,
  editTags,
  toggleEditTag,
  editAnnouncement,
  setEditAnnouncement,
  editMutation,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editName: string;
  setEditName: (v: string) => void;
  editDesc: string;
  setEditDesc: (v: string) => void;
  editPublic: boolean;
  setEditPublic: (v: boolean) => void;
  editTags: string[];
  toggleEditTag: (tag: string) => void;
  editAnnouncement: string;
  setEditAnnouncement: (v: string) => void;
  editMutation: UseMutationResult<any, any, void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Group</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="edit-name">Group Name</Label>
            <Input id="edit-name" value={editName} onChange={e => setEditName(e.target.value)} data-testid="input-edit-name" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-desc">Description</Label>
            <Textarea id="edit-desc" value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2} data-testid="input-edit-desc" />
          </div>
          <div className="flex items-center gap-3">
            <Switch id="edit-public" checked={editPublic} onCheckedChange={setEditPublic} data-testid="switch-edit-public" />
            <Label htmlFor="edit-public" className="cursor-pointer">
              {editPublic ? <span className="flex items-center gap-1"><Globe className="h-4 w-4" />Public</span> : <span className="flex items-center gap-1"><Lock className="h-4 w-4" />Private</span>}
            </Label>
          </div>
          <div className="space-y-2">
            <Label>Tags <span className="text-muted-foreground font-normal text-xs">(up to 3)</span></Label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleEditTag(tag)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${editTags.includes(tag) ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 border-border hover:bg-muted/70"}`}
                  data-testid={`tag-${tag}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-announcement">Pinned Announcement <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
            <Textarea
              id="edit-announcement"
              value={editAnnouncement}
              onChange={e => setEditAnnouncement(e.target.value)}
              placeholder="Share news, reminders, or rules with your group..."
              rows={3}
              data-testid="input-edit-announcement"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => editMutation.mutate()}
            disabled={editMutation.isPending || editName.trim().length < 2}
            data-testid="button-edit-group-submit"
          >
            {editMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
