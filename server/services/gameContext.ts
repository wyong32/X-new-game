export interface GameContextResult {
  score: number;
  positiveReasons: string[];
  negativeReasons: string[];
  browserSignal: boolean;
  browserEvidence: string[];
}

export function calculateGameContextScore(post: {
  text: string;
  urls: string[];
  has_media?: boolean;
  hashtags?: string[];
}): GameContextResult {
  const text = post.text;
  const lowerText = text.toLowerCase();
  const positiveReasons: string[] = [];
  const negativeReasons: string[] = [];
  const browserEvidence: string[] = [];

  let score = 0;

  // 1. Explicit release phrases (+25)
  const releaseRegex = /\b(?:just released|out now|is now available|is finally out|launched my game|released my game|i made a game|i made this game|i finally released|happy to announce the release|officially released|playable now|is out today)\b/i;
  if (releaseRegex.test(text)) {
    score += 25;
    positiveReasons.push('Explicit release phrase detected (+25)');
  }

  // 2. Valid game/play URL (+25)
  const validUrlMatch = post.urls.some(u =>
    /(?:itch\.io|store\.steampowered\.com|poki\.com|crazygames\.com|newgrounds\.com|gamejolt\.com|gdevelop\.io|simmer\.io|\.github\.io)/i.test(u)
  );
  if (validUrlMatch) {
    score += 25;
    positiveReasons.push('Playable platform link detected (itch.io/Steam/Poki/CrazyGames/Newgrounds) (+25)');
  } else if (post.urls.length > 0) {
    // Other URLs (+10)
    score += 10;
    positiveReasons.push('External game link detected (+10)');
  }

  // 3. Explicit game-title structure (+20)
  const titleStructureRegex = /(?:called ['"“][^'"”]+['"”]|called [A-Z0-9]|game ['"“][^'"”]+['"”]|['"“][A-Za-z0-9\s-]{2,30}['"”]\s+(?:is out|just released|released|playable))/i;
  if (titleStructureRegex.test(text)) {
    score += 20;
    positiveReasons.push('Explicit game title structure or quoted title (+20)');
  }

  // 4. Browser / H5 phrases (+15)
  const browserPhrasesRegex = /\b(?:play in browser|playable in browser|browser game|html5|webgl|web game|phaser|godot web|pico-8|play in your browser|no download required)\b/i;
  const isBrowserUrl = post.urls.some(u => /(?:poki\.com|crazygames\.com|newgrounds\.com|\.itch\.io.*html5|simmer\.io)/i.test(u));

  if (browserPhrasesRegex.test(text) || isBrowserUrl) {
    score += 15;
    positiveReasons.push('Browser/web playable terminology detected (+15)');
    if (browserPhrasesRegex.test(text)) {
      browserEvidence.push('Browser keyword in post text');
    }
    if (isBrowserUrl) {
      browserEvidence.push('Direct browser portal URL');
    }
  }

  // 5. Gameplay media (+10)
  if (post.has_media) {
    score += 10;
    positiveReasons.push('Gameplay screenshot or clip attached (+10)');
  }

  // 6. Indiedev / Gamejam context (+5)
  const jamOrIndieRegex = /\b(?:#indiedev|#gamejam|#gamedev|#gmtkjam|#ldjam|#ludumdare|#indiegame|game jam)\b/i;
  if (jamOrIndieRegex.test(text) || (post.hashtags && post.hashtags.some(h => /(?:indiedev|gamejam|gmtkjam|ldjam|indiegame)/i.test(h)))) {
    score += 5;
    positiveReasons.push('Game dev / Game jam community tag (+5)');
  }

  // Negative factors
  if (/\b(?:hiring|recruiting|job opening|salary|join our team)\b/i.test(text)) {
    score -= 40;
    negativeReasons.push('Job/recruitment penalty (-40)');
  }
  if (/\b(?:tutorial|how to code|learn unity|learn godot|course)\b/i.test(text)) {
    score -= 30;
    negativeReasons.push('Tutorial/course penalty (-30)');
  }
  if (/\b(?:asset pack|unreal marketplace|unity store|sfx pack)\b/i.test(text)) {
    score -= 30;
    negativeReasons.push('Asset pack/store penalty (-30)');
  }
  if (/\b(?:marketing agency|pr agency|outsourcing service)\b/i.test(text)) {
    score -= 30;
    negativeReasons.push('Agency/marketing service penalty (-30)');
  }
  if (/\b(?:crypto|nft|token|airdrop|casino|betting)\b/i.test(text)) {
    score -= 50;
    negativeReasons.push('Crypto/Gambling penalty (-50)');
  }
  if (/\b(?:giveaway|rt to win)\b/i.test(text) && !validUrlMatch) {
    score -= 15;
    negativeReasons.push('Unverified promotional giveaway (-15)');
  }

  // Clamp 0–100
  const finalScore = Math.max(0, Math.min(100, score));

  return {
    score: finalScore,
    positiveReasons,
    negativeReasons,
    browserSignal: browserEvidence.length > 0 || isBrowserUrl,
    browserEvidence
  };
}
