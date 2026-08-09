import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Timer, Flame, Fingerprint, Shuffle, Lock } from "lucide-react";
import { type Challenge, CHALLENGE_CONFIG, SURVIVAL_TIME_OPTIONS } from "./no-repeats-helpers";

interface NoRepeatsMenuProps {
  isSurvival: boolean;
  setIsSurvival: (v: boolean) => void;
  survivalTime: number;
  setSurvivalTime: (v: number) => void;
  isUntimed?: boolean;
  onStartGame: (c: Challenge) => void;
  playMode: "free" | "restricted";
  onPlayModeChange: (m: "free" | "restricted") => void;
  showModeToggle: boolean;
}

export function NoRepeatsMenu({
  isSurvival,
  setIsSurvival,
  survivalTime,
  setSurvivalTime,
  isUntimed,
  onStartGame,
  playMode,
  onPlayModeChange,
  showModeToggle,
}: NoRepeatsMenuProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Fingerprint className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">Choose Your Challenge</h2>
            <p className="text-muted-foreground text-sm">
              {playMode === "free"
                ? "Find isogram words — every letter must be unique, no restrictions!"
                : <>Find isogram words — no repeated letters — that also contain{" "}<strong>required letters</strong>!</>}
            </p>

            {showModeToggle && (
              <div className="flex items-center justify-center gap-2 pt-1">
                <Button
                  variant={playMode === "free" ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPlayModeChange("free")}
                  className="gap-1.5"
                  data-testid="button-play-mode-free"
                >
                  <Shuffle className="h-3.5 w-3.5" />
                  Free Form
                </Button>
                <Button
                  variant={playMode === "restricted" ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPlayModeChange("restricted")}
                  className="gap-1.5"
                  data-testid="button-play-mode-restricted"
                >
                  <Lock className="h-3.5 w-3.5" />
                  Required Letters
                </Button>
              </div>
            )}

            {isUntimed ? (
              <Badge
                variant="outline"
                className="gap-1 text-blue-600 border-blue-400 text-xs"
                data-testid="badge-untimed-menu"
              >
                ∞ Untimed Mode — no timer pressure!
              </Badge>
            ) : (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button
                  variant={!isSurvival ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsSurvival(false)}
                  className="gap-1.5"
                  data-testid="button-mode-classic"
                >
                  <Timer className="h-3.5 w-3.5" />
                  Classic
                </Button>
                <Button
                  variant={isSurvival ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsSurvival(true)}
                  className="gap-1.5"
                  data-testid="button-mode-survival"
                >
                  <Flame className="h-3.5 w-3.5" />
                  {isSurvival ? `Survival (${survivalTime}s/word)` : "Survival"}
                </Button>
              </div>
            )}

            {!isUntimed && isSurvival && (
              <>
                <div className="flex items-center justify-center gap-2 pt-1">
                  {SURVIVAL_TIME_OPTIONS.map((opt) => (
                    <Button
                      key={opt.seconds}
                      variant={survivalTime === opt.seconds ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSurvivalTime(opt.seconds)}
                      data-testid={`button-survival-time-${opt.label.toLowerCase()}`}
                    >
                      {opt.label} ({opt.seconds}s)
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {survivalTime}s per word — timer resets on each correct answer!
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {([3, 4, 5, 6, 7, 8, 9] as Challenge[]).map((c) => {
          const config = CHALLENGE_CONFIG[c];
          return (
            <Card
              key={c}
              className="hover-elevate cursor-pointer"
              onClick={() => onStartGame(c)}
              data-testid={`card-challenge-${c}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                    <span
                      className="text-lg font-bold text-primary"
                      data-testid={`text-challenge-number-${c}`}
                    >
                      {c}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold" data-testid={`text-challenge-name-${c}`}>
                      {config.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">{config.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
