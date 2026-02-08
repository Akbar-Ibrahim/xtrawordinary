const WIN_MESSAGES: string[] = [
  // Victorian-era aristocrat
  "Most distinguished! Your lexical prowess would make the Queen herself blush with envy.",
  "I daresay, that was a positively splendid exhibition of verbal mastery!",
  "One must commend your extraordinary command of the English tongue. Bravo, good soul!",
  "The Royal Society of Letters would be honored to count you among their ranks.",
  "How frightfully impressive! You've conducted yourself with the utmost linguistic elegance.",
  "I shall inform the Lord Chancellor at once - a wordsmith of rare caliber has been found!",
  "Your performance was nothing short of exquisite. The Empire salutes you.",
  "By Jove, what a magnificent display of cerebral fortitude!",

  // Gen Z lingo
  "No cap, you absolutely ate that and left no crumbs.",
  "That was lowkey fire. Actually, no - highkey fire.",
  "You understood the assignment. Main character energy right there.",
  "Slay! You really said 'vocabulary is my whole personality' and delivered.",
  "Rent free in the leaderboard's head. You're built different.",
  "It's giving... genius? Yeah, it's giving genius.",
  "POV: You're actually cracked at word games.",
  "That performance was bussin'. Respectfully.",

  // Melodrama
  "Against all odds, through storms of consonants and seas of vowels, you have TRIUMPHED!",
  "The heavens parted! The angels wept! For today, a word game has truly been CONQUERED!",
  "Let the poets write of this day! Let the bards sing of your glorious victory!",
  "From the ashes of uncertainty, you rose like a phoenix of pure vocabulary!",
  "This isn't just a win. This is a SAGA. An EPIC. A LEGEND written in letters!",
  "I'm not crying, you're crying! What a beautiful, magnificent performance!",
  "Somewhere, a single tear rolls down a dictionary's spine. It's a tear of pride.",
  "The orchestra swells! The curtain falls! A standing ovation for the ages!",

  // Mob boss
  "You made those words an offer they couldn't refuse. Respect.",
  "I like how you handle business. Consider yourself a friend of the family.",
  "That was clean work. Very professional. The Don would be proud.",
  "You came, you saw, you conquered. Just like I taught ya.",
  "Word on the street is you're the real deal. The evidence speaks for itself.",
  "You've earned your bones today, kid. Welcome to the inner circle.",
  "Nobody does it smoother than you. That's why you're the boss.",
  "Fuggedaboutit! You just ran this game like it was your territory.",

  // Famous quotes / pop culture
  "In the immortal words of every underdog movie: 'You did it, you crazy son of a gun, you did it!'",
  "'I came, I saw, I conquered.' - Julius Caesar, and also you, just now.",
  "'To infinity and beyond!' - Buzz Lightyear approves of your score.",
  "As they say in The Hunger Games: the odds were in your favor today.",
  "'It's over 9000!' - Your vocabulary power level, probably.",
  "'After all this time? Always.' - Your dedication to word games, apparently.",
  "'I am inevitable.' - You, walking into this word game.",
  "'That's one small step for a player, one giant leap for word-kind.'",

  // Playful arrest/incarceration threats
  "You're under arrest for aggravated word mastery. You have the right to remain awesome.",
  "BREAKING NEWS: Local word game player detained for crimes against the dictionary. Too good.",
  "We're placing you under vocabulary surveillance. This level of skill is suspicious.",
  "The Word Police have been notified. You're wanted for first-degree brilliance.",
  "Hands where I can see them! That performance was criminally good.",
  "You've been sentenced to life... as a word game champion. No appeals.",
  "911, I'd like to report a robbery. Someone just stole every point available.",
  "This level of talent should be illegal. We're filing charges.",

  // Paranoid
  "You won?! How did you... wait, are you reading the dictionary in your sleep?",
  "I'm starting to think you've been secretly training for this your whole life.",
  "Suspicious. Very suspicious. Nobody's this good without some kind of system.",
  "Are you... are you a secret linguist? Is this your day job? BE HONEST.",
  "Something doesn't add up. You solved that WAY too fast. I'm watching you.",
  "Okay, WHO told you the answers? Someone must have. This is TOO perfect.",
  "I'm not saying you're a robot, but a human shouldn't be this good at words.",
  "Congratulations, but I'm keeping my eye on you. That was TOO smooth.",

  // Heartbroken lover (positive twist)
  "You've stolen my heart with that performance. I never want to let go.",
  "Is it hot in here, or is it just your scorching vocabulary skills?",
  "I've been searching for someone like you my whole life. A true wordsmith.",
  "You had me at your first correct answer. Swoon.",
  "My heart beats in consonants and vowels, and they all spell YOUR name.",
  "If love were a word game, you'd win every round. You already won mine.",

  // Wholesome / encouraging
  "Your brain is a beautiful thing. Look at what it just accomplished!",
  "Every word you got right is proof that you're sharper than you think.",
  "You didn't just play a game - you flexed the most powerful muscle you have.",
  "Genuinely impressive. Not participation-trophy impressive. Actually impressive.",
  "Somewhere, your elementary school English teacher just felt a wave of pride.",
  "This is your sign that you're smarter than you give yourself credit for.",
];

const LOSS_MESSAGES: string[] = [
  // Victorian-era aristocrat
  "Oh dear. That was rather... unfortunate. Perhaps a cup of tea and a good book might help?",
  "I shan't sugarcoat it - that performance would have embarrassed the household staff.",
  "One does not wish to be indelicate, but that was ghastly. Truly ghastly.",
  "The Countess would have fainted at such a display. Compose yourself, dear.",
  "I'm afraid your application to the Royal Vocabulary Society has been... declined.",
  "Hmm, yes, well. We shall speak no more of this. For everyone's sake.",
  "How shall I put this delicately? One cannot. That was dreadful.",
  "The servants are whispering. Word of your performance has reached the drawing room.",

  // Gen Z lingo
  "That was NOT it, bestie. Not. It.",
  "Oof. Big oof. Mega oof. The oofiest oof that ever oofed.",
  "Caught in 4K lacking vocabulary skills. It's giving struggle.",
  "No thoughts, just vibes? Because there were definitely no correct answers.",
  "The audacity to play that confidently and still lose. Iconic, honestly.",
  "This is your villain origin story, isn't it? I can feel it.",
  "You really said 'I don't need to study' and it SHOWED.",
  "L + ratio + you fell off + the dictionary owns you.",

  // Melodrama
  "And so it ends. Not with a bang, but with a whimper... and several wrong answers.",
  "The tragedy! The HORROR! To have come so far, only to fall so spectacularly!",
  "Let the record show: they tried. Oh, how valiantly they tried. And yet...",
  "The curtain falls on a performance that can only be described as... a cautionary tale.",
  "If Shakespeare wrote tragedies about word games, THIS would be his masterpiece.",
  "I shall never recover from what I just witnessed. The pain. THE PAIN.",
  "Somewhere, a violin plays softly for your fallen dreams of word game glory.",
  "This defeat shall echo through the corridors of time. Dramatically, of course.",

  // Mob boss
  "You call that a performance? I've seen better work from amateurs.",
  "I gave you a chance, and this is what you bring me? We need to talk.",
  "That was sloppy work. Very sloppy. I expected better from you.",
  "You've disappointed the family today. Don't let it happen again. Capisce?",
  "I'm not angry. I'm just... disappointed. And a little angry.",
  "You know what happens to people who perform like that? They get a second chance. Use it wisely.",
  "I vouched for you. Told everyone you were the real deal. You made me look bad.",
  "Consider this a warning. Next time, come correct or don't come at all.",

  // Disappointed father/teacher
  "I'm not mad. I'm just... no, actually, I am a little mad.",
  "We talked about this. We PRACTICED this. What happened in there?",
  "Your mother and I are very concerned about your word game choices.",
  "I expected more from you. I KNOW you can do better than this.",
  "Do you think this is a joke? Because your score certainly is.",
  "When I was your age, I would have gotten at least HALF of those right.",
  "This is going on your permanent record. And yes, that IS still a thing.",
  "I'm giving you 'the look' right now. You know the one.",
  "Go to your room and think about what you've done. Or rather, what you didn't do.",
  "I worked two jobs so you could have access to word games, and THIS is the result?",

  // Heartbroken lover
  "I gave you all my letters, and you couldn't even put them in the right order?",
  "We had something special. Then you went and... did THAT. I need a moment.",
  "I trusted you with my vowels and consonants. You broke every single one.",
  "Don't call me. Don't text me. I need time to process what I just saw.",
  "I'm not crying over your score. These are allergies. VOCABULARY ALLERGIES.",
  "You used to be so good with words. What happened to us?",
  "It's not me, it's you. Specifically, your answers. They were wrong.",
  "I thought we had a connection. But you couldn't even connect the right letters.",

  // Famous quotes / pop culture
  "'Houston, we have a problem.' - Mission Control, watching your performance.",
  "'You shall not pass!' - Gandalf, and apparently this game's difficulty level to you.",
  "'I see dead words.' - The Sixth Sense, but for your vocabulary.",
  "'Why so serious?' - The Joker, watching you struggle with basic words.",
  "'Luke, I am your father.' And I'm disappointed, Luke.",
  "'To be or not to be.' You chose 'not to be' good at this, apparently.",
  "'Winter is coming.' And so is a LOT more practice for you.",
  "'May the Force be with you.' You're going to need it.",

  // Playful arrest/incarceration threats
  "You're under arrest for crimes against the alphabet. Anything you spell can be used against you.",
  "WANTED: One word game player for the brutal mistreatment of vocabulary. Reward: a dictionary.",
  "You have been sentenced to 20 minutes of reading. The dictionary. From the beginning.",
  "The Grammar Police called. You're their most wanted suspect.",
  "We're confiscating your keyboard until further notice. It's for everyone's safety.",
  "This is a wellness check. Are the words okay? Because they didn't look okay.",
  "Dispatch, we've got a 10-99: vocabulary in distress. Send backup dictionaries.",
  "You have the right to remain silent. Given your answers, that might be best.",

  // Paranoid
  "Wait... did you LOSE on purpose? Is this some kind of mind game? WHAT'S YOUR ANGLE?",
  "Something's off. Nobody loses THIS perfectly. Are you throwing the game?!",
  "I feel like you're testing ME somehow. Is this a social experiment?",
  "This can't be real. I refuse to believe someone actually answered like that. Glitch in the Matrix.",
  "Are you sending me a message? Is 'losing badly' some kind of code? WHAT DOES IT MEAN?",
  "I'm starting to think the letters themselves conspired against you. Trust no vowel.",
  "That was suspicious. Not suspicious-good. The other kind of suspicious.",
  "Either you're a genius playing 4D chess, or... well, let's go with the 4D chess theory.",

  // Wholesome encouragement (for losses)
  "Hey, every expert was once a beginner. You're just building your origin story.",
  "The only real failure is not trying again. And you WILL try again, right? RIGHT?",
  "Edison failed 1,000 times before inventing the light bulb. You're basically Edison right now.",
  "Plot twist: losing is just winning in disguise. A VERY good disguise, but still.",
  "You know what champions do after a loss? They hit 'Play Again.' Just saying.",
  "Bad games build character. And wow, you're building a LOT of character today.",
];

let lastWinIndex = -1;
let lastLossIndex = -1;

export function getCompletionMessage(isWin: boolean): string {
  const pool = isWin ? WIN_MESSAGES : LOSS_MESSAGES;
  let index: number;
  const lastIndex = isWin ? lastWinIndex : lastLossIndex;

  do {
    index = Math.floor(Math.random() * pool.length);
  } while (index === lastIndex && pool.length > 1);

  if (isWin) {
    lastWinIndex = index;
  } else {
    lastLossIndex = index;
  }

  return pool[index];
}
