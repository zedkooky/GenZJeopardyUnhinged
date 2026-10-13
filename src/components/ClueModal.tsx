import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Check, X, Timer, Sparkles, MessageSquare, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { Clue, Team, BuzzerEvent } from '../types/game';
import { playWrongBuzzer, playApplause, playDailyDouble } from '../utils/audio';

interface ClueModalProps {
  clue: Clue;
  categoryName: string;
  teams: Team[];
  activeBuzz: BuzzerEvent | null;
  soundEnabled: boolean;
  onClose: () => void;
  onAwardScore: (clueId: string, teamId: string, isCorrect: boolean, amount: number) => void;
  onPassClue: (clueId: string) => void;
}

export const ClueModal: React.FC<ClueModalProps> = ({
  clue,
  categoryName,
  teams,
  activeBuzz,
  soundEnabled,
  onClose,
  onAwardScore,
  onPassClue,
}) => {
  const [timeLeft, setTimeLeft] = useState(8);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>(
    activeBuzz?.teamId || (teams.length > 0 ? teams[0].id : '')
  );

  // AI Hint state
  const [aiHint, setAiHint] = useState<string | null>(null);
  const [aiHostComment, setAiHostComment] = useState<string | null>(null);
  const [isLoadingHint, setIsLoadingHint] = useState(false);

  // Play Daily double audio when modal opens if it's daily double
  useEffect(() => {
    if (clue.isDailyDouble && soundEnabled) {
      playDailyDouble();
    }
  }, [clue.isDailyDouble, soundEnabled]);

  // Sync selected team when someone buzzes in
  useEffect(() => {
    if (activeBuzz?.teamId) {
      setSelectedTeamId(activeBuzz.teamId);
    }
  }, [activeBuzz]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (soundEnabled) {
            playWrongBuzzer();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [soundEnabled]);

  const handleCorrect = () => {
    if (!selectedTeamId) return;
    if (soundEnabled) playApplause();
    confetti({
      particleCount: 100,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#c3f400', '#7c3aed', '#bf2076', '#ffffff'],
    });
    onAwardScore(clue.id, selectedTeamId, true, clue.value);
  };

  const handleWrong = () => {
    if (!selectedTeamId) return;
    if (soundEnabled) playWrongBuzzer();
    onAwardScore(clue.id, selectedTeamId, false, clue.value);
  };

  // Request AI Clue Hint
  const handleRequestAiHint = async () => {
    setIsLoadingHint(true);
    try {
      const res = await fetch('/api/gemini/clue-hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: categoryName,
          clue: clue.question,
          answer: clue.answer,
        }),
      });
      const data = await res.json();
      if (data.hint) {
        setAiHint(data.hint);
        setAiHostComment(data.hostComment);
      }
    } catch (err) {
      setAiHint(`Think carefully about the cultural origins of ${categoryName}.`);
    } finally {
      setIsLoadingHint(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0f0d15]/85 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className={`w-full max-w-3xl bg-[#211e27] p-6 md:p-8 rounded-2xl shadow-[8px_8px_0_#000000] border-2 ${
          clue.isDailyDouble ? 'border-[#bf2076]' : 'border-[#c3f400]'
        } flex flex-col gap-5 relative`}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b-2 border-[#36333d] pb-4">
          <div className="flex items-center gap-3">
            <span className="font-space font-bold text-lg md:text-xl uppercase text-[#c3f400] tracking-wider">
              {categoryName}
            </span>
            <span className="text-gray-500">•</span>
            <span className="font-space font-bold text-2xl md:text-3xl uppercase text-white">
              ${clue.value}
            </span>
            {clue.isDailyDouble && (
              <span className="px-3 py-0.5 bg-[#bf2076] text-[#ffdde7] font-space text-xs font-bold uppercase rounded-md shadow-[2px_2px_0_#000000] animate-pulse">
                Daily Double!
              </span>
            )}
          </div>

          {/* Countdown Clock */}
          <div className={`flex items-center gap-2 bg-[#0f0d15] px-4 py-1.5 rounded-full shadow-[2px_2px_0_#000000] border ${
            timeLeft <= 3 ? 'border-red-500 animate-pulse text-red-400' : 'border-[#ffb0cd] text-[#ffb0cd]'
          }`}>
            <Timer className="w-5 h-5" />
            <span className="font-space font-bold text-lg tracking-widest font-mono">
              00:0{timeLeft}s
            </span>
          </div>
        </div>

        {/* Clue Prompt */}
        <div className="bg-[#0f0d15] p-6 md:p-8 rounded-xl shadow-inner min-h-[140px] flex items-center justify-center text-center border border-white/5 relative overflow-hidden">
          <div className="absolute inset-0 bg-radial from-white/5 to-transparent pointer-events-none" />
          <p className="font-space text-lg md:text-2xl text-white font-bold leading-relaxed max-w-2xl">
            "{clue.question}"
          </p>
        </div>

        {/* AI Host Hint & Commentary Pill */}
        {aiHint ? (
          <motion.div 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#2b2932] p-3.5 rounded-xl border border-[#c3f400]/40 flex flex-col gap-1 text-left"
          >
            <div className="flex items-center gap-2 text-[#c3f400]">
              <Sparkles className="w-4 h-4" />
              <span className="font-space text-xs font-bold uppercase">AI Host Banter & Hint:</span>
            </div>
            {aiHostComment && (
              <p className="font-space text-xs italic text-[#ccc3d8]">"{aiHostComment}"</p>
            )}
            <p className="font-space text-xs text-white font-medium">💡 Hint: {aiHint}</p>
          </motion.div>
        ) : (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleRequestAiHint}
              disabled={isLoadingHint}
              className="flex items-center gap-1.5 px-3 py-1 bg-[#2b2932] hover:bg-[#36333d] text-[#c3f400] text-xs font-space font-bold uppercase rounded-lg shadow-[2px_2px_0_#000000] transition-all disabled:opacity-50"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>{isLoadingHint ? 'Generating Hint...' : 'Ask AI Host for Hint'}</span>
            </button>
          </div>
        )}

        {/* Answer Box (Expandable / Revealable) */}
        <AnimatePresence>
          {answerRevealed ? (
            <motion.div 
              initial={{ opacity: 0, scaleY: 0.8 }}
              animate={{ opacity: 1, scaleY: 1 }}
              exit={{ opacity: 0 }}
              className="bg-[#7c3aed] p-5 rounded-xl text-center shadow-[3px_3px_0_#000000] border border-white/10"
            >
              <span className="font-space text-xs font-bold uppercase text-[#ede0ff]/80 tracking-widest">
                Correct Response:
              </span>
              <h4 className="font-space text-2xl md:text-3xl font-bold uppercase text-white mt-1">
                {clue.answer}
              </h4>
            </motion.div>
          ) : (
            <div className="bg-[#1d1a23] p-3.5 rounded-xl text-center border border-dashed border-[#7c3aed]/40 text-[#ccc3d8] flex items-center justify-center gap-2">
              <span className="font-space text-xs uppercase tracking-wider">Solution concealed for judging</span>
            </div>
          )}
        </AnimatePresence>

        {/* Buzzed In Status & Team Picker */}
        <div className="bg-[#2b2932] p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-[2px_2px_0_#000000]">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#c3f400] animate-ping" />
            <span className="font-space text-xs md:text-sm uppercase text-[#ccc3d8]">Buzzed In:</span>
            
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="bg-[#14121a] text-[#c3f400] font-space font-bold uppercase text-sm md:text-base px-3 py-1 rounded-lg border border-[#c3f400]/40 focus:outline-none cursor-pointer"
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.emoji} {team.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setAnswerRevealed(!answerRevealed)}
            className="flex items-center gap-1.5 font-space text-xs font-bold uppercase px-4 py-1.5 bg-[#36333d] hover:bg-[#4a4455] text-white rounded-lg shadow-[2px_2px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            {answerRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span>{answerRevealed ? 'Hide Solution' : 'Reveal Solution'}</span>
          </button>
        </div>

        {/* Action Controls (Judgement) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={() => onPassClue(clue.id)}
            className="px-5 py-2.5 bg-[#2b2932] hover:bg-[#36333d] font-space text-xs md:text-sm font-bold uppercase text-[#ccc3d8] hover:text-white rounded-xl shadow-[3px_3px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            Pass / Deadlock
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleWrong}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-[#93000a] text-[#ffdad6] hover:bg-red-700 font-space text-xs md:text-sm font-bold uppercase rounded-xl shadow-[3px_3px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
            >
              <X className="w-4 h-4" />
              <span>Wrong (-${clue.value})</span>
            </button>

            <button
              type="button"
              onClick={handleCorrect}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-[#c3f400] text-black hover:bg-[#abd600] font-space text-xs md:text-sm font-bold uppercase rounded-xl shadow-[4px_4px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Correct (+${clue.value})</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
