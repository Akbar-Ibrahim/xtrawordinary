import { ArrowRight, ArrowUpRight, BookOpenText } from "lucide-react";
import { Link } from "wouter";
import { PageSEO } from "@/components/page-seo";
import { Card } from "@/components/ui/card";
import { EXPLORE_GAMES } from "@/lib/explore-games";

function LetterTile({ title, featured = false }: { title: string; featured?: boolean }) {
  const letters = title.replace(/[^a-z]/gi, "").slice(0, featured ? 3 : 2).toUpperCase();

  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-2xl font-mono font-bold tracking-tight ${
        featured
          ? "h-[92px] w-[108px] bg-[#f2b84b] text-[#402d1b] text-3xl shadow-[inset_0_-4px_0_rgba(64,45,27,0.12)]"
          : "h-14 w-14 bg-[#f3e8d7] text-[#765e45] text-lg dark:bg-[#343229] dark:text-[#e7c27f]"
      }`}
    >
      {letters}
    </div>
  );
}

export default function ExploreDirectory() {
  const [featuredGame, ...otherGames] = EXPLORE_GAMES;

  return (
    <div className="relative isolate min-h-[70dvh] overflow-hidden bg-[#f8f5ed] text-[#282c28] dark:bg-[#171916] dark:text-[#f1eee5]">
      <PageSEO
        title="Explore word patterns"
        description="Explore word patterns, find dictionary answers, and keep your next game night moving."
        path="/explore"
      />

      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[430px] bg-[radial-gradient(ellipse_at_78%_12%,rgba(242,184,75,0.24),transparent_43%),linear-gradient(180deg,#f2eee3_0%,rgba(248,245,237,0)_100%)] dark:opacity-25" />

      <div className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-16 lg:px-8">
        <header className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#d8d0bf] bg-[#fbf9f3] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#75654d] dark:border-[#4a4b43] dark:bg-[#22241f] dark:text-[#d6c39a]">
            <BookOpenText size={14} aria-hidden="true" />
            The word finder’s shelf
          </div>
          <h1 className="mt-6 font-serif text-[2.65rem] font-semibold leading-[1.04] tracking-[-0.045em] text-[#242923] dark:text-[#f3efe4] sm:text-6xl">
            Explore the shape
            <br className="hidden sm:block" /> of a word.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[#686b61] dark:text-[#b0b3aa] sm:text-lg">
            A handy set of word tools for curious minds—and for that one answer everyone is debating around the table.
          </p>
          <div className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-[#78684e] dark:text-[#d6c39a]">
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#e9dfca] px-1.5 font-mono text-xs font-bold text-[#5b4b32] dark:bg-[#34342b] dark:text-[#e7c27f]">
              {EXPLORE_GAMES.length}
            </span>
            ways to look at letters
          </div>
        </header>

        {featuredGame && (
          <section aria-labelledby="explore-tools-heading" className="mt-12 sm:mt-16">
            <h2 id="explore-tools-heading" className="sr-only">Explore word tools</h2>
            <div className="grid gap-4 lg:grid-cols-12">
              <Link
                href={featuredGame.path}
                aria-label={`Explore ${featuredGame.title}: ${featuredGame.description}`}
                className="group block rounded-[1.6rem] outline-none focus-visible:ring-4 focus-visible:ring-[#c58831]/40 dark:focus-visible:ring-[#f2b84b]/40 lg:col-span-7"
              >
                <Card className="relative flex h-full min-h-[240px] flex-col justify-between overflow-hidden rounded-[1.6rem] border-[#e3d7c2] bg-[#fffdf7] p-6 shadow-[0_14px_40px_rgba(73,57,32,0.07)] transition-transform duration-200 group-hover:-translate-y-1 group-focus-visible:-translate-y-1 dark:border-[#4a4b43] dark:bg-[#22231e] dark:shadow-[0_14px_40px_rgba(0,0,0,0.22)] sm:p-8">
                  <div aria-hidden="true" className="absolute -right-10 -top-14 h-56 w-56 rounded-full border-[1px] border-[#eee4d2] dark:border-[#3b3a31] sm:h-64 sm:w-64" />
                  <div aria-hidden="true" className="absolute -right-2 top-2 h-40 w-40 rounded-full border-[1px] border-[#f1e7d5] dark:border-[#3b3a31] sm:h-48 sm:w-48" />
                  <div className="relative flex items-start justify-between gap-5">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#a27b3f] dark:text-[#d6ad63]">Start exploring</p>
                      <h3 className="mt-3 font-serif text-3xl font-semibold tracking-[-0.03em] text-[#292c26] dark:text-[#f1eee5] sm:text-4xl">
                        {featuredGame.title}
                      </h3>
                      <p className="mt-3 max-w-md text-sm leading-6 text-[#707166] dark:text-[#b0b3aa] sm:text-base">
                        {featuredGame.description}
                      </p>
                    </div>
                    <LetterTile title={featuredGame.title} featured />
                  </div>
                  <div className="relative mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#72522c] dark:text-[#e7c27f]">
                    Open tool
                    <ArrowRight size={16} aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1" />
                  </div>
                </Card>
              </Link>

              <div className="grid gap-4 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
                {otherGames.slice(0, 2).map((game, index) => (
                  <ToolCard key={game.gameSlug} game={game} number={index + 2} />
                ))}
              </div>
            </div>

            {otherGames.length > 2 && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {otherGames.slice(2).map((game, index) => (
                  <ToolCard key={game.gameSlug} game={game} number={index + 4} />
                ))}
              </div>
            )}
          </section>
        )}

        <footer className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-[#e4ddcf] pt-5 text-sm text-[#77776c] dark:border-[#3d3f38] dark:text-[#b0b3aa] sm:flex-row sm:items-center">
          <p>Made for trying things, settling things, and finding one more word.</p>
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-[#9a8d76] dark:text-[#9e9c91]">Pick a pattern. Follow it.</p>
        </footer>
      </div>
    </div>
  );
}

function ToolCard({ game, number }: { game: (typeof EXPLORE_GAMES)[number]; number: number }) {
  return (
    <Link
      href={game.path}
      aria-label={`Explore ${game.title}: ${game.description}`}
      className="group block rounded-[1.35rem] outline-none focus-visible:ring-4 focus-visible:ring-[#c58831]/40 dark:focus-visible:ring-[#f2b84b]/40"
    >
      <Card className="flex h-full min-h-[166px] flex-col justify-between rounded-[1.35rem] border-[#e5dece] bg-[#fcfaf5] p-5 shadow-[0_5px_18px_rgba(73,57,32,0.035)] transition-transform duration-200 group-hover:-translate-y-1 group-focus-visible:-translate-y-1 dark:border-[#42443c] dark:bg-[#20221e] dark:shadow-[0_5px_18px_rgba(0,0,0,0.2)] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <LetterTile title={game.title} />
            <div className="min-w-0 pt-1">
              <p className="font-mono text-[10px] font-semibold tracking-[0.15em] text-[#a28d6b] dark:text-[#b7a57f]">
                TOOL {String(number).padStart(2, "0")}
              </p>
              <h3 className="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-[#30332d] dark:text-[#f1eee5]">{game.title}</h3>
            </div>
          </div>
          <ArrowUpRight
            size={17}
            aria-hidden="true"
            className="mt-1 shrink-0 text-[#a28d6b] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 dark:text-[#b7a57f]"
          />
        </div>
        <p className="mt-5 text-sm leading-6 text-[#73746b] dark:text-[#b0b3aa]">{game.description}</p>
      </Card>
    </Link>
  );
}
