import { useState } from "react";
import { Crown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PremiumBannerProps {
  variant?: "banner" | "nav";
}

export function PremiumBanner({ variant = "banner" }: PremiumBannerProps) {
  const { user, isAuthenticated, refreshUser } = useAuth();
  const { toast } = useToast();
  const [authOpen, setAuthOpen] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  if (isAuthenticated && user?.isPremium) return null;

  async function handleUpgrade() {
    if (!isAuthenticated) {
      setAuthOpen(true);
      return;
    }
    setUpgrading(true);
    try {
      await apiRequest("POST", "/api/users/me/upgrade-premium");
      await refreshUser();
      toast({ title: "You're now Premium!", description: "Enjoy Custom Play and all premium features." });
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setUpgrading(false);
    }
  }

  if (variant === "nav") {
    return (
      <>
        <Button
          size="sm"
          onClick={handleUpgrade}
          disabled={upgrading}
          className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white border-0 hidden sm:flex"
          data-testid="button-go-premium-nav"
        >
          <Crown className="h-3.5 w-3.5" />
          Go Premium
        </Button>
        <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      </>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 flex items-center justify-between gap-4" data-testid="banner-premium">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
            <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Go Premium</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 truncate">Unlock Custom Play, practice any variant, no leaderboard pressure.</p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={handleUpgrade}
          disabled={upgrading}
          className="shrink-0 gap-1.5 bg-amber-500 hover:bg-amber-600 text-white border-0"
          data-testid="button-go-premium-banner"
        >
          <Crown className="h-3.5 w-3.5" />
          {upgrading ? "Upgrading…" : "Go Premium"}
        </Button>
      </div>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </>
  );
}
