import type { Game, AnagramWordSet, ScrambleWord, DefinitionWord, MakerWord, WordLengthConfig, LetterPositionConfig, LetterHuntConfig, WordChainConfig, VowelConsonantConfig, WordStackPuzzle, WordSplitPuzzle, ProgressiveRevealWord, WordLadderPuzzle, LadderRushPuzzle } from "@shared/schema";

export const wordLadderPuzzlesData: WordLadderPuzzle[] = [
  {
    start: "COAT", target: "BOOT", par: 2,
    optimalPaths: [["COAT", "BOAT", "BOOT"]]
  },
  {
    start: "LOVE", target: "HATE", par: 3,
    optimalPaths: [["LOVE", "LAVE", "LATE", "HATE"]]
  },
  {
    start: "LEAD", target: "GOLD", par: 3,
    optimalPaths: [["LEAD", "LOAD", "GOAD", "GOLD"]]
  },
  {
    start: "BEST", target: "LAST", par: 2,
    optimalPaths: [["BEST", "BAST", "LAST"]]
  },
  {
    start: "COLD", target: "WARM", par: 4,
    optimalPaths: [["COLD", "CORD", "WORD", "WARD", "WARM"], ["COLD", "CORD", "CARD", "WARD", "WARM"]]
  },
  {
    start: "FIRE", target: "COLD", par: 4,
    optimalPaths: [["FIRE", "FORE", "FORD", "CORD", "COLD"], ["FIRE", "FORE", "CORE", "CORD", "COLD"]]
  },
  {
    start: "MINE", target: "GOLD", par: 4,
    optimalPaths: [["MINE", "MILE", "MOLE", "MOLD", "GOLD"]]
  },
  {
    start: "RICE", target: "CAKE", par: 4,
    optimalPaths: [["RICE", "RACE", "LACE", "LAKE", "CAKE"]]
  },
  {
    start: "HEAD", target: "TAIL", par: 5,
    optimalPaths: [["HEAD", "HEAL", "TEAL", "TELL", "TALL", "TAIL"]]
  },
  {
    start: "FISH", target: "BIRD", par: 5,
    optimalPaths: [["FISH", "FIST", "GIST", "GIRT", "GIRD", "BIRD"]]
  },
  {
    start: "DAWN", target: "DUSK", par: 5,
    optimalPaths: [["DAWN", "DOWN", "DONE", "DUNE", "DUNK", "DUSK"]]
  },
];

export const ladderRushStartWords: Record<number, string[]> = {
  4: [
    "BAND", "BARE", "BARK", "BASE", "BEAD", "BEAT", "BELL", "BELT", "BEND", "BEST",
    "BILE", "BILL", "BIND", "BOLT", "BONE", "BORE", "CAKE", "CALL", "CARD", "CARE",
    "CART", "CASE", "CAVE", "CODE", "COLD", "COME", "CONE", "CORD", "CORE", "CORN",
    "DARE", "DARK", "DATE", "DEAL", "DECK", "DOME", "DONE", "DOSE", "FALL", "FAME",
    "FARE", "FARM", "FATE", "FILE", "FILL", "FIND", "FINE", "FIRE", "FIRM", "FISH",
    "FOLD", "FOND", "FORD", "FORE", "FORK", "FORM", "FORT", "FUND", "GAME", "GATE",
    "GEAR", "GIFT", "GIRL", "GOLD", "GONE", "GOOD", "GORE", "HALL", "HAND", "HANG",
    "HARD", "HARE", "HARM", "HATE", "HAVE", "HEAD", "HEAL", "HEAR", "HEAT", "HEEL",
    "HELP", "HERO", "HIDE", "HILL", "HINT", "HIRE", "HOLD", "HOME", "HOLE", "HOOD",
    "HOOK", "HORN", "HOST", "HUNT", "HURT", "KIND", "LAMP", "LAND", "LANE", "LAST",
    "LATE", "LEAD", "LEAN", "LEND", "LIKE", "LIME", "LINE", "LINK", "LIVE", "LOAD",
    "LONE", "LONG", "LOVE", "MADE", "MAIL", "MAKE", "MALE", "MARK", "MASK", "MATE",
    "MEAL", "MEAN", "MEAT", "MILE", "MILK", "MILL", "MIND", "MINE", "MODE", "MOLE",
    "MORE", "MOST", "MULE", "NAIL", "NEAR", "NICE", "NODE", "NOSE", "NOTE", "PACE",
    "PACK", "PAGE", "PAIN", "PALE", "PANE", "PARK", "PART", "PEAK", "PILE", "PINE",
    "POLE", "POND", "POOL", "PORT", "POSE", "RACK", "RAGE", "RAIL", "RAIN", "RAKE",
    "RARE", "REAL", "RICE", "RIDE", "RING", "RISE", "ROAD", "ROCK", "ROLE", "ROOF",
    "ROOM", "ROPE", "ROSE", "RULE", "RUSH", "RUST", "SAGE", "SAIL", "SALE", "SALT",
    "SANE", "SAVE", "SEAL", "SELF", "SEND", "SIDE", "SIGN", "SILK", "SING", "SINK",
    "SITE", "SOME", "SONG", "SORE", "SORT", "SOUL", "SOUR", "SPAN", "STEP", "STOP",
    "TAKE", "TALE", "TALL", "TAME", "TAPE", "TEAL", "TELL", "TIDE", "TILE", "TILL",
    "TILT", "TIME", "TIRE", "TONE", "TOOL", "TORE", "TUNE", "TYPE", "VALE", "VINE",
    "VOTE", "WADE", "WAKE", "WALK", "WALL", "WARD", "WARM", "WARN", "WAVE", "WEAR",
    "WELL", "WIDE", "WILL", "WIND", "WINE", "WISE", "WORD", "WORK", "WORN", "YARD",
  ],
  5: [
    "BEARD", "BEAST", "BENCH", "BLAND", "BLANK", "BLAZE", "BLEND", "BLOCK", "BLOOD",
    "BLOOM", "BLUNT", "BOARD", "BOAST", "BOOST", "BRAVE", "BREAK", "BREED", "BRISK",
    "BROAD", "BROWN", "BRUSH", "BUILT", "BURST", "CANDY", "CHAIN", "CHAIR", "CHARM",
    "CHART", "CHASE", "CHEAP", "CHECK", "CHEST", "CHIEF", "CHILD", "CHILL", "CLASH",
    "CLASS", "CLEAN", "CLEAR", "CLIMB", "CLOCK", "CLONE", "CLOSE", "CLOUD", "COACH",
    "COAST", "COUNT", "COURT", "COVER", "CRAFT", "CRANE", "CRASH", "CREAM", "CREED",
    "CREST", "CROSS", "CROWD", "CRUSH", "CURVE", "CYCLE", "DRINK", "DRIVE", "DRONE",
    "EARLY", "EARTH", "EIGHT", "FLAME", "FLARE", "FLASH", "FLESH", "FLOOD", "FLOUR",
    "FLUID", "FLUSH", "FRAME", "GLARE", "GLOOM", "GRACE", "GRADE", "GRAIN", "GRAND",
    "GRANT", "GRAPE", "GRASS", "GRAZE", "GREEN", "GREET", "GRIEF", "GRIND", "GROAN",
    "GUARD", "GUIDE", "HASTE", "HEART", "HEAVY", "HINGE", "HORSE", "HOUSE", "HUMAN",
    "IMAGE", "JUDGE", "KNIFE", "LANCE", "LARGE", "LASER", "LATER", "LAUGH", "LAYER",
    "LEARN", "LEAST", "LEAVE", "LEVEL", "LIGHT", "LIMIT", "LINER", "LOCAL", "LOFTY",
    "LOOSE", "LOWER", "LUCKY", "MAKER", "MANOR", "MARCH", "MATCH", "MAYOR", "MERCY",
    "MODEL", "MONEY", "MONTH", "MORAL", "MOUNT", "MOUSE", "MOVER", "MUSIC", "NIGHT",
    "NOBLE", "NOISE", "NORTH", "NOTED", "NURSE", "OCEAN", "OFFER", "OLIVE", "ORDER",
    "OTHER", "OUTER", "OWNED", "OWNER", "OVERT", "PANEL", "PAPER", "PARTY", "PATCH",
    "PAUSE", "PEACE", "PEARL", "PERCH", "PHASE", "PILOT", "PINCH", "PITCH", "PLACE",
    "PLAIN", "PLANE", "PLANK", "PLANT", "PLATE", "PLEAD", "PLUMB", "PLUME", "PORCH",
    "POINT", "POLAR", "POUND", "POWER", "PRESS", "PRICE", "PRIDE", "PRIME", "PRINT",
    "PRIZE", "PROBE", "PROOF", "PROSE", "PROUD", "PROVE", "PSALM", "PULSE", "PURSE",
    "QUEEN", "QUEST", "QUEUE", "QUICK", "QUIET", "QUITE", "QUOTA", "RABBI", "RADAR",
    "RAISE", "RANGE", "RAPID", "RATIO", "REACH", "READY", "REALM", "REBEL", "RENAL",
    "REPAY", "RESIN", "RIDER", "RIDGE", "RISKY", "RIVER", "RIVAL", "ROAST", "ROBIN",
    "ROCKY", "ROMAN", "ROOMY", "ROUGE", "ROUGH", "ROUND", "ROUTE", "RULER", "RURAL",
    "SADLY", "SAINT", "SANDY", "SAUCE", "SCALE", "SCARE", "SCENE", "SCONE", "SCORE",
    "SCOUT", "SEIZE", "SENSE", "SERVE", "SEVEN", "SHADE", "SHAKE", "SHALL", "SHAME",
    "SHAPE", "SHARE", "SHARK", "SHARP", "SHAVE", "SHEAR", "SHEEN", "SHINE", "SHIRT",
    "SHOCK", "SHORE", "SHORT", "SHOUT", "SHOVE", "SHRED", "SHRUG", "SIGMA", "SINCE",
    "SIXTH", "SKILL", "SKULL", "SKUNK", "SLACK", "SLANT", "SLASH", "SLAVE", "SLEEP",
    "SLICE", "SLIDE", "SLOPE", "SLUMP", "SMART", "SMASH", "SMELL", "SMILE", "SMOKE",
    "SNARE", "SNEAK", "SNORE", "SOLAR", "SOLVE", "SPACE", "SPARE", "SPARK", "SPEAK",
    "SPEAR", "SPEED", "SPELL", "SPEND", "SPIKE", "SPINE", "SPITE", "SPLIT", "SPOKE",
    "SPOON", "SPORT", "SPRAY", "SQUAD", "STAIN", "STALE", "STALK", "STAMP", "STAND",
    "STARE", "START", "STATE", "STEAL", "STEAM", "STEEL", "STEEP", "STERN", "STICK",
    "STILL", "STONE", "STOOL", "STORE", "STORM", "STORY", "STOUT", "STOVE", "STRAP",
    "STRAW", "STRAY", "STRIP", "STUDY", "STYLE", "SUGAR", "SUITE", "SUNNY", "SUPER",
    "SWAMP", "SWEAR", "SWEAT", "SWEEP", "SWEET", "SWIFT", "SWINE", "SWIRL", "SWOOP",
    "TABLE", "TAUNT", "TEACH", "TENSE", "TENTH", "TERMS", "THEME", "THERE", "THICK",
    "THING", "THINK", "THORN", "THOSE", "THREE", "THREW", "THROW", "THUMB", "THUMP",
    "TIGER", "TIGHT", "TIMER", "TIRED", "TITLE", "TODAY", "TOKEN", "TORCH", "TOTAL",
    "TOUGH", "TOWEL", "TOWER", "TRACE", "TRACK", "TRADE", "TRAIL", "TRAIN", "TRAMP",
    "TRASH", "TREAD", "TREAT", "TREND", "TRIAL", "TRICK", "TRIED", "TROOP", "TRUCK",
    "TRUMP", "TRUNK", "TRUST", "TRUTH", "TULIP", "TWICE", "TWIRL", "TWIST", "TYPED",
    "ULTRA", "UNCLE", "UNDER", "UNFIT", "UNION", "UNITY", "UNTIL", "UPPER", "UPSET",
    "URBAN", "USAGE", "USUAL", "UTTER", "VALID", "VALUE", "VAPOR", "VAULT", "VERSE",
    "VITAL", "VIVID", "VOCAL", "VOICE", "VOTER", "WAIST", "WASTE", "WATCH", "WATER",
    "WEARY", "WEAVE", "WEIGH", "WEIRD", "WHALE", "WHEAT", "WHEEL", "WHERE", "WHILE",
    "WHITE", "WHOLE", "WHOSE", "WIDER", "WIDTH", "WITCH", "WOMAN", "WOMEN", "WORLD",
    "WORRY", "WORSE", "WORST", "WORTH", "WOULD", "WOUND", "WRIST", "WRITE", "WROTE",
    "YACHT", "YIELD", "YOUNG", "YOUTH", "ZEBRA",
  ],
  6: [
    "BATTLE", "BEACON", "BETTER", "BORDER", "BOTTLE", "BOTTOM", "BOUNCE", "BRANCH",
    "BREACH", "BRIDGE", "BRIGHT", "BROKEN", "BROWSE", "BUBBLE", "BUCKET", "BUTTON",
    "CANCEL", "CANDLE", "CASTLE", "CENTER", "CHANCE", "CHANGE", "CHARGE", "CHEESE",
    "CHOOSE", "CHOSEN", "CHURCH", "CIRCLE", "CLAUSE", "CLEVER", "CLOSED", "CLOSER",
    "CLOUDY", "COARSE", "COLLAR", "CORNER", "COURSE", "COUSIN", "CREATE", "CREDIT",
    "CRISIS", "CRITIC", "CRUISE", "EASILY", "EDITOR", "EFFORT", "EMERGE", "EMPIRE",
    "ENABLE", "ENERGY", "ENGAGE", "ENGINE", "ENTIRE", "FACTOR", "FALLEN", "FAMINE",
    "FAMOUS", "FARMER", "FATHER", "FAULTS", "FELLOW", "FENCED", "FILTER", "FINGER",
    "FINISH", "FIRMLY", "FISCAL", "FLIGHT", "FOREST", "FORMAL", "FORMED", "FROZEN",
    "FUTURE", "GARDEN", "GATHER", "GENDER", "GENTLE", "GLOOMY", "GOLDEN", "GRAVEL",
    "GROUND", "GROWTH", "HANDLE", "HAPPEN", "HARBOR", "HARDLY", "HARDEN", "HATRED",
    "HIDDEN", "HIGHLY", "HONEST", "HUNGER", "HUNTER", "IGNORE", "IMPACT", "IMPORT",
    "INCOME", "INDEED", "INSECT", "INSULT", "INVENT", "ISLAND", "ISSUED", "JOYFUL",
    "JUNGLE", "KERNEL", "LAMENT", "LAUNCH", "LEADER", "LEAVES", "LENGTH", "LESSEN",
    "LISTEN", "LIVELY", "LONGER", "LOSING", "LUSTRE", "MADMAN", "MANAGE", "MANNER",
    "MARKED", "MARKET", "MARVEL", "MASTER", "MATTER", "MENTAL", "MIDDLE", "MIRROR",
    "MODERN", "MOMENT", "MORTAL", "MOTHER", "MOTIVE", "MURDER", "MUSCLE", "MUTUAL",
    "NARROW", "NATURE", "NEEDED", "NEGATE", "NORMAL", "NOTICE", "NOZZLE", "OBJECT",
    "OBLONG", "OBTAIN", "OFFICE", "ORIGIN", "PALACE", "PATENT", "PATROL",
    "PARDON", "PERSON", "PHRASE", "PLANET", "PLAYER", "PLEASE", "PLENTY", "POCKET",
    "POLISH", "PREFER", "PRETTY", "PRISON", "PROPER", "PROVEN", "PURPLE", "PURSUE",
    "RABBIT", "RATHER", "REASON", "RECORD", "REFUSE", "REMAIN", "REMOTE", "RENDER",
    "REPEAT", "RESIST", "RESULT", "REVEAL", "RIBBON", "ROLLER", "ROTATE", "RUBBER",
    "ROTTEN", "RUGGED", "SADDLE", "SAMPLE", "SEARCH", "SECRET", "SELECT", "SENDER",
    "SERIES", "SERVER", "SETTLE", "SILENT", "SIMPLE", "SINGLE", "SISTER", "SKETCH",
    "SLOWLY", "SMOOTH", "SOCIAL", "SOFTEN", "SOLELY", "SORROW", "SOURCE", "SPEECH",
    "SPIRAL", "STABLE", "STATIC", "STATUE", "STEADY", "STICKY", "STOLEN", "STREAM",
    "STRESS", "STRICT", "STRONG", "STRUCK", "STUDIO", "SUBMIT", "SUDDEN", "SUFFER",
    "SUMMER", "SUPPLY", "SURELY", "SWITCH", "SYMBOL", "SYSTEM", "TALENT", "TEMPLE",
    "TENDER", "THANKS", "THEORY", "THOUGH", "THREAD", "THRONE", "THRUST", "TICKET",
    "TIMBER", "TISSUE", "TOGGLE", "TONGUE", "TRAVEL", "TRIPLE", "THROAT", "TUMBLE",
    "UNLIKE", "USEFUL", "VENDOR", "VIRTUE", "VOLUME", "WANDER", "WEALTH", "WEIGHT",
    "WINTER", "WONDER", "WOODEN", "WORKER", "WRIGHT", "YEARLY",
  ],
};

export const ladderRushPuzzlesData: LadderRushPuzzle[] = [
  ...ladderRushStartWords[4].map(start => ({ start, wordLength: 4 })),
  ...ladderRushStartWords[5].map(start => ({ start, wordLength: 5 })),
  ...ladderRushStartWords[6].map(start => ({ start, wordLength: 6 })),
];

export const anagramWordSets: AnagramWordSet[] = [
  { original: "SPEAR", anagrams: ["SPARE", "PEARS", "REAPS", "PARES"] },
  { original: "HEART", anagrams: ["EARTH", "HATER", "RATHE"] },
  { original: "LISTEN", anagrams: ["SILENT", "ENLIST", "TINSEL"] },
  { original: "TASTE", anagrams: ["STATE", "TATES"] },
  { original: "NIGHT", anagrams: ["THING"] },
  { original: "ANGEL", anagrams: ["ANGLE", "GLEAN"] },
  { original: "STARE", anagrams: ["TEARS", "RATES", "ASTER"] },
  { original: "STREAM", anagrams: ["MASTER", "TAMERS"] },
];

export const scrambleWords: ScrambleWord[] = [
  { word: "PUZZLE", category: "Games" },
  { word: "BRIGHT", category: "Adjective" },
  { word: "MONKEY", category: "Animal" },
  { word: "CASTLE", category: "Building" },
  { word: "FROZEN", category: "Temperature" },
  { word: "PLANET", category: "Space" },
  { word: "GUITAR", category: "Music" },
  { word: "JUNGLE", category: "Nature" },
  { word: "DRAGON", category: "Fantasy" },
  { word: "MARKET", category: "Place" },
  { word: "RHYTHM", category: "Music" },
  { word: "SILVER", category: "Metal" },
];

export const definitionWords: DefinitionWord[] = [
  { word: "LUMINOUS", definition: "Emitting or reflecting light; shining brightly", partOfSpeech: "adjective", synonyms: ["bright", "radiant", "glowing", "shining"] },
  { word: "EPHEMERAL", definition: "Lasting for a very short time; fleeting", partOfSpeech: "adjective", synonyms: ["fleeting", "transient", "brief", "momentary"] },
  { word: "ELOQUENT", definition: "Fluent or persuasive in speaking or writing", partOfSpeech: "adjective", synonyms: ["articulate", "expressive", "fluent"] },
  { word: "RESILIENT", definition: "Able to recover quickly from difficulties", partOfSpeech: "adjective", synonyms: ["tough", "flexible", "adaptable", "strong"] },
  { word: "SERENE", definition: "Calm, peaceful, and untroubled", partOfSpeech: "adjective", synonyms: ["peaceful", "calm", "tranquil"] },
  { word: "OBSCURE", definition: "Not clearly expressed or easily understood", partOfSpeech: "adjective", synonyms: ["unclear", "vague", "ambiguous", "cryptic"] },
  { word: "MEANDER", definition: "To follow a winding course; to wander aimlessly", partOfSpeech: "verb", synonyms: ["wander", "roam", "stroll"] },
  { word: "PONDER", definition: "To think about something carefully before making a decision", partOfSpeech: "verb", synonyms: ["consider", "contemplate", "reflect", "think"] },
  { word: "CHERISH", definition: "To protect and care for lovingly; to hold dear", partOfSpeech: "verb", synonyms: ["treasure", "value", "love"] },
  { word: "FLOURISH", definition: "To grow or develop in a healthy or vigorous way", partOfSpeech: "verb", synonyms: ["thrive", "prosper", "bloom", "grow"] },
];

export function generateLetterPool(word: string, decoyCount: number = 4): string[] {
  const middleLetters = word.slice(1, -1).split("");
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const wordLetters = new Set(word.split(""));
  const decoyOptions = alphabet.split("").filter(l => !wordLetters.has(l));
  const decoys: string[] = [];
  const shuffledDecoys = decoyOptions.sort(() => Math.random() - 0.5);
  for (let i = 0; i < Math.min(decoyCount, shuffledDecoys.length); i++) {
    decoys.push(shuffledDecoys[i]);
  }
  const pool = [...middleLetters, ...decoys];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

export const letterPoolBaseWords = [
  { word: "ADVENTURE", hint: "An exciting experience or undertaking", category: "Experience" },
  { word: "BEAUTIFUL", hint: "Pleasing to the senses", category: "Appearance" },
  { word: "CHALLENGE", hint: "A task that tests abilities", category: "Activity" },
  { word: "DANGEROUS", hint: "Able to cause harm", category: "Risk" },
  { word: "EDUCATION", hint: "Process of learning", category: "Learning" },
  { word: "FANTASTIC", hint: "Extraordinarily good", category: "Quality" },
  { word: "GENTLEMAN", hint: "A courteous man", category: "Person" },
  { word: "HAPPINESS", hint: "State of being content", category: "Emotion" },
  { word: "IMPORTANT", hint: "Of great significance", category: "Value" },
  { word: "KNOWLEDGE", hint: "Facts and information acquired", category: "Learning" },
];

const _makerDerivatives: Array<{ baseWord: string; derivatives: string[] }> = [
  { baseWord: "CREATIVE",  derivatives: ["CREATE", "CRATE", "RATE", "TEAR", "CARE", "RACE", "ACRE", "CART", "RICE", "VICE", "TRACE", "REACT", "CATER"] },
  { baseWord: "ADVENTURE", derivatives: ["ADVENT", "TRADE", "VENT", "RENT", "DENT", "TEND", "RUDE", "TRUE", "NUDE", "TURN", "UNDER", "NERVE", "TUNED"] },
  { baseWord: "WONDERFUL", derivatives: ["WONDER", "WORD", "FORD", "FLOW", "FLEW", "FOND", "FOLD", "LONE", "ROLE", "DUNE", "NUDE", "FOUNDER", "LOWER"] },
  { baseWord: "CELEBRATE", derivatives: ["CELEB", "CREATE", "ELECT", "BERATE", "BEER", "TREE", "BLEAT", "ABLE", "CABLE", "TABLE", "REBEL", "ALERT", "LATER"] },
  { baseWord: "FANTASTIC", derivatives: ["FAST", "CAST", "FACT", "FIST", "SAINT", "STAIN", "SATIN", "FAINT", "ANTIC", "STATIC", "ATTIC", "ANTICS", "TITAN"] },
  { baseWord: "BEAUTIFUL", derivatives: ["BEAT", "FEAT", "ABLE", "TABLE", "FABLE", "FAIL", "TAIL", "BAIT", "BUILT", "FAULT", "FLUTE", "FUTILE", "LIFE"] },
  { baseWord: "IMPORTANT", derivatives: ["IMPORT", "PORT", "RATIO", "PATRON", "MANOR", "PAINT", "TRAIN", "POINT", "ATOM", "TRAM", "MINOR", "PIANO", "PATIO"] },
  { baseWord: "CHALLENGE", derivatives: ["CHANGE", "ANGEL", "ANGLE", "CLEAN", "HEAL", "LEAN", "LANE", "HANG", "EACH", "HALL", "CLAN", "EAGLE", "LEGAL"] },
  { baseWord: "CONFIDENT", derivatives: ["FIND", "FOND", "TEND", "EDIT", "ICON", "DENT", "COIN", "DIET", "CODE", "DONE", "NOTE", "NICE", "TONIC"] },
  { baseWord: "KEYBOARD",  derivatives: ["BOARD", "BORED", "BRAKE", "BREAD", "DEAR", "DARK", "BARK", "BAKE", "DARE", "RAKE", "BODY", "ROAD", "BRAY"] },
  { baseWord: "TRANSPORT", derivatives: ["SPORT", "STRAP", "TRAP", "STAR", "PORT", "PART", "PANT", "RANT", "TORN", "ATOP", "SNAP", "SPAN", "PATRON"] },
  { baseWord: "EDUCATION", derivatives: ["ACTION", "AUDIT", "OUNCE", "DUNCE", "OCEAN", "UNITE", "CANOE", "TONIC", "ACUTE", "UNDO", "NOTED", "COATED", "CATION"] },
  { baseWord: "SOMETHING", derivatives: ["THOSE", "STONE", "SHINE", "MOIST", "GHOST", "MONTH", "ETHOS", "THING", "SMITH", "TONGS", "HOIST", "MOTHS", "HOMES"] },
  { baseWord: "PASSENGER", derivatives: ["SPARE", "SNARE", "PAGES", "ANGER", "RANGE", "RAGES", "PARSE", "GRAPES", "GRASS", "SANER", "SNAG", "REAP", "PEAR"] },
  { baseWord: "MOUNTAIN",  derivatives: ["MOUNT", "MOAT", "TUNA", "UNIT", "AMINO", "UNION", "OMIT", "UNTO", "AUNT", "MAIN", "MOAN", "MINT", "NOUN"] },
  { baseWord: "ABSOLUTE",  derivatives: ["TABLE", "STOLE", "BLOAT", "BOAST", "BEAST", "LEAST", "STEAL", "BLOUSE", "ABUSE", "LOUSE", "ALOE", "OAST", "BOLTS"] },
  { baseWord: "GENEROUS",  derivatives: ["ROGUE", "SNORE", "ROUGE", "ERGO", "GORE", "GROUSE", "NURSE", "RUSE", "GENRE", "EONS", "SENOR", "NOES", "ENURE"] },
  { baseWord: "INTERVIEW", derivatives: ["WINTER", "WRITE", "VEIN", "NERVE", "INERT", "WRIT", "INVERT", "TWINE", "INTER", "WINE", "VINE", "TRINE", "RIVE"] },
  { baseWord: "UMBRELLA",  derivatives: ["RUMBLE", "BLAME", "REALM", "ALBUM", "BEAM", "BALE", "BLUR", "MARBLE", "BLARE", "LABEL", "RUBLE", "LUMBER", "MURAL"] },
  { baseWord: "COMPUTER",  derivatives: ["COMET", "TEMPO", "COURT", "OUTER", "TRUCE", "TUMOR", "POEM", "ROUTE", "MOPE", "CORE", "ROPE", "COPE", "RECTO"] },
  { baseWord: "DAUGHTER",  derivatives: ["GRADE", "THREAD", "GATHER", "THUD", "RAGED", "HUGE", "RUDE", "GRATE", "EARTH", "TREAD", "DRAG", "URGED", "GAUD"] },
  { baseWord: "ORDINARY",  derivatives: ["DIARY", "RAINY", "DRAIN", "IRONY", "NADIR", "RANDY", "RADIO", "YARN", "RIND", "ORDAIN", "DINAR", "DRAY", "DORY"] },
  { baseWord: "PAINTING",  derivatives: ["PAINT", "PINT", "PANG", "PING", "GIANT", "PANTING", "TAPING", "APING", "ANTI", "INAPT", "PAINING", "GNAT", "TANG"] },
  { baseWord: "HOSPITAL",  derivatives: ["PILOT", "PATIO", "PLAIT", "TOIL", "LASH", "OATH", "HALT", "SHIP", "TAIL", "LIPS", "SLOP", "ATOP", "SILO"] },
  { baseWord: "CHAMPION",  derivatives: ["CHAIN", "CHINA", "PIANO", "ICON", "INCH", "PAIN", "MAIN", "MANIC", "AMINO", "CAMP", "CHAMP", "CHIMP", "PANIC"] },
  { baseWord: "BIRTHDAY",  derivatives: ["DIRTY", "DIARY", "BIRTH", "THIRD", "HABIT", "BRAID", "HARDY", "TARDY", "BRAD", "BRAT", "DART", "TIDY", "DRAY"] },
];
export const makerWords: MakerWord[] = _makerDerivatives.map(({ baseWord, derivatives }) => ({
  baseWord,
  derivatives,
  maxWords: Math.min(derivatives.length, 10),
}));

export const wordDictionary: string[] = [
  "AM",
  "ACE", "ACT", "ADD", "AGE", "AID", "AIM", "AIR", "ALL", "AND", "ANT", "ANY", "APE", "ARC", "ARE", "ARK", "ARM", "ART", "ASH", "ATE",
  "CAN", "CAP", "CAT", "COP", "OPY",
  "ABLE", "ACHE", "AGED", "AIDE", "AJAR", "ALSO", "AMID", "ARCH", "AREA", "ARMY", "AUNT", "AUTO", "AWAY", "BACK", "BAKE", "BALL", "BAND", "BANK", "BARE", "BARK", "BARN", "BASE", "BATH", "BEAR", "BEAT", "BEEN", "BEER", "BELL", "BELT", "BEND", "BENT", "BEST", "BIKE", "BIRD", "BITE", "BLOW", "BLUE", "BOAT", "BODY", "BOLD", "BOLT", "BOMB", "BOND", "BONE", "BOOK", "BOOM", "BOOT", "BORE", "BORN", "BOSS", "BOTH", "BOWL", "BULK", "BURN", "BURY", "BUSH", "BUSY", "CAFE", "CAGE", "CAKE", "CALL", "CALM", "CAME", "CAMP", "CAPE", "CARD", "CARE", "CART", "CASE", "CASH", "CAST", "CAVE", "CHEF", "CHEW", "CHIN", "CHIP", "CITY", "CLAM", "CLAP", "CLAW", "CLAY", "CLIP", "CLUB", "CLUE", "COAL", "COAT", "CODE", "COIL", "COIN", "COLD", "COME", "CONE", "COOK", "COOL", "COPE", "COPY", "CORD", "CORE", "CORN", "COST", "COZY", "CRAB", "CREW", "CROP", "CROW", "CUBE", "CURE", "CURL", "CUTE",
  "ABOUT", "ABOVE", "ABUSE", "ACTOR", "ADAPT", "ADMIT", "ADOPT", "ADULT", "AFTER", "AGAIN", "AGENT", "AGREE", "AHEAD", "ALARM", "ALBUM", "ALERT", "ALIEN", "ALIGN", "ALIKE", "ALIVE", "ALLEY", "ALLOW", "ALLOY", "ALONE", "ALONG", "ALPHA", "ALTER", "AMAZE", "AMONG", "AMPLE", "ANGEL", "ANGER", "ANGLE", "ANGRY", "ANKLE", "APART", "APPLE", "APPLY", "ARENA", "ARGUE", "ARISE", "ARMOR", "AROMA", "ARROW", "ASIDE", "ASSET", "ATTIC", "AUDIO", "AVOID", "AWAKE", "AWARD", "AWARE", "AWFUL",
  "BADGE", "BAKER", "BEARD", "BEAST", "BEGIN", "BEING", "BELOW", "BENCH", "BERRY", "BIRDS", "BIRTH", "BLACK", "BLADE", "BLAME", "BLAND", "BLANK", "BLAZE", "BLEED", "BLEND", "BLESS", "BLIND", "BLINK", "BLISS", "BLOCK", "BLOND", "BLOOD", "BLOOM", "BLOWN", "BLUES", "BLUNT", "BLUSH", "BOARD", "BOAST", "BOATS", "BONUS", "BOOST", "BOOTH", "BOUND", "BRAIN", "BRAKE", "BRAND", "BRASS", "BRAVE", "BREAD", "BREAK", "BREED", "BRICK", "BRIDE", "BRIEF", "BRING", "BROAD", "BROKE", "BROOK", "BROOM", "BROTH", "BROWN", "BRUSH", "BUILD", "BUILT", "BUNCH", "BURST", "BUYER",
  "CABIN", "CABLE", "CANDY", "CARGO", "CARRY", "CARVE", "CATCH", "CAUSE", "CHAIN", "CHAIR", "CHALK", "CHAMP", "CHAOS", "CHARM", "CHART", "CHASE", "CHEAP", "CHEAT", "CHECK", "CHEEK", "CHEER", "CHESS", "CHEST", "CHICK", "CHIEF", "CHILD", "CHILL", "CHINA", "CHIRP", "CHORD", "CHOSE", "CHUNK", "CINCH", "CIVIL", "CLAIM", "CLAMP", "CLASH", "CLASP", "CLASS", "CLEAN", "CLEAR", "CLERK", "CLICK", "CLIFF", "CLIMB", "CLING", "CLOAK", "CLOCK", "CLONE", "CLOSE", "CLOTH", "CLOUD", "CLOWN", "COACH", "COAST", "COLON", "COLOR", "COMET", "COMIC", "COMMA", "CONCH", "CORAL", "COUCH", "COUGH", "COUNT", "COURT", "COVER", "CRACK", "CRAFT", "CRANE", "CRASH", "CRAWL", "CRAZE", "CRAZY", "CREAM", "CREED", "CREEK", "CREEP", "CREST", "CRIME", "CRISP", "CRONE", "CROOK", "CROSS", "CROWD", "CROWN", "CRUDE", "CRUEL", "CRUSH", "CRUST", "CURVE", "CYCLE",
  "LEDGE", "STEAM",
  "CANOPY",
  "ABSORB", "ACCENT", "ACCEPT", "ACCESS", "ACCORD", "ACROSS", "ACTION", "ACTIVE", "ACTUAL", "ADDLED", "ADMIRE", "ADVISE", "AFFECT", "AFFORD", "AFRAID", "AGENDA", "AGREED", "ALBEIT", "AMOUNT", "ANCHOR", "ANNUAL", "ANSWER", "APPEAL", "APPEAR", "ARCADE", "ARGUED", "AROUND", "ARRIVE", "ARTIST", "ASKING", "ASPECT", "ASSERT", "ASSESS", "ASSIGN", "ASSIST", "ASSUME", "ATTACH", "ATTACK", "ATTEND", "AUTHOR", "AVENUE",
  "BACKED", "BAKERY", "BANANA", "BANDED", "BANGER", "BANNER", "BARELY", "BARREN", "BASKET", "BATTEN", "BATTLE", "BEACON", "BEAKER", "BEARER", "BEATEN", "BEAUTY", "BECAME", "BECOME", "BEFORE", "BEHALF", "BEHAVE", "BEHIND", "BELIEF", "BELONG", "BESIDE", "BETTER", "BEYOND", "BIGGER", "BINARY", "BINDER", "BISECT", "BISHOP", "BITTER", "BLANCH", "BLAZER", "BLENDS", "BLIGHT", "BLOCKS", "BLONDE", "BLOODY", "BOARDS", "BOATER", "BODILY", "BOILED", "BOLDER", "BOLTED", "BONNET", "BONNIE", "BONSAI", "BOOKER", "BORDER", "BORING", "BORROW", "BOTTLE", "BOTTOM", "BOUGHT", "BOUNCE", "BOVINE", "BRANCH", "BRANDS", "BREATH", "BRICKS", "BRIDGE", "BRIGHT", "BRINGS", "BRINKS", "BROKEN", "BRONZE", "BROWSE", "BRUISE", "BRUTAL", "BUBBLE", "BUCKET", "BUDGED", "BUDGET", "BUFFED", "BUFFER", "BUFFET", "BUILDS", "BUNDLE", "BUNKER", "BURDEN", "BUREAU", "BURGER", "BURIED", "BURNER", "BUTTON", "BYPASS",
  "CABLES", "CACTUS", "CAESAR", "CALMLY", "CAMPED", "CAMPER", "CAMPUS", "CANCEL", "CANCER", "CANDLE", "CANDOR", "CANNOT", "CANVAS", "CANYON", "CAPITA", "CARBON", "CAREER", "CARING", "CARPET", "CARROT", "CARVED", "CASINO", "CASTLE", "CASUAL", "CAUGHT", "CAUSED", "CAUSAL", "CEMENT", "CENTER", "CEREAL", "CHAINS", "CHAIRS", "CHANCE", "CHANGE", "CHAPEL", "CHARGE", "CHEESE", "CHEQUE", "CHERRY", "CHOICE", "CHOOSE", "CHOSEN", "CHURCH", "CIRCLE", "CIRCUS", "CITIES", "CITING", "CITRUS", "CLAIMS", "CLASSY", "CLAUSE", "CLERGY", "CLEVER", "CLIENT", "CLIMAX", "CLINCH", "CLINIC", "CLIQUE", "CLOSED", "CLOSER", "CLOSET", "CLOUDS", "CLOUDY", "CLUTCH", "COARSE", "COATED", "COBALT", "COBWEB", "COFFEE", "COHERE", "COINED", "COLDLY", "COLLAR", "COLONY", "COLORS", "COLUMN", "COMEDY", "COMING", "COMMIT", "COMMON", "COMPLY", "CONFER", "CONVEX", "COPIED", "COPPER", "CORNER", "CORONA", "COTTON", "COUNTY", "COUPLE", "COURSE", "COUSIN", "COWARD", "CREATE", "CREDIT", "CRISIS", "CRISPY", "CRITIC", "CRUISE", "CUSTOM",
  "ABILITY", "ABSENCE", "ACADEMY", "ACCOUNT", "ACHIEVE", "ACQUIRE", "ADDRESS", "ADVANCE", "ADVERSE", "ADVISED", "ADVISER", "AFFAIRS", "AFFECTS", "AGAINST", "AIRLINE", "AIRPORT", "ALCOHOL", "ALLEGED", "ALLOWED", "ALREADY", "AMAZING", "AMBIENT", "AMONGST", "ANALYST", "ANALYZE", "ANCIENT", "ANIMALS", "ANOTHER", "ANSWERS", "ANXIETY", "APPEARS", "APPLIED", "APPROVE", "ARCHIVE", "ARRANGE", "ARRIVAL", "ARRIVED", "ARTICLE", "ARTISTS", "ASPECTS", "ASSAULT", "ASSUMED", "ASSURED", "ATTEMPT", "AUTHORS", "AVERAGE", "AWARDED",
  "BACKING", "BALANCE", "BANKING", "BARRIER", "BATTERY", "BEARING", "BEATLES", "BECAUSE", "BECOMES", "BEDROOM", "BELIEVE", "BENEATH", "BENEFIT", "BESIDES", "BETTING", "BETWEEN", "BIGGEST", "BILLION", "BINDING", "BLOCKED", "BOMBING", "BORDERS", "BOROUGH", "BRACKET", "BROTHER", "BROUGHT", "BROWSER", "BUILDER", "BUTTONS",
  "CABINET", "CALLING", "CAPABLE", "CAPITAL", "CAPTAIN", "CAPTURE", "CAREFUL", "CARRIED", "CARRIER", "CATALOG", "CAUTION", "CENTRAL", "CENTURY", "CERTAIN", "CHAMBER", "CHANCES", "CHANNEL", "CHAPTER", "CHARGED", "CHARITY", "CHARTER", "CHEAPER", "CHECKED", "CHICKEN", "CHOICES", "CIRCUIT", "CITIZEN", "CLASSIC", "CLICKED", "CLIMATE", "CLOSING", "CLOSURE", "CLOTHES", "CLUSTER", "COASTAL", "COATING", "COLLECT", "COLLEGE", "COLUMNS", "COMBINE", "COMFORT", "COMMAND", "COMMENT", "COMPACT", "COMPANY", "COMPARE", "COMPETE", "COMPLEX", "CONCEPT", "CONCERN", "CONDUCT", "CONFIRM", "CONNECT", "CONSENT", "CONSIST", "CONTACT", "CONTAIN", "CONTENT", "CONTEST", "CONTEXT", "CONTROL", "CONVERT", "COOKING", "COPYING", "CORRECT", "COUNCIL", "COUNSEL", "COUNTED", "COUNTER", "COUNTRY", "COUPLED", "COURAGE", "COVERED", "CRASHED", "CREATED", "CREATOR", "CREDITS", "CRICKET", "CRIMSON", "CRITICS", "CROSSED", "CRUCIAL", "CRYSTAL", "CULTURE", "CURRENT", "CUSTOMS",
  "ABSOLUTE", "ABSTRACT", "ACADEMIC", "ACCEPTED", "ACCIDENT", "ACCURACY", "ACCURATE", "ACHIEVED", "ACQUIRED", "ACTIVISM", "ACTUALLY", "ADDITION", "ADEQUATE", "ADJACENT", "ADJUSTED", "ADMITTED", "ADOPTION", "ADVANCED", "ADVISORY", "ADVOCATE", "AFFECTED", "AGENCIES", "AIRPLANE", "ALLIANCE", "ALTHOUGH", "ALUMINUM", "ANALYSIS", "ANNOUNCE", "ANYTHING", "ANYWHERE", "APPARENT", "APPEARED", "APPLYING", "APPROACH", "APPROVAL", "APPROVED", "ARGUMENT", "ARRANGED", "ARTISTIC", "ASSEMBLY", "ASSESSED", "ASSIGNED", "ASSISTED", "ASSUMING", "ATHLETIC", "ATTACHED", "ATTAINED", "ATTENDED", "ATTITUDE", "ATTORNEY", "AUDIENCE", "AUTONOMY", "AVIATION", "BACKBONE",
  "BACHELOR", "BACKWARD", "BALANCED", "BARRIERS", "BASEBALL", "BASEMENT", "BATHROOM", "BECOMING", "BEHAVIOR", "BELIEVES", "BELONGED", "BENEFITS", "BETRAYED", "BIBLICAL", "BIRTHDAY", "BORROWED", "BOTHERED", "BOUNDARY", "BRANCHES", "BREAKING", "BREEDING", "BRINGING", "BRISTLED", "BROTHERS", "BROWSERS", "BUILDING", "BULLETIN", "BUSINESS",
  "CALENDAR", "CAMPAIGN", "CAPACITY", "CAPTURED", "CARDINAL", "CARRYING", "CATCHING", "CATEGORY", "CATHOLIC", "CAUTIOUS", "CENTERED", "CEREMONY", "CHAIRMAN", "CHAMBERS", "CHAMPION", "CHAPTERS", "CHARGING", "CHEMICAL", "CHILDREN", "CHOOSING", "CHURCHES", "CIRCULAR", "CITIZENS", "CLAIMING", "CLEARING", "CLIMBING", "CLINICAL", "CLOTHING", "COACHING", "COCKTAIL", "COHERENT", "COLLAPSE", "COLLEGES", "COLONIAL", "COLONIES", "COLORFUL", "COLORADO", "COLUMBIA", "COMBINED", "COMBINES", "COMEBACK", "COMFORTS", "COMMANDS", "COMMERCE", "COMMONLY", "COMMUNAL", "COMMUTER", "COMPARED", "COMPARES", "COMPILED", "COMPLAIN", "COMPLETE", "COMPOSED", "COMPOUND", "COMPRISE", "COMPUTED", "COMPUTER", "CONCEPTS", "CONCERNS", "CONCLUDE", "CONCRETE", "CONDENSE", "CONFINED", "CONFLICT", "CONFUSED", "CONGRESS", "CONNECTS", "CONQUEST", "CONSISTS", "CONSTANT", "CONSUMED", "CONSUMER", "CONTAINS", "CONTEMPT", "CONTENTS", "CONTESTS", "CONTEXTS", "CONTINUE", "CONTRACT", "CONTRAST", "CONTROLS", "CONVERGE", "CONVERTS", "CONVINCE", "COOKBOOK", "COOPERATE", "CORONARY", "CORPORAL", "CORRECTS", "CORRIDOR", "COULDNOT", "COUNCILS", "COUNTING", "COUNTIES", "COUNTERS", "COUNTIES", "COUPLING", "COVERAGE", "COVERING", "COWARDLY", "CREATION", "CREATIVE", "CREATORS", "CREATURE", "CREDITED", "CRIMINAL", "CRITICAL", "CRITIQUE", "CROSSING", "CRYSTALS", "CUCUMBER", "CULTURAL", "CULTURES", "CURRENCY", "CUSTOMER", "CYLINDER",
  "DAD", "DAM", "DEN", "DEW", "DIG", "DIM", "DIP", "DOC", "DOG", "DOT", "DRY", "DUB", "DUE", "DUG", "DYE",
  "EAR", "EAT", "EEL", "EGG", "ELF", "ELK", "ELM", "EMU", "END", "ERA", "ERR", "EVE", "EWE", "EYE",
  "FAD", "FAN", "FAR", "FAT", "FAX", "FED", "FEE", "FEW", "FIG", "FIN", "FIT", "FIX", "FLY", "FOB", "FOG", "FOP", "FOR", "FOX", "FRY", "FUN", "FUR",
  "GAB", "GAG", "GAP", "GAS", "GEL", "GEM", "GET", "GIG", "GIN", "GNU", "GOB", "GOD", "GOT", "GUM", "GUN", "GUT", "GUY", "GYM",
  "HAD", "HAM", "HAS", "HAT", "HAY", "HEM", "HEN", "HER", "HEW", "HID", "HIM", "HIP", "HIS", "HIT", "HOB", "HOG", "HOP", "HOT", "HOW", "HUB", "HUE", "HUG", "HUM", "HUT",
  "ICE", "ICY", "ILL", "IMP", "INK", "INN", "ION", "IRE", "IRK", "ITS", "IVY",
  "JAB", "JAG", "JAM", "JAR", "JAW", "JAY", "JET", "JIG", "JOB", "JOG", "JOT", "JOY", "JUG", "JUT",
  "KEG", "KEN", "KEY", "KID", "KIN", "KIT",
  "LAB", "LAC", "LAD", "LAG", "LAP", "LAW", "LAX", "LAY", "LEA", "LED", "LEG", "LET", "LID", "LIE", "LIP", "LIT", "LOG", "LOT", "LOW", "LUG",
  "MAD", "MAN", "MAP", "MAR", "MAT", "MAW", "MAY", "MEN", "MET", "MID", "MIX", "MOB", "MOM", "MOP", "MOW", "MUD", "MUG", "MUM",
  "NAB", "NAG", "NAP", "NAY", "NET", "NEW", "NIL", "NIT", "NOB", "NOD", "NOR", "NOT", "NOW", "NUB", "NUN", "NUT",
  "OAK", "OAR", "OAT", "ODD", "ODE", "OFF", "OFT", "OHM", "OIL", "OLD", "ONE", "OPT", "ORB", "ORE", "OUR", "OUT", "OWE", "OWL", "OWN",
  "PAD", "PAL", "PAN", "PAP", "PAR", "PAT", "PAW", "PAY", "PEA", "PEG", "PEN", "PEP", "PER", "PET", "PEW", "PIE", "PIG", "PIN", "PIT", "PLY", "POD", "POP", "POT", "POW", "PRY", "PUB", "PUG", "PUN", "PUP", "PUS", "PUT",
  "RAG", "RAM", "RAN", "RAP", "RAT", "RAW", "RAY", "RED", "REF", "REP", "RIB", "RID", "RIG", "RIM", "RIP", "ROB", "ROD", "ROE", "ROT", "ROW", "RUB", "RUG", "RUM", "RUN", "RUT", "RYE",
  "SAC", "SAD", "SAG", "SAP", "SAT", "SAW", "SAY", "SEA", "SET", "SEW", "SHE", "SHY", "SIN", "SIP", "SIR", "SIS", "SIT", "SIX", "SKI", "SKY", "SLY", "SOB", "SOD", "SON", "SOP", "SOT", "SOW", "SOY", "SPA", "SPY", "STY", "SUB", "SUM", "SUN", "SUP",
  "TAB", "TAD", "TAG", "TAN", "TAP", "TAR", "TAT", "TAX", "TEA", "TEN", "THE", "THY", "TIC", "TIE", "TIN", "TIP", "TOE", "TON", "TOO", "TOP", "TOT", "TOW", "TOY", "TRY", "TUB", "TUG", "TWO",
  "URN", "USE",
  "VAN", "VAT", "VET", "VIA", "VIE", "VOW",
  "WAD", "WAG", "WAR", "WAS", "WAX", "WAY", "WEB", "WED", "WET", "WHO", "WHY", "WIG", "WIN", "WIT", "WOE", "WOK", "WON", "WOO", "WOW",
  "YAK", "YAM", "YAP", "YAW", "YEA", "YEN", "YES", "YET", "YEW", "YIN", "YIP", "YOU", "YOW",
  "ZAP", "ZEN", "ZIP", "ZIT", "ZOO",
  "DAMP", "DARE", "DARK", "DASH", "DATA", "DATE", "DAWN", "DAYS", "DEAD", "DEAF", "DEAL", "DEAN", "DEAR", "DEBT", "DECK", "DEED", "DEEM", "DEEP", "DEER", "DEMO", "DENY", "DESK", "DIAL", "DICE", "DIED", "DIET", "DINE", "DIRT", "DISC", "DISH", "DISK", "DIVE", "DOCK", "DOES", "DOLL", "DOME", "DONE", "DOOM", "DOOR", "DOSE", "DOTH", "DOTS", "DOWN", "DOZE", "DRAB", "DRAG", "DRAW", "DREW", "DROP", "DRUG", "DRUM", "DUAL", "DUCK", "DUCT", "DUDE", "DUEL", "DUKE", "DULL", "DULY", "DUMB", "DUMP", "DUNE", "DUNK", "DUSK", "DUST", "DUTY",
  "EACH", "EARL", "EARN", "EASE", "EAST", "EASY", "ECHO", "EDGE", "EDIT", "ELSE", "EMIT", "ENDS", "EPIC", "EURO", "EVEN", "EVER", "EVIL", "EXAM", "EXEC", "EXIT", "EXPO", "EYES",
  "FACE", "FACT", "FADE", "FAIL", "FAIR", "FAKE", "FALL", "FAME", "FANS", "FARE", "FARM", "FAST", "FATE", "FAWN", "FEAR", "FEAT", "FEED", "FEEL", "FEES", "FEET", "FELL", "FELT", "FEND", "FERN", "FEST", "FEUD", "FIBER", "FIEF", "FIFE", "FILE", "FILL", "FILM", "FIND", "FINE", "FIRE", "FIRM", "FISH", "FIST", "FIVE", "FLAG", "FLAIR", "FLAK", "FLAME", "FLAP", "FLAT", "FLAW", "FLEA", "FLED", "FLEE", "FLEX", "FLIP", "FLIT", "FLOG", "FLOP", "FLOW", "FLUX", "FOAM", "FOES", "FOLD", "FOLK", "FOND", "FONT", "FOOD", "FOOL", "FOOT", "FORD", "FORE", "FORK", "FORM", "FORT", "FOUL", "FOUR", "FOWL", "FREE", "FRET", "FROG", "FROM", "FUEL", "FULL", "FUME", "FUND", "FUNK", "FURY", "FUSE", "FUSS", "FUZZ",
  "GAIN", "GAIT", "GALE", "GALL", "GAME", "GANG", "GAPE", "GARB", "GATE", "GAVE", "GAWK", "GAZE", "GEAR", "GEMS", "GENE", "GERM", "GETS", "GIFT", "GILD", "GIRL", "GIST", "GIVE", "GLAD", "GLAM", "GLEE", "GLEN", "GLIB", "GLOB", "GLOM", "GLOP", "GLOW", "GLUE", "GLUM", "GLUT", "GNAR", "GNAW", "GOAL", "GOAT", "GOES", "GOLD", "GOLF", "GONE", "GONG", "GOOD", "GOOF", "GORE", "GORY", "GOSH", "GOWN", "GRAB", "GRAD", "GRAM", "GRAY", "GREW", "GREY", "GRID", "GRIM", "GRIN", "GRIP", "GRIT", "GROG", "GROW", "GRUB", "GULF", "GULP", "GURU", "GUST", "GUTS", "GUYS", "GYRO",
  "HACK", "HAIL", "HAIR", "HAKE", "HALE", "HALF", "HALL", "HALO", "HALT", "HAND", "HANG", "HANK", "HARD", "HARE", "HARK", "HARM", "HARP", "HASH", "HASP", "HAST", "HATE", "HATH", "HAUL", "HAVE", "HAWK", "HAZE", "HAZY", "HEAD", "HEAL", "HEAP", "HEAR", "HEAT", "HECK", "HEED", "HEEL", "HEFT", "HEIR", "HELD", "HELL", "HELM", "HELP", "HEMP", "HENS", "HERB", "HERD", "HERE", "HERO", "HERS", "HIDE", "HIGH", "HIKE", "HILL", "HILT", "HIND", "HINT", "HIRE", "HISS", "HITS", "HIVE", "HOAX", "HOBS", "HOCK", "HOED", "HOGS", "HOLD", "HOLE", "HOLY", "HOME", "HONE", "HONK", "HOOD", "HOOF", "HOOK", "HOOP", "HOPE", "HOPS", "HORN", "HOST", "HOUR", "HOWL", "HUBS", "HUFF", "HUGE", "HUGS", "HULK", "HULL", "HUMP", "HUMS", "HUNG", "HUNK", "HUNT", "HURL", "HURT", "HUSH", "HUSK", "HUTS", "HYMN",
  "ICON", "IDEA", "IDLE", "IDOL", "IFFY", "INCH", "INFO", "INTO", "IRON", "ISLE", "ITCH", "ITEM", "ITSELF",
  "JABS", "JACK", "JADE", "JAIL", "JAMS", "JANE", "JARS", "JAVA", "JAWS", "JAZZ", "JEAN", "JEER", "JELL", "JERK", "JEST", "JETS", "JIFF", "JIGS", "JILT", "JINX", "JOBS", "JOCK", "JOGS", "JOIN", "JOKE", "JOLT", "JOSH", "JOTS", "JOYS", "JUDO", "JUGS", "JUKE", "JUMP", "JUNE", "JUNK", "JURY", "JUST", "JUTS",
  "KALE", "KEEN", "KEEP", "KEGS", "KELP", "KEPT", "KEYS", "KICK", "KIDS", "KILL", "KILN", "KILT", "KIND", "KING", "KINK", "KISS", "KITE", "KITS", "KNEE", "KNEW", "KNIT", "KNOB", "KNOT", "KNOW",
  "BALE", "BARD", "BAST", "BIND", "BODE", "DALE", "DARN", "DIRE", "DOLE", "GIRD", "GIRT", "GOAD", "HOSE", "LAVE", "MALE", "MAST", "MELT", "MICE", "MILE", "MIND", "MINE", "MODE", "MOLD", "MOLE", "MORE", "NICE", "NODE", "NOSE", "OPAL", "PAIL", "PALE", "POKE", "POLE", "PORE", "POSE", "RACE", "REST", "RICE", "RIDE", "RIPE", "RODE", "ROLE", "ROSE", "SALE", "SAND", "SIRE", "SOLD", "SOLE", "SORE", "TAIL", "TALE", "TALL", "TEAL", "TELL", "TIRE", "TOLD", "TONE", "VALE", "VICE", "VOLE", "WALE", "WAND", "WARD", "WARN", "WARM", "WELT", "WIND", "WIRE", "WOKE", "WORD", "WORE", "YARD", "YARN", "YOKE",
  "LACE", "LACK", "LACY", "LADS", "LADY", "LAID", "LAIR", "LAKE", "LAMB", "LAME", "LAMP", "LAND", "LANE", "LAPS", "LARD", "LARK", "LASH", "LASS", "LAST", "LATE", "LAUD", "LAVA", "LAWN", "LAWS", "LAYS", "LAZY", "LEAD", "LEAF", "LEAK", "LEAN", "LEAP", "LEFT", "LEND", "LENS", "LENT", "LESS", "LEST", "LEVY", "LIAR", "LICE", "LICK", "LIDS", "LIED", "LIEN", "LIES", "LIEU", "LIFE", "LIFT", "LIKE", "LILY", "LIMB", "LIME", "LIMP", "LINE", "LINK", "LINT", "LION", "LIPS", "LIST", "LIVE", "LOAD", "LOAF", "LOAN", "LOBE", "LOCK", "LOFT", "LOGO", "LOGS", "LONE", "LONG", "LOOK", "LOOM", "LOOP", "LOOT", "LORD", "LORE", "LOSE", "LOSS", "LOST", "LOTS", "LOUD", "LOVE", "LUCK", "LUMP", "LUNG", "LURE", "LURK", "LUSH", "LUST",
  "ADVENTURE", "WONDERFUL", "CELEBRATE", "FANTASTIC", "BEAUTIFUL", "IMPORTANT", "CHALLENGE", "CONFIDENT", "KEYBOARD", "TRANSPORT", "EDUCATION", "SOMETHING", "PASSENGER", "MOUNTAIN", "GENEROUS", "INTERVIEW", "UMBRELLA", "DAUGHTER", "ORDINARY", "PAINTING", "HOSPITAL"
];

export const wordLengthConfig: WordLengthConfig = {
  wordsPerLevel: 20,
  timePerLevel: 120
};

export const letterPositionConfig: LetterPositionConfig = {
  wordsPerLevel: 20,
  timePerLevel: 120
};

export const letterHuntConfig: LetterHuntConfig = {
  wordsPerLevel: 20,
  timePerLevel: 120,
  letterSets: [
    ["E", "T", "A"],
    ["R", "S", "I"],
    ["O", "N", "E"],
    ["C", "A", "R"],
    ["L", "I", "T"],
    ["B", "E", "D"],
    ["M", "A", "N"],
    ["S", "T", "A"],
    ["P", "L", "A"],
    ["D", "I", "N"]
  ]
};

export const wordChainConfig: WordChainConfig = {
  wordsPerLevel: 100,
  timePerWord: 10
};

export const vowelConsonantConfig: VowelConsonantConfig = {
  wordsPerRound: 20,
  timePerWord: 12
};

export const wordStackPuzzles: WordStackPuzzle[] = [
  { targetWord: "PERSONAL", startWord: "OR", hint: "Relating to an individual" },
  { targetWord: "STARTING", startWord: "AT", hint: "Beginning something" },
  { targetWord: "STRANGER", startWord: "AN", hint: "Someone you don't know" },
  { targetWord: "CREATING", startWord: "AT", hint: "Making something new" },
  { targetWord: "PLEASANT", startWord: "AS", hint: "Enjoyable or agreeable" },
  { targetWord: "TEACHING", startWord: "AT", hint: "Educating others" },
  { targetWord: "REACHING", startWord: "IN", hint: "Extending towards" },
  { targetWord: "BREAKING", startWord: "IN", hint: "Causing to separate" },
  { targetWord: "TREATING", startWord: "AT", hint: "Dealing with something" },
  { targetWord: "CLEANING", startWord: "AN", hint: "Making tidy" },
];

export const wordSplitPuzzles: WordSplitPuzzle[] = [
  { targetWord: "EDUCATION", hint: "Process of learning" },
  { targetWord: "CANOPY", hint: "An overhead covering or shelter" },
  { targetWord: "FORESTRY", hint: "Science of managing forests" },
  { targetWord: "STEAM", hint: "Water vapor from boiling" },
  { targetWord: "COPULATE", hint: "To come together" },
  { targetWord: "CAPITAL", hint: "Chief city or wealth" },
  { targetWord: "KNOWLEDGE", hint: "Information and understanding" },
  { targetWord: "MASTER", hint: "An expert or leader" },
  { targetWord: "CARPET", hint: "Floor covering material" },
  { targetWord: "CASTLE", hint: "A large fortified building" },
  { targetWord: "PLANET", hint: "A celestial body orbiting a star" },
  { targetWord: "BASKET", hint: "Container made of woven material" },
  { targetWord: "GARDEN", hint: "Area for growing plants" },
  { targetWord: "FROZEN", hint: "Turned into ice" },
  { targetWord: "SILVER", hint: "A shiny precious metal" },
  { targetWord: "BRIDGE", hint: "Structure spanning over water" },
  { targetWord: "MARKET", hint: "Place for buying and selling" },
  { targetWord: "ANCHOR", hint: "Heavy device to hold a ship" },
  { targetWord: "TEMPLE", hint: "A place of worship" },
  { targetWord: "HONEST", hint: "Truthful and sincere" },
];

export const progressiveRevealWords: ProgressiveRevealWord[] = [
  { word: "ELEPHANT", subcategory: "Large land animal" },
  { word: "MERCURY", subcategory: "Planet in our solar system" },
  { word: "CINNAMON", subcategory: "Baking spice" },
  { word: "TORNADO", subcategory: "Severe weather event" },
  { word: "PYRAMID", subcategory: "Ancient structure" },
  { word: "DOLPHIN", subcategory: "Ocean mammal" },
  { word: "VOLCANO", subcategory: "Geological formation" },
  { word: "HARVEST", subcategory: "Farming activity" },
  { word: "COMPASS", subcategory: "Navigation tool" },
  { word: "LANTERN", subcategory: "Light source" },
  { word: "CRIMSON", subcategory: "Shade of red" },
  { word: "WHISTLE", subcategory: "Sound-making object" },
  { word: "GLACIER", subcategory: "Ice formation" },
  { word: "CABINET", subcategory: "Household furniture" },
  { word: "SPARROW", subcategory: "Common bird" },
  { word: "DIAMOND", subcategory: "Precious gemstone" },
  { word: "MUSTARD", subcategory: "Condiment" },
  { word: "CHARCOAL", subcategory: "Grilling fuel" },
  { word: "BLANKET", subcategory: "Bedroom item" },
  { word: "PENGUIN", subcategory: "Flightless bird" },
  { word: "SAPPHIRE", subcategory: "Blue gemstone" },
  { word: "HAMMOCK", subcategory: "Outdoor relaxation" },
  { word: "TRUMPET", subcategory: "Brass instrument" },
  { word: "LEOPARD", subcategory: "Big cat" },
  { word: "AVOCADO", subcategory: "Green fruit" },
  { word: "BLIZZARD", subcategory: "Winter storm" },
  { word: "CHANDELIER", subcategory: "Ceiling light fixture" },
  { word: "JASMINE", subcategory: "Fragrant flower" },
  { word: "SERPENT", subcategory: "Reptile" },
  { word: "TITANIUM", subcategory: "Strong metal" },
];

// Precomputed shell word data (words where inner = word.slice(1,-1) is also valid)
const _dictSet = new Set(wordDictionary);

export const shellWordSet: Set<string> = (() => {
  const result = new Set<string>();
  for (const word of wordDictionary) {
    if (word.length >= 4 && _dictSet.has(word.slice(1, -1))) {
      result.add(word);
    }
  }
  return result;
})();

export interface ShellWordPuzzle {
  middle: string;
  wrappers: string[];
}

export const shellWordPuzzles: ShellWordPuzzle[] = (() => {
  const middleMap = new Map<string, string[]>();
  for (const word of shellWordSet) {
    const inner = word.slice(1, -1);
    if (!middleMap.has(inner)) middleMap.set(inner, []);
    middleMap.get(inner)!.push(word);
  }
  const result: ShellWordPuzzle[] = [];
  for (const [middle, wrappers] of middleMap.entries()) {
    if (wrappers.length >= 3) {
      result.push({ middle, wrappers });
    }
  }
  return result;
})();

export interface CrackPuzzle {
  first: string;
  last: string;
}

export const crackPuzzles: CrackPuzzle[] = (() => {
  const pairCount = new Map<string, number>();
  for (const word of shellWordSet) {
    const key = `${word[0]}-${word[word.length - 1]}`;
    pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
  }
  const result: CrackPuzzle[] = [];
  for (const [key, count] of pairCount.entries()) {
    if (count >= 2) {
      const [first, last] = key.split("-");
      result.push({ first, last });
    }
  }
  return result;
})();

export const deepShellWordSet: Set<string> = (() => {
  const result = new Set<string>();
  for (const word of wordDictionary) {
    if (word.length >= 7 && _dictSet.has(word.slice(2, -2))) {
      result.add(word);
    }
  }
  return result;
})();

export interface DeepShellWordPuzzle {
  middle: string;
  wrappers: string[];
}

export const deepShellWordPuzzles: DeepShellWordPuzzle[] = (() => {
  const middleMap = new Map<string, string[]>();
  for (const word of deepShellWordSet) {
    const inner = word.slice(2, -2);
    if (!middleMap.has(inner)) middleMap.set(inner, []);
    middleMap.get(inner)!.push(word);
  }
  const result: DeepShellWordPuzzle[] = [];
  for (const [middle, wrappers] of middleMap.entries()) {
    if (wrappers.length >= 3) {
      result.push({ middle, wrappers });
    }
  }
  return result;
})();

export interface DeepCrackPuzzle {
  first: string;
  last: string;
}

export const deepCrackPuzzles: DeepCrackPuzzle[] = (() => {
  const pairCount = new Map<string, number>();
  for (const word of deepShellWordSet) {
    const key = `${word.slice(0, 2)}-${word.slice(-2)}`;
    pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
  }
  const result: DeepCrackPuzzle[] = [];
  for (const [key, count] of pairCount.entries()) {
    if (count >= 2) {
      const dashIdx = key.indexOf("-");
      result.push({ first: key.slice(0, dashIdx), last: key.slice(dashIdx + 1) });
    }
  }
  return result;
})();

export const gamesData: Game[] = [
  {
    id: 1,
    slug: "word-ladder",
    name: "Word Ladder",
    description: "Change one letter at a time to climb from the start word to the target word!",
    longDescription: "Transform one word into another, one letter at a time! You're given a start word and a target word. Each step, change exactly one letter to form a new valid word. Can you find the shortest path? Beat par for bonus points, and discover all the possible routes!",
    rules: [
      "You're given a start word at the top and a target word at the bottom",
      "Change exactly one letter at a time to form a new valid word",
      "Each word in the ladder must be a real English word",
      "Try to reach the target in as few steps as possible",
      "Beat par (the optimal number of steps) for bonus points!",
      "Use hints to reveal the next word in the optimal path (costs points)"
    ],
    difficulty: "medium",
    estimatedTime: "3-5 min",
    icon: "GitBranch",
    color: "hsl(262, 83%, 58%)",
    playCount: 15420
  },
  {
    id: 2,
    slug: "anagram-solver",
    name: "Anagram Solver",
    description: "Use the given word to find all possible anagrams.",
    longDescription: "Challenge yourself with anagram puzzles! You'll be shown a word, and your task is to find all the anagram variations that can be formed from its letters. How many can you discover?",
    rules: [
      "You are given a base word",
      "Enter all the anagrams you can find",
      "Each anagram uses the exact same letters",
      "Find all anagrams to complete the round",
      "Build streaks for bonus points"
    ],
    difficulty: "easy",
    estimatedTime: "2-3 min",
    icon: "Shuffle",
    color: "hsl(158, 64%, 40%)",
    playCount: 12850
  },
  {
    id: 3,
    slug: "word-scramble",
    name: "Word Scramble",
    description: "Unscramble letters to reveal hidden words before running out of lives.",
    longDescription: "Test your word unscrambling skills in this fast-paced game! Each round presents you with a scrambled word and a category hint. Type the correct word to score points and advance through levels. But be careful - you only have 3 lives, so wrong answers cost you dearly!",
    rules: [
      "Unscramble the letters to form the hidden word",
      "Use the category hint to guide your guess",
      "Type your answer and press Enter or click Submit",
      "You have 3 lives - wrong answers lose a life",
      "Complete words to level up and earn bonus points"
    ],
    difficulty: "hard",
    estimatedTime: "5-10 min",
    icon: "Puzzle",
    color: "hsl(35, 92%, 50%)",
    playCount: 8930
  },
  {
    id: 4,
    slug: "definition-match",
    name: "Definition Match",
    description: "Read the definition and guess the word it describes.",
    longDescription: "Expand your vocabulary in this definition-based word game! You'll be shown a definition and must figure out which word it describes. The part of speech is provided as a hint. Score points for each correct answer and build your streak for bonus points. Perfect for vocabulary building!",
    rules: [
      "Read the definition carefully",
      "Type the word that matches the definition",
      "Part of speech is shown as a hint",
      "Case doesn't matter - just spell it right!",
      "Build streaks for bonus points"
    ],
    difficulty: "medium",
    estimatedTime: "3-5 min",
    icon: "BookOpen",
    color: "hsl(210, 70%, 50%)",
    playCount: 7650
  },
  {
    id: 5,
    slug: "letter-pool",
    name: "Letter Pool",
    description: "Spell out hidden words letter by letter — choose Pool mode or go Blind!",
    longDescription: "All letters are hidden — spell each word from left to right, one letter at a time. Choose 'With Pool' mode to see scrambled letters as a reference (click or type), or go 'Without Pool' for the ultimate blind challenge. Correct letters fill in with a satisfying sound, wrong ones cost a life. Request a hint to reveal the category, but it costs points!",
    rules: [
      "Two modes: With Pool (see scrambled letters) or Without Pool (blind)",
      "Type or click any letter that belongs in the word",
      "Correct letters snap into their correct position automatically",
      "Spell letters in order (left to right) for bonus points!",
      "Wrong letters cost a life — you have 3 lives",
      "Request a hint to see the word's category (costs 20% of points)"
    ],
    difficulty: "medium",
    estimatedTime: "4-6 min",
    icon: "LayoutGrid",
    color: "hsl(340, 75%, 55%)",
    playCount: 6420
  },
  {
    id: 6,
    slug: "word-maker",
    name: "Word Maker",
    description: "Create as many words as you can from a given set of letters.",
    longDescription: "How many words can you make? You're given a base word, and your challenge is to form as many smaller words as possible using only its letters. Each letter can only be used once per word. Find all the target words to win!",
    rules: [
      "Form words using letters from the base word",
      "Each letter can only be used once per word",
      "Words must be at least 3 letters long",
      "Find the target number of words to win",
      "Duplicate words don't count"
    ],
    difficulty: "hard",
    estimatedTime: "5-8 min",
    icon: "Sparkles",
    color: "hsl(280, 65%, 55%)",
    playCount: 5890
  },
  {
    id: 7,
    slug: "word-length",
    name: "Length Challenge",
    description: "Form words of specific lengths with different constraint variations.",
    longDescription: "Challenge yourself with word length puzzles! Choose from 5 different variations, each with unique constraints. Form 20 valid words matching your chosen variation's requirements before time runs out!",
    rules: [
      "Choose from 5 different challenge variations",
      "Variation 1: Form words of a specific length",
      "Variation 2: Same length + must start with a specific letter",
      "Variation 3: Same length + must end with a specific letter",
      "Variation 4: Same length + starts with letter + contains letter",
      "Variation 5: Same length + ends with letter + contains letter",
      "Complete 20 words per variation"
    ],
    difficulty: "hard",
    estimatedTime: "8-12 min",
    icon: "Ruler",
    color: "hsl(190, 70%, 45%)",
    playCount: 4250,
    hasSurvival: true,
  },
  {
    id: 8,
    slug: "letter-position",
    name: "Position Master",
    description: "Find words with the right letter at the right position!",
    longDescription: "Put your word knowledge to the ultimate test! You'll be given a position number and a letter - form words where that letter appears exactly at that position. Choose from 2 challenge variations to test your skills!",
    rules: [
      "Form words with the given letter at the specified position",
      "Challenge 1: Same constraint for all 20 words",
      "Challenge 2: Constraint changes after each correct word",
      "Words must be valid English words",
      "Beat the clock to complete the challenge"
    ],
    difficulty: "hard",
    estimatedTime: "6-10 min",
    icon: "MapPin",
    color: "hsl(45, 85%, 50%)",
    playCount: 3890,
    hasSurvival: true,
  },
  {
    id: 9,
    slug: "letter-hunt",
    name: "Letter Hunt",
    description: "Find words with exact letter counts - match the pattern!",
    longDescription: "Think you know your words? You'll be given a set of required letters, and your challenge is to find words that contain exactly those letters - no more, no less! Choose from 6 challenge variations with 2-6 required letters, or try Advanced mode where the letters change after each correct word.",
    rules: [
      "Find words containing the required letters",
      "Words must have EXACTLY the right count of each letter",
      "Example: If 'A' appears once, your word must have exactly 1 'A'",
      "Challenges 1-5: Fixed letter count (2-6 letters)",
      "Advanced: Random letter count, changes after each correct word",
      "Words must be valid English words"
    ],
    difficulty: "medium",
    estimatedTime: "6-10 min",
    icon: "Search",
    color: "hsl(320, 70%, 50%)",
    playCount: 4120,
    hasSurvival: true,
  },
  {
    id: 10,
    slug: "word-chain",
    name: "Word Chain",
    description: "Create words using the ending letters of the previous word in a back-and-forth chain.",
    longDescription: "Engage in a word chain battle! We give you a word, and you must form a new word starting with its last letter (or last two letters in advanced modes). The chain goes back and forth - we respond with our word, and you counter. Complete 100 words per level to advance! Quick thinking required as the timer runs for each word.",
    rules: [
      "Variation 1, Level 1: Your word must start with the last letter of our word",
      "Variation 1, Level 2: Same as above, plus your word must match our word's length",
      "Variation 2, Level 1: Your word must start with the last TWO letters of our word",
      "Variation 2, Level 2: Same as above, plus your word must match our word's length",
      "Complete 100 valid words per level to advance",
      "Beat the timer for each word or lose!"
    ],
    difficulty: "hard",
    estimatedTime: "10-15 min",
    icon: "Link",
    color: "hsl(170, 65%, 45%)",
    playCount: 3560,
    hasSurvival: true,
  },
  {
    id: 11,
    slug: "letter-balance",
    name: "Letter Balance",
    description: "Form words based on vowel and consonant requirements across many variations.",
    longDescription: "Master the art of balancing vowels and consonants! Choose your challenge from multiple variations - form words with specific numbers of vowels or consonants, or words that start/end with certain letter types. Each variation offers a unique puzzle!",
    rules: [
      "Choose from 5 different challenge variations",
      "Consonant Count: Words with exactly 2, 3, or 4 consonants",
      "Vowel Count: Words with exactly 2, 3, or 4 vowels",
      "Start & End Consonant: Words beginning and ending with consonants",
      "Start Vowel, End Consonant: Words starting with a vowel, ending with a consonant",
      "Start Consonant, End Vowel: Words starting with a consonant, ending with a vowel",
      "Complete 20 words per round across 5 rounds"
    ],
    difficulty: "medium",
    estimatedTime: "8-12 min",
    icon: "Type",
    color: "hsl(250, 65%, 55%)",
    playCount: 3240
  },
  {
    id: 12,
    slug: "letter-frequency",
    name: "Letter Frequency",
    description: "Find words where a specific letter appears exactly N times!",
    longDescription: "Test your vocabulary with letter frequency challenges! You'll be given a letter and a count - form words where that letter appears exactly that many times. Progress through increasingly difficult challenges from 2 occurrences up to 5+!",
    rules: [
      "Form words with the required letter appearing exactly the specified number of times",
      "Challenge 1: Find words with exactly 2 occurrences of a letter",
      "Challenge 2: Find words with exactly 3 occurrences",
      "Challenge 3: Find words with exactly 4 occurrences",
      "Challenge 4: Find words with 5+ occurrences",
      "Challenge Random: Frequency changes after each correct word",
      "Words must be valid English words"
    ],
    difficulty: "hard",
    estimatedTime: "6-10 min",
    icon: "Hash",
    color: "hsl(320, 70%, 50%)",
    playCount: 0,
    hasSurvival: true,
  },
  {
    id: 13,
    slug: "word-stack",
    name: "Word Stack",
    description: "Build words one letter at a time from a 2-letter base to the target word!",
    longDescription: "Stack your way to the target! Start with a 2-letter word and build up by adding one letter at a time. Each new word must contain all the letters from the previous word. Can you reach the top of the stack?",
    rules: [
      "Start with a given 2-letter word",
      "Add one letter to form a new valid word",
      "Each word must contain all letters from the previous word",
      "Continue until you reach the target word length",
      "Use the hint to guide you toward the target word"
    ],
    difficulty: "hard",
    estimatedTime: "5-8 min",
    icon: "Layers",
    color: "hsl(25, 85%, 55%)",
    playCount: 0
  },
  {
    id: 14,
    slug: "no-repeats",
    name: "No Repeats",
    description: "Find words where every letter is unique - no repeating letters allowed!",
    longDescription: "Challenge your vocabulary with words that have no repeating letters! From 3-letter words to 9-letter masterpieces, every letter in your word must be different. Can you think of words without any duplicate letters?",
    rules: [
      "Enter words where every letter is unique (no letter appears more than once)",
      "Challenge 3: Find 3-letter words with all unique letters",
      "Challenge 4: Find 4-letter words with all unique letters",
      "Challenge 5-9: Progressively longer words with unique letters",
      "Words must be valid English words",
      "Score points based on word length - longer words earn more!"
    ],
    difficulty: "medium",
    estimatedTime: "5-8 min",
    icon: "Fingerprint",
    color: "hsl(180, 70%, 45%)",
    playCount: 0,
    hasSurvival: true,
  },
  {
    id: 15,
    slug: "word-split",
    name: "Word Split",
    description: "Split a word into smaller valid words that use all its letters!",
    longDescription: "Can you break a word apart? You'll be shown a target word, and your challenge is to find smaller words whose letters combine to spell the target word exactly. Each letter can only be used once across all your words. Think strategically - some splits might leave impossible leftovers!",
    rules: [
      "You are given a target word to split",
      "Find smaller words whose letters add up to the target word",
      "Each letter in the target word can only be used once",
      "Words must be at least 2 letters long",
      "You need at least 2 words to complete a split",
      "All letters must be covered - no leftovers allowed"
    ],
    difficulty: "hard",
    estimatedTime: "5-10 min",
    icon: "Scissors",
    color: "hsl(15, 80%, 50%)",
    playCount: 0
  },
  {
    id: 16,
    slug: "progressive-reveal",
    name: "Progressive Reveal",
    description: "Reveal letters one at a time and guess the word before you run out!",
    longDescription: "All the letters are hidden behind tiles. You know the category and how many letters the word has - that's it. Tap any tile to reveal the letter underneath, but each reveal costs you points. Can you figure out the word with the fewest reveals for the highest score? Be careful though - wrong guesses cost a life!",
    rules: [
      "All letters start hidden behind tiles",
      "You see the category and word length as your only clues",
      "Tap any tile to reveal the letter underneath",
      "Each reveal reduces your potential score for that word",
      "Type your guess when you think you know the word",
      "Wrong guesses cost a life - you have 3 lives",
      "Fewer reveals = higher score"
    ],
    difficulty: "hard",
    estimatedTime: "5-8 min",
    icon: "Eye",
    color: "hsl(270, 65%, 55%)",
    playCount: 0
  },
  {
    id: 17,
    slug: "word-sweep",
    name: "Word Sweep",
    description: "Select letters from a grid to form words and clear the board!",
    longDescription: "A grid of letters awaits! Pick any letters from anywhere on the board to spell words. Valid words clear those letters from the grid, and remaining letters collapse downward. Use strategy to create chain reactions of new word possibilities. Can you clear the entire grid for a perfect score?",
    rules: [
      "A 6x6 grid is filled with random letters",
      "Click any letters from anywhere on the grid to spell a word",
      "Words must be at least 3 letters long",
      "Valid words clear those letters from the grid",
      "Remaining letters collapse downward to fill gaps",
      "Use the shuffle button (3 uses) to rearrange letters when stuck",
      "Longer words earn exponentially more points",
      "Clear the entire grid for a massive bonus"
    ],
    difficulty: "medium",
    estimatedTime: "5-10 min",
    icon: "Grid3X3",
    color: "hsl(200, 70%, 50%)",
    playCount: 0,
    modes: [
      { label: "Classic", slug: "word-sweep" },
      { label: "Guided", slug: "word-unpack" },
    ],
  },
  {
    id: 18,
    slug: "word-roots",
    name: "Word Roots",
    description: "Find the parent word that all the given derivatives come from!",
    longDescription: "Can you reverse-engineer a word? You'll be shown 5 derivative words and your challenge is to find a parent word that contains all of them. Any valid word works — as long as all 5 derivatives can be formed from its letters. But can you find our exact word for a bonus?",
    rules: [
      "You're shown 5 derivative words as clues",
      "Find a parent word whose letters can spell all 5 derivatives",
      "Each letter in your word can be used as many times as it appears",
      "Any valid dictionary word that satisfies all clues is accepted",
      "Match our intended word exactly for a bonus 50 points!",
      "Complete 5 rounds in 3 minutes"
    ],
    difficulty: "medium",
    estimatedTime: "3-5 min",
    icon: "TreePine",
    color: "hsl(142, 60%, 40%)",
    playCount: 0
  },
  {
    id: 19,
    slug: "ladder-rush",
    name: "Ladder Rush",
    description: "Build the longest word chain you can — change one letter at a time before the clock runs out!",
    longDescription: "Race against the clock in this fast-paced word chain game! Starting from a given word, change exactly one letter at a time to form a new valid word. Keep the chain going as long as possible in 90 seconds. Choose your difficulty: 4-letter words for a speedy warm-up, 5-letter for a real challenge, or 6-letter words for expert mode. Every word you chain adds to your score!",
    rules: [
      "Choose your word length: 4 letters (Easy), 5 letters (Medium), or 6 letters (Hard)",
      "You are given a starting word",
      "Change exactly ONE letter at a time to form a new valid word",
      "The changed letter must be in the same position — no rearranging!",
      "You have 90 seconds — chain as many words as possible",
      "Each word in the chain must be a real English word",
      "Words already used in your chain cannot be reused",
      "Score = number of words you chain beyond the starting word"
    ],
    difficulty: "hard",
    estimatedTime: "1-2 min",
    icon: "Zap",
    color: "hsl(38, 92%, 50%)",
    playCount: 0,
    hasSurvival: true,
    modes: [
      { label: "Easy (4L)", slug: "ladder-rush-4" },
      { label: "Medium (5L)", slug: "ladder-rush-5" },
      { label: "Hard (6L)", slug: "ladder-rush-6" },
    ],
  },
  {
    id: 20,
    slug: "ladder-rush-double",
    name: "Ladder Rush: Double Swap",
    description: "Change two letters at a time and chain as many words as possible before the clock runs out!",
    longDescription: "A faster, wider version of Ladder Rush! Starting from a given word, change exactly two letters at a time to form a new valid word. More possible neighbors means longer chains — but you still need to think quick. Choose 4, 5, or 6-letter words, and tackle Classic or Survival mode.",
    rules: [
      "Choose your word length: 4 letters (Easy), 5 letters (Medium), or 6 letters (Hard)",
      "You are given a starting word",
      "Change exactly TWO letters at a time to form a new valid word",
      "Changes are counted by letter frequency — no rearranging the same letters",
      "You have 90 seconds — chain as many words as possible",
      "Each word in the chain must be a real English word",
      "Words already used in your chain cannot be reused",
      "Score = number of words you chain beyond the starting word"
    ],
    difficulty: "medium",
    estimatedTime: "1-2 min",
    icon: "Zap",
    color: "hsl(38, 92%, 50%)",
    playCount: 0,
    hasSurvival: true,
    modes: [
      { label: "Easy (4L)", slug: "ladder-rush-double-4" },
      { label: "Medium (5L)", slug: "ladder-rush-double-5" },
      { label: "Hard (6L)", slug: "ladder-rush-double-6" },
    ],
  },
  {
    id: 21,
    slug: "shell-words",
    name: "Shell Words",
    description: "Find words that hide another word inside — remove the first and last letter to reveal it!",
    longDescription: "A hidden word lurks inside every shell word! Remove the first and last letter of any valid word to reveal the inner word. For example, MORALE → ORAL, BRAND → RAN, GRAPE → RAP. Three variations: Blitz (find shell words freely), Wrapper (given an inner word, find the shells), and Crack (given boundary letters, find the inner word). Each variation has Classic and Survival sub-modes.",
    rules: [
      "A shell word is a word where removing the first AND last letter reveals another valid word",
      "Example: BRAND → RAN, MORALE → ORAL, GRAPE → RAP",
      "Blitz: Enter as many shell words as you can — Classic gives 90 seconds, Survival resets an 8s clock per word",
      "Wrapper: Given an inner word, find outer shells — Classic finds all in 2 min, Survival gives 8s per wrapper",
      "Crack: Given boundary letters (e.g. B and D), type a word that fits in the middle to form a shell word",
      "Crack Classic: 10 rounds at your own pace. Crack Survival: 8s per boundary pair",
      "The server validates all words — the dictionary never leaves the server",
    ],
    difficulty: "medium",
    estimatedTime: "2-3 min",
    icon: "Shell",
    color: "hsl(175, 60%, 40%)",
    playCount: 0,
    modes: [
      { label: "Blitz", slug: "shell-words" },
      { label: "Blitz Survival", slug: "shell-words-blitz-survival" },
      { label: "Wrapper", slug: "shell-words-guided" },
      { label: "Wrapper Survival", slug: "shell-words-wrapper-survival" },
      { label: "Crack", slug: "shell-words-crack" },
      { label: "Crack Survival", slug: "shell-words-crack-survival" },
    ],
  },
  {
    id: 22,
    slug: "deep-shell-words",
    name: "Deep Shell Words",
    description: "Strip the first two and last two letters to reveal the hidden inner word — a deeper challenge!",
    longDescription: "A more devious twist on Shell Words! Remove the first TWO and last TWO letters of any valid word to reveal a hidden inner word. For example, STRANGER → RANG, SPLINTER → LINT, SPRINGER → RING. Three variations: Blitz (find deep shell words freely), Wrapper (given an inner word, find the shells), and Crack (given two boundary letters on each side, find the inner word). Each variation has Classic and Survival sub-modes.",
    rules: [
      "A deep shell word is a word where removing the first TWO AND last TWO letters reveals another valid word",
      "Example: STRANGER → RANG, SPLINTER → LINT, SPRINGER → RING",
      "Words must be at least 7 letters long (2 outer + 3 inner + 2 outer)",
      "Blitz: Enter as many deep shell words as you can — Classic gives 90 seconds, Survival resets an 8s clock per word",
      "Wrapper: Given an inner word, find outer shells — Classic finds all in 2 min, Survival gives 8s per wrapper",
      "Crack: Given two boundary letters on each side, type a word that fits in the middle to form a deep shell word",
      "Crack Classic: 10 rounds at your own pace. Crack Survival: 8s per boundary pair",
      "The server validates all words — the dictionary never leaves the server",
    ],
    difficulty: "hard",
    estimatedTime: "2-3 min",
    icon: "Shell",
    color: "hsl(200, 70%, 40%)",
    playCount: 0,
    modes: [
      { label: "Blitz", slug: "deep-shell-words" },
      { label: "Blitz Survival", slug: "deep-shell-words-blitz-survival" },
      { label: "Wrapper", slug: "deep-shell-words-guided" },
      { label: "Wrapper Survival", slug: "deep-shell-words-wrapper-survival" },
      { label: "Crack", slug: "deep-shell-words-crack" },
      { label: "Crack Survival", slug: "deep-shell-words-crack-survival" },
    ],
  }
];
