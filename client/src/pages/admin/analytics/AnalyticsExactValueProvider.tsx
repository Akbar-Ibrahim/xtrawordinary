import { createContext, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ExactValue = { value: string; label: string };
type ShowExactValue = (exactValue: ExactValue) => void;

export const AnalyticsExactValueContext = createContext<ShowExactValue | null>(null);

export function AnalyticsExactValueProvider({ children }: { children: ReactNode }) {
  const [exactValue, setExactValue] = useState<ExactValue | null>(null);

  return (
    <AnalyticsExactValueContext.Provider value={setExactValue}>
      {children}
      <Dialog open={exactValue !== null} onOpenChange={(open) => !open && setExactValue(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Exact value</DialogTitle>
            <DialogDescription>{exactValue?.label}</DialogDescription>
          </DialogHeader>
          <p className="text-3xl font-bold tabular-nums" data-testid="analytics-exact-value">
            {exactValue?.value}
          </p>
        </DialogContent>
      </Dialog>
    </AnalyticsExactValueContext.Provider>
  );
}
