import React from 'react';
import { Bell, X, RotateCcw, Check, Clock } from 'lucide-react';
import { BuzzerEvent, Team } from '../types/game';

interface BuzzerQueueModalProps {
  queue: BuzzerEvent[];
  teams: Team[];
  onClearQueue: () => void;
  onSelectTeamToAnswer: (teamId: string) => void;
  onClose: () => void;
}

export const BuzzerQueueModal: React.FC<BuzzerQueueModalProps> = ({
  queue,
  teams,
  onClearQueue,
  onSelectTeamToAnswer,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-[#0f0d15]/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#211e27] p-6 rounded-2xl shadow-[8px_8px_0_#000000] border-2 border-[#c3f400] flex flex-col gap-4 relative animate-in fade-in zoom-in-95 duration-150">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 border-b border-[#36333d] pb-3">
          <Bell className="w-5 h-5 text-[#c3f400]" />
          <div>
            <h3 className="font-space text-lg font-bold uppercase text-white">
              Live Buzzer Queue
            </h3>
            <p className="font-space text-xs text-[#ccc3d8]">
              Millisecond-accurate order of buzzing teams
            </p>
          </div>
        </div>

        {/* Queue Items List */}
        <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
          {queue.map((event, idx) => {
            const team = teams.find((t) => t.id === event.teamId);
            const isFirst = idx === 0;

            return (
              <div
                key={`${event.teamId}-${idx}`}
                className={`p-3 rounded-xl border flex items-center justify-between gap-2 shadow-[2px_2px_0_#000000] ${
                  isFirst
                    ? 'bg-[#2b2932] border-[#c3f400] ring-1 ring-[#c3f400]'
                    : 'bg-[#14121a] border-white/5 opacity-80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full font-space text-xs font-bold flex items-center justify-center ${
                      isFirst
                        ? 'bg-[#c3f400] text-black'
                        : 'bg-[#36333d] text-white'
                    }`}
                  >
                    #{idx + 1}
                  </span>
                  <div>
                    <h4 className="font-space text-sm font-bold uppercase text-white flex items-center gap-1.5">
                      <span>{team?.emoji || '🔔'}</span>
                      <span>{event.teamName}</span>
                      {isFirst && (
                        <span className="text-[10px] bg-[#c3f400] text-black px-1.5 rounded font-bold">
                          FIRST
                        </span>
                      )}
                    </h4>
                    {event.timeTakenMs && (
                      <span className="font-space text-[10px] text-[#ccc3d8] font-mono flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-gray-500" />
                        <span>{(event.timeTakenMs / 1000).toFixed(2)}s reaction</span>
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onSelectTeamToAnswer(event.teamId);
                    onClose();
                  }}
                  className="px-3 py-1 bg-[#7c3aed] hover:bg-[#9353ff] text-white font-space text-xs font-bold uppercase rounded-lg shadow-[2px_2px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
                >
                  Judge
                </button>
              </div>
            );
          })}

          {queue.length === 0 && (
            <div className="py-8 text-center text-[#ccc3d8] font-space text-xs uppercase bg-[#14121a] rounded-xl border border-dashed border-white/10">
              No active buzzes recorded. Ready for next clue!
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-[#36333d]">
          <button
            type="button"
            onClick={onClearQueue}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#2b2932] hover:bg-[#36333d] text-[#ffb4ab] font-space text-xs font-bold uppercase rounded-xl transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Buzzer Lock</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#c3f400] text-black font-space text-xs font-bold uppercase rounded-xl hover:bg-[#abd600] transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
