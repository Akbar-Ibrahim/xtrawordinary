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

  // Medieval king
  "By royal decree, We declare this victory MAGNIFICENT. The kingdom rejoices!",
  "Kneel before Us, champion, and rise as Sir Wordsworth of the Realm!",
  "The crown weighs heavy, but today it sits upon a worthy head. YOUR head.",
  "Let the heralds sound the trumpets! A feat of linguistic valor has been achieved in Our name!",
  "We are most pleased. The royal coffers shall be opened in celebration of this triumph!",
  "Hear ye, hear ye! The sovereign proclaims this the finest display of wit in all the land!",
  "Our kingdom has known many victories, but few as glorious as this. You honor the throne.",
  "The royal scribe shall chronicle this moment for eternity. Well fought, loyal subject!",

  // Medieval dueler acknowledging defeat (win = opponent concedes)
  "I yield! Your blade of intellect has bested mine. I concede with honor.",
  "Sheathe your sword, champion. The duel is won. I bow to the superior mind.",
  "A touch! A palpable touch! You have pierced my defenses most skillfully.",
  "I lay down my quill and concede the field. You are the finer wordsmith this day.",
  "Never have I faced such a formidable opponent. My steel was no match for your wit.",
  "The duel is decided. I salute you, worthy adversary, and accept my defeat with grace.",
  "You have fought with honor and cunning. I withdraw, humbled but wiser for the contest.",
  "My liege, I have been bested. This challenger's command of words is beyond reproach.",

  // Court / Gen Z lawyer
  "Your Honour, my client would like the record to reflect that they absolutely ATE that.",
  "Your Honour, I present Exhibit A: a flawless performance. The defense rests. Mic drop.",
  "Objection, Your Honour! This level of brilliance should be inadmissible. It's too good.",
  "Your Honour, we move to dismiss all doubt. My client is, in fact, HIM.",
  "Let the court note: the defendant scored so hard it constitutes cruel and unusual punishment to the game.",
  "Your Honour, I'd like to enter a motion that my client be declared 'goated' in perpetuity.",
  "Counsel for the prosecution concedes. No further questions, Your Honour. We've been cooked.",
  "Your Honour, the evidence is overwhelming. My client is guilty... of being absolutely cracked at this.",

  // Enlightenment after meditation
  "Breathe in... breathe out... and notice how effortlessly the correct answers flowed through you.",
  "The mind is still. The words are clear. You did not force the victory - it arose naturally.",
  "In the silence between thoughts, the answers revealed themselves. This is the way.",
  "You did not conquer the game. You became one with it. And in that oneness, there was only victory.",
  "The lotus blooms. The fog lifts. What remains is clarity, peace, and an excellent score.",
  "Observe how the letters arranged themselves without struggle. You were merely the vessel.",
  "True mastery is not about knowing every word. It is about letting every word know you.",
  "Namaste. The wordsmith in me honors the wordsmith in you. You are exactly where you need to be.",

  // Southern lady
  "Well, I do declare! That was the finest display of word-wranglin' I have EVER seen, bless your heart!",
  "Honey child, you just lit up this game like a firefly on a summer night! I am TICKLED!",
  "Sugar, if brains were sweet tea, you'd be a whole pitcher of the good stuff!",
  "Well butter my biscuit and call me impressed! You did that with STYLE, darlin'!",
  "I'm fixin' to tell everyone at Sunday brunch about this! You were MAGNIFICENT, sweetpea!",
  "Lord have mercy, you played that smoother than magnolia honey on a warm biscuit!",
  "My mama always said talent shows up when it's ready, and HONEY, it just showed up!",
  "Why, I haven't seen anything this impressive since Aunt Mabel won the county spelling bee in '82!",

  // African American street slang
  "Yo, you went OFF off! That was straight pressure, no question!",
  "Aight, I see you! You really came through clutchin' like that. Real talk.",
  "That was cold, fam. Ice cold. You bodied that whole thing, no cap.",
  "Sheeeesh! You just ran through that like it was nothin'. Big dawg energy!",
  "You was cookin' the WHOLE time! Had 'em shook from the jump!",
  "Nah, you different. You really stepped in there and handled ya business. Respect.",
  "Ayo, that was tough! You snapped on every single word. Period.",
  "You ate that UP! Not a crumb left! That's how you supposed to come through!",

  // British slang
  "Absolutely brilliant, mate! You proper smashed it! Chuffed to bits for ya!",
  "Blimey, that was well good! You've gone and done yourself proud, haven't ya!",
  "Right then, that was a proper result! You're well sorted, you are!",
  "Mate, you absolutely bossed it! Not being funny, but that was class!",
  "Cor blimey! You've only gone and done it! Proper job, that was mint!",
  "You've had an absolute blinder! Dead impressed, I am. Crackin' stuff!",
  "Fair play, that was ace! You've smashed it right out the park, ya legend!",
  "Well in, mate! You've proper mugged off that game! Top marks, innit!",

  // Jamaican slang
  "Yow! Yuh mash up di game, star! Big tings! Respect due!",
  "Wah gwaan! Yuh just run di place! Nobody cyaan test yuh, bredren!",
  "Bless up, massive! Yuh come een like a champion fi real! Big up yuhself!",
  "Irie vibes all round! Yuh play dat smooth like butter, yuh zimmi!",
  "Bomboclaat! Yuh just shell dung di whole ting! Nuff respect, selecta!",
  "Yuh a di real general, fam! Every word lock tight! Walk good, champion!",
  "One love, bredren! Yuh just show dem how fi dweet! Jah bless!",
  "Wagwan! Yuh nuh easy! Dat performance deh was WICKEED, yuh dun know!",

  // Pirate
  "Shiver me timbers! Ye plundered every last word like a true buccaneer! ARRR!",
  "Avast, ye brilliant scallywag! That be the finest word-smithery on all seven seas!",
  "Blow me down! Ye sailed through that like the wind was at yer back! Well done, matey!",
  "Yo ho ho! The captain raises a tankard in yer honor! A finer crew member I never did see!",
  "By Davy Jones' locker, ye've got the sharpest mind this side of the Caribbean!",
  "Hoist the colors! A victory this grand deserves a full broadside salute! FIRE!",
  "Aye aye, ye magnificent sea dog! Ye've earned yer weight in doubloons today!",
  "Land ho! That treasure of a score be the finest booty any pirate ever claimed!",

  // Airplane pilot / Mayday alert
  "Ladies and gentlemen, this is your captain speaking. We have reached PEAK PERFORMANCE. Smooth sailing ahead.",
  "Tower, this is WordPlay One. Requesting permission for a victory flyby. Score is... outstanding.",
  "All systems nominal. Performance metrics are off the charts. Prepare for a smooth landing into glory.",
  "Flight WordPlay-747 reporting: all words cleared for landing. Zero turbulence. Textbook performance.",
  "Attention crew: we have achieved cruising altitude of ABSOLUTE BRILLIANCE. Seatbelt sign is off. Celebrate freely.",
  "Roger that, control. Confirming a perfect approach. All answers locked in. Touchdown successful.",
  "This is your pilot. I've been flying for 30 years, and I've never seen instruments read this good. Bravo.",
  "Mayday, Mayday! Just kidding. Everything is PERFECT up here. Best flight of the season.",

  // Airport announcer
  "Attention all passengers: Flight Victory has arrived at Gate Awesome. Please collect your bragging rights.",
  "Paging all players: your connecting flight to the Hall of Fame is now boarding at Gate 1. Final call.",
  "Attention all passengers: the score currently displayed on the board has been upgraded to First Class.",
  "This is a gate change announcement: your destination has been changed from 'Okay' to 'Absolutely Incredible.'",
  "Would the owner of an outstanding performance please report to the information desk? You left everyone speechless.",
  "Attention all passengers: WordPlay Airlines would like to congratulate today's MVP. You know who you are.",
  "Final boarding call for Flight Genius, departing from Gate Brilliant. One passenger confirmed. That's you.",
  "Attention: baggage claim for this round includes one trophy, three compliments, and unlimited respect.",

  // Cowboy
  "Well, slap my chaps and call me impressed! You rode that game harder than a bull at the rodeo!",
  "Yeehaw, partner! You just lassoed every word in the corral! That's some mighty fine wranglin'!",
  "I'll be danged! Ain't seen shootin' that straight since Wild Bill himself! Tip of the hat to ya!",
  "Saddle up, amigo, 'cause you just rode off into the sunset a WINNER! The frontier salutes ya!",
  "Well I'll be a rattlesnake's uncle! That was the rootinest, tootinest performance this side of the Pecos!",
  "You drew faster than a six-shooter at high noon! Ain't nobody outgunnin' you today, cowpoke!",
  "Reckon I ain't seen a display like that since the great cattle drive of '88! Much obliged, partner!",
  "That there was Grade-A, prime cut, top-shelf word-slingin'! The ranch hands are hootin' and hollerin'!",

  // Mexican Cartel
  "Orale, compa! You handled that like a true jefe. Clean. Efficient. No loose ends.",
  "Respeto, amigo. That was professional-grade work. The plaza is yours tonight.",
  "Mira, I've seen a lot of players come and go. But you? You're built for this life, carnal.",
  "Que chingon! You ran that whole operation without breaking a sweat. El patron is impressed.",
  "Andale! You moved through those words like product through the pipeline. Smooth and untraceable.",
  "Compadre, that was cold-blooded excellence. The kind of work that earns you a seat at the table.",
  "No mames! You just took over the whole territory! Even the rivals are clapping. Bien hecho.",
  "The familia sends their regards... and their congratulations. You've earned your place, hermano.",

  // Russian mob
  "Comrade, that was beautiful work. Like poetry, but with more... efficiency. The Bratva approves.",
  "In Mother Russia, words don't play you - YOU play words. And you played them WELL.",
  "Da. Very clean. Very professional. You remind me of the old days. The GOOD old days.",
  "My friend, you handled that like a true Vor. The brotherhood raises a glass of vodka to you.",
  "Excellent. No loose ends, no mistakes. This is why we keep you around, tovarisch.",
  "The pakhan himself would nod at this performance. And he does NOT nod easily.",
  "You moved through those words like winter through Siberia. Cold. Unstoppable. Beautiful.",
  "Zdorovye! To your victory! You have brought honor to the organization tonight.",

  // Gen Z cowboy
  "Yeehaw bestie! You really said 'giddy up' and ate that whole game, no crumbs, no cap!",
  "Okay partner but like... that was lowkey the most slay rodeo I've ever witnessed? Dead.",
  "You lassoed that W and it's giving... main character on the frontier? Obsessed.",
  "Howdy bestie! You just ratio'd the entire Wild West and I am HERE for it!",
  "That was bussin' on the range, pardner! You understood the rootin' tootin' assignment!",
  "POV: you're a cowpoke who's actually cracked at word games. The saloon is SHOOK.",
  "No because WHY did you just end that game's whole career?? Yeehaw energy is IMMACULATE.",
  "You really just rode into the sunset with the biggest W of the century, bestie. Iconic behavior.",

  // Gen Z mob boss
  "Nah fam, you just ran the whole operation and it's giving... criminal mastermind energy? Slay.",
  "You made those words an offer they couldn't refuse and honestly? That's so real of you.",
  "Bestie said 'I AM the don' and proceeded to absolutely body the competition. No cap, respect.",
  "It's giving... godfather but make it fashion? You just took over the family business, periodt.",
  "POV: you're the youngest don in history and you're lowkey cracked at word games too. We stan.",
  "The way you handled that was cold-blooded and also kind of iconic?? The streets are TALKING.",
  "You really just said 'fuggedaboutit' in the most slay way possible. The famiglia is shook.",
  "Okay but the way you just casually took over the entire territory? That's literally so valid.",

  // Gen Z pirate
  "Arrr bestie! You absolutely plundered that game and it's giving... pirate queen energy!",
  "No because you just sailed through that like it was NOTHING?? Shiver me timbers, slay!",
  "POV: you're a pirate who's lowkey cracked at word games. The seven seas are SHOOK.",
  "That treasure was mid but YOUR performance? That was bussin'. Yo ho slay, bestie!",
  "You really just said 'walk the plank' to every wrong answer. Iconic pirate behavior, no cap.",
  "The way you commandeered that whole game? Main character on the high seas, honestly.",
  "Avast, bestie! You ate that and left no crumbs on the poop deck! Dead, I'm so dead.",
  "Not you casually conquering the Caribbean and serving looks while doing it. Arrr-mazing, periodt.",

  // Australian slang
  "Strewth, mate! That was an absolute ripper! You smashed it like a true blue legend!",
  "Fair dinkum, that was bonzer! Reckon you could take on a croc and win after that performance!",
  "Crikey! You went at that harder than a roo in a boxing ring! Top shelf, ya beauty!",
  "No wuckas, mate! You nailed it like a tradie on a Monday! Bloody brilliant, that was!",
  "Stone the crows! That was unreal! You're a deadset champion, mate! Chuckin' a sickie to celebrate!",
  "You absolute legend! That was grouse! Reckon you deserve a cold one after that effort!",
  "Oath, mate! You just had a red-hot crack and absolutely cleaned up! Stoked for ya!",
  "Too easy, mate! You breezed through that like a Bondi wave! Couldn't be more chuffed!",

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

  // Medieval king
  "The crown is DISPLEASED. This performance brings shame upon the royal court.",
  "We hereby banish this score from the kingdom. Guards! Remove it from Our sight!",
  "The royal treasury invested in your training, and THIS is the return? Unacceptable.",
  "By Our scepter, We have witnessed peasants with more command of the tongue.",
  "Let the record show: the throne is NOT amused. A period of reflection is hereby ordered.",
  "We expected a champion and received... whatever that was. The dungeon awaits improvement.",
  "The kingdom's enemies would tremble less after watching this display. Deeply concerning.",
  "Our court jester performs with more linguistic precision. And that is NOT a compliment.",

  // Medieval dueler acknowledging defeat (loss = you are the defeated dueler)
  "I yield... you have bested me, but know that I shall return stronger. This I swear on my sword.",
  "My blade falters. My wit dulls. You have won this bout, but the war of words is far from over.",
  "I kneel in defeat, but I kneel with HONOR. Not everyone can say that after such a thrashing.",
  "The field is yours. I retreat to sharpen my mind as one would sharpen a dulled blade.",
  "A thousand duels I have fought, and yet this one shall haunt me. Well played, adversary.",
  "I remove my gauntlet and cast it not in challenge, but in surrender. You were the superior.",
  "My second shall carry me from this field, but my pride? That was already carried away.",
  "The crowd falls silent. The defeated dueler bows. There is no shame in losing to a master.",

  // Court / Gen Z lawyer
  "Your Honour, my client pleads... not great. We'd like to request a retrial, respectfully.",
  "Your Honour, the defense would like to strike this entire performance from the record. Please.",
  "Objection! On what grounds? On the grounds that this score is emotionally devastating, Your Honour.",
  "Your Honour, we move for a mistrial. My client was clearly not in their right mind.",
  "Let the court record show that my client's performance was, and I quote, 'down bad.'",
  "Your Honour, I'd like to recuse myself. I can no longer defend what I just witnessed.",
  "The prosecution rests, Your Honour. Honestly, they didn't even need to try that hard.",
  "Your Honour, my client would like to plead the Fifth. And the Sixth. And every amendment after that.",

  // Enlightenment after meditation
  "Breathe in... breathe out... and gently release your attachment to winning. Let it go.",
  "The path to enlightenment is paved with failed word games. You are making excellent progress.",
  "Do not mourn the lost points. They were never truly yours. Nothing is. This is freedom.",
  "The universe does not judge your score. Only you judge your score. So stop judging your score.",
  "Be like water - formless, shapeless, and apparently also unable to spell correctly.",
  "In every wrong answer, there is a lesson. Today, you received many, many lessons.",
  "The candle flickers, but does not go out. Neither shall your spirit. Try again, grasshopper.",
  "Om... Let the wrong answers dissolve like morning dew. Tomorrow you will bloom anew.",

  // Southern lady
  "Oh, bless your heart, sugar. That was... well, we don't need to talk about it at the dinner table.",
  "Honey, I love you like family, but that performance was rougher than a cob. Bless it.",
  "Well, I never! My great-aunt Charlene could've done better, and she's been gone since '97!",
  "Sweetpea, that was harder to watch than a possum playin' dead on the front porch. Lawd.",
  "Darlin', I'm gonna pray for your vocabulary tonight. And tomorrow night. And the night after.",
  "Sugar, I'd say that was a hot mess, but that'd be an insult to hot messes everywhere.",
  "Oh, honey, no. Just... no. Come sit down and let me fix you some sweet tea. You need it.",
  "Bless your little heart, you tried. And that's what I'm gonna tell people when they ask.",

  // African American street slang
  "Bruh. BRUH. What was that? You down bad for real right now.",
  "Nah, that ain't it, fam. You gotta go back to the lab with that one.",
  "You got cooked out there. Fried. Extra crispy. No seasoning. Just pain.",
  "Dawg, that was ROUGH. Like, I'm embarrassed FOR you type rough.",
  "You fumbled the bag so hard they heard it in the next zip code.",
  "That was cap. Your whole performance was cap. Come correct next time.",
  "I ain't gonna hold you, that was tragic. You gotta tighten up, cuz.",
  "You took an L so big they gotta make a new letter for it.",

  // British slang
  "Mate, that was absolutely rubbish. Proper pants, that was. Gutted for ya.",
  "Blimey, you've made a right dog's dinner of that! Shocking, absolutely shocking.",
  "That was well dodgy, innit? You've proper bottled it there, haven't ya.",
  "Crikey, what a shambles! You've come a cropper on that one, mate. Mental.",
  "Not being funny, but that was naff. Properly naff. You've done a mare there.",
  "That was a right cock-up, wasn't it? You've gone and made a mug of yourself!",
  "Oh dear. You've absolutely binned that one off. Gobsmacked at how bad that was.",
  "Mate, you've had a nightmare. An absolute stinker. Back to the drawing board, yeah?",

  // Jamaican slang
  "Lawd have mercy! Wha happen to yuh, bredren? Dat was ROUGH, yuh nuh see it!",
  "Cho! Mi cyaan believe weh mi just witness! Yuh need fi go back a school, star!",
  "Wah gwaan wid dat performance deh? Yuh come een like yuh neva see word before!",
  "Mi shame fi yuh, massive. Dat was dutty. Go sidung and tink bout weh yuh do.",
  "Bwoy, yuh get bun PROPER! Di words dem lick yuh dung one by one!",
  "Bredren, dat was a whole disaster. But nuh worry - every mickle mek a muckle. Try again!",
  "Yuh just get WASH! But real talk, even Usain did haffi learn fi walk first. Come again!",
  "Rahtid! Dat neva pretty at ALL. But yuh have heart, mi give yuh dat.",

  // Pirate
  "Arrr, that was a shipwreck of a performance! Ye'd make Davy Jones himself cringe!",
  "Blast it all! Ye played like a landlubber who's never seen the open sea! Pathetic, matey!",
  "Ye scurvy dog! Me parrot could've done better, and he only knows THREE words!",
  "Walk the plank! That performance be worthy of nothin' less! The crew is NOT impressed!",
  "By Blackbeard's ghost, that was terrible! Ye'd be swabbin' decks for a month after that!",
  "Abandon ship! ABANDON SHIP! This performance be sinkin' faster than the Titanic!",
  "Ye lily-livered bilge rat! I've seen barnacles with better word skills than that!",
  "The Jolly Roger flies at half-mast today. In memory of your vocabulary. Rest in pieces.",

  // Airplane pilot / Mayday alert
  "Mayday, Mayday, Mayday! This is WordPlay One declaring an emergency! Score is critically low!",
  "Ladies and gentlemen, this is your captain. We've experienced severe vocabulary turbulence. Brace for impact.",
  "Tower, requesting emergency landing. All word engines have failed. I repeat, ALL engines down.",
  "This is NOT a drill. We have lost cabin pressure, altitude, and apparently all knowledge of the English language.",
  "Black box recovered. Cause of crash: catastrophic failure of basic spelling skills. No survivors.",
  "Control tower to WordPlay One: you are WAY off course. Like... not even on the radar anymore.",
  "Attention passengers: the pilot has turned on the 'We're In Trouble' sign. Please panic accordingly.",
  "Flight recorder shows: the descent began at Question 1 and never recovered. Thoughts and prayers.",

  // Airport announcer
  "Attention all passengers: Flight Victory has been indefinitely delayed. We apologize for the inconvenience.",
  "Paging the owner of a lost vocabulary: it was last seen somewhere around Question 2. Please claim it.",
  "Attention all passengers: your connecting flight to Success has been CANCELLED due to poor performance.",
  "This is a final boarding call for Dignity. It appears to have departed without you.",
  "Attention: the baggage carousel is now displaying your mistakes. There are... quite a few bags.",
  "We regret to inform you that your upgrade to First Class has been downgraded to the cargo hold.",
  "Would the player who left their skills at security screening please return to collect them?",
  "Attention all passengers: the arrival board now reads 'DELAYED' for all your hopes and dreams.",

  // Cowboy
  "Well, partner, that was rougher than a tumbleweed in a tornado. You got bucked off hard.",
  "Tarnation! I've seen baby calves with more fight! You got wrangled somethin' fierce, pardner!",
  "That was a real dust-up, and YOU were the dust. Git along now and practice up, cowpoke.",
  "Dadgummit! You shot blanks the whole dang round! Even the horses are laughin' at ya!",
  "Hoo boy. That was uglier than a mud fence in a rainstorm. Best mosey on back to the ranch.",
  "You rode in like a hero and rode out like a tenderfoot. The saloon's buyin' you a consolation drink.",
  "Ain't no sugar-coatin' it, amigo. That was a train wreck on the prairie. Choo choo, partner.",
  "The wanted poster says 'WANTED: Better Vocabulary.' Reward: not embarrassin' yourself next time.",

  // Mexican Cartel
  "Oye, compa. That was sloppy work. Very sloppy. El jefe is NOT happy.",
  "Mira, amigo, we gave you a simple job and you couldn't deliver. That's a problem.",
  "Que paso, carnal? You fell apart out there. In this business, that gets you... reassigned.",
  "No bueno, hermano. That kind of performance makes people nervous. Very nervous.",
  "Compadre, I vouched for you. Told them you were reliable. You just made me look like a fool.",
  "Escucha, amigo. Everyone gets one bad day. This was yours. Don't let there be a second.",
  "Ay, carnal. Even the new guys are doing better work than that. Get it together.",
  "The familia is watching, and what they saw was weakness. You know what happens to weakness.",

  // Russian mob
  "Comrade... that was not good. In fact, that was very, very bad. The Bratva is concerned.",
  "In Mother Russia, we have a saying: 'The bear does not forgive.' Neither does your score.",
  "Nyet, nyet, nyet. This is not what we agreed upon. The organization expected better, tovarisch.",
  "My friend, I must be honest. If this were the old country, we would be having a VERY different conversation.",
  "The vodka tonight will not be for celebration. It will be for forgetting. Forgetting THIS.",
  "You performed like a man who has never seen snow. In Russia, that is the worst insult.",
  "The pakhan sends his... disappointment. That is worse than his anger, my friend. Much worse.",
  "Da, I saw everything. I wish I hadn't. Some things cannot be unseen, tovarisch.",

  // Gen Z cowboy
  "Yeehaw but like... sarcastically? Because that was NOT it, bestie. The ranch is cringing.",
  "Okay pardner, that was lowkey embarrassing? Like the whole frontier saw that and they're SHOOK. Badly.",
  "You really just fell off the horse and it's giving... tenderfoot energy? Not the vibe, bestie.",
  "POV: you thought you were that cowpoke but you're actually just a tourist at the dude ranch.",
  "That was SO not rootin' tootin', partner. The tumbleweeds are rolling away from YOUR score. Oof.",
  "No because WHY did you just let that game wrangle YOU?? Reverse cowboy energy. Tragic.",
  "Howdy bestie but also... goodbye? Because your vocabulary just left town and it's not coming back.",
  "The saloon is quiet. Too quiet. Because everyone is speechless at how bad that was, pardner.",

  // Gen Z mob boss
  "Fam, you just fumbled the whole operation and it's giving... snitch energy? We need to talk.",
  "Bestie said 'trust me, I got this' and then proceeded to NOT have it. At all. The famiglia is concerned.",
  "Nah because that was lowkey embarrassing for the whole family? The streets are NOT impressed.",
  "It's giving... witness protection program? Because you need to HIDE after that performance.",
  "POV: the don finds out about your score and it's literally the most unhinged timeline. Yikes.",
  "The way you just fumbled that was so chaotic and NOT in a slay way. The crew is shook. Negatively.",
  "You really just brought dishonor to the family name and honestly? That's so not valid, bestie.",
  "Okay but the way you just lost control of the territory? That's giving amateur hour. The don is LIVID.",

  // Gen Z pirate
  "Arrr bestie but like... that was giving shipwreck energy? The crew is lowkey mutinying.",
  "No because you just walked your OWN plank?? Self-sabotage on the high seas, honestly. Tragic.",
  "POV: you're a pirate who's NOT cracked at word games. The seven seas are laughing. At you.",
  "That treasure map was upside down and so was your performance. Not the pirate slay we needed.",
  "You really just sunk your own ship and it's giving... first day on the ocean? Embarrassing, no cap.",
  "Avast, bestie, but like... we need to revoke your pirate license? That was mid at BEST.",
  "The way you fumbled that booty was unhinged. And not cute unhinged. Concerning unhinged.",
  "Davy Jones called and even HE doesn't want your score in his locker. That's how bad it was, periodt.",

  // Australian slang
  "Crikey, mate! That was an absolute shocker! You've come a proper gutser there, ya drongo!",
  "Fair suck of the sav, that was woeful! Even a galah could've done better, mate!",
  "Strewth! That was about as useful as an ashtray on a motorbike! Pull ya socks up!",
  "Stone the crows, that was rubbish! You played like a stunned mullet out there, mate!",
  "Mate, that was cactus from the get-go! You were flatter than a lizard drinking! Shocking!",
  "No wuckas... actually, MANY wuckas! That was dodgier than a two-dollar watch, mate!",
  "Blimey, you really dropped your bundle there! That performance was as rough as guts!",
  "Yeah nah, mate. That was cooked. Absolutely cooked. Time for a cold one and a rethink.",

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
