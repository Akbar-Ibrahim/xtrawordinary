import { BookOpenText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DailyChallengeInstructionsProps {
  rules: string[];
}

export function DailyChallengeInstructions({ rules }: DailyChallengeInstructionsProps) {
  return (
    <Card className="mb-5" data-testid="daily-challenge-instructions">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpenText className="h-4 w-4 text-primary" aria-hidden="true" />
          How to Play
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rules.length > 0 ? (
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {rules.map((rule, index) => (
              <li key={`${index}-${rule}`}>{rule}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Follow the challenge shown in the game and submit valid answers before time runs out.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
