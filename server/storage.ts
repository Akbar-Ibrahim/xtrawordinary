import type { Game, AnagramWordSet, ScrambleWord, DefinitionWord, BuilderWord, MakerWord, WordLengthConfig, LetterPositionConfig, ContainsConfig } from "@shared/schema";

export interface IStorage {
  getGames(): Promise<Game[]>;
  getGameBySlug(slug: string): Promise<Game | undefined>;
  getWordGuessingWords(): Promise<string[]>;
  getAnagramWordSets(): Promise<AnagramWordSet[]>;
  getScrambleWords(): Promise<ScrambleWord[]>;
  getDefinitionWords(): Promise<DefinitionWord[]>;
  getBuilderWords(): Promise<BuilderWord[]>;
  getMakerWords(): Promise<MakerWord[]>;
  getWordDictionary(): Promise<string[]>;
  validateWord(word: string): Promise<boolean>;
  getWordLengthConfig(): Promise<WordLengthConfig>;
  getLetterPositionConfig(): Promise<LetterPositionConfig>;
  getContainsConfig(): Promise<ContainsConfig>;
}

// Word Guessing words (5-letter words)
const wordGuessingWords: string[] = [
  "REACT", "SOUND", "BRAIN", "FLAME", "CRISP", 
  "GRADE", "PLANT", "SWIFT", "GLOBE", "QUEST"
];

// Anagram Solver word sets
const anagramWordSets: AnagramWordSet[] = [
  { original: "LISTEN", anagram: "SILENT", hint: "Without sound" },
  { original: "DANGER", anagram: "GARDEN", hint: "A place to grow flowers" },
  { original: "EARTH", anagram: "HEART", hint: "It pumps blood" },
  { original: "DUSTY", anagram: "STUDY", hint: "What students do" },
  { original: "NIGHT", anagram: "THING", hint: "An object or item" },
  { original: "ANGEL", anagram: "ANGLE", hint: "Geometry term" },
  { original: "SAVES", anagram: "VASES", hint: "Hold flowers" },
  { original: "BORED", anagram: "ROBED", hint: "Wearing a robe" },
];

// Word Scramble words with categories
const scrambleWords: ScrambleWord[] = [
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

// Definition Match words
const definitionWords: DefinitionWord[] = [
  { word: "LUMINOUS", definition: "Emitting or reflecting light; shining brightly", partOfSpeech: "adjective" },
  { word: "EPHEMERAL", definition: "Lasting for a very short time; fleeting", partOfSpeech: "adjective" },
  { word: "ELOQUENT", definition: "Fluent or persuasive in speaking or writing", partOfSpeech: "adjective" },
  { word: "RESILIENT", definition: "Able to recover quickly from difficulties", partOfSpeech: "adjective" },
  { word: "SERENE", definition: "Calm, peaceful, and untroubled", partOfSpeech: "adjective" },
  { word: "OBSCURE", definition: "Not clearly expressed or easily understood", partOfSpeech: "adjective" },
  { word: "MEANDER", definition: "To follow a winding course; to wander aimlessly", partOfSpeech: "verb" },
  { word: "PONDER", definition: "To think about something carefully before making a decision", partOfSpeech: "verb" },
  { word: "CHERISH", definition: "To protect and care for lovingly; to hold dear", partOfSpeech: "verb" },
  { word: "FLOURISH", definition: "To grow or develop in a healthy or vigorous way", partOfSpeech: "verb" },
];

// Word Builder words (first and last letters shown)
const builderWords: BuilderWord[] = [
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

// Word Maker words (form words from base word)
const makerWords: MakerWord[] = [
  { 
    baseWord: "CREATIVE", 
    derivatives: ["CREATE", "CRATE", "RATE", "TEAR", "CARE", "RACE", "ACRE", "CART", "RICE", "VICE", "TRACE", "REACT", "CATER"],
    maxWords: 10
  },
  { 
    baseWord: "ADVENTURE", 
    derivatives: ["ADVENT", "TRADE", "VENT", "RENT", "DENT", "TEND", "RUDE", "TRUE", "NUDE", "TURN", "UNDER", "NERVE", "TUNED"],
    maxWords: 10
  },
  { 
    baseWord: "WONDERFUL", 
    derivatives: ["WONDER", "WORD", "FORD", "FLOW", "FLEW", "FOND", "FOLD", "LONE", "ROLE", "DUNE", "NUDE", "FOUNDER", "LOWER"],
    maxWords: 10
  },
  { 
    baseWord: "CELEBRATE", 
    derivatives: ["CELEB", "CREATE", "ELECT", "BERATE", "BEER", "TREE", "FREE", "ABLE", "CABLE", "TABLE", "REBEL", "ALERT", "LATER"],
    maxWords: 10
  },
  { 
    baseWord: "FANTASTIC", 
    derivatives: ["FAST", "CAST", "FACT", "FIST", "SAINT", "STAIN", "SATIN", "FAINT", "ANTIC", "STATIC", "NASTY", "FANCY", "TITAN"],
    maxWords: 10
  },
  { 
    baseWord: "BEAUTIFUL", 
    derivatives: ["BEAT", "FEAT", "ABLE", "TABLE", "FABLE", "FAIL", "TAIL", "BAIT", "FATAL", "FAULT", "FLUTE", "FUTILE", "LIFE"],
    maxWords: 10
  },
];

// Shared word dictionary for validation-based games (Word Length, Letter Position, Contains)
const wordDictionary: string[] = [
  // 3-letter words
  "ACE", "ACT", "ADD", "AGE", "AID", "AIM", "AIR", "ALL", "AND", "ANT", "ANY", "APE", "ARC", "ARE", "ARK", "ARM", "ART", "ASH", "ATE",
  // 4-letter words
  "ABLE", "ACHE", "AGED", "AIDE", "AJAR", "ALSO", "AMID", "ARCH", "AREA", "ARMY", "AUNT", "AUTO", "AWAY", "BACK", "BAKE", "BALL", "BAND", "BANK", "BARE", "BARK", "BARN", "BASE", "BATH", "BEAR", "BEAT", "BEEN", "BEER", "BELL", "BELT", "BEND", "BENT", "BEST", "BIKE", "BIRD", "BITE", "BLOW", "BLUE", "BOAT", "BODY", "BOLD", "BOLT", "BOMB", "BOND", "BONE", "BOOK", "BOOM", "BOOT", "BORE", "BORN", "BOSS", "BOTH", "BOWL", "BULK", "BURN", "BURY", "BUSH", "BUSY", "CAFE", "CAGE", "CAKE", "CALL", "CALM", "CAME", "CAMP", "CAPE", "CARD", "CARE", "CART", "CASE", "CASH", "CAST", "CAVE", "CHEF", "CHEW", "CHIN", "CHIP", "CITY", "CLAM", "CLAP", "CLAW", "CLAY", "CLIP", "CLUB", "CLUE", "COAL", "COAT", "CODE", "COIL", "COIN", "COLD", "COME", "CONE", "COOK", "COOL", "COPE", "COPY", "CORD", "CORE", "CORN", "COST", "COZY", "CRAB", "CREW", "CROP", "CROW", "CUBE", "CURE", "CURL", "CUTE",
  // 5-letter words
  "ABOUT", "ABOVE", "ABUSE", "ACTOR", "ADAPT", "ADMIT", "ADOPT", "ADULT", "AFTER", "AGAIN", "AGENT", "AGREE", "AHEAD", "ALARM", "ALBUM", "ALERT", "ALIEN", "ALIGN", "ALIKE", "ALIVE", "ALLEY", "ALLOW", "ALLOY", "ALONE", "ALONG", "ALPHA", "ALTER", "AMAZE", "AMONG", "AMPLE", "ANGEL", "ANGER", "ANGLE", "ANGRY", "ANKLE", "APART", "APPLE", "APPLY", "ARENA", "ARGUE", "ARISE", "ARMOR", "AROMA", "ARROW", "ASIDE", "ASSET", "ATTIC", "AUDIO", "AVOID", "AWAKE", "AWARD", "AWARE", "AWFUL",
  "BADGE", "BAKER", "BEARD", "BEAST", "BEGIN", "BEING", "BELOW", "BENCH", "BERRY", "BIRDS", "BIRTH", "BLACK", "BLADE", "BLAME", "BLAND", "BLANK", "BLAZE", "BLEED", "BLEND", "BLESS", "BLIND", "BLINK", "BLISS", "BLOCK", "BLOND", "BLOOD", "BLOOM", "BLOWN", "BLUES", "BLUNT", "BLUSH", "BOARD", "BOAST", "BOATS", "BONUS", "BOOST", "BOOTH", "BOUND", "BRAIN", "BRAKE", "BRAND", "BRASS", "BRAVE", "BREAD", "BREAK", "BREED", "BRICK", "BRIDE", "BRIEF", "BRING", "BROAD", "BROKE", "BROOK", "BROOM", "BROTH", "BROWN", "BRUSH", "BUILD", "BUILT", "BUNCH", "BURST", "BUYER",
  "CABIN", "CABLE", "CANDY", "CARGO", "CARRY", "CARVE", "CATCH", "CAUSE", "CHAIN", "CHAIR", "CHALK", "CHAMP", "CHAOS", "CHARM", "CHART", "CHASE", "CHEAP", "CHEAT", "CHECK", "CHEEK", "CHEER", "CHESS", "CHEST", "CHICK", "CHIEF", "CHILD", "CHILL", "CHINA", "CHIRP", "CHORD", "CHOSE", "CHUNK", "CINCH", "CIVIL", "CLAIM", "CLAMP", "CLASH", "CLASP", "CLASS", "CLEAN", "CLEAR", "CLERK", "CLICK", "CLIFF", "CLIMB", "CLING", "CLOAK", "CLOCK", "CLONE", "CLOSE", "CLOTH", "CLOUD", "CLOWN", "COACH", "COAST", "COLON", "COLOR", "COMET", "COMIC", "COMMA", "CONCH", "CORAL", "COUCH", "COUGH", "COUNT", "COURT", "COVER", "CRACK", "CRAFT", "CRANE", "CRASH", "CRAWL", "CRAZE", "CRAZY", "CREAM", "CREED", "CREEK", "CREEP", "CREST", "CRIME", "CRISP", "CRONE", "CROOK", "CROSS", "CROWD", "CROWN", "CRUDE", "CRUEL", "CRUSH", "CRUST", "CURVE", "CYCLE",
  // 6-letter words
  "ABSORB", "ACCENT", "ACCEPT", "ACCESS", "ACCORD", "ACROSS", "ACTION", "ACTIVE", "ACTUAL", "ADDLED", "ADMIRE", "ADVISE", "AFFECT", "AFFORD", "AFRAID", "AGENDA", "AGREED", "ALBEIT", "AMOUNT", "ANCHOR", "ANNUAL", "ANSWER", "APPEAL", "APPEAR", "ARCADE", "ARGUED", "AROUND", "ARRIVE", "ARTIST", "ASKING", "ASPECT", "ASSERT", "ASSESS", "ASSIGN", "ASSIST", "ASSUME", "ATTACH", "ATTACK", "ATTEND", "AUTHOR", "AVENUE",
  "BACKED", "BAKERY", "BANANA", "BANDED", "BANGER", "BANNER", "BARELY", "BARREN", "BASKET", "BATTEN", "BATTLE", "BEACON", "BEAKER", "BEARER", "BEATEN", "BEAUTY", "BECAME", "BECOME", "BEFORE", "BEHALF", "BEHAVE", "BEHIND", "BELIEF", "BELONG", "BESIDE", "BETTER", "BEYOND", "BIGGER", "BINARY", "BINDER", "BISECT", "BISHOP", "BITTER", "BLANCH", "BLAZER", "BLENDS", "BLIGHT", "BLOCKS", "BLONDE", "BLOODY", "BOARDS", "BOATER", "BODILY", "BOILED", "BOLDER", "BOLTED", "BONNET", "BONNIE", "BONSAI", "BOOKER", "BORDER", "BORING", "BORROW", "BOTTLE", "BOTTOM", "BOUGHT", "BOUNCE", "BOVINE", "BRANCH", "BRANDS", "BREATH", "BRICKS", "BRIDGE", "BRIGHT", "BRINGS", "BRINKS", "BROKEN", "BRONZE", "BROWSE", "BRUISE", "BRUTAL", "BUBBLE", "BUCKET", "BUDGED", "BUDGET", "BUFFED", "BUFFER", "BUFFET", "BUILDS", "BUNDLE", "BUNKER", "BURDEN", "BUREAU", "BURGER", "BURIED", "BURNER", "BUTTON", "BYPASS",
  "CABLES", "CACTUS", "CAESAR", "CALMLY", "CAMPED", "CAMPER", "CAMPUS", "CANCEL", "CANCER", "CANDLE", "CANDOR", "CANNOT", "CANVAS", "CANYON", "CAPITA", "CARBON", "CAREER", "CARING", "CARPET", "CARROT", "CARVED", "CASINO", "CASTLE", "CASUAL", "CAUGHT", "CAUSED", "CAUSAL", "CEMENT", "CENTER", "CEREAL", "CHAINS", "CHAIRS", "CHANCE", "CHANGE", "CHAPEL", "CHARGE", "CHEESE", "CHEQUE", "CHERRY", "CHOICE", "CHOOSE", "CHOSEN", "CHURCH", "CIRCLE", "CIRCUS", "CITIES", "CITING", "CITRUS", "CLAIMS", "CLASSY", "CLAUSE", "CLERGY", "CLEVER", "CLIENT", "CLIMAX", "CLINCH", "CLINIC", "CLIQUE", "CLOSED", "CLOSER", "CLOSET", "CLOUDS", "CLOUDY", "CLUTCH", "COARSE", "COATED", "COBALT", "COBWEB", "COFFEE", "COHERE", "COINED", "COLDLY", "COLLAR", "COLONY", "COLORS", "COLUMN", "COMEDY", "COMING", "COMMIT", "COMMON", "COMPLY", "CONFER", "CONVEX", "COPIED", "COPPER", "CORNER", "CORONA", "COTTON", "COUNTY", "COUPLE", "COURSE", "COUSIN", "COWARD", "CREATE", "CREDIT", "CRISIS", "CRISPY", "CRITIC", "CRUISE", "CUSTOM",
  // 7-letter words
  "ABILITY", "ABSENCE", "ACADEMY", "ACCOUNT", "ACHIEVE", "ACQUIRE", "ADDRESS", "ADVANCE", "ADVERSE", "ADVISED", "ADVISER", "AFFAIRS", "AFFECTS", "AGAINST", "AIRLINE", "AIRPORT", "ALCOHOL", "ALLEGED", "ALLOWED", "ALREADY", "AMAZING", "AMBIENT", "AMONGST", "ANALYST", "ANALYZE", "ANCIENT", "ANIMALS", "ANOTHER", "ANSWERS", "ANXIETY", "APPEARS", "APPLIED", "APPROVE", "ARCHIVE", "ARRANGE", "ARRIVAL", "ARRIVED", "ARTICLE", "ARTISTS", "ASPECTS", "ASSAULT", "ASSUMED", "ASSURED", "ATTEMPT", "AUTHORS", "AVERAGE", "AWARDED",
  "BACKING", "BALANCE", "BANKING", "BARRIER", "BATTERY", "BEARING", "BEATLES", "BECAUSE", "BECOMES", "BEDROOM", "BELIEVE", "BENEATH", "BENEFIT", "BESIDES", "BETTING", "BETWEEN", "BIGGEST", "BILLION", "BINDING", "BLOCKED", "BOMBING", "BORDERS", "BOROUGH", "BRACKET", "BROTHER", "BROUGHT", "BROWSER", "BUILDER", "BUTTONS",
  "CABINET", "CALLING", "CAPABLE", "CAPITAL", "CAPTAIN", "CAPTURE", "CAREFUL", "CARRIED", "CARRIER", "CATALOG", "CAUTION", "CENTRAL", "CENTURY", "CERTAIN", "CHAMBER", "CHANCES", "CHANNEL", "CHAPTER", "CHARGED", "CHARITY", "CHARTER", "CHEAPER", "CHECKED", "CHICKEN", "CHOICES", "CIRCUIT", "CITIZEN", "CLASSIC", "CLICKED", "CLIMATE", "CLOSING", "CLOSURE", "CLOTHES", "CLUSTER", "COASTAL", "COATING", "COLLECT", "COLLEGE", "COLUMNS", "COMBINE", "COMFORT", "COMMAND", "COMMENT", "COMPACT", "COMPANY", "COMPARE", "COMPETE", "COMPLEX", "CONCEPT", "CONCERN", "CONDUCT", "CONFIRM", "CONNECT", "CONSENT", "CONSIST", "CONTACT", "CONTAIN", "CONTENT", "CONTEST", "CONTEXT", "CONTROL", "CONVERT", "COOKING", "COPYING", "CORRECT", "COUNCIL", "COUNSEL", "COUNTED", "COUNTER", "COUNTRY", "COUPLED", "COURAGE", "COVERED", "CRASHED", "CREATED", "CREATOR", "CREDITS", "CRICKET", "CRIMSON", "CRITICS", "CROSSED", "CRUCIAL", "CRYSTAL", "CULTURE", "CURRENT", "CUSTOMS",
  // 8-letter words
  "ABSOLUTE", "ABSTRACT", "ACADEMIC", "ACCEPTED", "ACCIDENT", "ACCURACY", "ACCURATE", "ACHIEVED", "ACQUIRED", "ACTIVISM", "ACTUALLY", "ADDITION", "ADEQUATE", "ADJACENT", "ADJUSTED", "ADMITTED", "ADOPTION", "ADVANCED", "ADVISORY", "ADVOCATE", "AFFECTED", "AGENCIES", "AIRPLANE", "ALLIANCE", "ALTHOUGH", "ALUMINUM", "ANALYSIS", "ANNOUNCE", "ANYTHING", "ANYWHERE", "APPARENT", "APPEARED", "APPLYING", "APPROACH", "APPROVAL", "APPROVED", "ARGUMENT", "ARRANGED", "ARTISTIC", "ASSEMBLY", "ASSESSED", "ASSIGNED", "ASSISTED", "ASSUMING", "ATHLETIC", "ATTACHED", "ATTAINED", "ATTENDED", "ATTITUDE", "ATTORNEY", "AUDIENCE", "AUTONOMY", "AVIATION", "BACKBONE",
  "BACHELOR", "BACKWARD", "BALANCED", "BARRIERS", "BASEBALL", "BASEMENT", "BATHROOM", "BECOMING", "BEHAVIOR", "BELIEVES", "BELONGED", "BENEFITS", "BETRAYED", "BIBLICAL", "BIRTHDAY", "BORROWED", "BOTHERED", "BOUNDARY", "BRANCHES", "BREAKING", "BREEDING", "BRINGING", "BRISTLED", "BROTHERS", "BROWSERS", "BUILDING", "BULLETIN", "BUSINESS",
  "CALENDAR", "CAMPAIGN", "CAPACITY", "CAPTURED", "CARDINAL", "CARRYING", "CATCHING", "CATEGORY", "CATHOLIC", "CAUTIOUS", "CENTERED", "CEREMONY", "CHAIRMAN", "CHAMBERS", "CHAMPION", "CHAPTERS", "CHARGING", "CHEMICAL", "CHILDREN", "CHOOSING", "CHURCHES", "CIRCULAR", "CITIZENS", "CLAIMING", "CLEARING", "CLIMBING", "CLINICAL", "CLOTHING", "COACHING", "COCKTAIL", "COHERENT", "COLLAPSE", "COLLEGES", "COLONIAL", "COLONIES", "COLORFUL", "COLORADO", "COLUMBIA", "COMBINED", "COMBINES", "COMEBACK", "COMFORTS", "COMMANDS", "COMMERCE", "COMMONLY", "COMMUNAL", "COMMUTER", "COMPARED", "COMPARES", "COMPILED", "COMPLAIN", "COMPLETE", "COMPOSED", "COMPOUND", "COMPRISE", "COMPUTED", "COMPUTER", "CONCEPTS", "CONCERNS", "CONCLUDE", "CONCRETE", "CONDENSE", "CONFINED", "CONFLICT", "CONFUSED", "CONGRESS", "CONNECTS", "CONQUEST", "CONSISTS", "CONSTANT", "CONSUMED", "CONSUMER", "CONTAINS", "CONTEMPT", "CONTENTS", "CONTESTS", "CONTEXTS", "CONTINUE", "CONTRACT", "CONTRAST", "CONTROLS", "CONVERGE", "CONVERTS", "CONVINCE", "COOKBOOK", "COOPERATE", "CORONARY", "CORPORAL", "CORRECTS", "CORRIDOR", "COULDNOT", "COUNCILS", "COUNTING", "COUNTIES", "COUNTERS", "COUNTIES", "COUPLING", "COVERAGE", "COVERING", "COWARDLY", "CREATION", "CREATIVE", "CREATORS", "CREATURE", "CREDITED", "CRIMINAL", "CRITICAL", "CRITIQUE", "CROSSING", "CRYSTALS", "CUCUMBER", "CULTURAL", "CULTURES", "CURRENCY", "CUSTOMER", "CYLINDER"
];

// Word Length game config
const wordLengthConfig: WordLengthConfig = {
  wordsPerLevel: 20,
  timePerLevel: 120 // 2 minutes per level
};

// Letter Position game config
const letterPositionConfig: LetterPositionConfig = {
  wordsPerLevel: 20,
  timePerLevel: 120 // 2 minutes per level
};

// Contains game config - letter sets that words must contain
const containsConfig: ContainsConfig = {
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

const gamesData: Game[] = [
  {
    id: "1",
    slug: "word-guessing",
    name: "Word Guessing",
    description: "Guess the hidden 5-letter word in 6 attempts or less.",
    longDescription: "Put your vocabulary to the test in this classic word guessing game. You have 6 attempts to guess a hidden 5-letter word. After each guess, you'll get feedback showing which letters are correct and in the right position (green), correct but in the wrong position (yellow), or not in the word at all (gray).",
    rules: [
      "Guess the hidden 5-letter word within 6 attempts",
      "Each guess must be a valid 5-letter word",
      "Green letters are correct and in the right position",
      "Yellow letters are in the word but wrong position",
      "Gray letters are not in the word at all"
    ],
    difficulty: "medium",
    estimatedTime: "3-5 min",
    icon: "Target",
    color: "hsl(262, 83%, 58%)",
    playCount: 15420
  },
  {
    id: "2",
    slug: "anagram-solver",
    name: "Anagram Solver",
    description: "Rearrange scrambled letters to form meaningful words.",
    longDescription: "Challenge yourself to unscramble words against the clock! You'll be given a set of jumbled letters, and your task is to rearrange them to form the correct word. Use hints if you get stuck, but be careful - using hints reduces your score. How many can you solve before time runs out?",
    rules: [
      "Rearrange the scrambled letters to form a word",
      "Click letters to select them in order",
      "Use the shuffle button to rearrange the letters",
      "Hints are available but reduce your score by 50 points",
      "Build streaks for bonus points"
    ],
    difficulty: "easy",
    estimatedTime: "2-3 min",
    icon: "Shuffle",
    color: "hsl(158, 64%, 40%)",
    playCount: 12850
  },
  {
    id: "3",
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
    id: "4",
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
    id: "5",
    slug: "word-builder",
    name: "Word Builder",
    description: "Fill in the missing middle letters to complete the word.",
    longDescription: "Put your spelling skills to the test! You'll see the first and last letters of a word, with blanks in between. Use the hint and category to figure out the complete word. The fewer hints you use, the more points you earn!",
    rules: [
      "The first and last letters are revealed",
      "Fill in the missing middle letters",
      "Use the hint for clues about the word's meaning",
      "Category tells you what type of word it is",
      "Score based on speed and accuracy"
    ],
    difficulty: "medium",
    estimatedTime: "4-6 min",
    icon: "PenTool",
    color: "hsl(340, 75%, 55%)",
    playCount: 6420
  },
  {
    id: "6",
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
    id: "7",
    slug: "word-length",
    name: "Length Challenge",
    description: "Form words of a specific length under time pressure across 5 challenging levels.",
    longDescription: "Test your vocabulary breadth in this progressive challenge! Each level adds new constraints - start by forming words of a specific length, then add starting letters, ending letters, and required letters. Can you master all 5 levels before time runs out?",
    rules: [
      "Level 1: Form words of the given length",
      "Level 2: Words must start with a specific letter",
      "Level 3: Words must end with a specific letter",
      "Level 4: Words must start with a letter AND contain another letter",
      "Level 5: Words must end with a letter AND contain another letter",
      "Complete 20 valid words per level to advance"
    ],
    difficulty: "hard",
    estimatedTime: "8-12 min",
    icon: "Ruler",
    color: "hsl(190, 70%, 45%)",
    playCount: 4250
  },
  {
    id: "8",
    slug: "letter-position",
    name: "Position Master",
    description: "Enter words where a specific letter appears at a specific position.",
    longDescription: "Put your word knowledge to the ultimate test! You'll be given a position number and a letter - form words where that letter appears exactly at that position. Level 1 keeps the constraint constant, while Level 2 changes it after every word!",
    rules: [
      "Form words with the given letter at the specified position",
      "Level 1: Same constraint for all 20 words",
      "Level 2: Constraint changes after each correct word",
      "Words must be valid English words",
      "Beat the clock to complete each level"
    ],
    difficulty: "hard",
    estimatedTime: "6-10 min",
    icon: "MapPin",
    color: "hsl(45, 85%, 50%)",
    playCount: 3890
  },
  {
    id: "9",
    slug: "contains-letters",
    name: "Letter Hunt",
    description: "Form words that contain a specific group of letters.",
    longDescription: "Can you think of words containing specific letters? You'll be given a group of letters, and your challenge is to form words that include all of them - in any order! Level 1 uses the same letter group, while Level 2 gives you new letters for each word.",
    rules: [
      "Form words containing all the given letters",
      "Letters can appear in any order within the word",
      "Level 1: Same letter group for all 20 words",
      "Level 2: New letter group after each correct word",
      "Words must be valid English words"
    ],
    difficulty: "medium",
    estimatedTime: "6-10 min",
    icon: "Search",
    color: "hsl(320, 70%, 50%)",
    playCount: 4120
  }
];

export class MemStorage implements IStorage {
  private games: Game[];

  constructor() {
    this.games = gamesData;
  }

  async getGames(): Promise<Game[]> {
    return this.games;
  }

  async getGameBySlug(slug: string): Promise<Game | undefined> {
    return this.games.find((game) => game.slug === slug);
  }

  async getWordGuessingWords(): Promise<string[]> {
    return wordGuessingWords;
  }

  async getAnagramWordSets(): Promise<AnagramWordSet[]> {
    return anagramWordSets;
  }

  async getScrambleWords(): Promise<ScrambleWord[]> {
    return scrambleWords;
  }

  async getDefinitionWords(): Promise<DefinitionWord[]> {
    return definitionWords;
  }

  async getBuilderWords(): Promise<BuilderWord[]> {
    return builderWords;
  }

  async getMakerWords(): Promise<MakerWord[]> {
    return makerWords;
  }

  async getWordDictionary(): Promise<string[]> {
    return wordDictionary;
  }

  async validateWord(word: string): Promise<boolean> {
    return wordDictionary.includes(word.toUpperCase());
  }

  async getWordLengthConfig(): Promise<WordLengthConfig> {
    return wordLengthConfig;
  }

  async getLetterPositionConfig(): Promise<LetterPositionConfig> {
    return letterPositionConfig;
  }

  async getContainsConfig(): Promise<ContainsConfig> {
    return containsConfig;
  }
}

export const storage = new MemStorage();
