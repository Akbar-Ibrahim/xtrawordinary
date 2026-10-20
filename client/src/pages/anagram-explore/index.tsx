import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { PageSEO } from "@/components/page-seo";
import { AnagramResults } from "./components/AnagramResults";
import { BaseWordPicker } from "./components/BaseWordPicker";
import { HostAnswerDesk } from "./components/HostAnswerDesk";
import type { GameSlug } from "./types";
import "../word-maker-explore/styles.css";

const GAME_COPY: Record<GameSlug, { name: string; description: string }> = {
  "anagram-solver": {
    name: "Anagram Solver",
    description: "Browse exact-letter anagrams or check spoken answers at game night.",
  },
};

function AnagramExplorePage({ gameSlug }: { gameSlug: GameSlug }) {
  const game = GAME_COPY[gameSlug];
  const [mode, setMode] = useState<"browse" | "host">("browse");
  const [selectedBase, setSelectedBase] = useState("");
  const [revealed, setRevealed] = useState(false);

  function selectBase(baseWord: string) {
    setSelectedBase(baseWord);
    setRevealed(false);
  }

  return (
    <div className="wmx-page">
      <PageSEO
        title={`Explore ${game.name}`}
        description={game.description}
        path={`/explore/${gameSlug}`}
      />
      <div className="wmx-shell">
        <Link href={`/game/${gameSlug}`} className="wmx-back">
          <ArrowLeft size={16} aria-hidden="true" /> Back to {game.name}
        </Link>
        <header className="wmx-hero">
          <div>
            <div className="wmx-eyebrow">{game.name} · Explore</div>
            <h1 className="wmx-heading">Find every<br /><em>letter match.</em></h1>
            <p className="wmx-intro">
              Browse exact-letter anagrams, or use the list to check friends’ spoken answers at game night.
            </p>
          </div>
        </header>

        <div className="wmx-workspace">
          <BaseWordPicker
            selectedBase={selectedBase}
            onSelectBase={selectBase}
            mode={mode}
            onModeChange={setMode}
          />
          <main className="wmx-main">
            {mode === "host" && selectedBase && (
              <HostAnswerDesk key={selectedBase} baseWord={selectedBase} />
            )}
            <AnagramResults
              selectedBase={selectedBase}
              mode={mode}
              revealed={revealed}
              onReveal={setRevealed}
            />
            {mode === "host" && (
              <p className="wmx-note" style={{ textAlign: "center" }}>
                Keep this screen with the host. Players answer aloud; use the checker for verification and handle scorekeeping yourself.
              </p>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

export function AnagramSolverExplore() {
  return <AnagramExplorePage gameSlug="anagram-solver" />;
}
