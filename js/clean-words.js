/**
 * Keeping the leaderboard names decent.
 *
 * The easy half is catching rude words. The hard half is NOT catching innocent
 * ones, and that half is where naive filters fall over: a plain substring
 * search for "ass" rejects class, grass, pass, bass, Cassie and assessment,
 * and a child called Cassidy is told her name is unacceptable. That is a worse
 * outcome than the occasional rude word slipping through on a leaderboard that
 * only exists on that child's own computer.
 *
 * So the matching works two ways, and neither is a bare substring search:
 *
 *   whole words   the name is split into words, each is normalised (letters
 *                 only, 4 → a, 1 → i, repeated letters collapsed) and compared
 *                 for EQUALITY. "sh1t", "shiiit" and "s.h.i.t" all become the
 *                 same word; "shiitake" does not.
 *
 *   run together  the whole name with its spaces removed is compared the same
 *                 way, which catches "f u c k" without letting "class" through.
 *
 * A handful of words have no innocent English word containing them, and only
 * those are searched for anywhere in the text.
 */
(function () {
  "use strict";

  /* Words with no innocent English word containing them, so they can be
     looked for anywhere in the name.

     This list is short on purpose, and two words were taken OUT of it after
     testing: "rape", which blocked grape, scrape, drape and trapeze, and
     "cunt", which blocked Scunthorpe -- the oldest false positive in the
     trade. Both moved to the whole-word list below, where they still catch
     somebody typing them and no longer catch a child called Grape. */
  const ANYWHERE = [
    "fuck", "motherfucker", "wank", "bollock", "faggot", "nigger",
    "whore", "slut",
  ];

  /* Words that DO sit inside innocent ones -- ass in class, hell in shell,
     cock in cockatoo, tit in title, rape in grape, cunt in Scunthorpe, nigga
     in niggardly -- so these match a whole word only. */
  const WHOLE_WORD = [
    "ass", "arse", "arsehole", "asshole", "shit", "bitch", "bastard", "dick",
    "piss", "crap", "penis", "vagina", "boob", "boobs", "tit", "tits", "cock",
    "sex", "sexy", "porn", "damn", "bugger", "prick", "twat", "knob", "willy",
    "poop", "turd", "anus", "butthole", "jizz", "hoe", "pube", "pubes",
    "rape", "cunt", "nigga", "rapist", "retard",
  ];

  /* An insult is often the word plus one of these. Kept to compounds that do
     not appear as ordinary endings: "er" is not here, because cock + er is a
     spaniel and a cockerel, and blocking those would be the same mistake all
     over again. */
  const COMPOUND = ["head", "face", "hole", "bag", "wipe", "brain"];

  /** Characters people swap in to dodge a filter. */
  const LOOKALIKE = {
    "4": "a", "@": "a", "8": "b", "3": "e", "1": "i", "!": "i", "|": "i",
    "0": "o", "5": "s", "$": "s", "7": "t", "+": "t", "9": "g", "2": "z",
  };

  /**
   * Down to bare letters, two different ways, because the dodges differ.
   *
   *   swapping  "a55" means "ass", so 5 becomes s.
   *   dropping  "fu4ck" means "fuck", where the 4 is padding rather than a
   *             letter. Swapping gives "fuack" and misses it; dropping gives
   *             "fuck" and catches it.
   *
   * Both are checked. Runs of the same letter collapse either way, so
   * "fuuuuck" is "fuck".
   */
  function collapse(text) {
    let out = "";
    for (let i = 0; i < text.length; i++) {
      if (text.charAt(i) !== text.charAt(i - 1)) out += text.charAt(i);
    }
    return out;
  }

  function bareLetters(text, drop) {
    const lower = String(text || "").toLowerCase();
    let out = "";
    for (let i = 0; i < lower.length; i++) {
      const char = lower.charAt(i);
      const swapped = drop ? char : (LOOKALIKE[char] || char);
      if (swapped >= "a" && swapped <= "z") out += swapped;
    }
    return collapse(out);
  }

  /** The same treatment, but the word breaks are kept. */
  function words(text, drop) {
    return String(text || "")
      .split(/[^A-Za-z0-9@!|$+]+/)
      .map(function (part) { return bareLetters(part, drop); })
      .filter(Boolean);
  }

  /* The blocklists collapsed the same way, so "bollock" is compared against
     the same shape the name was reduced to. */
  const ANYWHERE_BARE = ANYWHERE.map(bareLetters);
  const WHOLE_BARE = WHOLE_WORD.map(bareLetters);

  /** Is this word one of the blocked ones, or one of them plus "head"? */
  function isBadWord(word) {
    if (WHOLE_BARE.indexOf(word) !== -1) return true;
    for (let i = 0; i < WHOLE_BARE.length; i++) {
      const bad = WHOLE_BARE[i];
      if (word.length <= bad.length || word.indexOf(bad) !== 0) continue;
      if (COMPOUND.indexOf(word.slice(bad.length)) !== -1) return true;
    }
    return false;
  }

  /** True when a name should be sent back for another go. */
  function looksRude(name) {
    // Both readings of the name: lookalikes swapped, and padding dropped.
    const readings = [bareLetters(name, false), bareLetters(name, true)];
    for (let r = 0; r < readings.length; r++) {
      const runTogether = readings[r];
      if (!runTogether) continue;
      for (let i = 0; i < ANYWHERE_BARE.length; i++) {
        if (runTogether.indexOf(ANYWHERE_BARE[i]) !== -1) return true;
      }
      // "f u c k" arrives as single letters, so the name with its spaces taken
      // out is judged as a word in its own right.
      if (isBadWord(runTogether)) return true;
    }
    const parts = words(name, false).concat(words(name, true));
    for (let i = 0; i < parts.length; i++) {
      if (isBadWord(parts[i])) return true;
    }
    return false;
  }

  window.CleanWords = {
    looksRude: looksRude,
    bareLetters: bareLetters,
    words: words,
    isBadWord: isBadWord,
    COMPOUND: COMPOUND,
    ANYWHERE: ANYWHERE,
    WHOLE_WORD: WHOLE_WORD,
  };
})();
