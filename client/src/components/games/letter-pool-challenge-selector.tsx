import { Eye } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LETTER_POOL_DECOY_LEVELS,
  type LetterPoolDecoyCount,
} from "@shared/letter-pool";

interface LetterPoolChallengeSelectorProps {
  onSelectDecoyLevel: (decoyCount: LetterPoolDecoyCount) => void;
}

export function LetterPoolChallengeSelector({
  onSelectDecoyLevel,
}: LetterPoolChallengeSelectorProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold">Choose Your Challenge</h3>
        <p className="text-sm text-muted-foreground">
          Use the letter pool to spell the hidden word. More decoys mean a harder puzzle.
        </p>
      </div>

      <div className="grid gap-3">
        {LETTER_POOL_DECOY_LEVELS.map((level) => (
          <motion.div
            key={level.decoyCount}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              variant="outline"
              className="w-full h-auto py-4 px-6 flex items-center gap-4 text-left"
              onClick={() => onSelectDecoyLevel(level.decoyCount)}
              data-testid={`card-with-pool-${level.decoyCount}-decoy`}
            >
              <Eye className="h-6 w-6 text-primary flex-shrink-0" />
              <div className="flex flex-col items-start gap-1">
                <span className="font-semibold">
                  {level.label} · {level.difficulty}
                </span>
                <span className="text-sm text-muted-foreground font-normal">
                  Find the target among {level.decoyCount} extra letter
                  {level.decoyCount === 1 ? "" : "s"}.
                </span>
              </div>
              <Badge variant="secondary" className="ml-auto">
                {level.difficulty}
              </Badge>
            </Button>
          </motion.div>
        ))}

      </div>
    </div>
  );
}
