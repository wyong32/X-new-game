export interface RawMockPost {
  x_post_id: string;
  text: string;
  author_id: string;
  author_username: string;
  created_at: string;
  like_count: number;
  reply_count: number;
  repost_count: number;
  quote_count: number;
  urls: string[];
  hashtags: string[];
  has_media: boolean;
  media_types: string[];
  matching_query_texts: string[];
}

export const MOCK_POSTS_FIXTURES: RawMockPost[] = [
  // 1. FROGBLOOD - Real Indie Game Release (Post 1 by Dev)
  {
    x_post_id: 'x_1001',
    text: 'After 2 years of solo development, I just released my game, FROGBLOOD! It is a fast-paced retro action roguelike where amphibians fight cosmic horrors. Playable in browser demo on itch! https://danieldoan.itch.io/frogblood',
    author_id: 'auth_dev_dan',
    author_username: 'danieldoan_dev',
    created_at: '2026-09-21T18:30:00Z',
    like_count: 84,
    reply_count: 14,
    repost_count: 19,
    quote_count: 3,
    urls: ['https://danieldoan.itch.io/frogblood'],
    hashtags: ['#indiedev', '#gamedev'],
    has_media: true,
    media_types: ['video'],
    matching_query_texts: ['"just released my game"', '"play in browser" game', '#indiedev "out now"']
  },

  // 2. FROGBLOOD - Corroborating Player Post (Post 2 by independent player)
  {
    x_post_id: 'x_1002',
    text: 'Found this game on itch today called "FROGBLOOD" and it is genuinely insane. HTML5 browser support runs super smooth. You need to play this game! https://danieldoan.itch.io/frogblood',
    author_id: 'auth_player_sarah',
    author_username: 'pixel_sarah',
    created_at: '2026-09-21T19:15:00Z',
    like_count: 42,
    reply_count: 6,
    repost_count: 8,
    quote_count: 1,
    urls: ['https://danieldoan.itch.io/frogblood'],
    hashtags: ['#webgame'],
    has_media: true,
    media_types: ['photo'],
    matching_query_texts: ['"found this game"', '"you need to play this game"', '"this game is insane"']
  },

  // 3. FROGBLOOD - Demo Edition formatting variation (Post 3 - tests deduplication)
  {
    x_post_id: 'x_1003',
    text: 'Frogblood [Demo] is out now! We just launched our webgl build so you can play in browser without downloading. Feedback appreciated! https://danieldoan.itch.io/frogblood',
    author_id: 'auth_dev_dan',
    author_username: 'danieldoan_dev',
    created_at: '2026-09-21T19:45:00Z',
    like_count: 28,
    reply_count: 5,
    repost_count: 4,
    quote_count: 0,
    urls: ['https://danieldoan.itch.io/frogblood'],
    hashtags: ['#webgl', '#indiegame'],
    has_media: true,
    media_types: ['video'],
    matching_query_texts: ['"browser game" "out now"', '#indiegame "out now"', '"play in browser" game']
  },

  // 4. Pixel Frog Hotel - Browser game release on Poki
  {
    x_post_id: 'x_1004',
    text: 'My new game "Pixel Frog Hotel" is out now! Run a cozy bed-and-breakfast for traveling swamp critters. Playable in browser right now on Poki! https://poki.com/en/g/pixel-frog-hotel',
    author_id: 'auth_lily',
    author_username: 'lily_pixels',
    created_at: '2026-09-21T17:00:00Z',
    like_count: 112,
    reply_count: 18,
    repost_count: 31,
    quote_count: 4,
    urls: ['https://poki.com/en/g/pixel-frog-hotel'],
    hashtags: ['#indiedev', '#pixelart', '#cozygames'],
    has_media: true,
    media_types: ['video'],
    matching_query_texts: ['"my game is out now"', '"playable in browser" game', '"browser game" released']
  },

  // 5. Pixel Frog Hotel - Player reaction
  {
    x_post_id: 'x_1005',
    text: 'If you want something wholesome, try "Pixel Frog Hotel" in browser. Such a charming cozy time waster! #indiegame',
    author_id: 'auth_cozyfan',
    author_username: 'cozy_gamer_tea',
    created_at: '2026-09-21T18:00:00Z',
    like_count: 35,
    reply_count: 4,
    repost_count: 5,
    quote_count: 0,
    urls: ['https://poki.com/en/g/pixel-frog-hotel'],
    hashtags: ['#indiegame'],
    has_media: false,
    media_types: [],
    matching_query_texts: ['"playable in browser" game', '#indiegame released']
  },

  // 6. Tiny Fishing Horror - Ludum Dare / Game Jam Entry
  {
    x_post_id: 'x_1006',
    text: 'Made for a game jam over 48 hours! "Tiny Fishing Horror" is a tranquil fishing sim until the sun sets... Playable in browser on itch: https://spookydev.itch.io/tiny-fishing-horror #ldjam #gamejam',
    author_id: 'auth_spooky',
    author_username: 'spookydev',
    created_at: '2026-09-21T16:20:00Z',
    like_count: 67,
    reply_count: 11,
    repost_count: 15,
    quote_count: 2,
    urls: ['https://spookydev.itch.io/tiny-fishing-horror'],
    hashtags: ['#ldjam', '#gamejam', '#indiedev'],
    has_media: true,
    media_types: ['video'],
    matching_query_texts: ['"made for a game jam"', '#ldjam game', '#gamejam released', '"play in browser" game']
  },

  // 7. Tiny Fishing Horror - Second Jam player post
  {
    x_post_id: 'x_1007',
    text: 'This game is terrifying!! Tiny Fishing Horror from the latest jam got me so bad. Play it in browser if you dare: https://spookydev.itch.io/tiny-fishing-horror',
    author_id: 'auth_streamer_ken',
    author_username: 'kenplayshorror',
    created_at: '2026-09-21T17:40:00Z',
    like_count: 94,
    reply_count: 19,
    repost_count: 12,
    quote_count: 5,
    urls: ['https://spookydev.itch.io/tiny-fishing-horror'],
    hashtags: ['#horrorgames'],
    has_media: true,
    media_types: ['video'],
    matching_query_texts: ['"this game is terrifying"', '"you need to play this game"']
  },

  // 8. Browser Knight - WebGL action game on CrazyGames
  {
    x_post_id: 'x_1008',
    text: 'I just launched my game, Browser Knight! A 2D parry-and-strike boss rush built in Phaser HTML5. Free to play in browser now! https://crazygames.com/game/browser-knight',
    author_id: 'auth_phaser_dave',
    author_username: 'phaserdave',
    created_at: '2026-09-21T14:10:00Z',
    like_count: 53,
    reply_count: 8,
    repost_count: 10,
    quote_count: 1,
    urls: ['https://crazygames.com/game/browser-knight'],
    hashtags: ['#webgame', '#html5', '#phaser'],
    has_media: true,
    media_types: ['photo'],
    matching_query_texts: ['"just launched my game"', '"HTML5 game" released', '"browser game" released']
  },

  // 9. Dungeon Office - Comedy narrative web game
  {
    x_post_id: 'x_1009',
    text: 'I finally released Dungeon Office! You manage HR complaints from goblins, orcs, and skeletons. Playable in browser: https://officegoblin.github.io/dungeon-office #indiedev #webgl',
    author_id: 'auth_goblin_hr',
    author_username: 'officegoblin',
    created_at: '2026-09-21T15:00:00Z',
    like_count: 78,
    reply_count: 12,
    repost_count: 17,
    quote_count: 3,
    urls: ['https://officegoblin.github.io/dungeon-office'],
    hashtags: ['#indiedev', '#webgl'],
    has_media: true,
    media_types: ['video'],
    matching_query_texts: ['"I finally released" game', '"playable in browser" game', '"WebGL game" released']
  },

  // 10. Dungeon Office - Player reaction
  {
    x_post_id: 'x_1010',
    text: 'This game is hilarious! Dungeon Office HR simulator had me in tears. Play in browser at https://officegoblin.github.io/dungeon-office',
    author_id: 'auth_rpg_fan',
    author_username: 'tabletop_tom',
    created_at: '2026-09-21T16:15:00Z',
    like_count: 38,
    reply_count: 7,
    repost_count: 4,
    quote_count: 1,
    urls: ['https://officegoblin.github.io/dungeon-office'],
    hashtags: ['#indiegame'],
    has_media: false,
    media_types: [],
    matching_query_texts: ['"this game is hilarious"', '"play in browser" game']
  },

  // 11. Generic Title Protection Test: "I made a game called Run"
  {
    x_post_id: 'x_1011',
    text: 'I made a game called Run. It is a minimalist infinite reflex game. Download for Windows: https://genericguy.itch.io/run',
    author_id: 'auth_generic_joe',
    author_username: 'joe_coder',
    created_at: '2026-09-21T12:00:00Z',
    like_count: 4,
    reply_count: 1,
    repost_count: 0,
    quote_count: 0,
    urls: ['https://genericguy.itch.io/run'],
    hashtags: ['#gamedev'],
    has_media: false,
    media_types: [],
    matching_query_texts: ['"I made a game"']
  },

  // 12. Generic Title Protection Test: "Battle"
  {
    x_post_id: 'x_1012',
    text: 'I just released Battle on itch! Quick top down shooter.',
    author_id: 'auth_shooter_guy',
    author_username: 'shooter_dev',
    created_at: '2026-09-21T13:00:00Z',
    like_count: 2,
    reply_count: 0,
    repost_count: 0,
    quote_count: 0,
    urls: [],
    hashtags: ['#indiedev'],
    has_media: false,
    media_types: [],
    matching_query_texts: ['"I just released" game']
  },

  // 13. NOISE / HARD REJECT: Recruitment / Job opening
  {
    x_post_id: 'x_1013',
    text: "We are hiring! Looking for a Senior Unity C# Developer to join our team in London or remote. Competitive salary & stock options. Apply here: https://studio.example.com/careers #gamedev #indiedev #job",
    author_id: 'auth_recruiter',
    author_username: 'games_recruitment_uk',
    created_at: '2026-09-21T11:00:00Z',
    like_count: 15,
    reply_count: 2,
    repost_count: 6,
    quote_count: 0,
    urls: ['https://studio.example.com/careers'],
    hashtags: ['#gamedev', '#indiedev', '#job'],
    has_media: false,
    media_types: [],
    matching_query_texts: ['#indiedev "out now"', '#gamedev "play my game"']
  },

  // 14. NOISE / HARD REJECT: Tutorial / Course
  {
    x_post_id: 'x_1014',
    text: 'New tutorial! How to make games in Godot 4: Complete beginner course part 1. Learn gdscript, nodes, and physics! Watch on YouTube: https://youtube.com/watch?v=tutorial123 #gamedev',
    author_id: 'auth_tutor',
    author_username: 'godot_academy',
    created_at: '2026-09-21T10:30:00Z',
    like_count: 45,
    reply_count: 5,
    repost_count: 12,
    quote_count: 1,
    urls: ['https://youtube.com/watch?v=tutorial123'],
    hashtags: ['#gamedev', '#godot'],
    has_media: true,
    media_types: ['photo'],
    matching_query_texts: ['"I made a game"']
  },

  // 15. NOISE / HARD REJECT: Asset Pack Sale
  {
    x_post_id: 'x_1015',
    text: '🔥 50% OFF Unreal Marketplace Asset Pack! Over 200+ modular medieval dungeon 3d models pack with 4K textures and shaders. On sale now! https://unrealengine.com/marketplace/pack123',
    author_id: 'auth_asset_store',
    author_username: '3d_art_store',
    created_at: '2026-09-21T09:00:00Z',
    like_count: 33,
    reply_count: 1,
    repost_count: 9,
    quote_count: 0,
    urls: ['https://unrealengine.com/marketplace/pack123'],
    hashtags: ['#gamedev', '#indiedev'],
    has_media: true,
    media_types: ['photo'],
    matching_query_texts: ['#indiedev "out now"']
  },

  // 16. NOISE / HARD REJECT: Crypto / NFT Web3
  {
    x_post_id: 'x_1016',
    text: 'Big airdrop alert! Our play-to-earn crypto NFT casino game token is launching today on Solana. Mint now to win $SOL! #web3game',
    author_id: 'auth_crypto_shill',
    author_username: 'crypto_moon_gems',
    created_at: '2026-09-21T08:15:00Z',
    like_count: 140,
    reply_count: 55,
    repost_count: 88,
    quote_count: 4,
    urls: ['https://mint-token-airdrop.example.com'],
    hashtags: ['#web3game', '#crypto'],
    has_media: false,
    media_types: [],
    matching_query_texts: ['"just launched my game"']
  },

  // 17. NOISE / HARD REJECT: Marketing Agency Pitch
  {
    x_post_id: 'x_1017',
    text: 'We are a premier video game marketing agency. We offer gamedev PR services, influencer campaigns, and Steam launch management. DM us today!',
    author_id: 'auth_agency',
    author_username: 'indie_pr_boost',
    created_at: '2026-09-21T07:45:00Z',
    like_count: 8,
    reply_count: 0,
    repost_count: 2,
    quote_count: 0,
    urls: ['https://indiepragency.example.com'],
    hashtags: ['#gamedev', '#indiedev'],
    has_media: false,
    media_types: [],
    matching_query_texts: ['#indiedev released']
  },

  // 18. NOISE: Old Game Promotion / Nostalgia
  {
    x_post_id: 'x_1018',
    text: 'Revisiting Celeste after 6 years. You need to play this game if you have never tried it, the movement physics and emotional story still hit so hard. #gaming',
    author_id: 'auth_retrogamer',
    author_username: 'retro_dan',
    created_at: '2026-09-21T06:30:00Z',
    like_count: 210,
    reply_count: 32,
    repost_count: 18,
    quote_count: 5,
    urls: [],
    hashtags: ['#gaming'],
    has_media: true,
    media_types: ['photo'],
    matching_query_texts: ['"you need to play this game"']
  },

  // 19. Asteroid Courier - GMTK Jam Game
  {
    x_post_id: 'x_1019',
    text: 'Our #gmtkjam game "Asteroid Courier" is out now! Deliver fragile cargo across deep space with quirky zero-G thrust physics. Playable in browser: https://neil.itch.io/asteroid-courier',
    author_id: 'auth_neil_code',
    author_username: 'neil_creates',
    created_at: '2026-09-21T15:45:00Z',
    like_count: 61,
    reply_count: 9,
    repost_count: 14,
    quote_count: 2,
    urls: ['https://neil.itch.io/asteroid-courier'],
    hashtags: ['#gmtkjam', '#indiedev', '#webgame'],
    has_media: true,
    media_types: ['video'],
    matching_query_texts: ['#gmtkjam game', '#gamejam "play"', '"playable in browser" game']
  },

  // 20. Neon Drift 84 - Steam & Web launch
  {
    x_post_id: 'x_1020',
    text: 'I just launched my game "Neon Drift 84"! Synthwave drift racing with procedurally generated midnight highways. Available on Steam and free browser demo: https://store.steampowered.com/app/987654/Neon_Drift_84/',
    author_id: 'auth_synth_racer',
    author_username: 'neon_racer_dev',
    created_at: '2026-09-21T13:30:00Z',
    like_count: 95,
    reply_count: 16,
    repost_count: 23,
    quote_count: 4,
    urls: ['https://store.steampowered.com/app/987654/Neon_Drift_84/'],
    hashtags: ['#indiedev', '#synthwave'],
    has_media: true,
    media_types: ['video'],
    matching_query_texts: ['"just launched my game"', '#indiedev "out now"', '#indiegame "out now"']
  },

  // 21. Neon Drift 84 - Second Post (Developer updates)
  {
    x_post_id: 'x_1021',
    text: 'Neon Drift 84 just released on Steam and itch! Thank you everyone who tested the beta during development! https://store.steampowered.com/app/987654/Neon_Drift_84/',
    author_id: 'auth_synth_racer',
    author_username: 'neon_racer_dev',
    created_at: '2026-09-21T14:45:00Z',
    like_count: 44,
    reply_count: 7,
    repost_count: 6,
    quote_count: 1,
    urls: ['https://store.steampowered.com/app/987654/Neon_Drift_84/'],
    hashtags: ['#indiegame'],
    has_media: true,
    media_types: ['photo'],
    matching_query_texts: ['#indiegame released', '#indiedev released']
  },

  // 22. Sprout Witch - Cozy browser garden simulator
  {
    x_post_id: 'x_1022',
    text: 'I made this game called "Sprout Witch" for a 72-hour game jam. Brew botanical potions and cure enchanted pumpkins. Play in browser on itch: https://witchydev.itch.io/sprout-witch',
    author_id: 'auth_witch_craft',
    author_username: 'witchydev',
    created_at: '2026-09-21T12:30:00Z',
    like_count: 57,
    reply_count: 8,
    repost_count: 11,
    quote_count: 2,
    urls: ['https://witchydev.itch.io/sprout-witch'],
    hashtags: ['#gamejam', '#indiedev'],
    has_media: true,
    media_types: ['video'],
    matching_query_texts: ['"I made this game"', '"made for a game jam"', '"play in browser" game']
  },

  // 23. Shadow Weaver - Metroidvania announcement
  {
    x_post_id: 'x_1023',
    text: 'My game "Shadow Weaver" is out now! Weave silk bridges and climb deep subterranean catacombs. Steam store page is live! https://store.steampowered.com/app/554433/Shadow_Weaver/',
    author_id: 'auth_silk_spider',
    author_username: 'spider_studios',
    created_at: '2026-09-21T11:45:00Z',
    like_count: 130,
    reply_count: 24,
    repost_count: 36,
    quote_count: 6,
    urls: ['https://store.steampowered.com/app/554433/Shadow_Weaver/'],
    hashtags: ['#indiedev', '#metroidvania', '#pixelart'],
    has_media: true,
    media_types: ['video'],
    matching_query_texts: ['"my game is out now"', '#indiedev "out now"']
  },

  // 24. Slime Arena 3D - WebGL HTML5 Arena
  {
    x_post_id: 'x_1024',
    text: 'WebGL game released! "Slime Arena 3D" is playable in browser with friends. Made with Godot web export. https://slimearena.github.io/play/ #webgl #html5',
    author_id: 'auth_slime_dev',
    author_username: 'slime_guy_99',
    created_at: '2026-09-21T10:15:00Z',
    like_count: 48,
    reply_count: 6,
    repost_count: 8,
    quote_count: 1,
    urls: ['https://slimearena.github.io/play/'],
    hashtags: ['#webgl', '#html5', '#godot'],
    has_media: true,
    media_types: ['photo'],
    matching_query_texts: ['"WebGL game" released', '"HTML5 game" released', '"playable in browser" game']
  },

  // 25. NOISE: Generic gamedev shader progress without a released game
  {
    x_post_id: 'x_1025',
    text: 'Spent the weekend tweaking water reflection shaders and atmospheric fog in Unreal Engine 5. #gamedev #indiedev #madewithunreal',
    author_id: 'auth_shader_tech',
    author_username: 'unreal_dan',
    created_at: '2026-09-21T09:30:00Z',
    like_count: 55,
    reply_count: 4,
    repost_count: 3,
    quote_count: 0,
    urls: [],
    hashtags: ['#gamedev', '#indiedev'],
    has_media: true,
    media_types: ['video'],
    matching_query_texts: ['#indiedev "out now"']
  },

  // 26. Spellbound Bakery - itch launch
  {
    x_post_id: 'x_1026',
    text: 'I made a new game! "Spellbound Bakery" lets you bake magical sourdough to charm woodland spirits. Try it in browser for free: https://bakerdev.itch.io/spellbound-bakery',
    author_id: 'auth_sourdough_dev',
    author_username: 'bakerdev',
    created_at: '2026-09-21T08:50:00Z',
    like_count: 89,
    reply_count: 15,
    repost_count: 22,
    quote_count: 3,
    urls: ['https://bakerdev.itch.io/spellbound-bakery'],
    hashtags: ['#indiedev', '#cozygame'],
    has_media: true,
    media_types: ['photo'],
    matching_query_texts: ['"I made a new game"', '"play in browser" game']
  },

  // 27. Spellbound Bakery - player mention
  {
    x_post_id: 'x_1027',
    text: 'Found this game called Spellbound Bakery while browsing itch today. The art style is adorable! https://bakerdev.itch.io/spellbound-bakery',
    author_id: 'auth_indie_curator',
    author_username: 'wholesome_indies',
    created_at: '2026-09-21T09:40:00Z',
    like_count: 62,
    reply_count: 7,
    repost_count: 11,
    quote_count: 2,
    urls: ['https://bakerdev.itch.io/spellbound-bakery'],
    hashtags: ['#indiegame'],
    has_media: true,
    media_types: ['photo'],
    matching_query_texts: ['"found this game"']
  },

  // 28. NOISE: Generic opinion
  {
    x_post_id: 'x_1028',
    text: 'Honestly, making a game is 10% coding and 90% fixing things you broke 5 minutes ago while trying to optimize a loop. #gamedev #indiedev',
    author_id: 'auth_random_coder',
    author_username: 'code_thoughts',
    created_at: '2026-09-21T07:10:00Z',
    like_count: 420,
    reply_count: 65,
    repost_count: 89,
    quote_count: 12,
    urls: [],
    hashtags: ['#gamedev', '#indiedev'],
    has_media: false,
    media_types: [],
    matching_query_texts: ['"I made a game"']
  },

  // 29. Void Drifter - PICO-8 Web game
  {
    x_post_id: 'x_1029',
    text: 'HTML5 game released! "Void Drifter" is a minimalist PICO-8 orbital dodge game. Playable in browser on itch: https://retrobyte.itch.io/void-drifter #pico8 #html5',
    author_id: 'auth_pico_master',
    author_username: 'retrobyte',
    created_at: '2026-09-21T06:00:00Z',
    like_count: 36,
    reply_count: 4,
    repost_count: 7,
    quote_count: 0,
    urls: ['https://retrobyte.itch.io/void-drifter'],
    hashtags: ['#pico8', '#html5'],
    has_media: true,
    media_types: ['video'],
    matching_query_texts: ['"HTML5 game" released', '"playable in browser" game']
  },

  // 30. Robo Cleaner 9000 - Viral funny physics game
  {
    x_post_id: 'x_1030',
    text: 'This game is hilarious. In "Robo Cleaner 9000" you are an angry robot vacuum trying to clean an apartment during a wild house party. Free browser game out now: https://cleaner.itch.io/robo-cleaner-9000',
    author_id: 'auth_funny_streamer',
    author_username: 'laughing_jack',
    created_at: '2026-09-21T05:20:00Z',
    like_count: 175,
    reply_count: 28,
    repost_count: 34,
    quote_count: 8,
    urls: ['https://cleaner.itch.io/robo-cleaner-9000'],
    hashtags: ['#indiegame'],
    has_media: true,
    media_types: ['video'],
    matching_query_texts: ['"this game is hilarious"', '"browser game" "out now"']
  },

  // 31. Iron Sentinel - Solo dev indie launch
  {
    x_post_id: 'x_1031',
    text: 'I finally released my game, Iron Sentinel! A dieselpunk mech tower defense built over 18 months. Grab it now on Steam: https://store.steampowered.com/app/778899/Iron_Sentinel/',
    author_id: 'auth_mech_builder',
    author_username: 'iron_dev',
    created_at: '2026-09-21T04:30:00Z',
    like_count: 104,
    reply_count: 19,
    repost_count: 27,
    quote_count: 3,
    urls: ['https://store.steampowered.com/app/778899/Iron_Sentinel/'],
    hashtags: ['#indiedev', '#steam'],
    has_media: true,
    media_types: ['video'],
    matching_query_texts: ['"I finally released" game', '#indiedev "out now"']
  },

  // 32. Pocket Alchemist - Web game
  {
    x_post_id: 'x_1032',
    text: 'Browser game out now! "Pocket Alchemist" - combine 150+ mystical elements on a pocket grid. Play in browser at https://alchemist.crazygames.com/game/pocket-alchemist',
    author_id: 'auth_alchemy_lab',
    author_username: 'pocket_alchemist_game',
    created_at: '2026-09-21T03:50:00Z',
    like_count: 49,
    reply_count: 6,
    repost_count: 9,
    quote_count: 1,
    urls: ['https://crazygames.com/game/pocket-alchemist'],
    hashtags: ['#webgame'],
    has_media: true,
    media_types: ['photo'],
    matching_query_texts: ['"browser game" "out now"', '"play in browser" game']
  },

  // 33. NOISE: Tutorial course promotion
  {
    x_post_id: 'x_1033',
    text: 'Ever wanted to learn how to make games? Enroll in our 12-week Unreal Engine masterclass course on Udemy. Link in bio! #gamedev',
    author_id: 'auth_course_seller',
    author_username: 'unreal_courses_online',
    created_at: '2026-09-21T03:00:00Z',
    like_count: 12,
    reply_count: 0,
    repost_count: 1,
    quote_count: 0,
    urls: ['https://udemy.example.com/course123'],
    hashtags: ['#gamedev'],
    has_media: false,
    media_types: [],
    matching_query_texts: ['"I made a game"']
  },

  // 34. Cyber Neon Katana - Ludum dare release
  {
    x_post_id: 'x_1034',
    text: 'Made for a game jam! #ldjam "Cyber Neon Katana" is a one-button rhythm slasher. Playable in browser: https://pixelblade.itch.io/cyber-neon-katana',
    author_id: 'auth_blade_runner',
    author_username: 'pixelblade',
    created_at: '2026-09-21T02:15:00Z',
    like_count: 51,
    reply_count: 7,
    repost_count: 12,
    quote_count: 2,
    urls: ['https://pixelblade.itch.io/cyber-neon-katana'],
    hashtags: ['#ldjam', '#indiedev'],
    has_media: true,
    media_types: ['video'],
    matching_query_texts: ['"made for a game jam"', '#ldjam game', '"playable in browser" game']
  },

  // 35. Deep Space Cargo - Web game released
  {
    x_post_id: 'x_1035',
    text: 'Web game released today: "Deep Space Cargo". Dock massive freighters using realistic thruster inertia in your browser: https://spacecargo.itch.io/deep-space-cargo #webgame',
    author_id: 'auth_cargo_dev',
    author_username: 'spacecargo_dev',
    created_at: '2026-09-21T01:40:00Z',
    like_count: 32,
    reply_count: 4,
    repost_count: 6,
    quote_count: 0,
    urls: ['https://spacecargo.itch.io/deep-space-cargo'],
    hashtags: ['#webgame'],
    has_media: true,
    media_types: ['photo'],
    matching_query_texts: ['"web game" released', '"play in browser" game']
  },

  // 36. NOISE: Recruitment
  {
    x_post_id: 'x_1036',
    text: 'Looking for a freelance 3D character artist for an upcoming stylized action RPG. Must have experience with Blender & ZBrush. Portfolio to jobs@indiegames.example.com #gamedev',
    author_id: 'auth_recruiter_2',
    author_username: 'indie_jobs_hub',
    created_at: '2026-09-21T01:00:00Z',
    like_count: 19,
    reply_count: 8,
    repost_count: 7,
    quote_count: 1,
    urls: [],
    hashtags: ['#gamedev'],
    has_media: false,
    media_types: [],
    matching_query_texts: ['#gamedev "play my game"']
  },

  // 37. Clockwork Manor - Escape room web game
  {
    x_post_id: 'x_1037',
    text: 'I just released my game "Clockwork Manor"! Point and click mystery puzzles inside an eccentric Victorian automaton mansion. Playable in browser: https://clockwork.itch.io/clockwork-manor',
    author_id: 'auth_puzzle_solver',
    author_username: 'clockwork_games',
    created_at: '2026-09-21T00:20:00Z',
    like_count: 65,
    reply_count: 10,
    repost_count: 13,
    quote_count: 2,
    urls: ['https://clockwork.itch.io/clockwork-manor'],
    hashtags: ['#indiedev', '#puzzle'],
    has_media: true,
    media_types: ['video'],
    matching_query_texts: ['"just released my game"', '"playable in browser" game']
  },

  // 38. NOISE: Asset pack
  {
    x_post_id: 'x_1038',
    text: 'Unity asset store sale! Grab our complete retro low poly vehicle pack with 50 cars, trucks, and motorcycles. Plugin sale ends Friday! https://assetstore.unity.com/packages/12345',
    author_id: 'auth_unity_vendor',
    author_username: 'poly_vehicles',
    created_at: '2026-09-20T23:30:00Z',
    like_count: 24,
    reply_count: 2,
    repost_count: 4,
    quote_count: 0,
    urls: ['https://assetstore.unity.com/packages/12345'],
    hashtags: ['#gamedev', '#unity3d'],
    has_media: true,
    media_types: ['photo'],
    matching_query_texts: ['#indiedev released']
  },

  // 39. Haunted Submarine - Viral horror post
  {
    x_post_id: 'x_1039',
    text: 'This game is terrifying! "Haunted Submarine" is an iron-lung style claustrophobic horror game made in Godot. Play in browser on itch: https://deepsea.itch.io/haunted-submarine',
    author_id: 'auth_horror_streamer',
    author_username: 'scary_night_live',
    created_at: '2026-09-20T22:45:00Z',
    like_count: 215,
    reply_count: 36,
    repost_count: 45,
    quote_count: 10,
    urls: ['https://deepsea.itch.io/haunted-submarine'],
    hashtags: ['#horrorgame'],
    has_media: true,
    media_types: ['video'],
    matching_query_texts: ['"this game is terrifying"', '"you need to play this game"']
  },

  // 40. Haunted Submarine - Second player recommendation
  {
    x_post_id: 'x_1040',
    text: 'You need to play this game tonight: Haunted Submarine. Short 15 minute browser experience with incredible audio design! https://deepsea.itch.io/haunted-submarine',
    author_id: 'auth_indie_gem_finder',
    author_username: 'hidden_gems_bot',
    created_at: '2026-09-20T23:15:00Z',
    like_count: 88,
    reply_count: 14,
    repost_count: 19,
    quote_count: 3,
    urls: ['https://deepsea.itch.io/haunted-submarine'],
    hashtags: ['#indiegames'],
    has_media: false,
    media_types: [],
    matching_query_texts: ['"you need to play this game"', '"play in browser" game']
  },

  // 41. Pixel Dungeon Chef - Indie launch
  {
    x_post_id: 'x_1041',
    text: '#indiegame released! "Pixel Dungeon Chef" - cook meals out of monster loot. Playable in browser demo on itch: https://chef.itch.io/pixel-dungeon-chef',
    author_id: 'auth_chef_dev',
    author_username: 'pixelchef_games',
    created_at: '2026-09-20T21:30:00Z',
    like_count: 72,
    reply_count: 11,
    repost_count: 16,
    quote_count: 2,
    urls: ['https://chef.itch.io/pixel-dungeon-chef'],
    hashtags: ['#indiegame', '#pixelart'],
    has_media: true,
    media_types: ['video'],
    matching_query_texts: ['#indiegame released', '"playable in browser" game']
  },

  // 42. NOISE: Crypto shill
  {
    x_post_id: 'x_1042',
    text: 'Join the revolution! Web3 meta casino tokens airdropping now. RT and follow to win 500 $CASINO coins. #crypto #giveaway',
    author_id: 'auth_bot_crypto',
    author_username: 'sol_airdrops_fast',
    created_at: '2026-09-20T20:00:00Z',
    like_count: 310,
    reply_count: 120,
    repost_count: 250,
    quote_count: 8,
    urls: ['https://sol-airdrop-win.example.com'],
    hashtags: ['#crypto', '#giveaway'],
    has_media: false,
    media_types: [],
    matching_query_texts: ['"just launched my game"']
  }
];
