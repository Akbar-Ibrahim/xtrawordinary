import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { PageSEO } from "@/components/page-seo";
import { AnagramResults } from "./components/AnagramResults";
import { BaseWordPicker } from "./components/BaseWordPicker";
import type { GameSlug } from "./types";
import "../word-maker-explore/styles.css";

const GAME_COPY: Record<GameSlug, { name: string; description: string }> = {
  "anagram-solver": {
    name: "Anagram Solver",
    description: "Explore dictionary words with the exact same letters.",
  },
};

function AnagramExplorePage({ gameSlug }: { gameSlug: GameSlug }) {
  const game = GAME_COPY[gameSlug];
  const [selectedBase, setSelectedBase] = useState("");

  function selectBase(baseWord: string) {
    setSelectedBase(baseWord);
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
              Explore exact-letter anagrams and dictionary matches. This reference can also be useful when hosting a word game in person or over a call.
            </p>
          </div>
        </header>

        <div className="wmx-workspace">
          <BaseWordPicker
            selectedBase={selectedBase}
            onSelectBase={selectBase}
          />
          <main className="wmx-main">
            <AnagramResults
              selectedBase={selectedBase}
            />
          </main>
        </div>
      </div>
    </div>
  );
}

export function AnagramSolverExplore() {
  return <AnagramExplorePage gameSlug="anagram-solver" />;
}
