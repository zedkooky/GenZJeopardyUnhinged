import React from 'react';
import { 
  Bell, 
  RotateCcw, 
  PlusCircle, 
  Flame, 
  LayoutGrid, 
  Sparkles,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Category, Clue, Team, BuzzerEvent } from '../types/game';

interface GameBoardProps {
  categories: Category[];
  teams: Team[];
  roomCode: string;
  buzzerQueue: BuzzerEvent[];
  onSelectClue: (clue: Clue, categoryName: string) => void;
  onResetBoard: () => void;
  onOpenDeckBuilder: () => void;
  onOpenBuzzerQueue: () => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  categories,
  teams,
  roomCode,
  buzzerQueue,
  onSelectClue,
  onResetBoard,
  onOpenDeckBuilder,
  onOpenBuzzerQueue,
}) => {
  // Count remaining available clues
  let totalClues = 0;
  let remainingClues = 0;

  categories.forEach((cat) => {
    cat.clues.forEach((c) => {
      totalClues++;
      if (c.state === 'AVAILABLE') remainingClues++;
    });
  });

  // Calculate highest streak team
  const topStreakTeam = [...teams].sort((a, b) => b.streak - a.streak)[0];

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Top HUD & Live Room Status Bar */}
      <motion.section 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full bg-[#1d1a23] rounded-2xl p-4 shadow-[4px_4px_0_#000000] border-2 border-black flex flex-wrap items-center justify-between gap-4 relative overflow-hidden"
      >
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-[#7c3aed]/15 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-[#0f0d15] px-3.5 py-1.5 rounded-xl shadow-[2px_2px_0_#000000] border border-white/5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#c3f400] animate-ping" />
            <span className="font-space text-xs font-bold uppercase text-[#c3f400] tracking-wider">
              ROOM LIVE • {roomCode}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[#ccc3d8] font-space text-xs font-bold uppercase bg-[#211e27] px-3 py-1.5 rounded-xl border border-white/5 shadow-[2px_2px_0_#000000]">
            <LayoutGrid className="w-4 h-4 text-[#d2bbff]" />
            <span>
              Clues Left: <strong className="text-[#c3f400]">{remainingClues} / {totalClues}</strong>
            </span>
          </div>

          {topStreakTeam && topStreakTeam.streak > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 bg-[#211e27] px-3 py-1.5 rounded-xl border border-white/5 shadow-[2px_2px_0_#000000]">
              <Flame className="w-4 h-4 text-[#ffb0cd]" />
              <span className="font-space text-xs font-bold uppercase text-white">
                Streak: <strong className="text-[#ffb0cd]">{topStreakTeam.name} (x{topStreakTeam.streak})</strong>
              </span>
            </div>
          )}
        </div>

        {/* Quick Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={onOpenBuzzerQueue}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-[#2b2932] hover:bg-[#36333d] text-white font-space text-xs font-bold uppercase rounded-xl shadow-[3px_3px_0_#000000] transition-all"
          >
            <Bell className="w-4 h-4 text-[#c3f400]" />
            <span>Buzzer Queue</span>
            <span className="w-5 h-5 rounded-full bg-[#c3f400] text-black text-[11px] font-bold flex items-center justify-center">
              {buzzerQueue.length}
            </span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={onOpenDeckBuilder}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#7c3aed] text-white hover:bg-[#9353ff] font-space text-xs font-bold uppercase rounded-xl shadow-[3px_3px_0_#000000] transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add / Edit Deck</span>
          </motion.button>

          <button
            type="button"
            onClick={onResetBoard}
            className="flex items-center gap-1 p-2 bg-[#211e27] text-gray-400 hover:text-red-400 hover:bg-red-950/40 rounded-xl shadow-[2px_2px_0_#000000] transition-all active:translate-x-0.5 active:translate-y-0.5"
            title="Reset Board State"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </motion.section>

      {/* Main 6-Column Jeopardy Board with Animated Tiles */}
      <main className="w-full grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 select-none">
        {categories.map((category, catIndex) => (
          <motion.div 
            key={category.id} 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: catIndex * 0.05 }}
            className="flex flex-col gap-2.5"
          >
            {/* Category Header Card */}
            <div className="h-28 bg-[#211e27] p-3 rounded-2xl shadow-[4px_4px_0_#000000] border-2 border-black flex flex-col justify-between text-center relative overflow-hidden group hover:border-[#c3f400]/40 transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-space text-[11px] font-bold text-[#d2bbff] uppercase">
                  {category.code}
                </span>
                <span className="material-symbols-outlined text-[#d2bbff] text-[18px]">
                  {category.icon || 'smart_display'}
                </span>
              </div>

              <div>
                <h2 className="font-space text-sm md:text-base font-bold uppercase text-white tracking-tight leading-snug line-clamp-2">
                  {category.name}
                </h2>
                <p className="font-space text-[10px] text-[#ccc3d8] truncate mt-0.5">
                  {category.subtitle}
                </p>
              </div>

              <div 
                className="h-1.5 w-full rounded-full" 
                style={{ backgroundColor: category.colorTheme || '#7c3aed' }}
              />
            </div>

            {/* 5 Clue Tiles */}
            {category.clues.map((clue, clueIdx) => {
              if (clue.state === 'CLAIMED') {
                const claimedTeam = teams.find((t) => t.id === clue.claimedByTeamId);
                return (
                  <motion.div
                    key={clue.id}
                    initial={{ scale: 0.95 }}
                    animate={{ scale: 1 }}
                    className="h-24 bg-[#0f0d15] rounded-xl p-2 flex flex-col items-center justify-center text-center opacity-40 shadow-none border border-black cursor-not-allowed"
                  >
                    <span className="font-space text-xl font-bold line-through text-gray-500">
                      ${clue.value}
                    </span>
                    <span className="font-space text-[10px] font-bold uppercase text-[#c3f400] mt-1 px-1.5 py-0.5 bg-[#211e27] rounded truncate max-w-full">
                      {claimedTeam ? `Claimed: ${claimedTeam.name}` : 'Claimed'}
                    </span>
                  </motion.div>
                );
              }

              if (clue.state === 'PASSED') {
                return (
                  <div
                    key={clue.id}
                    className="h-24 bg-[#0f0d15] rounded-xl p-2 flex flex-col items-center justify-center text-center opacity-30 shadow-none border border-black cursor-not-allowed"
                  >
                    <span className="font-space text-xl font-bold line-through text-gray-600">
                      ${clue.value}
                    </span>
                    <span className="font-space text-[10px] uppercase text-gray-400 mt-1">
                      Passed (Deadlock)
                    </span>
                  </div>
                );
              }

              // AVAILABLE Animated Tile
              return (
                <motion.button
                  key={clue.id}
                  type="button"
                  whileHover={{ 
                    scale: 1.04, 
                    y: -2,
                    boxShadow: clue.isDailyDouble ? "6px 6px 0 #bf2076" : "6px 6px 0 #c3f400" 
                  }}
                  whileTap={{ scale: 0.97, y: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  onClick={() => onSelectClue(clue, category.name)}
                  className={`h-24 bg-[#211e27] hover:bg-[#2b2932] rounded-xl p-2 flex flex-col items-center justify-center text-center shadow-[4px_4px_0_#000000] border-2 border-black group relative overflow-hidden cursor-pointer ${
                    clue.isDailyDouble ? 'border-[#bf2076]' : ''
                  }`}
                >
                  {/* Subtle 3D gradient sheen */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

                  {/* Daily Double Ribbon Banner */}
                  {clue.isDailyDouble && (
                    <div className="absolute -top-3 -right-6 bg-[#bf2076] text-white rotate-12 px-5 py-0.5 text-[8px] font-space uppercase tracking-widest shadow-sm font-bold">
                      Double!
                    </div>
                  )}

                  <span className={`font-space font-bold text-2xl md:text-3xl tracking-tight transition-transform ${
                    clue.isDailyDouble ? 'text-[#ffb0cd]' : 'text-[#c3f400]'
                  }`}>
                    ${clue.value}
                  </span>

                  <span className="font-space text-[10px] uppercase text-[#ccc3d8] opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                    {clue.isDailyDouble ? 'Daily Double' : 'Select Clue'}
                  </span>
                </motion.button>
              );
            })}
          </motion.div>
        ))}
      </main>
    </div>
  );
};
