import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  Shuffle, 
  Download, 
  Play, 
  Sparkles, 
  Plus, 
  Trash2, 
  Edit3, 
  Zap, 
  RefreshCw,
  FolderOpen,
  Wand2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Category, Clue, StagingClue } from '../types/game';
import { parsePptxFile, parseRawQaText } from '../utils/pptxParser';

interface DeckBuilderProps {
  categories: Category[];
  stagingBuffer: StagingClue[];
  onUpdateCategories: (categories: Category[]) => void;
  onUpdateStagingBuffer: (buffer: StagingClue[]) => void;
  onLaunchBoard: () => void;
}

export const DeckBuilder: React.FC<DeckBuilderProps> = ({
  categories,
  stagingBuffer,
  onUpdateCategories,
  onUpdateStagingBuffer,
  onLaunchBoard,
}) => {
  const [uploadedFileName, setUploadedFileName] = useState<string>('viral_tiktok_slang_2024.pptx');
  const [slideCount, setSlideCount] = useState<number>(24);
  const [rawText, setRawText] = useState<string>('');
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [autoSeed, setAutoSeed] = useState<boolean>(true);
  const [stakeBalancing, setStakeBalancing] = useState<boolean>(true);
  
  // Custom AI Deck Modal
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [customAiTopic, setCustomAiTopic] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Stats calculation
  const totalSlots = 30; // 6 categories * 5 clues
  let filledSlots = 0;
  categories.forEach((cat) => {
    cat.clues.forEach((c) => {
      if (c.question && c.question.trim().length > 0) filledSlots++;
    });
  });
  const totalCluesLoaded = filledSlots + stagingBuffer.length;

  // Handle PPTX or text file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    try {
      if (file.name.endsWith('.pptx')) {
        showToast('Unpacking and extracting PPTX slides...');
        const { slides } = await parsePptxFile(file);
        setSlideCount(slides.length);
        
        const newStaging: StagingClue[] = slides.map((s, idx) => ({
          id: `slide-${Date.now()}-${idx}`,
          source: `Slide #${s.slideNumber} (${file.name})`,
          question: s.bullets.length > 0 ? s.bullets.join('. ') : s.title,
          answer: `What is ${s.title}?`,
          suggestedValue: [200, 400, 600, 800, 1000][idx % 5],
          suggestedCategory: s.title,
        }));

        onUpdateStagingBuffer([...stagingBuffer, ...newStaging]);
        showToast(`Extracted ${slides.length} slides into staging buffer!`);
      } else {
        const text = await file.text();
        const parsed = parseRawQaText(text);
        if (parsed.length > 0) {
          onUpdateStagingBuffer([...stagingBuffer, ...parsed]);
          showToast(`Parsed ${parsed.length} clues from file!`);
        } else {
          setRawText(text);
          showToast('Text loaded into raw parser!');
        }
      }
    } catch (err) {
      console.error(err);
      showToast('Error parsing file: ' + (err instanceof Error ? err.message : 'Unknown'));
    }
  };

  // Sample Text Loader
  const handleLoadSample = () => {
    setRawText(`Q: What was the purple milkshake trend that gave creators mock crime scene lore? | A: Grimace Shake | Topic: Mainstream Memes
Q: Fast paced high-energy dance originating from Jacksonville hiphop scene | A: KuKu dance | Topic: TikTok Lore & Brainrot
Q: Phrase used when a livestreamer receives a wildly oversized superchat | A: Whale Alert | Topic: Gaming & Streamers
Q: The soft aesthetic featuring vintage pink bows and pastel ribbons | A: Coquette | Topic: Chroma & Aesthetics
Q: According to TikTok, thinking about this ancient empire is a daily occurrence | A: Roman Empire | Topic: Mainstream Memes`);
    showToast('Sample Q&A templates injected into parser!');
  };

  // Parse Raw Text to Staging
  const handleParseRawText = () => {
    if (!rawText.trim()) {
      showToast('Enter raw Q&A or click "Insert Sample" first!');
      return;
    }
    const parsed = parseRawQaText(rawText);
    if (parsed.length > 0) {
      onUpdateStagingBuffer([...stagingBuffer, ...parsed]);
      showToast(`Parsed & added ${parsed.length} clues to Staging Stash!`);
      setRawText('');
    } else {
      showToast('Could not find Q: and A: patterns in text.');
    }
  };

  // Gemini AI Magic Deck Generator
  const runAiGeneration = async (topicHint?: string) => {
    setIsLoadingAi(true);
    showToast('Gemini 3.8 Flash is analyzing deck & categorizing into 6 topics...');

    try {
      const contentToAnalyze = topicHint 
        ? `Generate a custom Jeopardy deck specifically on the topic: "${topicHint}". Create 6 distinct subtopics with 5 questions each ($200 to $1000).`
        : (rawText.trim() || 
           stagingBuffer.map((s) => `[${s.source}] ${s.question} (Ans: ${s.answer})`).join('\n') ||
           categories.map((c) => c.name).join(', '));

      const response = await fetch('/api/gemini/parse-deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawContent: contentToAnalyze,
          topicHint: topicHint || 'High-energy Jeopardy trivia with witty questions',
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      if (data.categories && Array.isArray(data.categories)) {
        const colors = ['#7c3aed', '#bf2076', '#c3f400', '#d2bbff', '#ffb0cd', '#abd600'];
        const newCats: Category[] = data.categories.slice(0, 6).map((c: any, catIdx: number) => ({
          id: `cat-ai-${Date.now()}-${catIdx}`,
          code: `CAT 0${catIdx + 1}`,
          name: c.name,
          subtitle: c.subtitle || 'Generated with AI',
          icon: c.icon || 'smart_display',
          colorTheme: colors[catIdx % colors.length],
          clues: (c.clues || []).slice(0, 5).map((clueItem: any, clueIdx: number) => ({
            id: `c-ai-${catIdx}-${clueIdx}`,
            category: c.name,
            value: clueItem.value || [200, 400, 600, 800, 1000][clueIdx % 5],
            question: clueItem.question,
            answer: clueItem.answer,
            state: 'AVAILABLE',
            isDailyDouble: clueItem.isDailyDouble || false,
          })),
        }));

        onUpdateCategories(newCats);

        if (data.stagingBuffer && Array.isArray(data.stagingBuffer)) {
          const newBuffer: StagingClue[] = data.stagingBuffer.map((b: any, bIdx: number) => ({
            id: `sb-ai-${Date.now()}-${bIdx}`,
            source: 'AI Staging Stash',
            question: b.question,
            answer: b.answer,
            suggestedValue: b.suggestedValue || 600,
            suggestedCategory: b.suggestedCategory,
          }));
          onUpdateStagingBuffer(newBuffer);
        }

        showToast('✨ Gemini successfully populated 6 categories and balanced clues!');
        setIsAiModalOpen(false);
      }
    } catch (err) {
      console.error('AI generation failed', err);
      showToast('AI generation error: ' + (err instanceof Error ? err.message : 'Unknown'));
    } finally {
      setIsLoadingAi(false);
    }
  };

  // Distribute All / Auto-Fill Remaining Empty Slots
  const handleFillEmptySlots = () => {
    let bufferCopy = [...stagingBuffer];
    let filledCount = 0;

    const newCategories = categories.map((cat) => {
      const updatedClues = cat.clues.map((clue) => {
        if (!clue.question || clue.question.trim().length === 0 || clue.state === 'PASSED') {
          if (bufferCopy.length > 0) {
            const nextClue = bufferCopy.shift()!;
            filledCount++;
            return {
              ...clue,
              question: nextClue.question,
              answer: nextClue.answer,
              state: 'AVAILABLE' as const,
            };
          }
        }
        return clue;
      });
      return { ...cat, clues: updatedClues };
    });

    onUpdateCategories(newCategories);
    onUpdateStagingBuffer(bufferCopy);
    showToast(`⚡ Seeded ${filledCount} clues directly into empty slots!`);
  };

  // Shuffle Categories
  const handleShuffle = () => {
    const shuffled = [...categories].sort(() => Math.random() - 0.5);
    onUpdateCategories(shuffled);
    showToast('🎲 Deck columns randomized across the live board!');
  };

  // Export JSON
  const handleExportJson = () => {
    const payload = {
      deckTitle: 'Jeopardy! Unhinged Deck',
      exportedAt: new Date().toISOString(),
      categories,
      stagingBuffer,
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', 'jeopardy_unhinged_deck.json');
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    showToast('📥 Deck exported successfully (.json)!');
  };

  // Slot an individual item from buffer into the first empty slot
  const handleSlotSingleClue = (stagingItem: StagingClue) => {
    let slotted = false;
    const newCategories = categories.map((cat) => {
      const updatedClues = cat.clues.map((clue) => {
        if (!slotted && (!clue.question || clue.question.trim().length === 0 || clue.state === 'PASSED')) {
          slotted = true;
          return {
            ...clue,
            question: stagingItem.question,
            answer: stagingItem.answer,
            state: 'AVAILABLE' as const,
          };
        }
        return clue;
      });
      return { ...cat, clues: updatedClues };
    });

    if (slotted) {
      onUpdateCategories(newCategories);
      onUpdateStagingBuffer(stagingBuffer.filter((s) => s.id !== stagingItem.id));
      showToast(`Slotted "${stagingItem.answer}" into board!`);
    } else {
      showToast('All 30 board slots are occupied! Clear a slot first.');
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Dynamic Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-16 right-8 z-50 bg-[#c3f400] text-black px-4 py-2.5 rounded-xl shadow-[4px_4px_0_#000000] border-2 border-black flex items-center gap-2 animate-in fade-in duration-200">
          <Zap className="w-4 h-4" />
          <span className="font-space text-xs font-bold uppercase tracking-wider">
            {toastMessage}
          </span>
        </div>
      )}

      {/* TOP STUDIO HEADER & TELEMETRY STRIP */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#1d1a23] p-6 rounded-2xl shadow-[4px_4px_0_#000000] border-2 border-black">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-space text-xl md:text-2xl font-bold uppercase tracking-tight text-white">
                Deck Builder & Ingestion Studio
              </h1>
              <div className="flex items-center gap-1 bg-[#c3f400] text-black px-3 py-0.5 rounded-full shadow-[2px_2px_0_#000000]">
                <Sparkles className="w-3.5 h-3.5" />
                <span className="font-space text-[10px] font-bold uppercase tracking-wider">
                  AI Auto-Categorize Enabled
                </span>
              </div>
              <div className="bg-[#2b2932] px-3 py-0.5 rounded-full shadow-[2px_2px_0_#000000]">
                <span className="font-space text-[10px] font-bold text-[#ffb0cd] uppercase tracking-widest">
                  Deck v3.4 [UNHINGED]
                </span>
              </div>
            </div>
            <p className="font-space text-xs md:text-sm text-[#ccc3d8]">
              Ingest raw slide decks, auto-balance monetary stakes, or drag unassigned clues straight onto the live board grid.
            </p>
          </div>

          {/* Macro Studio Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsAiModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#7c3aed] hover:bg-[#9353ff] text-white font-space text-xs font-bold uppercase rounded-xl shadow-[4px_4px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
            >
              <Wand2 className="w-4 h-4 text-[#c3f400]" />
              <span>Generate AI Deck</span>
            </button>

            <button
              type="button"
              onClick={handleFillEmptySlots}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#c3f400] hover:bg-[#abd600] text-black font-space text-xs font-bold uppercase rounded-xl shadow-[4px_4px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
            >
              <Zap className="w-4 h-4" />
              <span>Distribute to Board</span>
            </button>

            <button
              type="button"
              onClick={handleShuffle}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#211e27] hover:bg-[#2b2932] text-white font-space text-xs font-bold uppercase rounded-xl shadow-[3px_3px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
            >
              <Shuffle className="w-4 h-4 text-[#d2bbff]" />
              <span>Shuffle</span>
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#211e27] hover:bg-[#2b2932] text-white font-space text-xs font-bold uppercase rounded-xl shadow-[3px_3px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
            >
              <Download className="w-4 h-4 text-[#ffb0cd]" />
              <span>Export</span>
            </button>

            <button
              type="button"
              onClick={onLaunchBoard}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#c3f400] hover:bg-[#abd600] text-black font-space text-xs font-bold uppercase rounded-xl shadow-[4px_4px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
            >
              <Play className="w-4 h-4" />
              <span>Launch Board</span>
            </button>
          </div>
        </div>

        {/* Quick Telemetry Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#1d1a23] p-3 rounded-xl shadow-[3px_3px_0_#000000] border-2 border-black flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#211e27] flex items-center justify-center text-[#c3f400]">
                <FolderOpen className="w-4 h-4" />
              </div>
              <div>
                <p className="font-space text-[10px] text-[#ccc3d8] uppercase">Clues Loaded</p>
                <p className="font-space text-sm md:text-base font-bold text-[#c3f400]">
                  {totalCluesLoaded} Total
                </p>
              </div>
            </div>
            <span className="font-space text-[10px] text-[#c3f400] bg-[#211e27] px-2 py-0.5 rounded-full">
              100%
            </span>
          </div>

          <div className="bg-[#1d1a23] p-3 rounded-xl shadow-[3px_3px_0_#000000] border-2 border-black flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#211e27] flex items-center justify-center text-[#d2bbff]">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <p className="font-space text-[10px] text-[#ccc3d8] uppercase">Board Occupancy</p>
                <p className="font-space text-sm md:text-base font-bold text-[#d2bbff]">
                  {filledSlots} / {totalSlots} Filled
                </p>
              </div>
            </div>
            <span className="font-space text-[10px] text-[#d2bbff] bg-[#211e27] px-2 py-0.5 rounded-full">
              {totalSlots - filledSlots} Empty
            </span>
          </div>

          <div className="bg-[#1d1a23] p-3 rounded-xl shadow-[3px_3px_0_#000000] border-2 border-black flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#211e27] flex items-center justify-center text-[#ffb0cd]">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <p className="font-space text-[10px] text-[#ccc3d8] uppercase">Unassigned Buffer</p>
                <p className="font-space text-sm md:text-base font-bold text-[#ffb0cd]">
                  {stagingBuffer.length} In Queue
                </p>
              </div>
            </div>
            <span className="font-space text-[10px] text-[#ffb0cd] bg-[#211e27] px-2 py-0.5 rounded-full">
              Staged
            </span>
          </div>

          <div className="bg-[#1d1a23] p-3 rounded-xl shadow-[3px_3px_0_#000000] border-2 border-black flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#211e27] flex items-center justify-center text-[#ccc3d8]">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="font-space text-[10px] text-[#ccc3d8] uppercase">Est. Match Pace</p>
                <p className="font-space text-sm md:text-base font-bold text-white">~25 mins</p>
              </div>
            </div>
            <span className="font-space text-[10px] text-[#ccc3d8] bg-[#211e27] px-2 py-0.5 rounded-full">
              Normal
            </span>
          </div>
        </div>
      </section>

      {/* MAIN TWO-COLUMN SPLIT */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT SIDEBAR: INGESTION STACK (4 Cols) */}
        <div className="xl:col-span-4 flex flex-col gap-4">
          {/* DROPZONE CARD */}
          <div className="bg-[#1d1a23] p-4 rounded-2xl shadow-[4px_4px_0_#000000] border-2 border-black flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#c3f400]" />
                <h2 className="font-space text-sm font-bold uppercase tracking-wide text-white">
                  Presentation Ingestion
                </h2>
              </div>
              <span className="font-space text-[10px] bg-[#211e27] text-[#c3f400] px-2 py-0.5 rounded-full">
                PPTX / KEY / PDF
              </span>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".pptx,.key,.pdf,.txt,.md,.csv"
              className="hidden"
            />

            {/* Drag & Drop Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer bg-[#211e27] hover:bg-[#2b2932] transition-colors p-5 rounded-xl border-2 border-dashed border-[#c3f400]/40 hover:border-[#c3f400] flex flex-col items-center justify-center text-center gap-2 group"
            >
              <div className="w-12 h-12 rounded-xl bg-[#2b2932] flex items-center justify-center text-[#c3f400] group-hover:scale-110 transition-transform shadow-[2px_2px_0_#000000]">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="font-space text-xs font-bold text-white uppercase">
                  Drag & Drop PPT / Keynote Deck
                </p>
                <p className="font-space text-[11px] text-[#ccc3d8]">
                  Auto-detects title slides as Categories & bullets as Q&As
                </p>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-space text-[10px] text-gray-500 uppercase">Max 45MB</span>
                <span className="w-1 h-1 rounded-full bg-gray-500" />
                <span className="font-space text-[10px] text-[#c3f400] uppercase">
                  Supports .pptx, .key, .txt, .csv
                </span>
              </div>
            </div>

            {/* Active File Chip */}
            <div className="flex items-center justify-between bg-[#211e27] p-3 rounded-xl shadow-[2px_2px_0_#000000] border border-white/5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#bf2076] flex-shrink-0 flex items-center justify-center text-white">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <p className="font-space text-xs font-bold text-white truncate">
                    {uploadedFileName}
                  </p>
                  <p className="font-space text-[11px] text-[#ffb0cd]">
                    {slideCount} Slides • {stagingBuffer.length} Clues in buffer
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1 hover:bg-[#36333d] rounded text-gray-400 hover:text-white"
                  title="Re-upload or sync deck"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUploadedFileName('custom_deck.pptx');
                    onUpdateStagingBuffer([]);
                    showToast('Deck buffer cleared.');
                  }}
                  className="p-1 hover:bg-[#36333d] rounded text-gray-400 hover:text-red-400"
                  title="Remove deck"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* BATCH Q&A / CSV PARSER */}
          <div className="bg-[#1d1a23] p-4 rounded-2xl shadow-[4px_4px_0_#000000] border-2 border-black flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#d2bbff]" />
                <h2 className="font-space text-sm font-bold uppercase tracking-wide text-white">
                  Batch Q&A / CSV Parser
                </h2>
              </div>
              <span className="font-space text-[10px] text-[#ccc3d8] uppercase">Raw Ingest</span>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center font-space text-[11px] text-[#ccc3d8] uppercase">
                <span>Format: Q: [Clue] | A: [Ans] | Topic: [Cat]</span>
                <button
                  type="button"
                  onClick={handleLoadSample}
                  className="text-[#c3f400] hover:underline cursor-pointer"
                >
                  Insert Sample
                </button>
              </div>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Q: What is skibidi? | A: Ohio toilet meme | Topic: TikTok Lore&#10;Q: Name the purple grimace shake trend | A: Grimace Shake | Topic: Mainstream Memes"
                rows={4}
                className="w-full bg-[#0f0d15] text-white font-space text-xs p-3 rounded-xl resize-none focus:outline-none focus:ring-1 focus:ring-[#c3f400] border border-white/5"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleParseRawText}
                className="flex-1 py-2 bg-[#7c3aed] hover:bg-[#9353ff] text-white font-space text-xs font-bold uppercase rounded-xl shadow-[3px_3px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center justify-center gap-1.5"
              >
                <span>Parse & Batch Insert</span>
              </button>

              <button
                type="button"
                onClick={() => runAiGeneration()}
                disabled={isLoadingAi}
                className="px-3 py-2 bg-[#c3f400] hover:bg-[#abd600] text-black font-space text-xs font-bold uppercase rounded-xl shadow-[3px_3px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                title="Use Gemini AI to categorize into 6 Jeopardy topics"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isLoadingAi ? 'AI Thinking...' : 'Gemini AI'}</span>
              </button>
            </div>
          </div>

          {/* AUTO-SORT & SEED RULES */}
          <div className="bg-[#1d1a23] p-4 rounded-2xl shadow-[4px_4px_0_#000000] border-2 border-black flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-space text-sm font-bold uppercase tracking-wide text-white">
                Auto-Sort & Seed Rules
              </h2>
              <span className="font-space text-[10px] text-[#c3f400] bg-[#211e27] px-2 py-0.5 rounded-full">
                Active
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between p-2.5 bg-[#211e27] rounded-xl border border-white/5">
                <div>
                  <p className="font-space text-xs font-bold text-white uppercase">
                    Auto-Seed Unassigned Clues
                  </p>
                  <p className="font-space text-[10px] text-[#ccc3d8]">
                    Randomly routes overflow into free slots
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={autoSeed}
                  onChange={(e) => setAutoSeed(e.target.checked)}
                  className="w-4 h-4 accent-[#c3f400] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 bg-[#211e27] rounded-xl border border-white/5">
                <div>
                  <p className="font-space text-xs font-bold text-white uppercase">
                    Stake Balancing ($200-$1,000)
                  </p>
                  <p className="font-space text-[10px] text-[#ccc3d8]">
                    Scores based on complexity & length
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={stakeBalancing}
                  onChange={(e) => setStakeBalancing(e.target.checked)}
                  className="w-4 h-4 accent-[#c3f400] cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE: REAL-TIME BOARD PREVIEW GRID (8 Cols) */}
        <div className="xl:col-span-8 flex flex-col gap-4">
          <div className="bg-[#1d1a23] p-4 md:p-6 rounded-2xl shadow-[4px_4px_0_#000000] border-2 border-black flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b-2 border-[#2b2932]">
              <div className="flex items-center gap-2">
                <h2 className="font-space text-sm md:text-base font-bold uppercase tracking-wide text-white">
                  Active Board Slots (6 Categories)
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleFillEmptySlots}
                  className="px-3 py-1 bg-[#211e27] hover:bg-[#2b2932] text-[#c3f400] font-space text-xs font-bold uppercase rounded-lg shadow-[2px_2px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
                >
                  + Auto-Fill Remaining Slots
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const cleared = categories.map((c) => ({
                      ...c,
                      clues: c.clues.map((cl) => ({ ...cl, question: '', answer: '', state: 'AVAILABLE' as const })),
                    }));
                    onUpdateCategories(cleared);
                    showToast('Board cleared. You can now refill from the staging buffer.');
                  }}
                  className="px-3 py-1 bg-[#211e27] hover:bg-[#2b2932] text-gray-400 hover:text-red-400 font-space text-xs font-bold uppercase rounded-lg shadow-[2px_2px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* THE 6-COLUMN GAME SHOW DECK GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-2.5">
              {categories.map((cat) => {
                const filledInCat = cat.clues.filter((c) => c.question && c.question.trim().length > 0).length;

                return (
                  <div
                    key={cat.id}
                    className="flex flex-col gap-2 bg-[#211e27] p-2 rounded-xl shadow-[2px_2px_0_#000000] border border-black"
                  >
                    {/* Header */}
                    <div className="bg-[#7c3aed] p-2 rounded-lg shadow-[2px_2px_0_#000000] flex flex-col items-center justify-center text-center min-h-[58px]">
                      <span className="font-space text-xs font-bold text-white uppercase line-clamp-2">
                        {cat.name}
                      </span>
                      <span className="font-space text-[10px] text-[#c3f400] font-bold">
                        {filledInCat}/5 Clues
                      </span>
                    </div>

                    {/* Clues */}
                    <div className="flex flex-col gap-2">
                      {cat.clues.map((clue) => {
                        const isEmpty = !clue.question || clue.question.trim().length === 0;

                        if (isEmpty) {
                          return (
                            <div
                              key={clue.id}
                              onClick={() => {
                                if (stagingBuffer.length > 0) {
                                  handleSlotSingleClue(stagingBuffer[0]);
                                } else {
                                  showToast('Add clues to the staging buffer first!');
                                }
                              }}
                              className="cursor-pointer bg-[#0f0d15] hover:bg-[#2b2932] transition-all p-2 rounded-lg border-2 border-dashed border-[#ffb0cd]/40 hover:border-[#ffb0cd] flex flex-col items-center justify-center text-center min-h-[72px]"
                            >
                              <span className="font-space text-xs font-bold text-[#ffb0cd]">
                                ${clue.value}
                              </span>
                              <div className="flex items-center gap-1 text-[#ccc3d8] mt-0.5">
                                <Plus className="w-3 h-3 text-[#ffb0cd]" />
                                <span className="font-space text-[10px] uppercase text-[#ffb0cd]">
                                  + Drop Q&A
                                </span>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={clue.id}
                            className="group bg-[#2b2932] p-2 rounded-lg shadow-[2px_2px_0_#000000] hover:bg-[#36333d] transition-all border border-white/5 relative"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-space text-xs font-bold text-[#c3f400]">
                                ${clue.value}
                              </span>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newQ = prompt('Edit Clue Question:', clue.question);
                                    if (newQ !== null) {
                                      const updatedCats = categories.map((c) => ({
                                        ...c,
                                        clues: c.clues.map((cl) => cl.id === clue.id ? { ...cl, question: newQ } : cl),
                                      }));
                                      onUpdateCategories(updatedCats);
                                    }
                                  }}
                                  className="text-gray-400 hover:text-white"
                                  title="Edit Clue"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updatedCats = categories.map((c) => ({
                                      ...c,
                                      clues: c.clues.map((cl) => cl.id === clue.id ? { ...cl, question: '', answer: '' } : cl),
                                    }));
                                    onUpdateCategories(updatedCats);
                                  }}
                                  className="text-gray-400 hover:text-red-400"
                                  title="Clear Slot"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            <p className="font-space text-[11px] text-white leading-snug line-clamp-2">
                              {clue.question}
                            </p>
                            <span className="font-space text-[9px] text-[#ccc3d8] uppercase mt-1 block truncate">
                              Ans: {clue.answer}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM DRAWER / UNASSIGNED CLUES STAGING BUFFER */}
      <section className="bg-[#1d1a23] p-4 md:p-6 rounded-2xl shadow-[4px_4px_0_#000000] border-2 border-black flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#211e27] flex items-center justify-center text-[#c3f400]">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-space text-sm md:text-base font-bold uppercase text-white">
                  Extracted Clue Staging Buffer
                </h3>
                <span className="font-space text-[10px] bg-[#bf2076] text-white px-2 py-0.5 rounded-full">
                  {stagingBuffer.length} Clues in Stash
                </span>
              </div>
              <p className="font-space text-xs text-[#ccc3d8]">
                Drag clues directly onto empty board slots or hit auto-assign
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleFillEmptySlots}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#c3f400] hover:bg-[#abd600] text-black font-space text-xs font-bold uppercase rounded-xl shadow-[3px_3px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            <Zap className="w-4 h-4" />
            <span>⚡ Assign All to Empty Slots</span>
          </button>
        </div>

        {/* Buffer Clues Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {stagingBuffer.map((item) => (
            <div
              key={item.id}
              className="bg-[#211e27] p-3 rounded-xl shadow-[2px_2px_0_#000000] border border-white/5 flex flex-col justify-between gap-2 hover:border-[#c3f400] transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-space text-[10px] text-[#ffb0cd] uppercase truncate max-w-[150px]">
                    {item.source}
                  </span>
                  <span className="font-space text-[10px] text-[#c3f400] bg-[#2b2932] px-1.5 py-0.5 rounded font-bold">
                    Sug. ${item.suggestedValue}
                  </span>
                </div>
                <p className="font-space text-xs text-white leading-snug line-clamp-2">
                  "{item.question}"
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between gap-2 border-t border-white/5">
                <span className="font-space text-[10px] bg-[#2b2932] text-[#ccc3d8] px-1.5 py-0.5 rounded truncate max-w-[120px]">
                  Ans: {item.answer}
                </span>
                <button
                  type="button"
                  onClick={() => handleSlotSingleClue(item)}
                  className="px-2.5 py-1 bg-[#c3f400] text-black font-space text-[10px] font-bold uppercase rounded-lg hover:bg-[#abd600] active:translate-x-0.5 active:translate-y-0.5 shadow-[2px_2px_0_#000000] transition-all"
                >
                  + Slot In
                </button>
              </div>
            </div>
          ))}

          {stagingBuffer.length === 0 && (
            <div className="col-span-full py-8 text-center text-[#ccc3d8] font-space text-xs uppercase bg-[#211e27] rounded-xl border border-dashed border-white/10">
              No unassigned clues in staging buffer. Upload a PPTX or paste raw Q&A above!
            </div>
          )}
        </div>
      </section>

      {/* AI Custom Deck Modal */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0f0d15]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#211e27] p-6 rounded-2xl shadow-[8px_8px_0_#000000] border-2 border-[#c3f400] flex flex-col gap-4 relative animate-in zoom-in-95">
            <button
              type="button"
              onClick={() => setIsAiModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#c3f400] flex items-center justify-center text-black shadow-[2px_2px_0_#000000]">
                <Wand2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-space text-lg font-bold uppercase text-white">
                  Gemini AI Deck Creator
                </h3>
                <p className="font-space text-xs text-[#ccc3d8]">
                  Type any theme to generate 6 categories with 30 graded clues
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-space text-xs font-bold uppercase text-[#ccc3d8]">
                Deck Theme / Topic:
              </label>
              <input
                type="text"
                value={customAiTopic}
                onChange={(e) => setCustomAiTopic(e.target.value)}
                placeholder="e.g. 90s Pop Culture, World History, Biotech, Marvel Movies, Gen Z Lore"
                className="w-full bg-[#0f0d15] text-white font-space text-sm px-4 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:ring-1 focus:ring-[#c3f400]"
              />

              <div className="flex flex-wrap gap-1.5 mt-1">
                {['Internet Lore', '90s Pop Culture', 'Sci-Fi & Cyberpunk', 'Science & Astronomy', 'World Cinema'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setCustomAiTopic(t)}
                    className="px-2.5 py-1 bg-[#2b2932] hover:bg-[#36333d] text-[#c3f400] font-space text-[10px] font-bold uppercase rounded-lg border border-white/5"
                  >
                    + {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="px-4 py-2 bg-[#2b2932] hover:bg-[#36333d] text-white font-space text-xs font-bold uppercase rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => runAiGeneration(customAiTopic)}
                disabled={isLoadingAi}
                className="px-5 py-2 bg-[#c3f400] hover:bg-[#abd600] text-black font-space text-xs font-bold uppercase rounded-xl shadow-[3px_3px_0_#000000] disabled:opacity-50 flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isLoadingAi ? 'Generating...' : 'Generate 30-Clue Board'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
