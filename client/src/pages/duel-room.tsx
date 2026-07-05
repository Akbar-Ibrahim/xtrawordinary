import { useRoute } from "wouter";
import { Swords } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { DuelTurnEngine } from "@/components/duel-turn-engine";
import { DuelRaceEngine } from "@/components/duel-race-engine";
import { formatDuelVariation } from "@/lib/duel-variation";
import { getAdapterForSlug } from "./duel-room/adapters";
import { useDuelRoom } from "./duel-room/useDuelRoom";
import { DuelHeader } from "./duel-room/DuelHeader";
import { ConnectingView, DuelErrorView, ReconnectBanner } from "./duel-room/StatusViews";
import { WaitingRoomView } from "./duel-room/WaitingRoomView";
import { CountdownView } from "./duel-room/CountdownView";
import { SpectatorPlayingView, SpectatorGameOverView } from "./duel-room/SpectatorViews";
import { GameOverView } from "./duel-room/GameOverView";

export default function DuelRoom() {
  const [, params] = useRoute("/duel/:roomCode");
  const roomCode = (params?.roomCode ?? "").toUpperCase();
  const duel = useDuelRoom(roomCode);
  const {
    user,
    isAuthenticated,
    volume,
    setVolume,
    duelMuted,
    setDuelMuted,
    opponentDisconnected,
    phase,
    errorMsg,
    opponentId,
    opponentName,
    opponentAvatarUrl,
    roomFormat,
    raceTarget,
    raceTimeLimitMs,
    meReady,
    opponentReady,
    countdownNum,
    engineKey,
    engineInitState,
    raceEngineKey,
    raceInitState,
    gameResult,
    rematchPending,
    latestGameMessage,
    isSpectator,
    spectatorCount,
    spectatorData,
    spectatorWinner,
    reactionFlash,
    roomInfo,
    sendWs,
    handleReady,
    handleGameOver,
    handleRematch,
  } = duel;

  // ── Not authenticated ──────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Swords className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Sign in to join a duel.</p>
      </div>
    );
  }

  const adapter = getAdapterForSlug(roomInfo?.gameSlug ?? "word-chain");
  const startWord = roomInfo?.startWord ?? "";
  const isRace = roomFormat === "race";
  const variationLabel = roomInfo ? formatDuelVariation(roomInfo.gameSlug, roomInfo.startWord) : null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <DuelHeader
        roomInfo={roomInfo}
        roomCode={roomCode}
        isRace={isRace}
        raceTarget={raceTarget}
        isSpectator={isSpectator}
        spectatorCount={spectatorCount}
        duelMuted={duelMuted}
        setDuelMuted={setDuelMuted}
        volume={volume}
        setVolume={setVolume}
      />

      <AnimatePresence mode="wait">
        {/* ── Connecting / Lobby ─────────────────────────────────────────── */}
        {(phase === "connecting" || phase === "lobby") && <ConnectingView />}

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {phase === "error" && <DuelErrorView errorMsg={errorMsg} />}

        {/* ── Waiting Room ──────────────────────────────────────────────── */}
        {phase === "waiting" && (
          <WaitingRoomView
            isRace={isRace}
            raceTarget={raceTarget}
            variationLabel={variationLabel}
            user={user}
            meReady={meReady}
            opponentName={opponentName}
            opponentAvatarUrl={opponentAvatarUrl}
            opponentReady={opponentReady}
            handleReady={handleReady}
          />
        )}

        {/* ── Countdown ─────────────────────────────────────────────────── */}
        {phase === "countdown" && (
          <CountdownView countdownNum={countdownNum} variationLabel={variationLabel} />
        )}

        {/* ── Reconnect Banner ──────────────────────────────────────────── */}
        {phase === "playing" && opponentDisconnected && <ReconnectBanner />}

        {/* ── Playing (Turn) ─────────────────────────────────────────────── */}
        {phase === "playing" && !isRace && engineInitState && (
          <DuelTurnEngine
            key={engineKey}
            userId={user?.id ?? 0}
            opponentId={opponentId}
            opponentName={opponentName}
            opponentAvatarUrl={opponentAvatarUrl}
            myName={user?.name ?? "You"}
            myAvatarUrl={user?.avatarUrl ?? null}
            initialState={engineInitState}
            sendWs={sendWs}
            latestMessage={latestGameMessage}
            onGameOver={handleGameOver}
            adapter={adapter}
            variationLabel={variationLabel}
          />
        )}

        {/* ── Spectator View ─────────────────────────────────────────────── */}
        {phase === "playing" && isSpectator && spectatorData && (
          <SpectatorPlayingView
            spectatorData={spectatorData}
            reactionFlash={reactionFlash}
            duelMuted={duelMuted}
            setDuelMuted={setDuelMuted}
            sendWs={sendWs}
          />
        )}

        {/* ── Playing (Race) ─────────────────────────────────────────────── */}
        {phase === "playing" && isRace && raceInitState && (
          <DuelRaceEngine
            key={raceEngineKey}
            userId={user?.id ?? 0}
            opponentId={opponentId}
            opponentName={opponentName}
            opponentAvatarUrl={opponentAvatarUrl}
            myName={user?.name ?? "You"}
            myAvatarUrl={user?.avatarUrl ?? null}
            raceTarget={raceTarget}
            initialState={raceInitState}
            sendWs={sendWs}
            latestMessage={latestGameMessage}
            onGameOver={handleGameOver}
            adapter={adapter}
            startWord={startWord}
          />
        )}

        {/* ── Spectator Game Over ───────────────────────────────────────── */}
        {phase === "over" && isSpectator && (
          <SpectatorGameOverView spectatorWinner={spectatorWinner} />
        )}

        {/* ── Game Over ─────────────────────────────────────────────────── */}
        {phase === "over" && !isSpectator && gameResult && (
          <GameOverView
            gameResult={gameResult}
            isRace={isRace}
            raceTarget={raceTarget}
            user={user}
            opponentName={opponentName}
            opponentId={opponentId}
            rematchPending={rematchPending}
            handleRematch={handleRematch}
            gameSlug={roomInfo?.gameSlug ?? "word-chain"}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
