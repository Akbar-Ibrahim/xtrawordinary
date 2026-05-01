import { useState } from "react";
import { Crown, Sparkles, Gamepad2, Sliders, Star, ChevronRight, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const PERKS = [
  {
    icon: Gamepad2,
    label: "Custom Play on 5 games",
    description: "Practice Letter Hunt, Letter Frequency, Position Master, Letter Balance, and Length Challenge with your own settings.",
  },
  {
    icon: Sliders,
    label: "Full control over every variant",
    description: "Pin a specific letter, pick a challenge level, or choose a word length — the game plays exactly how you configure it.",
  },
  {
    icon: Star,
    label: "No leaderboard pressure",
    description: "Custom Play scores are never saved, so you can experiment and practice freely without affecting your rank.",
  },
  {
    icon: ChevronRight,
    label: "More features coming soon",
    description: "Premium is growing — expect additional perks as the platform expands.",
  },
];

interface PremiumBannerProps {
  variant?: "banner" | "nav" | "card";
}

export function PremiumBanner({ variant = "banner" }: PremiumBannerProps) {
  const { user, isAuthenticated, refreshUser } = useAuth();
  const { toast } = useToast();
  const [authOpen, setAuthOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  if (isAuthenticated && user?.isPremium) return null;

  function openModal() {
    setModalOpen(true);
  }

  async function handleUpgrade() {
    if (!isAuthenticated) {
      setAuthOpen(true);
      return;
    }
    setUpgrading(true);
    try {
      await apiRequest("POST", "/api/users/me/upgrade-premium");
      await refreshUser();
      setModalOpen(false);
      toast({ title: "You're now Premium!", description: "Enjoy Custom Play and all premium features." });
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setUpgrading(false);
    }
  }

  const perksModal = (
    <>
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-premium-perks">
          <DialogHeader>
            <div className="flex justify-center mb-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
                <Crown className="h-7 w-7 text-amber-500" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl">Unlock Premium</DialogTitle>
            <p className="text-center text-sm text-muted-foreground pt-1">
              Everything included with your Premium membership.
            </p>
          </DialogHeader>

          <ul className="space-y-3 my-2">
            {PERKS.map(({ icon: Icon, label, description }) => (
              <li key={label} className="flex gap-3 items-start">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50 mt-0.5">
                  <Icon className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-snug">{label}</p>
                  <p className="text-xs text-muted-foreground leading-snug mt-0.5">{description}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-white border-0"
              onClick={handleUpgrade}
              disabled={upgrading}
              data-testid="button-confirm-upgrade"
            >
              <Crown className="h-4 w-4" />
              {upgrading ? "Upgrading…" : isAuthenticated ? "Go Premium — it's free for now!" : "Sign in to Go Premium"}
            </Button>
            <button
              className="text-xs text-muted-foreground hover:text-foreground text-center py-1 transition-colors"
              onClick={() => setModalOpen(false)}
              data-testid="button-dismiss-premium"
            >
              Maybe later
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </>
  );

  if (variant === "nav") {
    return (
      <>
        <Button
          size="sm"
          onClick={openModal}
          className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white border-0"
          data-testid="button-go-premium-nav"
        >
          <Crown className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Go Premium</span>
        </Button>
        {perksModal}
      </>
    );
  }

  if (variant === "card") {
    return (
      <>
        <Card
          className="hover-elevate cursor-pointer border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 h-full"
          onClick={openModal}
          data-testid="card-go-premium"
        >
          <CardContent className="p-4 flex items-center gap-3 h-full">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-amber-100 dark:bg-amber-900/50">
              <Crown className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-amber-900 dark:text-amber-200">Go Premium</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-snug">Custom Play &amp; more perks</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-amber-500" />
          </CardContent>
        </Card>
        {perksModal}
      </>
    );
  }

  return (
    <>
      <div
        className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 flex items-center justify-between gap-4 cursor-pointer hover:border-amber-300 dark:hover:border-amber-700 transition-colors"
        onClick={openModal}
        data-testid="banner-premium"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
            <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Go Premium</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 truncate">Custom Play, full variant control, no leaderboard pressure.</p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={(e) => { e.stopPropagation(); openModal(); }}
          className="shrink-0 gap-1.5 bg-amber-500 hover:bg-amber-600 text-white border-0"
          data-testid="button-go-premium-banner"
        >
          <Crown className="h-3.5 w-3.5" />
          See what's included
        </Button>
      </div>
      {perksModal}
    </>
  );
}
