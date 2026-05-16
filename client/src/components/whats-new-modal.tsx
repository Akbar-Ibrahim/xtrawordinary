import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

const CHANGELOG_VERSION = "v2.5";
const SEEN_KEY = `xw_changelog_seen_${CHANGELOG_VERSION}`;

const CHANGELOG_ITEMS: Array<{ badge: string; text: string }> = [
  { badge: "New Game", text: "Word Bloom — grow a seed word one letter at a time into the longest possible chain" },
  { badge: "New Game", text: "Word Stretch — insert one letter anywhere in a word to find all valid longer forms" },
  { badge: "Feature", text: "Live play counts — leaderboard and game pages now reflect real-time play totals" },
  { badge: "Feature", text: "Guild Wars — group vs group bracket tournaments with a dedicated hall of fame" },
  { badge: "Feature", text: "Spectator mode — watch any live duel in progress by entering the room code" },
  { badge: "Improvement", text: "Personal best score and total plays shown on every game detail page" },
];

export function WhatsNewModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {}
  }, []);

  function handleClose() {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            What's New · {CHANGELOG_VERSION}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Recent updates and new features in xtraWordinary
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          {CHANGELOG_ITEMS.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <Badge variant="outline" className="shrink-0 text-xs mt-0.5 whitespace-nowrap">
                {item.badge}
              </Badge>
              <p className="text-sm text-muted-foreground leading-snug">{item.text}</p>
            </div>
          ))}
        </div>
        <Button
          onClick={handleClose}
          className="w-full mt-1"
          data-testid="button-whats-new-close"
        >
          Got it, let's play!
        </Button>
      </DialogContent>
    </Dialog>
  );
}
