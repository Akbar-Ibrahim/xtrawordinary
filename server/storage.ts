import type { Game, AnagramWordSet, ScrambleWord, DefinitionWord, BuilderWord, MakerWord, WordLengthConfig, LetterPositionConfig, ContainsConfig, WordChainConfig, VowelConsonantConfig, WordStackPuzzle } from "@shared/schema";

// Constraint types for games
export type LengthConstraint = {
  length: number;
  startsWith?: string;
  endsWith?: string;
  contains?: string;
};

export type PositionConstraint = {
  position: number;
  letter: string;
};

export type ContainsConstraint = {
  letters: string[];
};

export interface IStorage {
  getGames(): Promise<Game[]>;
  getGameBySlug(slug: string): Promise<Game | undefined>;
  getWordGuessingWords(): Promise<string[]>;
  getAnagramWordSets(): Promise<AnagramWordSet[]>;
  getScrambleWords(): Promise<ScrambleWord[]>;
  getDefinitionWords(): Promise<DefinitionWord[]>;
  getBuilderWords(): Promise<BuilderWord[]>;
  getMakerWords(): Promise<MakerWord[]>;
  getWordStackPuzzles(): Promise<WordStackPuzzle[]>;
  getWordDictionary(): Promise<string[]>;
  validateWord(word: string): Promise<boolean>;
  getWordLengthConfig(): Promise<WordLengthConfig>;
  getLetterPositionConfig(): Promise<LetterPositionConfig>;
  getContainsConfig(): Promise<ContainsConfig>;
  getWordChainConfig(): Promise<WordChainConfig>;
  getVowelConsonantConfig(): Promise<VowelConsonantConfig>;
  // Constraint generation methods
  generateLengthConstraint(level: number): Promise<LengthConstraint>;
  generatePositionConstraint(): Promise<PositionConstraint>;
  generateContainsConstraint(): Promise<ContainsConstraint>;
  // Word Chain methods
  getWordChainStartWord(variation: number, level: number): Promise<string | null>;
  getWordChainComputerWord(playerWord: string, variation: number, level: number, usedWords: string[]): Promise<string | null>;
}

// Word Guessing words (5-letter words)
const wordGuessingWords: string[] = [
  "REACT", "SOUND", "BRAIN", "FLAME", "CRISP", 
  "GRADE", "PLANT", "SWIFT", "GLOBE", "QUEST"
];

// Anagram Solver word sets - new structure with multiple anagrams
const anagramWordSets: AnagramWordSet[] = [
  { original: "SPEAR", anagrams: ["SPARE", "PEARS", "REAPS", "PARES"] },
  { original: "HEART", anagrams: ["EARTH", "HATER", "RATHE"] },
  { original: "LISTEN", anagrams: ["SILENT", "ENLIST", "TINSEL"] },
  { original: "TASTE", anagrams: ["STATE", "TATES"] },
  { original: "NIGHT", anagrams: ["THING"] },
  { original: "ANGEL", anagrams: ["ANGLE", "GLEAN"] },
  { original: "STARE", anagrams: ["TEARS", "RATES", "ASTER"] },
  { original: "STREAM", anagrams: ["MASTER", "TAMERS"] },
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
  "CALENDAR", "CAMPAIGN", "CAPACITY", "CAPTURED", "CARDINAL", "CARRYING", "CATCHING", "CATEGORY", "CATHOLIC", "CAUTIOUS", "CENTERED", "CEREMONY", "CHAIRMAN", "CHAMBERS", "CHAMPION", "CHAPTERS", "CHARGING", "CHEMICAL", "CHILDREN", "CHOOSING", "CHURCHES", "CIRCULAR", "CITIZENS", "CLAIMING", "CLEARING", "CLIMBING", "CLINICAL", "CLOTHING", "COACHING", "COCKTAIL", "COHERENT", "COLLAPSE", "COLLEGES", "COLONIAL", "COLONIES", "COLORFUL", "COLORADO", "COLUMBIA", "COMBINED", "COMBINES", "COMEBACK", "COMFORTS", "COMMANDS", "COMMERCE", "COMMONLY", "COMMUNAL", "COMMUTER", "COMPARED", "COMPARES", "COMPILED", "COMPLAIN", "COMPLETE", "COMPOSED", "COMPOUND", "COMPRISE", "COMPUTED", "COMPUTER", "CONCEPTS", "CONCERNS", "CONCLUDE", "CONCRETE", "CONDENSE", "CONFINED", "CONFLICT", "CONFUSED", "CONGRESS", "CONNECTS", "CONQUEST", "CONSISTS", "CONSTANT", "CONSUMED", "CONSUMER", "CONTAINS", "CONTEMPT", "CONTENTS", "CONTESTS", "CONTEXTS", "CONTINUE", "CONTRACT", "CONTRAST", "CONTROLS", "CONVERGE", "CONVERTS", "CONVINCE", "COOKBOOK", "COOPERATE", "CORONARY", "CORPORAL", "CORRECTS", "CORRIDOR", "COULDNOT", "COUNCILS", "COUNTING", "COUNTIES", "COUNTERS", "COUNTIES", "COUPLING", "COVERAGE", "COVERING", "COWARDLY", "CREATION", "CREATIVE", "CREATORS", "CREATURE", "CREDITED", "CRIMINAL", "CRITICAL", "CRITIQUE", "CROSSING", "CRYSTALS", "CUCUMBER", "CULTURAL", "CULTURES", "CURRENCY", "CUSTOMER", "CYLINDER",
  // Additional words for better Word Chain coverage
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
  // Additional 4-5 letter words for Word Chain and Vowel Master
  "DAMP", "DARE", "DARK", "DASH", "DATA", "DATE", "DAWN", "DAYS", "DEAD", "DEAF", "DEAL", "DEAN", "DEAR", "DEBT", "DECK", "DEED", "DEEM", "DEEP", "DEER", "DEMO", "DENY", "DESK", "DIAL", "DICE", "DIED", "DIET", "DINE", "DIRT", "DISC", "DISH", "DISK", "DIVE", "DOCK", "DOES", "DOLL", "DOME", "DONE", "DOOM", "DOOR", "DOSE", "DOTH", "DOTS", "DOWN", "DOZE", "DRAB", "DRAG", "DRAW", "DREW", "DROP", "DRUG", "DRUM", "DUAL", "DUCK", "DUCT", "DUDE", "DUEL", "DUKE", "DULL", "DULY", "DUMB", "DUMP", "DUNE", "DUNK", "DUSK", "DUST", "DUTY",
  "EACH", "EARL", "EARN", "EASE", "EAST", "EASY", "ECHO", "EDGE", "EDIT", "ELSE", "EMIT", "ENDS", "EPIC", "EURO", "EVEN", "EVER", "EVIL", "EXAM", "EXEC", "EXIT", "EXPO", "EYES",
  "FACE", "FACT", "FADE", "FAIL", "FAIR", "FAKE", "FALL", "FAME", "FANS", "FARE", "FARM", "FAST", "FATE", "FAWN", "FEAR", "FEAT", "FEED", "FEEL", "FEES", "FEET", "FELL", "FELT", "FEND", "FERN", "FEST", "FEUD", "FIBER", "FIEF", "FIFE", "FILE", "FILL", "FILM", "FIND", "FINE", "FIRE", "FIRM", "FISH", "FIST", "FIVE", "FLAG", "FLAIR", "FLAK", "FLAME", "FLAP", "FLAT", "FLAW", "FLEA", "FLED", "FLEE", "FLEX", "FLIP", "FLIT", "FLOG", "FLOP", "FLOW", "FLUX", "FOAM", "FOES", "FOLD", "FOLK", "FOND", "FONT", "FOOD", "FOOL", "FOOT", "FORD", "FORE", "FORK", "FORM", "FORT", "FOUL", "FOUR", "FOWL", "FREE", "FRET", "FROG", "FROM", "FUEL", "FULL", "FUME", "FUND", "FUNK", "FURY", "FUSE", "FUSS", "FUZZ",
  "GAIN", "GAIT", "GALE", "GALL", "GAME", "GANG", "GAPE", "GARB", "GATE", "GAVE", "GAWK", "GAZE", "GEAR", "GEMS", "GENE", "GERM", "GETS", "GIFT", "GILD", "GIRL", "GIST", "GIVE", "GLAD", "GLAM", "GLEE", "GLEN", "GLIB", "GLOB", "GLOM", "GLOP", "GLOW", "GLUE", "GLUM", "GLUT", "GNAR", "GNAW", "GOAL", "GOAT", "GOES", "GOLD", "GOLF", "GONE", "GONG", "GOOD", "GOOF", "GORE", "GORY", "GOSH", "GOWN", "GRAB", "GRAD", "GRAM", "GRAY", "GREW", "GREY", "GRID", "GRIM", "GRIN", "GRIP", "GRIT", "GROG", "GROW", "GRUB", "GULF", "GULP", "GURU", "GUST", "GUTS", "GUYS", "GYRO",
  "HACK", "HAIL", "HAIR", "HAKE", "HALE", "HALF", "HALL", "HALO", "HALT", "HAND", "HANG", "HANK", "HARD", "HARE", "HARK", "HARM", "HARP", "HASH", "HASP", "HAST", "HATE", "HATH", "HAUL", "HAVE", "HAWK", "HAZE", "HAZY", "HEAD", "HEAL", "HEAP", "HEAR", "HEAT", "HECK", "HEED", "HEEL", "HEFT", "HEIR", "HELD", "HELL", "HELM", "HELP", "HEMP", "HENS", "HERB", "HERD", "HERE", "HERO", "HERS", "HIDE", "HIGH", "HIKE", "HILL", "HILT", "HIND", "HINT", "HIRE", "HISS", "HITS", "HIVE", "HOAX", "HOBS", "HOCK", "HOED", "HOGS", "HOLD", "HOLE", "HOLY", "HOME", "HONE", "HONK", "HOOD", "HOOF", "HOOK", "HOOP", "HOPE", "HOPS", "HORN", "HOST", "HOUR", "HOWL", "HUBS", "HUFF", "HUGE", "HUGS", "HULK", "HULL", "HUMP", "HUMS", "HUNG", "HUNK", "HUNT", "HURL", "HURT", "HUSH", "HUSK", "HUTS", "HYMN",
  "ICON", "IDEA", "IDLE", "IDOL", "IFFY", "INCH", "INFO", "INTO", "IRON", "ISLE", "ITCH", "ITEM", "ITSELF",
  "JABS", "JACK", "JADE", "JAIL", "JAMS", "JANE", "JARS", "JAVA", "JAWS", "JAZZ", "JEAN", "JEER", "JELL", "JERK", "JEST", "JETS", "JIFF", "JIGS", "JILT", "JINX", "JOBS", "JOCK", "JOGS", "JOIN", "JOKE", "JOLT", "JOSH", "JOTS", "JOYS", "JUDO", "JUGS", "JUKE", "JUMP", "JUNE", "JUNK", "JURY", "JUST", "JUTS",
  "KALE", "KEEN", "KEEP", "KEGS", "KELP", "KEPT", "KEYS", "KICK", "KIDS", "KILL", "KILN", "KILT", "KIND", "KING", "KINK", "KISS", "KITE", "KITS", "KNEE", "KNEW", "KNIT", "KNOB", "KNOT", "KNOW",
  "LACE", "LACK", "LACY", "LADS", "LADY", "LAID", "LAIR", "LAKE", "LAMB", "LAME", "LAMP", "LAND", "LANE", "LAPS", "LARD", "LARK", "LASH", "LASS", "LAST", "LATE", "LAUD", "LAVA", "LAWN", "LAWS", "LAYS", "LAZY", "LEAD", "LEAF", "LEAK", "LEAN", "LEAP", "LEFT", "LEND", "LENS", "LENT", "LESS", "LEST", "LEVY", "LIAR", "LICE", "LICK", "LIDS", "LIED", "LIEN", "LIES", "LIEU", "LIFE", "LIFT", "LIKE", "LILY", "LIMB", "LIME", "LIMP", "LINE", "LINK", "LINT", "LION", "LIPS", "LIST", "LIVE", "LOAD", "LOAF", "LOAN", "LOBE", "LOCK", "LOFT", "LOGO", "LOGS", "LONE", "LONG", "LOOK", "LOOM", "LOOP", "LOOT", "LORD", "LORE", "LOSE", "LOSS", "LOST", "LOTS", "LOUD", "LOVE", "LUCK", "LUMP", "LUNG", "LURE", "LURK", "LUSH", "LUST"
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

// Word Chain game config (Beginning and End)
const wordChainConfig: WordChainConfig = {
  wordsPerLevel: 100,
  timePerWord: 10 // 10 seconds per word to keep players on their toes
};

// Vowel Consonant game config
const vowelConsonantConfig: VowelConsonantConfig = {
  wordsPerRound: 20,
  timePerWord: 12 // 12 seconds per word
};

// Word Stack puzzles - build from 2-letter word to target word
const wordStackPuzzles: WordStackPuzzle[] = [
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
    playCount: 4250
  },
  {
    id: "8",
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
    playCount: 3890
  },
  {
    id: "9",
    slug: "contains-letters",
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
    playCount: 4120
  },
  {
    id: "10",
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
    playCount: 3560
  },
  {
    id: "11",
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
    id: "12",
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
    playCount: 0
  },
  {
    id: "13",
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
    id: "14",
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
    playCount: 0
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

  async getWordStackPuzzles(): Promise<WordStackPuzzle[]> {
    return wordStackPuzzles;
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

  async getWordChainConfig(): Promise<WordChainConfig> {
    return wordChainConfig;
  }

  async getVowelConsonantConfig(): Promise<VowelConsonantConfig> {
    return vowelConsonantConfig;
  }

  // Generate constraint for Length Challenge game
  async generateLengthConstraint(level: number): Promise<LengthConstraint> {
    const lengths = [5, 6, 7, 8];
    const minWords = 10;
    
    for (const length of lengths) {
      const wordsOfLength = wordDictionary.filter(w => w.length === length);
      if (wordsOfLength.length < minWords) continue;
      
      switch (level) {
        case 1:
          if (wordsOfLength.length >= minWords) {
            return { length };
          }
          break;
        case 2: {
          const startLetters = Array.from(new Set(wordsOfLength.map(w => w[0])));
          for (const letter of startLetters.sort(() => Math.random() - 0.5)) {
            if (wordsOfLength.filter(w => w.startsWith(letter)).length >= minWords) {
              return { length, startsWith: letter };
            }
          }
          break;
        }
        case 3: {
          const endLetters = Array.from(new Set(wordsOfLength.map(w => w[w.length - 1])));
          for (const letter of endLetters.sort(() => Math.random() - 0.5)) {
            if (wordsOfLength.filter(w => w.endsWith(letter)).length >= minWords) {
              return { length, endsWith: letter };
            }
          }
          break;
        }
        case 4: {
          const startLetters = Array.from(new Set(wordsOfLength.map(w => w[0])));
          for (const startLetter of startLetters.sort(() => Math.random() - 0.5)) {
            const matching = wordsOfLength.filter(w => w.startsWith(startLetter));
            if (matching.length >= minWords) {
              const containsLetters = Array.from(new Set(matching.flatMap(w => w.slice(1).split(""))));
              for (const containsLetter of containsLetters.sort(() => Math.random() - 0.5)) {
                if (matching.filter(w => w.slice(1).includes(containsLetter)).length >= minWords) {
                  return { length, startsWith: startLetter, contains: containsLetter };
                }
              }
              return { length, startsWith: startLetter };
            }
          }
          break;
        }
        case 5: {
          const endLetters = Array.from(new Set(wordsOfLength.map(w => w[w.length - 1])));
          for (const endLetter of endLetters.sort(() => Math.random() - 0.5)) {
            const matching = wordsOfLength.filter(w => w.endsWith(endLetter));
            if (matching.length >= minWords) {
              const containsLetters = Array.from(new Set(matching.flatMap(w => w.slice(0, -1).split(""))));
              for (const containsLetter of containsLetters.sort(() => Math.random() - 0.5)) {
                if (matching.filter(w => w.slice(0, -1).includes(containsLetter)).length >= minWords) {
                  return { length, endsWith: endLetter, contains: containsLetter };
                }
              }
              return { length, endsWith: endLetter };
            }
          }
          break;
        }
      }
    }
    return { length: 5 };
  }

  // Generate constraint for Position Master game
  async generatePositionConstraint(): Promise<PositionConstraint> {
    const positions = [2, 3, 4, 5];
    const minWords = 10;
    
    for (const position of positions.sort(() => Math.random() - 0.5)) {
      const validWords = wordDictionary.filter(w => w.length >= position);
      if (validWords.length < minWords) continue;
      
      const letters = Array.from(new Set(validWords.map(w => w[position - 1])));
      for (const letter of letters.sort(() => Math.random() - 0.5)) {
        const matching = validWords.filter(w => w[position - 1] === letter);
        if (matching.length >= minWords) {
          return { position, letter };
        }
      }
    }
    return { position: 2, letter: "A" };
  }

  // Generate constraint for Letter Hunt game
  async generateContainsConstraint(): Promise<ContainsConstraint> {
    const minWords = 10;
    const letterCounts: Record<string, number> = {};
    
    for (const word of wordDictionary) {
      const letters = Array.from(new Set(word.split("")));
      for (const letter of letters) {
        letterCounts[letter] = (letterCounts[letter] || 0) + 1;
      }
    }
    
    const sortedLetters = Object.entries(letterCounts)
      .filter(([_, count]) => count >= minWords)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(([letter]) => letter);
    
    if (sortedLetters.length < 3) {
      return { letters: ["E", "A", "T"] };
    }
    
    const matchingWords = wordDictionary.filter(w => 
      sortedLetters.every(letter => w.includes(letter))
    );
    
    if (matchingWords.length < minWords) {
      const commonLetters = Object.entries(letterCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([letter]) => letter);
      
      for (let i = 0; i < commonLetters.length - 2; i++) {
        for (let j = i + 1; j < commonLetters.length - 1; j++) {
          for (let k = j + 1; k < commonLetters.length; k++) {
            const combo = [commonLetters[i], commonLetters[j], commonLetters[k]];
            const matches = wordDictionary.filter(w => combo.every(l => w.includes(l)));
            if (matches.length >= minWords) {
              return { letters: combo };
            }
          }
        }
      }
      return { letters: [commonLetters[0], commonLetters[1]] };
    }
    
    return { letters: sortedLetters };
  }

  // Get starting word for Word Chain
  async getWordChainStartWord(_variation: number, _level: number): Promise<string | null> {
    // Pick a random word from the dictionary
    if (wordDictionary.length === 0) return null;
    return wordDictionary[Math.floor(Math.random() * wordDictionary.length)];
  }

  // Get computer's response word for Word Chain
  async getWordChainComputerWord(playerWord: string, variation: number, level: number, usedWords: string[]): Promise<string | null> {
    const usedSet = new Set(usedWords.map(w => w.toUpperCase()));
    const upperPlayerWord = playerWord.toUpperCase();
    
    // Find words that start with the required letters (last 1 or 2 letters of player's word)
    const startsWith = variation === 1 ? upperPlayerWord[upperPlayerWord.length - 1] : upperPlayerWord.slice(-2);
    
    let candidates = wordDictionary.filter(w => 
      !usedSet.has(w) && 
      w.startsWith(startsWith)
    );
    
    // Level 2: same length requirement
    if (level === 2) {
      candidates = candidates.filter(w => w.length === upperPlayerWord.length);
    }
    
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
}

export const storage = new MemStorage();
