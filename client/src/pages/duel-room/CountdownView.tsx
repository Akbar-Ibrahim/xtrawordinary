import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

interface CountdownViewProps {
  countdownNum: number | null;
  variationLabel: string | null;
}

export function CountdownView({ countdownNum, variationLabel }: CountdownViewProps) {
  return (
    <motion.div key="countdown" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Card>
        <CardContent className="py-24 text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={countdownNum ?? "go"}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <p className="text-9xl font-black text-primary" data-testid="text-countdown">
                {countdownNum ?? "GO!"}
              </p>
            </motion.div>
          </AnimatePresence>
          {variationLabel && (
            <div className="flex justify-center mt-6">
              <Badge variant="outline" className="text-xs gap-1.5 border-primary/40 text-primary" data-testid="badge-variation-countdown">
                Variation: {variationLabel}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
