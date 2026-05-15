import { DUEL_DEFINITION_CATEGORIES } from "@shared/schema";

export function formatDuelVariation(gameSlug: string, startWord: string | null | undefined): string | null {
  if (!startWord) return null;
  switch (gameSlug) {
    case "letter-hunt":
    case "letter-frequency":
      if (/^[A-Z]$/i.test(startWord)) return `Letter ${startWord.toUpperCase()}`;
      return null;
    case "word-length":
      if (/^\d+$/.test(startWord)) return `${startWord}-letter words`;
      return null;
    case "letter-position": {
      const parts = startWord.split(":");
      if (parts.length === 2 && /^[A-Z]$/i.test(parts[0]) && /^\d+$/.test(parts[1]))
        return `Letter ${parts[0].toUpperCase()} at position ${parts[1]}`;
      return null;
    }
    case "letter-balance": {
      const m = startWord.match(/^(\d+)([VC])$/i);
      if (m) {
        const count = parseInt(m[1]);
        const type = m[2].toUpperCase() === "V" ? "vowel" : "consonant";
        return `${count} ${type}${count !== 1 ? "s" : ""}`;
      }
      return null;
    }
    case "definition-match":
      if ((DUEL_DEFINITION_CATEGORIES as readonly string[]).includes(startWord.toUpperCase()))
        return startWord.charAt(0).toUpperCase() + startWord.slice(1).toLowerCase();
      return null;
    case "no-repeats":
      if (/^\d+$/.test(startWord)) return `${startWord}+ letter words`;
      return null;
    default:
      return null;
  }
}
