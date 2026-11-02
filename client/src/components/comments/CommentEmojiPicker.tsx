import { useState } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ALL_COMMENT_EMOJIS,
  POPULAR_COMMENT_EMOJIS,
  searchCommentEmojis,
} from "@/components/comments/comment-emoji-data";

interface CommentEmojiPickerProps {
  onSelect: (emoji: string) => void;
}

export function CommentEmojiPicker({ onSelect }: CommentEmojiPickerProps) {
  const [search, setSearch] = useState("");
  const [browseAll, setBrowseAll] = useState(false);
  const normalizedSearch = search.trim();
  const emojis = normalizedSearch
    ? searchCommentEmojis(normalizedSearch)
    : browseAll ? ALL_COMMENT_EMOJIS : POPULAR_COMMENT_EMOJIS;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Add emoji"
          title="Add emoji"
          data-testid="button-open-comment-emoji-picker"
        >
          <Smile aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 max-w-[calc(100vw-2rem)] space-y-2 p-2" aria-label="Choose an emoji">
        <Input
          type="search"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search all emoji"
          aria-label="Search all emoji"
          data-testid="input-search-comment-emoji"
        />
        <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span aria-live="polite">
            {normalizedSearch
              ? `${emojis.length} ${emojis.length === 1 ? "result" : "results"}`
              : browseAll ? `${ALL_COMMENT_EMOJIS.length} emoji` : `${POPULAR_COMMENT_EMOJIS.length} popular emoji`}
          </span>
          {!normalizedSearch && (
            <button
              type="button"
              className="rounded-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-pressed={browseAll}
              onClick={() => setBrowseAll(value => !value)}
              data-testid="button-browse-all-comment-emoji"
            >
              {browseAll ? "Show popular" : "Browse all"}
            </button>
          )}
        </div>
        {emojis.length > 0 ? (
          <div className="grid max-h-[60vh] grid-cols-5 gap-1 overflow-y-auto" aria-label="Emoji results">
            {emojis.map(({ emoji, label }) => (
              <button
                key={emoji}
                type="button"
                className="min-h-11 min-w-11 rounded-md p-1 text-2xl leading-none hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={label}
                title={label}
                onClick={() => onSelect(emoji)}
                data-testid={`button-comment-emoji-${label.toLowerCase().replaceAll(" ", "-")}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : (
          <p className="px-1 py-3 text-center text-sm text-muted-foreground" data-testid="text-no-comment-emoji-results">
            No emoji found. Try another search.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
