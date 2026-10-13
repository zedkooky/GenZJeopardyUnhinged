import React from 'react';
import { Trophy, Plus, Minus, Bell, UserPlus } from 'lucide-react';
import { Team } from '../types/game';

interface PodiumScoreboardProps {
  teams: Team[];
  activeBuzzedTeamId: string | null;
  onAdjustScore: (teamId: string, delta: number) => void;
  onTriggerBuzzer: (teamId: string) => void;
  onAddTeam: () => void;
}

export const PodiumScoreboard: React.FC<PodiumScoreboardProps> = ({
  teams,
  activeBuzzedTeamId,
  onAdjustScore,
  onTriggerBuzzer,
  onAddTeam,
}) => {
  // Find highest score to mark the leader
  const maxScore = Math.max(...teams.map((t) => t.score));

  return (
    <section className="w-full bg-[#1d1a23] rounded-2xl p-4 md:p-6 shadow-[4px_4px_0_#000000] border-2 border-black flex flex-col gap-4">
      {/* Podium Header */}
      <div className="flex flex-wrap items-center justify-between border-b-2 border-[#2b2932] pb-3 gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-[#c3f400]" />
          <h3 className="font-space text-sm md:text-base font-bold uppercase tracking-wider text-white">
            Podium & Quick Buzzer Controls
          </h3>
          <span className="text-xs text-gray-500 hidden sm:inline">(Keys 1 - 4 buzz teams)</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="font-space text-xs font-bold uppercase text-[#ccc3d8]">
            Live Buzzer Lock:{' '}
            <span className="text-[#c3f400]">
              {activeBuzzedTeamId
                ? `${teams.find((t) => t.id === activeBuzzedTeamId)?.name.toUpperCase()} BUZZED IN!`
                : 'Open For Buzz'}
            </span>
          </div>

          <button
            type="button"
            onClick={onAddTeam}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#2b2932] hover:bg-[#36333d] text-[#c3f400] text-xs font-space font-bold uppercase rounded-lg shadow-[2px_2px_0_#000000] transition-all"
            title="Add Another Team"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">+ Team</span>
          </button>
        </div>
      </div>

      {/* Team Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {teams.map((team, idx) => {
          const isLeader = team.score === maxScore && maxScore > 0;
          const isBuzzed = activeBuzzedTeamId === team.id;

          return (
            <div
              key={team.id}
              className={`bg-[#211e27] p-4 rounded-xl shadow-[4px_4px_0_#000000] border-2 ${
                isBuzzed 
                  ? 'border-[#c3f400] ring-2 ring-[#c3f400] animate-pulse'
                  : isLeader
                    ? 'border-[#c3f400]'
                    : 'border-black'
              } flex flex-col justify-between gap-3 relative transition-all`}
            >
              {/* Leader Badge */}
              {isLeader && (
                <div className="absolute -top-3 right-3 bg-[#c3f400] text-black font-space text-[10px] font-bold px-2 py-0.5 rounded-full shadow-[2px_2px_0_#000000] flex items-center gap-1">
                  <span>👑</span>
                  <span>LEADER</span>
                </div>
              )}

              {/* Team Identity */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xl shadow-[2px_2px_0_#000000]">
                  {team.emoji}
                </div>
                <div className="min-w-0">
                  <h4 className="font-space text-sm md:text-base font-bold uppercase text-white truncate">
                    {team.name}
                  </h4>
                  <p className="font-space text-[11px] font-bold text-[#c3f400] uppercase">
                    {team.streak > 0 ? `${team.streak} Streak` : `Team #${idx + 1}`}
                  </p>
                </div>
              </div>

              {/* Big Score Display */}
              <div className="my-1">
                <span
                  className={`font-space font-bold text-3xl md:text-4xl tracking-tight drop-shadow-[2px_2px_0_#000000] ${
                    team.score < 0
                      ? 'text-[#ffb4ab]'
                      : isLeader
                        ? 'text-[#c3f400]'
                        : team.score > 1000
                          ? 'text-[#ffb0cd]'
                          : 'text-[#d2bbff]'
                  }`}
                >
                  {team.score < 0 ? `-$${Math.abs(team.score).toLocaleString()}` : `+$${team.score.toLocaleString()}`}
                </span>
              </div>

              {/* Quick Actions (Adjust and Buzz) */}
              <div className="flex items-center gap-2 pt-2 border-t border-[#36333d]">
                <button
                  type="button"
                  onClick={() => onAdjustScore(team.id, 200)}
                  className="flex-1 py-1.5 bg-[#2b2932] hover:bg-[#36333d] font-space text-xs font-bold text-[#c3f400] rounded-lg text-center shadow-[2px_2px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center justify-center gap-0.5"
                  title="Add $200"
                >
                  <Plus className="w-3 h-3" />
                  <span>200</span>
                </button>

                <button
                  type="button"
                  onClick={() => onAdjustScore(team.id, -200)}
                  className="flex-1 py-1.5 bg-[#2b2932] hover:bg-[#36333d] font-space text-xs font-bold text-[#ffb4ab] rounded-lg text-center shadow-[2px_2px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center justify-center gap-0.5"
                  title="Deduct $200"
                >
                  <Minus className="w-3 h-3" />
                  <span>200</span>
                </button>

                <button
                  type="button"
                  onClick={() => onTriggerBuzzer(team.id)}
                  className={`px-3 py-1.5 font-space text-xs font-bold uppercase rounded-lg shadow-[2px_2px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center gap-1 ${
                    isBuzzed
                      ? 'bg-[#c3f400] text-black animate-bounce'
                      : 'bg-[#7c3aed] text-white hover:bg-[#9353ff]'
                  }`}
                >
                  <Bell className="w-3 h-3" />
                  <span>BUZZ [{idx + 1}]</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
