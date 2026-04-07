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
  const listenerRef = useRef<(() => void) | null>(null);
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
      // history.back() on confirm will navigate one step further to [prev page].
      dummyPushedRef.current = false;
      setOpen(true);
      setPendingConfirm(() => () => window.history.back());
    };

    listenerRef.current = handlePopState;
    window.addEventListener("popstate", handlePopState);

    return () => {
      // Always remove listener before any history manipulation.
      window.removeEventListener("popstate", handlePopState);
      listenerRef.current = null;

      // Clean up the dummy entry so normal back navigation is restored.
      // Listener is already removed above, so this history.back() is safe —
      // it moves the history pointer (same URL, no visible navigation) and
      // cannot re-trigger the guard dialog.
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

  const handleCancel = useCallback(() => {
    setOpen(false);
    setPendingConfirm(null);
    // Re-establish the dummy entry so subsequent back presses are still guarded.
    if (activeRef.current && !dummyPushedRef.current) {
      window.history.pushState(null, "", window.location.href);
      dummyPushedRef.current = true;
    }
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
