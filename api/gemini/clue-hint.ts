import { getGemini } from '../_lib/gemini.js';
import type { ApiReq, ApiRes } from '../_lib/http.js';

export default async function handler(req: ApiReq, res: ApiRes) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const ai = getGemini();
  try {
    const { category, clue, answer } = req.body;
    const prompt = `You are a witty, charismatic Jeopardy! game show host.
Category: "${category}"
Clue: "${clue}"
Actual Answer: "${answer}"

Provide:
1. "hint": A clever 1-sentence cryptic hint that guides the player without giving away the exact solution words.
2. "hostComment": A short, energetic TV game-show host quip.

Return JSON:
{"hint": "string", "hostComment": "string"}`;

    let hintResult = {
      hint: `Keep the theme of ${category || 'the clue'} in mind!`,
      hostComment: "The clock is running down, contestants! Who will take the risk?",
    };

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });
      if (response.text) {
        hintResult = JSON.parse(response.text);
      }
    } catch (primaryErr) {
      try {
        const fallback = await ai.models.generateContent({
          model: 'gemini-flash-latest',
          contents: prompt,
          config: { responseMimeType: 'application/json' },
        });
        if (fallback.text) hintResult = JSON.parse(fallback.text);
      } catch {
        // use default
      }
    }

    return res.json(hintResult);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error generating hint';
    return res.status(500).json({ error: msg });
  }
}
