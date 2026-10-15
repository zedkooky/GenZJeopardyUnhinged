import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Check, X, Timer, Sparkles, Bot, Play, Plus, Lock, Hourglass } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { Clue, Team } from '../types/game';
import type { RoomClaim, RoomRound } from '../utils/realtime';
import { useRoundClock, formatClock } from '../utils/useRoundClock';
import {
  playWrongBuzzer, playApplause, playDailyDouble, playBuzzerSound, startThinkMusic, stopThinkMusic,
} from '../utils/audio';

const EXTEND_STEPS_SECONDS = [10, 30];
const LOW_TIME_SECONDS = 5;

interface ClueModalProps {
  clue: Clue;
  categoryName: string;
  teams: Team[];
  round: RoomRound | null;
  answerer: RoomClaim | null;
  serverOffsetMs: number;
  timerSeconds: number;
  soundEnabled: boolean;
  onStart: () => void;
  onExtend: (seconds: number) => void;
  onClose: () => void;
  onAwardScore: (clueId: string, teamId: string, isCorrect: boolean, amount: number) => void;
  onPassClue: (clueId: string) => void;
}

export const ClueModal: React.FC<ClueModalProps> = ({
  clue,
  categoryName,
  teams,
  round,
  answerer,
  serverOffsetMs,
  timerSeconds,
  soundEnabled,
  onStart,
  onExtend,
  onClose,
  onAwardScore,
  onPassClue,
}) => {
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [manualTeamId, setManualTeamId] = useState<string>('');

  // AI Hint state
  const [aiHint, setAiHint] = useState<string | null>(null);
  const [aiHostComment, setAiHostComment] = useState<string | null>(null);
  const [isLoadingHint, setIsLoadingHint] = useState(false);

  const status = round?.status ?? null;
  const secondsLeft = useRoundClock(round, serverOffsetMs);
  const lockedTeams = round?.lockedTeams ?? [];
  const eligibleTeams = teams.filter((t) => !lockedTeams.includes(t.id));

  // Whoever buzzed is judged; otherwise the host can pick a team (e.g. an answer given out loud)
  const judgedTeamId = answerer?.teamId ?? (eligibleTeams.some((t) => t.id === manualTeamId) ? manualTeamId : eligibleTeams[0]?.id ?? '');
  const judgedTeam = teams.find((t) => t.id === judgedTeamId) ?? null;

  // Daily Double jingle when the dialog opens
  useEffect(() => {
    if (clue.isDailyDouble && soundEnabled) playDailyDouble();
  }, [clue.isDailyDouble, soundEnabled]);

  // Think music plays in the background for as long as the buzzers are open
  useEffect(() => {
    if (status === 'open' && soundEnabled) startThinkMusic();
    else stopThinkMusic();
  }, [status, soundEnabled]);
  useEffect(() => stopThinkMusic, []);

  // Sound cues when the round changes state
  const previousStatus = useRef<RoomRound['status'] | null>(null);
  useEffect(() => {
    const previous = previousStatus.current;
    previousStatus.current = status;
    if (!soundEnabled || previous === status) return;
    if (status === 'answering') playBuzzerSound();
    if (status === 'ended' && round?.endReason === 'timeup') playWrongBuzzer();
  }, [status, round?.endReason, soundEnabled]);

  // Space opens the buzzers once the question has been read
  useEffect(() => {
    if (status !== 'reading') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status, onStart]);

  const handleCorrect = () => {
    if (!judgedTeamId) return;
    if (soundEnabled) playApplause();
    confetti({
      particleCount: 100,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#c3f400', '#7c3aed', '#bf2076', '#ffffff'],
    });
    onAwardScore(clue.id, judgedTeamId, true, clue.value);
  };

  const handleWrong = () => {
    if (!judgedTeamId) return;
    if (soundEnabled) playWrongBuzzer();
    setAnswerRevealed(false);
    onAwardScore(clue.id, judgedTeamId, false, clue.value);
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
    } catch {
      setAiHint(`Think carefully about the key ideas in ${categoryName}.`);
    } finally {
      setIsLoadingHint(false);
    }
  };

  const statusBanner = (() => {
    if (!round) return { text: 'Connecting to the game…', tone: 'text-[#ccc3d8] border-white/10', icon: <Hourglass className="w-4 h-4" /> };
    switch (round.status) {
      case 'reading':
        return { text: 'Read the question aloud. Buzzers are locked.', tone: 'text-[#ccc3d8] border-white/10', icon: <Lock className="w-4 h-4" /> };
      case 'open':
        return { text: 'Buzzers are OPEN. First team to buzz answers.', tone: 'text-[#c3f400] border-[#c3f400]', icon: <Timer className="w-4 h-4" /> };
      case 'answering':
        return { text: `${judgedTeam?.emoji ?? ''} ${judgedTeam?.name ?? 'A team'} buzzed first. Clock paused.`, tone: 'text-[#ffb0cd] border-[#ffb0cd]', icon: <Timer className="w-4 h-4" /> };
      default:
        return round.endReason === 'exhausted'
          ? { text: 'Every team has been locked out of this clue.', tone: 'text-[#ffb4ab] border-red-500', icon: <Lock className="w-4 h-4" /> }
          : { text: "Time's up! Buzzers are closed.", tone: 'text-[#ffb4ab] border-red-500', icon: <Lock className="w-4 h-4" /> };
    }
  })();

  const progress = round && round.durationMs > 0 ? Math.min(1, (secondsLeft * 1000) / round.durationMs) : 0;
  const isLow = status === 'open' && secondsLeft <= LOW_TIME_SECONDS;

  return (
    <div className="fixed inset-0 z-50 bg-[#0f0d15]/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        className={`w-full max-w-3xl bg-[#211e27] p-6 md:p-8 rounded-2xl shadow-[8px_8px_0_#000000] border-2 ${
          clue.isDailyDouble ? 'border-[#bf2076]' : 'border-[#c3f400]'
        } flex flex-col gap-5 relative my-auto`}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between gap-3 border-b-2 border-[#36333d] pb-4">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <span className="font-space font-bold text-lg md:text-xl uppercase text-[#c3f400] tracking-wider">
              {categoryName}
            </span>
            <span className="text-gray-500">•</span>
            <span className="font-space font-bold text-2xl md:text-3xl uppercase text-white">${clue.value}</span>
            {clue.isDailyDouble && (
              <span className="px-3 py-0.5 bg-[#bf2076] text-[#ffdde7] font-space text-xs font-bold uppercase rounded-md shadow-[2px_2px_0_#000000] animate-pulse">
                Daily Double!
              </span>
            )}
          </div>

          {/* Countdown Clock */}
          <div
            className={`flex items-center gap-2 bg-[#0f0d15] px-4 py-1.5 rounded-full shadow-[2px_2px_0_#000000] border shrink-0 ${
              isLow ? 'border-red-500 animate-pulse text-red-400' : status === 'open' ? 'border-[#c3f400] text-[#c3f400]' : 'border-[#ffb0cd] text-[#ffb0cd]'
            }`}
            aria-label="Time remaining"
          >
            <Timer className="w-5 h-5" />
            <span className="font-space font-bold text-xl tracking-widest font-mono">
              {formatClock(status === 'reading' ? timerSeconds : secondsLeft)}
            </span>
          </div>
        </div>

        {/* Time bar + status */}
        <div className="flex flex-col gap-2">
          <div className="h-2 rounded-full bg-[#0f0d15] overflow-hidden" aria-hidden="true">
            <div
              className={`h-full rounded-full transition-[width] duration-200 ${isLow ? 'bg-red-500' : 'bg-[#c3f400]'}`}
              style={{ width: `${(status === 'reading' ? 1 : progress) * 100}%` }}
            />
          </div>
          <div role="status" className={`flex items-center gap-2 px-3 py-2 rounded-xl border bg-[#1d1a23] font-space text-sm font-bold ${statusBanner.tone}`}>
            {statusBanner.icon}
            <span>{statusBanner.text}</span>
          </div>
        </div>

        {/* Clue Prompt */}
        <div className="bg-[#0f0d15] p-6 md:p-8 rounded-xl shadow-inner min-h-[140px] flex items-center justify-center text-center border border-white/5 relative overflow-hidden">
          <div className="absolute inset-0 bg-radial from-white/5 to-transparent pointer-events-none" />
          <p className="font-space text-lg md:text-2xl text-white font-bold leading-relaxed max-w-2xl">
            "{clue.question}"
          </p>
        </div>

        {/* Round controls */}
        {status === 'reading' && (
          <button
            type="button"
            onClick={onStart}
            className="flex items-center justify-center gap-2 w-full py-4 bg-[#c3f400] text-black hover:bg-[#abd600] font-space text-base md:text-lg font-bold uppercase rounded-xl shadow-[4px_4px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Open buzzers &amp; start {formatClock(timerSeconds)} timer</span>
            <span className="hidden md:inline text-xs opacity-60 normal-case">(Space)</span>
          </button>
        )}

        {(status === 'open' || status === 'answering' || status === 'ended') && round?.endReason !== 'exhausted' && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-space text-xs font-bold uppercase text-[#ccc3d8]">Add time:</span>
            {EXTEND_STEPS_SECONDS.map((seconds) => (
              <button
                key={seconds}
                type="button"
                onClick={() => onExtend(seconds)}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#2b2932] hover:bg-[#36333d] text-white font-space text-xs font-bold uppercase rounded-lg shadow-[2px_2px_0_#000000] transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> {seconds}s
              </button>
            ))}
            {status === 'ended' && (
              <span className="font-space text-xs text-[#ccc3d8]">Adding time reopens the buzzers.</span>
            )}
          </div>
        )}

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
            {aiHostComment && <p className="font-space text-xs italic text-[#ccc3d8]">"{aiHostComment}"</p>}
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
              <span className="font-space text-xs font-bold uppercase text-[#ede0ff]/80 tracking-widest">Correct Response:</span>
              <h4 className="font-space text-2xl md:text-3xl font-bold uppercase text-white mt-1">{clue.answer}</h4>
            </motion.div>
          ) : (
            <div className="bg-[#1d1a23] p-3.5 rounded-xl text-center border border-dashed border-[#7c3aed]/40 text-[#ccc3d8] flex items-center justify-center gap-2">
              <span className="font-space text-xs uppercase tracking-wider">Solution concealed for judging</span>
            </div>
          )}
        </AnimatePresence>

        {/* Who is being judged */}
        <div className="bg-[#2b2932] p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-[2px_2px_0_#000000]">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${answerer ? 'bg-[#c3f400] animate-ping' : 'bg-gray-600'}`} />
            <span className="font-space text-xs md:text-sm uppercase text-[#ccc3d8]">
              {answerer ? 'Answering:' : 'Judge team:'}
            </span>
            {answerer ? (
              <span className="text-[#c3f400] font-space font-bold uppercase text-sm md:text-base">
                {judgedTeam?.emoji} {judgedTeam?.name}
              </span>
            ) : (
              <select
                value={judgedTeamId}
                onChange={(e) => setManualTeamId(e.target.value)}
                aria-label="Team to judge"
                className="bg-[#14121a] text-[#c3f400] font-space font-bold uppercase text-sm md:text-base px-3 py-1 rounded-lg border border-[#c3f400]/40 focus:outline-none cursor-pointer"
              >
                {eligibleTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.emoji} {team.name}
                  </option>
                ))}
              </select>
            )}
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPassClue(clue.id)}
              className="px-5 py-2.5 bg-[#2b2932] hover:bg-[#36333d] font-space text-xs md:text-sm font-bold uppercase text-[#ccc3d8] hover:text-white rounded-xl shadow-[3px_3px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
            >
              No answer / close clue
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2.5 font-space text-xs font-bold uppercase text-gray-500 hover:text-white underline"
              title="Close without marking the tile (Esc)"
            >
              Back to board
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleWrong}
              disabled={!judgedTeamId}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-[#93000a] text-[#ffdad6] hover:bg-red-700 font-space text-xs md:text-sm font-bold uppercase rounded-xl shadow-[3px_3px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all disabled:opacity-40"
            >
              <X className="w-4 h-4" />
              <span>Wrong (-${clue.value})</span>
            </button>

            <button
              type="button"
              onClick={handleCorrect}
              disabled={!judgedTeamId}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-[#c3f400] text-black hover:bg-[#abd600] font-space text-xs md:text-sm font-bold uppercase rounded-xl shadow-[4px_4px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all disabled:opacity-40"
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
