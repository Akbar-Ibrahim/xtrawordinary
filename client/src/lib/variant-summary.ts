const LETTER_BALANCE_CATEGORIES = [
  "consonant_count", "vowel_count", "start_end_vowel", "start_end_consonant",
  "start_vowel_end_consonant", "start_consonant_end_vowel", "locked_balance",
] as const;

const LETTER_BALANCE_CATEGORY_NAMES: Record<string, string> = {
  consonant_count: "Consonant Count",
  vowel_count: "Vowel Count",
  start_end_vowel: "Start & End Vowels",
  start_end_consonant: "Start & End Consonants",
  start_vowel_end_consonant: "Start Vowel, End Consonant",
  start_consonant_end_vowel: "Start Consonant, End Vowel",
  locked_balance: "Locked Balance",
};

export function getVariantSummary(slug: string, seed: number, params?: Record<string, any>): string | null {
  const p = params ?? {};
  const survival = p.survival === true ? " · Survival" : "";
  switch (slug) {
    case "word-length": {
      if (p.length) {
        const parts: string[] = [`${p.length}-letter words`];
        if (p.startsWith) parts.push(`starts '${p.startsWith}'`);
        if (p.endsWith) parts.push(`ends '${p.endsWith}'`);
        if (p.contains) parts.push(`contains '${p.contains}'`);
        if (!p.survival) {
          const wc = p.wordCount ? `${p.wordCount} words` : "20 words";
          const tl = p.timeLimit ? (p.timeLimit >= 60 ? `${Math.round(p.timeLimit / 60)} min per round` : `${p.timeLimit}s per round`) : "2 min per round";
          parts.push(wc, tl);
        }
        return `Length Challenge: ${parts.join(" · ")}${survival}`;
      }
      const lengthMap: Record<number, string> = { 1: "≤4 letters", 2: "≤6 letters", 3: "≤8 letters", 4: "10 letters", 5: "12 letters" };
      const variation = p.variation ?? [1, 2, 3, 4, 5][seed % 5];
      return `Length Challenge: ${lengthMap[variation] ?? `Variation ${variation}`}${survival}`;
    }
    case "letter-position": {
      const letter = p.letter;
      const position = p.position;
      const parts: string[] = [];
      if (letter && position) parts.push(`Letter ${letter} at position ${position}`);
      else if (letter) parts.push(`Letter: ${letter}`);
      else parts.push("Letter Position");
      if (!p.survival) {
        const wc = p.wordCount ? `${p.wordCount} words` : "20 words";
        const tl = p.timeLimit ? (p.timeLimit >= 60 ? `${Math.round(p.timeLimit / 60)} min per round` : `${p.timeLimit}s per round`) : "2 min per round";
        parts.push(wc, tl);
      }
      return parts.join(" · ") + survival;
    }
    case "letter-hunt": {
      const countMap: Record<string | number, string> = { 1: "2 letters", 2: "3 letters", 3: "4 letters", 4: "5 letters", 5: "6 letters", advanced: "Advanced (random)" };
      const challenge = p.challenge ?? p.position ?? ([1, 2, 3, 4, 5] as const)[seed % 5];
      const pinnedLetters = Array.isArray(p.letters) ? p.letters.filter((l: string) => l && l !== "any") : [];
      const letterInfo = pinnedLetters.length > 0 ? ` · Pinned: ${pinnedLetters.join(",")}` : (p.letter ? ` · Letter ${p.letter}` : "");
      const huntBase = `Hunt for: ${countMap[challenge] ?? `Challenge ${challenge}`}${letterInfo}`;
      if (!p.survival) {
        const wc = p.wordCount ? `${p.wordCount} words` : "20 words";
        const tl = p.timeLimit ? (p.timeLimit >= 60 ? `${Math.round(p.timeLimit / 60)} min per round` : `${p.timeLimit}s per round`) : "2 min per round";
        return `${huntBase} · ${wc} · ${tl}${survival}`;
      }
      return `${huntBase}${survival}`;
    }
    case "letter-frequency": {
      const freqMap: Record<string | number, string> = { 1: "Exactly 2×", 2: "Exactly 3×", 3: "Exactly 4×", 4: "5× or more", multi: "Multi-Letter" };
      const challenge = p.challenge ?? p.rank ?? ([1, 2, 3, 4] as const)[seed % 4];
      const letter = p.letter ? ` · Letter ${p.letter}` : "";
      const pinnedMulti = challenge === "multi" && Array.isArray(p.letters) && (p.letters as string[]).some(l => l !== "any")
        ? ` · ${(p.letters as string[]).filter(l => l !== "any").join(", ")}`
        : "";
      const freqBase = `Frequency: ${freqMap[challenge] ?? `Challenge ${challenge}`}${letter}${pinnedMulti}`;
      if (!p.survival) {
        const wc = p.wordCount ? `${p.wordCount} words` : "20 words";
        const tl = p.timeLimit ? (p.timeLimit >= 60 ? `${Math.round(p.timeLimit / 60)} min per round` : `${p.timeLimit}s per round`) : "2 min per round";
        return `${freqBase} · ${wc} · ${tl}${survival}`;
      }
      return `${freqBase}${survival}`;
    }
    case "letter-balance": {
      if (p.vowels !== undefined || p.consonants !== undefined) {
        const parts: string[] = [];
        if (p.vowels !== undefined) parts.push(`${p.vowels} vowel${p.vowels !== 1 ? "s" : ""}`);
        if (p.consonants !== undefined) parts.push(`${p.consonants} consonant${p.consonants !== 1 ? "s" : ""}`);
        if (p.length !== undefined) parts.push(`${p.length} letters`);
        return `Vowel & Consonant: ${parts.join(", ")}${survival}`;
      }
      const cat = p.category ?? LETTER_BALANCE_CATEGORIES[seed % LETTER_BALANCE_CATEGORIES.length];
      const level = p.level;
      const catName = LETTER_BALANCE_CATEGORY_NAMES[cat] ?? cat;
      if (cat === "locked_balance" && level !== undefined && p.consonantCount !== undefined) {
        const v = level - p.consonantCount;
        return `${catName} · ${level}L / ${p.consonantCount}C / ${v}V${survival}`;
      }
      return level !== undefined ? `${catName} · ${level === "advanced" ? "Advanced" : `Level ${level}`}${survival}` : `${catName}${survival}`;
    }
    case "letter-pool": {
      const v = p.variant ?? (seed % 2 === 0 ? "with-pool" : "without-pool");
      const modeLabel = v === "with-pool" ? "With Pool" : "Without Pool";
      const lpWords = Array.isArray(params?.words) ? params!.words as Array<{ word: string }> : [];
      return lpWords.length > 0 ? `${modeLabel} · ${lpWords.length} word${lpWords.length !== 1 ? "s" : ""}` : modeLabel;
    }
    case "definition-match": {
      const wordCount = Array.isArray(params?.words) ? (params.words as any[]).length : null;
      const tl = params?.timeLimitSeconds as number | undefined;
      const tlLabel = tl !== undefined
        ? (tl < 60 ? ` · ${tl}s per round` : ` · ${tl / 60} min per round`)
        : "";
      return wordCount ? `${wordCount} custom word${wordCount !== 1 ? "s" : ""}${tlLabel}` : `Random definitions${tlLabel}`;
    }
    case "letter-dodge": {
      const diffLabels: Record<string | number, string> = {
        1: "Easy (1)",
        2: "Medium (2)",
        3: "Hard (3)",
        4: "Expert (4)",
        5: "Master (5)",
        savant: "Savant (6–12)",
        advanced: "Advanced (random)",
      };
      const diff = p.difficulty ?? 3;
      const pinnedLetters = Array.isArray(p.letters) ? p.letters.filter((l: string) => l && l !== "any") : [];
      const letterInfo = pinnedLetters.length > 0 ? ` · Avoid: ${pinnedLetters.join(",")}` : "";
      const dodgeBase = `Dodge: ${diffLabels[diff] ?? `Difficulty ${diff}`}${letterInfo}`;
      if (!p.survival) {
        const wc = p.wordCount ? `${p.wordCount} words` : "20 words";
        const tl = p.timeLimit ? (p.timeLimit >= 60 ? `${Math.round(p.timeLimit / 60)} min per round` : `${p.timeLimit}s per round`) : "90s per round";
        return `${dodgeBase} · ${wc} · ${tl}${survival}`;
      }
      return `${dodgeBase}${survival}`;
    }
    case "word-roots":
      return params?.wrSeed !== undefined ? "5 puzzles • seeded set" : "Word roots & etymology";
    case "progressive-reveal": {
      const prWords = Array.isArray(params?.words) ? params!.words as Array<{ word: string }> : [];
      return prWords.length > 0 ? `${prWords.length} word${prWords.length !== 1 ? "s" : ""} to guess` : "Progressive letter reveal";
    }
    case "anagram-solver": {
      const asWords = Array.isArray(params?.words) ? params!.words as Array<{ original: string }> : [];
      return asWords.length > 0 ? `${asWords.length} anagram${asWords.length !== 1 ? "s" : ""}` : "Anagram solving";
    }
    case "word-scramble": {
      const wsWords = Array.isArray(params?.words) ? params!.words as Array<{ word: string }> : [];
      return wsWords.length > 0 ? `${wsWords.length} word${wsWords.length !== 1 ? "s" : ""} to unscramble` : "Word unscrambling";
    }
    default:
      return null;
  }
}
