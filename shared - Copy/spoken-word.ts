export const SPOKEN_WORD_MODES = [
  { label: "Spell It", slug: "spell-it" },
  { label: "Reverse", slug: "reverse" },
  { label: "Vowels Only", slug: "vowels-only" },
  { label: "Consonants Only", slug: "consonants-only" },
  { label: "Vowel Count", slug: "vowel-count" },
  { label: "Consonant Count", slug: "consonant-count" },
  { label: "Mixed Challenge", slug: "mixed" },
] as const;

export const SPOKEN_WORD_GAME_SLUG = "spoken-word-transformations";

export type SpokenWordModeSlug = (typeof SPOKEN_WORD_MODES)[number]["slug"];
export type SpokenWordTransformMode = Exclude<SpokenWordModeSlug, "mixed">;

export function getSpokenWordLeaderboardSlug(mode: SpokenWordModeSlug): string {
  return `${SPOKEN_WORD_GAME_SLUG}-${mode}`;
}

export const SPOKEN_WORD_TRANSFORM_MODES: readonly SpokenWordTransformMode[] = [
  "spell-it",
  "reverse",
  "vowels-only",
  "consonants-only",
  "vowel-count",
  "consonant-count",
];

/**
 * Common, short English words chosen for relatively consistent pronunciation.
 * Y is treated as a consonant for the vowel/consonant modes.
 */
export const SPOKEN_WORD_BANK = `
able about above accept across active actor admit adopt adult after again agent agree ahead alarm album alert alike alive allow alone along alter among anger angle angry answer appeal apple apply apron argue arise armed armor artist aside asset audio avoid awake award aware awful
badge baker basic basket beach begin below bench berry birth black blade blank blast blend bless blind block bloom board boast bonus bound brain brave bread break brick brief bring broad brown brush build built burst cabin cable camera campus candy career carry carve catch cause chain chair chalk charm chart chase cheap check cheer chest chief child choice choose civil claim class clean clear clerk climb clock cloud coach coast color could count court cover craft crash cream creek crime crisp cross crowd crown crude crush curve
daily dance dealt debut decade delay depth desk diary digit dinner direct divide doctor dollar donor double dozen draft drama draw dream dress drink drive drop eager early earth east easy echo edge editor effort eight elbow elect elite empty engine enjoy enough enter entry equal escape exist extra fabric face fact fairly faith false family fancy farmer faster father fault favor feeder fellow female fence fever field fifth fifty final finish first flame flash flesh floor fluid focus follow force forest forget form frame free fresh friend front fruit funny future
garden gather gentle giant gift given glass globe glory glove going grade grain grand grant grass great green greet group guard guess guest guide habit happy harbor hard harvest health heart heavy hello helpful hidden higher history holder honest honor horse hotel house human humor hunter hurry ideal ignore image impact income indeed index indoor infant inform initial inside insist intent invent invest invite island issue item jacket judge junior keeper kernel kettle kidney kindly kingdom kitchen kitten ladder language laptop larger latest launch leader learn leave legal length lesson letter level likely limit little living local locate lonely lovely lucky manage manner manual market master matter maybe member memory mental message method middle mirror mobile modern moment monkey mostly motion mother movie musical mystery
narrow nation native nature nearby nearly neatly never normal notice number observe obtain obvious ocean office officer online option order organic origin other output outside owner package painter palace parent partly partner party passage pattern paying people pepper period person phrase picnic pillow pirate planet player please pocket poetry point popular portion positive pretty prevent primary printer private problem process produce proper protect proud public purpose puzzle quality quarter question quick quiet rabbit radio random reach reason recycle reduce region relax release relief remain remember repair repeat rescue result return reward ribbon rising rocket rolling rough round safety sample school screen search season second secret section select senate senior sense series service settle shadow shall shape share sharp shelter shift shiny should signal silent silver simple since singer single sister skate skill slice slight smart smile smooth social solid solve sorry sound source space speak special spirit spring square stable stage stairs standard start state steady steel still stone story stream street strike strong student study submit sudden summer supply support surface surprise switch symbol system table tablet talent target taste teacher team temper temple tennis thank theory there these thing think third thought thread three throw ticket tidy timber tissue title today topic total touch toward tower trace track trade travel treat tree trial trick tunnel twenty twice under union unique unit until update useful usual valley value verbal version vessel video village vision visit visual voice volume vote wait wake walk wallet wanted water weather welcome winner winter wisdom wonder wooden worker world writer
`.trim().split(/\s+/).filter((word) => word.length >= 4 && word.length <= 8);

export function transformSpokenWord(
  word: string,
  mode: SpokenWordTransformMode,
): string {
  const normalized = word.toLowerCase();
  const vowels = normalized.replace(/[^aeiou]/g, "");
  const consonants = normalized.replace(/[aeiou]/g, "");

  switch (mode) {
    case "spell-it":
      return normalized;
    case "reverse":
      return [...normalized].reverse().join("");
    case "vowels-only":
      return vowels;
    case "consonants-only":
      return consonants;
    case "vowel-count":
      return String(vowels.length);
    case "consonant-count":
      return String(consonants.length);
  }
}

export function isValidSpokenWord(word: string): boolean {
  const normalized = word.trim().toLowerCase();
  return normalized.length >= 4
    && normalized.length <= 8
    && /^[a-z]+$/.test(normalized)
    && /[aeiou]/.test(normalized)
    && /[^aeiou]/.test(normalized);
}

export function isValidSpokenWordBank(words: readonly string[] = SPOKEN_WORD_BANK): boolean {
  return words.length >= 200
    && new Set(words).size === words.length
    && words.every(isValidSpokenWord);
}
