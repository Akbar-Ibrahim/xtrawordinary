import { Crown, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";

interface PremiumBannerProps {
  variant?: "banner" | "nav" | "card";
}

export function PremiumBanner({ variant = "banner" }: PremiumBannerProps) {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  if (isAuthenticated && user?.isPremium) return null;

  function goToPricing() {
    navigate("/pricing");
  }

  if (variant === "nav") {
    return (
      <Button
        size="sm"
        onClick={goToPricing}
        className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white border-0"
        data-testid="button-go-premium-nav"
      >
        <Crown className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Go Premium</span>
      </Button>
    );
  }

  if (variant === "card") {
    return (
      <Card
        className="hover-elevate cursor-pointer border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 h-full"
        onClick={goToPricing}
        data-testid="card-go-premium"
      >
        <CardContent className="p-4 flex items-center gap-3 h-full">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-amber-500">
            <Crown className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-amber-900 dark:text-amber-200">Go Premium</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-snug">Custom Play &amp; more perks</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-amber-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 flex items-center justify-between gap-4 cursor-pointer hover:border-amber-300 dark:hover:border-amber-700 transition-colors"
      onClick={goToPricing}
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
        onClick={(e) => { e.stopPropagation(); goToPricing(); }}
        className="shrink-0 gap-1.5 bg-amber-500 hover:bg-amber-600 text-white border-0"
        data-testid="button-go-premium-banner"
      >
        <Crown className="h-3.5 w-3.5" />
        See plans
      </Button>
    </div>
  );
}
