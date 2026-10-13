import React, { useState, useEffect } from 'react';
import { Zap, CheckCircle2, AlertTriangle, ArrowLeft, Users, Hourglass } from 'lucide-react';
import { Team, Clue, BuzzerEvent } from '../types/game';
import type { JoinOutcome, RoomSnapshot } from '../utils/realtime';
import { playBuzzerSound } from '../utils/audio';

const MAX_TEAM_NAME_LENGTH = 24;

type RoomInfo = Pick<RoomSnapshot, 'playerCounts' | 'myTeamId' | 'maxPerTeam' | 'storage'>;

interface MobileBuzzerViewProps {
  roomCode: string;
  teams: Team[];
  roomInfo: RoomInfo | null;
  activeClue: Clue | null;
  activeBuzz: BuzzerEvent | null;
  soundEnabled: boolean;
  onBuzz: (teamId: string, timeTakenMs: number) => void;
  onJoinTeam: (teamId: string, teamName: string) => Promise<JoinOutcome>;
  onBackToBoard?: () => void;
}

const JOIN_ERRORS: Record<Exclude<JoinOutcome, 'joined'>, string> = {
  full: 'That team just filled up. Pick another team.',
  failed: "Couldn't reach the game. Check your connection and that the host has the board open.",
};

export const MobileBuzzerView: React.FC<MobileBuzzerViewProps> = ({
  roomCode,
  teams,
  roomInfo,
  activeClue,
  activeBuzz,
  soundEnabled,
  onBuzz,
  onJoinTeam,
  onBackToBoard,
}) => {
  const [pendingTeamId, setPendingTeamId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [isChangingTeam, setIsChangingTeam] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [hasBuzzed, setHasBuzzed] = useState(false);
  const [clueStartTime, setClueStartTime] = useState<number>(Date.now());
  const [reactionTime, setReactionTime] = useState<number | null>(null);

  const myTeam = teams.find((t) => t.id === roomInfo?.myTeamId) ?? null;
  const maxPerTeam = roomInfo?.maxPerTeam ?? 2;
  const showJoin = !myTeam || isChangingTeam;

  // Reset buzz state whenever a new clue opens or closes
  useEffect(() => {
    setHasBuzzed(false);
    setReactionTime(null);
    setClueStartTime(Date.now());
  }, [activeClue?.id]);

  const pickTeam = (team: Team) => {
    setPendingTeamId(team.id);
    setNameInput(team.name);
    setJoinError(null);
  };

  const confirmJoin = async () => {
    if (!pendingTeamId || isJoining) return;
    setIsJoining(true);
    setJoinError(null);
    const outcome = await onJoinTeam(pendingTeamId, nameInput);
    setIsJoining(false);
    if (outcome === 'joined') {
      setIsChangingTeam(false);
      setPendingTeamId(null);
    } else {
      setJoinError(JOIN_ERRORS[outcome]);
    }
  };

  // ---------- Join screen ----------
  if (showJoin) {
    const pendingTeam = teams.find((t) => t.id === pendingTeamId) ?? null;
    return (
      <div className="w-full max-w-md mx-auto flex flex-col gap-4 py-2 select-none">
        <div className="flex items-center justify-between">
          {isChangingTeam && myTeam ? (
            <button
              type="button"
              onClick={() => { setIsChangingTeam(false); setPendingTeamId(null); setJoinError(null); }}
              className="flex items-center gap-1 text-[#ccc3d8] font-space text-sm uppercase"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          ) : onBackToBoard ? (
            <button
              type="button"
              onClick={onBackToBoard}
              className="flex items-center gap-1 text-[#ccc3d8] font-space text-sm uppercase"
            >
              <ArrowLeft className="w-4 h-4" /> Host board
            </button>
          ) : <span />}
          <span className="font-space text-xs font-bold text-[#c3f400] uppercase bg-[#0f0d15] px-3 py-1 rounded-xl border border-white/10">
            Room {roomCode}
          </span>
        </div>

        <div>
          <h1 className="font-space text-2xl font-bold text-white uppercase">Join a team</h1>
          <p className="font-space text-sm text-[#ccc3d8] mt-1">
            Tap a team. Each team has {maxPerTeam} players.
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          {teams.map((team) => {
            const count = roomInfo?.playerCounts?.[team.id] ?? 0;
            const isMine = team.id === myTeam?.id;
            const isFull = count >= maxPerTeam && !isMine;
            const isPending = team.id === pendingTeamId;
            return (
              <button
                key={team.id}
                type="button"
                disabled={isFull}
                onClick={() => pickTeam(team)}
                className={`w-full min-h-16 px-4 py-3 rounded-2xl border-2 flex items-center gap-3 text-left transition-all ${
                  isPending
                    ? 'bg-[#211e27] border-[#c3f400] shadow-[3px_3px_0_#000000]'
                    : isFull
                      ? 'bg-[#0f0d15] border-black opacity-50'
                      : 'bg-[#1d1a23] border-black shadow-[3px_3px_0_#000000]'
                }`}
              >
                <span className="text-3xl">{team.emoji}</span>
                <span className="flex-1 min-w-0">
                  <span className={`block font-space text-lg font-bold uppercase truncate ${isPending ? 'text-[#c3f400]' : 'text-white'}`}>
                    {team.name}
                  </span>
                  <span className="block font-space text-xs text-[#ccc3d8] uppercase">
                    {isFull ? 'Full' : `${count} of ${maxPerTeam} players${isMine ? ' (you)' : ''}`}
                  </span>
                </span>
                <span className="flex gap-1" aria-hidden="true">
                  {Array.from({ length: maxPerTeam }, (_, i) => (
                    <span key={i} className={`w-3 h-3 rounded-full ${i < count ? 'bg-[#c3f400]' : 'bg-white/15'}`} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        {pendingTeam && (
          <div className="bg-[#1d1a23] p-4 rounded-2xl border-2 border-black shadow-[3px_3px_0_#000000] flex flex-col gap-3">
            <label className="font-space text-sm font-bold uppercase text-[#ccc3d8]" htmlFor="team-name">
              Team name <span className="opacity-60 normal-case">(optional, you and your partner can both see it)</span>
            </label>
            <input
              id="team-name"
              value={nameInput}
              maxLength={MAX_TEAM_NAME_LENGTH}
              onChange={(e) => setNameInput(e.target.value)}
              className="w-full h-12 px-4 rounded-xl bg-[#0f0d15] border-2 border-white/10 focus:border-[#c3f400] outline-none text-white font-space text-lg"
            />
            {joinError && (
              <p role="alert" className="font-space text-sm text-[#ffb4ab]">{joinError}</p>
            )}
            <button
              type="button"
              onClick={confirmJoin}
              disabled={isJoining}
              className="w-full h-14 rounded-2xl bg-[#c3f400] text-black font-space text-lg font-bold uppercase border-2 border-black shadow-[3px_3px_0_#000000] active:translate-y-0.5 disabled:opacity-60"
            >
              {isJoining ? 'Joining…' : `Join ${nameInput.trim() || pendingTeam.name}`}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ---------- Play screen ----------
  const hasClue = activeClue !== null;
  const teamBuzzedFirst = activeBuzz?.teamId === myTeam.id;
  const otherTeamBuzzedFirst = activeBuzz !== null && !teamBuzzedFirst;
  const canBuzz = hasClue && activeBuzz === null && !hasBuzzed;

  const handleBuzzClick = () => {
    if (!canBuzz) return;
    const timeTaken = Date.now() - clueStartTime;
    setReactionTime(timeTaken);
    setHasBuzzed(true);
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    if (soundEnabled) playBuzzerSound();
    onBuzz(myTeam.id, timeTaken);
  };

  const status = !hasClue
    ? { icon: <Hourglass className="w-6 h-6" />, text: 'Waiting for the host to pick a clue', tone: 'text-[#ccc3d8] border-white/10' }
    : teamBuzzedFirst
      ? { icon: <CheckCircle2 className="w-6 h-6" />, text: 'Your team buzzed first! Give your answer.', tone: 'text-[#c3f400] border-[#c3f400]' }
      : otherTeamBuzzedFirst
        ? { icon: <AlertTriangle className="w-6 h-6" />, text: `${activeBuzz?.teamName} buzzed first`, tone: 'text-[#ffb4ab] border-red-500' }
        : { icon: <Zap className="w-6 h-6" />, text: 'Buzz in if you know it!', tone: 'text-[#c3f400] border-[#c3f400]' };

  const buttonLabel = !hasClue ? 'WAIT' : teamBuzzedFirst ? 'BUZZED!' : otherTeamBuzzedFirst ? 'LOCKED' : 'BUZZ!';
  const buttonTone = !hasClue
    ? 'bg-[#2b2932] border-gray-700 text-gray-500'
    : teamBuzzedFirst
      ? 'bg-[#c3f400] border-white text-black ring-8 ring-[#c3f400]/40'
      : otherTeamBuzzedFirst
        ? 'bg-[#2b2932] border-gray-700 text-gray-500'
        : 'bg-[#7c3aed] border-[#c3f400] text-white animate-pulse shadow-[0_0_50px_rgba(124,58,237,0.5)]';

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-4 py-2 select-none">
      {/* Team strip */}
      <div className="flex items-center justify-between bg-[#1d1a23] px-4 py-3 rounded-2xl border-2 border-black shadow-[3px_3px_0_#000000]">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-3xl">{myTeam.emoji}</span>
          <div className="min-w-0">
            <p className="font-space text-lg font-bold text-white uppercase truncate">{myTeam.name}</p>
            {!hasClue && (
              <button
                type="button"
                onClick={() => { setIsChangingTeam(true); setPendingTeamId(myTeam.id); setNameInput(myTeam.name); }}
                className="flex items-center gap-1 font-space text-xs text-[#ccc3d8] underline uppercase"
              >
                <Users className="w-3 h-3" /> Change team or name
              </button>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="font-space text-[10px] text-[#ccc3d8] uppercase">Score</p>
          <p className="font-space text-2xl font-bold text-white">${myTeam.score}</p>
        </div>
      </div>

      {/* Clue */}
      <div className="bg-[#211e27] p-4 rounded-2xl border-2 border-black shadow-[3px_3px_0_#000000] min-h-28 flex flex-col justify-center">
        {activeClue ? (
          <>
            <p className="font-space text-xs font-bold uppercase text-[#c3f400] mb-1">
              {activeClue.category} · ${activeClue.value}
            </p>
            <p className="font-space text-lg font-bold text-white leading-snug">{activeClue.question}</p>
          </>
        ) : (
          <p className="font-space text-base text-[#ccc3d8] text-center">Get ready. The next clue will appear here.</p>
        )}
      </div>

      {/* Status */}
      <div role="status" className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 bg-[#1d1a23] font-space text-base font-bold text-center ${status.tone}`}>
        {status.icon}
        <span>{status.text}</span>
      </div>

      {/* Buzzer */}
      <div className="flex flex-col items-center gap-3 py-2">
        <button
          type="button"
          onClick={handleBuzzClick}
          disabled={!canBuzz && !teamBuzzedFirst}
          aria-label={buttonLabel}
          className={`w-60 h-60 rounded-full border-8 shadow-[0_10px_0_#000000] flex flex-col items-center justify-center transition-all ${buttonTone} ${
            canBuzz ? 'active:translate-y-2 active:shadow-[0_2px_0_#000000]' : 'cursor-not-allowed'
          }`}
        >
          <Zap className="w-16 h-16 mb-2 fill-current" />
          <span className="font-space text-3xl font-bold uppercase tracking-wider">{buttonLabel}</span>
        </button>
        {reactionTime !== null && (
          <p className="font-space text-sm text-[#ccc3d8]">Reaction time: {(reactionTime / 1000).toFixed(2)}s</p>
        )}
      </div>
    </div>
  );
};
