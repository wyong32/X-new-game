export interface HardFilterResult {
  passed: boolean;
  rejectReasons: string[];
}

// Deterministic negative regexes
const HARD_REJECT_PATTERNS = [
  {
    regex: /\b(?:we're hiring|we are hiring|job opening|recruiting|hiring for|job alert|looking for (?:a )?(?:programmer|artist|sound designer|intern)|join our team|freelance position)\b/i,
    reason: 'Recruitment / Job posting'
  },
  {
    regex: /\b(?:tutorial|how to (?:make|build|create|code) (?:games?|a game)|course|learn (?:unity|godot|unreal|unreal engine|c#|gamedev)|udemy|masterclass|part \d+ of my tutorial)\b/i,
    reason: 'Tutorial / Educational course'
  },
  {
    regex: /\b(?:asset pack|assets? on sale|unreal marketplace|unity asset store|3d models? pack|texture pack|sound pack|humble bundle|sfx library|shader pack|plugin sale)\b/i,
    reason: 'Asset pack / Plugin / Store sale'
  },
  {
    regex: /\b(?:marketing agency|pr agency|outsourcing studio|game development service|we offer gamedev services|publisher looking for|promote your game with us)\b/i,
    reason: 'Agency / B2B service pitch'
  },
  {
    regex: /\b(?:crypto|nft|minting|mint now|solana|airdrop|blockchain game|tokenomics|p2e|play-to-earn|casino|betting|slots|gamble|wagering)\b/i,
    reason: 'Crypto / NFT / Casino / Gambling'
  },
  {
    regex: /\b(?:giveaway|rt and follow to win|win a \$|retweet to win|giving away \d+)\b/i,
    reason: 'Giveaway / Sweepstakes without game context'
  }
];

export function hardFilterPost(postText: string): HardFilterResult {
  const rejectReasons: string[] = [];

  for (const { regex, reason } of HARD_REJECT_PATTERNS) {
    if (regex.test(postText)) {
      rejectReasons.push(reason);
    }
  }

  return {
    passed: rejectReasons.length === 0,
    rejectReasons
  };
}
