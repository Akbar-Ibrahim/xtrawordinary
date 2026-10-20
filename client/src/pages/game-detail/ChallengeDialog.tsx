import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Flame, Loader2, Play, Timer } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import type { Game } from "@shared/schema";
import {
  LETTER_DODGE_VARIANTS,
  type LetterDodgeDifficulty,
} from "@shared/letter-dodge";

const LETTER_BALANCE_CATEGORIES: {
  id: string;
  name: string;
  levelType: "count" | "word length";
  levels: (number | "advanced")[];
}[] = [
  { id: "consonant_count", name: "Consonant Count", levelType: "count", levels: [2, 3, 4, 5, 6, 7, "advanced"] },
  { id: "vowel_count", name: "Vowel Count", levelType: "count", levels: [2, 3, 4, 5, 6, 7, "advanced"] },
  { id: "start_end_vowel", name: "Start & End Vowels", levelType: "word length", levels: [4, 5, 6, 7, 8, 9, 10, 11, 12, "advanced"] },
  { id: "start_end_consonant", name: "Start & End Consonants", levelType: "word length", levels: [4, 5, 6, 7, 8, 9, 10, 11, 12, "advanced"] },
  { id: "start_vowel_end_consonant", name: "Start Vowel, End Consonant", levelType: "word length", levels: [4, 5, 6, 7, 8, 9, 10, 11, 12, "advanced"] },
  { id: "start_consonant_end_vowel", name: "Start Consonant, End Vowel", levelType: "word length", levels: [4, 5, 6, 7, 8, 9, 10, 11, 12, "advanced"] },
] as const;

interface Friend {
  id: number;
  friendUser: { id: number; username: string; name: string; avatarUrl: string | null };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  game: Game;
  friends: Friend[];
  navigate: (to: string) => void;
}

export function ChallengeDialog({ open, onOpenChange, slug, game, friends, navigate }: Props) {
  const [selectedFriendId, setSelectedFriendId] = useState<string>("");
  const [selectedFriendName, setSelectedFriendName] = useState<string>("");
  const [challengeMsg, setChallengeMsg] = useState("");
  const [challengeLbMode, setChallengeLbMode] = useState<"random" | "category" | "locked">("random");
  const [challengeLbCategory, setChallengeLbCategory] = useState<string | undefined>(undefined);
  const [challengeLbLevel, setChallengeLbLevel] = useState<number | "advanced" | undefined>(undefined);
  const [challengeLbConsonantCount, setChallengeLbConsonantCount] = useState<number | undefined>(undefined);
  const [challengeSearchInput, setChallengeSearchInput] = useState("");
  const [challengeSearch, setChallengeSearch] = useState("");
  const [challengeDodgeDifficulty, setChallengeDodgeDifficulty] =
    useState<LetterDodgeDifficulty>("advanced");
  const [challengeDodgeSurvival, setChallengeDodgeSurvival] = useState(false);
  const hasCompleteLockedBalanceConfig =
    typeof challengeLbLevel === "number" &&
    typeof challengeLbConsonantCount === "number";
  const lockedBalanceConfigIncomplete =
    slug === "letter-balance" &&
    challengeLbMode === "locked" &&
    !hasCompleteLockedBalanceConfig;

  useEffect(() => {
    if (!challengeSearchInput.trim()) {
      setChallengeSearch("");
      return;
    }
    const timer = setTimeout(() => {
      setChallengeSearch(challengeSearchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [challengeSearchInput]);

  const { data: challengeUserResults = [], isFetching: challengeSearchFetching } = useQuery<{ id: number; username: string; name: string; avatarUrl: string | null }[]>({
    queryKey: ["/api/users/search", challengeSearch],
    queryFn: async () => {
      if (!challengeSearch.trim()) return [];
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(challengeSearch.trim())}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!challengeSearch.trim() && open,
    staleTime: 10000,
  });

  const handleStartChallenge = () => {
    if (!selectedFriendId) return;
    if (lockedBalanceConfigIncomplete) return;
    const seed = Math.floor(Math.random() * 1000000);
    const msgParam = challengeMsg ? `&msg=${encodeURIComponent(challengeMsg)}` : "";
    let lbParams = "";
    if (slug === "letter-balance" && challengeLbMode === "locked" && typeof challengeLbLevel === "number" && challengeLbConsonantCount !== undefined) {
      lbParams = `&lbCategory=locked_balance&lbLevel=${challengeLbLevel}&lbConsonantCount=${challengeLbConsonantCount}`;
    } else if (slug === "letter-balance" && challengeLbMode === "category" && challengeLbCategory && challengeLbLevel !== undefined) {
      lbParams = `&lbCategory=${challengeLbCategory}&lbLevel=${challengeLbLevel}`;
    }
    const dodgeParams = slug === "letter-dodge"
      ? `&dodgeDifficulty=${encodeURIComponent(String(challengeDodgeDifficulty))}&dodgeSurvival=${challengeDodgeSurvival ? "1" : "0"}`
      : "";
    const friendId = selectedFriendId;
    setSelectedFriendId("");
    setSelectedFriendName("");
    setChallengeSearchInput("");
    setChallengeSearch("");
    setChallengeMsg("");
    setChallengeLbMode("random");
    setChallengeLbCategory(undefined);
    setChallengeLbLevel(undefined);
    setChallengeLbConsonantCount(undefined);
    setChallengeDodgeDifficulty("advanced");
    setChallengeDodgeSurvival(false);
    onOpenChange(false);
    navigate(`/game/${slug}?challenge-new=${friendId}&seed=${seed}${msgParam}${lbParams}${dodgeParams}`);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedFriendId("");
      setSelectedFriendName("");
      setChallengeSearchInput("");
      setChallengeSearch("");
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Challenge a Player</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Pick a player to challenge in <strong>{game.name}</strong>. You'll play first — your score is automatically sent to them when you finish.
          </p>
          <div className="space-y-2">
            <label className="text-sm font-medium">Player</label>
            {selectedFriendId ? (
              <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
                <div className="flex items-center gap-2">
                  <UserAvatar name={selectedFriendName} avatarUrl={null} className="h-6 w-6" />
                  <span className="text-sm font-medium">{selectedFriendName}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground"
                  onClick={() => { setSelectedFriendId(""); setSelectedFriendName(""); }}
                  data-testid="button-clear-challenge-player"
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  placeholder="Search by username…"
                  value={challengeSearchInput}
                  onChange={(e) => setChallengeSearchInput(e.target.value)}
                  data-testid="input-challenge-search"
                />
                <div className="max-h-48 overflow-y-auto rounded-md border border-border divide-y divide-border">
                  {challengeSearchInput.trim() ? (
                    challengeSearchFetching ? (
                      <div className="flex items-center justify-center py-4 text-sm text-muted-foreground gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                      </div>
                    ) : challengeUserResults.length === 0 ? (
                      <div className="py-4 text-center text-sm text-muted-foreground">No players found</div>
                    ) : (
                      challengeUserResults.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60 transition-colors text-left"
                          onClick={() => { setSelectedFriendId(String(u.id)); setSelectedFriendName(`${u.name} (@${u.username})`); setChallengeSearchInput(""); setChallengeSearch(""); }}
                          data-testid={`button-select-challenge-user-${u.id}`}
                        >
                          <UserAvatar name={u.name} avatarUrl={u.avatarUrl} className="h-6 w-6" />
                          <span>{u.name}<span className="block text-xs text-muted-foreground">@{u.username}</span></span>
                        </button>
                      ))
                    )
                  ) : friends.length > 0 ? (
                    <>
                      <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/30">Friends</div>
                      {friends.map((f) => (
                        <button
                          key={f.friendUser.id}
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60 transition-colors text-left"
                          onClick={() => { setSelectedFriendId(String(f.friendUser.id)); setSelectedFriendName(`${f.friendUser.name} (@${f.friendUser.username})`); }}
                          data-testid={`button-select-challenge-friend-${f.friendUser.id}`}
                        >
                          <UserAvatar name={f.friendUser.name} avatarUrl={f.friendUser.avatarUrl} className="h-6 w-6" />
                          <span>{f.friendUser.name}<span className="block text-xs text-muted-foreground">@{f.friendUser.username}</span></span>
                        </button>
                      ))}
                    </>
                  ) : (
                    <div className="py-4 text-center text-sm text-muted-foreground">Search for a player above</div>
                  )}
                </div>
              </div>
            )}
          </div>
          {slug === "letter-dodge" && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Mode</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={!challengeDodgeSurvival ? "default" : "outline"}
                    onClick={() => setChallengeDodgeSurvival(false)}
                    data-testid="button-challenge-dodge-mode-classic"
                  >
                    <Timer className="h-3.5 w-3.5 mr-1.5" />
                    Classic
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={challengeDodgeSurvival ? "default" : "outline"}
                    onClick={() => setChallengeDodgeSurvival(true)}
                    data-testid="button-challenge-dodge-mode-survival"
                  >
                    <Flame className="h-3.5 w-3.5 mr-1.5" />
                    Survival
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Difficulty</label>
                <div className="flex flex-wrap gap-2">
                  {LETTER_DODGE_VARIANTS.map(({ difficulty, label }) => (
                    <Button
                      key={difficulty}
                      type="button"
                      size="sm"
                      variant={challengeDodgeDifficulty === difficulty ? "default" : "outline"}
                      onClick={() => setChallengeDodgeDifficulty(difficulty)}
                      data-testid={`button-challenge-dodge-difficulty-${difficulty}`}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {slug === "letter-balance" && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <label className="text-sm font-medium">Challenge type</label>
              <div className="flex gap-2">
                <Button type="button" size="sm"
                  variant={challengeLbMode === "random" ? "default" : "outline"}
                  onClick={() => { setChallengeLbMode("random"); setChallengeLbCategory(undefined); setChallengeLbLevel(undefined); setChallengeLbConsonantCount(undefined); }}
                  data-testid="button-challenge-lb-random"
                >
                  Random
                </Button>
                <Button type="button" size="sm"
                  variant={challengeLbMode === "category" ? "default" : "outline"}
                  onClick={() => { setChallengeLbMode("category"); setChallengeLbCategory(undefined); setChallengeLbLevel(undefined); setChallengeLbConsonantCount(undefined); }}
                  data-testid="button-challenge-lb-category"
                >
                  Choose Category
                </Button>
                <Button type="button" size="sm"
                  variant={challengeLbMode === "locked" ? "default" : "outline"}
                  onClick={() => { setChallengeLbMode("locked"); setChallengeLbCategory(undefined); setChallengeLbLevel(undefined); setChallengeLbConsonantCount(undefined); }}
                  data-testid="button-challenge-lb-locked"
                >
                  Locked Balance
                </Button>
              </div>
              {challengeLbMode === "category" && (
                <>
                  <div>
                    <label className="text-xs font-medium">Category</label>
                    <div className="grid grid-cols-2 gap-1.5 mt-1">
                      {LETTER_BALANCE_CATEGORIES.map(category => (
                        <Button key={category.id} type="button" size="sm"
                          className="h-auto min-h-8 justify-start whitespace-normal text-left"
                          variant={challengeLbCategory === category.id ? "default" : "outline"}
                          onClick={() => { setChallengeLbCategory(category.id); setChallengeLbLevel(undefined); }}
                          data-testid={`button-challenge-lb-cat-${category.id}`}
                        >
                          {category.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                  {challengeLbCategory && (() => {
                    const category = LETTER_BALANCE_CATEGORIES.find(item => item.id === challengeLbCategory);
                    if (!category) return null;
                    return (
                      <div>
                        <label className="text-xs font-medium">
                          Level <span className="font-normal text-muted-foreground">({category.levelType})</span>
                        </label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {category.levels.map(level => (
                            <Button key={level} type="button" size="sm"
                              variant={challengeLbLevel === level ? "default" : "outline"}
                              onClick={() => setChallengeLbLevel(level)}
                              data-testid={`button-challenge-lb-category-level-${level}`}
                            >
                              {level === "advanced" ? "Advanced" : level}
                            </Button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
              {challengeLbMode === "locked" && (
                <>
                  <div>
                    <label className="text-xs font-medium">Word length</label>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {[4,5,6,7,8,9,10].map(lv => (
                        <Button key={lv} type="button" size="sm"
                          variant={challengeLbLevel === lv ? "default" : "outline"}
                          onClick={() => { setChallengeLbLevel(lv); setChallengeLbConsonantCount(undefined); }}
                          data-testid={`button-challenge-lb-level-${lv}`}
                        >
                          {lv}
                        </Button>
                      ))}
                    </div>
                  </div>
                  {challengeLbLevel !== undefined && (
                    <div>
                      <label className="text-xs font-medium">Consonant count <span className="text-muted-foreground font-normal">(vowels = {challengeLbLevel} − count)</span></label>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {Array.from({ length: (challengeLbLevel as number) - 1 }, (_, i) => i + 1).map(c => {
                          const v = (challengeLbLevel as number) - c;
                          return (
                            <Button key={c} type="button" size="sm"
                              variant={challengeLbConsonantCount === c ? "default" : "outline"}
                              onClick={() => setChallengeLbConsonantCount(c)}
                              data-testid={`button-challenge-lb-consonant-${c}`}
                              title={`${c}C / ${v}V`}
                            >
                              {c}C/{v}V
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {challengeLbMode === "locked" && (!challengeLbLevel || !challengeLbConsonantCount) && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {!challengeLbLevel ? "Pick a word length." : "Pick a consonant count."}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          <div>
            <label className="text-sm font-medium">Message (optional)</label>
            <Input
              value={challengeMsg}
              onChange={(e) => setChallengeMsg(e.target.value)}
              placeholder="Beat this!"
              maxLength={200}
              data-testid="input-challenge-message"
            />
          </div>
          <Button
            className="w-full gap-2"
            onClick={handleStartChallenge}
            disabled={!selectedFriendId || lockedBalanceConfigIncomplete || (slug === "letter-balance" && challengeLbMode === "category" && (!challengeLbCategory || challengeLbLevel === undefined))}
            data-testid="button-start-challenge"
          >
            <Play className="h-4 w-4" />
            Play &amp; Send Challenge
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
