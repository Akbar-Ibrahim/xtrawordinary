import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Swords, Volume2, VolumeX } from "lucide-react";
import type { DuelClientMessage } from "@shared/duel-protocol";
import { REACT_EMOJIS, type SpectatorState } from "./types";

interface SpectatorPlayingViewProps {
  spectatorData: SpectatorState;
  reactionFlash: string | null;
  duelMuted: boolean;
  setDuelMuted: (updater: (m: boolean) => boolean) => void;
  sendWs: (msg: DuelClientMessage) => void;
}

export function SpectatorPlayingView({
  spectatorData,
  reactionFlash,
  duelMuted,
  setDuelMuted,
  sendWs,
}: SpectatorPlayingViewProps) {
  return (
    <motion.div key="spectating" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <div className="space-y-4">
        {/* Players scoreboard */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-center text-muted-foreground uppercase tracking-widest mb-4 font-medium">
              Live Match · {spectatorData.gameSlug.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
              {" "}· {spectatorData.format === "race" ? "Race" : "Turn-Based"}
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { id: spectatorData.player1Id, name: spectatorData.player1Name, avatar: spectatorData.player1AvatarUrl, count: spectatorData.count1, lives: spectatorData.lives1 },
                { id: spectatorData.player2Id, name: spectatorData.player2Name, avatar: spectatorData.player2AvatarUrl, count: spectatorData.count2, lives: spectatorData.lives2 },
              ].map((p) => (
                <div key={p.id} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-muted/40 border">
                  <UserAvatar name={p.name} avatarUrl={p.avatar} className="h-14 w-14 text-lg" />
                  <p className="font-semibold text-sm text-center truncate max-w-full">{p.name}</p>
                  <div className="text-center">
                    <p className="text-3xl font-black text-primary">{p.count}</p>
                    <p className="text-xs text-muted-foreground">
                      {spectatorData.format === "race" ? `/ ${spectatorData.raceTarget} words` : "words played"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Reaction flash overlay */}
        <AnimatePresence>
          {reactionFlash && (
            <motion.div
              key={reactionFlash + Date.now()}
              className="fixed inset-0 pointer-events-none flex items-center justify-center z-50"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.6 }}
              transition={{ duration: 0.5 }}
            >
              <span className="text-8xl drop-shadow-xl">{reactionFlash}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Emoji reaction bar + spectator mute */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground">React to the match</p>
              <button
                onClick={() => setDuelMuted((m) => !m)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-spectator-mute"
                title={duelMuted ? "Unmute sounds" : "Mute sounds"}
              >
                {duelMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                {duelMuted ? "Unmute" : "Mute"}
              </button>
            </div>
            <div className="flex justify-center gap-3">
              {REACT_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => sendWs({ type: "spectator:react", emoji })}
                  className="text-2xl hover:scale-125 active:scale-95 transition-transform duration-150 focus:outline-none"
                  data-testid={`button-react-${emoji}`}
                  title={`React ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}

export function SpectatorGameOverView({ spectatorWinner }: { spectatorWinner: string | null }) {
  return (
    <motion.div key="spectator-over" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
      <Card className="border-violet-400">
        <CardContent className="py-12 text-center space-y-5">
          <Trophy className="h-14 w-14 mx-auto text-yellow-500" />
          <div>
            <h2 className="text-3xl font-black" data-testid="text-spectator-outcome">
              {spectatorWinner ? `${spectatorWinner} wins! 🎉` : "It's a Draw!"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">The match has ended</p>
          </div>
          <Link href="/duels">
            <Button className="gap-2" data-testid="button-back-lobby">
              <Swords className="h-4 w-4" />
              Back to Duels
            </Button>
          </Link>
        </CardContent>
      </Card>
    </motion.div>
  );
}
