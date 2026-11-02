import { Crown } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type PremiumFeatureName = "Create Quiz" | "Custom Play" | "Untimed Mode";

const FEATURE_DESCRIPTIONS: Record<PremiumFeatureName, string> = {
  "Create Quiz": "Create and share quiz games for friends or other players.",
  "Custom Play": "Choose game settings that match the challenge you want.",
  "Untimed Mode": "Play supported games without a timer.",
};

interface PremiumFeaturePromptProps {
  feature: PremiumFeatureName | null;
  onOpenChange: (open: boolean) => void;
}

export function PremiumFeaturePrompt({ feature, onOpenChange }: PremiumFeaturePromptProps) {
  return (
    <Dialog open={feature !== null} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-premium-feature">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            Premium feature
          </DialogTitle>
          <DialogDescription>
            {feature && (
              <>
                <strong>{feature}</strong> is available to Premium members.{" "}
                {FEATURE_DESCRIPTIONS[feature]} Become a Premium member to unlock it.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-dismiss-premium-prompt">
            Maybe later
          </Button>
          <Button asChild>
            <Link href="/pricing">Explore Premium</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
