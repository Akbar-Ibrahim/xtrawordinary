import { motion, AnimatePresence } from "framer-motion";
import { Flame } from "lucide-react";

interface StreakIndicatorProps {
  streak: number;
  className?: string;
}

export function StreakIndicator({ streak, className = "" }: StreakIndicatorProps) {
  return (
    <AnimatePresence>
      {streak > 1 && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 20 }}
          className={`flex items-center gap-1 ${className}`}
          data-testid="streak-indicator"
        >
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
          >
            <Flame className="h-4 w-4 text-orange-500" />
          </motion.div>
          <span className="text-sm font-semibold text-orange-500" data-testid="text-streak-count">
            {streak}x
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
