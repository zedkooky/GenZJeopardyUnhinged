import JSZip from 'jszip';
import { StagingClue } from '../types/game';

export interface ExtractedSlide {
  slideNumber: number;
  title: string;
  bullets: string[];
  fullText: string;
}

/**
 * Extracts raw slides and text from a PPTX file buffer using JSZip.
 */
export async function parsePptxFile(file: File): Promise<{ slides: ExtractedSlide[]; rawText: string }> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const slides: ExtractedSlide[] = [];
  const slideFiles: string[] = [];

  // Find all slide XML files
  zip.forEach((relativePath) => {
    if (relativePath.match(/^ppt\/slides\/slide[0-9]+\.xml$/)) {
      slideFiles.push(relativePath);
    }
  });

  // Sort slides in natural numeric order: slide1.xml, slide2.xml, ...
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.replace(/[^0-9]/g, ''), 10) || 0;
    const numB = parseInt(b.replace(/[^0-9]/g, ''), 10) || 0;
    return numA - numB;
  });

  let aggregatedText = '';

  for (let i = 0; i < slideFiles.length; i++) {
    const path = slideFiles[i];
    const xmlContent = await zip.file(path)?.async('text');
    if (!xmlContent) continue;

    // Parse XML to extract text nodes <a:t>...</a:t>
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'application/xml');
    const textNodes = Array.from(doc.getElementsByTagName('a:t'));
    const strings = textNodes
      .map((node) => node.textContent?.trim() || '')
      .filter((s) => s.length > 0);

    const title = strings[0] || `Slide #${i + 1}`;
    const bullets = strings.slice(1);
    const fullText = strings.join('\n');

    slides.push({
      slideNumber: i + 1,
      title,
      bullets,
      fullText,
    });

    aggregatedText += `\n--- Slide ${i + 1}: ${title} ---\n${bullets.join('\n')}\n`;
  }

  return { slides, rawText: aggregatedText };
}

/**
 * Parses raw text or markdown or Q&A format lines.
 * Format examples:
 * Q: [question] | A: [answer] | Topic: [category]
 * or
 * Question? Answer.
 */
export function parseRawQaText(rawText: string): StagingClue[] {
  const clues: StagingClue[] = [];
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

  let clueIdx = 1;
  const values = [200, 400, 600, 800, 1000];

  for (const line of lines) {
    // Check piped format Q: ... | A: ... | Topic: ...
    if (line.includes('|')) {
      const parts = line.split('|').map((p) => p.trim());
      let q = '';
      let a = '';
      let cat = '';

      for (const part of parts) {
        if (/^Q(uestion)?:/i.test(part)) {
          q = part.replace(/^Q(uestion)?:\s*/i, '');
        } else if (/^A(nswer)?:/i.test(part)) {
          a = part.replace(/^A(nswer)?:\s*/i, '');
        } else if (/^Topic:|^Cat(egory)?:/i.test(part)) {
          cat = part.replace(/^(Topic|Cat(egory)?):\s*/i, '');
        } else if (!q) {
          q = part;
        } else if (!a) {
          a = part;
        }
      }

      if (q && a) {
        const val = values[(clueIdx - 1) % values.length];
        clues.push({
          id: `raw-${Date.now()}-${clueIdx}`,
          source: cat ? `Topic: ${cat}` : `Parsed Q&A #${clueIdx}`,
          question: q,
          answer: a.startsWith('What is') || a.startsWith('Who is') ? a : `What is ${a}?`,
          suggestedValue: val,
          suggestedCategory: cat || undefined,
        });
        clueIdx++;
      }
    } else if (line.includes('?') && line.length > 5) {
      // Split on first question mark
      const qIndex = line.indexOf('?');
      const question = line.substring(0, qIndex + 1).trim();
      const answer = line.substring(qIndex + 1).trim() || 'What is Jeopardy?';
      const val = values[(clueIdx - 1) % values.length];

      clues.push({
        id: `raw-${Date.now()}-${clueIdx}`,
        source: `Parsed Q&A #${clueIdx}`,
        question,
        answer: answer.startsWith('What is') || answer.startsWith('Who is') ? answer : `What is ${answer}?`,
        suggestedValue: val,
      });
      clueIdx++;
    }
  }

  return clues;
}
