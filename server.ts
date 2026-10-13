import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));

// Server-side Gemini client with required User-Agent header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

/**
 * POST /api/gemini/parse-deck
 * Ingests slide deck text or custom prompt notes and returns structured 6-category Jeopardy deck with graded clues.
 */
app.post('/api/gemini/parse-deck', async (req, res) => {
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
});

/**
 * POST /api/gemini/clue-hint
 * Returns AI game show host hint and commentary for live clue
 */
app.post('/api/gemini/clue-hint', async (req, res) => {
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
});

// Mount Vite middleware in development or serve static in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
