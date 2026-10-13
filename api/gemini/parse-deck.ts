import { Type } from '@google/genai';
import { getGemini } from '../_lib/gemini.js';
import type { ApiReq, ApiRes } from '../_lib/http.js';

export default async function handler(req: ApiReq, res: ApiRes) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const ai = getGemini();
  try {
    const { rawContent, topicHint } = req.body;

    if (!rawContent || typeof rawContent !== 'string') {
      return res.status(400).json({ error: 'rawContent is required' });
    }

    const prompt = `You are a Jeopardy! quiz show master and trivia author.
Analyze the following presentation slides or trivia notes and produce a complete Jeopardy game board:
- Exactly 6 cohesive, creative, fun category names (e.g. witty titles with relevant emojis or themes).
- For each category, provide exactly 5 clues with values 200, 400, 600, 800, and 1000 in increasing order of difficulty.
- Clues should be framed in the classic Jeopardy style (a statement or clue where the answer is phrased like "What is...?" or "Who is...?").
- Also generate 4 to 8 extra unassigned staging buffer clues for overflow.
- If the text mentions specific topics or answers, extract and prioritize them!

Topic Hint: ${topicHint || 'General trivia & slide notes'}

Source Content:
${rawContent.slice(0, 15000)}
`;

    let responseText = '';
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              categories: {
                type: Type.ARRAY,
                description: 'List of exactly 6 categories',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING, description: 'Category title e.g. "TikTok Lore" or "Ancient History"' },
                    subtitle: { type: Type.STRING, description: 'Short witty subtitle' },
                    icon: { type: Type.STRING, description: 'Material icon name' },
                    clues: {
                      type: Type.ARRAY,
                      description: 'Exactly 5 clues for values 200, 400, 600, 800, 1000',
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          value: { type: Type.INTEGER },
                          question: { type: Type.STRING },
                          answer: { type: Type.STRING },
                          isDailyDouble: { type: Type.BOOLEAN },
                        },
                        required: ['value', 'question', 'answer'],
                      },
                    },
                  },
                  required: ['name', 'subtitle', 'clues'],
                },
              },
              stagingBuffer: {
                type: Type.ARRAY,
                description: 'Extra overflow clues for the staging stash',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    answer: { type: Type.STRING },
                    suggestedValue: { type: Type.INTEGER },
                    suggestedCategory: { type: Type.STRING },
                  },
                  required: ['question', 'answer', 'suggestedValue'],
                },
              },
            },
            required: ['categories'],
          },
        },
      });
      responseText = response.text || '';
    } catch (primaryErr) {
      console.warn('Primary model error, attempting fallback to gemini-flash-latest...', primaryErr);
      const fallbackResponse = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });
      responseText = fallbackResponse.text || '';
    }

    let parsedJson: any = null;
    try {
      parsedJson = JSON.parse(responseText || '{}');
    } catch {
      parsedJson = null;
    }

    if (!parsedJson || !parsedJson.categories || !Array.isArray(parsedJson.categories)) {
      // Heuristic extraction fallback from slides / text
      const lines = rawContent.split('\n').map((l: string) => l.trim()).filter(Boolean);
      const catNames = [
        '🔥 Viral Trends',
        '💡 Quick Wits',
        '🧠 High IQ Lore',
        '🎧 Audio Bangers',
        '✨ Pure Aesthetics',
        '📱 Internet Milestones',
      ];
      const icons = ['smart_display', 'record_voice_over', 'headphones', 'sports_esports', 'palette', 'sentiment_very_satisfied'];

      const fallbackCategories = catNames.map((name, catIdx) => ({
        name,
        subtitle: `Curated deck category #${catIdx + 1}`,
        icon: icons[catIdx],
        clues: [200, 400, 600, 800, 1000].map((val, clueIdx) => {
          const sampleLine = lines[(catIdx * 5 + clueIdx) % Math.max(lines.length, 1)] || `Fact #${clueIdx + 1} from slide deck`;
          return {
            value: val,
            question: sampleLine.replace(/^Q:|^A:/i, '').trim(),
            answer: `What is ${sampleLine.slice(0, 25).trim()}?`,
            isDailyDouble: catIdx === 2 && clueIdx === 2,
          };
        }),
      }));

      parsedJson = {
        categories: fallbackCategories,
        stagingBuffer: [
          {
            question: 'Surreal brainrot meme phenomenon that captivated millions',
            answer: 'What is Skibidi?',
            suggestedValue: 600,
            suggestedCategory: 'Viral Trends',
          },
          {
            question: 'Aesthetic centered on gathering moss and chaotic forest trinkets',
            answer: 'What is Goblincore?',
            suggestedValue: 400,
            suggestedCategory: 'Pure Aesthetics',
          },
        ],
      };
    }

    return res.json(parsedJson);
  } catch (error: unknown) {
    console.error('Error generating deck:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: msg });
  }
}
