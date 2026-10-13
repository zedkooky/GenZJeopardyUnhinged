import React, { useState } from 'react';
import { Music, Volume2, Wifi, Zap } from 'lucide-react';
import { Team, Category } from '../types/game';
import { 
  playThinkMusic, 
  playWrongBuzzer, 
  playAirHorn, 
  playApplause, 
  playDailyDouble 
} from '../utils/audio';

interface SoundboardFooterProps {
  teams: Team[];
  categories: Category[];
  soundEnabled: boolean;
}

export const SoundboardFooter: React.FC<SoundboardFooterProps> = ({
  teams,
  categories,
  soundEnabled,
}) => {
  const [fxToast, setFxToast] = useState<string | null>(null);

  const triggerSfx = (name: string, fn: () => void) => {
    if (!soundEnabled) {
      setFxToast('Audio is currently muted');
    } else {
      fn();
      setFxToast(`Playing: ${name}`);
    }
    setTimeout(() => {
      setFxToast(null);
    }, 1600);
  };

  // Compute untouched board progress
  let total = 0;
  let remaining = 0;
  categories.forEach((cat) => {
    cat.clues.forEach((c) => {
      total++;
      if (c.state === 'AVAILABLE') remaining++;
    });
  });

  const percentUntouched = total > 0 ? Math.round((remaining / total) * 100) : 100;
  const percentClaimed = 100 - percentUntouched;

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Sound FX Pad & Progress Bar */}
      <section className="w-full bg-[#1d1a23] rounded-2xl p-4 shadow-[4px_4px_0_#000000] border-2 border-black flex flex-wrap items-center justify-between gap-4">
        {/* Soundboard triggers */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-space text-xs font-bold uppercase text-[#ccc3d8] flex items-center gap-1.5 mr-1">
            <Volume2 className="w-4 h-4 text-[#c3f400]" />
            FX Pad:
          </span>

          <button
            type="button"
            onClick={() => triggerSfx('Jeopardy Theme', playThinkMusic)}
            className="px-3 py-1.5 bg-[#211e27] hover:bg-[#2b2932] rounded-xl text-white font-space text-xs font-bold uppercase shadow-[2px_2px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            🎵 Think Music
          </button>

          <button
            type="button"
            onClick={() => triggerSfx('Wrong Buzzer', playWrongBuzzer)}
            className="px-3 py-1.5 bg-[#211e27] hover:bg-[#2b2932] rounded-xl text-[#ffb4ab] font-space text-xs font-bold uppercase shadow-[2px_2px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            ❌ Wrong Buzz
          </button>

          <button
            type="button"
            onClick={() => triggerSfx('Air Horn', playAirHorn)}
            className="px-3 py-1.5 bg-[#211e27] hover:bg-[#2b2932] rounded-xl text-[#c3f400] font-space text-xs font-bold uppercase shadow-[2px_2px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            📢 Air Horn
          </button>

          <button
            type="button"
            onClick={() => triggerSfx('Huge W Applause', playApplause)}
            className="px-3 py-1.5 bg-[#211e27] hover:bg-[#2b2932] rounded-xl text-[#d2bbff] font-space text-xs font-bold uppercase shadow-[2px_2px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            👏 Huge W Applause
          </button>

          <button
            type="button"
            onClick={() => triggerSfx('Daily Double', playDailyDouble)}
            className="px-3 py-1.5 bg-[#211e27] hover:bg-[#2b2932] rounded-xl text-[#ffb0cd] font-space text-xs font-bold uppercase shadow-[2px_2px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            ⭐ Daily Double
          </button>
        </div>

        {/* Board Progress Tracker */}
        <div className="flex items-center gap-3 flex-1 max-w-sm min-w-[220px]">
          <div className="w-full flex flex-col gap-1">
            <div className="flex items-center justify-between font-space text-xs font-bold uppercase text-[#ccc3d8]">
              <span>Round 1 Progress</span>
              <span className="text-[#c3f400]">{percentUntouched}% Board Untouched</span>
            </div>
            <div className="w-full h-2.5 bg-[#0f0d15] rounded-full overflow-hidden shadow-inner border border-white/5">
              <div 
                className="h-full bg-[#c3f400] rounded-full transition-all duration-500" 
                style={{ width: `${percentClaimed}%` }}
              />
            </div>
          </div>
        </div>

        {/* Live Notification Toast Spot */}
        {fxToast && (
          <div className="font-space text-xs font-bold uppercase px-3.5 py-1 bg-[#c3f400] text-black rounded-lg shadow-[2px_2px_0_#000000] animate-in fade-in duration-150">
            {fxToast}
          </div>
        )}
      </section>

      {/* Live Buzz Ticker Footer */}
      <footer className="w-full bg-[#0f0d15] border-t-2 border-black shadow-[0_-4px_0_#000000] py-2 px-4 rounded-xl">
        <div className="w-full flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-[#c3f400] animate-pulse" />
            <span className="font-space text-xs font-bold uppercase text-[#c3f400] tracking-wider">
              Live Buzz Ticker:
            </span>
          </div>

          <div className="flex-1 flex flex-wrap items-center justify-around gap-2">
            {teams.map((team) => (
              <div
                key={team.id}
                className="flex items-center gap-2 bg-[#211e27] px-3 py-1 rounded-xl shadow-[2px_2px_0_#000000] border border-white/5"
              >
                <span className="text-sm">{team.emoji}</span>
                <span className="font-space text-xs font-bold text-white uppercase truncate max-w-[120px]">
                  {team.name}
                </span>
                <span className={`font-space text-xs font-bold ${
                  team.score < 0 ? 'text-[#ffb4ab]' : 'text-[#c3f400]'
                }`}>
                  {team.score < 0 ? `-$${Math.abs(team.score).toLocaleString()}` : `$${team.score.toLocaleString()}`}
                </span>
              </div>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-1 text-[#ccc3d8] font-space text-xs font-bold uppercase">
            <Wifi className="w-3.5 h-3.5 text-green-400" />
            <span>Sync: 12ms</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
