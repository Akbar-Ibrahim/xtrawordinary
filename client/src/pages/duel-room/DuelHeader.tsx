import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Swords, Eye, Volume2, VolumeX } from "lucide-react";

interface DuelHeaderProps {
  roomInfo: { gameSlug: string } | undefined;
  roomCode: string;
  isRace: boolean;
  raceTarget: number;
  isSpectator: boolean;
  spectatorCount: number;
  duelMuted: boolean;
  setDuelMuted: (updater: (m: boolean) => boolean) => void;
  volume: number;
  setVolume: (v: number) => void;
}

export function DuelHeader({
  roomInfo,
  roomCode,
  isRace,
  raceTarget,
  isSpectator,
  spectatorCount,
  duelMuted,
  setDuelMuted,
  volume,
  setVolume,
}: DuelHeaderProps) {
  return (
    <>
      <Link href="/friends">
        <Button variant="ghost" className="gap-2 mb-6" data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
          Back to Friends
        </Button>
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <Swords className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">
          {roomInfo
            ? `${roomInfo.gameSlug.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")} ${isRace ? "Race" : "Duel"}`
            : "Duel"}
        </h1>
        {roomCode && (
          <Badge variant="outline" className="font-mono text-xs ml-auto" data-testid="text-room-code">
            {roomCode}
          </Badge>
        )}
        {isRace && (
          <Badge variant="secondary" className="text-xs gap-1" data-testid="badge-race-format">
            ⚡ Race to {raceTarget}
          </Badge>
        )}
        {isSpectator && (
          <Badge className="text-xs gap-1 bg-violet-600 text-white" data-testid="badge-spectating">
            <Eye className="h-3 w-3" /> Watching
          </Badge>
        )}
        {!isSpectator && spectatorCount > 0 && (
          <Badge variant="outline" className="text-xs gap-1 text-violet-600 border-violet-300 dark:border-violet-700" data-testid="badge-spectator-count">
            <Eye className="h-3 w-3" /> {spectatorCount} watching
          </Badge>
        )}
        <div className="flex items-center gap-1.5 ml-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDuelMuted((m) => !m)}
            title={duelMuted ? "Unmute duel sounds" : "Mute duel sounds"}
            aria-label={duelMuted ? "Unmute duel sounds" : "Mute duel sounds"}
            data-testid="button-toggle-sound"
            className="h-8 w-8"
          >
            {duelMuted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
          </Button>
          {!duelMuted && (
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-16 h-1.5 accent-primary cursor-pointer"
              title={`Volume: ${Math.round(volume * 100)}%`}
              aria-label={`Volume: ${Math.round(volume * 100)}%`}
              data-testid="input-volume"
            />
          )}
        </div>
      </div>
    </>
  );
}
