import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { UseMutationResult } from "@tanstack/react-query";

export function ConfirmDialogs({
  groupName,
  leaveConfirmOpen,
  setLeaveConfirmOpen,
  leaveMutation,
  deleteConfirmOpen,
  setDeleteConfirmOpen,
  deleteMutation,
}: {
  groupName: string;
  leaveConfirmOpen: boolean;
  setLeaveConfirmOpen: (v: boolean) => void;
  leaveMutation: UseMutationResult<any, any, void>;
  deleteConfirmOpen: boolean;
  setDeleteConfirmOpen: (v: boolean) => void;
  deleteMutation: UseMutationResult<any, any, void>;
}) {
  return (
    <>
      <Dialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Leave Group?</DialogTitle></DialogHeader>
          <p className="text-muted-foreground">Are you sure you want to leave <strong>{groupName}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => leaveMutation.mutate()} disabled={leaveMutation.isPending} data-testid="button-confirm-leave">
              Leave Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Group?</DialogTitle></DialogHeader>
          <p className="text-muted-foreground">This will permanently delete <strong>{groupName}</strong> and all its rounds and scores. This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} data-testid="button-confirm-delete">
              Delete Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
