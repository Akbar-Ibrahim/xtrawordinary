import { Loader2 } from "lucide-react";

export function AuthLoadingState() {
  return (
    <div
      className="container mx-auto flex items-center justify-center px-4 py-16"
      role="status"
      aria-label="Checking your session"
      data-testid="auth-loading-state"
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
    </div>
  );
}