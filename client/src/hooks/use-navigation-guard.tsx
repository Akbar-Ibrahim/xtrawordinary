import { useState, useEffect, useCallback } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface NavigationGuard {
  ConfirmDialog: React.ReactElement;
  confirmExit: (onConfirm: () => void) => void;
}

export function useNavigationGuard(active: boolean): NavigationGuard {
  const [open, setOpen] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<(() => void) | null>(null);
  const [doNavigateBack, setDoNavigateBack] = useState(false);

  useEffect(() => {
    if (!active) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
      setOpen(true);
      setPendingConfirm(() => () => setDoNavigateBack(true));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [active]);

  useEffect(() => {
    if (!doNavigateBack) return;
    setDoNavigateBack(false);
    setOpen(false);
    window.history.go(-2);
  }, [doNavigateBack]);

  const confirmExit = useCallback((onConfirm: () => void) => {
    setOpen(true);
    setPendingConfirm(() => onConfirm);
  }, []);

  const handleConfirm = useCallback(() => {
    if (pendingConfirm) {
      pendingConfirm();
      setPendingConfirm(null);
    }
    setOpen(false);
  }, [pendingConfirm]);

  const handleCancel = useCallback(() => {
    setOpen(false);
    setPendingConfirm(null);
  }, []);

  const ConfirmDialog = (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave the game?</AlertDialogTitle>
          <AlertDialogDescription>
            Your attempt is already recorded. If you leave now, your score won't be saved.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} data-testid="button-guard-stay">
            Stay
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="button-guard-leave"
          >
            Leave anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { ConfirmDialog, confirmExit };
}
