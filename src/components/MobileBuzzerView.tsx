import React, { useState, useEffect } from 'react';
import { Smartphone, Zap, CheckCircle2, AlertTriangle, ArrowLeft, Users } from 'lucide-react';
import { Team, Clue, BuzzerEvent } from '../types/game';
import { playBuzzerSound } from '../utils/audio';

interface MobileBuzzerViewProps {
  roomCode: string;
  teams: Team[];
  activeClue: Clue | null;
  activeBuzz: BuzzerEvent | null;
  soundEnabled: boolean;
  onBuzz: (teamId: string, timeTakenMs: number) => void;
  onBackToBoard: () => void;
}

export const MobileBuzzerView: React.FC<MobileBuzzerViewProps> = ({
  roomCode,
  teams,
  activeClue,
  activeBuzz,
  soundEnabled,
  onBuzz,
  onBackToBoard,
}) => {
  const [selectedTeamId, setSelectedTeamId] = useState<string>(teams[0]?.id || '');
  const [hasBuzzed, setHasBuzzed] = useState<boolean>(false);
  const [clueStartTime, setClueStartTime] = useState<number>(Date.now());
  const [reactionTime, setReactionTime] = useState<number | null>(null);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) || teams[0];

  // Reset buzz state when new clue is opened
  useEffect(() => {
    if (activeClue) {
      setHasBuzzed(false);
      setReactionTime(null);
      setClueStartTime(Date.now());
    } else {
      setHasBuzzed(false);
    }
  }, [activeClue]);

  const handleBuzzClick = () => {
    if (hasBuzzed) return;

    const timeTaken = Date.now() - clueStartTime;
    setReactionTime(timeTaken);
    setHasBuzzed(true);

    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }

    if (soundEnabled) {
      playBuzzerSound();
    }

    onBuzz(selectedTeamId, timeTaken);
  };

  const isFirstBuzzer = activeBuzz?.teamId === selectedTeamId;
  const isLockedOut = activeBuzz !== null && !isFirstBuzzer;

  return (
    <div className="w-full max-w-md mx-auto min-h-[85vh] flex flex-col justify-between py-4 px-3 select-none">
      {/* Top Mobile Bar */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between bg-[#1d1a23] p-3 rounded-2xl border-2 border-black shadow-[3px_3px_0_#000000]">
          <button
            type="button"
            onClick={onBackToBoard}
            className="flex items-center gap-1 text-[#ccc3d8] hover:text-white font-space text-xs uppercase"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Host Board</span>
          </button>

          <div className="flex items-center gap-1.5 bg-[#0f0d15] px-3 py-1 rounded-xl border border-white/5">
            <span className="w-2 h-2 rounded-full bg-[#c3f400] animate-ping" />
            <span className="font-space text-xs font-bold text-[#c3f400] uppercase">
              Room: {roomCode}
            </span>
          </div>
        </div>

        {/* Team Selector Strip */}
        <div className="bg-[#1d1a23] p-3 rounded-2xl border-2 border-black shadow-[3px_3px_0_#000000] flex flex-col gap-2">
          <label className="font-space text-xs font-bold uppercase text-[#ccc3d8] flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#c3f400]" />
            <span>Select Your Team:</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {teams.map((team) => (
              <button
                key={team.id}
                type="button"
                onClick={() => setSelectedTeamId(team.id)}
                className={`p-2.5 rounded-xl font-space text-xs font-bold uppercase flex items-center gap-2 border-2 transition-all ${
                  selectedTeamId === team.id
                    ? 'bg-[#211e27] border-[#c3f400] text-[#c3f400] shadow-[2px_2px_0_#000000]'
                    : 'bg-[#0f0d15] border-black text-[#ccc3d8] hover:text-white'
                }`}
              >
                <span className="text-base">{team.emoji}</span>
                <span className="truncate">{team.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Active Clue Peek Banner */}
        <div className="bg-[#211e27] p-3.5 rounded-2xl border-2 border-black shadow-[3px_3px_0_#000000] text-center">
          {activeClue ? (
            <div className="flex flex-col gap-1">
              <span className="font-space text-xs font-bold uppercase text-[#c3f400]">
                ACTIVE CLUE: {activeClue.category} (${activeClue.value})
              </span>
              <p className="font-space text-sm font-bold text-white line-clamp-2">
                "{activeClue.question}"
              </p>
            </div>
          ) : (
            <p className="font-space text-xs font-bold uppercase text-[#ccc3d8]">
              Host has not opened a clue yet. Get ready!
            </p>
          )}
        </div>
      </div>

      {/* GIANT CENTER BUZZER BUTTON */}
      <div className="my-auto py-6 flex flex-col items-center justify-center gap-4">
        <button
          type="button"
          onClick={handleBuzzClick}
          className={`w-64 h-64 md:w-72 md:h-72 rounded-full border-8 shadow-[0_10px_0_#000000] active:translate-y-2 active:shadow-[0_2px_0_#000000] flex flex-col items-center justify-center transition-all ${
            isFirstBuzzer
              ? 'bg-[#c3f400] border-white text-black animate-bounce ring-8 ring-[#c3f400]/40'
              : isLockedOut
                ? 'bg-[#2b2932] border-gray-700 text-gray-500 opacity-60 cursor-not-allowed'
                : activeClue
                  ? 'bg-[#7c3aed] hover:bg-[#9353ff] border-[#c3f400] text-white animate-pulse shadow-[0_0_50px_rgba(124,58,237,0.5)]'
                  : 'bg-[#93000a] hover:bg-red-700 border-black text-white'
          }`}
        >
          <Zap className="w-16 h-16 md:w-20 md:h-20 mb-2 fill-current" />
          <span className="font-space text-2xl md:text-3xl font-bold uppercase tracking-wider">
            {isFirstBuzzer
              ? 'YOU BUZZED!'
              : isLockedOut
                ? 'LOCKED OUT'
                : 'BUZZ IN!'}
          </span>
          <span className="font-space text-xs uppercase opacity-80 mt-1">
            {selectedTeam?.emoji} {selectedTeam?.name}
          </span>
        </button>

        {/* Status Callout */}
        <div className="text-center">
          {isFirstBuzzer && (
            <div className="flex items-center gap-1.5 text-[#c3f400] font-space text-sm font-bold uppercase bg-[#1d1a23] px-4 py-1.5 rounded-full border border-[#c3f400] shadow-[2px_2px_0_#000000] animate-in zoom-in-95">
              <CheckCircle2 className="w-4 h-4" />
              <span>You buzzed 1st! Speak your answer!</span>
            </div>
          )}

          {isLockedOut && (
            <div className="flex items-center gap-1.5 text-[#ffb4ab] font-space text-xs font-bold uppercase bg-[#1d1a23] px-4 py-1.5 rounded-full border border-red-500">
              <AlertTriangle className="w-4 h-4" />
              <span>{activeBuzz?.teamName} buzzed in first</span>
            </div>
          )}

          {!activeBuzz && activeClue && (
            <span className="font-space text-xs text-[#c3f400] uppercase font-bold tracking-wider animate-pulse">
              ⚡ SMASH THE BUZZER!
            </span>
          )}

          {reactionTime !== null && (
            <p className="font-space text-[11px] text-[#ccc3d8] mt-1 font-mono">
              Reaction Time: {(reactionTime / 1000).toFixed(2)}s
            </p>
          )}
        </div>
      </div>

      {/* Bottom Phone Info */}
      <div className="text-center font-space text-[11px] text-[#ccc3d8] uppercase">
        <span>Team: <strong className="text-[#c3f400]">{selectedTeam?.name}</strong></span>
        <span className="mx-2">•</span>
        <span>Score: <strong className="text-white">${selectedTeam?.score}</strong></span>
      </div>
    </div>
  );
};
