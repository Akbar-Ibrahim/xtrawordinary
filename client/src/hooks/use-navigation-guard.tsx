import { useState, useEffect, useCallback, useRef } from "react";
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
  const dummyPushedRef = useRef(false);
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  });

  // beforeunload: native browser prompt on refresh / tab close
  useEffect(() => {
    if (!active) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);

  // popstate: intercept browser back / forward button while playing
  useEffect(() => {
    if (!active) return;

    // Push one dummy entry (same URL) to absorb the first back press.
    window.history.pushState(null, "", window.location.href);
    dummyPushedRef.current = true;

    const handlePopState = () => {
      // The dummy was consumed; user is now at the real game-page position.
      // Confirming leave calls history.back() — one step from [game] to [prev].
      dummyPushedRef.current = false;
      setOpen(true);
      setPendingConfirm(() => () => window.history.back());
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      // Remove listener first, then clean up the dummy entry.
      // Since the listener is already removed, the resulting history.back()
      // cannot re-trigger this guard (same-URL move, no visible navigation).
      window.removeEventListener("popstate", handlePopState);
      if (dummyPushedRef.current) {
        dummyPushedRef.current = false;
        window.history.back();
      }
    };
  }, [active]);

  // confirmExit: used by the in-page Exit button
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

  // All dismiss paths (Cancel button, Escape, outside-click) go through here
  // so the dummy entry is always re-pushed and the guard stays active.
  const handleCancel = useCallback(() => {
    setOpen(false);
    setPendingConfirm(null);
    if (activeRef.current && !dummyPushedRef.current) {
      window.history.pushState(null, "", window.location.href);
      dummyPushedRef.current = true;
    }
  }, []);

  const ConfirmDialog = (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleCancel();
      }}
    >
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
