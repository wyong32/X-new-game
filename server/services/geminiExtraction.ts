import { GoogleGenAI } from '@google/genai';

export interface GeminiExtractionResult {
  is_specific_game: boolean;
  game_name: string | null;
  aliases: string[];
  is_probably_new_release: boolean;
  is_browser_or_web_game: boolean;
  confidence: number;
  evidence: string[];
}

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

export async function extractGameWithGemini(
  postText: string,
  urls: string[] = []
): Promise<GeminiExtractionResult | null> {
  const ai = getAiClient();
  if (!ai) {
    return null;
  }

  try {
    const prompt = `You are a strict game title extraction specialist for game research.
Analyze this social media post and determine if a specific video game title is being released, announced, or showcased.

Rules:
1. Extract ONLY the specific unique title of the game.
2. NEVER interpret game engines (Unity, Godot, Unreal, Phaser), platforms (Steam, itch.io, Poki, Newgrounds), generic words ("my game", "a game", "indie game"), hashtags (#indiedev, #gamedev, #gamejam), developer studio names, or genres (RPG, platformer, roguelike) as game titles.
3. If uncertain, return game_name: null and is_specific_game: false. DO NOT HALLUCINATE OR GUESS.
4. Output STRICT JSON adhering to this schema:
{
  "is_specific_game": boolean,
  "game_name": string | null,
  "aliases": string[],
  "is_probably_new_release": boolean,
  "is_browser_or_web_game": boolean,
  "confidence": number (0.0 to 1.0),
  "evidence": string[]
}

Post text:
"""${postText}"""

URLs mentioned:
${urls.map(u => `- ${u}`).join('\n') || 'None'}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const rawText = response.text?.trim();
    if (!rawText) return null;

    const parsed = JSON.parse(rawText) as GeminiExtractionResult;
    return parsed;
  } catch (err) {
    console.warn('Gemini extraction fallback skipped or failed:', err instanceof Error ? err.message : err);
    return null;
  }
}
