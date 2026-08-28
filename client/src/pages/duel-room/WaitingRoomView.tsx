import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";
import { motion } from "framer-motion";
import { Heart, Loader2 } from "lucide-react";
import type { PublicUser } from "@shared/schema";

interface WaitingRoomViewProps {
  isRace: boolean;
  raceTarget: number;
  gameSlug?: string;
  variationLabel: string | null;
  user: PublicUser | null | undefined;
  meReady: boolean;
  opponentName: string;
  opponentAvatarUrl: string | null;
  opponentReady: boolean;
  handleReady: () => void;
}

export function WaitingRoomView({
  isRace,
  raceTarget,
  gameSlug,
  variationLabel,
  user,
  meReady,
  opponentName,
  opponentAvatarUrl,
  opponentReady,
  handleReady,
}: WaitingRoomViewProps) {
  return (
    <motion.div key="waiting" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <Card>
        <CardContent className="py-8 space-y-6">
          <p className="text-center text-muted-foreground text-sm font-medium uppercase tracking-wide">
            Waiting Room
          </p>
          {isRace && (
            <div className="flex justify-center">
              <Badge variant="secondary" className="text-xs gap-1.5" data-testid="badge-race-info">
                {gameSlug === "word-split"
                  ? "⚡ Timed rounds — complete each target to advance"
                  : `⚡ Race Format — first to ${raceTarget} words wins`}
              </Badge>
            </div>
          )}
          {variationLabel && (
            <div className="flex justify-center">
              <Badge variant="outline" className="text-xs gap-1.5 border-primary/40 text-primary" data-testid="badge-variation">
                Variation: {variationLabel}
              </Badge>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/50" data-testid="card-player-me">
              <UserAvatar name={user?.name ?? "You"} avatarUrl={user?.avatarUrl} className="h-14 w-14 text-lg" />
              <p className="font-semibold text-sm text-center truncate max-w-full">{user?.name ?? "You"}</p>
              {meReady
                ? <Badge className="bg-green-500 text-white text-xs" data-testid="badge-me-ready">Ready!</Badge>
                : <Badge variant="secondary" className="text-xs">Waiting…</Badge>
              }
            </div>
            <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/50" data-testid="card-player-opponent">
              {opponentName ? (
                <>
                  <UserAvatar name={opponentName} avatarUrl={opponentAvatarUrl} className="h-14 w-14 text-lg" />
                  <p className="font-semibold text-sm text-center truncate max-w-full">{opponentName}</p>
                  {opponentReady
                    ? <Badge className="bg-green-500 text-white text-xs" data-testid="badge-opponent-ready">Ready!</Badge>
                    : <Badge variant="secondary" className="text-xs" data-testid="badge-opponent-status">In Room</Badge>
                  }
                </>
              ) : (
                <>
                  <div className="h-14 w-14 rounded-full bg-muted animate-pulse" />
                  <p className="text-sm text-muted-foreground">Waiting for opponent…</p>
                </>
              )}
            </div>
          </div>
          {!meReady ? (
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white gap-2"
              onClick={handleReady}
              disabled={!opponentName}
              data-testid="button-ready"
            >
              <Heart className="h-4 w-4" />
              {opponentName ? "I'm Ready!" : "Waiting for opponent to join…"}
            </Button>
          ) : (
            <div className="text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Waiting for opponent to get ready…
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
